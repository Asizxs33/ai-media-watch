/**
 * Spectra AI — Instagram content script.
 * Monitors reels and posts.
 */
(function () {
  'use strict';

  const PLATFORM = 'instagram';
  let stopTracking = window.AMW.startTimeTracking(PLATFORM);
  let lastUrl = '';

  function extractPost() {
    // Caption — multiple possible selectors across Instagram versions
    const caption =
      document.querySelector('article div[data-testid="post-comment-root"] span')?.textContent?.trim() ||
      document.querySelector('article ._a9zs span')?.textContent?.trim() ||
      document.querySelector('article h1')?.textContent?.trim() ||
      document.querySelector('[class*="Caption"] span')?.textContent?.trim() ||
      '';

    const user =
      document.querySelector('article header a[role="link"]')?.textContent?.trim() ||
      document.querySelector('article header ._aaqt')?.textContent?.trim() ||
      document.querySelector('a[href*="/"][class*="Username"]')?.textContent?.trim() ||
      '';

    return { caption, user };
  }

  async function analyzeCurrentPost() {
    const url = location.href;
    if (url === lastUrl) return;
    if (!url.includes('/p/') && !url.includes('/reel/')) return;
    lastUrl = url;

    if (window.AMW.classified.has(url)) return;
    window.AMW.classified.add(url);

    await new Promise(r => setTimeout(r, 2000));

    const { caption, user } = extractPost();
    if (!caption) return;

    const result = await window.AMW.classify({ platform: PLATFORM, text: caption, username: user, url });
    if (!result) return;

    if ((result.riskScore ?? 0) >= 0.65) {
      window.AMW.showWarning(result, PLATFORM);
    }
  }

  // SPA navigation observer
  new MutationObserver(() => {
    if (location.href !== lastUrl) analyzeCurrentPost();
  }).observe(document, { subtree: true, childList: true });

  analyzeCurrentPost();
})();
