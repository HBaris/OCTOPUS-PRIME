import { Router } from 'express';
import { z } from 'zod';
import { AutoTradeEngine } from '../../services/decision/AutoTradeEngine.js';
import { validateBody } from '../middleware/validation.js';

const toggleSchema = z.object({
  enabled: z.boolean(),
});

export function createAutoTradeRouter(autoTradeEngine: AutoTradeEngine): Router {
  const router = Router();

  router.get('/status', (_req, res) => {
    res.json({
      success: true,
      enabled: autoTradeEngine.isEnabled(),
      stats: autoTradeEngine.getStats(),
    });
  });

  router.post('/toggle', validateBody(toggleSchema), (req, res) => {
    const { enabled } = req.body;
    autoTradeEngine.setEnabled(enabled);
    res.json({
      success: true,
      enabled: autoTradeEngine.isEnabled(),
      stats: autoTradeEngine.getStats(),
      message: enabled ? 'Otonom Pasif Gelir Modu Aktif Edildi' : 'Otonom Mod Devre Dışı Bırakıldı',
    });
  });

  return router;
}
