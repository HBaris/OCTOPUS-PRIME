import { NewsFetcher } from './NewsFetcher.js';
import { KeywordsManager } from './KeywordsManager.js';
import { SentimentAnalyzer } from './SentimentAnalyzer.js';
import { ImpactScorer } from '../impact/ImpactScorer.js';
import { eventBus } from '../../events/EventBus.js';
import { EventType } from '../../config/constants.js';
import { NewNewsPayload } from '../../types/events.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export class NewsRadar {
  private fetcher: NewsFetcher;
  private keywordsManager: KeywordsManager;
  private sentimentAnalyzer: SentimentAnalyzer;
  private impactScorer: ImpactScorer;
  private intervalTimer: NodeJS.Timeout | null = null;
  private isScanning = false;
  private processedNewsHistory: NewNewsPayload[] = [];

  constructor(
    keywordsManager: KeywordsManager,
    sentimentAnalyzer: SentimentAnalyzer,
    impactScorer: ImpactScorer
  ) {
    this.fetcher = new NewsFetcher();
    this.keywordsManager = keywordsManager;
    this.sentimentAnalyzer = sentimentAnalyzer;
    this.impactScorer = impactScorer;
  }

  public async scanOnce(): Promise<NewNewsPayload[]> {
    if (this.isScanning) return [];
    this.isScanning = true;

    const newDiscoveredPayloads: NewNewsPayload[] = [];

    try {
      logger.info('📰 [NewsRadar] Scanning RSS feeds for new headlines...');
      const rawArticles = await this.fetcher.fetchLatestNews();

      for (const article of rawArticles) {
        // 1. Keyword & Category Analysis
        const { category, strength } = this.keywordsManager.analyzeText(
          article.title,
          article.summary
        );

        // 2. Sentiment Analysis
        const sentiment = await this.sentimentAnalyzer.analyze(
          `${article.title}. ${article.summary}`
        );

        // 3. Matched Coins
        const matchedCoins = this.fetcher.extractCoinSymbols(
          article.title,
          article.summary
        );

        // 4. Multi-market Impact Scoring
        const correlatedWeights: Record<string, number> = {};
        for (const coin of matchedCoins) {
          correlatedWeights[coin.toLowerCase()] =
            sentiment.label === 'POSITIVE' ? 0.75 : -0.75;
        }
        if (!correlatedWeights['btc']) {
          correlatedWeights['btc'] = sentiment.label === 'POSITIVE' ? 0.65 : -0.65;
        }

        const impact = this.impactScorer.calculateImpact(
          article.title,
          category,
          strength,
          sentiment.score,
          correlatedWeights
        );

        const newsPayload: NewNewsPayload = {
          newsId: `news_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: article.title,
          summary: article.summary,
          source: article.source,
          link: article.link,
          published: article.published,
          matchedCoins,
          category,
          strength,
          sentiment: {
            label: sentiment.label,
            score: sentiment.score,
            description: sentiment.marketImpactDescription,
          },
          impact: {
            impactScore: impact.impactScore,
            severityLabel: impact.severityLabel,
            affectedMarkets: impact.affectedMarkets,
          },
        };

        this.processedNewsHistory.unshift(newsPayload);
        if (this.processedNewsHistory.length > 100) {
          this.processedNewsHistory.pop();
        }

        newDiscoveredPayloads.push(newsPayload);

        // Emit event to EventBus & WebSocket
        eventBus.publish(EventType.NEW_NEWS, newsPayload);
        logger.info(
          `📡 [NewsRadar] ${impact.severityEmoji} New Event: "${article.title.slice(0, 60)}..." | Category: ${category} | Impact: ${impact.impactScore}/10`
        );
      }
    } catch (err) {
      logger.error('❌ [NewsRadar] Error during news scan:', err);
    } finally {
      this.isScanning = false;
    }

    return newDiscoveredPayloads;
  }

  public startPeriodicScan(intervalSeconds = config.RSS_CHECK_INTERVAL_SEC): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }

    logger.info(`⏰ [NewsRadar] Starting periodic RSS scanner (every ${intervalSeconds}s)`);
    // Run initial scan immediately
    this.scanOnce();

    this.intervalTimer = setInterval(() => {
      this.scanOnce();
    }, intervalSeconds * 1000);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public getRecentNews(limit = 30): NewNewsPayload[] {
    return this.processedNewsHistory.slice(0, limit);
  }
}
