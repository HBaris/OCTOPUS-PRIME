import { eventBus } from '../../events/EventBus.js';
import { EventType, SceneSeverity } from '../../config/constants.js';
import {
  NewNewsPayload,
  AgentActionPayload,
  SignalGeneratedPayload,
  TradeProposalPayload,
  OrderSimulatedPayload,
  SceneSeverityPayload,
  RiskConfidencePayload,
  SpendingLimitWarningPayload,
  LiquidationRiskWarningPayload,
  PortfolioUpdatePayload,
} from '../../types/events.js';
import { logger } from '../../utils/logger.js';

export interface TaskSummaryResult {
  title: string;
  totalAgentActions: number;
  activeAgentsCount: number;
  mostActiveRoom: string;
  criticalAlertsCount: number;
  keyOperations: string[];
  agentBreakdown: Array<{ agent: string; actionCount: number; lastTask: string }>;
  summaryParagraph: string;
}

export interface ExecutiveSummaryResult {
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

export interface FullBriefingResult {
  generatedAt: string;
  sinceTimestamp: string;
  unreadCounts: {
    news: number;
    agentActions: number;
    signals: number;
    orders: number;
    alerts: number;
  };
  taskSummary: TaskSummaryResult;
  executiveSummary: ExecutiveSummaryResult;
}

export class AssistantService {
  private sinceTimestamp: string;
  private missedNews: NewNewsPayload[] = [];
  private missedAgentActions: AgentActionPayload[] = [];
  private missedSignals: SignalGeneratedPayload[] = [];
  private missedOrders: Array<OrderSimulatedPayload | any> = [];
  private missedAlerts: Array<{ type: string; message: string; timestamp: string }> = [];
  
  private currentSeverity: SceneSeverity = SceneSeverity.HAFIF;
  private severityReason = 'Piyasalar olağan seyrinde izleniyor';
  private initialBalance = 10000;
  private currentBalance = 10000;
  private openPositionsCount = 0;

  constructor() {
    this.sinceTimestamp = new Date().toISOString();
    this.initEventListeners();
    logger.info('🤵 [AssistantService] Kişisel Asistan Servisi başlatıldı (Görev Takipçisi & Baş Danışman).');
  }

  private initEventListeners(): void {
    // 1. News
    eventBus.on(EventType.NEW_NEWS, (event) => {
      const p = event.payload as NewNewsPayload;
      this.missedNews.unshift(p);
      if (this.missedNews.length > 200) this.missedNews.pop();
    });

    // 2. Agent Actions
    eventBus.on(EventType.AGENT_ACTION, (event) => {
      const p = event.payload as AgentActionPayload;
      this.missedAgentActions.unshift(p);
      if (this.missedAgentActions.length > 300) this.missedAgentActions.pop();
    });

    // 3. Signals
    eventBus.on(EventType.SIGNAL_GENERATED, (event) => {
      const p = event.payload as SignalGeneratedPayload;
      if (p.action !== 'HOLD') {
        this.missedSignals.unshift(p);
      }
    });

    // 4. Trade proposals & Orders
    eventBus.on(EventType.TRADE_PROPOSAL, (event) => {
      const p = event.payload as TradeProposalPayload;
      this.missedAlerts.unshift({
        type: 'TRADE_PROPOSAL',
        message: `Patron: ${p.side} ${p.symbol} ($${p.suggestedAmountUsd || 50}) önerisi`,
        timestamp: new Date().toISOString(),
      });
    });

    eventBus.on(EventType.ORDER_SIMULATED, (event) => {
      const p = event.payload as OrderSimulatedPayload;
      this.missedOrders.unshift(p);
    });

    eventBus.on(EventType.ORDER_EXECUTED, (event) => {
      this.missedOrders.unshift(event.payload);
    });

    // 5. Severity & Risks
    eventBus.on(EventType.SCENE_SEVERITY_UPDATE, (event) => {
      const p = event.payload as SceneSeverityPayload;
      this.currentSeverity = p.severityLabel;
      this.severityReason = p.primaryReason;
      this.missedAlerts.unshift({
        type: 'SEVERITY_UPDATE',
        message: `DEFCON ${p.severityLabel}: ${p.primaryReason}`,
        timestamp: new Date().toISOString(),
      });
    });

    eventBus.on(EventType.RISK_CONFIDENCE_UPDATE, (event) => {
      const p = event.payload as RiskConfidencePayload;
      if (p.confidenceScore < 0.6) {
        this.missedAlerts.unshift({
          type: 'RISK_CONFIDENCE',
          message: `Risk Analisti: Güven %${Math.round(p.confidenceScore * 100)} seviyesine indi!`,
          timestamp: new Date().toISOString(),
        });
      }
    });

    eventBus.on(EventType.SPENDING_LIMIT_WARNING, (event) => {
      const p = event.payload as SpendingLimitWarningPayload;
      this.missedAlerts.unshift({
        type: 'LIMIT_WARNING',
        message: `Limit Engeli: ${p.symbol} için $${p.attemptedSizeUsd} engellendi`,
        timestamp: new Date().toISOString(),
      });
    });

    eventBus.on(EventType.LIQUIDATION_RISK_WARNING, (event) => {
      const p = event.payload as LiquidationRiskWarningPayload;
      this.missedAlerts.unshift({
        type: 'LIQUIDATION_WARNING',
        message: `Likidasyon Riski: ${p.symbol} (%${p.distancePercent} mesafe)`,
        timestamp: new Date().toISOString(),
      });
    });

    // 6. Portfolio
    eventBus.on(EventType.PORTFOLIO_UPDATE, (event) => {
      const p = event.payload as PortfolioUpdatePayload;
      this.currentBalance = p.totalBalanceUsd;
      this.openPositionsCount = p.positions ? p.positions.length : 0;
    });
  }

  /**
   * Generates Task & Operations Summary (Görev Takipçisi)
   */
  public generateTaskSummary(): TaskSummaryResult {
    const totalActions = this.missedAgentActions.length;

    // Group actions by agent
    const agentMap: Record<string, { count: number; lastTask: string }> = {};
    this.missedAgentActions.forEach((act) => {
      if (!agentMap[act.agentRole]) {
        agentMap[act.agentRole] = { count: 0, lastTask: act.details || act.actionName };
      }
      agentMap[act.agentRole].count++;
    });

    const agentBreakdown = Object.entries(agentMap)
      .map(([agent, data]) => ({ agent, actionCount: data.count, lastTask: data.lastTask }))
      .sort((a, b) => b.actionCount - a.actionCount);

    // Identify active rooms
    const roomCount: Record<string, number> = {
      'Haber Odası': 0,
      'Risk Odası': 0,
      'İşlem Odası': 0,
      'Sinyal Odası': 0,
      'Portföy Odası': 0,
      'Yönetim Odası': 0,
    };

    this.missedAgentActions.forEach((act) => {
      if (['Haber Takip', 'Makro Ekonomist', 'Düzenleyici İzleyici'].includes(act.agentRole)) {
        roomCount['Haber Odası']++;
      } else if (['Risk Analisti', 'Whale Takipçisi'].includes(act.agentRole)) {
        roomCount['Risk Odası']++;
      } else if (['Binance İşlemci', 'Likidite Gözlemcisi'].includes(act.agentRole)) {
        roomCount['İşlem Odası']++;
      } else if (['Sinyal Avcısı', 'Teknik Analist'].includes(act.agentRole)) {
        roomCount['Sinyal Odası']++;
      } else if (['Portföy Muhasebecisi', 'BTC Analisti', 'ETH Analisti', 'SOL Analisti'].includes(act.agentRole)) {
        roomCount['Portföy Odası']++;
      } else if (['Patron', 'Sekreterya'].includes(act.agentRole)) {
        roomCount['Yönetim Odası']++;
      }
    });

    let mostActiveRoom = 'Haber Odası';
    let maxRoomCount = -1;
    for (const [room, count] of Object.entries(roomCount)) {
      if (count > maxRoomCount) {
        maxRoomCount = count;
        mostActiveRoom = room;
      }
    }

    const keyOperations: string[] = [];
    if (this.missedSignals.length > 0) {
      const topSig = this.missedSignals[0];
      keyOperations.push(`⚡ Sinyal Odası: ${topSig.action} ${topSig.symbol} (Skor: ${topSig.signalScore}/100) üretti.`);
    }
    if (this.missedOrders.length > 0) {
      keyOperations.push(`📝 İşlem Odası: ${this.missedOrders.length} adet emir başarıyla testnet'te yürütüldü.`);
    }
    if (this.missedAlerts.length > 0) {
      keyOperations.push(`🚨 Risk/Uyarı: ${this.missedAlerts[0].message}`);
    }
    if (keyOperations.length === 0) {
      keyOperations.push('✅ Tüm ajanlar görev yerlerinde rutin piyasa taraması gerçekleştirdi.');
    }

    // Summary paragraph
    let summaryParagraph = `Kaptan! Siz yokken 15 uzman ajanımız toplam ${totalActions} operasyon kaydetti. `;
    summaryParagraph += `En yoğun hareketlilik ${mostActiveRoom}'nda gerçekleşti (${maxRoomCount > 0 ? maxRoomCount : 0} işlem/diyalog). `;
    if (this.missedSignals.length > 0) {
      summaryParagraph += `Sinyal Avcısı ${this.missedSignals.length} işlem fırsatı yakaladı. `;
    }
    if (this.missedAlerts.length > 0) {
      summaryParagraph += `Toplam ${this.missedAlerts.length} kritik uyarı kayda geçti. `;
    } else {
      summaryParagraph += `Herhangi bir limit aşımı veya acil kriz uyarısı yaşanmadı. `;
    }

    return {
      title: '📌 Görev Takipçisi Raporu (Ajan Operasyonları)',
      totalAgentActions: totalActions,
      activeAgentsCount: agentBreakdown.length,
      mostActiveRoom,
      criticalAlertsCount: this.missedAlerts.length,
      keyOperations,
      agentBreakdown,
      summaryParagraph,
    };
  }

  /**
   * Generates General Market & News Summary (Baş Danışman)
   */
  public generateExecutiveSummary(): ExecutiveSummaryResult {
    const totalNews = this.missedNews.length;

    // Categories
    const categoryBreakdown: Record<string, number> = {};
    this.missedNews.forEach((n) => {
      const cat = n.category || 'crypto_specific';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });

    // Top headlines
    const topHeadlines = this.missedNews.slice(0, 3).map((n) => ({
      title: n.title,
      category: n.category || 'Haber',
      impactScore: n.impact?.impactScore || 5,
      sentiment: n.sentiment?.label || 'NEUTRAL',
    }));

    const pnlUsd = this.currentBalance - this.initialBalance;

    // Captain Takeaway
    let captainTakeaway = '';
    if (this.currentSeverity === SceneSeverity.KATASTROFIK || this.currentSeverity === SceneSeverity.COK_AGIR) {
      captainTakeaway = '⚠️ DİKKAT: Global piyasalarda yüksek volatilite ve DEFCON alarmı mevcut. Yeni pozisyon alımları sınırlandırılmalı, stop-loss seviyeleri sıkılaştırılmalıdır.';
    } else if (this.missedSignals.length > 0 && pnlUsd >= 0) {
      captainTakeaway = '🚀 PİYASA FIRSATI: Yüksek skorlu sinyaller aktif ve kasa kârda seyrediyor. İşlem Odası ve Patron onayları değerlendirilebilir.';
    } else {
      captainTakeaway = '🛡️ DENGELİ SEYİR: Piyasalar sakin ve risk parametreleri güvenli aralıkta. Ajanlarımız teyakkuzda fırsat kolluyor.';
    }

    let summaryParagraph = `Kaptan! Siz yokken radarlarımıza ${totalNews} yeni haber yansıdı. `;
    if (topHeadlines.length > 0) {
      summaryParagraph += `Öne çıkan başlık: "${topHeadlines[0].title.slice(0, 60)}..." (${topHeadlines[0].sentiment}). `;
    }
    summaryParagraph += `Mevcut ortam seviyesi [${this.currentSeverity}] (${this.severityReason}). `;
    summaryParagraph += `Toplam kasa bakiyeniz $${this.currentBalance.toLocaleString()} (${pnlUsd >= 0 ? '+' : ''}$${pnlUsd.toFixed(2)}), açık pozisyon adedi: ${this.openPositionsCount}.`;

    return {
      title: '🧠 Baş Danışman Brifingi (Genel Durum & İstihbarat)',
      totalMissedNews: totalNews,
      categoryBreakdown,
      topHeadlines,
      currentSeverity: this.currentSeverity,
      severityReason: this.severityReason,
      portfolioSummary: {
        currentBalance: this.currentBalance,
        initialBalance: this.initialBalance,
        pnlUsd,
        openPositionsCount: this.openPositionsCount,
      },
      captainTakeaway,
      summaryParagraph,
    };
  }

  /**
   * Returns Full Combined Briefing
   */
  public getFullBriefing(): FullBriefingResult {
    return {
      generatedAt: new Date().toISOString(),
      sinceTimestamp: this.sinceTimestamp,
      unreadCounts: {
        news: this.missedNews.length,
        agentActions: this.missedAgentActions.length,
        signals: this.missedSignals.length,
        orders: this.missedOrders.length,
        alerts: this.missedAlerts.length,
      },
      taskSummary: this.generateTaskSummary(),
      executiveSummary: this.generateExecutiveSummary(),
    };
  }

  /**
   * Resets unread events counter snapshot
   */
  public markAsRead(): { success: boolean; message: string; sinceTimestamp: string } {
    this.sinceTimestamp = new Date().toISOString();
    this.missedNews = [];
    this.missedAgentActions = [];
    this.missedSignals = [];
    this.missedOrders = [];
    this.missedAlerts = [];
    this.initialBalance = this.currentBalance;

    logger.info('✅ [AssistantService] Brifing okundu olarak işaretlendi ve sayaçlar sıfırlandı.');

    return {
      success: true,
      message: 'Brifing okundu olarak işaretlendi. Yeni takip periyodu başladı.',
      sinceTimestamp: this.sinceTimestamp,
    };
  }
}
