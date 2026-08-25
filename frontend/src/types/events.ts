export type EventType =
  | 'NEW_NEWS'
  | 'SIGNAL_GENERATED'
  | 'TRADE_PROPOSAL'
  | 'RISK_CONFIDENCE_UPDATE'
  | 'SCENE_SEVERITY_UPDATE'
  | 'AGENT_ACTION'
  | 'FEEDBACK_RECEIVED'
  | 'PORTFOLIO_UPDATE'
  | 'ORDER_SIMULATED'
  | 'ORDER_EXECUTED'
  | 'SPENDING_LIMIT_WARNING'
  | 'SYSTEM_STATUS';

export type AgentRole =
  | 'Haber Takip'
  | 'Binance İşlemci'
  | 'Risk Analisti'
  | 'Portföy Muhasebecisi'
  | 'Sinyal Avcısı'
  | 'Patron';

export type AgentState = 'IDLE' | 'ANALYZING' | 'ALERTING' | 'TRADING' | 'SALUTING';

export type SceneSeverity = 'HAFİF' | 'ORTA' | 'AĞIR' | 'ÇOK AĞIR' | 'KATASTROFİK';

export interface BaseEvent<T = any> {
  id?: string;
  type: EventType;
  timestamp: string;
  payload: T;
}

export interface AgentActionPayload {
  agentRole: AgentRole;
  actionName: string;
  status: 'STARTED' | 'COMPLETED' | 'FAILED' | 'WAITING';
  details: string;
  timestamp?: string;
}

export interface SceneSeverityPayload {
  severityLabel: SceneSeverity;
  impactScore: number;
  primaryReason: string;
  topAffectedAssets: string[];
  timestamp: string;
}

export interface RiskConfidencePayload {
  confidenceScore: number; // 0 - 1
  accuracyRate: number;
  totalTrackedEvents?: number;
  evaluatedEvents?: number;
  analystComment?: string;
}

export interface SpendingLimitWarningPayload {
  symbol: string;
  attemptedSizeUsd: number;
  maxAllowedSizeUsd: number;
  reason: string;
  actionBlocked: boolean;
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
    signalId?: string;
    sourceCategory?: string;
    stopLoss?: number;
    takeProfit?: number;
  }>;
  totalUnrealizedPnl: number;
  isTestnet?: boolean;
}

export interface NewNewsPayload {
  newsId: string;
  title: string;
  summary: string;
  source: string;
  link: string;
  category: string;
  impact: {
    impactScore: number;
    severityLabel: SceneSeverity;
  };
}

export interface SignalGeneratedPayload {
  signalId: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  signalScore: number;
  confidence: number;
  reasoning: string;
  sourceCategory?: string;
  suggestedStopLoss?: number;
  suggestedTakeProfit?: number;
}

export interface TradeProposalPayload {
  proposalId: string;
  signalId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  suggestedAmountUsd?: number;
  estimatedAmountUsd?: number;
  signalScore: number;
  confidence?: number;
  reasoning?: string;
  sourceCategory?: string;
  suggestedStopLoss?: number;
  suggestedTakeProfit?: number;
  status?: string;
  isDryRun?: boolean;
  notes?: string;
  timestamp?: string;
}

export interface SystemStatusPayload {
  agents: Record<string, {
    role: AgentRole;
    state: AgentState;
    currentTask: string;
    confidence?: number;
  }>;
  currentSceneSeverity: {
    label: string;
    score: number;
  };
  portfolioSummary: {
    totalUsd: number;
    openPositionsCount: number;
  };
}
