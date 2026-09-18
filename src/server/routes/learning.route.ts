import { Router, Request, Response } from 'express';
import { LearningEngine } from '../../services/learning/LearningEngine.js';
import { z } from 'zod';

export function createLearningRouter(learningEngine: LearningEngine): Router {
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
