/**
 * Spectra AI — Autonomous fraud scanner.
 *
 * Runs in the background on the server — no user action needed.
 * Every SCAN_INTERVAL_MS it:
 *  1. Searches YouTube for live streams + recent videos matching fraud keywords
 *  2. Live streams  → downloads 90-second audio sample → Whisper → Claude
 *  3. Long videos   → full audio download → Whisper with timestamps → Claude
 *  4. Saves findings to DB; keeps last 50 detections in memory for /api/scanner/status
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, statSync, mkdirSync } from 'node:fs';
import { unlink, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { formatSegments } from './transcriber.js';
import { classifyContent, classifyImage } from './classifier.js';
import { savePost } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = join(__dirname, '../tmp');
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

// ── Configuration ─────────────────────────────────────────────────────────────
const SCAN_INTERVAL_MS = 20 * 60 * 1000; // 20 min between full cycles
const LIVE_SAMPLE_MS   = 90_000;          // capture 90s of live audio
const MAX_PER_KEYWORD  = 4;               // videos scanned per keyword per cycle
const RISK_THRESHOLD   = 60;             // minimum riskScore to save as finding

// All major fraud schemes active in Kazakhstan — not just casino
const FRAUD_KEYWORDS = [
  // Казино / ставки
  'казино прямой эфир',
  'онлайн казино выигрыш',
  'спортставки заработок',
  // Финансовые пирамиды / MLM
  'пассивный доход инвестиции',
  'MLM сетевой бизнес заработок',
  'партнёрская программа прибыль',
  // "Закинь-получи" схемы
  'закинь получи прибыль',
  'вложи удвою деньги',
  'пришли деньги верну больше',
  // Форекс / трейдинг
  'форекс сигналы заработок',
  'трейдинг обучение прибыль',
  'бинарные опционы заработок',
  // Крипто мошенничество
  'крипта быстрый заработок',
  'bitcoin инвестиции гарантия',
  'криптовалюта удвоение',
  // Работа / вакансии
  'работа в интернете без вложений',
  'удалённая работа заработок',
  // Kaspi / карты
  'Kaspi перевод заработок',
  'номер карты перевод выигрыш',
  // Розыгрыши фейковые
  'розыгрыш приз победитель',
  'выиграл получи деньги',
  // Прямые эфиры (все платформы)
  'заработок прямой эфир live',
  'инвестиции прямой эфир',
];

// yt-dlp binary candidates (Windows paths + PATH)
const YTDLP_CANDIDATES = [
  'yt-dlp',
  'C:\\Users\\Admin\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\yt-dlp.exe',
  'C:\\Users\\Admin\\AppData\\Roaming\\Python\\Python312\\Scripts\\yt-dlp.exe',
];

// ── Scanner state (read by /api/scanner/status) ───────────────────────────────
export const scannerState = {
  running:          false,
  paused:           false,
  lastRunAt:        null,
  lastRunDurationS: null,
  nextRunAt:        null,
  totalScanned:     0,
  totalFound:       0,
  currentKeyword:   null,
  lastError:        null,
  recentFindings:   [],
  // per-platform counters
  byPlatform: {
    youtube: 0, tiktok: 0, vk: 0, rutube: 0, ok: 0,
  },
};

// URLs already analyzed in this server session — avoid re-scanning
const scannedUrls = new Set();

// ── yt-dlp helpers ────────────────────────────────────────────────────────────
function spawnYtDlp(args) {
  for (const bin of YTDLP_CANDIDATES) {
    try {
      return spawn(bin, args, { shell: false, windowsHide: true });
    } catch {}
  }
  return spawn('yt-dlp', args, { shell: true, windowsHide: true });
}

function killProcess(proc) {
  try {
    // Windows: kill entire process tree so yt-dlp child ffmpeg is also killed
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { shell: true, windowsHide: true });
    } else {
      proc.kill('SIGTERM');
    }
  } catch {}
}

// ── Platform definitions ──────────────────────────────────────────────────────
// Each entry: yt-dlp search prefix + platform id used in DB/UI
const PLATFORMS = [
  { prefix: 'ytsearch',      id: 'youtube',   label: 'YouTube'   },
  { prefix: 'ttsearch',      id: 'tiktok',    label: 'TikTok'    },
  { prefix: 'vksearch',      id: 'vk',        label: 'ВКонтакте' },
  { prefix: 'rutube_search', id: 'rutube',    label: 'Rutube'    },
  { prefix: 'oksearch',      id: 'ok',        label: 'OK.ru'     },
];

// ── Generic platform search ───────────────────────────────────────────────────
/**
 * Search any platform supported by yt-dlp via its search prefix.
 * Returns array of video metadata. Empty array on any error.
 */
async function searchPlatform(prefix, platformId, query, limit = 8) {
  return new Promise((resolve) => {
    const results = [];
    const proc = spawnYtDlp([
      `${prefix}${limit}:${query}`,
      '--flat-playlist', '--dump-json', '--no-download',
      '--quiet', '--no-warnings',
    ]);

    const rl = createInterface({ input: proc.stdout });
    rl.on('line', (line) => {
      try {
        const v = JSON.parse(line.trim());
        if (!v?.id) return;
        results.push({
          id:        v.id,
          url:       v.webpage_url || v.url || '',
          title:     v.title || '',
          uploader:  v.uploader || v.channel || v.uploader_id || '',
          isLive:    v.is_live === true || v.live_status === 'is_live',
          duration:  v.duration || 0,
          viewCount: v.view_count || 0,
          thumbnail: v.thumbnail || '',
          platform:  platformId,
        });
      } catch {}
    });

    // Per-platform timeout: some platforms are slower
    const ms = platformId === 'youtube' ? 60_000 : 45_000;
    const timer = setTimeout(() => { killProcess(proc); resolve(results); }, ms);
    proc.on('close', () => { clearTimeout(timer); resolve(results); });
  });
}

// ── Live stream audio sampling ────────────────────────────────────────────────
/**
 * Download ~90 seconds from a live stream URL.
 * yt-dlp is killed after LIVE_SAMPLE_MS ms; whatever is on disk gets used.
 * Returns local file path or null.
 */
async function sampleLiveAudio(url) {
  const out = join(TMP_DIR, `live_${Date.now()}.webm`);
  return new Promise((resolve) => {
    const proc = spawnYtDlp([
      url,
      '--extract-audio', '--audio-format', 'webm',
      '--audio-quality', '9',     // lowest quality → smallest file
      '--output', out,
      '--quiet', '--no-playlist', '--no-continue',
      '--live-from-start',
    ]);

    const timer = setTimeout(() => {
      killProcess(proc);
      // Give OS a second to flush the file
      setTimeout(() => {
        const ok = existsSync(out) && statSync(out).size > 8_000;
        resolve(ok ? out : null);
      }, 1500);
    }, LIVE_SAMPLE_MS);

    proc.on('close', () => {
      clearTimeout(timer);
      const ok = existsSync(out) && statSync(out).size > 8_000;
      resolve(ok ? out : null);
    });
  });
}

// ── Full video audio download ─────────────────────────────────────────────────
/**
 * Download full audio of a (non-live) video.
 * Returns file path or null.
 */
async function downloadVideoAudio(url) {
  const out = join(TMP_DIR, `video_${Date.now()}.webm`);
  return new Promise((resolve) => {
    const proc = spawnYtDlp([
      url,
      '--extract-audio', '--audio-format', 'webm',
      '--audio-quality', '5',
      '--output', out,
      '--max-filesize', '50m',
      '--socket-timeout', '30',
      '--quiet', '--no-playlist',
    ]);

    const timer = setTimeout(() => { killProcess(proc); resolve(null); }, 120_000);
    proc.on('close', () => {
      clearTimeout(timer);
      resolve(existsSync(out) ? out : null);
    });
  });
}

// ── Transcribe local file ─────────────────────────────────────────────────────
// transcribeLocal is NOT exported from transcriber.js (it's internal).
// We re-use the same whisper_local.py via spawnSync here.
const WHISPER_SCRIPT = join(__dirname, 'whisper_local.py');

function transcribeFile(audioPath) {
  const r = spawnSync('python', [WHISPER_SCRIPT, audioPath], {
    encoding: 'utf8', timeout: 200_000,
  });
  if (r.error || r.status !== 0) return null;
  try {
    const p = JSON.parse(r.stdout.trim());
    return p.error ? null : (p.text ? p : null);
  } catch { return null; }
}

/**
 * Capture a single JPEG frame from a live stream using yt-dlp + ffmpeg.
 * Returns base64 string or null.
 */
async function captureLiveFrame(url) {
  const framePath = join(TMP_DIR, `frame_${Date.now()}.jpg`);
  return new Promise((resolve) => {
    // Use yt-dlp to get the direct stream URL, pipe one frame via ffmpeg
    const ytproc = spawnYtDlp([url, '--get-url', '--quiet', '--no-warnings']);
    let streamUrl = '';
    ytproc.stdout.on('data', d => { streamUrl += d.toString(); });
    ytproc.on('close', () => {
      streamUrl = streamUrl.trim().split('\n')[0];
      if (!streamUrl) return resolve(null);

      const ff = spawn('ffmpeg', [
        '-i', streamUrl, '-vframes', '1', '-q:v', '3', '-y', framePath,
      ], { shell: false, windowsHide: true });

      const timer = setTimeout(() => { killProcess(ff); resolve(null); }, 20_000);
      ff.on('close', async () => {
        clearTimeout(timer);
        if (!existsSync(framePath)) return resolve(null);
        try {
          const buf = await readFile(framePath);
          await unlink(framePath).catch(() => {});
          resolve(buf.toString('base64'));
        } catch { resolve(null); }
      });
    });
    setTimeout(() => { killProcess(ytproc); }, 15_000);
  });
}

/**
 * Fetch a thumbnail URL and return its base64 content.
 * Used as fallback visual analysis when no audio transcript is available.
 */
async function fetchThumbnail(thumbnailUrl) {
  try {
    const { default: https } = await import('node:https');
    const { default: http  } = await import('node:http');
    return await new Promise((resolve, reject) => {
      const lib = thumbnailUrl.startsWith('https') ? https : http;
      lib.get(thumbnailUrl, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
        res.on('error', reject);
      }).on('error', reject);
    });
  } catch { return null; }
}

// ── Core scan logic ───────────────────────────────────────────────────────────
async function scanOne(video, keyword) {
  if (scannedUrls.has(video.url)) return null;
  scannedUrls.add(video.url);
  scannerState.totalScanned++;

  console.log(`[scanner] → ${video.isLive ? '🔴 LIVE' : '🎬 VOD '} "${video.title.slice(0, 60)}"`);

  let audioPath = null;
  let cleanupPath = null;

  try {
    if (video.isLive) {
      audioPath = await sampleLiveAudio(video.url);
      cleanupPath = audioPath;
    } else if (video.duration >= 30) {
      audioPath = await downloadVideoAudio(video.url);
      cleanupPath = audioPath;
    }

    // Transcribe audio
    let transcript = '';
    let formattedTranscript = '';
    if (audioPath) {
      const t = transcribeFile(audioPath);
      if (t?.text) {
        transcript = t.text;
        formattedTranscript = formatSegments(t.segments);
        console.log(`[scanner]   Transcript: ${transcript.length} chars, ${t.segments?.length || 0} segments`);
      }
    }

    // ── No description + no transcript → visual fallback ─────────────────────
    // Live streams often have no caption. Capture a frame so Claude can OCR
    // on-screen text: Kaspi numbers, "send money", casino UI, QR codes, etc.
    let imageBase64 = null;
    const hasText = (video.title?.length ?? 0) + transcript.length > 20;
    if (!hasText) {
      console.log(`[scanner]   No text — trying visual analysis`);
      if (video.isLive) {
        imageBase64 = await captureLiveFrame(video.url);
        if (imageBase64) console.log(`[scanner]   Captured live frame`);
      }
      if (!imageBase64 && video.thumbnail) {
        imageBase64 = await fetchThumbnail(video.thumbnail);
        if (imageBase64) console.log(`[scanner]   Using thumbnail`);
      }
    }

    // ── Classify ──────────────────────────────────────────────────────────────
    let cls;
    if (imageBase64 && !hasText) {
      // Visual-only: classifyImage does OCR + fraud classification in one call
      const imgResult = await classifyImage({ imageBase64, mediaType: 'image/jpeg' });
      cls = { ...imgResult };
      if (imgResult?.ocrText) transcript = imgResult.ocrText; // log what was read
    } else if (imageBase64) {
      // Hybrid: text analysis + image in parallel, take the highest risk
      const [textCls, imgCls] = await Promise.all([
        classifyContent({ platform: video.platform, username: video.uploader, caption: video.title, transcript, formattedTranscript }),
        classifyImage({ imageBase64, mediaType: 'image/jpeg' }),
      ]);
      cls = (imgCls?.riskScore ?? 0) > (textCls?.riskScore ?? 0) ? imgCls : textCls;
    } else {
      cls = await classifyContent({
        platform:  video.platform,
        username:  video.uploader,
        caption:   video.title,
        transcript,
        formattedTranscript,
      });
    }

    if (cls.riskScore < RISK_THRESHOLD) {
      console.log(`[scanner]   OK (risk ${cls.riskScore}%)`);
      return null;
    }

    const finding = {
      id:          `auto-${video.platform}-${video.id}-${Date.now()}`,
      platform:    video.platform,
      url:         video.url,
      username:    video.uploader,
      title:       video.title,
      thumbnail:   video.thumbnail,
      isLive:      video.isLive,
      duration:    video.duration,
      viewCount:   video.viewCount,
      keyword,
      transcript:  transcript.slice(0, 500),
      detectedAt:  new Date().toISOString(),
      source:      video.isLive ? 'autonomous-live' : 'autonomous-vod',
      ...cls,
    };

    await savePost({
      ...finding,
      caption: video.title,
      status:  cls.riskScore >= 75 ? 'blocked' : 'pending',
    }).catch(() => {});

    scannerState.recentFindings.unshift(finding);
    if (scannerState.recentFindings.length > 50) scannerState.recentFindings.pop();
    scannerState.totalFound++;
    if (video.platform in scannerState.byPlatform) scannerState.byPlatform[video.platform]++;

    const ts = cls.fraudTimestamps?.length ? ` | timestamps: ${cls.fraudTimestamps.join(', ')}` : '';
    console.log(`[scanner] 🚨 FOUND risk=${cls.riskScore}% cat=${cls.category}${ts} — "${video.title.slice(0, 50)}"`);
    return finding;

  } finally {
    if (cleanupPath) await unlink(cleanupPath).catch(() => {});
  }
}

// ── Scan cycle ────────────────────────────────────────────────────────────────
async function runCycle() {
  if (scannerState.running) {
    console.log('[scanner] Still running, skipping cycle');
    return;
  }
  if (scannerState.paused) {
    console.log('[scanner] Paused, skipping cycle');
    return;
  }

  scannerState.running = true;
  scannerState.lastRunAt = new Date().toISOString();
  const t0 = Date.now();

  console.log('\n[scanner] ═══════ Autonomous scan started ═══════');

  try {
    for (const keyword of FRAUD_KEYWORDS) {
      if (scannerState.paused) break;
      scannerState.currentKeyword = keyword;
      console.log(`[scanner] Keyword: "${keyword}" — searching ${PLATFORMS.length} platforms in parallel`);

      // Search all platforms simultaneously
      const settled = await Promise.allSettled(
        PLATFORMS.map(p => searchPlatform(p.prefix, p.id, keyword, MAX_PER_KEYWORD * 2))
      );

      const allVideos = settled.flatMap((r, i) => {
        if (r.status === 'rejected') {
          console.warn(`[scanner]   ${PLATFORMS[i].label} search failed:`, r.reason?.message);
          return [];
        }
        const found = r.value.filter(v => v.url);
        if (found.length) console.log(`[scanner]   ${PLATFORMS[i].label}: ${found.length} results (${found.filter(v => v.isLive).length} live)`);
        return found;
      });

      // Prioritize: live first, then sort by viewCount (more viewers = more potential victims)
      const live    = allVideos.filter(v => v.isLive);
      const regular = allVideos.filter(v => !v.isLive && v.duration >= 30)
                               .sort((a, b) => b.viewCount - a.viewCount);
      const toScan  = [...live, ...regular].slice(0, MAX_PER_KEYWORD * PLATFORMS.length);

      console.log(`[scanner]   Total: ${allVideos.length} → scanning ${toScan.length} (${live.length} live)`);

      for (const v of toScan) {
        if (scannerState.paused) break;
        await scanOne(v, keyword);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  } catch (err) {
    scannerState.lastError = err.message;
    console.error('[scanner] Cycle error:', err.message);
  } finally {
    scannerState.running          = false;
    scannerState.currentKeyword   = null;
    scannerState.lastRunDurationS = Math.round((Date.now() - t0) / 1000);
    scannerState.nextRunAt        = new Date(Date.now() + SCAN_INTERVAL_MS).toISOString();
    console.log(`[scanner] ═══════ Done in ${scannerState.lastRunDurationS}s | found=${scannerState.totalFound} scanned=${scannerState.totalScanned} ═══════\n`);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
let scanTimer = null;

export function pauseScanner() {
  scannerState.paused = true;
  scannerState.nextRunAt = null;
  console.log('[scanner] Paused by user');
}

export function resumeScanner() {
  scannerState.paused = false;
  scannerState.nextRunAt = new Date(Date.now() + 5000).toISOString();
  console.log('[scanner] Resumed by user — running in 5s');
  setTimeout(runCycle, 5000);
}

export function startAutonomousScanner() {
  if (scanTimer) return;
  console.log(`[scanner] Autonomous scanner armed — first scan in 30s, then every ${SCAN_INTERVAL_MS / 60000}min`);
  scannerState.nextRunAt = new Date(Date.now() + 30_000).toISOString();

  // First run: 30 seconds after server start (let DB and routes stabilize)
  setTimeout(() => {
    runCycle();
    scanTimer = setInterval(runCycle, SCAN_INTERVAL_MS);
  }, 30_000);
}

export async function triggerManualScan() {
  if (scannerState.running) throw new Error('Scanner already running');
  runCycle(); // fire-and-forget
}
