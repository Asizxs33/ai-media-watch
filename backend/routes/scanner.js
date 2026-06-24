import { Router } from 'express';
import { scannerState, triggerManualScan } from '../services/autonomousScanner.js';

export const scannerRouter = Router();

/** GET /api/scanner/status — current state + recent findings */
scannerRouter.get('/status', (_req, res) => {
  res.json({
    ...scannerState,
    recentFindings: scannerState.recentFindings.slice(0, 20),
  });
});

/** POST /api/scanner/trigger — start a scan immediately (for demo) */
scannerRouter.post('/trigger', async (_req, res) => {
  try {
    await triggerManualScan();
    res.json({ ok: true, message: 'Scan started in background' });
  } catch (err) {
    res.status(409).json({ ok: false, error: err.message });
  }
});
