import { Router } from 'express';
import { scannerState, triggerManualScan, pauseScanner, resumeScanner } from '../services/autonomousScanner.js';

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
