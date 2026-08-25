import {
  PortfolioBalance,
  Position,
  Candle,
  MarketTicker,
  OrderRequest,
  OrderResult,
} from '../../types/market.js';

export interface FundingRateInfo {
  rate: number;
  nextFundingTime: Date;
}

export interface IExchangeService {
  /**
   * Fetch current portfolio / wallet balance
   */
  fetchBalance(): Promise<PortfolioBalance>;

  /**
   * Fetch all open positions (simulated or real)
   */
  fetchPositions(): Promise<Position[]>;

  /**
   * Execute or simulate an order (with leverage/margin support)
   */
  executeOrder(request: OrderRequest): Promise<OrderResult>;

  /**
   * Fetch OHLCV candles for technical analysis and charts
   */
  fetchCandles(symbol: string, timeframe: string, limit?: number): Promise<Candle[]>;

  /**
   * Fetch real-time market ticker (price, bid, ask, volume)
   */
  fetchTicker(symbol: string): Promise<MarketTicker>;

  /**
   * Set leverage and margin mode for a specific trading pair
   */
  setLeverage(symbol: string, leverage: number, marginMode: 'isolated' | 'cross'): Promise<void>;

  /**
   * Calculate liquidation price for a position based on leverage and margin mode
   */
  calculateLiquidationPrice(
    symbol: string,
    entryPrice: number,
    leverage: number,
    side: 'LONG' | 'SHORT',
    marginMode?: string
  ): number;

  /**
   * Fetch the current perpetual funding rate and next funding timestamp
   */
  fetchFundingRate(symbol: string): Promise<FundingRateInfo>;

  /**
   * Fetch the maximum leverage permitted for the specified market
   */
  getMaxLeverage(symbol: string): Promise<number>;

  /**
   * Returns whether the exchange service is running in simulation mode
   */
  getIsSimulation(): boolean;

  /**
   * Close a specific position
   */
  closePosition(symbol: string, side?: 'LONG' | 'SHORT'): Promise<OrderResult>;

  /**
   * Start periodic price/position monitoring loop
   */
  startPricePoller?(): void;

  /**
   * Stop periodic price/position monitoring loop
   */
  stopPricePoller?(): void;
}
