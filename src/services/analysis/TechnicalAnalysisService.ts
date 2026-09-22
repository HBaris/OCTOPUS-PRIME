import { Candle } from '../../types/market.js';
import { IExchangeService } from '../exchange/IExchangeService.js';
import { logger } from '../../utils/logger.js';

export interface PivotPoints {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
  percentB: number;
}

export interface SupportResistanceAnalysis {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  pivots: PivotPoints;
  bollinger: BollingerBands;
  volume24hUsd: number;
  volumeBreakoutDetected: boolean;
  breakoutDirection: 'BULLISH_BREAKOUT' | 'BEARISH_BREAKOUT' | 'RANGE_BOUND';
  nearestSupport: number;
  nearestResistance: number;
  riskRewardRatio: number;
  strategySignal: 'BUY_BREAKOUT' | 'BUY_DIP_SUPPORT' | 'SELL_BREAKDOWN' | 'SELL_RESISTANCE' | 'WAIT';
  confidenceScore: number;
  timestamp: string;
}

export class TechnicalAnalysisService {
  private exchangeService: IExchangeService;

  constructor(exchangeService: IExchangeService) {
    this.exchangeService = exchangeService;
  }

  /**
   * Calculate Classic Pivot Points (High, Low, Close of the preceding period)
   */
  public calculatePivotPoints(high: number, low: number, close: number): PivotPoints {
    const pivot = (high + low + close) / 3;
    const r1 = 2 * pivot - low;
    const s1 = 2 * pivot - high;
    const r2 = pivot + (high - low);
    const s2 = pivot - (high - low);
    const r3 = high + 2 * (pivot - low);
    const s3 = low - 2 * (high - pivot);

    return {
      pivot: Number(pivot.toFixed(6)),
      r1: Number(r1.toFixed(6)),
      r2: Number(r2.toFixed(6)),
      r3: Number(r3.toFixed(6)),
      s1: Number(s1.toFixed(6)),
      s2: Number(s2.toFixed(6)),
      s3: Number(s3.toFixed(6)),
    };
  }

  /**
   * Calculate Bollinger Bands (20 periods, 2 standard deviations)
   */
  public calculateBollingerBands(closes: number[], period = 20, multiplier = 2): BollingerBands {
    if (closes.length < period) {
      const last = closes[closes.length - 1] || 0;
      return { upper: last * 1.02, middle: last, lower: last * 0.98, bandwidth: 0.04, percentB: 0.5 };
    }

    const slice = closes.slice(closes.length - period);
    const mean = slice.reduce((acc, val) => acc + val, 0) / period;
    const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const upper = mean + multiplier * stdDev;
    const lower = mean - multiplier * stdDev;
    const bandwidth = mean !== 0 ? (upper - lower) / mean : 0;
    const currentPrice = closes[closes.length - 1];
    const percentB = upper !== lower ? (currentPrice - lower) / (upper - lower) : 0.5;

    return {
      upper: Number(upper.toFixed(6)),
      middle: Number(mean.toFixed(6)),
      lower: Number(lower.toFixed(6)),
      bandwidth: Number(bandwidth.toFixed(4)),
      percentB: Number(percentB.toFixed(4)),
    };
  }

  /**
   * Perform comprehensive Support & Resistance Breakout Analysis for a symbol
   */
  public async analyzeSupportResistance(symbol: string, timeframe = '15m'): Promise<SupportResistanceAnalysis | null> {
    try {
      const candles = await this.exchangeService.fetchCandles(symbol, timeframe, 50);
      if (!candles || candles.length < 20) {
        return null;
      }

      const closes = candles.map((c: Candle) => c.close);
      const volumes = candles.map((c: Candle) => c.volume || 1);
      const currentPrice = closes[closes.length - 1];

      // Use recent period extremes for Pivot Point calculation
      const recentCandles = candles.slice(-24);
      const high = Math.max(...recentCandles.map((c: Candle) => c.high));
      const low = Math.min(...recentCandles.map((c: Candle) => c.low));
      const close = recentCandles[recentCandles.length - 1].close;

      const pivots = this.calculatePivotPoints(high, low, close);
      const bollinger = this.calculateBollingerBands(closes, 20, 2);

      // Volume surge check (current volume vs 20-period avg)
      const recentVolume = volumes[volumes.length - 1];
      const avgVolume = volumes.slice(-20, -1).reduce((a, b) => a + b, 0) / 19 || 1;
      const volumeRatio = recentVolume / avgVolume;
      const volumeBreakoutDetected = volumeRatio >= 2.0;

      // Identify nearest Support and Resistance
      const supports = [pivots.s3, pivots.s2, pivots.s1, pivots.pivot].filter((s) => s < currentPrice);
      const resistances = [pivots.pivot, pivots.r1, pivots.r2, pivots.r3].filter((r) => r > currentPrice);

      const nearestSupport = supports.length > 0 ? Math.max(...supports) : currentPrice * 0.98;
      const nearestResistance = resistances.length > 0 ? Math.min(...resistances) : currentPrice * 1.02;

      // Distance & Risk/Reward Calculation
      const distToSupport = Math.max(0.0001, currentPrice - nearestSupport);
      const distToResistance = Math.max(0.0001, nearestResistance - currentPrice);
      const riskRewardRatio = Number((distToResistance / distToSupport).toFixed(2));

      // Strategy determination
      let breakoutDirection: 'BULLISH_BREAKOUT' | 'BEARISH_BREAKOUT' | 'RANGE_BOUND' = 'RANGE_BOUND';
      let strategySignal: 'BUY_BREAKOUT' | 'BUY_DIP_SUPPORT' | 'SELL_BREAKDOWN' | 'SELL_RESISTANCE' | 'WAIT' = 'WAIT';
      let confidenceScore = 50;

      if (currentPrice >= pivots.r1 && volumeBreakoutDetected) {
        breakoutDirection = 'BULLISH_BREAKOUT';
        strategySignal = 'BUY_BREAKOUT';
        confidenceScore = Math.min(92, Math.round(75 + volumeRatio * 4));
      } else if (currentPrice <= pivots.s1 && volumeBreakoutDetected) {
        breakoutDirection = 'BEARISH_BREAKOUT';
        strategySignal = 'SELL_BREAKDOWN';
        confidenceScore = Math.min(92, Math.round(75 + volumeRatio * 4));
      } else if (currentPrice <= nearestSupport * 1.004 && bollinger.percentB <= 0.15) {
        // Bouncing off support with oversold Bollinger
        breakoutDirection = 'RANGE_BOUND';
        strategySignal = 'BUY_DIP_SUPPORT';
        confidenceScore = 78;
      } else if (currentPrice >= nearestResistance * 0.996 && bollinger.percentB >= 0.85) {
        // Rejection at resistance with overbought Bollinger
        breakoutDirection = 'RANGE_BOUND';
        strategySignal = 'SELL_RESISTANCE';
        confidenceScore = 78;
      }

      const ticker = await this.exchangeService.fetchTicker(symbol).catch(() => ({ volume24h: 1000000 }));

      return {
        symbol,
        timeframe,
        currentPrice,
        pivots,
        bollinger,
        volume24hUsd: (ticker as any).volume24h || avgVolume * currentPrice * 24,
        volumeBreakoutDetected,
        breakoutDirection,
        nearestSupport,
        nearestResistance,
        riskRewardRatio,
        strategySignal,
        confidenceScore,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      logger.debug(`[TechnicalAnalysisService] Error analyzing S/R for ${symbol}: ${(err as Error).message}`);
      return null;
    }
  }
}
