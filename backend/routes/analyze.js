import { Router } from 'express';
import { classifyContent, classifyImage } from '../services/classifier.js';
import { scrapePageText, detectPlatform } from '../services/scraper.js';
import { transcribeFromUrl } from '../services/transcriber.js';

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
