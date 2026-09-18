import { Router, Request, Response } from 'express';
import { CircuitBreaker } from '../../services/risk/CircuitBreaker.js';
import { z } from 'zod';

export function createCooldownRouter(circuitBreaker: CircuitBreaker): Router {
  const router = Router();

  // GET /api/risk/cooldown/state
  router.get('/state', (req: Request, res: Response) => {
    const state = circuitBreaker.getState();
    res.json({
      success: true,
      state,
    });
  });

  // GET /api/risk/cooldown/reports
  router.get('/reports', (req: Request, res: Response) => {
    const reports = circuitBreaker.getAllReports();
    res.json({
      success: true,
      count: reports.length,
      reports,
    });
  });

  // POST /api/risk/cooldown/ask
  router.post('/ask', (req: Request, res: Response) => {
    const schema = z.object({
      question: z.string().min(1),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Question is required' });
      return;
    }

    const answer = circuitBreaker.answerAssistantQuestion(parsed.data.question);
    res.json({
      success: true,
      question: parsed.data.question,
      answer,
    });
  });

  // POST /api/risk/cooldown/resume
  router.post('/resume', (req: Request, res: Response) => {
    circuitBreaker.resumeTrading('Manuel kullanıcı onayı ile işlemler devam ettirildi.');
    res.json({
      success: true,
      message: 'İşlemler başarıyla devam ettirildi.',
    });
  });

  return router;
}
