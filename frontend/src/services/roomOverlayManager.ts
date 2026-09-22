import { APP_CONFIG } from '../config.ts';

const API_URL = APP_CONFIG.REST_API_URL || 'http://localhost:3000/api';

export type RoomId = 'scanner' | 'scalp' | 'intelligence' | 'technical' | 'news' | 'all';

interface ChatMessage {
  sender: 'user' | 'chief';
  text: string;
  time: string;
  avatar?: string;
  chiefName?: string;
}

export class RoomOverlayManager {
  private overlayEl: HTMLElement;
  private activeRoom: RoomId | null = null;
  private refreshTimer: any = null;
  private chatHistories: Record<string, ChatMessage[]> = {
    scanner: [
      {
        sender: 'chief',
        text: 'Selam Patron! 300+ USDT altcoinini 7/24 tarıyorum. Hacim patlaması veya RSI anomalisi gördüğüm an buradayım.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        avatar: '🌐',
        chiefName: 'Piyasa Radarı Şefi',
      },
    ],
    scalp: [
      {
        sender: 'chief',
        text: 'Emrindeyim Patron! 1000$ test bakiyesiyle mikro-kârları topluyorum. "çek", "durdur", "kaç para kazandık?" veya "hedef %1.5" diyebilirsin.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        avatar: '⚡',
        chiefName: 'Baş Scalper',
      },
    ],
    intelligence: [
      {
        sender: 'chief',
        text: 'Telegram grupları duymadan önce CoinGecko, CMC ve haber akışlarından sızıntıları yakalıyorum. Kuralları rules.json dosyasında hafızada tutuyorum.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        avatar: '🕵️',
        chiefName: 'İstihbarat Şefi',
      },
    ],
    technical: [
      {
        sender: 'chief',
        text: 'Pivot Destek/Direnç (S/R) seviyelerini ve Bollinger kırılımlarını matematiksel olarak hesaplıyorum.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        avatar: '📈',
        chiefName: 'Baş Tekniker',
      },
    ],
    news: [
      {
        sender: 'chief',
        text: 'Makroekonomik gelişmeleri, FED kararlarını ve borsa FUD haberlerini 7/24 filtreliyorum.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        avatar: '📰',
        chiefName: 'Haber Şefi',
      },
    ],
  };

  constructor() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.id = 'room-overlay-container';
    this.overlayEl.className = 'room-overlay-container';
    document.body.appendChild(this.overlayEl);

    this.overlayEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('overlay-backdrop') || (e.target as HTMLElement).classList.contains('overlay-close-btn')) {
        this.close();
      }
    });
  }

  public openRoom(roomId: RoomId): void {
    if (roomId === 'all') {
      this.close();
      return;
    }

    this.activeRoom = roomId;
    this.render();
    this.overlayEl.classList.add('open');

    // Auto-refresh room data every 3 seconds while open
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => {
      if (this.activeRoom) {
        this.fetchAndRenderActiveRoom(true);
      }
    }, 4000);

    this.fetchAndRenderActiveRoom(false);
  }

  public close(): void {
    this.activeRoom = null;
    this.overlayEl.classList.remove('open');
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private render(): void {
    this.overlayEl.innerHTML = `
      <div class="overlay-backdrop"></div>
      <div class="room-overlay-dialog">
        <div class="overlay-header">
          <div class="overlay-title-group">
            <span class="room-badge-icon" id="room-badge-icon">🏛️</span>
            <div>
              <h2 id="room-overlay-title">Oda Paneli</h2>
              <p id="room-overlay-subtitle" class="room-subtitle">Birim Şefi & Canlı Analiz</p>
            </div>
          </div>
          <button class="overlay-close-btn" title="Kapat">✕</button>
        </div>
        <div class="overlay-body" id="room-overlay-body">
          <div class="overlay-loading">
            <div class="spinner"></div>
            <p>Oda verileri yükleniyor...</p>
          </div>
        </div>
      </div>
    `;
  }

  private async fetchAndRenderActiveRoom(isPeriodicRefresh: boolean = false): Promise<void> {
    if (!this.activeRoom) return;

    const bodyEl = document.getElementById('room-overlay-body');
    const titleEl = document.getElementById('room-overlay-title');
    const subtitleEl = document.getElementById('room-overlay-subtitle');
    const iconEl = document.getElementById('room-badge-icon');

    if (!bodyEl) return;

    try {
      if (this.activeRoom === 'scanner') {
        if (titleEl) titleEl.textContent = '🌐 Dinamik Piyasa Tarayıcısı Odası';
        if (subtitleEl) subtitleEl.textContent = 'Birim Şefi: Piyasa Radarı Şefi | 300+ Binance & OKX USDT Çiftleri';
        if (iconEl) iconEl.textContent = '🌐';
        await this.renderScannerRoom(bodyEl, isPeriodicRefresh);
      } else if (this.activeRoom === 'scalp') {
        if (titleEl) titleEl.textContent = '⚡ Dinamik Scalping & İcra Odası';
        if (subtitleEl) subtitleEl.textContent = 'Birim Şefi: Baş Scalper | Dinamik % TP & Trailing Stop & Doğal Dil Komutu';
        if (iconEl) iconEl.textContent = '⚡';
        await this.renderScalpingRoom(bodyEl, isPeriodicRefresh);
      } else if (this.activeRoom === 'intelligence') {
        if (titleEl) titleEl.textContent = '🕵️ Öncü İstihbarat & Balina Tüyo Odası';
        if (subtitleEl) subtitleEl.textContent = 'Birim Şefi: İstihbarat Şefi | CoinGecko, CMC, CoinDesk, Cointelegraph, CryptoPanic';
        if (iconEl) iconEl.textContent = '🕵️';
        await this.renderIntelligenceRoom(bodyEl, isPeriodicRefresh);
      } else if (this.activeRoom === 'technical') {
        if (titleEl) titleEl.textContent = '📈 Teknik Analiz & Direnç/Destek Odası';
        if (subtitleEl) subtitleEl.textContent = 'Birim Şefi: Baş Tekniker | Pivot S/R Seviyeleri, Bollinger & Hacim Kırılımları';
        if (iconEl) iconEl.textContent = '📈';
        await this.renderTechnicalRoom(bodyEl, isPeriodicRefresh);
      } else if (this.activeRoom === 'news') {
        if (titleEl) titleEl.textContent = '📰 Makro & Haber Duyarlılık Odası';
        if (subtitleEl) subtitleEl.textContent = 'Birim Şefi: Haber Şefi | Flaş Gelişmeler & Makro Etki Analizleri';
        if (iconEl) iconEl.textContent = '📰';
        await this.renderNewsRoom(bodyEl, isPeriodicRefresh);
      }
    } catch (err) {
      if (!isPeriodicRefresh) {
        bodyEl.innerHTML = `<div class="overlay-error">Veri alınamadı: ${(err as Error).message}</div>`;
      }
    }
  }

  // --- 1. SCANNER ROOM RENDERER ---
  private async renderScannerRoom(container: HTMLElement, isPeriodic: boolean): Promise<void> {
    const res = await fetch(`${API_URL}/rooms/scanner`).then((r) => r.json());
    const coins = res.radarCoins || [];

    let rowsHtml = '';
    coins.forEach((c: any) => {
      const rsiClass = c.rsi14 <= 30 ? 'text-green' : c.rsi14 >= 70 ? 'text-red' : 'text-neutral';
      const actionBadge = c.suggestedAction === 'BUY'
        ? '<span class="pill pill-buy">ALIM (MOMENTUM)</span>'
        : c.suggestedAction === 'SELL'
        ? '<span class="pill pill-sell">SATIŞ</span>'
        : '<span class="pill pill-hold">İZLEME</span>';

      rowsHtml += `
        <div class="radar-card">
          <div class="radar-card-header">
            <span class="coin-sym">${c.symbol}</span>
            <span class="coin-price">$${Number(c.lastPrice).toLocaleString()}</span>
          </div>
          <div class="radar-card-metrics">
            <div><small>RSI (14):</small> <span class="${rsiClass} font-bold">${c.rsi14}</span></div>
            <div><small>EMA:</small> <span class="font-bold">${c.emaCross}</span></div>
            <div><small>Skor:</small> <span class="font-bold text-yellow">${c.momentumScore}/100</span></div>
          </div>
          <div class="radar-card-footer">
            ${actionBadge}
          </div>
        </div>
      `;
    });

    if (isPeriodic) {
      const grid = container.querySelector('.radar-cards-grid');
      if (grid) grid.innerHTML = rowsHtml || '<p class="empty-text">Piyasa taranıyor, radara giren coinler bekleniyor...</p>';
      return;
    }

    container.innerHTML = `
      <div class="room-grid-layout">
        <div class="room-main-pane">
          <div class="section-hdr">
            <h3>🔥 Radardaki Sıcak Fırsat Altcoinleri (${coins.length})</h3>
            <small>24s Hacim & Volatiliteye Göre Sıralı (300+ Coin)</small>
          </div>
          <div class="radar-cards-grid">
            ${rowsHtml || '<p class="empty-text">Piyasa taranıyor, radara giren coinler bekleniyor...</p>'}
          </div>

          <!-- Unit Chief Chat Section -->
          ${this.getChiefChatHtml('scanner', 'Piyasa Radarı Şefi', '🌐', [
            'Bugün naptın?',
            'Nasılsın?',
            'En sıcak coin hangisi?',
            'Hacim nerede?',
          ])}
        </div>
      </div>
    `;

    this.bindChiefChatEvents('scanner', 'Piyasa Radarı Şefi', '🌐');
  }

  // --- 2. SCALPING ROOM RENDERER ---
  private async renderScalpingRoom(container: HTMLElement, isPeriodic: boolean): Promise<void> {
    const res = await fetch(`${API_URL}/rooms/scalp`).then((r) => r.json());
    const positions = res.positions || [];
    const recentOrders = res.recentOrders || [];
    const stats = res.stats || {};

    let positionsHtml = '';
    if (positions.length === 0) {
      positionsHtml = '<div class="empty-card">Şu an açık pozisyon yok. Baş Scalper radardaki fırsatları bekliyor.</div>';
    } else {
      positions.forEach((p: any) => {
        const pnl = p.unrealizedPnl || 0;
        const pnlClass = pnl >= 0 ? 'text-green' : 'text-red';
        positionsHtml += `
          <div class="pos-item-box ${pnl >= 0 ? 'border-green' : 'border-red'}">
            <div class="pos-item-header">
              <b>${p.symbol}</b> <span class="pill pill-${(p.side || 'LONG').toLowerCase()}">${p.side || 'LONG'}</span>
            </div>
            <div class="pos-item-details">
              <div>Giriş: <b>$${Number(p.entryPrice).toFixed(4)}</b></div>
              <div>PnL: <b class="${pnlClass}">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</b></div>
              <div>Kaldıraç: <b>${p.leverage || 5}x</b></div>
            </div>
          </div>
        `;
      });
    }

    let ordersHtml = '';
    recentOrders.slice(0, 6).forEach((o: any) => {
      ordersHtml += `
        <div class="order-row">
          <span><b>${o.symbol}</b> <small class="text-neutral">(${o.side})</small></span>
          <span>$${Number(o.entryPrice).toFixed(4)}</span>
          <span class="${(o.pnlUsd || 0) >= 0 ? 'text-green' : 'text-red'} font-bold">
            ${o.status === 'CLOSED' ? ((o.pnlUsd || 0) >= 0 ? `+$${Number(o.pnlUsd).toFixed(2)}` : `-$${Math.abs(o.pnlUsd).toFixed(2)}`) : 'AÇIK'}
          </span>
        </div>
      `;
    });

    if (isPeriodic) {
      const posContainer = container.querySelector('.pos-list-container');
      const ordersContainer = container.querySelector('.orders-list-box');
      if (posContainer) posContainer.innerHTML = positionsHtml;
      if (ordersContainer) ordersContainer.innerHTML = ordersHtml || '<p class="empty-text">Henüz emir kaydı yok.</p>';
      return;
    }

    container.innerHTML = `
      <div class="scalp-split-layout">
        <div class="scalp-left-pane">
          <div class="section-hdr">
            <h3>📈 Açık Pozisyonlar & Kâr Takibi</h3>
            <span class="status-badge ${res.isAutoTradingEnabled ? 'online' : 'offline'}">
              ${res.isAutoTradingEnabled ? '🤖 OTO-SCALP: AKTİF' : '⏸️ DURDURULDU'}
            </span>
          </div>
          <div class="pos-list-container">
            ${positionsHtml}
          </div>

          <!-- Unit Chief Chat Section -->
          ${this.getChiefChatHtml('scalp', 'Baş Scalper', '⚡', [
            'Kaç para kazandık?',
            'Bugün naptın?',
            'çek',
            'hedef %1.5',
            'durdur',
          ])}
        </div>

        <div class="scalp-right-pane">
          <div class="section-hdr">
            <h3>📋 Anlık Emirler & Geçmiş İşlemler</h3>
          </div>
          <div class="orders-list-box">
            ${ordersHtml || '<p class="empty-text">Henüz emir kaydı yok.</p>'}
          </div>

          <div class="scalp-stats-card">
            <h4>📊 Scalper Performans İstatistikleri</h4>
            <div class="stat-row"><span>Toplam İşlem:</span> <b>${stats.totalAutoTrades || 0}</b></div>
            <div class="stat-row"><span>Kârlı Kapanış:</span> <b class="text-green">${stats.profitableExits || 0}</b></div>
            <div class="stat-row"><span>Stop-Loss:</span> <b class="text-red">${stats.stopLossExits || 0}</b></div>
            <div class="stat-row"><span>Toplam Kâr:</span> <b class="text-green font-mono">+$${(stats.totalProfitHarvestedUsd || 0).toFixed(2)}</b></div>
            <div class="stat-row"><span>Dinamik TP / SL:</span> <b>%${stats.targetProfitPercent || 0.8} / %${stats.stopLossPercent || 1.2}</b></div>
            <div class="stat-row"><span>Bakiye:</span> <b>$${Number(res.balance?.totalUsd || 1000).toFixed(2)} USD</b></div>
          </div>
        </div>
      </div>
    `;

    this.bindChiefChatEvents('scalp', 'Baş Scalper', '⚡');
  }

  // --- 3. INTELLIGENCE ROOM RENDERER ---
  private async renderIntelligenceRoom(container: HTMLElement, isPeriodic: boolean): Promise<void> {
    const res = await fetch(`${API_URL}/rooms/intelligence`).then((r) => r.json());
    const leaks = res.recentLeaks || [];
    const rules = res.learnedRules || [];

    let leaksHtml = '';
    leaks.forEach((l: any) => {
      const outcomeBadge = l.observationOutcome === 'SUCCESS'
        ? `<span class="pill pill-buy">KAZANDIRDI (+%${l.priceChangePct15m || 0})</span>`
        : l.observationOutcome === 'FAIL'
        ? `<span class="pill pill-sell">YANILTTI (%${l.priceChangePct15m || 0})</span>`
        : `<span class="pill pill-hold">DOĞRULANIYOR...</span>`;

      leaksHtml += `
        <div class="leak-card">
          <div class="leak-card-header">
            <span class="source-tag">${l.source}</span>
            <span class="leak-sym">${l.symbol}</span>
            <span class="leak-urgency ${l.urgency.toLowerCase()}">${l.urgency}</span>
          </div>
          <div class="leak-title">${l.headline}</div>
          <div class="leak-summary">${l.summary}</div>
          <div class="leak-footer">
            <small class="text-neutral">${new Date(l.detectedAt).toLocaleTimeString()}</small>
            ${outcomeBadge}
          </div>
        </div>
      `;
    });

    let rulesHtml = '';
    rules.forEach((r: any) => {
      const tierBadge = r.tier === 'STRONG_RULE'
        ? '<span class="pill pill-buy">GÜÇLÜ KURAL</span>'
        : r.tier === 'WEAK_RULE'
        ? '<span class="pill pill-hold">ZAYIF KURAL</span>'
        : '<span class="pill pill-gray">HİPOTEZ</span>';

      rulesHtml += `
        <div class="rule-item">
          <div><b>${r.description}</b></div>
          <div class="rule-meta">
            <span>Kazanma Oranı: <b class="text-green">${Math.round((r.successRate || 0) * 100)}%</b></span>
            <span>Gözlem: <b>${r.observationCount || 0}</b></span>
            ${tierBadge}
          </div>
        </div>
      `;
    });

    if (isPeriodic) {
      const leaksList = container.querySelector('.leaks-list');
      const rulesBox = container.querySelector('.rules-box');
      if (leaksList) leaksList.innerHTML = leaksHtml || '<p class="empty-text">İstihbarat siteleri taranıyor...</p>';
      if (rulesBox) rulesBox.innerHTML = rulesHtml || '<p class="empty-text">Test simülasyonunda ders çıkarılıyor...</p>';
      return;
    }

    container.innerHTML = `
      <div class="intel-split-layout">
        <div class="intel-left-pane">
          <div class="section-hdr">
            <h3>⚡ Telegram Öncesi Erken Sızıntı & Tüyo Akışı</h3>
            <div class="source-pills">
              <span>CoinGecko</span><span>CMC</span><span>CoinDesk</span><span>Cointelegraph TR</span><span>CryptoPanic</span>
            </div>
          </div>
          <div class="leaks-list">
            ${leaksHtml || '<p class="empty-text">İstihbarat siteleri taranıyor...</p>'}
          </div>
        </div>

        <div class="intel-right-pane">
          <div class="section-hdr">
            <h3>🧠 Strateji Hafızası & Öğrenilen Kurallar (rules.json)</h3>
          </div>
          <div class="rules-box">
            ${rulesHtml || '<p class="empty-text">Test simülasyonunda hatalardan ders çıkarılıyor...</p>'}
          </div>

          <!-- Unit Chief Chat Section -->
          ${this.getChiefChatHtml('intelligence', 'İstihbarat Şefi', '🕵️', [
            'Neler öğrendin?',
            'Hafızada ne var?',
            'Bugün naptın?',
            'Hangi tüyolar geldi?',
          ])}
        </div>
      </div>
    `;

    this.bindChiefChatEvents('intelligence', 'İstihbarat Şefi', '🕵️');
  }

  // --- 4. TECHNICAL ANALYSIS ROOM RENDERER ---
  private async renderTechnicalRoom(container: HTMLElement, isPeriodic: boolean): Promise<void> {
    const res = await fetch(`${API_URL}/rooms/technical`).then((r) => r.json());
    const analyses = res.analyses || [];

    let cardsHtml = '';
    analyses.forEach((a: any) => {
      const p = a.pivots || {};
      const b = a.bollinger || {};
      cardsHtml += `
        <div class="tech-card">
          <div class="tech-card-hdr">
            <span class="coin-sym">${a.symbol}</span>
            <span class="coin-price">$${Number(a.currentPrice).toFixed(4)}</span>
            <span class="pill pill-buy">${a.strategySignal}</span>
          </div>
          <div class="sr-grid">
            <div class="sr-col resist">
              <div>R3: <b>$${p.r3}</b></div>
              <div>R2: <b>$${p.r2}</b></div>
              <div>R1 (Direnç): <b>$${p.r1}</b></div>
            </div>
            <div class="sr-col pivot-mid">
              <div>PIVOT: <b>$${p.pivot}</b></div>
              <div>Bollinger: <b>${b.bandwidth}</b></div>
              <div>Vol Breakout: <b>${a.volumeBreakoutDetected ? 'EVET 🚀' : 'HAYIR'}</b></div>
            </div>
            <div class="sr-col support">
              <div>S1 (Destek): <b>$${p.s1}</b></div>
              <div>S2: <b>$${p.s2}</b></div>
              <div>S3: <b>$${p.s3}</b></div>
            </div>
          </div>
        </div>
      `;
    });

    if (isPeriodic) {
      const techGrid = container.querySelector('.tech-grid');
      if (techGrid) techGrid.innerHTML = cardsHtml || '<p class="empty-text">Teknik analizler hesaplanıyor...</p>';
      return;
    }

    container.innerHTML = `
      <div class="section-hdr">
        <h3>📈 Pivot Seviyeleri, Destek/Direnç & Kırılım Analizi</h3>
        <small>Direnç kırılımları ve destekten sekme fırsatları hesaplanıyor</small>
      </div>
      <div class="tech-grid">
        ${cardsHtml || '<p class="empty-text">Teknik analizler hesaplanıyor...</p>'}
      </div>

      <!-- Unit Chief Chat Section -->
      ${this.getChiefChatHtml('technical', 'Baş Tekniker', '📈', [
        'Bugün naptın?',
        'Direnç nerede?',
        'Destek seviyeleri nedir?',
        'Kırılım var mı?',
      ])}
    `;

    this.bindChiefChatEvents('technical', 'Baş Tekniker', '📈');
  }

  // --- 5. NEWS ROOM RENDERER ---
  private async renderNewsRoom(container: HTMLElement, isPeriodic: boolean): Promise<void> {
    if (isPeriodic) return;

    container.innerHTML = `
      <div class="section-hdr">
        <h3>📰 Makroekonomik Haberler & Duyarlılık Analizleri</h3>
        <small>Global kripto akışı, FED kararları ve piyasa FUD filtrelemesi</small>
      </div>
      <div class="news-list-box">
        <p class="empty-text">Haber radarı 7/24 piyasayı izliyor. Yeni flaş haberler anında buraya ve patronun ekranına düşer.</p>
      </div>

      <!-- Unit Chief Chat Section -->
      ${this.getChiefChatHtml('news', 'Haber Şefi', '📰', [
        'Bugün naptın?',
        'Piyasada ne haber var?',
        'FED veya makro risk var mı?',
        'FUD uyarısı var mı?',
      ])}
    `;

    this.bindChiefChatEvents('news', 'Haber Şefi', '📰');
  }

  // --- CHIEF CHAT TEMPLATE & EVENT BINDINGS ---
  private getChiefChatHtml(roomId: string, chiefName: string, avatar: string, quickChips: string[]): string {
    const history = this.chatHistories[roomId] || [];
    const logHtml = history
      .map((msg) => {
        if (msg.sender === 'user') {
          return `
            <div class="chat-bubble user">
              <div class="chat-bubble-sender">👤 Sen <span class="chat-bubble-time">${msg.time}</span></div>
              <div>${msg.text}</div>
            </div>
          `;
        }
        return `
          <div class="chat-bubble chief">
            <div class="chat-bubble-sender">${msg.avatar || avatar} ${msg.chiefName || chiefName} <span class="chat-bubble-time">${msg.time}</span></div>
            <div>${msg.text}</div>
          </div>
        `;
      })
      .join('');

    const chipsHtml = quickChips
      .map((chip) => `<button class="chip-btn" data-room="${roomId}" data-text="${chip}">${chip}</button>`)
      .join('');

    return `
      <div class="chief-chat-section" id="chief-chat-section-${roomId}">
        <div class="chief-chat-header">
          <div class="chief-chat-title">
            <span>${avatar}</span>
            <span>${chiefName} ile Sohbet & Komut Terminali</span>
          </div>
          <div class="chat-chips-row">
            ${chipsHtml}
          </div>
        </div>

        <div class="chief-chat-log" id="chief-chat-log-${roomId}">
          ${logHtml}
        </div>

        <div class="chief-chat-input-row">
          <input type="text" id="chief-chat-input-${roomId}" placeholder="${chiefName}'e bir şey sor veya komut ver..." />
          <button id="chief-chat-send-${roomId}">Gönder ↵</button>
        </div>
      </div>
    `;
  }

  private bindChiefChatEvents(roomId: string, chiefName: string, avatar: string): void {
    const input = document.getElementById(`chief-chat-input-${roomId}`) as HTMLInputElement;
    const sendBtn = document.getElementById(`chief-chat-send-${roomId}`);
    const logEl = document.getElementById(`chief-chat-log-${roomId}`);

    const scrollBottom = () => {
      if (logEl) logEl.scrollTop = logEl.scrollHeight;
    };
    scrollBottom();

    const sendMessage = async (rawText?: string) => {
      const text = (rawText || (input ? input.value : '')).trim();
      if (!text) return;

      if (input) input.value = '';

      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      // 1. Add user message
      this.chatHistories[roomId].push({
        sender: 'user',
        text,
        time: now,
      });

      if (logEl) {
        logEl.innerHTML += `
          <div class="chat-bubble user">
            <div class="chat-bubble-sender">👤 Sen <span class="chat-bubble-time">${now}</span></div>
            <div>${text}</div>
          </div>
        `;
        scrollBottom();
      }

      // Add temporary typing indicator
      const typingId = `typing-${Date.now()}`;
      if (logEl) {
        logEl.innerHTML += `
          <div class="chat-bubble chief" id="${typingId}">
            <div class="chat-bubble-sender">${avatar} ${chiefName}</div>
            <div><span class="text-yellow">⏳ Düşünüyor / Yanıtlıyor...</span></div>
          </div>
        `;
        scrollBottom();
      }

      try {
        const res = await fetch(`${API_URL}/rooms/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, message: text }),
        }).then((r) => r.json());

        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        const chiefReply = res.message || 'Anlaşıldı Patron!';
        const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        this.chatHistories[roomId].push({
          sender: 'chief',
          text: chiefReply,
          time: replyTime,
          avatar: res.avatarIcon || avatar,
          chiefName: res.chiefName || chiefName,
        });

        if (logEl) {
          logEl.innerHTML += `
            <div class="chat-bubble chief">
              <div class="chat-bubble-sender">${res.avatarIcon || avatar} ${res.chiefName || chiefName} <span class="chat-bubble-time">${replyTime}</span></div>
              <div>${chiefReply}</div>
            </div>
          `;
          scrollBottom();
        }

        // If command triggered action, refresh data
        if (res.actionTaken) {
          setTimeout(() => this.fetchAndRenderActiveRoom(false), 600);
        }
      } catch (err) {
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        if (logEl) {
          logEl.innerHTML += `
            <div class="chat-bubble chief">
              <div class="chat-bubble-sender">${avatar} ${chiefName}</div>
              <div class="text-red">Bağlantı hatası: ${(err as Error).message}</div>
            </div>
          `;
          scrollBottom();
        }
      }
    };

    if (sendBtn) sendBtn.onclick = () => sendMessage();
    if (input) {
      input.onkeydown = (e) => {
        if (e.key === 'Enter') sendMessage();
      };
    }

    // Bind chips
    const chips = document.querySelectorAll(`.chip-btn[data-room="${roomId}"]`);
    chips.forEach((c) => {
      (c as HTMLElement).onclick = () => {
        const t = (c as HTMLElement).dataset.text;
        if (t) sendMessage(t);
      };
    });
  }
}

export const roomOverlayManager = new RoomOverlayManager();
