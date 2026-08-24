import { FeedbackEmoji } from '../config/constants.js';

export interface UserFeedback {
  id: string;
  targetId: string; // signalId or proposalId
  emoji: FeedbackEmoji;
  meaning: 'accurate' | 'false_alarm' | 'critical' | 'boring' | 'actionable' | 'unknown';
  userNotes?: string;
  timestamp: string;
}

export interface FeedbackAnalytics {
  totalFeedbackCount: number;
  accuracyRate: number; // 0 - 1
  falseAlarmRate: number; // 0 - 1
  criticalCount: number;
  emojiBreakdown: Record<string, number>;
  recommendation: string;
}
