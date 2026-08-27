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
  | 'LIQUIDATION_RISK_WARNING'
  | 'SYSTEM_STATUS';

export type AgentRole =
  | 'Haber Takip'
  | 'Binance İşlemci'
  | 'Risk Analisti'
  | 'Portföy Muhasebecisi'
  | 'Sinyal Avcısı'
  | 'Patron'
  | 'BTC Analisti'
  | 'ETH Analisti'
  | 'SOL Analisti'
  | 'Makro Ekonomist'
  | 'Whale Takipçisi'
  | 'Düzenleyici İzleyici'
  | 'Teknik Analist'
  | 'Likidite Gözlemcisi'
  | 'Sekreterya'
  | 'Görev Takipçisi'
  | 'Baş Danışman';

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

export interface TaskSummaryData {
  title: string;
  totalAgentActions: number;
  activeAgentsCount: number;
  mostActiveRoom: string;
  criticalAlertsCount: number;
  keyOperations: string[];
  agentBreakdown: Array<{ agent: string; actionCount: number; lastTask: string }>;
  summaryParagraph: string;
}

export interface ExecutiveSummaryData {
  title: string;
  totalMissedNews: number;
  categoryBreakdown: Record<string, number>;
  topHeadlines: Array<{ title: string; category: string; impactScore: number; sentiment: string }>;
  currentSeverity: string;
  severityReason: string;
  portfolioSummary: {
    currentBalance: number;
    initialBalance: number;
    pnlUsd: number;
    openPositionsCount: number;
  };
  captainTakeaway: string;
  summaryParagraph: string;
}

export interface BriefingResponsePayload {
  generatedAt: string;
  sinceTimestamp: string;
  unreadCounts: {
    news: number;
    agentActions: number;
    signals: number;
    orders: number;
    alerts: number;
  };
  taskSummary: TaskSummaryData;
  executiveSummary: ExecutiveSummaryData;
}
