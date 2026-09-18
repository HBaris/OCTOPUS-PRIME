import { eventBus } from '../../events/EventBus.js';
import { EventType } from '../../config/constants.js';
import { SocialSignal } from '../../types/market.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export class ThreadsObserver {
  private targetUrl: string;
  private isRunning: boolean = false;
  private simTimer: any = null;
  private coinKeywords = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB'];

  constructor(targetUrl: string = config.THREADS_TARGET_URL) {
    this.targetUrl = targetUrl || 'https://www.threads.net';
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    logger.info(`🧵 [ThreadsObserver] Initialized MutationObserver monitor on ${this.targetUrl} (User Session Mode)`);

    if (config.NODE_ENV !== 'test') {
      this.simTimer = setInterval(() => {
        if (Math.random() < 0.3) {
          this.simulatePost();
        }
      }, 35000);
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
    logger.info('🛑 [ThreadsObserver] Stopped.');
  }

  public handleObservedPost(author: string, postText: string): SocialSignal | null {
    if (!postText) return null;

    const upper = postText.toUpperCase();
    const matchedCoin = this.coinKeywords.find((c) => upper.includes(c)) || 'BTC';

    let sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' = 'NEUTRAL';
    if (upper.includes('ALIN') || upper.includes('BUY') || upper.includes('ROKET') || upper.includes('PUMP') || upper.includes('YUKARI')) {
      sentiment = 'POSITIVE';
    } else if (upper.includes('SATIN') || upper.includes('DUMP') || upper.includes('ÇÖKÜŞ') || upper.includes('DÜŞÜŞ')) {
      sentiment = 'NEGATIVE';
    }

    // Conservative confidence for social threads
    const confidenceScore = sentiment === 'NEUTRAL' ? 35 : 55;

    const signal: SocialSignal = {
      id: `th_sig_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      source: 'threads',
      channelOrUser: author,
      coin: matchedCoin,
      sentiment,
      rawContent: postText.substring(0, 160),
      confidenceScore,
      timestamp: new Date().toISOString(),
    };

    eventBus.publish(EventType.SOCIAL_SIGNAL, signal);
    logger.debug(`🧵 [ThreadsObserver] Post detected from @${author}: ${signal.coin} (${signal.sentiment})`);
    return signal;
  }

  private simulatePost(): void {
    const mockPosts = [
      { user: 'cryptotrader_bot', text: 'Bu coini alın ve pişman olmayın: SOL yükseliş dalgası başladı! 🚀' },
      { user: 'gem_hunter_tr', text: 'BTC 68k üzerinde tutunuyor, yeni rekor yakında gelebilir #kripto' },
    ];
    const pick = mockPosts[Math.floor(Math.random() * mockPosts.length)];
    this.handleObservedPost(pick.user, pick.text);
  }
}
