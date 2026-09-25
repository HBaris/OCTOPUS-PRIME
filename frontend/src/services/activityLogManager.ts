import { wsService } from './websocket.ts';
import { apiService } from './api.ts';
import {
  AgentActionPayload,
  SceneSeverityPayload,
  RiskConfidencePayload,
  SpendingLimitWarningPayload,
  PortfolioUpdatePayload,
  NewNewsPayload,
  SignalGeneratedPayload,
  TradeProposalPayload,
  TechnicalSignalPayload,
  LiquidationRiskWarningPayload,
} from '../types/events.ts';

import { chatAssistantManager } from './chatAssistantManager.ts';

export type LogCategory = 'ALL' | 'TRADE' | 'SIGNAL' | 'MANAGEMENT' | 'NEWS' | 'RISK' | 'SYSTEM';

export interface ActivityLogItem {
  id: string;
  time: string;
  isoDate: string;
  category: 'TRADE' | 'SIGNAL' | 'MANAGEMENT' | 'NEWS' | 'RISK' | 'SYSTEM';
  agentRole?: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  title: string;
  details: string;
}

export class ActivityLogManager {
  private logs: ActivityLogItem[] = [];
  private activeCategory: LogCategory = 'ALL';
  private searchQuery: string = '';
  private autoScroll: boolean = true;
  private isDrawerOpen: boolean = false;

  // DOM Elements
  private logDrawerEl!: HTMLElement;
  private logListEl!: HTMLElement;
  private logBadgeEl!: HTMLElement;
  private filterButtons: Map<LogCategory, HTMLButtonElement> = new Map();

  constructor() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  private init(): void {
    this.createTopHeaderBar();
    this.createLogDrawerUI();
    this.setupEventListeners();
    this.addInitialWelcomeLog();
    this.syncInitialPortfolio();
  }

  private formatCurrentTime(): string {
    const d = new Date();
    return d.toTimeString().split(' ')[0];
  }

  public addLog(
    category: ActivityLogItem['category'],
    title: string,
    details: string,
    agentRole?: string,
    customBadge?: string
  ): void {
    let badge = customBadge || category;
    let badgeBg = '#1e293b';
    let badgeColor = '#94a3b8';

    switch (category) {
      case 'TRADE':
        badge = customBadge || 'İŞLEM';
        badgeBg = 'rgba(16, 185, 129, 0.2)';
        badgeColor = '#10b981';
        break;
      case 'SIGNAL':
        badge = customBadge || 'SİNYAL';
        badgeBg = 'rgba(245, 158, 11, 0.2)';
        badgeColor = '#f59e0b';
        break;
      case 'MANAGEMENT':
        badge = customBadge || 'PATRON';
        badgeBg = 'rgba(217, 119, 6, 0.25)';
        badgeColor = '#fbbf24';
        break;
      case 'NEWS':
        badge = customBadge || 'HABER';
        badgeBg = 'rgba(56, 189, 248, 0.2)';
        badgeColor = '#38bdf8';
        break;
      case 'RISK':
        badge = customBadge || 'RİSK';
        badgeBg = 'rgba(239, 68, 68, 0.25)';
        badgeColor = '#f87171';
        break;
      case 'SYSTEM':
        badge = customBadge || 'SİSTEM';
        badgeBg = 'rgba(148, 163, 184, 0.2)';
        badgeColor = '#cbd5e1';
        break;
    }

    const item: ActivityLogItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      time: this.formatCurrentTime(),
      isoDate: new Date().toISOString(),
      category,
      agentRole,
      badge,
      badgeBg,
      badgeColor,
      title,
      details,
    };

    this.logs.unshift(item); // Newest on top
    if (this.logs.length > 500) this.logs.pop();

    this.updateLogBadge();
    this.renderFilteredLogs();
  }

  private addInitialWelcomeLog(): void {
    this.addLog(
      'SYSTEM',
      'Octopus Prime Kripto Ticaret Odası Başlatıldı',
      '12 Özel Ajan devrede. Binance Testnet & OKX haber akışı ve risk kontrolü aktif.',
      'Sistem'
    );
  }

  private async syncInitialPortfolio(): Promise<void> {
    const portfolio = await apiService.fetchPortfolio();
    if (portfolio && portfolio.balance) {
      this.updateHeaderPortfolioMetrics(portfolio);
    }
  }

  private createTopHeaderBar(): void {
    let header = document.getElementById('top-header-bar');
    if (!header) {
      header = document.createElement('header');
      header.id = 'top-header-bar';
      header.className = 'top-header-bar';
      document.body.prepend(header);
    }

    header.innerHTML = `
      <div class="header-brand">
        <div class="brand-logo">
          <span class="logo-icon">🐙</span>
          <div class="brand-text">
            <div class="brand-title">OCTOPUS PRIME</div>
            <div class="brand-sub">3D CRYPTO TRADING DESK</div>
          </div>
        </div>
        <div id="header-ws-status" class="status-pill status-offline">
          <span class="pulse-dot"></span>
          <span id="ws-status-text">OFFLINE</span>
        </div>
        <div class="exchange-mode-pill">
          <span class="exchange-icon">⚡</span>
          <span>BINANCE TESTNET (10X)</span>
        </div>
      </div>

      <div class="header-metrics">
        <div class="metric-card">
          <div class="metric-label">💰 TOPLAM BAKİYE</div>
          <div id="hdr-total-balance" class="metric-value font-mono">$10,000.00</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">💵 BOŞ TEMİNAT</div>
          <div id="hdr-free-margin" class="metric-value font-mono">$10,000.00</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">📈 AÇIK PNL</div>
          <div id="hdr-open-pnl" class="metric-value font-mono text-neutral">$0.00 (0.00%)</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">🛡️ RİSK DURUMU</div>
          <div id="hdr-risk-status" class="metric-value text-green">🟢 SAKİN (%85)</div>
        </div>
      </div>

      <div class="header-actions">
        <button id="btn-toggle-ai-chat" class="hdr-action-btn btn-ai-chat" title="Octopus AI Beyni ile Sohbet Et (Ctrl+Space)">
          <span class="ai-chat-pulse"></span>
          <span>🧠 AI ASİSTAN</span>
        </button>

        <button id="btn-toggle-autotrade" class="hdr-action-btn btn-autotrade active" title="Otonom Trend & Momentum Motoru">
          <span class="autotrade-pulse"></span>
          <span id="autotrade-text">🤖 OTO-TRADE: AKTİF (%2.5)</span>
        </button>

        <button id="btn-toggle-logs" class="hdr-action-btn btn-log" title="Ajan & İşlem Log Kayıtlarını Görüntüle">
          <span>📜 LOG AKIŞI</span>
          <span id="hdr-log-count-badge" class="hdr-badge">0</span>
        </button>

        <a href="/calculator.html" target="_blank" class="hdr-action-btn btn-calc" title="Bileşik Getiri & Komisyon Simülatörü">
          <span>🧮 HESAPLAYICI</span>
        </a>

        <button id="btn-manual-signal" class="hdr-action-btn btn-trigger" title="Sinyal & Analiz Tetikle">
          <span>⚡ SİNYAL TARA</span>
        </button>
      </div>
    `;

    // Bind Header Buttons
    const aiChatBtn = document.getElementById('btn-toggle-ai-chat');
    if (aiChatBtn) {
      aiChatBtn.addEventListener('click', () => chatAssistantManager.toggleDrawer());
    }

    const autoTradeBtn = document.getElementById('btn-toggle-autotrade');
    const autoTradeText = document.getElementById('autotrade-text');
    let autoTradeActive = true;

    if (autoTradeBtn) {
      autoTradeBtn.addEventListener('click', async () => {
        autoTradeActive = !autoTradeActive;
        try {
          await fetch('http://localhost:3000/api/autotrade/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: autoTradeActive }),
          });
        } catch (e) {
          console.warn('[AutoTrade] Toggle endpoint offline, updating local UI.');
        }

        if (autoTradeActive) {
          autoTradeBtn.className = 'hdr-action-btn btn-autotrade active';
          if (autoTradeText) autoTradeText.textContent = '🤖 OTO-TRADE: AKTİF (%2.5)';
          this.addLog('TRADE', 'Otonom Trend & Momentum Modu Açıldı', 'Kullanıcı onayı gerekmeksizin dinamik trend/momentum alım-satımları aktif.', 'Kullanıcı');
        } else {
          autoTradeBtn.className = 'hdr-action-btn btn-autotrade paused';
          if (autoTradeText) autoTradeText.textContent = '⏸️ OTO-TRADE: DURAKLATILDI';
          this.addLog('TRADE', 'Otonom Mod Duraklatıldı', 'Otomatik alım-satım geçici olarak durduruldu.', 'Kullanıcı');
        }
      });
    }

    const logBtn = document.getElementById('btn-toggle-logs');
    if (logBtn) {
      logBtn.addEventListener('click', () => this.toggleLogDrawer());
    }

    const signalBtn = document.getElementById('btn-manual-signal');
    if (signalBtn) {
      signalBtn.addEventListener('click', async () => {
        signalBtn.textContent = '⏳ TARANIYOR...';
        this.addLog('SIGNAL', 'Manuel Sinyal Taraması Başlatıldı', 'Kullanıcı talebiyle tüm indikatörler ve haber radarı tetiklendi.', 'Kullanıcı');
        await apiService.triggerSignals();
        setTimeout(() => {
          signalBtn.innerHTML = '<span>⚡ SİNYAL TARA</span>';
        }, 1500);
      });
    }
  }

  private createLogDrawerUI(): void {
    let drawer = document.getElementById('activity-log-drawer');
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = 'activity-log-drawer';
      drawer.className = 'activity-log-drawer closed';
      document.body.appendChild(drawer);
    }
    this.logDrawerEl = drawer;

    drawer.innerHTML = `
      <div class="drawer-header">
        <div class="drawer-title-area">
          <span class="drawer-icon">📜</span>
          <div class="drawer-titles">
            <h3>CANLI AJAN & İŞLEM GÜNLÜĞÜ</h3>
            <p>Sistemde gerçekleşen tüm analizler, haberler, sinyaller ve emir geçmişi</p>
          </div>
        </div>

        <div class="drawer-controls">
          <div class="search-box">
            <input type="text" id="log-search-input" placeholder="Loglarda ara (BTC, LONG, Patron...)" />
          </div>

          <label class="autoscroll-toggle">
            <input type="checkbox" id="log-autoscroll-check" checked />
            <span>Otomatik Kaydır</span>
          </label>

          <button id="btn-export-logs" class="drawer-btn" title="Logları JSON olarak indir">📥 Dışa Aktar</button>
          <button id="btn-clear-logs" class="drawer-btn" title="Kayıtları temizle">🗑️ Temizle</button>
          <button id="btn-close-log-drawer" class="drawer-close-btn" title="Kapat">✕</button>
        </div>
      </div>

      <div class="drawer-category-bar">
        <button class="cat-tab active" data-cat="ALL">🔘 TÜMÜ (<span id="cat-count-all">0</span>)</button>
        <button class="cat-tab" data-cat="TRADE">💼 İŞLEMLER (<span id="cat-count-trade">0</span>)</button>
        <button class="cat-tab" data-cat="SIGNAL">⚡ SİNYALLER (<span id="cat-count-signal">0</span>)</button>
        <button class="cat-tab" data-cat="MANAGEMENT">🎩 YÖNETİM & PATRON (<span id="cat-count-mgmt">0</span>)</button>
        <button class="cat-tab" data-cat="NEWS">📰 HABER & MAKRO (<span id="cat-count-news">0</span>)</button>
        <button class="cat-tab" data-cat="RISK">🛡️ RİSK & LİMİT (<span id="cat-count-risk">0</span>)</button>
        <button class="cat-tab" data-cat="SYSTEM">⚙️ SİSTEM (<span id="cat-count-sys">0</span>)</button>
      </div>

      <div id="log-items-container" class="log-items-container">
        <!-- Dynamic Log Rows will be rendered here -->
      </div>
    `;

    this.logListEl = document.getElementById('log-items-container')!;
    this.logBadgeEl = document.getElementById('hdr-log-count-badge')!;

    // Bind Close Button
    const closeBtn = document.getElementById('btn-close-log-drawer');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.toggleLogDrawer(false));
    }

    // Bind Category Tabs
    drawer.querySelectorAll<HTMLButtonElement>('.cat-tab').forEach((tab) => {
      const cat = tab.getAttribute('data-cat') as LogCategory;
      this.filterButtons.set(cat, tab);
      tab.addEventListener('click', () => {
        this.activeCategory = cat;
        drawer.querySelectorAll('.cat-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderFilteredLogs();
      });
    });

    // Search Input
    const searchInput = document.getElementById('log-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
        this.renderFilteredLogs();
      });
    }

    // Auto-scroll checkbox
    const autoScrollCheck = document.getElementById('log-autoscroll-check') as HTMLInputElement;
    if (autoScrollCheck) {
      autoScrollCheck.addEventListener('change', (e) => {
        this.autoScroll = (e.target as HTMLInputElement).checked;
      });
    }

    // Clear logs
    const clearBtn = document.getElementById('btn-clear-logs');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.logs = [];
        this.addLog('SYSTEM', 'Loglar Temizlendi', 'Kullanıcı tarafından geçmiş kayıtlar sıfırlandı.', 'Kullanıcı');
      });
    }

    // Export logs
    const exportBtn = document.getElementById('btn-export-logs');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.logs, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute('href', dataStr);
        dlAnchor.setAttribute('download', `crypto-agent-activity-log-${Date.now()}.json`);
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
      });
    }
  }

  public toggleLogDrawer(forceState?: boolean): void {
    if (typeof forceState === 'boolean') {
      this.isDrawerOpen = forceState;
    } else {
      this.isDrawerOpen = !this.isDrawerOpen;
    }

    if (this.isDrawerOpen) {
      this.logDrawerEl.classList.remove('closed');
      this.logDrawerEl.classList.add('open');
      this.renderFilteredLogs();
    } else {
      this.logDrawerEl.classList.remove('open');
      this.logDrawerEl.classList.add('closed');
    }
  }

  private updateLogBadge(): void {
    if (this.logBadgeEl) {
      this.logBadgeEl.textContent = this.logs.length.toString();
    }

    // Update tab count badges
    const counts = {
      ALL: this.logs.length,
      TRADE: this.logs.filter((l) => l.category === 'TRADE').length,
      SIGNAL: this.logs.filter((l) => l.category === 'SIGNAL').length,
      MANAGEMENT: this.logs.filter((l) => l.category === 'MANAGEMENT').length,
      NEWS: this.logs.filter((l) => l.category === 'NEWS').length,
      RISK: this.logs.filter((l) => l.category === 'RISK').length,
      SYSTEM: this.logs.filter((l) => l.category === 'SYSTEM').length,
    };

    const countAll = document.getElementById('cat-count-all');
    if (countAll) countAll.textContent = counts.ALL.toString();
    const countTrade = document.getElementById('cat-count-trade');
    if (countTrade) countTrade.textContent = counts.TRADE.toString();
    const countSignal = document.getElementById('cat-count-signal');
    if (countSignal) countSignal.textContent = counts.SIGNAL.toString();
    const countMgmt = document.getElementById('cat-count-mgmt');
    if (countMgmt) countMgmt.textContent = counts.MANAGEMENT.toString();
    const countNews = document.getElementById('cat-count-news');
    if (countNews) countNews.textContent = counts.NEWS.toString();
    const countRisk = document.getElementById('cat-count-risk');
    if (countRisk) countRisk.textContent = counts.RISK.toString();
    const countSys = document.getElementById('cat-count-sys');
    if (countSys) countSys.textContent = counts.SYSTEM.toString();
  }

  private renderFilteredLogs(): void {
    if (!this.logListEl) return;

    const filtered = this.logs.filter((item) => {
      const matchCat = this.activeCategory === 'ALL' || item.category === this.activeCategory;
      const matchSearch =
        !this.searchQuery ||
        item.title.toLowerCase().includes(this.searchQuery) ||
        item.details.toLowerCase().includes(this.searchQuery) ||
        (item.agentRole && item.agentRole.toLowerCase().includes(this.searchQuery)) ||
        item.badge.toLowerCase().includes(this.searchQuery);
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      this.logListEl.innerHTML = `
        <div class="log-empty">
          <span class="empty-icon">📭</span>
          <p>Kayıtlı log bulunamadı</p>
        </div>
      `;
      return;
    }

    this.logListEl.innerHTML = filtered
      .map(
        (log) => `
        <div class="log-row log-${log.category.toLowerCase()}">
          <div class="log-time font-mono">${log.time}</div>
          <div class="log-badge" style="background:${log.badgeBg}; color:${log.badgeColor}; border-color:${log.badgeColor};">
            ${log.badge}
          </div>
          ${log.agentRole ? `<div class="log-agent font-bold">[${log.agentRole}]</div>` : ''}
          <div class="log-content">
            <div class="log-title">${log.title}</div>
            <div class="log-details">${log.details}</div>
          </div>
        </div>
      `
      )
      .join('');

    if (this.autoScroll && this.logListEl) {
      this.logListEl.scrollTop = 0; // Since newest is at top
    }
  }

  private setupEventListeners(): void {
    // 1. WebSocket Status
    wsService.onStatusChange((status) => {
      const statusPill = document.getElementById('header-ws-status');
      const statusText = document.getElementById('ws-status-text');
      if (statusPill && statusText) {
        if (status === 'CONNECTED') {
          statusPill.className = 'status-pill status-online';
          statusText.textContent = 'ONLINE';
          this.addLog('SYSTEM', 'Borsa Bağlantısı Kuruldu', 'WebSocket sunucusu ve piyasa veri akışı aktif.', 'Sistem');
        } else if (status === 'CONNECTING') {
          statusPill.className = 'status-pill status-connecting';
          statusText.textContent = 'CONNECTING';
        } else {
          statusPill.className = 'status-pill status-offline';
          statusText.textContent = 'OFFLINE';
          this.addLog('SYSTEM', 'Borsa Bağlantısı Kesildi', 'Sunucuya yeniden bağlanılıyor...', 'Sistem');
        }
      }
    });

    // 2. PORTFOLIO_UPDATE
    wsService.on<PortfolioUpdatePayload>('PORTFOLIO_UPDATE', (payload) => {
      if (!payload) return;
      this.updateHeaderPortfolioMetrics(payload);
    });

    // 3. TRADE_PROPOSAL
    wsService.on<TradeProposalPayload>('TRADE_PROPOSAL', (payload) => {
      if (!payload) return;
      this.addLog(
        'MANAGEMENT',
        `Patron Emir Önerisi: ${payload.side} ${payload.symbol}`,
        `Hacim: $${payload.suggestedAmountUsd || payload.estimatedAmountUsd || 50} | Kaldıraç: ${payload.suggestedLeverage || 10}x Isolated | TP: $${payload.suggestedTakeProfit || '-'} | SL: $${payload.suggestedStopLoss || '-'} | Neden: ${payload.notes || 'Sinyal teyidi'}`,
        'Patron'
      );
    });

    // 4. SIGNAL_GENERATED
    wsService.on<SignalGeneratedPayload>('SIGNAL_GENERATED', (payload) => {
      if (!payload || payload.action === 'HOLD') return;
      this.addLog(
        'SIGNAL',
        `Sinyal Tespit Edildi: ${payload.action} ${payload.symbol}`,
        `Sinyal Skoru: ${payload.signalScore}/100 | Güven: %${Math.round(payload.confidence * 100)} | Açıklama: ${payload.reasoning}`,
        'Sinyal Avcısı'
      );
    });

    // 5. TECHNICAL_SIGNAL
    wsService.on<TechnicalSignalPayload>('TECHNICAL_SIGNAL', (payload) => {
      if (!payload || payload.suggestedAction === 'HOLD') return;
      this.addLog(
        'SIGNAL',
        `Teknik İndikatör Sinyali: ${payload.symbol} (${payload.timeframe})`,
        `RSI(14): ${payload.rsi14.toFixed(1)} [${payload.rsiCondition}] | EMA9/21: ${payload.emaCross} | Aksiyon: ${payload.suggestedAction} (Skor: ${payload.confidenceScore})`,
        'Teknik Analist'
      );
    });

    // 6. NEW_NEWS
    wsService.on<NewNewsPayload>('NEW_NEWS', (payload) => {
      if (!payload) return;
      const severity = payload.impact?.severityLabel || 'ORTA';
      const score = payload.impact?.impactScore || 50;
      this.addLog(
        'NEWS',
        `Haber Akışı: [${payload.category || 'GENEL'}] ${payload.title}`,
        `${payload.summary || ''} | Etki: ${severity} (${score}/100) | Kaynak: ${payload.source || 'Bloomberg/Terminal'}`,
        'Haber Takip'
      );
    });

    // 7. SCENE_SEVERITY_UPDATE
    wsService.on<SceneSeverityPayload>('SCENE_SEVERITY_UPDATE', (payload) => {
      if (!payload) return;
      this.updateHeaderRiskStatus(payload.severityLabel);
      this.addLog(
        'RISK',
        `Piyasa Şiddeti Değişti: ${payload.severityLabel}`,
        `Etki Skoru: ${payload.impactScore} | Sebep: ${payload.primaryReason}`,
        'Makro Ekonomist'
      );
    });

    // 8. RISK_CONFIDENCE_UPDATE
    wsService.on<RiskConfidencePayload>('RISK_CONFIDENCE_UPDATE', (payload) => {
      if (!payload) return;
      const pct = Math.round(payload.confidenceScore * 100);
      this.updateHeaderRiskScore(pct);
      this.addLog('RISK', `Risk Güveni Güncellendi: %${pct}`, payload.analystComment || 'Doğruluk oranı hesaplandı.', 'Risk Analisti');
    });

    // 9. SPENDING_LIMIT_WARNING
    wsService.on<SpendingLimitWarningPayload>('SPENDING_LIMIT_WARNING', (payload) => {
      if (!payload) return;
      this.addLog(
        'RISK',
        `🛑 Bütçe / Limit Uyarısı: ${payload.symbol}`,
        `Talep Edilen: $${payload.attemptedSizeUsd} | İzin Verilen Max: $${payload.maxAllowedSizeUsd} | Neden: ${payload.reason}`,
        'Portföy Muhasebecisi',
        'LİMİT ENGELİ'
      );
    });

    // 10. LIQUIDATION_RISK_WARNING
    wsService.on<LiquidationRiskWarningPayload>('LIQUIDATION_RISK_WARNING', (payload) => {
      if (!payload) return;
      this.addLog(
        'RISK',
        `⚠️ Likidasyon Tehlikesi: ${payload.symbol} ${payload.side}`,
        `Mevcut: $${payload.currentPrice} | Likidasyon: $${payload.liquidationPrice} | Mesafe: %${payload.distancePercent.toFixed(1)} | ${payload.warningMessage}`,
        'Likidite Gözlemcisi',
        'LİKİDASYON'
      );
    });

    // 11. AGENT_ACTION
    wsService.on<AgentActionPayload>('AGENT_ACTION', (payload) => {
      if (!payload || payload.status === 'WAITING' || payload.status === 'COMPLETED') return;
      this.addLog(
        'MANAGEMENT',
        `${payload.agentRole}: ${payload.actionName}`,
        payload.details || 'Ajan işlem yürütüyor',
        payload.agentRole
      );
    });
  }

  private updateHeaderPortfolioMetrics(data: any): void {
    const totalBalance = data.totalBalanceUsd ?? data.balance?.totalUsd ?? data.balance?.totalBalanceUsd ?? 10000;
    const freeMargin = data.freeUsdt ?? data.balance?.freeUsdt ?? totalBalance * 0.95;
    const unrealizedPnl = data.totalUnrealizedPnl ?? 0;

    const elTotal = document.getElementById('hdr-total-balance');
    if (elTotal) elTotal.textContent = `$${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const elFree = document.getElementById('hdr-free-margin');
    if (elFree) elFree.textContent = `$${freeMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const elPnl = document.getElementById('hdr-open-pnl');
    if (elPnl) {
      const pnlPct = totalBalance > 0 ? (unrealizedPnl / totalBalance) * 100 : 0;
      const sign = unrealizedPnl >= 0 ? '+' : '';
      elPnl.textContent = `${sign}$${unrealizedPnl.toFixed(2)} (${sign}${pnlPct.toFixed(2)}%)`;

      if (unrealizedPnl > 0.001) {
        elPnl.className = 'metric-value font-mono text-green';
      } else if (unrealizedPnl < -0.001) {
        elPnl.className = 'metric-value font-mono text-red';
      } else {
        elPnl.className = 'metric-value font-mono text-neutral';
      }
    }
  }

  private updateHeaderRiskStatus(label: string): void {
    const el = document.getElementById('hdr-risk-status');
    if (!el) return;
    if (label === 'KRİTİK' || label === 'YÜKSEK') {
      el.innerHTML = `🔴 ${label}`;
      el.className = 'metric-value text-red';
    } else if (label === 'ORTA') {
      el.innerHTML = `🟡 ${label}`;
      el.className = 'metric-value text-yellow';
    } else {
      el.innerHTML = `🟢 ${label}`;
      el.className = 'metric-value text-green';
    }
  }

  private updateHeaderRiskScore(pct: number): void {
    const el = document.getElementById('hdr-risk-status');
    if (!el) return;
    if (pct < 50) {
      el.innerHTML = `🔴 YÜKSEK RİSK (%${pct})`;
      el.className = 'metric-value text-red';
    } else if (pct < 75) {
      el.innerHTML = `🟡 DİKKAT (%${pct})`;
      el.className = 'metric-value text-yellow';
    } else {
      el.innerHTML = `🟢 GÜVENLİ (%${pct})`;
      el.className = 'metric-value text-green';
    }
  }
}

export const activityLogManager = new ActivityLogManager();
