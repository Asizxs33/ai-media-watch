/**
 * Spectra AI — Background Service Worker v2.0
 * Deep analysis: DOM text (fast) + audio transcription via backend yt-dlp+Whisper
 */

const DEFAULT_SETTINGS = {
  backendUrl: 'https://lane-strengths-var-ccd.trycloudflare.com',
  enabled: true,
  blockThreshold: 0.65,
  timeLimitsEnabled: false,
  timeLimits: { youtube: 60, tiktok: 30, instagram: 30, twitter: 60, facebook: 60, vk: 60, telegram: 120, ok: 60 },
};

let _settingsCache = null;

async function getSettings() {
  if (_settingsCache) return _settingsCache;
  const data = await chrome.storage.sync.get('settings');
  _settingsCache = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  return _settingsCache;
}

async function saveSettings(newSettings) {
  _settingsCache = { ...DEFAULT_SETTINGS, ...newSettings };
  await chrome.storage.sync.set({ settings: _settingsCache });
  return _settingsCache;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getTimeData() {
  const data = await chrome.storage.local.get('timeData');
  return data.timeData || {};
}

async function addTime(platform, seconds) {
  const timeData = await getTimeData();
  const date = todayKey();
  if (!timeData[date]) timeData[date] = {};
  if (!timeData[date][platform]) timeData[date][platform] = 0;
  timeData[date][platform] += seconds;

  const keys = Object.keys(timeData).sort();
  while (keys.length > 7) delete timeData[keys.shift()];

  await chrome.storage.local.set({ timeData });
  return timeData[date][platform];
}

async function getTodayTime() {
  const timeData = await getTimeData();
  return timeData[todayKey()] || {};
}

async function recordBlocked(platform) {
  const data = await chrome.storage.local.get('blockedCount');
  const counts = data.blockedCount || {};
  const date = todayKey();
  if (!counts[date]) counts[date] = {};
  if (!counts[date][platform]) counts[date][platform] = 0;
  counts[date][platform]++;
  await chrome.storage.local.set({ blockedCount: counts });
}

async function getTodayBlocked() {
  const data = await chrome.storage.local.get('blockedCount');
  const counts = data.blockedCount || {};
  return counts[todayKey()] || {};
}

// Platforms that support audio transcription via yt-dlp
const AUDIO_PLATFORMS = new Set(['youtube', 'tiktok', 'instagram', 'twitter', 'facebook', 'vk', 'ok']);

async function classifyImage(imageBase64, mediaType = 'image/jpeg') {
  const settings = await getSettings();
  if (!settings.enabled) return null;

  const response = await fetch(`${settings.backendUrl}/api/analyze/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mediaType }),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) throw new Error(`Backend ${response.status}`);
  return response.json();
}

async function classifyContent(payload) {
  const settings = await getSettings();
  if (!settings.enabled) return null;

  const supportsAudio = AUDIO_PLATFORMS.has(payload.platform) && !!payload.url;
  const endpoint = supportsAudio ? '/api/analyze/deep' : '/api/analyze/text';

  // Deep analysis can take up to 45s (yt-dlp + Whisper)
  const timeout = supportsAudio ? 45000 : 15000;

  const body = supportsAudio
    ? { url: payload.url, caption: payload.text || '', username: payload.username || '', platform: payload.platform || 'unknown' }
    : { caption: payload.text || '', username: payload.username || '', platform: payload.platform || 'unknown' };

  const response = await fetch(`${settings.backendUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) throw new Error(`Backend ${response.status}`);
  return response.json();
}

async function checkTimeLimit(platform) {
  const [settings, timeToday] = await Promise.all([getSettings(), getTodayTime()]);
  if (!settings.timeLimitsEnabled) return { exceeded: false };
  const limitMin = settings.timeLimits[platform] ?? 60;
  const spentMin = Math.floor((timeToday[platform] || 0) / 60);
  return { exceeded: spentMin >= limitMin, spent: spentMin, limit: limitMin };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case 'CLASSIFY':
      classifyContent(msg.payload)
        .then(result => sendResponse({ ok: true, result }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true;

    case 'CLASSIFY_IMAGE':
      classifyImage(msg.imageBase64, msg.mediaType)
        .then(result => sendResponse({ ok: true, result }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true;

    case 'TRACK_TIME':
      addTime(msg.platform, msg.seconds)
        .then(total => sendResponse({ ok: true, total }))
        .catch(() => sendResponse({ ok: false }));
      return true;

    case 'RECORD_BLOCKED':
      recordBlocked(msg.platform)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;

    case 'GET_STATE':
      Promise.all([getSettings(), getTodayTime(), getTodayBlocked()])
        .then(([settings, timeToday, blockedToday]) =>
          sendResponse({ settings, timeToday, blockedToday })
        )
        .catch(err => sendResponse({ error: err.message }));
      return true;

    case 'SAVE_SETTINGS':
      saveSettings(msg.settings)
        .then(s => sendResponse({ ok: true, settings: s }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true;

    case 'CHECK_TIME_LIMIT':
      checkTimeLimit(msg.platform)
        .then(sendResponse)
        .catch(() => sendResponse({ exceeded: false }));
      return true;
  }
});
