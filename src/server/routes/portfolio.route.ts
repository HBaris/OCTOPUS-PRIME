import { Router } from 'express';
import { z } from 'zod';
import { BinanceService } from '../../services/binance/BinanceService.js';
import { validateBody } from '../middleware/validation.js';

const orderSchema = z.object({
  symbol: z.string().min(2),
  side: z.enum(['BUY', 'SELL']),
  amountUsd: z.number().positive(),
  orderType: z.enum(['MARKET', 'LIMIT']).default('MARKET'),
});

export function createPortfolioRouter(binanceService: BinanceService): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const balance = await binanceService.getBalance();
      const positions = await binanceService.getPositions();
      const recentOrders = binanceService.getRecentOrders();

      let totalUnrealizedPnl = 0;
      for (const p of positions) {
        totalUnrealizedPnl += p.unrealizedPnl;
      }

      res.json({
        balance,
        positions,
        totalUnrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
        recentOrders,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/order', validateBody(orderSchema), async (req, res, next) => {
    try {
      const { symbol, side, amountUsd, orderType } = req.body;
      const result = await binanceService.executeOrder(symbol, side, amountUsd, orderType);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
