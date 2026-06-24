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

    return { desc, user };
  }

  async function analyzeCurrentVideo() {
    const url = location.href;
    // Use video ID from URL as key, or full URL for feed
    const videoIdMatch = url.match(/\/video\/(\d+)/);
    const key = videoIdMatch ? videoIdMatch[1] : url;

    if (key === lastKey) return;
    lastKey = key;

    // Redirect if previously blocked
    if (await window.AMW.isBlocked(url)) {
      location.replace('https://www.tiktok.com/');
      return;
    }
    if (window.AMW.classified.has(key)) return;
    window.AMW.classified.add(key);

    await new Promise(r => setTimeout(r, 1500));

    const { desc, user } = extractVideo();
    if (!desc) return;

    const result = await window.AMW.classifyDeep({ platform: PLATFORM, text: desc, username: user, url });
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
