import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export function detectPlatform(url) {
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return 'unknown';
}

/**
 * Strategy 1: TikTok / Instagram oEmbed API (no auth required for TikTok)
 */
async function tryOembed(url, platform) {
  if (platform !== 'tiktok') return null;

  const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return null;
  const data = await res.json();

  // Extract caption text from embedded blockquote HTML: <p>...</p>
  const captionMatch = data.html?.match(/<p>([\s\S]*?)<\/p>/i);
  const caption = captionMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || '';

  // Extract music name from the embed
  const musicMatch = data.html?.match(/title="(♬[^"]+)"/i);
  const music = musicMatch?.[1] || '';

  const parts = [
    data.title ? `Заголовок: ${data.title}` : '',
    data.author_unique_id ? `Аккаунт: @${data.author_unique_id}` : (data.author_name ? `Аккаунт: ${data.author_name}` : ''),
    caption ? `Описание: ${caption}` : 'Описание: (пусто)',
    music ? `Музыка: ${music}` : '',
  ].filter(Boolean);

  // Return even if caption is empty — give Claude what we have
  return parts.join('\n');
}

/**
 * Strategy 2: yt-dlp --dump-json (gets title, description, uploader, tags, chapters)
 * Works for TikTok, YouTube, and sometimes Instagram
 */
async function tryYtDlpMeta(url) {
  try {
    const { stdout } = await execFileAsync(
      'yt-dlp',
      ['--dump-json', '--no-download', '--no-warnings', '--quiet', url],
      { timeout: 30000 }
    );
    const meta = JSON.parse(stdout.trim());

    const parts = [
      meta.title,
      meta.uploader ? `@${meta.uploader}` : '',
      meta.description,
      Array.isArray(meta.tags) ? meta.tags.slice(0, 20).map(t => `#${t}`).join(' ') : '',
    ].filter(Boolean);

    const text = parts.join('\n').trim();
    return text.length > 5 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Strategy 3: YouTube noembed / oEmbed (public, no auth)
 */
async function tryYoutubeOembed(url) {
  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const res = await fetch(oembed, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text = [data.title, data.author_name ? `@${data.author_name}` : ''].filter(Boolean).join('\n');
  return text.length > 5 ? text : null;
}

/**
 * Strategy 4: Raw HTML fetch + meta tag extraction (works for YouTube, sometimes others)
 */
async function tryHtmlScrape(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ru,en;q=0.5',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) return null;
  const html = await res.text();

  // Reject TikTok anti-bot walls
  if (html.includes('tiktok.com') && html.includes('__NEXT_DATA__') === false && html.length < 5000) {
    return null;
  }

  const title = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1]?.trim() ?? '';
  const metaContents = [];
  const metaRe = /<meta[^>]+content="([^"]{10,600})"[^>]*>/gi;
  let m;
  while ((m = metaRe.exec(html)) !== null) {
    const val = m[1].trim();
    if (!val.startsWith('http') && !val.includes(';') && !val.startsWith('data:')) {
      metaContents.push(val);
    }
  }

  // Also try JSON-LD
  const jsonLdMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const ld = JSON.parse(jsonLdMatch[1]);
      if (ld.description) metaContents.push(ld.description);
      if (ld.name) metaContents.push(ld.name);
      if (Array.isArray(ld.keywords)) metaContents.push(...ld.keywords);
    } catch {}
  }

  // __NEXT_DATA__ or window.__data for TikTok
  const nextData = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextData) {
    try {
      const nd = JSON.parse(nextData[1]);
      const desc = nd?.props?.pageProps?.itemInfo?.itemStruct?.desc;
      const author = nd?.props?.pageProps?.itemInfo?.itemStruct?.author?.uniqueId;
      if (desc) metaContents.push(desc);
      if (author) metaContents.push(`@${author}`);
    } catch {}
  }

  const unique = [...new Set(metaContents)];
  const combined = [title, ...unique].join('\n').slice(0, 3000).trim();
  return combined.length > 10 ? combined : null;
}

/**
 * Main scraper — tries strategies in order, returns first success
 */
export async function scrapePageText(url) {
  const platform = detectPlatform(url);
  const errors = [];

  // TikTok: oEmbed → yt-dlp → HTML
  if (platform === 'tiktok') {
    try {
      const text = await tryOembed(url, platform);
      if (text) { console.log('[scraper] TikTok oEmbed OK'); return { text, platform, url }; }
    } catch (e) { errors.push(`oEmbed: ${e.message}`); }

    try {
      const text = await tryYtDlpMeta(url);
      if (text) { console.log('[scraper] yt-dlp meta OK'); return { text, platform, url }; }
    } catch (e) { errors.push(`yt-dlp: ${e.message}`); }

    try {
      const text = await tryHtmlScrape(url);
      if (text) { console.log('[scraper] HTML scrape OK'); return { text, platform, url }; }
    } catch (e) { errors.push(`html: ${e.message}`); }
  }

  // YouTube: oEmbed → HTML → yt-dlp
  if (platform === 'youtube') {
    try {
      const text = await tryYoutubeOembed(url);
      if (text) { console.log('[scraper] YouTube oEmbed OK'); return { text, platform, url }; }
    } catch (e) { errors.push(`yt-oembed: ${e.message}`); }

    try {
      const text = await tryHtmlScrape(url);
      if (text) { console.log('[scraper] YouTube HTML OK'); return { text, platform, url }; }
    } catch (e) { errors.push(`html: ${e.message}`); }

    try {
      const text = await tryYtDlpMeta(url);
      if (text) { console.log('[scraper] YouTube yt-dlp OK'); return { text, platform, url }; }
    } catch (e) { errors.push(`yt-dlp: ${e.message}`); }
  }

  // Instagram: yt-dlp → HTML
  if (platform === 'instagram') {
    try {
      const text = await tryYtDlpMeta(url);
      if (text) { console.log('[scraper] Instagram yt-dlp OK'); return { text, platform, url }; }
    } catch (e) { errors.push(`yt-dlp: ${e.message}`); }

    try {
      const text = await tryHtmlScrape(url);
      if (text) { console.log('[scraper] Instagram HTML OK'); return { text, platform, url }; }
    } catch (e) { errors.push(`html: ${e.message}`); }
  }

  // Unknown: HTML → yt-dlp
  if (platform === 'unknown') {
    try {
      const text = await tryHtmlScrape(url);
      if (text) { console.log('[scraper] HTML scrape OK'); return { text, platform, url }; }
    } catch (e) { errors.push(`html: ${e.message}`); }
  }

  throw new Error('Не удалось получить текст со страницы. Проверь URL или вставь текст вручную.');
}
