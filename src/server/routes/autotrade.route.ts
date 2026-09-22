import { Router } from 'express';
import { z } from 'zod';
import { AutoTradeEngine } from '../../services/decision/AutoTradeEngine.js';
import { validateBody } from '../middleware/validation.js';

const toggleSchema = z.object({
  enabled: z.boolean(),
});

const commandSchema = z.object({
  command: z.string().min(1),
});

export function createAutoTradeRouter(autoTradeEngine: AutoTradeEngine): Router {
  const router = Router();

  router.get('/status', (_req, res) => {
    res.json({
      success: true,
      enabled: autoTradeEngine.isEnabled(),
      stats: autoTradeEngine.getStats(),
      recentOrders: autoTradeEngine.getRecentOrders(),
    });
  });

  router.post('/toggle', validateBody(toggleSchema), (req, res) => {
    const { enabled } = req.body;
    autoTradeEngine.setEnabled(enabled);
    res.json({
      success: true,
      enabled: autoTradeEngine.isEnabled(),
      stats: autoTradeEngine.getStats(),
      message: enabled ? 'Dinamik Scalping Modu Aktif Edildi' : 'Otonom Mod Devre Dışı Bırakıldı',
    });
  });

  router.post('/command', validateBody(commandSchema), async (req, res) => {
    try {
      const { command } = req.body;
      const result = await autoTradeEngine.processNaturalLanguageCommand(command);
      res.json({
        ...result,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  return router;
}
