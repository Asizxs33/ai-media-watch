/**
 * Spectra AI — shared utilities injected into every page.
 * Loaded before platform-specific scripts.
 */
(function () {
  'use strict';

  if (window.AMW) return; // already loaded

  // Safe sendMessage — silently ignores "Extension context invalidated" errors
  function safeSend(msg, cb) {
    try {
      if (!chrome.runtime?.id) return;
      chrome.runtime.sendMessage(msg, cb ?? (() => { void chrome.runtime.lastError; }));
    } catch (_) { /* extension reloaded, context gone */ }
  }

  // ── Inject styles ────────────────────────────────────────────
  const style = document.createElement('style');
  style.id = 'amw-styles';
  style.textContent = `
    #amw-fraud-overlay {
      position: fixed; inset: 0; z-index: 2147483647;
      background: rgba(8,8,8,0.93);
      backdrop-filter: blur(12px);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      animation: amw-fade-in 0.25s ease;
    }
    @keyframes amw-fade-in { from { opacity: 0; } to { opacity: 1; } }
    .amw-card {
      background: #141414;
      border: 1px solid #252525;
      border-radius: 20px;
      padding: 32px;
      max-width: 420px;
      width: calc(100vw - 48px);
      box-shadow: 0 0 80px rgba(206,255,26,0.06), 0 32px 64px rgba(0,0,0,0.5);
      animation: amw-card-in 0.35s cubic-bezier(0.16,1,0.3,1);
    }
    @keyframes amw-card-in {
      from { opacity: 0; transform: translateY(20px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .amw-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 12px; border-radius: 100px;
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em;
      margin-bottom: 16px;
    }
    .amw-badge.danger {
      background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.35);
      color: #f87171;
    }
    .amw-badge.warn {
      background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.35);
      color: #fbbf24;
    }
    .amw-fraud-title {
      color: #fff; font-size: 20px; font-weight: 700;
      margin: 0 0 8px; line-height: 1.3;
    }
    .amw-fraud-desc {
      color: #777; font-size: 14px; line-height: 1.65;
      margin: 0 0 20px;
    }
    .amw-risk-row {
      display: flex; align-items: center; gap: 10px; margin-bottom: 20px;
    }
    .amw-risk-label { color: #555; font-size: 12px; flex-shrink: 0; }
    .amw-risk-bar {
      flex: 1; background: #1e1e1e; border-radius: 100px; height: 5px; overflow: hidden;
    }
    .amw-risk-fill {
      height: 100%; border-radius: 100px;
      transition: width 0.7s cubic-bezier(0.16,1,0.3,1);
    }
    .amw-risk-fill.high  { background: linear-gradient(90deg, #ef4444, #dc2626); }
    .amw-risk-fill.mid   { background: linear-gradient(90deg, #f59e0b, #d97706); }
    .amw-risk-pct { color: #fff; font-size: 13px; font-weight: 700; flex-shrink: 0; min-width: 36px; text-align: right; }
    .amw-tags {
      display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 24px;
    }
    .amw-tag {
      background: #1e1e1e; color: #aaa;
      padding: 3px 10px; border-radius: 6px; font-size: 12px;
    }
    .amw-actions { display: flex; gap: 10px; }
    .amw-btn-primary {
      flex: 1; background: #ceff1a; color: #0a0a0a;
      border: none; border-radius: 12px; padding: 13px;
      font-size: 14px; font-weight: 700; cursor: pointer;
      transition: background 0.15s;
    }
    .amw-btn-primary:hover { background: #d8ff40; }
    .amw-btn-ghost {
      flex: 1; background: transparent; color: #555;
      border: 1px solid #2a2a2a; border-radius: 12px; padding: 13px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }
    .amw-btn-ghost:hover { border-color: #444; color: #888; }

    /* Time banner */
    #amw-time-banner {
      position: fixed; bottom: 24px; left: 50%;
      transform: translateX(-50%);
      z-index: 2147483646;
      background: #141414; border: 1px solid #ceff1a22;
      border-radius: 100px; padding: 11px 20px;
      display: flex; align-items: center; gap: 10px;
      font-family: 'Inter', system-ui, sans-serif;
      color: #ccc; font-size: 13px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      animation: amw-slide-up 0.4s cubic-bezier(0.16,1,0.3,1);
      white-space: nowrap;
    }
    @keyframes amw-slide-up {
      from { opacity: 0; transform: translateX(-50%) translateY(12px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    .amw-time-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #ceff1a; flex-shrink: 0;
    }
    .amw-time-x {
      background: none; border: none; color: #444;
      cursor: pointer; font-size: 15px; padding: 0; margin-left: 4px; line-height: 1;
    }
    .amw-time-x:hover { color: #888; }

    /* Time limit blocker */
    #amw-limit-overlay {
      position: fixed; inset: 0; z-index: 2147483647;
      background: rgba(8,8,8,0.97);
      backdrop-filter: blur(16px);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Inter', system-ui, sans-serif;
    }
  `;
  document.head.appendChild(style);

  // ── AMW namespace ─────────────────────────────────────────────
  window.AMW = {
    classified: new Set(),

    showWarning(result, platform) {
      if (document.getElementById('amw-fraud-overlay')) return;

      // Auto-save detection to backend DB (fire and forget)
      safeSend({
        type: 'REPORT_TO_DB',
        payload: {
          url: location.href,
          platform,
          riskScore: result.riskScore ?? 0,
          category: result.category ?? 'unknown',
          reason: result.reason ?? '',
          schemeTypes: result.schemeTypes || [],
          blocked: false,
        },
      });

      const score = result.riskScore ?? 0.7;
      const isHigh = score >= 0.75;
      const pct = Math.round(score * 100);
      const reason = result.reason || result.explanation || 'Похоже на мошенническую схему';
      const tags = (result.schemeTypes || (result.schemeType ? [result.schemeType] : []));

      const overlay = document.createElement('div');
      overlay.id = 'amw-fraud-overlay';
      overlay.innerHTML = `
        <div class="amw-card">
          <div class="amw-badge ${isHigh ? 'danger' : 'warn'}">
            ${isHigh ? '🚨 Мошенничество' : '⚠ Подозрительно'}
          </div>
          <h2 class="amw-fraud-title">AI обнаружил ${isHigh ? 'мошеннический' : 'подозрительный'} контент</h2>
          <p class="amw-fraud-desc">${reason}</p>
          <div class="amw-risk-row">
            <span class="amw-risk-label">Риск</span>
            <div class="amw-risk-bar">
              <div class="amw-risk-fill ${isHigh ? 'high' : 'mid'}" style="width:${pct}%"></div>
            </div>
            <span class="amw-risk-pct">${pct}%</span>
          </div>
          ${tags.length ? `<div class="amw-tags">${tags.map(t => `<span class="amw-tag">${t}</span>`).join('')}</div>` : ''}
          <div class="amw-actions">
            <button class="amw-btn-primary" id="amw-back-btn">← Уйти</button>
            <button class="amw-btn-ghost" id="amw-continue-btn">Всё равно смотреть</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      document.getElementById('amw-back-btn').addEventListener('click', () => {
        // Save to local blocklist + update DB status to 'blocked'
        safeSend({ type: 'BLOCK_URL', url: location.href });
        safeSend({
          type: 'REPORT_TO_DB',
          payload: {
            url: location.href,
            platform,
            riskScore: result.riskScore ?? 0,
            category: result.category ?? 'unknown',
            reason: result.reason ?? '',
            schemeTypes: result.schemeTypes || [],
            blocked: true,
          },
        });
        overlay.remove();
        // Replace current history entry so forward button is disabled
        const homes = {
          'youtube.com': 'https://www.youtube.com/',
          'tiktok.com': 'https://www.tiktok.com/',
          'instagram.com': 'https://www.instagram.com/',
          'twitter.com': 'https://twitter.com/',
          'x.com': 'https://x.com/',
          'facebook.com': 'https://www.facebook.com/',
          'vk.com': 'https://vk.com/',
          'vk.ru': 'https://vk.ru/',
          'telegram.org': 'https://web.telegram.org/',
          'ok.ru': 'https://ok.ru/',
        };
        const home = Object.entries(homes).find(([d]) => location.hostname.includes(d))?.[1] || location.origin + '/';
        location.replace(home);
      });
      document.getElementById('amw-continue-btn').addEventListener('click', () => {
        overlay.remove();
      });

      safeSend({ type: 'RECORD_BLOCKED', platform });
    },

    showTimeBanner(platform, minutes) {
      document.getElementById('amw-time-banner')?.remove();
      const names = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', twitter: 'Twitter/X', facebook: 'Facebook', vk: 'ВКонтакте', telegram: 'Telegram', ok: 'OK.ru' };
      const el = document.createElement('div');
      el.id = 'amw-time-banner';
      el.innerHTML = `
        <div class="amw-time-dot"></div>
        <span>На ${names[platform] || platform} уже <strong style="color:#fff">${minutes} мин</strong> сегодня</span>
        <button class="amw-time-x" id="amw-close-banner">×</button>
      `;
      document.body.appendChild(el);
      document.getElementById('amw-close-banner')?.addEventListener('click', () => el.remove());
      setTimeout(() => el.remove(), 9000);
    },

    showLimitOverlay(platform, limit) {
      if (document.getElementById('amw-limit-overlay')) return;
      const names = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', twitter: 'Twitter/X', facebook: 'Facebook', vk: 'ВКонтакте', telegram: 'Telegram', ok: 'OK.ru' };
      const el = document.createElement('div');
      el.id = 'amw-limit-overlay';
      el.innerHTML = `
        <div class="amw-card" style="text-align:center; max-width:360px">
          <div style="font-size:44px; margin-bottom:12px">⏱</div>
          <h2 class="amw-fraud-title">Лимит времени достигнут</h2>
          <p class="amw-fraud-desc" style="margin-bottom:24px">
            Ты провёл на ${names[platform] || platform} уже ${limit} минут сегодня.<br>
            Сделай перерыв!
          </p>
          <button class="amw-btn-primary" id="amw-limit-ok" style="max-width:180px; margin:0 auto; display:block">Понятно</button>
        </div>
      `;
      document.body.appendChild(el);
      document.getElementById('amw-limit-ok')?.addEventListener('click', () => el.remove());
    },

    // Check if this URL was previously blocked by user
    async isBlocked(url) {
      return new Promise(resolve => {
        safeSend({ type: 'CHECK_BLOCKED_URL', url }, r => {
          resolve(r?.blocked ?? false);
        });
      });
    },

    async classify(payload) {
      return new Promise((resolve) => {
        safeSend({ type: 'CLASSIFY', payload }, (resp) => {
          if (chrome.runtime.lastError || !resp?.ok) { resolve(null); return; }
          resolve(resp.result);
        });
      });
    },

    // Capture current video frame as JPEG base64
    captureVideoFrame() {
      try {
        const video = document.querySelector('video');
        if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
        const w = 480;
        const h = Math.round(w * video.videoHeight / video.videoWidth) || 270;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(video, 0, 0, w, h);
        return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
      } catch { return null; }
    },

    async classifyImage(imageBase64) {
      return new Promise((resolve) => {
        safeSend({ type: 'CLASSIFY_IMAGE', imageBase64, mediaType: 'image/jpeg' }, (resp) => {
          if (chrome.runtime.lastError || !resp?.ok) { resolve(null); return; }
          resolve(resp.result);
        });
      });
    },

    // Run text+audio AND image analysis in parallel, return highest risk
    async classifyDeep(payload) {
      const imageBase64 = window.AMW.captureVideoFrame();
      const jobs = [
        window.AMW.classify(payload),
        imageBase64 ? window.AMW.classifyImage(imageBase64) : Promise.resolve(null),
      ];
      const [textResult, imgResult] = await Promise.all(jobs);

      if (!textResult && !imgResult) return null;
      if (!textResult) return imgResult;
      if (!imgResult) return textResult;

      // Return the result with higher risk score
      const tr = textResult.riskScore ?? 0;
      const ir = imgResult.riskScore ?? 0;
      if (ir > tr) return { ...imgResult, imageAnalyzed: true, textRiskScore: tr };
      return { ...textResult, imageAnalyzed: !!imageBase64, imageRiskScore: ir };
    },

    startTimeTracking(platform) {
      const MILESTONES = [15, 30, 60, 90, 120];
      const notified = new Set();
      let sessionSec = 0;
      let lastTick = Date.now();
      let accum = 0; // seconds accumulated since last sync

      const iv = setInterval(async () => {
        if (document.hidden) { lastTick = Date.now(); return; }
        const now = Date.now();
        const elapsed = Math.floor((now - lastTick) / 1000);
        lastTick = now;
        if (elapsed > 60) return; // tab was hidden

        sessionSec += elapsed;
        accum += elapsed;

        // Sync to background every 30s
        if (accum >= 30) {
          safeSend({ type: 'TRACK_TIME', platform, seconds: accum });
          accum = 0;
        }

        // Milestone notifications
        const minutes = Math.floor(sessionSec / 60);
        for (const m of MILESTONES) {
          if (minutes >= m && !notified.has(m)) {
            notified.add(m);
            window.AMW.showTimeBanner(platform, m);
          }
        }

        // Check hard limit (once per minute)
        if (sessionSec % 60 < elapsed) {
          safeSend({ type: 'CHECK_TIME_LIMIT', platform }, (resp) => {
            if (resp?.exceeded) window.AMW.showLimitOverlay(platform, resp.limit);
          });
        }
      }, 5000);

      return () => clearInterval(iv);
    },
  };
})();
