import { Router } from 'express';
import { scannerState, triggerManualScan, pauseScanner, resumeScanner, setEnabledPlatforms } from '../services/autonomousScanner.js';

export const scannerRouter = Router();

/** GET /api/scanner/status */
scannerRouter.get('/status', (_req, res) => {
  res.json({ ...scannerState, recentFindings: scannerState.recentFindings.slice(0, 20) });
});

/** POST /api/scanner/trigger — run now */
scannerRouter.post('/trigger', async (_req, res) => {
  try {
    if (scannerState.paused) resumeScanner(); // auto-unpause when manually triggered
    await triggerManualScan();
    res.json({ ok: true });
  } catch (err) {
    res.status(409).json({ ok: false, error: err.message });
  }
});

/** POST /api/scanner/pause */
scannerRouter.post('/pause', (_req, res) => {
  pauseScanner();
  res.json({ ok: true, paused: true });
});

/** POST /api/scanner/resume */
scannerRouter.post('/resume', (_req, res) => {
  resumeScanner();
  res.json({ ok: true, paused: false });
});

/** POST /api/scanner/platforms — { platforms: ['youtube','tiktok','rutube'] } */
scannerRouter.post('/platforms', (req, res) => {
  try {
    const { platforms } = req.body;
    if (!Array.isArray(platforms)) return res.status(400).json({ ok: false, error: 'platforms must be an array' });
    setEnabledPlatforms(platforms);
    res.json({ ok: true, enabledPlatforms: scannerState.enabledPlatforms });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});
