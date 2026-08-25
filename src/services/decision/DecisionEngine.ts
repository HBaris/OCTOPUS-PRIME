import { TradingSignal, DecisionWeights } from '../../types/signals.js';
import { EventType } from '../../config/constants.js';
import { eventBus } from '../../events/EventBus.js';
import { BinanceService } from '../binance/BinanceService.js';
import { CorrelationTracker } from '../correlation/CorrelationTracker.js';
import { FeedbackSystem } from '../feedback/FeedbackSystem.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export class DecisionEngine {
  private binanceService: BinanceService;
  private correlationTracker: CorrelationTracker;
  private feedbackSystem: FeedbackSystem;
  private weights: DecisionWeights = {
    newsImpactWeight: 0.35,
    sentimentWeight: 0.25,
    priceMomentumWeight: 0.25,
    correlationWeight: 0.15,
  };
  private signalThreshold = config.DECISION_SIGNAL_THRESHOLD;
  private signalHistory: TradingSignal[] = [];

  constructor(
    binanceService: BinanceService,
    correlationTracker: CorrelationTracker,
    feedbackSystem: FeedbackSystem
  ) {
    this.binanceService = binanceService;
    this.correlationTracker = correlationTracker;
    this.feedbackSystem = feedbackSystem;

    this.initEventListeners();
  }

  private initEventListeners(): void {
    // Listen for NEW_NEWS event and automatically evaluate trading signals
    eventBus.on(EventType.NEW_NEWS, async (event) => {
      try {
        const payload = event.payload;
        for (const coin of payload.matchedCoins) {
          await this.evaluateNewsSignal(
            coin,
            payload.impact.impactScore,
            payload.sentiment.label,
            payload.sentiment.score,
            payload.title,
            payload.category
          );
        }
      } catch (err) {
        logger.error('❌ [DecisionEngine] Error processing news event:', err);
      }
    });
  }

  public async evaluateNewsSignal(
    symbol: string,
    newsImpactScore: number, // 0-10
    sentimentLabel: string,
    sentimentConfidence: number, // 0-1
    headline: string,
    category: string
  ): Promise<TradingSignal | null> {
    const formattedSymbol = symbol.includes('/') ? symbol : `${symbol}/USDT`;
    const ticker = await this.binanceService.getTicker(formattedSymbol);

    // 1. News Impact component (0 - 100)
    const newsScore = newsImpactScore * 10;

    // 2. Sentiment Component (0 - 100)
    let sentimentScore = 50;
    let expectedDirection = 0;
    if (sentimentLabel === 'POSITIVE') {
      sentimentScore = 50 + sentimentConfidence * 50;
      expectedDirection = 1;
    } else if (sentimentLabel === 'NEGATIVE') {
      sentimentScore = 50 - sentimentConfidence * 50;
      expectedDirection = -1;
    }

    // 3. Price Momentum Component (0 - 100)
    // 24h change gives an indication of trend alignment
    const change24h = ticker.change24hPercent;
    let momentumScore = 50;
    if (expectedDirection > 0) {
      momentumScore = 50 + Math.min(50, Math.max(-50, change24h * 5));
    } else if (expectedDirection < 0) {
      momentumScore = 50 - Math.min(50, Math.max(-50, change24h * 5));
    }

    // 4. Correlation & Risk Confidence Component (0 - 100)
    const riskConfidence = this.correlationTracker.getEmaAccuracy();
    const correlationScore = riskConfidence * 100;

    // 5. Adaptive Feedback Multiplier
    const feedbackMultiplier = this.feedbackSystem.getAdaptiveWeightMultiplier();

    // Composite Weighted Score Calculation (0 - 100)
    const rawScore =
      (newsScore * this.weights.newsImpactWeight +
        sentimentScore * this.weights.sentimentWeight +
        momentumScore * this.weights.priceMomentumWeight +
        correlationScore * this.weights.correlationWeight) *
      feedbackMultiplier;

    const signalScore = Math.round(Math.min(100, Math.max(0, rawScore)));
    const confidence = Math.round(((sentimentConfidence + riskConfidence) / 2) * 100) / 100;

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (signalScore >= this.signalThreshold) {
      action = expectedDirection >= 0 ? 'BUY' : 'SELL';
    } else if (signalScore <= 100 - this.signalThreshold) {
      action = 'SELL';
    }

    const reasoning = `${category} kategorisinde haber (${headline.slice(0, 70)}...) tespit edildi. Sentiment: ${sentimentLabel} (%${Math.round(sentimentConfidence * 100)}). Risk Güveni: %${Math.round(riskConfidence * 100)}.`;

    const signal: TradingSignal = {
      id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      symbol: formattedSymbol,
      action,
      signalScore,
      confidence,
      breakdown: {
        newsImpactScore: Math.round(newsScore),
        sentimentScore: Math.round(sentimentScore),
        priceMomentumScore: Math.round(momentumScore),
        correlationScore: Math.round(correlationScore),
        feedbackWeightMultiplier: Math.round(feedbackMultiplier * 100) / 100,
      },
      reasoning,
      currentPrice: ticker.lastPrice,
      timestamp: new Date().toISOString(),
      status: action !== 'HOLD' ? 'PROPOSED' : 'IGNORED',
    };

    this.signalHistory.unshift(signal);
    if (this.signalHistory.length > 100) {
      this.signalHistory.pop();
    }

    // Emit SIGNAL_GENERATED event
    eventBus.publish(EventType.SIGNAL_GENERATED, {
      signalId: signal.id,
      symbol: signal.symbol,
      action: signal.action,
      signalScore: signal.signalScore,
      confidence: signal.confidence,
      breakdown: signal.breakdown,
      reasoning: signal.reasoning,
      suggestedPrice: ticker.lastPrice,
      suggestedStopLoss: action === 'BUY' ? ticker.lastPrice * 0.98 : ticker.lastPrice * 1.02,
      suggestedTakeProfit: action === 'BUY' ? ticker.lastPrice * 1.04 : ticker.lastPrice * 0.96,
    });

    // If signal exceeds threshold, produce a Trade Proposal
    if (action !== 'HOLD') {
      logger.info(
        `⚡ [DecisionEngine] High-Conviction Signal: ${action} ${formattedSymbol} | Score: ${signalScore}/100 | Confidence: ${confidence}`
      );

      // Register event with CorrelationTracker for 15m outcome evaluation
      this.correlationTracker.trackEvent(
        category,
        formattedSymbol,
        action === 'BUY' ? 1 : -1
      );

      const suggestedStopLoss = Math.round((action === 'BUY' ? ticker.lastPrice * 0.98 : ticker.lastPrice * 1.02) * 100) / 100;
      const suggestedTakeProfit = Math.round((action === 'BUY' ? ticker.lastPrice * 1.04 : ticker.lastPrice * 0.96) * 100) / 100;

      // Emit TRADE_PROPOSAL event (Safe proposal, NO live order executed)
      eventBus.publish(EventType.TRADE_PROPOSAL, {
        proposalId: `prop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        signalId: signal.id,
        symbol: signal.symbol,
        side: action,
        suggestedAmountUsd: Math.min(50.0, config.MAX_POSITION_SIZE_USD),
        estimatedAmountUsd: Math.min(50.0, config.MAX_POSITION_SIZE_USD),
        signalScore: signal.signalScore,
        confidence: signal.confidence,
        reasoning: signal.reasoning,
        sourceCategory: category,
        suggestedStopLoss,
        suggestedTakeProfit,
        status: 'SIMULATED',
        isDryRun: true,
        notes: `Otomatik işlem önerisi: Sinyal Skoru ${signalScore}/100 eşik üstünde.`,
        timestamp: new Date().toISOString(),
      });
    }

    return signal;
  }

  public getSignals(limit = 30): TradingSignal[] {
    return this.signalHistory.slice(0, limit);
  }

  public getWeights(): DecisionWeights {
    return { ...this.weights };
  }

  public updateWeights(newWeights: Partial<DecisionWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
    logger.info('⚖️ [DecisionEngine] Updated decision weights:', this.weights);
  }
}
