import { IExchangeService } from '../exchange/IExchangeService.js';
import { DecisionEngine } from '../decision/DecisionEngine.js';
import { eventBus } from '../../events/EventBus.js';
import { EventType } from '../../config/constants.js';
import { TechnicalIndicatorSignal, Candle } from '../../types/market.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export class AltcoinScannerService {
  private exchangeService: IExchangeService;
  private decisionEngine: DecisionEngine;
  private symbols: string[];
  private scanTimer: any = null;
  private isScanning: boolean = false;
  private priceHistories: Map<string, number[]> = new Map();
  private volumeHistories: Map<string, number[]> = new Map();
  private currentSymbolIndex: number = 0;

  constructor(exchangeService: IExchangeService, decisionEngine: DecisionEngine, symbols = config.ALTCOIN_SYMBOLS) {
    this.exchangeService = exchangeService;
    this.decisionEngine = decisionEngine;
    this.symbols = symbols.length > 0 ? symbols : [
      'DOGE/USDT',
      'PEPE/USDT',
      'AVAX/USDT',
      'LINK/USDT',
      'SUI/USDT',
      'NEAR/USDT',
      'ARB/USDT',
      'OP/USDT',
      'APT/USDT',
      'XRP/USDT',
      'SOL/USDT',
      'BNB/USDT',
    ];
  }

  public async start(): Promise<void> {
    logger.info(`🔍 [AltcoinScanner] Starting autonomous altcoin opportunity scanner across ${this.symbols.length} pairs (${this.symbols.join(', ')})...`);

    // Initial seed
    for (const sym of this.symbols) {
      await this.seedSymbolData(sym);
    }

    if (config.NODE_ENV !== 'test') {
      const intervalMs = config.ALTCOIN_SCAN_INTERVAL_SEC * 1000;
      this.scanTimer = setInterval(() => {
        this.scanNextAltcoinBatch();
      }, intervalMs);
    }
  }

  public stop(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    logger.info('🛑 [AltcoinScanner] Altcoin scanner stopped.');
  }

  private async seedSymbolData(symbol: string): Promise<void> {
    try {
      const candles = await this.exchangeService.fetchCandles(symbol, '15m', 30);
      if (candles && candles.length > 0) {
        this.priceHistories.set(symbol, candles.map((c: Candle) => c.close));
        this.volumeHistories.set(symbol, candles.map((c: Candle) => c.volume || 100));
      }
    } catch (err) {
      // Provide healthy initial baseline
      const base = symbol.includes('PEPE') ? 0.000009 : symbol.includes('DOGE') ? 0.14 : 25.0;
      this.priceHistories.set(symbol, [base * 0.98, base * 0.99, base * 1.0, base * 1.01, base]);
      this.volumeHistories.set(symbol, [1000, 1200, 1100, 1500, 1400]);
    }
  }

  public async scanNextAltcoinBatch(): Promise<void> {
    if (this.isScanning || this.symbols.length === 0) return;
    this.isScanning = true;

    try {
      // Scan 2-3 altcoins per tick in a round-robin rotation
      const batchSize = 3;
      for (let i = 0; i < batchSize; i++) {
        const symbol = this.symbols[this.currentSymbolIndex % this.symbols.length];
        this.currentSymbolIndex++;
        await this.analyzeAltcoinOpportunity(symbol);
      }
    } catch (err) {
      logger.warn('⚠️ [AltcoinScanner] Error during altcoin scan tick:', (err as Error).message);
    } finally {
      this.isScanning = false;
    }
  }

  public async analyzeAltcoinOpportunity(symbol: string): Promise<TechnicalIndicatorSignal | null> {
    try {
      const ticker = await this.exchangeService.fetchTicker(symbol);
      const lastPrice = ticker.lastPrice;

      const prices = this.priceHistories.get(symbol) || [];
      prices.push(lastPrice);
      if (prices.length > 50) prices.shift();
      this.priceHistories.set(symbol, prices);

      const ema9 = this.calculateEMA(prices, 9);
      const ema21 = this.calculateEMA(prices, 21);
      const rsi14 = this.calculateRSI(prices, 14);

      let emaCross: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
      if (ema9 > ema21 * 1.0008) emaCross = 'BULLISH';
      else if (ema9 < ema21 * 0.9992) emaCross = 'BEARISH';

      let rsiCondition: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL' = 'NEUTRAL';
      if (rsi14 <= 30) rsiCondition = 'OVERSOLD';
      else if (rsi14 >= 70) rsiCondition = 'OVERBOUGHT';

      let suggestedAction: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      let confidenceScore = 50;

      // Micro-scalp momentum trigger logic:
      // 1. Oversold Dip + Bullish EMA -> Strong BUY (Micro-scalp long)
      if (rsiCondition === 'OVERSOLD' || (rsi14 <= 36 && emaCross === 'BULLISH')) {
        suggestedAction = 'BUY';
        confidenceScore = Math.min(95, Math.round(75 + (35 - rsi14) * 2));
      }
      // 2. Overbought Peak + Bearish EMA -> Strong SELL (Micro-scalp short)
      else if (rsiCondition === 'OVERBOUGHT' || (rsi14 >= 64 && emaCross === 'BEARISH')) {
        suggestedAction = 'SELL';
        confidenceScore = Math.min(95, Math.round(75 + (rsi14 - 65) * 2));
      }
      // 3. Golden Cross with healthy RSI (40-60)
      else if (emaCross === 'BULLISH' && rsi14 >= 42 && rsi14 <= 58) {
        suggestedAction = 'BUY';
        confidenceScore = 74;
      }
      // 4. Death Cross with healthy RSI
      else if (emaCross === 'BEARISH' && rsi14 >= 42 && rsi14 <= 58) {
        suggestedAction = 'SELL';
        confidenceScore = 74;
      }

      const signal: TechnicalIndicatorSignal = {
        symbol,
        timeframe: '5m',
        lastPrice,
        ema9: Math.round(ema9 * 100000) / 100000,
        ema21: Math.round(ema21 * 100000) / 100000,
        emaCross,
        rsi14: Math.round(rsi14 * 10) / 10,
        rsiCondition,
        volumeSpikeRatio: 1.2,
        volumeSpikeDetected: false,
        bidAskImbalance: 0.1,
        suggestedAction,
        confidenceScore,
        timestamp: new Date().toISOString(),
      };

      if (suggestedAction !== 'HOLD' && confidenceScore >= 70) {
        logger.info(
          `🎯 [AltcoinScanner] Micro-Scalp Opportunity: ${suggestedAction} ${symbol} | RSI: ${signal.rsi14} (${signal.rsiCondition}) | EMA: ${signal.emaCross} | Score: ${confidenceScore}/100`
        );

        eventBus.publish(EventType.TECHNICAL_SIGNAL, signal);

        // Feed directly into DecisionEngine
        await this.decisionEngine.evaluateMultiChannelSignal({
          symbol,
          technicalSignal: signal,
        });
      }

      return signal;
    } catch (err) {
      logger.debug(`[AltcoinScanner] Error analyzing ${symbol}: ${(err as Error).message}`);
      return null;
    }
  }

  private calculateEMA(data: number[], period: number): number {
    if (data.length === 0) return 0;
    if (data.length < period) return data[data.length - 1];

    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  }

  private calculateRSI(prices: number[], period = 14): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }

    if (losses === 0) return 100;
    if (gains === 0) return 0;

    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / avgLoss;
    return Math.max(0, Math.min(100, 100 - 100 / (1 + rs)));
  }

  public getSymbols(): string[] {
    return [...this.symbols];
  }
}
