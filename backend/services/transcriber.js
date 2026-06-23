import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = join(__dirname, '../tmp');

if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Downloads video from URL using yt-dlp and transcribes audio with Whisper.
 * Requires yt-dlp installed: https://github.com/yt-dlp/yt-dlp
 * Returns null if yt-dlp is not available (falls back to text-only analysis).
 */
export async function transcribeFromUrl(url) {
  // Check if yt-dlp is available
  try {
    await execFileAsync('yt-dlp', ['--version']);
  } catch {
    console.log('[transcriber] yt-dlp not found, skipping video download');
    return null;
  }

  const outputPath = join(TMP_DIR, `audio_${Date.now()}.mp3`);

  try {
    console.log(`[transcriber] Downloading audio from ${url}`);

    // Download only audio, convert to mp3
    await execFileAsync('yt-dlp', [
      url,
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '5',
      '--output', outputPath,
      '--no-playlist',
      '--max-filesize', '25m',   // Whisper limit
      '--socket-timeout', '30',
    ], { timeout: 120_000 });

    if (!existsSync(outputPath)) {
      throw new Error('Audio file was not created');
    }

    console.log('[transcriber] Sending to Whisper API...');
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(outputPath),
      model: 'whisper-1',
      language: 'ru',
      response_format: 'text',
    });

    return String(transcription).trim();
  } finally {
    // Clean up temp file
    if (existsSync(outputPath)) {
      await unlink(outputPath).catch(() => {});
    }
  }
}
