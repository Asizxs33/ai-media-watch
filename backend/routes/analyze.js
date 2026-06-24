import { Router } from 'express';
import { classifyContent, classifyImage } from '../services/classifier.js';
import { scrapePageText, detectPlatform } from '../services/scraper.js';
import { transcribeFromUrl } from '../services/transcriber.js';
import { savePost } from '../services/db.js';

export const analyzeRouter = Router();

/**
 * POST /api/analyze/image
 * Analyze a SCREENSHOT via Claude Vision (OCR + requisites + classification).
 * Body: { imageBase64, mediaType }
 */
const ALLOWED_MEDIA = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

analyzeRouter.post('/image', async (req, res) => {
  let { imageBase64, mediaType = 'image/png' } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ success: false, error: 'imageBase64 обязателен' });
  }
  // на случай если прислали data:-URL целиком
  const m = /^data:(image\/[a-z+]+);base64,(.*)$/s.exec(imageBase64);
  if (m) { mediaType = m[1]; imageBase64 = m[2]; }
  if (!ALLOWED_MEDIA.includes(mediaType)) {
    return res.status(400).json({ success: false, error: `Формат не поддерживается: ${mediaType}` });
  }

  try {
    const result = await classifyImage({ imageBase64, mediaType });
    return res.json({ success: true, source: 'image', ...result });
  } catch (err) {
    console.error('[/image]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/analyze/text
 * Analyze manually provided text (caption + hashtags).
 * Body: { caption, hashtags?, username?, platform? }
 */
analyzeRouter.post('/text', async (req, res) => {
  const { caption, hashtags = [], username = '', platform = 'unknown' } = req.body;

  if (!caption?.trim()) {
    return res.status(400).json({ success: false, error: 'caption обязателен' });
  }

  try {
    const result = await classifyContent({ caption, hashtags, username, platform });
    return res.json({ success: true, source: 'text', ...result });
  } catch (err) {
    console.error('[/text]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/analyze/report
 * Save extension detection result to DB.
 * Called when: (a) risk >= threshold, (b) user explicitly blocks a URL.
 * Body: { url, platform, username, caption, riskScore, category, reason, schemeTypes, blocked }
 */
analyzeRouter.post('/report', async (req, res) => {
  const { url, platform = 'unknown', username = '', caption = '',
          riskScore = 0, category = 'safe', reason = '',
          schemeTypes = [], blocked = false } = req.body;

  if (!url) return res.status(400).json({ success: false, error: 'url обязателен' });

  try {
    const id = `ext-${Buffer.from(url).toString('base64').slice(0, 24)}-${Date.now()}`;
    await savePost({
      id, platform, username, caption: caption.slice(0, 500), url,
      riskScore, category, reason,
      schemeTypes: Array.isArray(schemeTypes) ? schemeTypes : [schemeTypes],
      status: blocked ? 'blocked' : (riskScore >= 75 ? 'blocked' : 'pending'),
      keyword: 'extension',
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('[/report]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/analyze/deep
 * Extension deep analysis: DOM text (fast) + optional audio transcription (if risk >= 45).
 * Body: { url, caption, username, platform }
 */
analyzeRouter.post('/deep', async (req, res) => {
  const { url, caption = '', username = '', platform = 'unknown' } = req.body;

  if (!caption?.trim() && !url?.trim()) {
    return res.status(400).json({ success: false, error: 'caption или url обязателен' });
  }

  let transcript = '';
  let audioAnalyzed = false;

  // Step 0: If caption is too short and URL provided, scrape page for more context
  let fullCaption = caption;
  if (url && (!caption || caption.length < 30)) {
    try {
      const scraped = await scrapePageText(url);
      if (scraped?.text) {
        fullCaption = [caption, scraped.text].filter(Boolean).join('\n').slice(0, 3000);
        console.log(`[/deep] Scraped ${scraped.text.length} chars to supplement empty caption`);
      }
    } catch (e) {
      console.warn('[/deep] Scrape fallback failed:', e.message);
    }
  }

  // Step 1: Fast text classification
  let result;
  try {
    result = await classifyContent({ caption: fullCaption, username, platform });
  } catch (err) {
    console.error('[/deep] classify error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }

  // Step 2: If URL provided and text risk >= 45%, try audio transcription
  const AUDIO_THRESHOLD = 45;
  if (url && (result.riskScore ?? 0) >= AUDIO_THRESHOLD) {
    try {
      console.log(`[/deep] Risk ${result.riskScore}% — transcribing ${url}`);
      transcript = await transcribeFromUrl(url) ?? '';
      if (transcript) {
        audioAnalyzed = true;
        result = await classifyContent({ caption, username, platform, transcript });
        console.log(`[/deep] Audio re-classify → ${result.riskScore}%`);
      }
    } catch (err) {
      console.warn('[/deep] Audio failed (non-fatal):', err.message);
    }
  }

  return res.json({
    success: true,
    source: 'extension-deep',
    audioAnalyzed,
    transcript: transcript.slice(0, 500),
    ...result,
  });
});

/**
 * POST /api/analyze/url
 * Analyze a social media post by URL.
 * Pipeline: scrape page text → (try) Whisper transcription → Claude classification
 * Body: { url }
 */
analyzeRouter.post('/url', async (req, res) => {
  const { url } = req.body;

  if (!url?.trim()) {
    return res.status(400).json({ success: false, error: 'url обязателен' });
  }

  let scraped = { text: '', platform: detectPlatform(url), url };
  let transcript = '';
  const steps = [];

  // Step 1: Scrape page text
  try {
    scraped = await scrapePageText(url);
    steps.push('scrape_ok');
    console.log(`[/url] Scraped ${scraped.text.length} chars from ${url}`);
  } catch (err) {
    steps.push('scrape_fail: ' + err.message);
    console.warn('[/url] Scrape failed:', err.message);
  }

  // Step 2: Try Whisper transcription (requires yt-dlp)
  try {
    transcript = await transcribeFromUrl(url) ?? '';
    if (transcript) {
      steps.push('whisper_ok');
      console.log(`[/url] Whisper returned ${transcript.length} chars`);
    } else {
      steps.push('whisper_skip');
    }
  } catch (err) {
    steps.push('whisper_fail: ' + err.message);
    console.warn('[/url] Whisper failed:', err.message);
  }

  if (!scraped.text && !transcript) {
    return res.status(422).json({
      success: false,
      error: 'Не удалось получить текст со страницы. Проверь URL или вставь текст вручную.',
      steps,
    });
  }

  // Step 3: Claude classification
  try {
    const result = await classifyContent({
      platform: scraped.platform,
      scrapedText: scraped.text,
      transcript,
    });

    // Save to DB (fire and forget)
    savePost({
      id: `url-${Date.now()}`,
      platform: scraped.platform,
      url,
      caption: scraped.text.slice(0, 500),
      ...result,
    }).catch(() => {});

    return res.json({
      success: true,
      source: 'url',
      url,
      scrapedText: scraped.text.slice(0, 500),
      transcript: transcript.slice(0, 1000),
      steps,
      ...result,
    });
  } catch (err) {
    console.error('[/url] Claude error:', err.message);
    return res.status(500).json({ success: false, error: err.message, steps });
  }
});
