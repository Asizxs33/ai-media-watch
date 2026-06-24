/**
 * Spectra AI — TikTok content script.
 * Monitors video changes via URL and scroll.
 */
(function () {
  'use strict';

  const PLATFORM = 'tiktok';
  let stopTracking = window.AMW.startTimeTracking(PLATFORM);
  let lastKey = '';

  function extractVideo() {
    const desc =
      document.querySelector('[data-e2e="video-desc"]')?.textContent?.trim() ||
      document.querySelector('[class*="DivDescription"]')?.textContent?.trim() ||
      document.querySelector('[class*="video-meta-caption"]')?.textContent?.trim() ||
      '';

    const user =
      document.querySelector('[data-e2e="video-author-uniqueid"]')?.textContent?.trim() ||
      document.querySelector('[data-e2e="browse-username"]')?.textContent?.trim() ||
      document.querySelector('[class*="SpanUniqueId"]')?.textContent?.trim() ||
      '';

    // Grab top comments — fraud often hides links/schemes there
    const comments = Array.from(
      document.querySelectorAll('[data-e2e="comment-level-1"] p, [class*="CommentText"] span, [class*="DivCommentContentContainer"] span')
    ).slice(0, 8).map(el => el.textContent?.trim()).filter(Boolean).join(' | ');

    return { desc, user, comments };
  }

  async function analyzeCurrentVideo() {
    const url = location.href;
    const videoIdMatch = url.match(/\/video\/(\d+)/);
    const key = videoIdMatch ? videoIdMatch[1] : url;

    if (key === lastKey) return;
    lastKey = key;

    if (await window.AMW.isBlocked(url)) {
      location.replace('https://www.tiktok.com/');
      return;
    }
    if (window.AMW.classified.has(key)) return;
    window.AMW.classified.add(key);

    await new Promise(r => setTimeout(r, 2000));

    const { desc, user, comments } = extractVideo();
    // Combine all text; if still empty — URL-only analysis (backend will scrape)
    const text = [desc, comments].filter(Boolean).join('\n').slice(0, 2500);

    const result = await window.AMW.classifyDeep({ platform: PLATFORM, text, username: user, url });
    if (!result) return;

    if ((result.riskScore ?? 0) >= 0.65) {
      window.AMW.showWarning(result, PLATFORM);
    }
  }

  // URL observer (TikTok is SPA)
  new MutationObserver(() => {
    if (location.href !== lastKey) analyzeCurrentVideo();
  }).observe(document, { subtree: true, childList: true });

  // Feed scroll (video changes without URL change on For You page)
  let scrollDebounce;
  document.addEventListener('scroll', () => {
    clearTimeout(scrollDebounce);
    scrollDebounce = setTimeout(analyzeCurrentVideo, 1200);
  }, { passive: true, capture: true });

  analyzeCurrentVideo();
})();
