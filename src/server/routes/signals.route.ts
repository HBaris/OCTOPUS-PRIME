import { Router } from 'express';
import { z } from 'zod';
import { DecisionEngine } from '../../services/decision/DecisionEngine.js';
import { validateBody } from '../middleware/validation.js';
import { eventBus } from '../../events/EventBus.js';
import { EventType, AgentRole } from '../../config/constants.js';

const weightsSchema = z.object({
  newsImpactWeight: z.number().min(0).max(1).optional(),
  sentimentWeight: z.number().min(0).max(1).optional(),
  priceMomentumWeight: z.number().min(0).max(1).optional(),
  correlationWeight: z.number().min(0).max(1).optional(),
});

const triggerSchema = z.object({
  triggerSource: z.string().optional(),
  timestamp: z.string().optional(),
}).optional();

export function createSignalsRouter(decisionEngine: DecisionEngine): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const signals = decisionEngine.getSignals();
    res.json({
      count: signals.length,
      signals,
    });
  });

  router.post('/trigger', validateBody(triggerSchema || z.any()), (_req, res) => {
    // Publish celebration / saluting action to all agents
    eventBus.publish(EventType.AGENT_ACTION, {
      agentRole: AgentRole.SIGNAL_HUNTER,
      actionName: 'Barış Geldi Selamlaması',
      status: 'COMPLETED',
      details: 'Kaptan Barış geldi! Ekip teyakkuzda.',
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Barış geldi, kaptan! Tüm sistem hazır ve operasyona geçti. 🚀',
      timestamp: new Date().toISOString(),
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
