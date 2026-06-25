/**
 * Spectra AI — Popup logic
 */
(function () {
  'use strict';

  // ── Tabs ──────────────────────────────────────────────────────
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab)?.classList.add('active');
    });
  });

  // ── Threshold slider ──────────────────────────────────────────
  const slider = document.getElementById('threshold-slider');
  const sliderVal = document.getElementById('threshold-val');
  slider.addEventListener('input', () => { sliderVal.textContent = slider.value + '%'; });

  // ── Helpers ───────────────────────────────────────────────────
  function fmtMinutes(seconds) {
    const m = Math.floor((seconds || 0) / 60);
    if (m === 0) return '0 мин';
    if (m < 60) return m + ' мин';
    return Math.floor(m / 60) + 'ч ' + (m % 60) + 'м';
  }

  function showToast(msg = 'Сохранено ✓') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
  }

  function setStatus(state, text) {
    const dot = document.getElementById('status-dot');
    dot.className = 'status-dot ' + state;
    document.getElementById('status-text').textContent = text;
  }

  // ── Load state from background ────────────────────────────────
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (resp) => {
    if (chrome.runtime.lastError || !resp) {
      setStatus('err', 'Ошибка расширения');
      return;
    }

    const { settings, timeToday, blockedToday } = resp;

    // Main toggle
    const toggle = document.getElementById('main-toggle');
    toggle.checked = settings.enabled;
    document.getElementById('toggle-lbl').textContent = settings.enabled ? 'ВКЛ' : 'ВЫКЛ';

    // Settings fields
    document.getElementById('backend-url').value = settings.backendUrl || 'http://localhost:3001';
    slider.value = settings.blockThreshold ?? 65;
    sliderVal.textContent = slider.value + '%';
    document.getElementById('limits-toggle').checked = settings.timeLimitsEnabled || false;
    document.getElementById('limit-youtube').value = settings.timeLimits?.youtube ?? 60;
    document.getElementById('limit-tiktok').value = settings.timeLimits?.tiktok ?? 30;
    document.getElementById('limit-instagram').value = settings.timeLimits?.instagram ?? 30;

    // Time stats — all platforms
    ['youtube', 'tiktok', 'instagram', 'twitter', 'facebook', 'vk', 'telegram', 'ok'].forEach(p => {
      const timeEl = document.getElementById('time-' + p);
      if (timeEl) timeEl.textContent = fmtMinutes(timeToday[p] || 0);

      const blockedEl = document.getElementById('blocked-' + p);
      if (blockedEl) {
        const count = blockedToday[p] || 0;
        blockedEl.textContent = count;
        if (count > 0) blockedEl.classList.add('visible');
      }
    });

    // Total blocked
    const totalBlocked = Object.values(blockedToday).reduce((a, b) => a + b, 0);
    document.getElementById('total-blocked').textContent = totalBlocked;

    // Check backend connectivity
    checkBackend(settings.backendUrl);
  });

  // ── Backend ping ──────────────────────────────────────────────
  async function checkBackend(url) {
    setStatus('loading', 'Проверка подключения…');
    try {
      const resp = await fetch((url || 'http://localhost:3001') + '/api/health', {
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const data = await resp.json().catch(() => ({}));
        const model = data.model ? ` · ${data.model}` : '';
        setStatus('ok', `Подключено${model}`);
      } else {
        setStatus('err', `Ошибка сервера (${resp.status})`);
      }
    } catch {
      setStatus('err', 'Бэкенд недоступен — запустите сервер');
    }
  }

  // ── Main toggle ───────────────────────────────────────────────
  document.getElementById('main-toggle').addEventListener('change', function () {
    const enabled = this.checked;
    document.getElementById('toggle-lbl').textContent = enabled ? 'ВКЛ' : 'ВЫКЛ';

    chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      settings: { enabled },
    }, (resp) => {
      if (resp?.ok) showToast(enabled ? 'Защита включена' : 'Защита выключена');
    });
  });

  // ── Save settings ─────────────────────────────────────────────
  document.getElementById('save-btn').addEventListener('click', () => {
    const settings = {
      backendUrl: document.getElementById('backend-url').value.trim().replace(/\/$/, '') || 'http://localhost:3001',
      blockThreshold: Number(slider.value),
      timeLimitsEnabled: document.getElementById('limits-toggle').checked,
      timeLimits: {
        youtube: Number(document.getElementById('limit-youtube').value) || 60,
        tiktok: Number(document.getElementById('limit-tiktok').value) || 30,
        instagram: Number(document.getElementById('limit-instagram').value) || 30,
      },
      enabled: document.getElementById('main-toggle').checked,
    };

    chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings }, (resp) => {
      if (resp?.ok) {
        showToast('Сохранено ✓');
        checkBackend(settings.backendUrl);
      } else {
        showToast('Ошибка сохранения');
      }
    });
  });
})();
