import { Router } from 'express';
import { z } from 'zod';
import { NewsRadar } from '../../services/news/NewsRadar.js';
import { KeywordsManager } from '../../services/news/KeywordsManager.js';
import { validateBody } from '../middleware/validation.js';

const addKeywordSchema = z.object({
  category: z.string().min(2),
  keywords: z.array(z.string().min(1)).min(1),
  strength: z.number().min(0).max(1).default(0.8),
  description: z.string().optional(),
});

export function createNewsRouter(newsRadar: NewsRadar, keywordsManager: KeywordsManager): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const recentNews = newsRadar.getRecentNews();
    res.json({
      count: recentNews.length,
      news: recentNews,
    });
  });

  router.post('/scan', async (_req, res, next) => {
    try {
      const discovered = await newsRadar.scanOnce();
      res.json({
        message: 'News scan completed',
        newArticlesCount: discovered.length,
        articles: discovered,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/keywords', (_req, res) => {
    res.json(keywordsManager.getCategories());
  });

  router.post('/keywords', validateBody(addKeywordSchema), (req, res) => {
    const { category, keywords, strength, description } = req.body;
    keywordsManager.addKeywords(category, keywords, strength, description);

    res.json({
      message: `Keywords successfully added to category "${category}"`,
      updatedCategories: keywordsManager.getCategories(),
    });
  });

  return router;
}
