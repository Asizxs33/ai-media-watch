import { execFile, spawnSync } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { unlink } from 'fs/promises';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = join(__dirname, '../tmp');
const WHISPER_SCRIPT = join(__dirname, 'whisper_local.py');

if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

/**
 * Download audio from URL using yt-dlp.
 * Returns path to audio file, or null on failure.
 */
async function downloadAudio(url) {
  const outputPath = join(TMP_DIR, `audio_${Date.now()}.webm`);
  try {
    await execFileAsync('yt-dlp', [
      url,
      '--extract-audio',
      '--audio-format', 'webm',
      '--audio-quality', '5',
      '--output', outputPath,
      '--no-playlist',
      '--max-filesize', '50m',
      '--socket-timeout', '30',
    ], { timeout: 120_000 });

    return existsSync(outputPath) ? outputPath : null;
  } catch (err) {
    console.warn('[transcriber] yt-dlp failed:', err.message);
    return null;
  }
}

/**
 * Transcribe audio file using local faster-whisper (free, offline).
 */
function transcribeLocal(audioPath) {
  const result = spawnSync('python', [WHISPER_SCRIPT, audioPath], {
    encoding: 'utf8',
    timeout: 180_000, // 3 min max
  });

  if (result.error || result.status !== 0) {
    console.warn('[transcriber] Local whisper failed:', result.stderr?.slice(0, 200));
    return null;
  }

  try {
    const parsed = JSON.parse(result.stdout.trim());
    if (parsed.error) {
      console.warn('[transcriber] Whisper error:', parsed.error);
      return null;
    }
    return parsed.text || null;
  } catch {
    return null;
  }
}

/**
 * Transcribe audio via OpenAI Whisper API (fallback if OpenAI key set).
 */
async function transcribeOpenAI(audioPath) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const { default: OpenAI } = await import('openai');
    const { createReadStream } = await import('fs');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(audioPath),
      model: 'whisper-1',
      language: 'ru',
      response_format: 'text',
    });
    return String(transcription).trim();
  } catch (err) {
    console.warn('[transcriber] OpenAI Whisper failed:', err.message);
    return null;
  }
}

/**
 * Check if yt-dlp is available.
 */
async function ytDlpAvailable() {
  try {
    await execFileAsync('yt-dlp', ['--version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download video audio and transcribe it.
 * Tries local Whisper first, falls back to OpenAI Whisper API.
 * Returns transcript string or null.
 */
export async function transcribeFromUrl(url) {
  if (!(await ytDlpAvailable())) {
    console.log('[transcriber] yt-dlp not found');
    return null;
  }

  console.log(`[transcriber] Downloading audio: ${url}`);
  const audioPath = await downloadAudio(url);
  if (!audioPath) return null;

  try {
    // Try local Whisper first (free)
    console.log('[transcriber] Transcribing locally (faster-whisper)...');
    let text = transcribeLocal(audioPath);

    // Fallback to OpenAI Whisper API
    if (!text && process.env.OPENAI_API_KEY) {
      console.log('[transcriber] Falling back to OpenAI Whisper...');
      text = await transcribeOpenAI(audioPath);
    }

    if (text) {
      console.log(`[transcriber] Transcript: ${text.length} chars`);
    } else {
      console.warn('[transcriber] No transcript obtained');
    }

    return text;
  } finally {
    if (existsSync(audioPath)) {
      await unlink(audioPath).catch(() => {});
    }
  }
}
