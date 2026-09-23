export interface ChatMessageUI {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actionTaken?: string;
  modelUsed?: string;
}

export class ChatAssistantManager {
  private isOpen: boolean = false;
  private isSending: boolean = false;
  private messages: ChatMessageUI[] = [];
  private suggestions: string[] = [];

  // DOM Elements
  private drawerEl!: HTMLElement;
  private messagesListEl!: HTMLElement;
  private inputEl!: HTMLInputElement;
  private sendBtnEl!: HTMLButtonElement;
  private suggestionsEl!: HTMLElement;

  constructor() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  private async init(): Promise<void> {
    this.createDrawerUI();
    this.setupEventListeners();
    await this.loadInitialHistoryAndSuggestions();
  }

  private createDrawerUI(): void {
    let drawer = document.getElementById('ai-chat-drawer');
    if (!drawer) {
      drawer = document.createElement('aside');
      drawer.id = 'ai-chat-drawer';
      drawer.className = 'ai-chat-drawer';
      document.body.appendChild(drawer);
    }
    this.drawerEl = drawer;

    drawer.innerHTML = `
      <div class="chat-drawer-header">
        <div class="chat-header-title">
          <div class="ai-avatar-icon">🧠</div>
          <div class="ai-title-group">
            <h3>OCTOPUS AI BRAIN</h3>
            <div class="ai-status-indicator">
              <span class="pulse-green"></span>
              <span id="ai-model-badge">Canlı Kural & Telemetri Motoru</span>
            </div>
          </div>
        </div>
        <div class="chat-header-actions">
          <button id="btn-clear-chat" class="chat-icon-btn" title="Sohbet Geçmişini Temizle">🗑️</button>
          <button id="btn-close-chat" class="chat-icon-btn chat-close-btn" title="Kapat">✕</button>
        </div>
      </div>

      <!-- Live Telemetry Status Strip -->
      <div id="chat-telemetry-strip" class="chat-telemetry-strip">
        <div class="telemetry-pill">🌐 Rejim: <b id="chat-regime-val">YÜKLENİYOR...</b></div>
        <div class="telemetry-pill">🧠 Kurallar: <b id="chat-rules-val">-</b></div>
        <div class="telemetry-pill">📊 Pozisyon: <b id="chat-pos-val">-</b></div>
        <div class="telemetry-pill">💰 Kasa: <b id="chat-bal-val">-</b></div>
      </div>

      <!-- Messages Area -->
      <div id="chat-messages-container" class="chat-messages-container">
        <!-- Messages rendered here -->
      </div>

      <!-- Quick Suggestion Prompt Chips -->
      <div class="chat-suggestions-wrapper">
        <div class="suggestions-label">💡 HIZLI SORULAR / KOMUTLAR:</div>
        <div id="chat-suggestions-list" class="chat-suggestions-list"></div>
      </div>

      <!-- Chat Input Form -->
      <form id="chat-input-form" class="chat-input-form" onsubmit="return false;">
        <input 
          type="text" 
          id="chat-user-input" 
          class="chat-user-input" 
          placeholder="Kural durumu sor, rejim değiştir (BEAR/BULL), kasa veya risk analizini iste..." 
          autocomplete="off"
        />
        <button type="submit" id="btn-send-chat" class="btn-send-chat">
          <span>GÖNDER</span>
          <span class="send-arrow">➔</span>
        </button>
      </form>
    `;

    this.messagesListEl = drawer.querySelector('#chat-messages-container') as HTMLElement;
    this.inputEl = drawer.querySelector('#chat-user-input') as HTMLInputElement;
    this.sendBtnEl = drawer.querySelector('#btn-send-chat') as HTMLButtonElement;
    this.suggestionsEl = drawer.querySelector('#chat-suggestions-list') as HTMLElement;
  }

  private setupEventListeners(): void {
    const closeBtn = this.drawerEl.querySelector('#btn-close-chat');
    closeBtn?.addEventListener('click', () => this.toggleDrawer(false));

    const clearBtn = this.drawerEl.querySelector('#btn-clear-chat');
    clearBtn?.addEventListener('click', () => this.handleClearChat());

    const form = this.drawerEl.querySelector('#chat-input-form') as HTMLFormElement;
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSendMessage();
    });

    // Global shortcut to toggle AI chat (Ctrl+Space or Cmd+Space)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        e.preventDefault();
        this.toggleDrawer();
      }
    });
  }

  public toggleDrawer(forceState?: boolean): void {
    this.isOpen = forceState !== undefined ? forceState : !this.isOpen;

    if (this.isOpen) {
      this.drawerEl.classList.add('open');
      this.inputEl?.focus();
      this.scrollToBottom();
      this.refreshSuggestions();
    } else {
      this.drawerEl.classList.remove('open');
    }

    const headerBtn = document.getElementById('btn-toggle-ai-chat');
    if (headerBtn) {
      if (this.isOpen) headerBtn.classList.add('active');
      else headerBtn.classList.remove('active');
    }
  }

  private async loadInitialHistoryAndSuggestions(): Promise<void> {
    try {
      // 1. Fetch Suggestions
      const sugRes = await fetch('http://localhost:3000/api/chat/suggestions');
      if (sugRes.ok) {
        const json = await sugRes.json();
        if (json.success && Array.isArray(json.data)) {
          this.suggestions = json.data;
          this.renderSuggestions();
        }
      }

      // 2. Fetch History
      const histRes = await fetch('http://localhost:3000/api/chat/history');
      if (histRes.ok) {
        const json = await histRes.json();
        if (json.success && Array.isArray(json.data)) {
          this.messages = json.data;
        }
      }

      if (this.messages.length === 0) {
        this.messages.push({
          id: 'welcome_1',
          role: 'assistant',
          content: `👋 **Merhaba Kaptan! Ben Octopus Prime Yapay Zeka Beyni (AI Core).**

Sizin için arka planda:
- 🧠 **Kendi Kendine Öğrenen Kural Motoru**: 3 kanaldan (Grafik, Haber, Sosyal) gelen her sinyali ve kârlılığı analiz edip kurallar öğreniyorum.
- ⚡ **Otonom Mikro-Scalp**: Küçük kâr hedeflerini ($0.30) güvenli parametrelerle topluyorum.
- 🛡️ **Risk & Devre Kesici**: Portföyü ani piyasa kayıplarından koruyorum.

Bana dilediğiniz soruyu sorabilir, kural listesini inceletebilir, piyasa rejimini (BULL/BEAR) değiştirebilir veya risk analizini isteyebilirsiniz!`,
          timestamp: new Date().toISOString(),
          modelUsed: 'Octopus Cognitive Core',
        });
      }

      this.renderMessages();
    } catch (err) {
      console.warn('⚠️ [ChatAssistantManager] Error fetching chat initial state:', err);
    }
  }

  private renderSuggestions(): void {
    if (!this.suggestionsEl) return;
    this.suggestionsEl.innerHTML = '';

    this.suggestions.forEach((text) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'prompt-chip';
      chip.textContent = text;
      chip.addEventListener('click', () => {
        if (this.inputEl) {
          this.inputEl.value = text;
          this.handleSendMessage();
        }
      });
      this.suggestionsEl.appendChild(chip);
    });
  }

  private async refreshSuggestions(): Promise<void> {
    try {
      const res = await fetch('http://localhost:3000/api/chat/suggestions');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          this.suggestions = json.data;
          this.renderSuggestions();
        }
      }
    } catch (e) {
      // Ignore background refresh error
    }
  }

  private renderMessages(): void {
    if (!this.messagesListEl) return;
    this.messagesListEl.innerHTML = '';

    this.messages.forEach((msg) => {
      const item = document.createElement('div');
      item.className = `chat-message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`;

      const timeStr = new Date(msg.timestamp).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const formattedContent = this.formatMarkdown(msg.content);

      if (msg.role === 'user') {
        item.innerHTML = `
          <div class="msg-bubble user-bubble">
            <div class="msg-header">
              <span class="user-badge">🎖️ KAPTAN</span>
              <span class="msg-time">${timeStr}</span>
            </div>
            <div class="msg-text">${formattedContent}</div>
          </div>
        `;
      } else {
        const modelTag = msg.modelUsed ? `<span class="model-tag">${msg.modelUsed}</span>` : '';
        const actionTag = msg.actionTaken ? `<div class="action-pill">⚡ Aksiyon: ${msg.actionTaken}</div>` : '';

        item.innerHTML = `
          <div class="msg-bubble assistant-bubble">
            <div class="msg-header">
              <div class="assistant-name-group">
                <span class="ai-name">🧠 OCTOPUS AI</span>
                ${modelTag}
              </div>
              <span class="msg-time">${timeStr}</span>
            </div>
            ${actionTag}
            <div class="msg-text">${formattedContent}</div>
          </div>
        `;
      }

      this.messagesListEl.appendChild(item);
    });

    this.scrollToBottom();
  }

  private formatMarkdown(raw: string): string {
    let text = raw;
    // Bold **text**
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Code `code`
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bullet points
    text = text.replace(/^• (.*)$/gm, '<li class="bullet-item">• $1</li>');
    text = text.replace(/^- (.*)$/gm, '<li class="dash-item">- $1</li>');
    // Line breaks
    text = text.replace(/\n\n/g, '<div class="paragraph-break"></div>');
    text = text.replace(/\n/g, '<br/>');
    return text;
  }

  private async handleSendMessage(): Promise<void> {
    if (this.isSending) return;
    const text = this.inputEl?.value.trim();
    if (!text) return;

    this.inputEl.value = '';
    this.isSending = true;
    this.sendBtnEl.disabled = true;

    // Add user message to UI immediately
    const userMsg: ChatMessageUI = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    this.messages.push(userMsg);
    this.renderMessages();

    // Show typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'ai-typing-indicator';
    typingIndicator.className = 'chat-message assistant-message typing-container';
    typingIndicator.innerHTML = `
      <div class="msg-bubble assistant-bubble typing-bubble">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-text">Octopus AI telemetri ve kuralları analiz ediyor...</span>
      </div>
    `;
    this.messagesListEl.appendChild(typingIndicator);
    this.scrollToBottom();

    try {
      const response = await fetch('http://localhost:3000/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      typingIndicator.remove();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();
      if (json.success && json.data?.message) {
        this.messages.push(json.data.message);
        this.renderMessages();

        // Update telemetry strip
        if (json.data.systemSummary) {
          this.updateTelemetryStrip(json.data.systemSummary);
        }
      }
    } catch (err: any) {
      typingIndicator.remove();
      this.messages.push({
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Bağlantı Hatası**: Sunucuya ulaşılamadı (${err.message}). Lütfen arka plan servisinin aktif olduğundan emin olun.`,
        timestamp: new Date().toISOString(),
      });
      this.renderMessages();
    } finally {
      this.isSending = false;
      this.sendBtnEl.disabled = false;
      this.inputEl?.focus();
    }
  }

  private updateTelemetryStrip(summary: {
    regime: string;
    totalRules: number;
    openPositionsCount: number;
    totalBalanceUsd: number;
    autoTradeActive: boolean;
  }): void {
    const regimeEl = document.getElementById('chat-regime-val');
    if (regimeEl) regimeEl.textContent = summary.regime;

    const rulesEl = document.getElementById('chat-rules-val');
    if (rulesEl) rulesEl.textContent = `${summary.totalRules} Kural`;

    const posEl = document.getElementById('chat-pos-val');
    if (posEl) posEl.textContent = `${summary.openPositionsCount} Açık`;

    const balEl = document.getElementById('chat-bal-val');
    if (balEl) balEl.textContent = `$${summary.totalBalanceUsd.toFixed(1)}`;
  }

  private async handleClearChat(): Promise<void> {
    if (!confirm('Tüm sohbet geçmişini temizlemek istediğinize emin misiniz?')) return;

    try {
      await fetch('http://localhost:3000/api/chat/clear', { method: 'POST' });
      this.messages = [];
      await this.loadInitialHistoryAndSuggestions();
    } catch (e) {
      console.error('Error clearing chat:', e);
    }
  }

  private scrollToBottom(): void {
    if (this.messagesListEl) {
      this.messagesListEl.scrollTop = this.messagesListEl.scrollHeight;
    }
  }
}

// Global Singleton Instance
export const chatAssistantManager = new ChatAssistantManager();
