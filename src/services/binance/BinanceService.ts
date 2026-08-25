import { config } from '../../config/index.js';
import {
  WalletBalance,
  PortfolioBalance,
  PositionInfo,
  Position,
  SimulatedOrder,
  MarketTicker,
  Candle,
  ChartCandle,
  OrderRequest,
  OrderResult,
} from '../../types/market.js';
import { IExchangeService, FundingRateInfo } from '../exchange/IExchangeService.js';
import { eventBus } from '../../events/EventBus.js';
import { EventType } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

export class BinanceService implements IExchangeService {
  private client: any = null;
  private isTestnet: boolean;
  private simulatedOrders: SimulatedOrder[] = [];
  private simulatedPositions: Map<string, PositionInfo> = new Map();
  private mockBalanceUsdt = 10000.0;
  private clientInitPromise: Promise<void> | null = null;
  private pollerTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.isTestnet = config.BINANCE_TESTNET;
    this.clientInitPromise = this.initClient();
    if (config.NODE_ENV !== 'test') {
      this.startPricePoller();
    }
  }

  private async initClient(): Promise<void> {
    try {
      if (config.BINANCE_API_KEY && config.BINANCE_API_SECRET) {
        // Dynamic import to seamlessly support ESM in all environments
        const ccxtModule = await import('ccxt');
        const BinanceClass = (ccxtModule as any).default?.binance || (ccxtModule as any).binance;

        if (BinanceClass) {
          this.client = new BinanceClass({
            apiKey: config.BINANCE_API_KEY,
            secret: config.BINANCE_API_SECRET,
            enableRateLimit: true,
            options: {
              defaultType: 'future', // Testnet futures or spot
              adjustForTimeDifference: true,
            },
          });

          if (this.isTestnet) {
            this.client.setSandboxMode(true);
            logger.info('🔶 Binance CCXT initialized in TESTNET (Sandbox) mode');
          } else {
            logger.warn('🚨 Binance CCXT initialized in PRODUCTION mode');
          }
        }
      } else {
        logger.info('ℹ️ Binance API keys not provided in .env — using local Testnet Simulation engine (10,000 USDT virtual)');
      }
    } catch (err) {
      logger.warn('⚠️ CCXT client initialization deferred or using simulation mode:', (err as Error).message);
      this.client = null;
    }
  }

  public getIsSimulation(): boolean {
    return !config.ENABLE_REAL_ORDERS || !this.client;
  }

  public async fetchBalance(): Promise<PortfolioBalance> {
    return this.getBalance();
  }

  public async getBalance(): Promise<WalletBalance> {
    if (this.clientInitPromise) await this.clientInitPromise;

    if (this.client && config.BINANCE_API_KEY) {
      try {
        const rawBalance = await this.client.fetchBalance();
        const freeRecord = (rawBalance.free || {}) as Record<string, number | undefined>;
        const totalRecord = (rawBalance.total || {}) as Record<string, number | undefined>;
        const usedRecord = (rawBalance.used || {}) as Record<string, number | undefined>;

        const freeUsdt = Number(freeRecord['USDT'] ?? 0);
        const totalUsdt = Number(totalRecord['USDT'] ?? 0);

        const assets: Record<string, { free: number; used: number; total: number; valueUsd: number }> = {};
        for (const [coin, val] of Object.entries(totalRecord)) {
          const totalVal = Number(val ?? 0);
          if (totalVal > 0) {
            assets[coin] = {
              free: Number(freeRecord[coin] ?? 0),
              used: Number(usedRecord[coin] ?? 0),
              total: totalVal,
              valueUsd: coin === 'USDT' ? totalVal : 0,
            };
          }
        }

        return {
          totalUsd: totalUsdt,
          freeUsdt: freeUsdt,
          assets,
        };
      } catch (err) {
        logger.warn('⚠️ Error fetching live Binance balance, using simulated fallback:', (err as Error).message);
      }
    }

    // Return simulated balance
    let positionsValue = 0;
    for (const pos of this.simulatedPositions.values()) {
      positionsValue += pos.amount * pos.markPrice;
    }

    return {
      totalUsd: Math.round((this.mockBalanceUsdt + positionsValue) * 100) / 100,
      freeUsdt: Math.round(this.mockBalanceUsdt * 100) / 100,
      assets: {
        USDT: {
          free: this.mockBalanceUsdt,
          used: positionsValue,
          total: this.mockBalanceUsdt + positionsValue,
          valueUsd: this.mockBalanceUsdt + positionsValue,
        },
      },
    };
  }

  public async fetchPositions(): Promise<Position[]> {
    return this.getPositions();
  }

  public async getPositions(): Promise<PositionInfo[]> {
    if (this.clientInitPromise) await this.clientInitPromise;

    if (this.client && config.BINANCE_API_KEY) {
      try {
        const positions = await this.client.fetchPositions();
        return positions.map((p: any) => ({
          symbol: p.symbol || '',
          amount: Number(p.contracts ?? p.amount ?? 0),
          entryPrice: Number(p.entryPrice ?? 0),
          markPrice: Number(p.markPrice ?? 0),
          unrealizedPnl: Number(p.unrealizedPnl ?? 0),
          percentagePnl: Number(p.percentage ?? 0),
          liquidationPrice: p.liquidationPrice ? Number(p.liquidationPrice) : undefined,
          side: (p.side?.toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG') as 'LONG' | 'SHORT',
          leverage: p.leverage ? Number(p.leverage) : config.DEFAULT_LEVERAGE,
          marginMode: p.marginType?.toLowerCase() === 'cross' ? 'cross' : 'isolated',
          marginUsed: p.initialMargin ? Number(p.initialMargin) : undefined,
        }));
      } catch (err) {
        logger.warn('⚠️ Could not fetch exchange positions, using simulated positions');
      }
    }

    return Array.from(this.simulatedPositions.values());
  }

  public async fetchTicker(symbol: string): Promise<MarketTicker> {
    return this.getTicker(symbol);
  }

  public async getTicker(symbol: string): Promise<MarketTicker> {
    if (this.clientInitPromise) await this.clientInitPromise;
    const formattedSymbol = symbol.includes('/') ? symbol : `${symbol}/USDT`;

    if (this.client) {
      try {
        const ticker = await this.client.fetchTicker(formattedSymbol);
        return {
          symbol: formattedSymbol,
          lastPrice: Number(ticker.last ?? ticker.close ?? 0),
          bid: Number(ticker.bid ?? ticker.last ?? 0),
          ask: Number(ticker.ask ?? ticker.last ?? 0),
          change24hPercent: Number(ticker.percentage ?? 0),
          volume24h: Number(ticker.baseVolume ?? 0),
          timestamp: ticker.timestamp ?? Date.now(),
        };
      } catch (err) {
        logger.debug(`Could not fetch live ticker for ${formattedSymbol}: ${(err as Error).message}`);
      }
    }

    // Default mock ticker
    const basePrices: Record<string, number> = {
      'BTC/USDT': 68500.0,
      'ETH/USDT': 3450.0,
      'SOL/USDT': 185.0,
      'BNB/USDT': 590.0,
    };
    const price = basePrices[formattedSymbol] ?? 100.0;

    return {
      symbol: formattedSymbol,
      lastPrice: price,
      bid: price * 0.999,
      ask: price * 1.001,
      change24hPercent: 1.85,
      volume24h: 15420.5,
      timestamp: Date.now(),
    };
  }

  public async getCandles(symbol: string, timeframe = '15m', limit = 20): Promise<Candle[]> {
    if (this.clientInitPromise) await this.clientInitPromise;
    const formattedSymbol = symbol.includes('/') ? symbol : `${symbol}/USDT`;

    if (this.client) {
      try {
        const ohlcv = await this.client.fetchOHLCV(formattedSymbol, timeframe, undefined, limit);
        return ohlcv.map(([ts, o, h, l, c, v]: any) => ({
          timestamp: Number(ts),
          open: Number(o),
          high: Number(h),
          low: Number(l),
          close: Number(c),
          volume: Number(v),
        }));
      } catch (err) {
        logger.debug(`Could not fetch live OHLCV for ${formattedSymbol}`);
      }
    }

    // Generate deterministic simulated candles
    const now = Date.now();
    const intervalMs = 15 * 60 * 1000;
    const candles: Candle[] = [];
    let current = 68000;

    for (let i = limit; i >= 0; i--) {
      const ts = now - i * intervalMs;
      const variation = (Math.sin(i) + (Math.random() - 0.5)) * 150;
      const open = current;
      const close = current + variation;
      const high = Math.max(open, close) + 50;
      const low = Math.min(open, close) - 50;
      candles.push({
        timestamp: ts,
        open,
        high,
        low,
        close,
        volume: 250 + Math.abs(variation) * 2,
      });
      current = close;
    }

    return candles;
  }

  public async fetchCandles(
    symbol: string,
    timeframe = '15m',
    limit = 100
  ): Promise<Candle[] | any> {
    return this.getCandles(symbol, timeframe, limit);
  }

  public async fetchChartCandles(
    symbol: string,
    timeframe = '15m',
    limit = 100
  ): Promise<ChartCandle[]> {
    const rawCandles = await this.getCandles(symbol, timeframe, limit);
    return rawCandles.map((c) => ({
      time: Math.floor(c.timestamp / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
  }

  /**
   * Leverage Setting (Binance Futures / Spot Testnet compatibility)
   */
  public async setLeverage(
    symbol: string,
    leverage: number,
    marginMode: 'isolated' | 'cross' = 'isolated'
  ): Promise<void> {
    if (this.clientInitPromise) await this.clientInitPromise;
    const formattedSymbol = symbol.includes('/') ? symbol : `${symbol}/USDT`;

    if (this.client && config.ENABLE_REAL_ORDERS) {
      try {
        if (typeof this.client.setLeverage === 'function') {
          await this.client.setLeverage(leverage, formattedSymbol);
        }
        if (typeof this.client.setMarginMode === 'function') {
          await this.client.setMarginMode(marginMode, formattedSymbol);
        }
        logger.info(`🔶 [BinanceService] Leverage set to ${leverage}x (${marginMode}) for ${formattedSymbol}`);
        return;
      } catch (err) {
        logger.warn(
          `⚠️ [BinanceService] Live setLeverage not supported on this endpoint (${(err as Error).message}). Simulating leverage.`
        );
      }
    }
    logger.info(`ℹ️ [BinanceService] Simulated leverage set to ${leverage}x (${marginMode}) for ${formattedSymbol}`);
  }

  /**
   * Liquidation Price Calculation
   * Standard isolated margin formulas:
   * LONG:  Liq = Entry * (1 - 1/leverage + maintenanceMarginRate)
   * SHORT: Liq = Entry * (1 + 1/leverage - maintenanceMarginRate)
   */
  public calculateLiquidationPrice(
    _symbol: string,
    entryPrice: number,
    leverage: number,
    side: 'LONG' | 'SHORT',
    _marginMode: string = 'isolated'
  ): number {
    const maintenanceMarginRate = 0.005; // 0.5% default maintenance margin rate
    const lev = Math.max(1, leverage);

    if (side === 'LONG') {
      const liq = entryPrice * (1 - 1 / lev + maintenanceMarginRate);
      return Math.max(0, Math.round(liq * 100) / 100);
    } else {
      const liq = entryPrice * (1 + 1 / lev - maintenanceMarginRate);
      return Math.round(liq * 100) / 100;
    }
  }

  public async fetchFundingRate(symbol: string): Promise<FundingRateInfo> {
    if (this.clientInitPromise) await this.clientInitPromise;
    const formattedSymbol = symbol.includes('/') ? symbol : `${symbol}/USDT`;

    if (this.client) {
      try {
        if (typeof this.client.fetchFundingRate === 'function') {
          const fr = await this.client.fetchFundingRate(formattedSymbol);
          return {
            rate: Number(fr.fundingRate ?? 0.0001),
            nextFundingTime: fr.fundingTimestamp ? new Date(fr.fundingTimestamp) : this.getNextFundingInterval(),
          };
        }
      } catch (err) {
        logger.debug(`[BinanceService] fetchFundingRate fallback: ${(err as Error).message}`);
      }
    }

    return {
      rate: 0.0001, // 0.01% standard 8-hour rate
      nextFundingTime: this.getNextFundingInterval(),
    };
  }

  private getNextFundingInterval(): Date {
    const d = new Date();
    const utcHours = d.getUTCHours();
    const nextInterval = Math.ceil((utcHours + 1) / 8) * 8;
    d.setUTCHours(nextInterval % 24, 0, 0, 0);
    if (nextInterval >= 24) d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }

  public async getMaxLeverage(_symbol: string): Promise<number> {
    return 20; // Default placeholder for Binance testnet
  }

  /**
   * Unified executeOrder method implementing IExchangeService
   */
  public async executeOrder(
    reqOrSymbol: OrderRequest | string,
    sideArg?: 'BUY' | 'SELL',
    amountUsdArg?: number,
    orderTypeArg: 'MARKET' | 'LIMIT' = 'MARKET',
    metadataArg?: {
      signalId?: string;
      sourceCategory?: string;
      stopLoss?: number;
      takeProfit?: number;
      leverage?: number;
      marginMode?: 'isolated' | 'cross';
    }
  ): Promise<OrderResult> {
    let req: OrderRequest;
    if (typeof reqOrSymbol === 'string') {
      req = {
        symbol: reqOrSymbol,
        side: sideArg || 'BUY',
        amountUsd: amountUsdArg || 50,
        type: orderTypeArg,
        leverage: metadataArg?.leverage,
        marginMode: metadataArg?.marginMode,
        options: metadataArg,
      };
    } else {
      req = reqOrSymbol;
    }

    if (this.clientInitPromise) await this.clientInitPromise;
    const formattedSymbol = req.symbol.includes('/') ? req.symbol : `${req.symbol}/USDT`;
    const amountMarginUsd = req.amountUsd;
    const leverage = Math.min(
      config.MAX_LEVERAGE_ALLOWED,
      Math.max(1, req.leverage ?? config.DEFAULT_LEVERAGE)
    );
    const marginMode = req.marginMode ?? config.DEFAULT_MARGIN_MODE;
    const positionSizeUsd = amountMarginUsd * leverage;

    // 1. Margin and Position Size Limit Checks
    const maxTotalPositionAllowed = config.MAX_POSITION_SIZE_USD * config.MAX_LEVERAGE_ALLOWED;

    if (amountMarginUsd > config.MAX_POSITION_SIZE_USD || positionSizeUsd > maxTotalPositionAllowed) {
      const warningMessage = `Attempted order size ($${amountMarginUsd}) exceeds maximum allowed position limit ($${config.MAX_POSITION_SIZE_USD}) or total position size ($${positionSizeUsd}) exceeds maximum allowed limit ($${maxTotalPositionAllowed}).`;

      eventBus.publish(EventType.SPENDING_LIMIT_WARNING, {
        symbol: formattedSymbol,
        attemptedSizeUsd: amountMarginUsd,
        maxAllowedSizeUsd: config.MAX_POSITION_SIZE_USD,
        reason: warningMessage,
        actionBlocked: true,
      });

      logger.warn(`🛑 [BinanceService] Order BLOCKED: ${warningMessage}`);
      return {
        success: false,
        orderId: '',
        symbol: formattedSymbol,
        side: req.side,
        totalUsd: amountMarginUsd,
        marginUsed: amountMarginUsd,
        leverage,
        marginMode,
        message: warningMessage,
        isSimulated: true,
        simulated: true,
        timestamp: new Date().toISOString(),
      } as any;
    }

    // Set leverage on exchange
    await this.setLeverage(formattedSymbol, leverage, marginMode);

    // Get current price
    const ticker = await this.getTicker(formattedSymbol);
    const coinAmount = Math.round((positionSizeUsd / ticker.lastPrice) * 10000) / 10000;
    const posSide: 'LONG' | 'SHORT' = req.side === 'BUY' ? 'LONG' : 'SHORT';
    const liquidationPrice = this.calculateLiquidationPrice(
      formattedSymbol,
      ticker.lastPrice,
      leverage,
      posSide,
      marginMode
    );

    // Calculate default SL/TP if not supplied
    const calculatedStopLoss =
      req.options?.stopLoss ??
      (req.side === 'BUY'
        ? Math.round(ticker.lastPrice * 0.98 * 100) / 100
        : Math.round(ticker.lastPrice * 1.02 * 100) / 100);
    const calculatedTakeProfit =
      req.options?.takeProfit ??
      (req.side === 'BUY'
        ? Math.round(ticker.lastPrice * 1.04 * 100) / 100
        : Math.round(ticker.lastPrice * 0.96 * 100) / 100);

    // 2. Real testnet execution if enabled
    if (config.ENABLE_REAL_ORDERS && this.client) {
      try {
        const order = await this.client.createOrder(
          formattedSymbol,
          (req.type || 'MARKET').toLowerCase() as any,
          req.side.toLowerCase() as any,
          coinAmount
        );

        const orderId = order.id || `ord_${Date.now()}`;

        eventBus.publish(EventType.ORDER_EXECUTED, {
          orderId,
          symbol: formattedSymbol,
          side: req.side,
          amount: coinAmount,
          price: ticker.lastPrice,
          totalUsd: positionSizeUsd,
          leverage,
          marginMode,
          liquidationPrice,
          marginUsed: amountMarginUsd,
          signalId: req.options?.signalId,
          sourceCategory: req.options?.sourceCategory,
          stopLoss: calculatedStopLoss,
          takeProfit: calculatedTakeProfit,
        });

        logger.info(
          `✅ Real Testnet Order Executed: ${req.side} ${coinAmount} ${formattedSymbol} (${leverage}x ${marginMode}, Margin: $${amountMarginUsd})`
        );

        return {
          success: true,
          orderId,
          symbol: formattedSymbol,
          side: req.side,
          price: ticker.lastPrice,
          amount: coinAmount,
          totalUsd: positionSizeUsd,
          marginUsed: amountMarginUsd,
          leverage,
          marginMode,
          liquidationPrice,
          message: 'Real Testnet order executed successfully.',
          isSimulated: false,
          simulated: false,
          timestamp: new Date().toISOString(),
        } as any;
      } catch (err) {
        logger.error('❌ Failed to place real testnet order:', err);
        return {
          success: false,
          orderId: '',
          symbol: formattedSymbol,
          side: req.side,
          message: `Order failed: ${(err as Error).message}`,
          isSimulated: false,
          simulated: false,
          timestamp: new Date().toISOString(),
        } as any;
      }
    }

    // 3. Simulated Execution (Dry-run mode)
    const simulatedOrder: SimulatedOrder = {
      id: `sim_ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      symbol: formattedSymbol,
      side: req.side,
      type: req.type || 'MARKET',
      amount: coinAmount,
      price: ticker.lastPrice,
      totalUsd: amountMarginUsd,
      leverage,
      marginMode,
      liquidationPrice,
      marginUsed: amountMarginUsd,
      status: 'FILLED',
      timestamp: new Date().toISOString(),
      signalId: req.options?.signalId,
      sourceCategory: req.options?.sourceCategory,
      stopLoss: calculatedStopLoss,
      takeProfit: calculatedTakeProfit,
      notes: `Dry-run simulated order (${leverage}x leverage)`,
    };

    this.simulatedOrders.unshift(simulatedOrder);

    // Update simulated position
    if (req.side === 'BUY') {
      this.mockBalanceUsdt -= amountMarginUsd;
      const existing = this.simulatedPositions.get(formattedSymbol);
      if (existing) {
        const totalAmount = existing.amount + coinAmount;
        const avgPrice = (existing.amount * existing.entryPrice + positionSizeUsd) / totalAmount;
        existing.amount = totalAmount;
        existing.entryPrice = avgPrice;
        existing.markPrice = ticker.lastPrice;
        existing.leverage = leverage;
        existing.marginMode = marginMode;
        existing.marginUsed = (existing.marginUsed || 0) + amountMarginUsd;
        existing.liquidationPrice = this.calculateLiquidationPrice(
          formattedSymbol,
          avgPrice,
          leverage,
          'LONG',
          marginMode
        );
        if (req.options?.signalId) existing.signalId = req.options.signalId;
        if (req.options?.sourceCategory) existing.sourceCategory = req.options.sourceCategory;
        if (calculatedStopLoss) existing.stopLoss = calculatedStopLoss;
        if (calculatedTakeProfit) existing.takeProfit = calculatedTakeProfit;
      } else {
        this.simulatedPositions.set(formattedSymbol, {
          symbol: formattedSymbol,
          amount: coinAmount,
          entryPrice: ticker.lastPrice,
          markPrice: ticker.lastPrice,
          unrealizedPnl: 0,
          percentagePnl: 0,
          side: 'LONG',
          leverage,
          marginMode,
          marginUsed: amountMarginUsd,
          liquidationPrice,
          signalId: req.options?.signalId,
          sourceCategory: req.options?.sourceCategory,
          stopLoss: calculatedStopLoss,
          takeProfit: calculatedTakeProfit,
        });
      }
    } else {
      this.mockBalanceUsdt += amountMarginUsd;
      this.simulatedPositions.delete(formattedSymbol);
    }

    eventBus.publish(EventType.ORDER_SIMULATED, simulatedOrder);
    this.broadcastPortfolioUpdate();

    logger.info(
      `📝 [BinanceService] Simulated Order: ${req.side} ${coinAmount} ${formattedSymbol} (${leverage}x ${marginMode}, Margin: $${amountMarginUsd}, Liq: $${liquidationPrice})`
    );

    return {
      success: true,
      orderId: simulatedOrder.id,
      symbol: formattedSymbol,
      side: req.side,
      price: ticker.lastPrice,
      amount: coinAmount,
      totalUsd: positionSizeUsd,
      marginUsed: amountMarginUsd,
      leverage,
      marginMode,
      liquidationPrice,
      message: 'Simulated dry-run order executed successfully.',
      isSimulated: true,
      simulated: true,
      timestamp: new Date().toISOString(),
    } as any;
  }

  public async closePosition(symbol: string, _side?: 'LONG' | 'SHORT'): Promise<OrderResult> {
    const formattedSymbol = symbol.includes('/') ? symbol : `${symbol}/USDT`;
    const existing = this.simulatedPositions.get(formattedSymbol);
    if (existing) {
      this.mockBalanceUsdt += existing.marginUsed || (existing.amount * existing.entryPrice);
      this.simulatedPositions.delete(formattedSymbol);
      await this.broadcastPortfolioUpdate();
    }
    return {
      success: true,
      symbol: formattedSymbol,
      side: 'SELL',
      message: `Position for ${formattedSymbol} closed.`,
      isSimulated: true,
      timestamp: new Date().toISOString(),
    };
  }

  public async broadcastPortfolioUpdate(): Promise<void> {
    const balance = await this.getBalance();
    const positions = await this.getPositions();

    let totalPnl = 0;
    for (const p of positions) {
      totalPnl += p.unrealizedPnl;
    }

    eventBus.publish(EventType.PORTFOLIO_UPDATE, {
      totalBalanceUsd: balance.totalUsd,
      freeUsdt: balance.freeUsdt,
      positions,
      totalUnrealizedPnl: totalPnl,
      isTestnet: this.isTestnet,
    });
  }

  public getRecentOrders(): SimulatedOrder[] {
    return this.simulatedOrders.slice(0, 50);
  }

  public startPricePoller(): void {
    if (this.pollerTimer) return;
    this.pollerTimer = setInterval(() => {
      this.checkLiquidationRisks().catch((e) =>
        logger.debug(`[BinanceService] Poller check error: ${(e as Error).message}`)
      );
    }, 10000);
  }

  public stopPricePoller(): void {
    if (this.pollerTimer) {
      clearInterval(this.pollerTimer);
      this.pollerTimer = null;
    }
  }

  private async checkLiquidationRisks(): Promise<void> {
    const positions = await this.getPositions();
    for (const pos of positions) {
      if (!pos.liquidationPrice) continue;
      const ticker = await this.getTicker(pos.symbol);
      const currentPrice = ticker.lastPrice;
      const distance = Math.abs(currentPrice - pos.liquidationPrice);
      const distancePercent = (distance / currentPrice) * 100;

      // If price within 10% of liquidation price, emit alert
      if (distancePercent <= 10) {
        eventBus.publish(EventType.LIQUIDATION_RISK_WARNING, {
          symbol: pos.symbol,
          side: pos.side,
          currentPrice,
          liquidationPrice: pos.liquidationPrice,
          distancePercent: Math.round(distancePercent * 10) / 10,
          leverage: pos.leverage || config.DEFAULT_LEVERAGE,
          marginUsed: pos.marginUsed || 0,
          warningMessage: `⚠️ ${pos.symbol} fiyatı ($${currentPrice}) likidasyon fiyatına ($${pos.liquidationPrice}) %${distancePercent.toFixed(1)} yaklaştı!`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
}

export const binanceService = new BinanceService();
