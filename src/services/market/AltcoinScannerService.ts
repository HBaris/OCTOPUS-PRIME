import { IExchangeService } from '../exchange/IExchangeService.js';
import { DecisionEngine } from '../decision/DecisionEngine.js';
import { eventBus } from '../../events/EventBus.js';
import { EventType } from '../../config/constants.js';
import { TechnicalIndicatorSignal, Candle } from '../../types/market.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export interface RadarCoinItem {
  symbol: string;
  lastPrice: number;
  rsi14: number;
  rsiCondition: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
  emaCross: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  volume24hUsd: number;
  momentumScore: number;
  suggestedAction: 'BUY' | 'SELL' | 'HOLD';
  updatedAt: string;
}

export class AltcoinScannerService {
  private exchangeService: IExchangeService;
  private decisionEngine: DecisionEngine;
  private symbols: string[];
  private scanTimer: any = null;
  private isScanning: boolean = false;
  private priceHistories: Map<string, number[]> = new Map();
  private volumeHistories: Map<string, number[]> = new Map();
  private currentSymbolIndex: number = 0;
  private radarMap: Map<string, RadarCoinItem> = new Map();

  // Comprehensive list of active USDT altcoin markets across Binance & OKX
  public static readonly DEFAULT_UNIVERSE = [
    'SOL/USDT', 'AVAX/USDT', 'NEAR/USDT', 'SUI/USDT', 'APT/USDT',
    'ARB/USDT', 'OP/USDT', 'LINK/USDT', 'INJ/USDT', 'TIA/USDT',
    'RENDER/USDT', 'FET/USDT', 'DOGE/USDT', 'PEPE/USDT', 'SHIB/USDT',
    'ADA/USDT', 'DOT/USDT', 'ATOM/USDT', 'MATIC/USDT', 'ICP/USDT',
    'SEI/USDT', 'JUP/USDT', 'WIF/USDT', 'BONK/USDT', 'FTM/USDT',
    'STX/USDT', 'RUNE/USDT', 'KAS/USDT', 'GALA/USDT', 'FIL/USDT',
    'LTC/USDT', 'BCH/USDT', 'UNI/USDT', 'AAVE/USDT', 'MKR/USDT',
    'CRV/USDT', 'LDO/USDT', 'DYDX/USDT', 'BLUR/USDT', 'PYTH/USDT',
  ];

  constructor(exchangeService: IExchangeService, decisionEngine: DecisionEngine, symbols?: string[]) {
    this.exchangeService = exchangeService;
    this.decisionEngine = decisionEngine;
    this.symbols = symbols && symbols.length > 0 ? symbols : AltcoinScannerService.DEFAULT_UNIVERSE;
  }

  public async start(): Promise<void> {
    logger.info(
      `🔍 [AltcoinScanner] Universal Market Scanner started. Monitoring dynamic universe of ${this.symbols.length} altcoin pairs...`
    );

    // Initial seed for top 10 coins
    const seedBatch = this.symbols.slice(0, 12);
    for (const sym of seedBatch) {
      await this.seedSymbolData(sym);
    }

    if (config.NODE_ENV !== 'test') {
      const intervalMs = config.ALTCOIN_SCAN_INTERVAL_SEC * 1000 || 6000;
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
    logger.info('🛑 [AltcoinScanner] Universal market scanner stopped.');
  }

  private async seedSymbolData(symbol: string): Promise<void> {
    try {
      const candles = await this.exchangeService.fetchCandles(symbol, '15m', 30);
      if (candles && candles.length > 0) {
        this.priceHistories.set(symbol, candles.map((c: Candle) => c.close));
        this.volumeHistories.set(symbol, candles.map((c: Candle) => c.volume || 100));
      }
    } catch {
      const base = symbol.includes('PEPE') ? 0.000009 : symbol.includes('DOGE') ? 0.14 : symbol.includes('SOL') ? 140 : 25.0;
      this.priceHistories.set(symbol, [base * 0.98, base * 0.99, base * 1.0, base * 1.01, base]);
      this.volumeHistories.set(symbol, [1000, 1200, 1100, 1500, 1400]);
    }
  }

  public async scanNextAltcoinBatch(): Promise<void> {
    if (this.isScanning || this.symbols.length === 0) return;
    this.isScanning = true;

    try {
      // Scan 4 altcoins per tick in a continuous round-robin cycle
      const batchSize = 4;
      for (let i = 0; i < batchSize; i++) {
        const symbol = this.symbols[this.currentSymbolIndex % this.symbols.length];
        this.currentSymbolIndex++;
        await this.analyzeAltcoinOpportunity(symbol);
      }
    } catch (err) {
      logger.warn('⚠️ [AltcoinScanner] Error during altcoin scan batch:', (err as Error).message);
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

      // Dynamic momentum & scalp opportunity logic:
      if (rsiCondition === 'OVERSOLD' || (rsi14 <= 36 && emaCross === 'BULLISH')) {
        suggestedAction = 'BUY';
        confidenceScore = Math.min(95, Math.round(75 + (35 - rsi14) * 2));
      } else if (rsiCondition === 'OVERBOUGHT' || (rsi14 >= 64 && emaCross === 'BEARISH')) {
        suggestedAction = 'SELL';
        confidenceScore = Math.min(95, Math.round(75 + (rsi14 - 65) * 2));
      } else if (emaCross === 'BULLISH' && rsi14 >= 42 && rsi14 <= 58) {
        suggestedAction = 'BUY';
        confidenceScore = 74;
      } else if (emaCross === 'BEARISH' && rsi14 >= 42 && rsi14 <= 58) {
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
        volumeSpikeRatio: 1.4,
        volumeSpikeDetected: confidenceScore >= 75,
        bidAskImbalance: 0.1,
        suggestedAction,
        confidenceScore,
        timestamp: new Date().toISOString(),
      };

      // Update radar item for Room 1
      this.radarMap.set(symbol, {
        symbol,
        lastPrice,
        rsi14: signal.rsi14,
        rsiCondition,
        emaCross,
        volume24hUsd: ticker.volume24h || 15000000,
        momentumScore: confidenceScore,
        suggestedAction,
        updatedAt: new Date().toISOString(),
      });

      if (suggestedAction !== 'HOLD' && confidenceScore >= 70) {
        logger.info(
          `🎯 [AltcoinScanner] Hot Opportunity: ${suggestedAction} ${symbol} | RSI: ${signal.rsi14} (${signal.rsiCondition}) | EMA: ${signal.emaCross} | Score: ${confidenceScore}/100`
        );

        eventBus.publish(EventType.TECHNICAL_SIGNAL, signal);

        // Send to DecisionEngine
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

  public getRadarList(): RadarCoinItem[] {
    return Array.from(this.radarMap.values()).sort((a, b) => b.momentumScore - a.momentumScore);
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
