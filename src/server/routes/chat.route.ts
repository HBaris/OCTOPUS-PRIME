import { Router, Request, Response } from 'express';
import { ChatAssistantService } from '../../services/ai/ChatAssistantService.js';
import { logger } from '../../utils/logger.js';

export function createChatRoute(chatService: ChatAssistantService): Router {
  const router = Router();

  // POST /api/chat/message - Send a message to the AI Assistant
  router.post('/message', async (req: Request, res: Response) => {
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Mesaj metni boş bırakılamaz.',
        });
      }

      const response = await chatService.processUserMessage(message);
      return res.json({
        success: true,
        data: response,
      });
    } catch (err: any) {
      logger.error('Error processing chat message:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'AI Asistan yanıt üretirken bir hata oluştu.',
      });
    }
  });

  // GET /api/chat/history - Retrieve current conversation history
  router.get('/history', (_req: Request, res: Response) => {
    try {
      const history = chatService.getChatHistory();
      return res.json({
        success: true,
        data: history,
      });
    } catch (err: any) {
      logger.error('Error fetching chat history:', err);
      return res.status(500).json({
        success: false,
        error: 'Sohbet geçmişi alınamadı.',
      });
    }
  });

  // GET /api/chat/suggestions - Retrieve dynamic prompt chips
  router.get('/suggestions', (_req: Request, res: Response) => {
    try {
      const suggestions = chatService.getSuggestedPrompts();
      return res.json({
        success: true,
        data: suggestions,
      });
    } catch (err: any) {
      logger.error('Error fetching suggestions:', err);
      return res.status(500).json({
        success: false,
        error: 'Öneri listesi alınamadı.',
      });
    }
  });

  // POST /api/chat/clear - Reset conversation history
  router.post('/clear', (_req: Request, res: Response) => {
    try {
      chatService.clearChatHistory();
      return res.json({
        success: true,
        message: 'Sohbet geçmişi başarıyla temizlendi.',
      });
    } catch (err: any) {
      logger.error('Error clearing chat history:', err);
      return res.status(500).json({
        success: false,
        error: 'Sohbet geçmişi temizlenemedi.',
      });
    }
  });

  return router;
}
