/**
 * Spectra AI — Odnoklassniki (OK.ru) content script.
 * Scans video posts and live streams.
 */
(function () {
  'use strict';

  const PLATFORM = 'ok';
  let stopTracking = window.AMW.startTimeTracking(PLATFORM);
  let lastUrl = '';

  function extractPost() {
    const text =
      document.querySelector('.media-text_cnt')?.innerText?.trim() ||
      document.querySelector('.post-st__text')?.innerText?.trim() ||
      document.querySelector('[data-l="videoDescription"]')?.innerText?.trim() ||
      document.querySelector('.vid-card_cnt-col_cnt')?.innerText?.trim() ||
      document.querySelector('.video-card_text')?.innerText?.trim() || '';

    const user =
      document.querySelector('.vid-card_author a')?.textContent?.trim() ||
      document.querySelector('.entity-info__name')?.textContent?.trim() ||
      document.querySelector('h1.mctc_name_tx')?.textContent?.trim() || '';

    return { text: text.slice(0, 2000), user };
  }

  const VIDEO_PATHS = ['/video/', '/live/', '/topic/'];

  async function analyzePost() {
    const url = location.href;
    if (url === lastUrl) return;
    const isMedia = VIDEO_PATHS.some(p => url.includes(p));
    if (!isMedia) return;
    if (window.AMW.classified.has(url)) return;
    lastUrl = url;
    window.AMW.classified.add(url);

    await new Promise(r => setTimeout(r, 2500));

    const { text, user } = extractPost();
    if (!text || text.length < 5) return;

    const result = await window.AMW.classify({ platform: PLATFORM, text, username: user, url });
    if (!result) return;
    if ((result.riskScore ?? 0) >= 0.65) window.AMW.showWarning(result, PLATFORM);
  }

  new MutationObserver(() => {
    if (location.href !== lastUrl) analyzePost();
  }).observe(document, { subtree: true, childList: true });

  analyzePost();
})();
