import { Router } from 'express';
import { z } from 'zod';
import { BinanceService } from '../../services/binance/BinanceService.js';
import { validateBody } from '../middleware/validation.js';

const orderSchema = z.object({
  symbol: z.string().min(2),
  side: z.enum(['BUY', 'SELL']),
  amountUsd: z.number().positive(),
  orderType: z.enum(['MARKET', 'LIMIT']).default('MARKET'),
  signalId: z.string().optional(),
  sourceCategory: z.string().optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
});

const symbolParamSchema = z.object({
  symbol: z.string().min(2).max(20).regex(/^[A-Za-z0-9_/-]+$/, 'Invalid symbol format'),
});

const chartQuerySchema = z.object({
  timeframe: z.string().default('15m'),
  limit: z.coerce.number().min(1).max(500).default(100),
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

  router.get('/chart/:symbol', async (req, res, next) => {
    try {
      const paramResult = symbolParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: paramResult.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      const queryResult = chartQuerySchema.safeParse(req.query);
      const timeframe = queryResult.success ? queryResult.data.timeframe : '15m';
      const limit = queryResult.success ? queryResult.data.limit : 100;

      // Normalize symbol (e.g. BTCUSDT -> BTC/USDT, BTC-USDT -> BTC/USDT)
      let rawSymbol = paramResult.data.symbol.toUpperCase();
      if (rawSymbol.includes('-')) {
        rawSymbol = rawSymbol.replace('-', '/');
      } else if (rawSymbol.includes('_')) {
        rawSymbol = rawSymbol.replace('_', '/');
      } else if (!rawSymbol.includes('/') && rawSymbol.endsWith('USDT')) {
        rawSymbol = `${rawSymbol.replace('USDT', '')}/USDT`;
      }

      const candles = await binanceService.fetchCandles(rawSymbol, timeframe, limit);
      res.json(candles);
    } catch (err) {
      next(err);
    }
  });

  router.post('/order', validateBody(orderSchema), async (req, res, next) => {
    try {
      const { symbol, side, amountUsd, orderType, signalId, sourceCategory, stopLoss, takeProfit } = req.body;
      const result = await binanceService.executeOrder(symbol, side, amountUsd, orderType, {
        signalId,
        sourceCategory,
        stopLoss,
        takeProfit,
      });

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
