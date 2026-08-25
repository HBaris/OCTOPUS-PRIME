/**
 * System-wide constants, Enums, and Default configurations
 */

export enum AgentRole {
  NEWS_TRACKER = 'Haber Takip',
  BINANCE_TRADER = 'Binance İşlemci',
  RISK_ANALYST = 'Risk Analisti',
  PORTFOLIO_ACCOUNTANT = 'Portföy Muhasebecisi',
  SIGNAL_HUNTER = 'Sinyal Avcısı',
  PATRON = 'Patron',
  BTC_ANALYST = 'BTC Analisti',
  ETH_ANALYST = 'ETH Analisti',
  SOL_ANALYST = 'SOL Analisti',
  MACRO_ECONOMIST = 'Makro Ekonomist',
  WHALE_TRACKER = 'Whale Takipçisi',
  REGULATORY_WATCHER = 'Düzenleyici İzleyici',
  TECHNICAL_ANALYST = 'Teknik Analist',
  LIQUIDITY_OBSERVER = 'Likidite Gözlemcisi',
  SECRETARY = 'Sekreterya',
}

export enum AgentState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  ALERTING = 'ALERTING',
  TRADING = 'TRADING',
  ERROR = 'ERROR',
}

export enum EventType {
  NEW_NEWS = 'NEW_NEWS',
  SIGNAL_GENERATED = 'SIGNAL_GENERATED',
  TRADE_PROPOSAL = 'TRADE_PROPOSAL',
  RISK_CONFIDENCE_UPDATE = 'RISK_CONFIDENCE_UPDATE',
  SCENE_SEVERITY_UPDATE = 'SCENE_SEVERITY_UPDATE',
  AGENT_ACTION = 'AGENT_ACTION',
  FEEDBACK_RECEIVED = 'FEEDBACK_RECEIVED',
  PORTFOLIO_UPDATE = 'PORTFOLIO_UPDATE',
  ORDER_SIMULATED = 'ORDER_SIMULATED',
  ORDER_EXECUTED = 'ORDER_EXECUTED',
  SPENDING_LIMIT_WARNING = 'SPENDING_LIMIT_WARNING',
  SYSTEM_STATUS = 'SYSTEM_STATUS',
}

export enum SceneSeverity {
  HAFIF = 'HAFİF',
  ORTA = 'ORTA',
  AGIR = 'AĞIR',
  COK_AGIR = 'ÇOK AĞIR',
  KATASTROFIK = 'KATASTROFİK',
}

export enum SentimentLabel {
  POSITIVE = 'POSITIVE',
  NEGATIVE = 'NEGATIVE',
  NEUTRAL = 'NEUTRAL',
}

export enum FeedbackEmoji {
  ACCURATE = '✅',
  FALSE_ALARM = '❌',
  CRITICAL = '🔥',
  BORING = '😴',
  ACTIONABLE = '⚡',
}

export const DEFAULT_CORRELATIONS: Record<string, Record<string, number>> = {
  oil_down: { btc: 0.65, gold: 0.72, stocks: -0.58 },
  fed_raises_rates: { btc: -0.82, stocks: -0.79, bonds: 0.91 },
  geopolitical_crisis: { gold: 0.88, btc: 0.71, stocks: -0.75 },
  crypto_crash: { btc: -1.0, stocks: 0.35, gold: 0.45 },
  inflation_spike: { gold: 0.85, btc: 0.65, stocks: -0.70 },
  crypto_bullish: { btc: 0.95, eth: 0.92, sol: 0.88, stocks: 0.30 },
};

export const RSS_FEED_URLS = [
  'https://feeds.bloomberg.com/markets/news.rss',
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://cointelegraph.com/rss',
];
