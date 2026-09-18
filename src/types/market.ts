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

export interface TechnicalIndicatorSignal {
  symbol: string;
  timeframe: string;
  lastPrice: number;
  ema9: number;
  ema21: number;
  emaCross: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  rsi14: number;
  rsiCondition: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
  volumeSpikeRatio: number;
  volumeSpikeDetected: boolean;
  bidAskImbalance: number; // -1.0 (heavy sell) to +1.0 (heavy buy)
  suggestedAction: 'BUY' | 'SELL' | 'HOLD';
  confidenceScore: number; // 0 - 100
  timestamp: string;
}

export interface SocialSignal {
  id: string;
  source: 'telegram' | 'threads';
  channelOrUser: string;
  coin: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  rawContent: string;
  confidenceScore: number; // 0 - 100 (default lower due to noise)
  timestamp: string;
}

export interface LearningRule {
  id: string;
  description: string;
  conditionType: 'TECHNICAL' | 'NEWS' | 'SOCIAL' | 'HYBRID';
  pattern: string;
  confidenceBonus: number; // % bonus added to score (0 for Hypothesis, 5-10 for Weak, 20-25 for Strong)
  observationCount: number;
  independentSources: string[];
  regimesSeen: ('BULL' | 'BEAR' | 'SIDEWAYS')[];
  tier: 'HYPOTHESIS' | 'WEAK_RULE' | 'STRONG_RULE';
  successCount: number;
  failCount: number;
  successRate: number;
  recentTradeOutcomes: boolean[]; // Last 20 outcomes for decay tracking
  createdAt: string;
  lastUpdated: string;
}

export interface CooldownReport {
  id: string;
  haltedAt: string;
  resumedAt?: string;
  durationMinutes: number;
  reason: string;
  consecutiveLosses: number;
  misleadingChannels: string[];
  failedRules: string[];
  averageLossConfidence: number;
  analystDiagnosis: string;
  recommendations: string[];
}

export interface CircuitBreakerState {
  isHalted: boolean;
  haltedAt?: string;
  resumeAt?: string;
  remainingSeconds: number;
  consecutiveLosses: number;
  lastReport?: CooldownReport;
}

