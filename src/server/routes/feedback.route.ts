import { Router } from 'express';
import { z } from 'zod';
import { FeedbackSystem } from '../../services/feedback/FeedbackSystem.js';
import { FeedbackEmoji } from '../../config/constants.js';
import { validateBody } from '../middleware/validation.js';

const EMOJI_MAP: Record<string, FeedbackEmoji> = {
  '✅': FeedbackEmoji.ACCURATE,
  accurate: FeedbackEmoji.ACCURATE,
  ACCURATE: FeedbackEmoji.ACCURATE,
  '❌': FeedbackEmoji.FALSE_ALARM,
  false_alarm: FeedbackEmoji.FALSE_ALARM,
  FALSE_ALARM: FeedbackEmoji.FALSE_ALARM,
  '🔥': FeedbackEmoji.CRITICAL,
  critical: FeedbackEmoji.CRITICAL,
  CRITICAL: FeedbackEmoji.CRITICAL,
  '😴': FeedbackEmoji.BORING,
  boring: FeedbackEmoji.BORING,
  BORING: FeedbackEmoji.BORING,
  '⚡': FeedbackEmoji.ACTIONABLE,
  actionable: FeedbackEmoji.ACTIONABLE,
  ACTIONABLE: FeedbackEmoji.ACTIONABLE,
};

const feedbackSchema = z.object({
  targetId: z.string().min(1),
  emoji: z.string().transform((val, ctx) => {
    const matched = EMOJI_MAP[val.trim()];
    if (!matched) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid emoji value. Allowed: ✅, ❌, 🔥, 😴, ⚡ or accurate, false_alarm, critical, boring, actionable`,
      });
      return z.NEVER;
    }
    return matched;
  }),
  userNotes: z.string().optional(),
});

export function createFeedbackRouter(feedbackSystem: FeedbackSystem): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const feedbackList = feedbackSystem.getRecentFeedback();
    res.json({
      count: feedbackList.length,
      feedback: feedbackList,
    });
  });

  router.get('/stats', (_req, res) => {
    res.json(feedbackSystem.analyzeFeedback());
  });

  router.post('/', validateBody(feedbackSchema), (req, res) => {
    const { targetId, emoji, userNotes } = req.body;
    const recorded = feedbackSystem.recordFeedback(targetId, emoji as FeedbackEmoji, userNotes);

    res.json({
      message: 'Feedback recorded successfully',
      feedback: recorded,
      currentStats: feedbackSystem.analyzeFeedback(),
    });
  });

  return router;
}
