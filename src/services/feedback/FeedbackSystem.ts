import fs from 'fs';
import path from 'path';
import { FeedbackEmoji, EventType } from '../../config/constants.js';
import { UserFeedback, FeedbackAnalytics } from '../../types/feedback.js';
import { eventBus } from '../../events/EventBus.js';
import { logger } from '../../utils/logger.js';

export class FeedbackSystem {
  private feedbackFilePath: string;
  private feedbackHistory: UserFeedback[] = [];

  constructor(filePath = 'feedback.json') {
    this.feedbackFilePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
    this.loadFeedback();
  }

  public loadFeedback(): void {
    try {
      if (fs.existsSync(this.feedbackFilePath)) {
        const lines = fs.readFileSync(this.feedbackFilePath, 'utf-8').split('\n');
        this.feedbackHistory = lines
          .filter((line) => line.trim().length > 0)
          .map((line) => JSON.parse(line));
        logger.info(`✅ Loaded ${this.feedbackHistory.length} user feedback records from ${this.feedbackFilePath}`);
      } else {
        this.feedbackHistory = [];
      }
    } catch (err) {
      logger.error('❌ Error reading feedback.json:', err);
      this.feedbackHistory = [];
    }
  }

  public recordFeedback(targetId: string, emoji: FeedbackEmoji, userNotes?: string): UserFeedback {
    const meaning = this.mapEmojiToMeaning(emoji);

    const feedback: UserFeedback = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      targetId,
      emoji,
      meaning,
      userNotes,
      timestamp: new Date().toISOString(),
    };

    this.feedbackHistory.push(feedback);

    try {
      fs.appendFileSync(this.feedbackFilePath, JSON.stringify(feedback) + '\n', 'utf-8');
      logger.info(`👍 [FeedbackSystem] Recorded feedback "${emoji}" (${meaning}) for target ${targetId}`);
    } catch (err) {
      logger.error('❌ Failed to append feedback to feedback.json:', err);
    }

    // Publish event
    eventBus.publish(EventType.FEEDBACK_RECEIVED, {
      feedbackId: feedback.id,
      targetId,
      emoji,
      emojiMeaning: meaning,
    });

    return feedback;
  }

  public analyzeFeedback(): FeedbackAnalytics {
    const total = this.feedbackHistory.length;
    if (total === 0) {
      return {
        totalFeedbackCount: 0,
        accuracyRate: 0.8, // default baseline
        falseAlarmRate: 0.1,
        criticalCount: 0,
        emojiBreakdown: {},
        recommendation: 'Henüz yeterli kullanıcı geri bildirimi toplanmadı (Varsayılan model ağırlıkları aktif).',
      };
    }

    const breakdown: Record<string, number> = {};
    let accurate = 0;
    let falseAlarms = 0;
    let critical = 0;

    for (const f of this.feedbackHistory) {
      breakdown[f.emoji] = (breakdown[f.emoji] || 0) + 1;
      if (f.meaning === 'accurate' || f.meaning === 'actionable' || f.meaning === 'critical') {
        accurate++;
      }
      if (f.meaning === 'false_alarm') {
        falseAlarms++;
      }
      if (f.meaning === 'critical') {
        critical++;
      }
    }

    const accuracyRate = Math.round((accurate / total) * 100) / 100;
    const falseAlarmRate = Math.round((falseAlarms / total) * 100) / 100;

    return {
      totalFeedbackCount: total,
      accuracyRate,
      falseAlarmRate,
      criticalCount: critical,
      emojiBreakdown: breakdown,
      recommendation: this.generateRecommendation(accuracyRate, falseAlarmRate),
    };
  }

  public getAdaptiveWeightMultiplier(): number {
    const analytics = this.analyzeFeedback();
    if (analytics.totalFeedbackCount < 3) return 1.0;

    // If accuracy is high, allow slightly higher signal sensitivity
    if (analytics.accuracyRate >= 0.85) {
      return 1.1; // +10% boost
    } else if (analytics.falseAlarmRate >= 0.3) {
      return 0.85; // -15% penalty to reduce false alarms
    }
    return 1.0;
  }

  private mapEmojiToMeaning(emoji: FeedbackEmoji): 'accurate' | 'false_alarm' | 'critical' | 'boring' | 'actionable' | 'unknown' {
    switch (emoji) {
      case FeedbackEmoji.ACCURATE:
        return 'accurate';
      case FeedbackEmoji.FALSE_ALARM:
        return 'false_alarm';
      case FeedbackEmoji.CRITICAL:
        return 'critical';
      case FeedbackEmoji.BORING:
        return 'boring';
      case FeedbackEmoji.ACTIONABLE:
        return 'actionable';
      default:
        return 'unknown';
    }
  }

  private generateRecommendation(accuracyRate: number, falseAlarmRate: number): string {
    if (accuracyRate >= 0.85 && falseAlarmRate <= 0.1) {
      return '🟢 Model performansı mükemmel seviyede. Sinyal ağırlıkları optimize çalışıyor.';
    } else if (falseAlarmRate > 0.25) {
      return '🔴 Yanlış alarm oranı yüksek. Karar motoru eşikleri yukarı çekildi.';
    }
    return '🟡 Dengeli performans. Geri bildirimler sinyal kalitesini kademeli eğitiyor.';
  }

  public getRecentFeedback(limit = 50): UserFeedback[] {
    return this.feedbackHistory.slice(-limit).reverse();
  }
}
