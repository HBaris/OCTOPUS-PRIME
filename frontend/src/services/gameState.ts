import { wsService } from './websocket.ts';
import { apiService } from './api.ts';
import {
  AgentRole,
  AgentState,
  SceneSeverity,
  AgentActionPayload,
  SceneSeverityPayload,
  RiskConfidencePayload,
  SpendingLimitWarningPayload,
  LiquidationRiskWarningPayload,
  PortfolioUpdatePayload,
  NewNewsPayload,
  SignalGeneratedPayload,
  TradeProposalPayload,
  SystemStatusPayload,
} from '../types/events.ts';
import { AGENT_CONFIGS, ROOMS } from '../config.ts';

export interface AgentStateData {
  role: AgentRole;
  name: string;
  avatarIcon: string;
  sceneKey: string;
  roomTitle: string;
  state: AgentState;
  currentTask: string;
  confidence?: number;
  lastAction?: string;
  actionsCount: number;
}

export interface LiveStreamItem {
  id: string;
  type: 'NEWS' | 'AGENT' | 'SIGNAL' | 'TRADE' | 'RISK' | 'SYSTEM';
  timestamp: string;
  timeStr: string;
  source: string;
  roomTitle: string;
  avatarIcon: string;
  message: string;
  category?: string;
  highlightColor: string;
}

type Listener<T> = (data: T) => void;

class GameStateManager {
  public agents: Map<AgentRole, AgentStateData> = new Map();
  public severity: SceneSeverity = 'HAFİF';
  public severityScore = 1.0;
  public severityReason = 'Piyasalar sakin';
  public totalBalanceUsd = 10000;
  public openPositionsCount = 0;
  public latestProposal: TradeProposalPayload | null = null;
  public latestTicker = '📡 Sistem hazır. 15 Ajan odalarında canlı piyasa izliyor...';
  public wsStatus: 'ONLINE' | 'CONNECTING' | 'OFFLINE' = 'OFFLINE';
  public streamHistory: LiveStreamItem[] = [];

  private agentListeners: Set<Listener<{ role: AgentRole; state: AgentState; task?: string }>> = new Set();
  private severityListeners: Set<Listener<SceneSeverity>> = new Set();
  private proposalListeners: Set<Listener<TradeProposalPayload>> = new Set();
  private tickerListeners: Set<Listener<string>> = new Set();
  private streamListeners: Set<Listener<LiveStreamItem[]>> = new Set();
  private statusListeners: Set<Listener<'ONLINE' | 'CONNECTING' | 'OFFLINE'>> = new Set();
  private portfolioListeners: Set<Listener<{ balance: number; count: number }>> = new Set();

  constructor() {
    this.initAgents();
    this.initWebSocketListeners();
    this.fetchInitialState();
  }

  private initAgents(): void {
    AGENT_CONFIGS.forEach((cfg) => {
      this.agents.set(cfg.role, {
        role: cfg.role,
        name: cfg.name,
        avatarIcon: cfg.avatarIcon,
        sceneKey: cfg.sceneKey,
        roomTitle: cfg.roomTitle,
        state: 'IDLE',
        currentTask: 'Hazırda bekliyor',
        confidence: cfg.role === 'Risk Analisti' ? 0.75 : undefined,
        actionsCount: 0,
      });
    });
  }

  public addStreamItem(item: Omit<LiveStreamItem, 'id' | 'timestamp' | 'timeStr'>): void {
    const now = new Date();
    const fullItem: LiveStreamItem = {
      ...item,
      id: `stream_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now.toISOString(),
      timeStr: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    this.streamHistory.unshift(fullItem);
    if (this.streamHistory.length > 150) {
      this.streamHistory.pop();
    }

    this.streamListeners.forEach((fn) => fn(this.streamHistory));
  }

  private initWebSocketListeners(): void {
    wsService.onStatusChange((status) => {
      this.wsStatus = status === 'CONNECTED' ? 'ONLINE' : status === 'CONNECTING' ? 'CONNECTING' : 'OFFLINE';
      this.statusListeners.forEach((fn) => fn(this.wsStatus));
    });

    // 1. All Agent Actions & Messages across all rooms
    wsService.on<AgentActionPayload>('AGENT_ACTION', (payload) => {
      const stateMap: Record<string, AgentState> = {
        STARTED: 'ANALYZING',
        COMPLETED: 'IDLE',
        FAILED: 'ALERTING',
        WAITING: 'IDLE',
      };
      const newState = stateMap[payload.status] || 'IDLE';
      this.setAgentState(payload.agentRole, newState, payload.details);

      const agent = this.agents.get(payload.agentRole);
      const roomTitle = agent?.roomTitle || 'Merkez';
      const icon = agent?.avatarIcon || '🤖';
      const msg = payload.details || payload.actionName || 'Görev yürütülüyor';

      this.addStreamItem({
        type: 'AGENT',
        source: payload.agentRole,
        roomTitle,
        avatarIcon: icon,
        message: msg,
        highlightColor: '#38bdf8',
      });

      this.setTicker(`${icon} ${payload.agentRole} (${roomTitle}): ${msg}`);
    });

    // 2. All News & Flash Updates
    wsService.on<NewNewsPayload>('NEW_NEWS', (payload) => {
      this.setAgentState('Haber Takip', 'ALERTING', payload.title);
      
      const cat = payload.category ? `[${payload.category.toUpperCase()}] ` : '';
      const summary = payload.summary ? ` - ${payload.summary}` : '';
      const fullNewsMsg = `${cat}${payload.title}${summary}`;

      this.addStreamItem({
        type: 'NEWS',
        source: 'Haber Takip',
        roomTitle: 'Haber Odası',
        avatarIcon: '📰',
        message: fullNewsMsg,
        category: payload.category,
        highlightColor: '#facc15',
      });

      this.setTicker(`📰 Haber Odası: ${cat}${payload.title}`);
    });

    // 3. Signal Generations
    wsService.on<SignalGeneratedPayload>('SIGNAL_GENERATED', (payload) => {
      if (payload.action !== 'HOLD') {
        const sideIcon = payload.action === 'BUY' ? '🟢 BUY' : '🔴 SELL';
        this.setAgentState('Sinyal Avcısı', 'TRADING', `${payload.action} ${payload.symbol} (Skor: ${payload.signalScore})`);
        
        const signalMsg = `${sideIcon} ${payload.symbol} | Skor: ${payload.signalScore}/100 - ${payload.reasoning || 'Kritik sinyal tespit edildi'}`;
        this.addStreamItem({
          type: 'SIGNAL',
          source: 'Sinyal Avcısı',
          roomTitle: 'Sinyal Odası',
          avatarIcon: '⚡',
          message: signalMsg,
          highlightColor: payload.action === 'BUY' ? '#10b981' : '#ef4444',
        });

        this.setTicker(`⚡ Sinyal Odası: ${payload.action} ${payload.symbol} | Skor: ${payload.signalScore}/100`);
      }
    });

    // 4. Trade Proposals
    wsService.on<TradeProposalPayload>('TRADE_PROPOSAL', (payload) => {
      this.latestProposal = payload;
      this.setAgentState('Patron', 'TRADING', `${payload.symbol} için ${payload.side} onayı bekleniyor`);
      this.proposalListeners.forEach((fn) => fn(payload));

      const amount = payload.suggestedAmountUsd || payload.estimatedAmountUsd || 50;
      const lev = payload.suggestedLeverage || 5;
      const propMsg = `Emir Teklifi: ${payload.side} ${payload.symbol} ($${amount}, ${lev}x) - ${payload.reasoning || 'Onay bekleniyor'}`;

      this.addStreamItem({
        type: 'TRADE',
        source: 'Patron',
        roomTitle: 'Patron Odası',
        avatarIcon: '🎩',
        message: propMsg,
        highlightColor: '#f59e0b',
      });

      this.setTicker(`🎩 Patron Odası: ${payload.side} ${payload.symbol} ($${amount}, ${lev}x)`);
    });

    // 5. Orders (Simulated / Executed)
    wsService.on<any>('ORDER_SIMULATED', (payload) => {
      const orderMsg = `İşlem Gerçekleşti: ${payload.side} ${payload.symbol} ($${payload.totalUsd || 50}, ${payload.leverage || 5}x @ $${payload.price})`;
      this.addStreamItem({
        type: 'TRADE',
        source: 'Binance İşlemci',
        roomTitle: 'İşlem Odası',
        avatarIcon: '📝',
        message: orderMsg,
        highlightColor: '#10b981',
      });

      this.setTicker(`📝 İşlem Odası: ${payload.side} ${payload.symbol} emri yürütüldü!`);
    });

    wsService.on<any>('ORDER_EXECUTED', (payload) => {
      const orderMsg = `Canlı Emir Tamamlandı: ${payload.side} ${payload.symbol} ($${payload.totalUsd || 50})`;
      this.addStreamItem({
        type: 'TRADE',
        source: 'Binance İşlemci',
        roomTitle: 'İşlem Odası',
        avatarIcon: '📝',
        message: orderMsg,
        highlightColor: '#10b981',
      });

      this.setTicker(`📝 Canlı İşlem: ${payload.side} ${payload.symbol} tamamlandı.`);
    });

    // 6. Scene Severity & DEFCON Updates
    wsService.on<SceneSeverityPayload>('SCENE_SEVERITY_UPDATE', (payload) => {
      this.severity = payload.severityLabel;
      this.severityScore = payload.impactScore;
      this.severityReason = payload.primaryReason;
      this.severityListeners.forEach((fn) => fn(this.severity));

      const sevMsg = `Ortam Seviyesi: ${payload.severityLabel} (${payload.impactScore}/10) - ${payload.primaryReason}`;
      this.addStreamItem({
        type: 'RISK',
        source: 'DEFCON Radarı',
        roomTitle: 'Risk Odası',
        avatarIcon: '⚠️',
        message: sevMsg,
        highlightColor: payload.severityLabel === 'KATASTROFİK' || payload.severityLabel === 'ÇOK AĞIR' ? '#ef4444' : '#38bdf8',
      });

      this.setTicker(`⚠️ Risk Odası [ORTAM: ${payload.severityLabel}]: ${payload.primaryReason}`);
    });

    // 7. Risk Confidence Updates
    wsService.on<RiskConfidencePayload>('RISK_CONFIDENCE_UPDATE', (payload) => {
      const riskAgent = this.agents.get('Risk Analisti');
      if (riskAgent) {
        riskAgent.confidence = payload.confidenceScore;
        this.setAgentState('Risk Analisti', 'ANALYZING', `Güven: %${Math.round(payload.confidenceScore * 100)}`);
      }

      const confMsg = `Piyasa Korelasyon Güveni: %${Math.round(payload.confidenceScore * 100)} - ${payload.analystComment || 'Dengeli risk seviyesi'}`;
      this.addStreamItem({
        type: 'RISK',
        source: 'Risk Analisti',
        roomTitle: 'Risk Odası',
        avatarIcon: '🛡️',
        message: confMsg,
        highlightColor: '#10b981',
      });

      this.setTicker(`🛡️ Risk Odası: Risk Güveni %${Math.round(payload.confidenceScore * 100)}`);
    });

    // 8. Spending Limit Warnings
    wsService.on<SpendingLimitWarningPayload>('SPENDING_LIMIT_WARNING', (payload) => {
      this.setAgentState('Binance İşlemci', 'ALERTING', `🛑 Limit Aşımı: ${payload.symbol}`);
      this.setAgentState('Likidite Gözlemcisi', 'ALERTING', `🛑 Likidite Uyarısı: ${payload.symbol}`);

      const warnMsg = `LİMİT ENGELİ: ${payload.symbol} $${payload.attemptedSizeUsd} talep edildi, limit $${payload.maxAllowedSizeUsd} aşıldı!`;
      this.addStreamItem({
        type: 'RISK',
        source: 'Likidite Gözlemcisi',
        roomTitle: 'Risk Odası',
        avatarIcon: '🛑',
        message: warnMsg,
        highlightColor: '#ef4444',
      });

      this.setTicker(`🛑 LİMİT UYARISI: ${payload.symbol} $${payload.attemptedSizeUsd} engellendi!`);
    });

    // 9. Liquidation Risk Warnings
    wsService.on<LiquidationRiskWarningPayload>('LIQUIDATION_RISK_WARNING', (payload) => {
      const liqMsg = `LİKİDASYON RİSKİ: ${payload.symbol} (%${payload.distancePercent} kaldı, Liq: $${payload.liquidationPrice})`;
      this.addStreamItem({
        type: 'RISK',
        source: 'Likidasyon Radarı',
        roomTitle: 'Risk Odası',
        avatarIcon: '⚠️',
        message: liqMsg,
        highlightColor: '#f97316',
      });

      this.setTicker(`⚠️ ${payload.warningMessage || liqMsg}`);
    });

    // 10. Portfolio Updates
    wsService.on<PortfolioUpdatePayload>('PORTFOLIO_UPDATE', (payload) => {
      this.totalBalanceUsd = payload.totalBalanceUsd;
      this.openPositionsCount = payload.positions.length;
      this.portfolioListeners.forEach((fn) => fn({ balance: this.totalBalanceUsd, count: this.openPositionsCount }));
    });

    // 11. System Status Initial Snapshot
    wsService.on<SystemStatusPayload>('SYSTEM_STATUS', (payload) => {
      if (payload.currentSceneSeverity) {
        this.severity = payload.currentSceneSeverity.label as SceneSeverity;
        this.severityListeners.forEach((fn) => fn(this.severity));
      }
      if (payload.portfolioSummary) {
        this.totalBalanceUsd = payload.portfolioSummary.totalUsd;
        this.openPositionsCount = payload.portfolioSummary.openPositionsCount;
        this.portfolioListeners.forEach((fn) => fn({ balance: this.totalBalanceUsd, count: this.openPositionsCount }));
      }
    });
  }

  public setAgentState(role: AgentRole, state: AgentState, task?: string): void {
    const agent = this.agents.get(role);
    if (!agent) return;

    agent.state = state;
    if (task) {
      agent.currentTask = task;
    }
    agent.actionsCount++;

    this.agentListeners.forEach((fn) => fn({ role, state, task }));
  }

  public getRoomStatusColor(roomKey: string): number {
    const room = ROOMS.find((r) => r.key === roomKey);
    if (!room) return 0x10b981;

    let hasAlert = false;
    let hasTrading = false;
    let hasAnalyzing = false;

    room.agentRoles.forEach((role) => {
      const agent = this.agents.get(role);
      if (agent) {
        if (agent.state === 'ALERTING') hasAlert = true;
        if (agent.state === 'TRADING') hasTrading = true;
        if (agent.state === 'ANALYZING') hasAnalyzing = true;
      }
    });

    if (hasAlert) return 0xef4444; // Red
    if (hasTrading) return 0xf59e0b; // Gold
    if (hasAnalyzing) return 0x38bdf8; // Sky Blue
    return 0x10b981; // Green
  }

  public setTicker(message: string): void {
    this.latestTicker = message;
    this.tickerListeners.forEach((fn) => fn(message));
  }

  public onAgentStateChange(fn: Listener<{ role: AgentRole; state: AgentState; task?: string }>): () => void {
    this.agentListeners.add(fn);
    return () => this.agentListeners.delete(fn);
  }

  public onSeverityChange(fn: Listener<SceneSeverity>): () => void {
    this.severityListeners.add(fn);
    return () => this.severityListeners.delete(fn);
  }

  public onProposal(fn: Listener<TradeProposalPayload>): () => void {
    this.proposalListeners.add(fn);
    return () => this.proposalListeners.delete(fn);
  }

  public onTickerChange(fn: Listener<string>): () => void {
    this.tickerListeners.add(fn);
    return () => this.tickerListeners.delete(fn);
  }

  public onStreamUpdate(fn: Listener<LiveStreamItem[]>): () => void {
    this.streamListeners.add(fn);
    return () => this.streamListeners.delete(fn);
  }

  public onStatusChange(fn: Listener<'ONLINE' | 'CONNECTING' | 'OFFLINE'>): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  public onPortfolioChange(fn: Listener<{ balance: number; count: number }>): () => void {
    this.portfolioListeners.add(fn);
    return () => this.portfolioListeners.delete(fn);
  }

  public async fetchInitialState(): Promise<void> {
    try {
      // 1. Initial State
      const state = await apiService.fetchSystemState();
      if (state) {
        if (state.currentSceneSeverity) {
          this.severity = state.currentSceneSeverity.label as SceneSeverity;
          this.severityListeners.forEach((fn) => fn(this.severity));
        }
        if (state.portfolioSummary) {
          this.totalBalanceUsd = state.portfolioSummary.totalUsd;
          this.openPositionsCount = state.portfolioSummary.openPositionsCount;
          this.portfolioListeners.forEach((fn) => fn({ balance: this.totalBalanceUsd, count: this.openPositionsCount }));
        }
        if (state.agents) {
          Object.values(state.agents).forEach((a: any) => {
            if (this.agents.has(a.role)) {
              const cur = this.agents.get(a.role)!;
              cur.state = a.state;
              cur.currentTask = a.currentTask;
              if (a.confidence !== undefined) cur.confidence = a.confidence;
            }
          });
        }
      }

      // 2. Fetch Initial News to populate streamHistory
      const newsList = await apiService.fetchNews();
      if (Array.isArray(newsList) && newsList.length > 0) {
        newsList.slice(0, 15).reverse().forEach((item: any) => {
          this.addStreamItem({
            type: 'NEWS',
            source: 'Haber Takip',
            roomTitle: 'Haber Odası',
            avatarIcon: '📰',
            message: `[${(item.category || 'HABER').toUpperCase()}] ${item.title}`,
            category: item.category,
            highlightColor: '#facc15',
          });
        });
      } else {
        // Default welcoming stream item
        this.addStreamItem({
          type: 'SYSTEM',
          source: 'Merkez Sunucu',
          roomTitle: 'Lobi & Ana Merkez',
          avatarIcon: '⚡',
          message: 'Tüm 15 Ajan odaları aktif. Haber akışı ve ajan diyalogları canlı dinleniyor.',
          highlightColor: '#10b981',
        });
      }
    } catch (err) {
      console.warn('[GameState] Could not fetch initial state:', err);
    }
  }
}

export const gameState = new GameStateManager();
