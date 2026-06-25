/**
 * Live Scanner.
 *
 * Два транспорта:
 *  - SSE:     GET  /api/livescan/stream   (для локальной разработки)
 *  - Polling: POST /api/livescan/start  +  GET /api/livescan/poll
 *             (надёжно работает через прокси/туннели, которые буферизуют стримы,
 *              например бесплатный Cloudflare quick tunnel)
 *
 * Типы событий: status | found | result | error | done
 */
import { Router } from 'express';
import { spawnSync } from 'node:child_process';
import { YoutubeTranscript } from 'youtube-transcript';
import { searchYoutube, searchTiktok } from '../services/search.js';
import { classifyContent } from '../services/classifier.js';
import { savePost, saveScanResult, getScanResults, clearScanResults } from '../services/db.js';
import { transcribeFromUrl, formatSegments } from '../services/transcriber.js';

/**
 * Convert MS offset/duration to our Segment format.
 * Returns null if the video has no captions.
 */
async function fetchYouTubeCaptions(videoId) {
  const raw = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ru' })
    .catch(() => YoutubeTranscript.fetchTranscript(videoId)); // fallback: any language
  if (!raw?.length) return null;

  const segments = raw.map((item) => {
    const start = item.offset / 1000;
    const end   = (item.offset + item.duration) / 1000;
    const m     = Math.floor(start / 60);
    const s     = Math.floor(start % 60);
    const ts    = `${m}:${String(s).padStart(2, '0')}`;
    return { start, end, text: item.text.replace(/\n/g, ' '), ts };
  });

  const text = segments.map((s) => s.text).join(' ');
  return { segments, text };
}

/** Extract YouTube video ID from URL */
function ytVideoId(url = '') {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** Extract TikTok video ID from URL */
function tiktokVideoId(url = '') {
  const m = url.match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * Try to get TikTok auto-captions via yt-dlp dump-json.
 * TikTok sometimes blocks server IPs — fails gracefully, caller falls back to Whisper.
 */
async function fetchTikTokCaptions(url) {
  const YTDLP = 'C:\\Users\\Admin\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\yt-dlp.exe';
  const candidates = [YTDLP, 'yt-dlp'];

  let meta = null;
  for (const bin of candidates) {
    const r = spawnSync(bin, ['--dump-json', '--no-playlist', '--no-warnings', url], {
      encoding: 'utf8', timeout: 25000,
    });
    if (r.status === 0 && r.stdout?.trim()) { meta = r.stdout.trim(); break; }
  }
  if (!meta) return null;

  let info;
  try { info = JSON.parse(meta); } catch { return null; }

  const autoCaps = info.automatic_captions ?? {};
  const lang = autoCaps['ru'] ? 'ru' : autoCaps['en'] ? 'en' : Object.keys(autoCaps)[0];
  if (!lang) return null;

  const tracks = autoCaps[lang] ?? [];
  const track  = tracks.find(t => t.ext === 'json3') ?? tracks[0];
  if (!track?.url) return null;

  try {
    const res = await fetch(track.url);
    if (!res.ok) return null;
    const raw = await res.text();

    // JSON3 format: { events: [{ tStartMs, dDurationMs, segs: [{ utf8 }] }] }
    const data = JSON.parse(raw);
    const segments = (data.events ?? [])
      .filter(e => e.segs?.some(s => s.utf8?.trim()))
      .map(e => {
        const start = (e.tStartMs ?? 0) / 1000;
        const end   = ((e.tStartMs ?? 0) + (e.dDurationMs ?? 2000)) / 1000;
        const text  = e.segs.map(s => s.utf8 ?? '').join('').replace(/\n/g, ' ').trim();
        const m     = Math.floor(start / 60);
        const s     = Math.floor(start % 60);
        return { start, end, text, ts: `${m}:${String(s).padStart(2, '0')}` };
      })
      .filter(s => s.text.length > 1);

    if (!segments.length) return null;
    return { segments, text: segments.map(s => s.text).join(' ') };
  } catch {
    return null;
  }
}

// Transcribe only if initial risk score is above this threshold
const TRANSCRIBE_RISK_THRESHOLD = 60;

export const livescanRouter = Router();

/* ─────────────────────────────────────────────
   Параметры запроса
   ───────────────────────────────────────────── */
function parseParams(src) {
  const rawKeywords = src.keywords ?? 'казино заработок';
  const keywords  = String(rawKeywords).split(',').map((k) => k.trim()).filter(Boolean);
  const platforms = String(src.platforms ?? 'youtube').split(',').map((p) => p.trim());
  const limit     = Math.min(Number(src.limit ?? 15), 30);
  return { keywords: keywords.length ? keywords : ['казино'], platforms, limit };
}

/* ─────────────────────────────────────────────
   Общая логика сканирования.
   emit(type, data) — куда складывать события (SSE или сессия).
   getAborted() — прервать ли скан.
   ───────────────────────────────────────────── */
async function runScan({ keywords, platforms, limit }, emit, getAborted) {
  const perKeyword = Math.ceil(limit / keywords.length);
  let scanned = 0;
  let found = 0;

  emit('status', { message: `Сканирование: "${keywords.join(', ')}"`, platforms, limit });

  for (const keyword of keywords) {
    if (getAborted()) break;

    // ── YouTube ──
    if (platforms.includes('youtube')) {
      try {
        for await (const video of searchYoutube(keyword, perKeyword)) {
          if (getAborted()) break;
          scanned++;

          emit('found', {
            id: `yt-${video.id}`, url: video.url, platform: 'youtube',
            title: video.title, username: video.uploader,
            thumbnail: video.thumbnail, viewCount: video.viewCount, keyword,
          });

          try {
            const text = [video.title, video.description, video.tags.map((t) => `#${t}`).join(' ')]
              .filter(Boolean).join('\n');

            // Step 1: fast text classification
            const clsText = await classifyContent({
              platform: 'youtube', username: video.uploader, caption: video.title, scrapedText: text,
            });

            // Step 2: if suspicious — transcribe with timestamps and re-classify
            let cls = clsText;
            let transcript = '';
            if (clsText.riskScore >= TRANSCRIBE_RISK_THRESHOLD) {
              emit('status', { message: `Транскрибирую аудио: ${video.title.slice(0, 50)}...` });
              try {
                const transcriptResult = await transcribeFromUrl(video.url);
                if (transcriptResult?.text) {
                  transcript = transcriptResult.text;
                  const formattedTranscript = formatSegments(transcriptResult.segments);
                  cls = await classifyContent({
                    platform: 'youtube', username: video.uploader,
                    caption: video.title, scrapedText: text,
                    transcript, formattedTranscript,
                  });
                }
              } catch { /* transcript failure is non-fatal */ }
            }

            found++;
            const ytResult = {
              id: `yt-${video.id}`, url: video.url, platform: 'youtube',
              username: video.uploader, title: video.title, thumbnail: video.thumbnail,
              viewCount: video.viewCount, duration: video.duration, keyword,
              transcript: transcript.slice(0, 1000), ...cls,
            };
            emit('result', ytResult);
            saveScanResult(ytResult, 'live').catch(() => {});
            savePost({ ...ytResult, caption: video.title }).catch(() => {});
          } catch (clsErr) {
            emit('error', { id: `yt-${video.id}`, message: clsErr.message });
          }
        }
      } catch (ytErr) {
        emit('error', { message: `YouTube search failed: ${ytErr.message}` });
      }
    }

    // ── TikTok ──
    if (platforms.includes('tiktok')) {
      try {
        let ttCount = 0;
        for await (const video of searchTiktok(keyword, perKeyword)) {
          if (getAborted()) break;
          scanned++;
          ttCount++;

          emit('found', {
            id: `tt-${video.id}`, url: video.url, platform: 'tiktok',
            title: video.title, username: video.uploader,
            thumbnail: video.thumbnail, viewCount: video.viewCount, keyword,
          });

          try {
            const text = [video.description, video.tags.map((t) => `#${t}`).join(' ')]
              .filter(Boolean).join('\n');

            // Step 1: fast text classification
            const clsText = await classifyContent({
              platform: 'tiktok', username: video.uploader, caption: video.description, scrapedText: text,
            });

            // Step 2: if suspicious — transcribe with timestamps and re-classify
            let cls = clsText;
            let transcript = '';
            if (clsText.riskScore >= TRANSCRIBE_RISK_THRESHOLD) {
              emit('status', { message: `Транскрибирую TikTok: ${(video.description || '').slice(0, 40)}...` });
              try {
                const transcriptResult = await transcribeFromUrl(video.url);
                if (transcriptResult?.text) {
                  transcript = transcriptResult.text;
                  const formattedTranscript = formatSegments(transcriptResult.segments);
                  cls = await classifyContent({
                    platform: 'tiktok', username: video.uploader,
                    caption: video.description, scrapedText: text,
                    transcript, formattedTranscript,
                  });
                }
              } catch { /* non-fatal */ }
            }

            found++;
            const ttResult = {
              id: `tt-${video.id}`, url: video.url, platform: 'tiktok',
              username: video.uploader, title: video.title, thumbnail: video.thumbnail,
              viewCount: video.viewCount, keyword,
              transcript: transcript.slice(0, 1000), ...cls,
            };
            emit('result', ttResult);
            saveScanResult(ttResult, 'live').catch(() => {});
            savePost({ ...ttResult, caption: video.description || video.title }).catch(() => {});
          } catch (clsErr) {
            emit('error', { id: `tt-${video.id}`, message: clsErr.message });
          }
        }
        if (ttCount === 0) {
          emit('status', { message: 'TikTok: поиск может быть ограничен без авторизации' });
        }
      } catch (ttErr) {
        emit('error', { message: `TikTok search failed: ${ttErr.message}` });
      }
    }
  }

  return { scanned, found };
}

/* ─────────────────────────────────────────────
   SSE — локальная разработка
   ───────────────────────────────────────────── */
livescanRouter.get('/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let aborted = false;
  req.on('close', () => { aborted = true; });

  const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const { scanned, found } = await runScan(parseParams(req.query), send, () => aborted);
    send('done', { scanned, found });
  } catch (err) {
    send('error', { message: err.message });
    send('done', { scanned: 0, found: 0 });
  }
  res.end();
});

/* ─────────────────────────────────────────────
   Polling — для прода через туннель
   ───────────────────────────────────────────── */
const sessions = new Map(); // scanId -> { events, done, scanned, found, aborted, createdAt }
const SESSION_TTL = 10 * 60 * 1000;

function pruneSessions() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL) sessions.delete(id);
  }
}

livescanRouter.post('/start', (req, res) => {
  pruneSessions();
  const params = parseParams({ ...req.query, ...req.body });
  const scanId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const session = { events: [], done: false, scanned: 0, found: 0, aborted: false, createdAt: Date.now() };
  sessions.set(scanId, session);

  const emit = (type, data) => session.events.push({ type, ...data });

  runScan(params, emit, () => session.aborted)
    .then(({ scanned, found }) => { session.scanned = scanned; session.found = found; })
    .catch((err) => { session.events.push({ type: 'error', message: err.message }); })
    .finally(() => { session.done = true; });

  res.json({ scanId });
});

livescanRouter.get('/poll', (req, res) => {
  const { scanId } = req.query;
  const cursor = Number(req.query.cursor ?? 0) || 0;
  const session = sessions.get(scanId);
  if (!session) return res.status(404).json({ error: 'Сессия не найдена или истекла' });

  res.json({
    events: session.events.slice(cursor),
    cursor: session.events.length,
    done: session.done,
    scanned: session.scanned,
    found: session.found,
  });
});

livescanRouter.post('/stop', (req, res) => {
  const session = sessions.get(req.query.scanId ?? req.body?.scanId);
  if (session) session.aborted = true;
  res.json({ ok: true });
});

/* ─────────────────────────────────────────────
   Deep scan — long video analysis with full Whisper transcription
   Always transcribes every video. Returns timestamped segments + fraudTimestamps.
   Max 15 videos (hard cap — each video takes ~30-120s to transcribe).
   ───────────────────────────────────────────── */
async function runDeepScan({ keywords, limit, platforms = ['youtube'] }, emit, getAborted) {
  const cap = Math.min(limit, 15);
  const perKeyword = Math.ceil(cap / keywords.length);
  let scanned = 0;

  emit('status', { message: `Поиск видео: "${keywords.join(', ')}" [${platforms.join(', ')}]…` });

  for (const keyword of keywords) {
    if (getAborted() || scanned >= cap) break;

    if (platforms.includes('youtube')) try {
      for await (const video of searchYoutube(keyword, perKeyword * 5)) {
        if (getAborted() || scanned >= cap) break;
        // Deep scan = long content only (> 2 min); yt-dlp may return 0 if unknown
        if (video.duration > 0 && video.duration < 120) continue;
        scanned++;

        emit('found', {
          id: `yt-${video.id}`,
          url: video.url,
          platform: 'youtube',
          title: video.title,
          username: video.uploader,
          thumbnail: video.thumbnail,
          viewCount: video.viewCount,
          duration: video.duration,
          keyword,
        });

        try {
          const text = [
            video.title,
            video.description,
            video.tags.map((t) => `#${t}`).join(' '),
          ].filter(Boolean).join('\n');

          // ── Stage 1: Quick title/description check (no transcript) ───────────
          // Saves time: don't transcribe obviously safe videos
          const titleCls = await classifyContent({
            platform: 'youtube',
            username: video.uploader,
            caption: video.title,
            scrapedText: text,
          });

          const TITLE_SUSPICION_THRESHOLD = 35;
          if (titleCls.riskScore < TITLE_SUSPICION_THRESHOLD) {
            // Title looks clean → skip transcript, mark done immediately
            console.log(`[deep] ${video.id} title safe (${titleCls.riskScore}) — skipping transcript`);
            const safeResult = {
              id: `yt-${video.id}`, url: video.url, platform: 'youtube',
              username: video.uploader, title: video.title, thumbnail: video.thumbnail,
              viewCount: video.viewCount, duration: video.duration, keyword,
              transcript: '', segments: [], fraudTimestamps: [],
              transcriptSource: 'skipped',
              ...titleCls,
            };
            emit('result', safeResult);
            saveScanResult(safeResult, 'deep').catch(() => {});
            continue; // move to next video
          }

          // ── Stage 2: Transcript verification (title was suspicious) ──────────
          emit('status', {
            message: `⚠️ Подозрительное видео! Проверяю содержимое: "${video.title.slice(0, 40)}…"`,
            transcribingId: `yt-${video.id}`,
          });

          let segments = [];
          let transcript = '';
          let formattedTranscript = '';
          let transcriptSource = 'none';

          // Fast: YouTube auto-captions
          const vid = ytVideoId(video.url);
          if (vid) {
            try {
              const cap = await fetchYouTubeCaptions(vid);
              if (cap) {
                transcript          = cap.text;
                segments            = cap.segments;
                formattedTranscript = formatSegments(segments);
                transcriptSource    = 'captions';
                console.log(`[deep] captions OK for ${video.id}: ${segments.length} segs`);
              }
            } catch (e) {
              console.log(`[deep] captions unavailable for ${video.id}: ${e.message}`);
            }
          }

          // Slow: Whisper fallback
          if (!transcript) {
            emit('status', {
              message: `🎙 Whisper распознаёт речь: "${video.title.slice(0, 40)}…"`,
              transcribingId: `yt-${video.id}`,
            });
            try {
              const tr = await transcribeFromUrl(video.url);
              if (tr?.text) {
                transcript          = tr.text;
                segments            = tr.segments ?? [];
                formattedTranscript = formatSegments(segments);
                transcriptSource    = 'whisper';
              }
            } catch (e) {
              console.warn(`[deep] whisper failed for ${video.id}:`, e.message);
            }
          }

          console.log(`[deep] ${video.id} transcript=${transcriptSource} segs=${segments.length}`);

          // ── Stage 3: Final verdict with full transcript ───────────────────────
          const cls = await classifyContent({
            platform: 'youtube',
            username: video.uploader,
            caption: video.title,
            scrapedText: text,
            transcript,
            formattedTranscript,
          });

          const result = {
            id: `yt-${video.id}`,
            url: video.url,
            platform: 'youtube',
            username: video.uploader,
            title: video.title,
            thumbnail: video.thumbnail,
            viewCount: video.viewCount,
            duration: video.duration,
            keyword,
            transcript: transcript.slice(0, 5000),
            segments,
            transcriptSource,
            fraudTimestamps: Array.isArray(cls.fraudTimestamps) ? cls.fraudTimestamps : [],
            ...cls,
          };

          emit('result', result);

          // Always save deep scan results (user wants persistence across reloads)
          saveScanResult(result, 'deep').catch(() => {});
          if ((cls.riskScore ?? 0) >= 30) {
            savePost({ ...result, caption: video.title }).catch(() => {});
          }
        } catch (err) {
          emit('error', { id: `yt-${video.id}`, message: err.message });
        }
      }
    } catch (err) {
      emit('error', { message: `YouTube поиск не удался: ${err.message}` });
    }

    // ── TikTok ────────────────────────────────────────────────────────────────
    if (getAborted() || scanned >= cap) break;
    if (platforms.includes('tiktok')) try {
      let ttScanned = 0;
      for await (const video of searchTiktok(keyword, perKeyword * 4)) {
        if (getAborted() || scanned >= cap) break;
        if (video.duration > 0 && video.duration < 120) continue; // only long videos
        if (ttScanned >= Math.ceil(cap / keywords.length / 2)) break; // TikTok gets half the slots
        scanned++;
        ttScanned++;

        emit('found', {
          id: `tt-${video.id}`,
          url: video.url,
          platform: 'tiktok',
          title: video.title,
          username: video.uploader,
          thumbnail: video.thumbnail,
          viewCount: video.viewCount,
          duration: video.duration,
          keyword,
        });

        try {
          const text = [video.description, (video.tags ?? []).map(t => `#${t}`).join(' ')]
            .filter(Boolean).join('\n');

          // Stage 1: title check
          const titleCls = await classifyContent({
            platform: 'tiktok', username: video.uploader,
            caption: video.title, scrapedText: text,
          });

          if (titleCls.riskScore < TITLE_SUSPICION_THRESHOLD) {
            const safeResult = {
              id: `tt-${video.id}`, url: video.url, platform: 'tiktok',
              username: video.uploader, title: video.title, thumbnail: video.thumbnail,
              viewCount: video.viewCount, duration: video.duration, keyword,
              transcript: '', segments: [], fraudTimestamps: [],
              transcriptSource: 'skipped', ...titleCls,
            };
            emit('result', safeResult);
            saveScanResult(safeResult, 'deep').catch(() => {});
            continue;
          }

          emit('status', {
            message: `⚠️ TikTok подозрительный! Проверяю: "${(video.title || '').slice(0, 40)}…"`,
            transcribingId: `tt-${video.id}`,
          });

          let segments = [], transcript = '', formattedTranscript = '', transcriptSource = 'none';

          // Fast path: TikTok auto-captions via yt-dlp
          try {
            const cap = await fetchTikTokCaptions(video.url);
            if (cap) {
              transcript = cap.text; segments = cap.segments;
              formattedTranscript = formatSegments(segments);
              transcriptSource = 'captions';
              console.log(`[deep/tt] captions OK: ${segments.length} segs`);
            }
          } catch (e) {
            console.log(`[deep/tt] captions failed: ${e.message}`);
          }

          // Slow path: Whisper
          if (!transcript) {
            emit('status', {
              message: `🎙 Whisper TikTok: "${(video.title || '').slice(0, 40)}…"`,
              transcribingId: `tt-${video.id}`,
            });
            try {
              const tr = await transcribeFromUrl(video.url);
              if (tr?.text) {
                transcript = tr.text; segments = tr.segments ?? [];
                formattedTranscript = formatSegments(segments);
                transcriptSource = 'whisper';
              }
            } catch (e) {
              console.warn(`[deep/tt] whisper failed: ${e.message}`);
            }
          }

          const cls = await classifyContent({
            platform: 'tiktok', username: video.uploader,
            caption: video.title, scrapedText: text,
            transcript, formattedTranscript,
          });

          const result = {
            id: `tt-${video.id}`, url: video.url, platform: 'tiktok',
            username: video.uploader, title: video.title, thumbnail: video.thumbnail,
            viewCount: video.viewCount, duration: video.duration, keyword,
            transcript: transcript.slice(0, 5000), segments, transcriptSource,
            fraudTimestamps: Array.isArray(cls.fraudTimestamps) ? cls.fraudTimestamps : [],
            ...cls,
          };

          emit('result', result);
          saveScanResult(result, 'deep').catch(() => {});
          if ((cls.riskScore ?? 0) >= 30) {
            savePost({ ...result, caption: video.title }).catch(() => {});
          }
        } catch (err) {
          emit('error', { id: `tt-${video.id}`, message: err.message });
        }
      }
    } catch (err) {
      console.warn(`[deep/tt] TikTok search failed: ${err.message}`);
      // TikTok search is best-effort — don't emit error to user
    }
  }

  return { scanned, found: scanned };
}

livescanRouter.post('/deep/start', (req, res) => {
  pruneSessions();
  const params = parseParams({ ...req.query, ...req.body });
  params.limit = Math.min(params.limit, 15); // hard cap: each video takes minutes to transcribe
  const scanId = `deep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const session = { events: [], done: false, scanned: 0, found: 0, aborted: false, createdAt: Date.now() };
  sessions.set(scanId, session);

  const emit = (type, data) => session.events.push({ type, ...data });

  runDeepScan(params, emit, () => session.aborted)
    .then(({ scanned, found }) => { session.scanned = scanned; session.found = found; })
    .catch((err) => { session.events.push({ type: 'error', message: err.message }); })
    .finally(() => { session.done = true; });

  res.json({ scanId });
});
// Deep scan reuses the existing /poll and /stop endpoints (generic scanId lookup)

/* ─────────────────────────────────────────────
   Persisted results — load on page mount / clear on demand
   ───────────────────────────────────────────── */
livescanRouter.get('/results', async (req, res) => {
  try {
    const type    = req.query.type === 'deep' ? 'deep' : 'live';
    const limit   = Math.min(Number(req.query.limit ?? 50), 100);
    const results = await getScanResults(type, limit);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

livescanRouter.delete('/results', async (req, res) => {
  try {
    const type = req.query.type === 'deep' ? 'deep' : 'live';
    await clearScanResults(type);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
