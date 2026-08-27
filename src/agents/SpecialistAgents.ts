import { AgentRole, AgentState, EventType } from '../config/constants.js';
import { AgentInfo } from '../types/agent.js';
import { eventBus } from '../events/EventBus.js';
import {
  NewNewsPayload,
  SignalGeneratedPayload,
  SpendingLimitWarningPayload,
  OrderSimulatedPayload,
  TradeProposalPayload,
} from '../types/events.js';

export function createSpecialistAgentInfos(): Partial<Record<AgentRole, AgentInfo>> {
  return {
    [AgentRole.BTC_ANALYST]: {
      role: AgentRole.BTC_ANALYST,
      name: 'BTC Analisti',
      avatarIcon: '₿',
      state: AgentState.IDLE,
      currentTask: 'Bitcoin zincir üstü ve piyasa haberleri izleniyor',
      lastActive: new Date().toISOString(),
      stats: { actionsCount: 0, customMetric: '0 BTC analizi' },
    },
    [AgentRole.ETH_ANALYST]: {
      role: AgentRole.ETH_ANALYST,
      name: 'ETH Analisti',
      avatarIcon: 'Ξ',
      state: AgentState.IDLE,
      currentTask: 'Ethereum ekosistemi ve L2 hareketleri taranıyor',
      lastActive: new Date().toISOString(),
      stats: { actionsCount: 0, customMetric: '0 ETH analizi' },
    },
    [AgentRole.SOL_ANALYST]: {
      role: AgentRole.SOL_ANALYST,
      name: 'SOL Analisti',
      avatarIcon: '◎',
      state: AgentState.IDLE,
      currentTask: 'Solana ağ aktivitesi ve DeFi hacmi takip ediliyor',
      lastActive: new Date().toISOString(),
      stats: { actionsCount: 0, customMetric: '0 SOL analizi' },
    },
    [AgentRole.MACRO_ECONOMIST]: {
      role: AgentRole.MACRO_ECONOMIST,
      name: 'Makro Ekonomist',
      avatarIcon: '🌍',
      state: AgentState.IDLE,
      currentTask: 'Fed, faiz, jeopolitik ve küresel likidite izleniyor',
      lastActive: new Date().toISOString(),
      stats: { actionsCount: 0, customMetric: '0 makro rapor' },
    },
    [AgentRole.WHALE_TRACKER]: {
      role: AgentRole.WHALE_TRACKER,
      name: 'Whale Takipçisi',
      avatarIcon: '🐋',
      state: AgentState.IDLE,
      currentTask: 'Büyük cüzdan transferleri ve yüksek etkili olaylar radarda',
      lastActive: new Date().toISOString(),
      stats: { actionsCount: 0, customMetric: '0 balina uyarısı' },
    },
    [AgentRole.REGULATORY_WATCHER]: {
      role: AgentRole.REGULATORY_WATCHER,
      name: 'Düzenleyici İzleyici',
      avatarIcon: '⚖️',
      state: AgentState.IDLE,
      currentTask: 'SEC, regülasyon, lisans ve yasal kararlar taranıyor',
      lastActive: new Date().toISOString(),
      stats: { actionsCount: 0, customMetric: '0 yasal analiz' },
    },
    [AgentRole.TECHNICAL_ANALYST]: {
      role: AgentRole.TECHNICAL_ANALYST,
      name: 'Teknik Analist',
      avatarIcon: '📐',
      state: AgentState.IDLE,
      currentTask: 'Fiyat momentumu, trend kırılımları ve osilatörler takipte',
      lastActive: new Date().toISOString(),
      stats: { actionsCount: 0, customMetric: '0 teknik rapor' },
    },
    [AgentRole.LIQUIDITY_OBSERVER]: {
      role: AgentRole.LIQUIDITY_OBSERVER,
      name: 'Likidite Gözlemcisi',
      avatarIcon: '💧',
      state: AgentState.IDLE,
      currentTask: 'Emir defteri derinliği ve limit sınırları denetleniyor',
      lastActive: new Date().toISOString(),
      stats: { actionsCount: 0, customMetric: '0 likidite analizi' },
    },
    [AgentRole.SECRETARY]: {
      role: AgentRole.SECRETARY,
      name: 'Sekreterya',
      avatarIcon: '📋',
      state: AgentState.IDLE,
      currentTask: 'Ajan operasyon özetleri ve kayıt defteri tutuluyor',
      lastActive: new Date().toISOString(),
      stats: { actionsCount: 0, customMetric: '0 operasyon özeti' },
    },
    [AgentRole.OPS_ASSISTANT]: {
      role: AgentRole.OPS_ASSISTANT,
      name: 'Görev Takipçisi',
      avatarIcon: '📌',
      state: AgentState.IDLE,
      currentTask: 'Tüm odalardaki 15+ ajanın anlık görevleri ve alarmları kayıt altında',
      lastActive: new Date().toISOString(),
      stats: { actionsCount: 0, customMetric: '0 görev kaydedildi' },
    },
    [AgentRole.EXECUTIVE_BRIEFER]: {
      role: AgentRole.EXECUTIVE_BRIEFER,
      name: 'Baş Danışman',
      avatarIcon: '🧠',
      state: AgentState.IDLE,
      currentTask: 'Kaçırılan haberler, DEFCON ve piyasa brifingi hazır',
      lastActive: new Date().toISOString(),
      stats: { actionsCount: 0, customMetric: '0 yönetici brifingi' },
    },
  };
}

export class SpecialistAgentsManager {
  private updateAgentStateFn: (role: AgentRole, state: AgentState, currentTask: string) => void;
  private emitAgentActionFn: (
    role: AgentRole,
    actionName: string,
    status: 'STARTED' | 'COMPLETED' | 'FAILED' | 'WAITING',
    details: string
  ) => void;

  private totalEventsProcessed = 0;
  private newsCount = 0;
  private signalsCount = 0;
  private ordersCount = 0;

  constructor(
    updateAgentState: (role: AgentRole, state: AgentState, currentTask: string) => void,
    emitAgentAction: (
      role: AgentRole,
      actionName: string,
      status: 'STARTED' | 'COMPLETED' | 'FAILED' | 'WAITING',
      details: string
    ) => void
  ) {
    this.updateAgentStateFn = updateAgentState;
    this.emitAgentActionFn = emitAgentAction;

    this.initEventListeners();
  }

  private initEventListeners(): void {
    // 1. News Stream -> BTC, ETH, SOL, Macro, Regulatory, Whale, Secretary
    eventBus.on(EventType.NEW_NEWS, (event) => {
      const p = event.payload as NewNewsPayload;
      this.totalEventsProcessed++;
      this.newsCount++;

      const matched = p.matchedCoins || [];
      const impact = p.impact?.impactScore || 5;

      // 1. BTC Analisti
      if (matched.includes('BTC')) {
        const details = `BTC haberi: ${impact}/10 etki (${p.title.slice(0, 35)}...)`;
        this.updateAgentStateFn(AgentRole.BTC_ANALYST, AgentState.ALERTING, details);
        this.emitAgentActionFn(AgentRole.BTC_ANALYST, 'BTC Analizi', 'COMPLETED', details);
      }

      // 2. ETH Analisti
      if (matched.includes('ETH')) {
        const details = `ETH haberi: ${impact}/10 etki (${p.title.slice(0, 35)}...)`;
        this.updateAgentStateFn(AgentRole.ETH_ANALYST, AgentState.ALERTING, details);
        this.emitAgentActionFn(AgentRole.ETH_ANALYST, 'ETH Analizi', 'COMPLETED', details);
      }

      // 3. SOL Analisti
      if (matched.includes('SOL')) {
        const details = `SOL haberi: ${impact}/10 etki (${p.title.slice(0, 35)}...)`;
        this.updateAgentStateFn(AgentRole.SOL_ANALYST, AgentState.ALERTING, details);
        this.emitAgentActionFn(AgentRole.SOL_ANALYST, 'SOL Analizi', 'COMPLETED', details);
      }

      // 4. Makro Ekonomist
      if (['defcon_2', 'defcon_1', 'geopolitical', 'macro_economic'].includes(p.category)) {
        const details = `Makro gelişme: ${p.title.slice(0, 38)}... (Etki: ${impact}/10)`;
        this.updateAgentStateFn(AgentRole.MACRO_ECONOMIST, AgentState.ANALYZING, details);
        this.emitAgentActionFn(AgentRole.MACRO_ECONOMIST, 'Makroekonomik Analiz', 'COMPLETED', details);
      }

      // 5. Whale Takipçisi (impact >= 7)
      if (impact >= 7) {
        const symbol = matched[0] || 'Kripto Piyasası';
        const details = `Büyük hareket tespit edildi: ${symbol} (Etki: ${impact}/10)`;
        this.updateAgentStateFn(AgentRole.WHALE_TRACKER, AgentState.ALERTING, details);
        this.emitAgentActionFn(AgentRole.WHALE_TRACKER, 'Balina Tespiti', 'COMPLETED', details);
      }

      // 6. Düzenleyici İzleyici
      const regRegex = /(sec|yasak|regülasyon|regulation|license|lisans|binance|dava|mahkeme|fed|hazine)/i;
      if (p.category === 'crypto_specific' && regRegex.test(p.title)) {
        const details = `Regülasyon takibi: ${p.title.slice(0, 38)}...`;
        this.updateAgentStateFn(AgentRole.REGULATORY_WATCHER, AgentState.ALERTING, details);
        this.emitAgentActionFn(AgentRole.REGULATORY_WATCHER, 'Yasal İnceleme', 'COMPLETED', details);
      }

      this.checkSecretarySummary();
    });

    // 2. Signals Stream -> Technical Analyst & Whale & Secretary
    eventBus.on(EventType.SIGNAL_GENERATED, (event) => {
      const p = event.payload as SignalGeneratedPayload;
      this.totalEventsProcessed++;
      this.signalsCount++;

      // 7. Teknik Analist
      const momentum = p.breakdown?.priceMomentumScore ?? 50;
      const details = `Momentum: ${momentum}/100 (${p.symbol} ${p.action})`;
      this.updateAgentStateFn(AgentRole.TECHNICAL_ANALYST, AgentState.ANALYZING, details);
      this.emitAgentActionFn(AgentRole.TECHNICAL_ANALYST, 'Teknik Momentum', 'COMPLETED', details);

      // High Score -> Whale reaction
      if (p.signalScore >= 80) {
        const whaleDetails = `Büyük hareket tespit edildi: ${p.symbol} (Sinyal Skoru: ${p.signalScore})`;
        this.updateAgentStateFn(AgentRole.WHALE_TRACKER, AgentState.ALERTING, whaleDetails);
        this.emitAgentActionFn(AgentRole.WHALE_TRACKER, 'Yüksek Hacim Sinyali', 'COMPLETED', whaleDetails);
      }

      this.checkSecretarySummary();
    });

    // 3. Orders Stream -> Liquidity Observer & Secretary
    eventBus.on(EventType.ORDER_SIMULATED, (event) => {
      const p = event.payload as OrderSimulatedPayload;
      this.totalEventsProcessed++;
      this.ordersCount++;

      // 8. Likidite Gözlemcisi
      const details = `Likidite onayı: ${p.side} ${p.symbol} ($${p.totalUsd})`;
      this.updateAgentStateFn(AgentRole.LIQUIDITY_OBSERVER, AgentState.ANALYZING, details);
      this.emitAgentActionFn(AgentRole.LIQUIDITY_OBSERVER, 'Likidite Denetimi', 'COMPLETED', details);

      this.checkSecretarySummary();
    });

    eventBus.on(EventType.SPENDING_LIMIT_WARNING, (event) => {
      const p = event.payload as SpendingLimitWarningPayload;
      this.totalEventsProcessed++;

      // 8. Likidite Gözlemcisi (Limit Warning)
      const details = `Likidite/Limit uyarısı: ${p.symbol} ($${p.attemptedSizeUsd})`;
      this.updateAgentStateFn(AgentRole.LIQUIDITY_OBSERVER, AgentState.ALERTING, details);
      this.emitAgentActionFn(AgentRole.LIQUIDITY_OBSERVER, 'Limit Aşım Uyarısı', 'COMPLETED', details);

      this.checkSecretarySummary();
    });

    eventBus.on(EventType.TRADE_PROPOSAL, () => {
      this.totalEventsProcessed++;
      this.checkSecretarySummary();
    });
  }

  // 9. Sekreterya & Kişisel Asistan Takımı (Görev Takipçisi & Baş Danışman)
  private checkSecretarySummary(): void {
    if (this.totalEventsProcessed % 8 === 0) {
      const details = `Son dönemde ${this.newsCount} haber, ${this.signalsCount} sinyal, ${this.ordersCount} işlem işlendi.`;
      this.updateAgentStateFn(AgentRole.SECRETARY, AgentState.ANALYZING, details);
      this.emitAgentActionFn(AgentRole.SECRETARY, 'Operasyon Özeti', 'COMPLETED', details);

      // Görev Takipçisi
      const taskDetails = `Kaptan için tüm odaların ${this.totalEventsProcessed} operasyon kaydı arşivlendi.`;
      this.updateAgentStateFn(AgentRole.OPS_ASSISTANT, AgentState.ANALYZING, taskDetails);
      this.emitAgentActionFn(AgentRole.OPS_ASSISTANT, 'Görev Takip Denetimi', 'COMPLETED', taskDetails);

      // Baş Danışman
      const execDetails = `Yönetici brifingi güncellendi: ${this.newsCount} haber analiz edildi, piyasa nabzı hazır.`;
      this.updateAgentStateFn(AgentRole.EXECUTIVE_BRIEFER, AgentState.ANALYZING, execDetails);
      this.emitAgentActionFn(AgentRole.EXECUTIVE_BRIEFER, 'Yönetici Brifingi', 'COMPLETED', execDetails);
    }
  }
}
