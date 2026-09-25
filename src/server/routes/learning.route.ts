import { Router, Request, Response } from 'express';
import { LearningEngine } from '../../services/learning/LearningEngine.js';
import { TradeJournalService, tradeJournalService as defaultTradeJournalService } from '../../services/learning/TradeJournalService.js';
import { z } from 'zod';

export function createLearningRouter(
  learningEngine: LearningEngine,
  tradeJournalService: TradeJournalService = defaultTradeJournalService
): Router {
  const router = Router();

  // GET /api/learning/rules
  router.get('/rules', (req: Request, res: Response) => {
    const rules = learningEngine.getAllRules();
    res.json({
      success: true,
      currentRegime: learningEngine.getMarketRegime(),
      count: rules.length,
      rules,
    });
  });

  // GET /api/learning/journal (Trade Journal & Distilled Lessons)
  router.get('/journal', (_req: Request, res: Response) => {
    const distilled = tradeJournalService.getDistilledKnowledge();
    const recentTrades = tradeJournalService.getRecentTrades(50);
    const summary = tradeJournalService.getPerformanceSummary();

    res.json({
      success: true,
      performanceSummary: summary,
      distilledLessons: distilled.distilledLessons,
      coinPerformance: distilled.coinPerformance,
      regimePerformance: distilled.regimePerformance,
      recentTrades,
      lastDistilledAt: distilled.lastDistilledAt,
    });
  });

  // POST /api/learning/distill (Force distillation update)
  router.post('/distill', (_req: Request, res: Response) => {
    const updated = tradeJournalService.distillLessons();
    res.json({
      success: true,
      message: 'Knowledge distillation executed successfully.',
      distilledKnowledge: updated,
    });
  });

  // POST /api/learning/regime
  router.post('/regime', (req: Request, res: Response) => {
    const schema = z.object({
      regime: z.enum(['BULL', 'BEAR', 'SIDEWAYS']),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid regime', details: parsed.error.format() });
      return;
    }

    learningEngine.setMarketRegime(parsed.data.regime as any);
    res.json({
      success: true,
      newRegime: parsed.data.regime,
    });
  });

  return router;
}
