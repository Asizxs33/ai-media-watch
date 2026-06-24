/**
 * Spectra AI — Facebook content script.
 * Scans Reels, video posts and marketplace listings.
 */
(function () {
  'use strict';

  const PLATFORM = 'facebook';
  let stopTracking = window.AMW.startTimeTracking(PLATFORM);
  let lastUrl = '';

  function extractPost() {
    // Try multiple selectors across FB layout versions
    const text =
      document.querySelector('[data-ad-preview="message"]')?.innerText?.trim() ||
      document.querySelector('div[data-testid="post_message"]')?.innerText?.trim() ||
      document.querySelector('[class*="userContent"]')?.innerText?.trim() ||
      // Reels caption overlay
      document.querySelector('[aria-label*="Caption"]')?.innerText?.trim() ||
      // Generic post text containers
      document.querySelector('div[dir="auto"] > span[dir="auto"]')?.innerText?.trim() || '';

    const user =
      document.querySelector('h2 strong > a')?.textContent?.trim() ||
      document.querySelector('h4 a[href*="facebook.com"]')?.textContent?.trim() ||
      document.querySelector('a[aria-label][role="link"]')?.textContent?.trim() || '';

    return { text: text.slice(0, 2000), user };
  }

  const VIDEO_PATHS = ['/reel/', '/videos/', '/watch/', '/posts/', '/reels/'];

  async function analyzePost() {
    const url = location.href;
    if (url === lastUrl) return;
    const isVideo = VIDEO_PATHS.some(p => url.includes(p));
    if (!isVideo) return;
    if (window.AMW.classified.has(url)) return;
    lastUrl = url;
    window.AMW.classified.add(url);

    await new Promise(r => setTimeout(r, 3000));

    const { text, user } = extractPost();
    if (!text || text.length < 5) return;

    const result = await window.AMW.classifyDeep({ platform: PLATFORM, text, username: user, url });
    if (!result) return;
    if ((result.riskScore ?? 0) >= 0.65) window.AMW.showWarning(result, PLATFORM);
  }

  new MutationObserver(() => {
    if (location.href !== lastUrl) analyzePost();
  }).observe(document, { subtree: true, childList: true });

  analyzePost();
})();
