/**
 * Spectra AI — VKontakte content script.
 * Scans wall posts, videos, clips and stories.
 */
(function () {
  'use strict';

  const PLATFORM = 'vk';
  let stopTracking = window.AMW.startTimeTracking(PLATFORM);
  let lastUrl = '';

  function extractPost() {
    const text =
      document.querySelector('.wall_post_text')?.innerText?.trim() ||
      document.querySelector('.post__text')?.innerText?.trim() ||
      document.querySelector('.pi_text')?.innerText?.trim() ||
      document.querySelector('[class*="PostText"]')?.innerText?.trim() ||
      // Video description
      document.querySelector('.mv_desc')?.innerText?.trim() ||
      document.querySelector('#mv_desc')?.innerText?.trim() || '';

    const user =
      document.querySelector('.PostHeader__user-name a')?.textContent?.trim() ||
      document.querySelector('.author')?.textContent?.trim() ||
      document.querySelector('a.post__author-link')?.textContent?.trim() ||
      document.querySelector('.mv_info .mvl_channel_name a')?.textContent?.trim() || '';

    return { text: text.slice(0, 2000), user };
  }

  const VIDEO_PATHS = ['/wall', '/video', '/clip', '/shorts'];

  async function analyzePost() {
    const url = location.href;
    if (url === lastUrl) return;
    const isMedia = VIDEO_PATHS.some(p => url.includes(p));
    if (!isMedia) return;
    lastUrl = url;
    if (await window.AMW.isBlocked(url)) { location.replace('https://vk.com/'); return; }
    if (window.AMW.classified.has(url)) return;
    window.AMW.classified.add(url);

    await new Promise(r => setTimeout(r, 2000));

    const { text, user } = extractPost();
    if (!text || text.length < 5) return;

    const result = await window.AMW.classifyDeep({ platform: PLATFORM, text, username: user, url });
    if (!result) return;
    if ((result.riskScore ?? 0) >= 65) window.AMW.showWarning(result, PLATFORM);
  }

  new MutationObserver(() => {
    if (location.href !== lastUrl) analyzePost();
  }).observe(document, { subtree: true, childList: true });

  analyzePost();
})();
