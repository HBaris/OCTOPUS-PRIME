import { AgentRole, AgentState, EventType, SceneSeverity } from '../config/constants.js';
import { AgentInfo, SystemState } from '../types/agent.js';
import { eventBus } from '../events/EventBus.js';
import { BinanceService } from '../services/binance/BinanceService.js';
import { CorrelationTracker } from '../services/correlation/CorrelationTracker.js';
import { logger } from '../utils/logger.js';

export class AgentManager {
  private agents: Record<AgentRole, AgentInfo>;
  private currentSeverity: { label: string; score: number } = {
    label: SceneSeverity.HAFIF,
    score: 1.0,
  };
  private binanceService: BinanceService;
  private correlationTracker: CorrelationTracker;

  constructor(binanceService: BinanceService, correlationTracker: CorrelationTracker) {
    this.binanceService = binanceService;
    this.correlationTracker = correlationTracker;

    this.agents = {
      [AgentRole.NEWS_TRACKER]: {
        role: AgentRole.NEWS_TRACKER,
        name: 'Haber Takip Subayı',
        avatarIcon: '📰',
        state: AgentState.IDLE,
        currentTask: 'RSS ve haber akışları taranıyor',
        lastActive: new Date().toISOString(),
        stats: { actionsCount: 0, customMetric: '0 haber tarandı' },
      },
      [AgentRole.BINANCE_TRADER]: {
        role: AgentRole.BINANCE_TRADER,
        name: 'Binance İşlem Operatörü',
        avatarIcon: '🤖',
        state: AgentState.IDLE,
        currentTask: 'Testnet emirleri ve bakiye senkronizasyonu',
        lastActive: new Date().toISOString(),
        stats: { actionsCount: 0, customMetric: '0 işlem açıldı' },
      },
      [AgentRole.RISK_ANALYST]: {
        role: AgentRole.RISK_ANALYST,
        name: 'Risk Analisti',
        avatarIcon: '🛡️',
        state: AgentState.IDLE,
        currentTask: 'Korelasyon ve volatilite takibi',
        lastActive: new Date().toISOString(),
        confidence: 0.75,
        stats: { actionsCount: 0, customMetric: 'Güven: %75' },
      },
      [AgentRole.PORTFOLIO_ACCOUNTANT]: {
        role: AgentRole.PORTFOLIO_ACCOUNTANT,
        name: 'Portföy Muhasebecisi',
        avatarIcon: '💰',
        state: AgentState.IDLE,
        currentTask: 'PnL ve varlık dağılımı hesaplama',
        lastActive: new Date().toISOString(),
        stats: { actionsCount: 0, customMetric: 'PnL: $0.00' },
      },
      [AgentRole.SIGNAL_HUNTER]: {
        role: AgentRole.SIGNAL_HUNTER,
        name: 'Sinyal Avcısı',
        avatarIcon: '⚡',
        state: AgentState.IDLE,
        currentTask: 'Yüksek skorlu işlem fırsatları izleniyor',
        lastActive: new Date().toISOString(),
        stats: { actionsCount: 0, customMetric: '0 sinyal üretildi' },
      },
      [AgentRole.PATRON]: {
        role: AgentRole.PATRON,
        name: 'Patron',
        avatarIcon: '🎩',
        state: AgentState.IDLE,
        currentTask: 'Ekip raporları ve nihai işlem kararları koordine ediliyor',
        lastActive: new Date().toISOString(),
        stats: { actionsCount: 0, customMetric: '0 nihai karar' },
      },
    };

    this.initEventListeners();
  }

  private initEventListeners(): void {
    // 1. News Tracker reacts to NEW_NEWS
    eventBus.on(EventType.NEW_NEWS, (event) => {
      this.updateAgentState(
        AgentRole.NEWS_TRACKER,
        AgentState.ALERTING,
        `Yeni haber incelendi: ${event.payload.title.slice(0, 40)}...`
      );
      this.agents[AgentRole.NEWS_TRACKER].stats.actionsCount++;
      this.agents[AgentRole.NEWS_TRACKER].stats.customMetric = `${this.agents[AgentRole.NEWS_TRACKER].stats.actionsCount} haber tarandı`;

      this.emitAgentAction(
        AgentRole.NEWS_TRACKER,
        'Haber İncelemesi',
        'COMPLETED',
        `Kategori: ${event.payload.category} | Etki: ${event.payload.impact.impactScore}/10`
      );
    });

    // 2. Signal Hunter reacts to SIGNAL_GENERATED
    eventBus.on(EventType.SIGNAL_GENERATED, (event) => {
      const p = event.payload;
      this.updateAgentState(
        AgentRole.SIGNAL_HUNTER,
        p.action !== 'HOLD' ? AgentState.ALERTING : AgentState.ANALYZING,
        `Sinyal üretildi: ${p.symbol} (${p.action} - Skor: ${p.signalScore})`
      );
      this.agents[AgentRole.SIGNAL_HUNTER].stats.actionsCount++;
      this.agents[AgentRole.SIGNAL_HUNTER].stats.customMetric = `${this.agents[AgentRole.SIGNAL_HUNTER].stats.actionsCount} sinyal üretildi`;

      this.emitAgentAction(
        AgentRole.SIGNAL_HUNTER,
        'Sinyal Analizi',
        'COMPLETED',
        `${p.symbol} için ${p.action} sinyali (Skor: ${p.signalScore})`
      );
    });

    // 3. Risk Analyst reacts to RISK_CONFIDENCE_UPDATE
    eventBus.on(EventType.RISK_CONFIDENCE_UPDATE, (event) => {
      const p = event.payload;
      this.updateAgentState(
        AgentRole.RISK_ANALYST,
        AgentState.ANALYZING,
        `Güven seviyesi güncellendi: %${Math.round(p.confidenceScore * 100)}`
      );
      this.agents[AgentRole.RISK_ANALYST].confidence = p.confidenceScore;
      this.agents[AgentRole.RISK_ANALYST].stats.customMetric = `Güven: %${Math.round(p.confidenceScore * 100)}`;
      this.agents[AgentRole.RISK_ANALYST].stats.actionsCount++;

      this.emitAgentAction(
        AgentRole.RISK_ANALYST,
        'Risk & Korelasyon Analizi',
        'COMPLETED',
        `Doğruluk: %${Math.round(p.accuracyRate * 100)} (${p.analystComment})`
      );
    });

    // 4. Scene Severity updates
    eventBus.on(EventType.SCENE_SEVERITY_UPDATE, (event) => {
      this.currentSeverity = {
        label: event.payload.severityLabel,
        score: event.payload.impactScore,
      };
    });

    // 5. Binance Trader & Portfolio Accountant on simulated/executed orders
    eventBus.on(EventType.ORDER_SIMULATED, (event) => {
      const p = event.payload;
      this.updateAgentState(
        AgentRole.BINANCE_TRADER,
        AgentState.TRADING,
        `Simüle Emir: ${p.side} ${p.symbol} ($${p.totalUsd})`
      );
      this.agents[AgentRole.BINANCE_TRADER].stats.actionsCount++;
      this.agents[AgentRole.BINANCE_TRADER].stats.customMetric = `${this.agents[AgentRole.BINANCE_TRADER].stats.actionsCount} simüle işlem`;

      this.emitAgentAction(
        AgentRole.BINANCE_TRADER,
        'Emir Simülasyonu',
        'COMPLETED',
        `${p.side} ${p.amount} ${p.symbol} @ $${p.price}`
      );
    });

    // 6. Portfolio Update
    eventBus.on(EventType.PORTFOLIO_UPDATE, (event) => {
      const p = event.payload;
      this.updateAgentState(
        AgentRole.PORTFOLIO_ACCOUNTANT,
        AgentState.IDLE,
        `Bakiye: $${p.totalBalanceUsd.toFixed(2)} | PnL: $${p.totalUnrealizedPnl.toFixed(2)}`
      );
      this.agents[AgentRole.PORTFOLIO_ACCOUNTANT].stats.customMetric = `PnL: $${p.totalUnrealizedPnl.toFixed(2)}`;
    });

    // 7. Patron on TRADE_PROPOSAL
    eventBus.on(EventType.TRADE_PROPOSAL, (event) => {
      const p = event.payload;
      const details = `${p.symbol} için ${p.side} kararı onaylandı (Skor: ${p.signalScore})`;
      this.updateAgentState(
        AgentRole.PATRON,
        AgentState.TRADING,
        details
      );
      this.agents[AgentRole.PATRON].stats.actionsCount++;
      this.agents[AgentRole.PATRON].stats.customMetric = `${this.agents[AgentRole.PATRON].stats.actionsCount} nihai karar`;

      this.emitAgentAction(
        AgentRole.PATRON,
        'Nihai Karar',
        'COMPLETED',
        details
      );
    });
  }

  public updateAgentState(role: AgentRole, state: AgentState, currentTask: string): void {
    if (this.agents[role]) {
      this.agents[role].state = state;
      this.agents[role].currentTask = currentTask;
      this.agents[role].lastActive = new Date().toISOString();
    }
  }

  private emitAgentAction(
    agentRole: AgentRole,
    actionName: string,
    status: 'STARTED' | 'COMPLETED' | 'FAILED' | 'WAITING',
    details: string
  ): void {
    eventBus.publish(EventType.AGENT_ACTION, {
      agentRole,
      actionName,
      status,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  public async getSystemState(): Promise<SystemState> {
    const balance = await this.binanceService.getBalance();
    const positions = await this.binanceService.getPositions();

    let totalPnl = 0;
    for (const p of positions) {
      totalPnl += p.unrealizedPnl;
    }

    return {
      timestamp: new Date().toISOString(),
      agents: { ...this.agents },
      currentSceneSeverity: { ...this.currentSeverity },
      riskConfidence: {
        score: this.correlationTracker.getEmaAccuracy(),
        accuracy: this.correlationTracker.getEmaAccuracy(),
      },
      portfolioSummary: {
        totalUsd: balance.totalUsd,
        unrealizedPnl: totalPnl,
        openPositionsCount: positions.length,
      },
      recentEvents: eventBus.getRecentEvents(20),
    };
  }

  public getAgents(): Record<AgentRole, AgentInfo> {
    return { ...this.agents };
  }
}
