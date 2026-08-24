import { Router } from 'express';
import { AgentManager } from '../../agents/AgentManager.js';

export function createStateRouter(agentManager: AgentManager): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const state = await agentManager.getSystemState();
      res.json(state);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
