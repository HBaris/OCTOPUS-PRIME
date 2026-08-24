import { Router } from 'express';
import { z } from 'zod';
import { DecisionEngine } from '../../services/decision/DecisionEngine.js';
import { validateBody } from '../middleware/validation.js';

const weightsSchema = z.object({
  newsImpactWeight: z.number().min(0).max(1).optional(),
  sentimentWeight: z.number().min(0).max(1).optional(),
  priceMomentumWeight: z.number().min(0).max(1).optional(),
  correlationWeight: z.number().min(0).max(1).optional(),
});

export function createSignalsRouter(decisionEngine: DecisionEngine): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const signals = decisionEngine.getSignals();
    res.json({
      count: signals.length,
      signals,
    });
  });

  router.get('/weights', (_req, res) => {
    res.json(decisionEngine.getWeights());
  });

  router.patch('/weights', validateBody(weightsSchema), (req, res) => {
    decisionEngine.updateWeights(req.body);
    res.json({
      message: 'Decision weights updated successfully',
      weights: decisionEngine.getWeights(),
    });
  });

  return router;
}
