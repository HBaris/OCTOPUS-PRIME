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

export interface PositionInfo {
  symbol: string;
  amount: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  percentagePnl: number;
  liquidationPrice?: number;
  side: 'LONG' | 'SHORT';
}

export interface SimulatedOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  amount: number;
  price: number;
  totalUsd: number;
  status: 'FILLED' | 'CANCELLED' | 'REJECTED';
  timestamp: string;
  notes?: string;
}
