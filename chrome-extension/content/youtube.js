/**
 * Spectra AI — YouTube content script.
 * Detects video loads via yt-navigate-finish and URL observer.
 */
(function () {
  'use strict';

  const PLATFORM = 'youtube';
  let lastUrl = '';
  let stopTracking = null;
  let stopWatcher = null;

  function extractVideo() {
    const title =
      document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string')?.textContent?.trim() ||
      document.querySelector('#above-the-fold h1 yt-formatted-string')?.textContent?.trim() ||
      document.querySelector('h1.title.style-scope.ytd-video-primary-info-renderer')?.textContent?.trim() ||
      document.title.replace(' - YouTube', '').trim();

    const channel =
      document.querySelector('#channel-name #text a')?.textContent?.trim() ||
      document.querySelector('ytd-channel-name yt-formatted-string a')?.textContent?.trim() ||
      document.querySelector('#upload-info #channel-name a')?.textContent?.trim() ||
      '';

    const desc =
      document.querySelector('#description-inline-expander #attributed-snippet-text')?.textContent?.trim() ||
      document.querySelector('#description yt-attributed-string')?.textContent?.trim() ||
      '';

    // Top comments — fraud often puts Telegram/WhatsApp links there
    const comments = Array.from(
      document.querySelectorAll('#comments #content-text')
    ).slice(0, 6).map(el => el.textContent?.trim()).filter(Boolean).join(' | ');

    return { title, channel, desc, comments };
  }

  async function analyzeVideo(url) {
    if (!url.includes('/watch')) return;
    if (await window.AMW.isBlocked(url)) {
      location.replace('https://www.youtube.com/');
      return;
    }
    if (window.AMW.classified.has(url)) return;
    window.AMW.classified.add(url);

    await new Promise(r => setTimeout(r, 3000));

    const { title, channel, desc, comments } = extractVideo();
    const text = [title, desc, comments].filter(Boolean).join('\n').slice(0, 3000);
    if (!text) return;

    const result = await window.AMW.classifyDeep({ platform: PLATFORM, text, username: channel, url });
    if (result && (result.riskScore ?? 0) >= 0.65) {
      window.AMW.showWarning(result, PLATFORM);
    }

    // Start live audio+video watcher regardless of initial score
    await new Promise(r => setTimeout(r, 1000));
    stopWatcher = window.AMW.startVideoWatcher(PLATFORM, url);
  }

  function onNav() {
    const url = location.href;
    if (url === lastUrl) return;
    lastUrl = url;

    // Reset time tracking on each navigation
    if (stopTracking) stopTracking();
    stopTracking = window.AMW.startTimeTracking(PLATFORM);
    if (stopWatcher) stopWatcher();
    stopWatcher = null;

    analyzeVideo(url);
  }

  // YouTube fires this custom event on SPA navigation
  window.addEventListener('yt-navigate-finish', onNav);

  // Fallback URL watcher
  new MutationObserver(() => {
    if (location.href !== lastUrl) onNav();
  }).observe(document, { subtree: true, childList: true });

  // Initial
  onNav();
})();
