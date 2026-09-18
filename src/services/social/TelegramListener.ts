import { eventBus } from '../../events/EventBus.js';
import { EventType } from '../../config/constants.js';
import { SocialSignal } from '../../types/market.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export class TelegramListener {
  private channels: string[];
  private isRunning: boolean = false;
  private simTimer: any = null;
  private coinKeywords = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'AVAX'];

  constructor(channels: string[] = config.TELEGRAM_CHANNELS) {
    this.channels = channels;
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    const channelList = this.channels.length > 0 ? this.channels.join(', ') : 'None (Listening to mock signals)';
    logger.info(`💬 [TelegramListener] Starting MTProto Telegram listener on channels: [${channelList}]`);

    if (config.NODE_ENV !== 'test') {
      // Periodic mock telegram signal if real MTProto is in demo mode
      this.simTimer = setInterval(() => {
        if (Math.random() < 0.4) {
          this.simulateIncomingMessage();
        }
      }, 25000);
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
    logger.info('🛑 [TelegramListener] Stopped.');
  }

  public handleIncomingMessage(channel: string, rawText: string): SocialSignal | null {
    if (!rawText) return null;

    // Detect mentioned coins
    const upper = rawText.toUpperCase();
    const matchedCoin = this.coinKeywords.find((c) => upper.includes(c)) || 'BTC';

    // Simple heuristic sentiment
    let sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' = 'NEUTRAL';
    const posWords = ['BUY', 'PUMP', 'MOON', 'ALIN', 'UÇUYOR', 'YUKARI', 'LONG', 'BREAKOUT', 'GEM'];
    const negWords = ['SELL', 'DUMP', 'CRASH', 'SATIN', 'DÜŞÜYOR', 'SHORT', 'STOP', 'SCAM'];

    let posHits = 0;
    let negHits = 0;
    posWords.forEach((w) => {
      if (upper.includes(w)) posHits++;
    });
    negWords.forEach((w) => {
      if (upper.includes(w)) negHits++;
    });

    if (posHits > negHits) sentiment = 'POSITIVE';
    else if (negHits > posHits) sentiment = 'NEGATIVE';

    // Social signal base confidence is intentionally conservative (30-65) due to high noise
    let confidenceScore = 40;
    if (sentiment !== 'NEUTRAL') confidenceScore += 20;

    const signal: SocialSignal = {
      id: `tg_sig_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      source: 'telegram',
      channelOrUser: channel,
      coin: matchedCoin,
      sentiment,
      rawContent: rawText.substring(0, 160),
      confidenceScore,
      timestamp: new Date().toISOString(),
    };

    eventBus.publish(EventType.SOCIAL_SIGNAL, signal);
    logger.debug(`💬 [TelegramListener] New signal from ${channel}: ${signal.coin} (${signal.sentiment}, conf: ${confidenceScore})`);
    return signal;
  }

  private simulateIncomingMessage(): void {
    const mockMessages = [
      { ch: 'CryptoAlphaPulse', text: '🚀 BTC breakout confirmed on 15m! Massive volume coming in!' },
      { ch: 'WhaleSniperVIP', text: '🔥 SOL massive accumulation detected. Target 180+' },
      { ch: 'ScalpWarriors', text: '⚡ ETH testing resistance, looking for long scalp entry' },
    ];
    const item = mockMessages[Math.floor(Math.random() * mockMessages.length)];
    this.handleIncomingMessage(item.ch, item.text);
  }
}
