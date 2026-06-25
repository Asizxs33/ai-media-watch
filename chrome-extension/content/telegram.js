/**
 * Spectra AI — Telegram Web content script.
 * Monitors video/audio messages with suspicious captions.
 */
(function () {
  'use strict';

  const PLATFORM = 'telegram';
  let stopTracking = window.AMW.startTimeTracking(PLATFORM);
  const seen = new Set();

  function analyzeMessages() {
    // Find messages that have video/audio media
    const mediaMessages = document.querySelectorAll(
      '.Message.has-media, .message.video-message, .message.audio-message, [class*="RoundVideo"], [class*="Video"]'
    );

    mediaMessages.forEach(async (el) => {
      const msgEl = el.closest('.Message') || el.closest('.message') || el;
      const id =
        msgEl.getAttribute('data-mid') ||
        msgEl.getAttribute('id') ||
        msgEl.getAttribute('data-message-id');

      if (!id || seen.has(id)) return;
      seen.add(id);

      const text =
        msgEl.querySelector('.text-content')?.innerText?.trim() ||
        msgEl.querySelector('.caption')?.innerText?.trim() ||
        msgEl.querySelector('.message-text')?.innerText?.trim() || '';

      // Also grab channel/sender name
      const user =
        document.querySelector('.chat-info .title')?.textContent?.trim() ||
        document.querySelector('.TopBar .title')?.textContent?.trim() || '';

      if (!text || text.length < 5) return;

      const result = await window.AMW.classifyDeep({ platform: PLATFORM, text, username: user, url: location.href });
      if (!result) return;
      if ((result.riskScore ?? 0) >= 65) window.AMW.showWarning(result, PLATFORM);
    });
  }

  // Watch for new messages appearing in the chat
  const observer = new MutationObserver(() => {
    setTimeout(analyzeMessages, 1500);
  });

  const target = document.querySelector('#Main') || document.body || document.documentElement;
  observer.observe(target, { subtree: true, childList: true });

  // Initial scan after the app loads
  setTimeout(analyzeMessages, 4000);
})();
