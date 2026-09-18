import { IExchangeService } from '../exchange/IExchangeService.js';
import { eventBus } from '../../events/EventBus.js';
import { EventType } from '../../config/constants.js';
import { TechnicalIndicatorSignal, Candle } from '../../types/market.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export class MarketStreamService {
  private exchangeService: IExchangeService;
  private intervalTimer: any = null;
  private symbols: string[];
  private priceHistory: Map<string, number[]> = new Map();
  private volumeHistory: Map<string, number[]> = new Map();
  private lastSignals: Map<string, TechnicalIndicatorSignal> = new Map();

  constructor(exchangeService: IExchangeService, symbols: string[] = config.MARKET_STREAM_SYMBOLS) {
    this.exchangeService = exchangeService;
    this.symbols = symbols.length > 0 ? symbols : ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
  }

  public async start(): Promise<void> {
    logger.info(`📡 [MarketStreamService] Starting real-time indicator streaming for ${this.symbols.join(', ')}...`);
    
    // Seed initial price and volume history from candles
    for (const symbol of this.symbols) {
      await this.seedHistoricalData(symbol);
    }

    if (config.NODE_ENV !== 'test') {
      // 5-second interval for fast real-time indicator evaluation
      this.intervalTimer = setInterval(() => {
        this.evaluateAllSymbols();
      }, 5000);
    }
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    logger.info('🛑 [MarketStreamService] Stream stopped.');
  }

  public async seedHistoricalData(symbol: string): Promise<void> {
    try {
      const candles = await this.exchangeService.fetchCandles(symbol, '15m', 50);
      if (candles && candles.length > 0) {
        this.priceHistory.set(
          symbol,
          candles.map((c) => c.close)
        );
        this.volumeHistory.set(
          symbol,
          candles.map((c) => c.volume || 10)
        );
      }
    } catch (err) {
      logger.warn(`⚠️ [MarketStreamService] Could not seed candles for ${symbol}, using default mock history.`);
      this.priceHistory.set(symbol, [67000, 67200, 67100, 67400, 67350, 67500, 67800, 68000, 68200, 68500]);
      this.volumeHistory.set(symbol, [100, 120, 95, 110, 105, 130, 150, 200, 180, 220]);
    }
  }

  public async evaluateSymbol(symbol: string, currentPriceOverride?: number): Promise<TechnicalIndicatorSignal> {
    let lastPrice = currentPriceOverride;
    if (!lastPrice) {
      const ticker = await this.exchangeService.fetchTicker(symbol);
      lastPrice = ticker.lastPrice;
    }

    // Maintain prices array
    const prices = this.priceHistory.get(symbol) || [];
    prices.push(lastPrice);
    if (prices.length > 60) prices.shift();
    this.priceHistory.set(symbol, prices);

    // Compute indicators
    const ema9 = this.calculateEMA(prices, 9);
    const ema21 = this.calculateEMA(prices, 21);
    const rsi14 = this.calculateRSI(prices, 14);

    let emaCross: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (ema9 > ema21 * 1.0005) emaCross = 'BULLISH';
    else if (ema9 < ema21 * 0.9995) emaCross = 'BEARISH';

    let rsiCondition: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL' = 'NEUTRAL';
    if (rsi14 <= 32) rsiCondition = 'OVERSOLD';
    else if (rsi14 >= 68) rsiCondition = 'OVERBOUGHT';

    // Volume spike detection
    const volumes = this.volumeHistory.get(symbol) || [100, 100, 100];
    const avgVol = volumes.reduce((a, b) => a + b, 0) / (volumes.length || 1);
    const latestVol = volumes[volumes.length - 1] || avgVol;
    const volumeSpikeRatio = avgVol > 0 ? latestVol / avgVol : 1.0;
    const volumeSpikeDetected = volumeSpikeRatio >= 1.8;

    // Simulated Orderbook Imbalance based on recent momentum
    const recentDelta = prices.length >= 2 ? (lastPrice - prices[prices.length - 2]) / prices[prices.length - 2] : 0;
    const bidAskImbalance = Math.max(-1.0, Math.min(1.0, Math.round(recentDelta * 200 * 100) / 100));

    // Calculate Technical Confidence Score (0 - 100)
    let score = 50;
    let suggestedAction: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    if (emaCross === 'BULLISH') score += 20;
    if (emaCross === 'BEARISH') score -= 20;

    if (rsiCondition === 'OVERSOLD') {
      score += 15; // Mean reversion buy signal
    } else if (rsiCondition === 'OVERBOUGHT') {
      score -= 15; // Mean reversion sell signal
    }

    if (volumeSpikeDetected) {
      if (score > 50) score += 15;
      else if (score < 50) score -= 15;
    }

    if (bidAskImbalance > 0.3) score += 10;
    else if (bidAskImbalance < -0.3) score -= 10;

    score = Math.max(0, Math.min(100, score));

    if (score >= 65) {
      suggestedAction = 'BUY';
    } else if (score <= 35) {
      suggestedAction = 'SELL';
    } else {
      suggestedAction = 'HOLD';
    }

    const signal: TechnicalIndicatorSignal = {
      symbol,
      timeframe: '15m',
      lastPrice,
      ema9: Math.round(ema9 * 100) / 100,
      ema21: Math.round(ema21 * 100) / 100,
      emaCross,
      rsi14: Math.round(rsi14 * 10) / 10,
      rsiCondition,
      volumeSpikeRatio: Math.round(volumeSpikeRatio * 100) / 100,
      volumeSpikeDetected,
      bidAskImbalance,
      suggestedAction,
      confidenceScore: score,
      timestamp: new Date().toISOString(),
    };

    this.lastSignals.set(symbol, signal);
    eventBus.publish(EventType.TECHNICAL_SIGNAL, signal);

    return signal;
  }

  public async evaluateAllSymbols(): Promise<TechnicalIndicatorSignal[]> {
    const results: TechnicalIndicatorSignal[] = [];
    for (const sym of this.symbols) {
      try {
        const sig = await this.evaluateSymbol(sym);
        results.push(sig);
      } catch (err) {
        logger.warn(`⚠️ [MarketStreamService] Error evaluating ${sym}:`, err);
      }
    }
    return results;
  }

  public getLastSignal(symbol: string): TechnicalIndicatorSignal | undefined {
    return this.lastSignals.get(symbol);
  }

  public getAllSignals(): TechnicalIndicatorSignal[] {
    return Array.from(this.lastSignals.values());
  }

  // --- TA Math Utilities ---
  public calculateEMA(data: number[], period: number): number {
    if (!data || data.length === 0) return 0;
    if (data.length < period) return data[data.length - 1];

    const k = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }

    return ema;
  }

  public calculateRSI(data: number[], period: number = 14): number {
    if (!data || data.length <= period) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = data[i] - data[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i] - data[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }
}
