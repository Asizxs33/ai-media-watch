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
import { searchYoutube, searchTiktok } from '../services/search.js';
import { classifyContent } from '../services/classifier.js';

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
            const cls = await classifyContent({
              platform: 'youtube', username: video.uploader, caption: video.title, scrapedText: text,
            });
            found++;
            emit('result', {
              id: `yt-${video.id}`, url: video.url, platform: 'youtube',
              username: video.uploader, title: video.title, thumbnail: video.thumbnail,
              viewCount: video.viewCount, duration: video.duration, keyword, ...cls,
            });
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
            const cls = await classifyContent({
              platform: 'tiktok', username: video.uploader, caption: video.description, scrapedText: text,
            });
            found++;
            emit('result', {
              id: `tt-${video.id}`, url: video.url, platform: 'tiktok',
              username: video.uploader, title: video.title, thumbnail: video.thumbnail,
              viewCount: video.viewCount, keyword, ...cls,
            });
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
