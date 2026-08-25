export interface MarketTicker {
  symbol: string;
  lastPrice: number;
  bid: number;
  ask: number;
  change24hPercent: number;
  volume24h: number;
  timestamp: number;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartCandle {
  time: number; // Unix timestamp in seconds for lightweight-charts
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WalletBalance {
  totalUsd: number;
  freeUsdt: number;
  assets: Record<string, { free: number; used: number; total: number; valueUsd: number }>;
}

export type PortfolioBalance = WalletBalance;

export interface PositionInfo {
  symbol: string;
  amount: number;
  entryPrice: number;
  currentPrice?: number;
  markPrice: number;
  unrealizedPnl: number;
  percentagePnl: number;
  liquidationPrice?: number;
  side: 'LONG' | 'SHORT';
  leverage?: number;
  marginMode?: 'isolated' | 'cross';
  marginUsed?: number;
  signalId?: string;
  sourceCategory?: string;
  stopLoss?: number;
  takeProfit?: number;
}

export type Position = PositionInfo;

export interface SimulatedOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  amount: number;
  price: number;
  totalUsd: number;
  leverage?: number;
  marginMode?: 'isolated' | 'cross';
  liquidationPrice?: number;
  marginUsed?: number;
  status: 'FILLED' | 'CANCELLED' | 'REJECTED';
  timestamp: string;
  signalId?: string;
  sourceCategory?: string;
  stopLoss?: number;
  takeProfit?: number;
  notes?: string;
}

export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  amountUsd: number;
  type?: 'MARKET' | 'LIMIT';
  price?: number;
  leverage?: number;
  marginMode?: 'isolated' | 'cross';
  options?: {
    signalId?: string;
    sourceCategory?: string;
    stopLoss?: number;
    takeProfit?: number;
    notes?: string;
  };
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price?: number;
  amount?: number;
  totalUsd?: number;
  leverage?: number;
  marginMode?: 'isolated' | 'cross';
  liquidationPrice?: number;
  marginUsed?: number;
  message?: string;
  isSimulated: boolean;
  simulated?: boolean;
  timestamp: string;
}
