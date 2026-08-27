import { Router, Request, Response } from 'express';
import { AssistantService } from '../../services/assistant/AssistantService.js';
import { logger } from '../../utils/logger.js';

export function createAssistantRouter(assistantService: AssistantService): Router {
  const router = Router();

  /**
   * GET /api/assistant/briefing
   * Returns full personal assistant briefing (Task Summary & General News Summary)
   */
  router.get('/briefing', (_req: Request, res: Response) => {
    try {
      const briefing = assistantService.getFullBriefing();
      res.json({
        success: true,
        briefing,
      });
    } catch (err: any) {
      logger.error('Failed to get assistant briefing:', err);
      res.status(500).json({ error: 'Failed to generate briefing', details: err?.message });
    }
  });

  /**
   * POST /api/assistant/mark-read
   * Marks current briefing as read and resets counters for new period
   */
  router.post('/mark-read', (_req: Request, res: Response) => {
    try {
      const result = assistantService.markAsRead();
      res.json(result);
    } catch (err: any) {
      logger.error('Failed to mark briefing as read:', err);
      res.status(500).json({ error: 'Failed to mark briefing as read', details: err?.message });
    }
  });

  return router;
}
