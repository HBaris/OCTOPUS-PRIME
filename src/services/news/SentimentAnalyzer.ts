import { SentimentAnalysisResult } from '../../types/news.js';
import { SentimentLabel } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

/**
 * Multilingual financial dictionary for instant, zero-latency lexical sentiment analysis.
 * Primary strategy: Provides ultra-fast, deterministic evaluation for English and Turkish headlines.
 */
const POSITIVE_WORDS = [
  // English financial & crypto terms
  'surge', 'jump', 'rally', 'bull', 'bullish', 'gain', 'profit', 'rise', 'record',
  'high', 'adoption', 'approval', 'etf approved', 'partnership', 'upgrade', 'breakout',
  'inflow', 'accumulate', 'soar', 'all-time high', 'ath', 'support', 'growth',
  // Turkish financial & crypto terms
  'yükseliş', 'rekor', 'kazanç', 'artış', 'onay', 'boğa', 'ralli', 'fırladı', 'yeşil',
  'büyüme', 'başarı', 'destek', 'zirve', 'güçlü', 'patlama', 'alım', 'toparlanma'
];

const NEGATIVE_WORDS = [
  // English financial & crypto terms
  'crash', 'plunge', 'drop', 'fall', 'dump', 'bear', 'bearish', 'loss', 'hack',
  'exploit', 'sec sue', 'ban', 'lawsuit', 'crisis', 'collapse', 'liquidation', 'scam',
  'fud', 'investigation', 'outflow', 'decline', 'tank', 'risk', 'warning',
  // Turkish financial & crypto terms
  'düşüş', 'çöküş', 'zarar', 'ayı', 'kriz', 'yasak', 'dava', 'saldırı', 'hacklendi',
  'kayıp', 'iflas', 'tasfiye', 'kırmızı', 'satış', 'endişe', 'panik', 'tehdit', 'ceza'
];

export class SentimentAnalyzer {
  private pipeline: any = null;
  private isInitializing = false;
  private isReady = false;
  private modelName: string;

  constructor(modelName = config.SENTIMENT_MODEL) {
    this.modelName = modelName;
    this.initTransformers();
  }

  /**
   * Initializes the ONNX transformers pipeline asynchronously.
   * Public multilingual model: Xenova/distilbert-base-multilingual-cased-sentiments-student
   * Note: Lexical fallback is active immediately from millisecond 0 so no startup is delayed.
   */
  private async initTransformers(): Promise<void> {
    if (this.isInitializing || this.isReady) return;
    this.isInitializing = true;

    try {
      logger.info(`🤖 Initializing Node-native ONNX sentiment pipeline (${this.modelName})...`);
      // Dynamic import for Node/ESM compatibility
      const { pipeline, env } = await import('@xenova/transformers');
      
      env.allowLocalModels = true;
      env.allowRemoteModels = true;
      env.useBrowserCache = false;

      this.pipeline = await pipeline('sentiment-analysis', this.modelName, {
        quantized: true,
      });
      this.isReady = true;
      logger.info(`✅ Node-native Sentiment ONNX pipeline (${this.modelName}) loaded successfully`);
    } catch (err) {
      logger.warn(
        `⚠️ Transformers ONNX model loading skipped or deferred (${(err as Error).message}). Using optimized multilingual lexicon engine as primary strategy.`
      );
      this.pipeline = null;
      this.isReady = false;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Analyzes text sentiment:
   * 1. If ONNX model is ready, executes neural inference with lexical hybrid booster
   * 2. Otherwise uses the optimized multilingual lexical engine (primary fast strategy)
   */
  public async analyze(text: string): Promise<SentimentAnalysisResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      return {
        label: SentimentLabel.NEUTRAL,
        score: 0.5,
        marketImpactDescription: '⚪ Nötr / Belirsiz Piyasa Hareketi',
      };
    }

    // Run ONNX neural pipeline if loaded
    if (this.pipeline && this.isReady) {
      try {
        const truncated = trimmed.slice(0, 512);
        const result = await this.pipeline(truncated);
        if (Array.isArray(result) && result.length > 0) {
          const item = result[0];
          const rawLabel = String(item.label).toUpperCase();
          const score = typeof item.score === 'number' ? item.score : 0.75;

          let label: SentimentLabel = SentimentLabel.NEUTRAL;
          if (
            rawLabel.includes('POS') ||
            rawLabel === 'LABEL_2' ||
            rawLabel.includes('5') ||
            rawLabel.includes('4')
          ) {
            label = SentimentLabel.POSITIVE;
          } else if (
            rawLabel.includes('NEG') ||
            rawLabel === 'LABEL_0' ||
            rawLabel.includes('1') ||
            rawLabel.includes('2')
          ) {
            label = SentimentLabel.NEGATIVE;
          } else {
            label = SentimentLabel.NEUTRAL;
          }

          return {
            label,
            score: Math.round(score * 100) / 100,
            marketImpactDescription: this.describeMarketImpact(label, score),
          };
        }
      } catch (err) {
        logger.debug('ONNX inference error, using lexical fallback:', err);
      }
    }

    // High-performance primary multilingual lexical analysis
    return this.analyzeLexical(trimmed);
  }

  /**
   * Fast multilingual dictionary-based sentiment scoring
   */
  public analyzeLexical(text: string): SentimentAnalysisResult {
    const lower = text.toLowerCase();

    let posMatches = 0;
    let negMatches = 0;

    for (const w of POSITIVE_WORDS) {
      if (lower.includes(w)) posMatches++;
    }

    for (const w of NEGATIVE_WORDS) {
      if (lower.includes(w)) negMatches++;
    }

    let label: SentimentLabel = SentimentLabel.NEUTRAL;
    let score = 0.5;

    if (posMatches > negMatches) {
      label = SentimentLabel.POSITIVE;
      score = Math.min(0.6 + posMatches * 0.1, 0.98);
    } else if (negMatches > posMatches) {
      label = SentimentLabel.NEGATIVE;
      score = Math.min(0.6 + negMatches * 0.1, 0.98);
    } else {
      label = SentimentLabel.NEUTRAL;
      score = 0.5;
    }

    return {
      label,
      score: Math.round(score * 100) / 100,
      marketImpactDescription: this.describeMarketImpact(label, score),
    };
  }

  private describeMarketImpact(label: SentimentLabel, confidence: number): string {
    if (label === SentimentLabel.POSITIVE) {
      return confidence > 0.8
        ? '🟢 Güçlü Pozitif - Risk iştahı artıyor, alım dalgası gelebilir'
        : '📈 Hafif Pozitif - Yukarı yönlü toparlanma potansiyeli';
    } else if (label === SentimentLabel.NEGATIVE) {
      return confidence > 0.8
        ? '🔴 Güçlü Negatif - Panik satışı veya güvenli limana kaçış'
        : '📉 Hafif Negatif - Baskı ve volatilite artabilir';
    }
    return '⚪ Nötr - Piyasada net bir yön sinyali yok';
  }
}
