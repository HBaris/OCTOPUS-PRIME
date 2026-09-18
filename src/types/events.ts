import { EventType, SceneSeverity, AgentRole, FeedbackEmoji } from '../config/constants.js';

export interface BaseEvent<T = unknown> {
  id: string;
  type: EventType;
  timestamp: string;
  payload: T;
}

export interface NewNewsPayload {
  newsId: string;
  title: string;
  summary: string;
  source: string;
  link: string;
  published: string;
  matchedCoins: string[];
  category: string;
  strength: number;
  sentiment: {
    label: string;
    score: number;
    description: string;
  };
  impact: {
    impactScore: number;
    severityLabel: SceneSeverity;
    affectedMarkets: string[];
  };
}

export interface SceneSeverityPayload {
  severityLabel: SceneSeverity;
  impactScore: number;
  primaryReason: string;
  topAffectedAssets: string[];
  timestamp: string;
}

export interface SignalGeneratedPayload {
  signalId: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  signalScore: number; // 0-100
  confidence: number; // 0-1
  breakdown: {
    newsImpactScore: number;
    sentimentScore: number;
    priceMomentumScore: number;
    correlationScore: number;
    feedbackWeightMultiplier: number;
  };
  reasoning: string;
  suggestedPrice?: number;
  suggestedStopLoss?: number;
  suggestedTakeProfit?: number;
}

export interface TradeProposalPayload {
  proposalId: string;
  signalId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  suggestedAmountUsd?: number;
  estimatedAmountUsd: number;
  suggestedLeverage?: number;
  suggestedMarginMode?: 'isolated' | 'cross';
  estimatedMarginUsd?: number;
  estimatedPositionSizeUsd?: number;
  signalScore: number;
  confidence?: number;
  reasoning?: string;
  sourceCategory?: string;
  suggestedStopLoss?: number;
  suggestedTakeProfit?: number;
  status: 'PENDING_APPROVAL' | 'SIMULATED' | 'BLOCKED_BY_LIMIT' | 'EXECUTED';
  isDryRun: boolean;
  notes: string;
  timestamp?: string;
}

export interface RiskConfidencePayload {
  confidenceScore: number; // 0.0 - 1.0
  accuracyRate: number;
  totalTrackedEvents: number;
  evaluatedEvents: number;
  recentEmaAccuracy: number;
  analystComment: string;
}

export interface AgentActionPayload {
  agentRole: AgentRole;
  actionName: string;
  status: 'STARTED' | 'COMPLETED' | 'FAILED' | 'WAITING';
  details: string;
  metadata?: Record<string, unknown>;
}

export interface FeedbackReceivedPayload {
  feedbackId: string;
  targetId: string; // signalId or newsId
  emoji: FeedbackEmoji;
  emojiMeaning: string;
  updatedWeights?: Record<string, number>;
}

export interface PortfolioUpdatePayload {
  totalBalanceUsd: number;
  freeUsdt: number;
  positions: Array<{
    symbol: string;
    amount: number;
    entryPrice: number;
    currentPrice?: number;
    markPrice?: number;
    unrealizedPnl: number;
    percentagePnl?: number;
    pnlPercentage?: number;
    side?: 'LONG' | 'SHORT';
    leverage?: number;
    marginMode?: 'isolated' | 'cross';
    liquidationPrice?: number;
    marginUsed?: number;
    signalId?: string;
    sourceCategory?: string;
    stopLoss?: number;
    takeProfit?: number;
  }>;
  totalUnrealizedPnl: number;
  isTestnet: boolean;
}

export interface OrderSimulatedPayload {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  amount: number;
  price: number;
  totalUsd: number;
  leverage?: number;
  marginMode?: 'isolated' | 'cross';
  liquidationPrice?: number;
  marginUsed?: number;
  simulatedAt: string;
}

export interface SpendingLimitWarningPayload {
  symbol: string;
  attemptedSizeUsd: number;
  maxAllowedSizeUsd: number;
  reason: string;
  actionBlocked: boolean;
}

export interface LiquidationRiskWarningPayload {
  symbol: string;
  side: 'LONG' | 'SHORT';
  currentPrice: number;
  liquidationPrice: number;
  distancePercent: number;
  leverage: number;
  marginUsed: number;
  warningMessage: string;
  timestamp: string;
}

export interface TechnicalSignalPayload {
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
  bidAskImbalance: number;
  suggestedAction: 'BUY' | 'SELL' | 'HOLD';
  confidenceScore: number;
  timestamp: string;
}

export interface SocialSignalPayload {
  id: string;
  source: 'telegram' | 'threads';
  channelOrUser: string;
  coin: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  rawContent: string;
  confidenceScore: number;
  timestamp: string;
}

export interface LearningRuleUpdatedPayload {
  ruleId: string;
  description: string;
  tier: 'HYPOTHESIS' | 'WEAK_RULE' | 'STRONG_RULE';
  confidenceBonus: number;
  observationCount: number;
  regimesSeen: string[];
  action: 'PROMOTED' | 'DEMOTED' | 'DECAYED' | 'CREATED';
  timestamp: string;
}

export interface TradingHaltedPayload {
  haltedAt: string;
  resumeAt: string;
  durationMinutes: number;
  reason: string;
  consecutiveLosses: number;
  reportId: string;
}

export interface TradingResumedPayload {
  resumedAt: string;
  reason: string;
}

export interface CooldownReportPayload {
  id: string;
  haltedAt: string;
  durationMinutes: number;
  reason: string;
  consecutiveLosses: number;
  misleadingChannels: string[];
  failedRules: string[];
  averageLossConfidence: number;
  analystDiagnosis: string;
  recommendations: string[];
}

