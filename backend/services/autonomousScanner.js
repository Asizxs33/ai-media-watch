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

import { spawn } from 'node:child_process';
import { existsSync, statSync, mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { formatSegments } from './transcriber.js';
import { classifyContent } from './classifier.js';
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
  paused:           false,   // user explicitly stopped — skip scheduled cycles
  lastRunAt:        null,
  lastRunDurationS: null,
  nextRunAt:        null,
  totalScanned:     0,
  totalFound:       0,
  currentKeyword:   null,
  lastError:        null,
  recentFindings:   [],  // last 50 fraud detections
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

// ── Search ────────────────────────────────────────────────────────────────────
/**
 * Search YouTube via yt-dlp flat-playlist JSON output.
 * Returns array of video metadata objects.
 */
async function searchYouTube(query, limit = 15) {
  return new Promise((resolve) => {
    const results = [];
    const proc = spawnYtDlp([
      `ytsearch${limit}:${query}`,
      '--flat-playlist', '--dump-json', '--no-download',
      '--quiet', '--no-warnings',
    ]);

    const rl = createInterface({ input: proc.stdout });
    rl.on('line', (line) => {
      try {
        const v = JSON.parse(line.trim());
        if (!v?.id) return;
        results.push({
          id:         v.id,
          url:        v.webpage_url || `https://www.youtube.com/watch?v=${v.id}`,
          title:      v.title || '',
          uploader:   v.uploader || v.channel || '',
          isLive:     v.is_live === true || v.live_status === 'is_live',
          duration:   v.duration || 0,
          viewCount:  v.view_count || 0,
          thumbnail:  v.thumbnail || '',
        });
      } catch {}
    });

    const timer = setTimeout(() => { killProcess(proc); resolve(results); }, 60_000);
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
import { spawnSync } from 'node:child_process';
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

    // Transcribe
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

    // Classify — even if no transcript (title analysis alone may be enough)
    const cls = await classifyContent({
      platform: 'youtube',
      username:  video.uploader,
      caption:   video.title,
      transcript,
      formattedTranscript,
    });

    if (cls.riskScore < RISK_THRESHOLD) {
      console.log(`[scanner]   OK (risk ${cls.riskScore}%)`);
      return null;
    }

    const finding = {
      id:          `auto-yt-${video.id}-${Date.now()}`,
      platform:    'youtube',
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
      scannerState.currentKeyword = keyword;
      console.log(`[scanner] Keyword: "${keyword}"`);

      const videos = await searchYouTube(keyword, MAX_PER_KEYWORD * 3);

      // Prioritize live streams, then sort by view count (more views = more victims)
      const live    = videos.filter(v => v.isLive);
      const regular = videos.filter(v => !v.isLive && v.duration >= 60)
                            .sort((a, b) => b.viewCount - a.viewCount);
      const toScan  = [...live, ...regular].slice(0, MAX_PER_KEYWORD);

      console.log(`[scanner]   ${videos.length} results → scanning ${toScan.length} (${live.length} live)`);

      for (const v of toScan) {
        await scanOne(v, keyword);
        await new Promise(r => setTimeout(r, 1500)); // brief rate-limit pause
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
