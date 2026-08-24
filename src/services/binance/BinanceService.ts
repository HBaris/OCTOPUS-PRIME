import { config } from '../../config/index.js';
import { WalletBalance, PositionInfo, SimulatedOrder, MarketTicker, Candle } from '../../types/market.js';
import { eventBus } from '../../events/EventBus.js';
import { EventType } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

export class BinanceService {
  private client: any = null;
  private isTestnet: boolean;
  private simulatedOrders: SimulatedOrder[] = [];
  private simulatedPositions: Map<string, PositionInfo> = new Map();
  private mockBalanceUsdt = 10000.0;
  private clientInitPromise: Promise<void> | null = null;

  constructor() {
    this.isTestnet = config.BINANCE_TESTNET;
    this.clientInitPromise = this.initClient();
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
        }));
      } catch (err) {
        logger.warn('⚠️ Could not fetch exchange positions, using simulated positions');
      }
    }

    return Array.from(this.simulatedPositions.values());
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

  /**
   * Safe Order Placement:
   * 1. Validates spending limits (MAX_POSITION_SIZE_USD)
   * 2. If ENABLE_REAL_ORDERS is false, executes in simulation mode
   * 3. Emits events for UI tracking
   */
  public async executeOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    amountUsd: number,
    orderType: 'MARKET' | 'LIMIT' = 'MARKET'
  ): Promise<{ success: boolean; orderId: string; message: string; simulated: boolean }> {
    if (this.clientInitPromise) await this.clientInitPromise;
    const formattedSymbol = symbol.includes('/') ? symbol : `${symbol}/USDT`;

    // 1. Spending limit check
    if (amountUsd > config.MAX_POSITION_SIZE_USD) {
      const warningMessage = `Attempted order size ($${amountUsd}) exceeds maximum allowed position limit ($${config.MAX_POSITION_SIZE_USD}).`;
      
      eventBus.publish(EventType.SPENDING_LIMIT_WARNING, {
        symbol: formattedSymbol,
        attemptedSizeUsd: amountUsd,
        maxAllowedSizeUsd: config.MAX_POSITION_SIZE_USD,
        reason: warningMessage,
        actionBlocked: true,
      });

      logger.warn(`🛑 [BinanceService] Order BLOCKED: ${warningMessage}`);
      return {
        success: false,
        orderId: '',
        message: warningMessage,
        simulated: true,
      };
    }

    // Get current price
    const ticker = await this.getTicker(formattedSymbol);
    const coinAmount = Math.round((amountUsd / ticker.lastPrice) * 10000) / 10000;

    // 2. Real testnet execution if enabled
    if (config.ENABLE_REAL_ORDERS && this.client) {
      try {
        const order = await this.client.createOrder(
          formattedSymbol,
          orderType.toLowerCase() as any,
          side.toLowerCase() as any,
          coinAmount
        );

        eventBus.publish(EventType.ORDER_EXECUTED, {
          orderId: order.id || `ord_${Date.now()}`,
          symbol: formattedSymbol,
          side,
          amount: coinAmount,
          price: ticker.lastPrice,
          totalUsd: amountUsd,
        });

        logger.info(`✅ Real Testnet Order Executed: ${side} ${coinAmount} ${formattedSymbol} (~$${amountUsd})`);
        return {
          success: true,
          orderId: order.id || `ord_${Date.now()}`,
          message: 'Real Testnet order executed successfully.',
          simulated: false,
        };
      } catch (err) {
        logger.error('❌ Failed to place real testnet order:', err);
        return {
          success: false,
          orderId: '',
          message: `Order failed: ${(err as Error).message}`,
          simulated: false,
        };
      }
    }

    // 3. Simulated Execution (Dry-run mode)
    const simulatedOrder: SimulatedOrder = {
      id: `sim_ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      symbol: formattedSymbol,
      side,
      type: orderType,
      amount: coinAmount,
      price: ticker.lastPrice,
      totalUsd: amountUsd,
      status: 'FILLED',
      timestamp: new Date().toISOString(),
      notes: 'Dry-run simulated order',
    };

    this.simulatedOrders.unshift(simulatedOrder);

    // Update simulated position
    if (side === 'BUY') {
      this.mockBalanceUsdt -= amountUsd;
      const existing = this.simulatedPositions.get(formattedSymbol);
      if (existing) {
        const totalAmount = existing.amount + coinAmount;
        const avgPrice = (existing.amount * existing.entryPrice + amountUsd) / totalAmount;
        existing.amount = totalAmount;
        existing.entryPrice = avgPrice;
        existing.markPrice = ticker.lastPrice;
      } else {
        this.simulatedPositions.set(formattedSymbol, {
          symbol: formattedSymbol,
          amount: coinAmount,
          entryPrice: ticker.lastPrice,
          markPrice: ticker.lastPrice,
          unrealizedPnl: 0,
          percentagePnl: 0,
          side: 'LONG',
        });
      }
    } else {
      this.mockBalanceUsdt += amountUsd;
      this.simulatedPositions.delete(formattedSymbol);
    }

    eventBus.publish(EventType.ORDER_SIMULATED, simulatedOrder);
    
    // Broadcast portfolio update
    this.broadcastPortfolioUpdate();

    logger.info(`📝 [BinanceService] Simulated Order: ${side} ${coinAmount} ${formattedSymbol} at $${ticker.lastPrice} ($${amountUsd})`);

    return {
      success: true,
      orderId: simulatedOrder.id,
      message: 'Simulated dry-run order executed successfully.',
      simulated: true,
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
}
