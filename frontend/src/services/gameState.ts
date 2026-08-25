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

type Listener<T> = (data: T) => void;

class GameStateManager {
  public agents: Map<AgentRole, AgentStateData> = new Map();
  public severity: SceneSeverity = 'HAFİF';
  public severityScore = 1.0;
  public severityReason = 'Piyasalar sakin';
  public totalBalanceUsd = 10000;
  public openPositionsCount = 0;
  public latestProposal: TradeProposalPayload | null = null;
  public latestTicker = 'Sistem hazır. 15 Ajan odalarında izleme yapıyor...';
  public wsStatus: 'ONLINE' | 'CONNECTING' | 'OFFLINE' = 'OFFLINE';

  private agentListeners: Set<Listener<{ role: AgentRole; state: AgentState; task?: string }>> = new Set();
  private severityListeners: Set<Listener<SceneSeverity>> = new Set();
  private proposalListeners: Set<Listener<TradeProposalPayload>> = new Set();
  private tickerListeners: Set<Listener<string>> = new Set();
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

  private initWebSocketListeners(): void {
    wsService.onStatusChange((status) => {
      this.wsStatus = status === 'CONNECTED' ? 'ONLINE' : status === 'CONNECTING' ? 'CONNECTING' : 'OFFLINE';
      this.statusListeners.forEach((fn) => fn(this.wsStatus));
    });

    wsService.on<AgentActionPayload>('AGENT_ACTION', (payload) => {
      const stateMap: Record<string, AgentState> = {
        STARTED: 'ANALYZING',
        COMPLETED: 'IDLE',
        FAILED: 'ALERTING',
        WAITING: 'IDLE',
      };
      const newState = stateMap[payload.status] || 'IDLE';
      this.setAgentState(payload.agentRole, newState, payload.details);
    });

    wsService.on<SceneSeverityPayload>('SCENE_SEVERITY_UPDATE', (payload) => {
      this.severity = payload.severityLabel;
      this.severityScore = payload.impactScore;
      this.severityReason = payload.primaryReason;
      this.severityListeners.forEach((fn) => fn(this.severity));
      this.setTicker(`[${payload.severityLabel}] ${payload.primaryReason}`);
    });

    wsService.on<RiskConfidencePayload>('RISK_CONFIDENCE_UPDATE', (payload) => {
      const riskAgent = this.agents.get('Risk Analisti');
      if (riskAgent) {
        riskAgent.confidence = payload.confidenceScore;
        this.setAgentState('Risk Analisti', 'ANALYZING', `Güven: %${Math.round(payload.confidenceScore * 100)}`);
      }
      this.setTicker(`🛡️ Risk Analisti: Güven %${Math.round(payload.confidenceScore * 100)}`);
    });

    wsService.on<SpendingLimitWarningPayload>('SPENDING_LIMIT_WARNING', (payload) => {
      this.setAgentState('Binance İşlemci', 'ALERTING', `🛑 Limit Aşımı: ${payload.symbol}`);
      this.setAgentState('Likidite Gözlemcisi', 'ALERTING', `🛑 Likidite Uyarısı: ${payload.symbol}`);
      this.setTicker(`🛑 LİMİT UYARISI: ${payload.symbol} $${payload.attemptedSizeUsd} engellendi!`);
    });

    wsService.on<PortfolioUpdatePayload>('PORTFOLIO_UPDATE', (payload) => {
      this.totalBalanceUsd = payload.totalBalanceUsd;
      this.openPositionsCount = payload.positions.length;
      this.portfolioListeners.forEach((fn) => fn({ balance: this.totalBalanceUsd, count: this.openPositionsCount }));
    });

    wsService.on<NewNewsPayload>('NEW_NEWS', (payload) => {
      this.setAgentState('Haber Takip', 'ALERTING', payload.title);
      this.setTicker(`📰 [${payload.category}] ${payload.title}`);
    });

    wsService.on<SignalGeneratedPayload>('SIGNAL_GENERATED', (payload) => {
      if (payload.action !== 'HOLD') {
        this.setAgentState('Sinyal Avcısı', 'TRADING', `${payload.action} ${payload.symbol} (Skor: ${payload.signalScore})`);
        this.setTicker(`⚡ Sinyal: ${payload.action} ${payload.symbol} | Skor: ${payload.signalScore}/100`);
      }
    });

    wsService.on<TradeProposalPayload>('TRADE_PROPOSAL', (payload) => {
      this.latestProposal = payload;
      this.setAgentState('Patron', 'TRADING', `${payload.symbol} için ${payload.side} onayı bekleniyor`);
      this.proposalListeners.forEach((fn) => fn(payload));
      this.setTicker(`🎩 PATRON ÖNERİSİ: ${payload.side} ${payload.symbol} ($${payload.suggestedAmountUsd || payload.estimatedAmountUsd || 50})`);
    });

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
    } catch (err) {
      console.warn('[GameState] Could not fetch initial state:', err);
    }
  }
}

export const gameState = new GameStateManager();
