import Anthropic from '@anthropic-ai/sdk';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

let claude = null;
if (process.env.ANTHROPIC_API_KEY) {
  claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ML_DIR = path.resolve(__dirname, '../../ml');
const PREDICT_SCRIPT = path.join(ML_DIR, 'predict.py');
const ACCOUNT_SCRIPT = path.join(ML_DIR, 'account_score.py');

// ML confidence threshold: above this + safe → skip Claude entirely
const ML_SKIP_CLAUDE_THRESHOLD = 0.82;
// Above this threshold → use ML result but still confirm with Claude (faster prompt)
const ML_HINT_THRESHOLD = 0.75;

/**
 * Run a Python ML script synchronously.
 * @param {string} scriptPath
 * @param {object} payload
 * @returns {object|null}
 */
function runPythonScript(scriptPath, payload) {
  try {
    const result = spawnSync('python', [scriptPath], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      timeout: 8000,
    });
    if (result.error || result.status !== 0) return null;
    return JSON.parse(result.stdout.trim());
  } catch {
    return null;
  }
}

/**
 * Score an account using the ML account scorer.
 * @param {{ username: string, posts: object[], viewCount?: number, likeCount?: number }} data
 * @returns {object|null}
 */
export function scoreAccount(data) {
  return runPythonScript(ACCOUNT_SCRIPT, data);
}

const SYSTEM_PROMPT = `Ты — система мониторинга мошенничества Spectra AI для Казахстана.
Анализируй контент из социальных сетей (TikTok, Instagram, YouTube) и определяй признаки:

1. КАЗИНО (casino) — реклама нелицензированных азартных игр, онлайн-казино, ставки
2. ПИРАМИДА (pyramid) — финансовые пирамиды, MLM, схемы пассивного дохода, Forex-сигналы
3. МОШЕННИЧЕСТВО (fraud) — фишинг, фейковые розыгрыши, фиктивная работа, сбор личных данных
4. БЕЗОПАСНО (safe) — обычный контент без признаков незаконной деятельности

Законодательная база РК: ст.217 УК РК (финансовая пирамида), Закон "Об игорном бизнесе", ст.190 УК РК (мошенничество).

Отвечай ТОЛЬКО валидным JSON без markdown-обёртки.`;

/**
 * Classifies content using Claude API.
 * @param {object} input
 * @param {string} input.caption - post caption/description
 * @param {string[]} input.hashtags
 * @param {string} input.platform
 * @param {string} [input.username]
 * @param {string} [input.transcript] - audio transcript from Whisper
 * @param {string} [input.scrapedText] - text scraped from page
 * @returns {Promise<ClassificationResult>}
 */
export async function classifyContent(input) {
  const { caption = '', hashtags = [], platform = '', username = '', transcript = '', scrapedText = '' } = input;

  const fullText = [caption, transcript, scrapedText, hashtags.join(' ')].filter(Boolean).join('\n');

  // ── Step 1: ML fast pre-classification ──────────────────────────────────
  const mlResult = runPythonScript(PREDICT_SCRIPT, { text: fullText, username });

  if (!claude) {
    console.warn('[classifier] Claude API key not set, using ML model classification');
    if (mlResult) {
      return {
        category: mlResult.category,
        riskScore: mlResult.riskScore,
        confidence: Math.round(mlResult.confidence * 100),
        detectedMarkers: [],
        explanation: 'Контент классифицирован с использованием локальной ML-модели.',
        legalReference: '',
        requisites: [],
        analysisSource: 'ml_only',
      };
    }
    return {
      category: 'safe',
      riskScore: 0,
      confidence: 100,
      detectedMarkers: [],
      explanation: 'Claude API не настроен, по умолчанию контент считается безопасным.',
      legalReference: '',
      requisites: [],
      analysisSource: 'none',
    };
  }

  // If ML is very confident the post is SAFE → skip Claude entirely
  if (mlResult && mlResult.confidence >= ML_SKIP_CLAUDE_THRESHOLD && mlResult.category === 'safe') {
    console.log(`[classifier] ML-only (safe, conf=${mlResult.confidence})`);
    return {
      category: 'safe',
      riskScore: mlResult.riskScore,
      confidence: Math.round(mlResult.confidence * 100),
      detectedMarkers: [],
      explanation: 'ML модель с высокой уверенностью определила контент как безопасный.',
      legalReference: '',
      requisites: [],
      analysisSource: 'ml_only',
    };
  }

  // ── Step 2: Build Claude prompt (with ML hint if available) ─────────────
  const contentBlock = [
    platform && `Платформа: ${platform}`,
    username && `Аккаунт: @${username}`,
    caption && `Описание поста:\n${caption}`,
    hashtags.length && `Хэштеги: ${hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}`,
    transcript && `Транскрипт аудио (Whisper):\n${transcript}`,
    scrapedText && `Текст со страницы:\n${scrapedText}`,
  ].filter(Boolean).join('\n\n');

  const mlHint = mlResult
    ? `\n[ML Pre-classification: category="${mlResult.category}", confidence=${(mlResult.confidence * 100).toFixed(0)}%, riskScore=${mlResult.riskScore}. Verify and extract requisites.]\n`
    : '';

  const userPrompt = `Проанализируй следующий контент из социальной сети:
${mlHint}
${contentBlock}

Дополнительно ИЗВЛЕКИ все платёжные и контактные реквизиты, через которые жертве предлагают платить или связаться. Типы:
- "kaspi"    — номер Kaspi/телефона для перевода (формат +7... или 87...)
- "card"     — номер банковской карты (16 цифр)
- "crypto"   — крипто-кошелёк (BTC/USDT/ETH адрес)
- "telegram" — Telegram-юзернейм (@name) или ссылка t.me/...
- "whatsapp" — номер/ссылка WhatsApp
- "phone"    — иной телефон
- "link"     — сайт/зеркало/реферальная ссылка
- "promo"    — промокод
Если реквизитов нет — верни пустой массив. НЕ выдумывай: бери только то, что реально есть в тексте.

Верни JSON строго в этом формате:
{
  "category": "safe" | "casino" | "pyramid" | "fraud",
  "riskScore": <целое число 0-100>,
  "confidence": <целое число 0-100>,
  "detectedMarkers": ["строка1", "строка2"],
  "explanation": "Подробное объяснение на русском языке (2-4 предложения)",
  "legalReference": "Ссылка на закон РК или пустая строка",
  "requisites": [{ "type": "kaspi|card|crypto|telegram|whatsapp|phone|link|promo", "value": "строка" }]
}`;

  const response = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const raw = response.content[0].text.trim();
  const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const result = JSON.parse(jsonStr);

  const analysisSource = mlResult ? 'ml+claude' : 'claude';
  console.log(`[classifier] ${analysisSource} → ${result.category} (risk=${result.riskScore})`);

  return { ...normalizeResult(result), analysisSource };
}

const ALLOWED_REQ = ['kaspi', 'card', 'crypto', 'telegram', 'whatsapp', 'phone', 'link', 'promo'];

function normalizeResult(result) {
  const requisites = Array.isArray(result.requisites)
    ? result.requisites
        .filter((r) => r && r.value && String(r.value).trim())
        .map((r) => ({
          type: ALLOWED_REQ.includes(r.type) ? r.type : 'other',
          value: String(r.value).trim().slice(0, 120),
        }))
        .slice(0, 12)
    : [];

  return {
    category: ['safe', 'casino', 'pyramid', 'fraud'].includes(result.category) ? result.category : 'safe',
    riskScore: Math.max(0, Math.min(100, Math.round(Number(result.riskScore) || 0))),
    confidence: Math.max(0, Math.min(100, Math.round(Number(result.confidence) || 0))),
    detectedMarkers: Array.isArray(result.detectedMarkers) ? result.detectedMarkers.slice(0, 8) : [],
    explanation: String(result.explanation || ''),
    legalReference: String(result.legalReference || ''),
    requisites,
  };
}

function parseJsonResponse(raw) {
  const jsonStr = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(jsonStr);
}

/**
 * Classifies a SCREENSHOT using Claude Vision.
 * Claude reads the text (OCR), extracts requisites and classifies — in one call.
 * @param {object} input
 * @param {string} input.imageBase64 - base64 (без data:-префикса)
 * @param {string} input.mediaType   - 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
 * @returns {Promise<ClassificationResult & { ocrText: string }>}
 */
export async function classifyImage({ imageBase64, mediaType = 'image/png' }) {
  if (!claude) {
    console.warn('[classifier] Claude API key not set, skipping image analysis');
    return {
      ocrText: '',
      category: 'safe',
      riskScore: 0,
      confidence: 100,
      detectedMarkers: [],
      explanation: 'Claude API не настроен, оптическое распознавание недоступно.',
      legalReference: '',
      requisites: [],
      analysisSource: 'none',
    };
  }

  const userPrompt = `На изображении — скриншот из социальной сети (пост, сторис, чат, реклама или комментарий).

1. ПРОЧИТАЙ весь видимый текст на изображении (OCR), включая текст на кнопках, в подписях и водяных знаках.
2. ИЗВЛЕКИ платёжные и контактные реквизиты (Kaspi/телефоны, карты, крипто-кошельки, Telegram @/t.me, WhatsApp, ссылки/зеркала, промокоды).
3. КЛАССИФИЦИРУЙ контент по признакам мошенничества для Казахстана.

Верни JSON строго в этом формате (без markdown):
{
  "ocrText": "весь распознанный текст с изображения",
  "category": "safe" | "casino" | "pyramid" | "fraud",
  "riskScore": <0-100>,
  "confidence": <0-100>,
  "detectedMarkers": ["строка1", "строка2"],
  "explanation": "Объяснение на русском (2-4 предложения)",
  "legalReference": "Ссылка на закон РК или пустая строка",
  "requisites": [{ "type": "kaspi|card|crypto|telegram|whatsapp|phone|link|promo", "value": "строка" }]
}`;

  const response = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1536,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: userPrompt },
      ],
    }],
  });

  const result = parseJsonResponse(response.content[0].text);
  return { ...normalizeResult(result), ocrText: String(result.ocrText || '') };
}
