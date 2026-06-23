/**
 * Real search services: YouTube via yt-dlp, TikTok via web scraping
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { detectPlatform } from './scraper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// yt-dlp may not be on PATH when run from Node.js on Windows — try multiple locations
const YTDLP_CANDIDATES = [
  'yt-dlp',
  'C:\\Users\\Admin\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\yt-dlp.exe',
  'C:\\Users\\Admin\\AppData\\Roaming\\Python\\Python312\\Scripts\\yt-dlp.exe',
];

function spawnYtDlp(args) {
  for (const bin of YTDLP_CANDIDATES) {
    try {
      const proc = spawn(bin, args, { shell: false, windowsHide: true });
      // quick check: if it errored immediately it means binary not found
      return proc;
    } catch {}
  }
  // last resort: shell mode
  return spawn('yt-dlp', args, { shell: true, windowsHide: true });
}

/**
 * Search YouTube via yt-dlp (no API key needed).
 * Async generator — yields one video object at a time as yt-dlp outputs it.
 */
export async function* searchYoutube(query, limit = 10) {
  const args = [
    `ytsearch${limit}:${query}`,
    '--flat-playlist',
    '--dump-json',
    '--no-download',
    '--quiet',
    '--no-warnings',
  ];

  const proc = spawnYtDlp(args);

  const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });

  let procError = null;
  proc.stderr.on('data', (d) => {
    const msg = d.toString();
    if (!msg.includes('WARNING') && !msg.includes('punycode')) {
      procError = msg.trim();
    }
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const data = JSON.parse(trimmed);
      if (!data.id) continue;
      yield {
        id: data.id,
        url: data.url ?? `https://www.youtube.com/watch?v=${data.id}`,
        title: data.title ?? '',
        uploader: data.uploader ?? data.channel ?? data.uploader_id ?? '',
        description: data.description ?? '',
        platform: 'youtube',
        thumbnail: data.thumbnail ?? (data.thumbnails?.slice(-1)[0]?.url ?? ''),
        viewCount: data.view_count ?? 0,
        likeCount: data.like_count ?? 0,
        duration: data.duration ?? 0,
        tags: Array.isArray(data.tags) ? data.tags.slice(0, 10) : [],
      };
    } catch {}
  }

  await new Promise((resolve) => {
    if (proc.exitCode !== null || proc.killed) return resolve();
    proc.once('close', resolve);
    setTimeout(resolve, 1500); // подстраховка от гонки: процесс мог закрыться раньше слушателя
  });

  if (procError) console.error('[yt-dlp stderr]', procError);
}

/**
 * Search TikTok via Playwright-based TikTokApi Python script.
 * Spawns tiktok_search.py and parses NDJSON output line by line.
 */
export async function* searchTiktok(keyword, limit = 10) {
  const scriptPath = join(__dirname, 'tiktok_search.py');

  const pythonCandidates = ['python', 'python3',
    'C:\\Users\\Admin\\AppData\\Local\\Programs\\Python\\Python312\\python.exe'];

  let pythonBin = 'python';
  for (const bin of pythonCandidates) {
    try {
      const test = spawn(bin, ['--version'], { shell: false, windowsHide: true });
      await new Promise((resolve) => test.on('close', resolve));
      pythonBin = bin;
      break;
    } catch {}
  }

  const proc = spawn(pythonBin, [scriptPath, keyword, String(limit)], {
    shell: false,
    windowsHide: true,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  });

  const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });

  proc.stderr.on('data', (d) => {
    const msg = d.toString('utf8');
    if (!msg.includes('RequestsDependencyWarning') && !msg.includes('urllib3') && !msg.includes('warn(')) {
      console.warn('[tiktok py]', msg.trim());
    }
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('{')) continue;
    try {
      const data = JSON.parse(trimmed);
      if (data.error) { console.warn('[tiktok py error]', data.error); continue; }
      if (!data.id) continue;
      yield data;
    } catch {}
  }

  await new Promise((resolve) => {
    if (proc.exitCode !== null || proc.killed) return resolve();
    proc.once('close', resolve);
    setTimeout(resolve, 1500); // подстраховка от гонки: процесс мог закрыться раньше слушателя
  });
}
