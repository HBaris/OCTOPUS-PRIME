import { TradingSignal, DecisionWeights } from '../../types/signals.js';
import { TechnicalIndicatorSignal, SocialSignal } from '../../types/market.js';
import { EventType } from '../../config/constants.js';
import { eventBus } from '../../events/EventBus.js';
import { IExchangeService } from '../exchange/IExchangeService.js';
import { CorrelationTracker } from '../correlation/CorrelationTracker.js';
import { FeedbackSystem } from '../feedback/FeedbackSystem.js';
import { LearningEngine } from '../learning/LearningEngine.js';
import { CircuitBreaker } from '../risk/CircuitBreaker.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export interface MultiChannelInput {
  symbol: string;
  technicalSignal?: TechnicalIndicatorSignal;
  newsSignal?: {
    impactScore: number;
    sentimentLabel: string;
    sentimentConfidence: number;
    headline: string;
    category: string;
  };
  socialSignal?: SocialSignal;
}

export class DecisionEngine {
  private exchangeService: IExchangeService;
  private correlationTracker: CorrelationTracker;
  private feedbackSystem: FeedbackSystem;
  private learningEngine: LearningEngine;
  private circuitBreaker: CircuitBreaker;

  private weights: DecisionWeights = {
    newsImpactWeight: 0.35,
    sentimentWeight: 0.25,
    priceMomentumWeight: 0.25,
    correlationWeight: 0.15,
  };

  private signalThreshold = config.DECISION_SIGNAL_THRESHOLD;
  private signalHistory: TradingSignal[] = [];

  constructor(
    exchangeService: IExchangeService,
    correlationTracker: CorrelationTracker,
    feedbackSystem: FeedbackSystem,
    learningEngine?: LearningEngine,
    circuitBreaker?: CircuitBreaker
  ) {
    this.exchangeService = exchangeService;
    this.correlationTracker = correlationTracker;
    this.feedbackSystem = feedbackSystem;
    this.learningEngine = learningEngine || new LearningEngine();
    this.circuitBreaker = circuitBreaker || new CircuitBreaker();

    this.initEventListeners();
  }

  private initEventListeners(): void {
    // 1. Listen for NEW_NEWS event
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

    // 2. Listen for TECHNICAL_SIGNAL event
    eventBus.on(EventType.TECHNICAL_SIGNAL, async (event) => {
      try {
        const tech = event.payload as TechnicalIndicatorSignal;
        if (tech.confidenceScore >= 65 || tech.confidenceScore <= 35) {
          await this.evaluateMultiChannelSignal({
            symbol: tech.symbol,
            technicalSignal: tech,
          });
        }
      } catch (err) {
        logger.error('❌ [DecisionEngine] Error processing technical signal:', err);
      }
    });

    // 3. Listen for SOCIAL_SIGNAL event
    eventBus.on(EventType.SOCIAL_SIGNAL, async (event) => {
      try {
        const soc = event.payload as SocialSignal;
        const formatted = soc.coin.includes('/') ? soc.coin : `${soc.coin}/USDT`;
        await this.evaluateMultiChannelSignal({
          symbol: formatted,
          socialSignal: soc,
        });
      } catch (err) {
        logger.error('❌ [DecisionEngine] Error processing social signal:', err);
      }
    });
  }

  /**
   * Evaluates signals from multiple channels (Chart TA, Fast News, Social) + Multi-Tier Learning Bonus.
   */
  public async evaluateMultiChannelSignal(input: MultiChannelInput): Promise<TradingSignal | null> {
    const formattedSymbol = input.symbol.includes('/') ? input.symbol : `${input.symbol}/USDT`;
    const ticker = await this.exchangeService.fetchTicker(formattedSymbol);

    // 1. Circuit Breaker Check (If halted, block trading)
    if (this.circuitBreaker.getState().isHalted) {
      logger.warn(`🛑 [DecisionEngine] Trading is currently HALTED by Circuit Breaker (Analysis Mode). Signal rejected for ${formattedSymbol}.`);
      return null;
    }

    // 2. Social-Only Constraint Check:
    // "Sosyal kanal sinyalleri tek başına işlem AÇAMASIN: en az bir başka kanaldan (grafik veya haber) doğrulama şartı olsun"
    const hasTechnical = !!input.technicalSignal;
    const hasNews = !!input.newsSignal;
    const hasSocial = !!input.socialSignal;

    if (hasSocial && !hasTechnical && !hasNews) {
      logger.debug(`💬 [DecisionEngine] Social signal received for ${formattedSymbol} from ${input.socialSignal?.channelOrUser}, but waiting for chart/news corroboration.`);
      return null;
    }

    // 3. Normalized Score Components
    let totalWeight = 0;
    let weightedBase = 0;
    let techScore = 50;
    let newsScore = 50;
    let socialScore = 50;

    if (hasTechnical && input.technicalSignal) {
      techScore = input.technicalSignal.confidenceScore;
      const w = 0.45;
      weightedBase += techScore * w;
      totalWeight += w;
    }

    if (hasNews && input.newsSignal) {
      const impactScore = input.newsSignal.impactScore * 10;
      let sentimentScore = 50;
      if (input.newsSignal.sentimentLabel === 'POSITIVE') {
        sentimentScore = 50 + input.newsSignal.sentimentConfidence * 50;
      } else if (input.newsSignal.sentimentLabel === 'NEGATIVE') {
        sentimentScore = 50 - input.newsSignal.sentimentConfidence * 50;
      }
      newsScore = impactScore * 0.55 + sentimentScore * 0.45;
      const w = 0.35;
      weightedBase += newsScore * w;
      totalWeight += w;
    }

    if (hasSocial && input.socialSignal) {
      if (input.socialSignal.sentiment === 'POSITIVE') {
        socialScore = 70;
      } else if (input.socialSignal.sentiment === 'NEGATIVE') {
        socialScore = 30;
      }
      const w = 0.20;
      weightedBase += socialScore * w;
      totalWeight += w;
    }

    // D) Correlation & Feedback Multipliers
    const riskConfidence = this.correlationTracker.getEmaAccuracy();
    const feedbackMultiplier = this.feedbackSystem.getAdaptiveWeightMultiplier();

    // E) Multi-Tier Learning Rule Matching
    const patternsToCheck: string[] = [];
    if (input.technicalSignal?.emaCross === 'BULLISH' && input.newsSignal?.sentimentLabel === 'POSITIVE') {
      patternsToCheck.push('EMA_BULLISH+NEWS_POSITIVE');
    }
    if (input.technicalSignal?.rsiCondition === 'OVERSOLD' && input.technicalSignal?.volumeSpikeDetected) {
      patternsToCheck.push('RSI_OVERSOLD+VOL_SPIKE');
    }
    if (input.technicalSignal?.emaCross === 'BEARISH' && input.newsSignal?.sentimentLabel === 'NEGATIVE') {
      patternsToCheck.push('EMA_BEARISH+NEWS_NEGATIVE');
    }

    const { totalBonus: learningBonus, appliedRules } = this.learningEngine.getMatchingRuleBonus(patternsToCheck);

    const compositeScore = totalWeight > 0 ? weightedBase / totalWeight : 50;
    const rawScore = compositeScore * feedbackMultiplier + learningBonus;

    const signalScore = Math.round(Math.min(100, Math.max(0, rawScore)));
    const confidence = Math.round(((signalScore / 100) * 0.7 + riskConfidence * 0.3) * 100) / 100;

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (signalScore >= this.signalThreshold) {
      action = 'BUY';
    } else if (signalScore <= 100 - this.signalThreshold) {
      action = 'SELL';
    }

    // Determine Dynamic Leverage (2x - 10x) based on confidence score
    const suggestedLeverage = this.calculateDynamicLeverage(signalScore);

    const appliedRuleNames = appliedRules.map((r) => `${r.description} (+%${r.confidenceBonus})`).join('; ');
    const reasoning = `3-Kanallı Sentez: Grafik=${Math.round(techScore)}, Haber=${Math.round(newsScore)}, Sosyal=${Math.round(socialScore)}. Öğrenme Bonusu=+%${learningBonus} (${appliedRuleNames || 'Standart Kurallar'}). Kaldıraç=${suggestedLeverage}x.`;

    const signal: TradingSignal = {
      id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      symbol: formattedSymbol,
      action,
      signalScore,
      confidence,
      breakdown: {
        newsImpactScore: Math.round(newsScore),
        sentimentScore: Math.round(socialScore),
        priceMomentumScore: Math.round(techScore),
        correlationScore: Math.round(riskConfidence * 100),
        feedbackWeightMultiplier: Math.round(feedbackMultiplier * 100) / 100,
      },
      reasoning,
      currentPrice: ticker.lastPrice,
      timestamp: new Date().toISOString(),
      status: action !== 'HOLD' ? 'PROPOSED' : 'IGNORED',
    };

    this.signalHistory.unshift(signal);
    if (this.signalHistory.length > 100) this.signalHistory.pop();

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

    if (action !== 'HOLD') {
      logger.info(
        `⚡ [DecisionEngine] 3-Channel Signal: ${action} ${formattedSymbol} | Score: ${signalScore}/100 | Leverage: ${suggestedLeverage}x`
      );

      const suggestedStopLoss = Math.round((action === 'BUY' ? ticker.lastPrice * 0.98 : ticker.lastPrice * 1.02) * 100) / 100;
      const suggestedTakeProfit = Math.round((action === 'BUY' ? ticker.lastPrice * 1.04 : ticker.lastPrice * 0.96) * 100) / 100;
      const suggestedMarginMode = config.DEFAULT_MARGIN_MODE;
      const estimatedMarginUsd = Math.min(50.0, config.MAX_POSITION_SIZE_USD);
      const estimatedPositionSizeUsd = estimatedMarginUsd * suggestedLeverage;

      eventBus.publish(EventType.TRADE_PROPOSAL, {
        proposalId: `prop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        signalId: signal.id,
        symbol: signal.symbol,
        side: action,
        suggestedAmountUsd: estimatedMarginUsd,
        estimatedAmountUsd: estimatedMarginUsd,
        suggestedLeverage,
        suggestedMarginMode,
        estimatedMarginUsd,
        estimatedPositionSizeUsd,
        signalScore: signal.signalScore,
        confidence: signal.confidence,
        reasoning: signal.reasoning,
        sourceCategory: input.newsSignal?.category || 'scalping_multichannel',
        suggestedStopLoss,
        suggestedTakeProfit,
        status: 'SIMULATED',
        isDryRun: true,
        notes: `3-Kanallı Karar: Skor ${signalScore}/100, ${suggestedLeverage}x kaldıraç (${suggestedMarginMode}).`,
        timestamp: new Date().toISOString(),
      });
    }

    return signal;
  }

  /**
   * Confidence Score to Dynamic Leverage Mapping
   * - 0 - 65   : 1x (HOLD / No Trade)
   * - 65 - 75  : 2x
   * - 75 - 85  : 4x (3-5x)
   * - 85 - 95  : 7x (5-8x)
   * - 95 - 100 : 10x (MAX_LEVERAGE_ALLOWED cap)
   */
  public calculateDynamicLeverage(signalScore: number): number {
    const maxAllowed = config.MAX_LEVERAGE_ALLOWED || 10;

    if (signalScore < 65) return 1;
    if (signalScore < 75) return Math.min(2, maxAllowed);
    if (signalScore < 85) return Math.min(4, maxAllowed);
    if (signalScore < 95) return Math.min(7, maxAllowed);
    return Math.min(10, maxAllowed);
  }

  /**
   * Backward-compatible evaluation for single news events
   */
  public async evaluateNewsSignal(
    symbol: string,
    newsImpactScore: number,
    sentimentLabel: string,
    sentimentConfidence: number,
    headline: string,
    category: string
  ): Promise<TradingSignal | null> {
    return this.evaluateMultiChannelSignal({
      symbol,
      newsSignal: {
        impactScore: newsImpactScore,
        sentimentLabel,
        sentimentConfidence,
        headline,
        category,
      },
    });
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

  public getLearningEngine(): LearningEngine {
    return this.learningEngine;
  }

  public getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }
}
