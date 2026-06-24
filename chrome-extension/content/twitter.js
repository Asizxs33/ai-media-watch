/**
 * Spectra AI — Twitter/X content script.
 * Scans tweets with video or suspicious financial content.
 */
(function () {
  'use strict';

  const PLATFORM = 'twitter';
  let stopTracking = window.AMW.startTimeTracking(PLATFORM);
  let lastUrl = '';

  function extractTweet() {
    // Primary: open tweet page
    const article = document.querySelector('article[data-testid="tweet"]');
    if (!article) return { text: '', user: '' };

    const text =
      article.querySelector('[data-testid="tweetText"]')?.innerText?.trim() ||
      article.querySelector('div[lang]')?.innerText?.trim() || '';

    const user =
      article.querySelector('[data-testid="User-Name"] span')?.textContent?.trim() ||
      article.querySelector('a[role="link"] span')?.textContent?.trim() || '';

    return { text, user };
  }

  async function analyzeTweet() {
    const url = location.href;
    // Only individual tweet pages that may have video
    if (!url.match(/\/(status|i\/spaces)\/\d+/)) return;
    if (url === lastUrl) return;
    if (window.AMW.classified.has(url)) return;
    lastUrl = url;
    window.AMW.classified.add(url);

    await new Promise(r => setTimeout(r, 2500));

    const { text, user } = extractTweet();
    if (!text || text.length < 5) return;

    const result = await window.AMW.classify({ platform: PLATFORM, text, username: user, url });
    if (!result) return;
    if ((result.riskScore ?? 0) >= 0.65) window.AMW.showWarning(result, PLATFORM);
  }

  new MutationObserver(() => {
    if (location.href !== lastUrl) analyzeTweet();
  }).observe(document, { subtree: true, childList: true });

  analyzeTweet();
})();
