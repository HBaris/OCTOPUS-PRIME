import { LearningEngine } from '../learning/LearningEngine.js';
import { RuleStore } from '../learning/RuleStore.js';
import { IExchangeService } from '../exchange/IExchangeService.js';
import { CircuitBreaker } from '../risk/CircuitBreaker.js';
import { AutoTradeEngine } from '../decision/AutoTradeEngine.js';
import { NewsRadar } from '../news/NewsRadar.js';
import { DecisionEngine } from '../decision/DecisionEngine.js';
import { MarketRegime, RuleTier } from '../../config/constants.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actionTaken?: string;
  modelUsed?: string;
}

export interface ChatResponse {
  message: ChatMessage;
  actionTaken?: string;
  systemSummary?: {
    regime: string;
    totalRules: number;
    openPositionsCount: number;
    totalBalanceUsd: number;
    autoTradeActive: boolean;
  };
}

export class ChatAssistantService {
  private learningEngine: LearningEngine;
  private ruleStore: RuleStore;
  private exchangeService: IExchangeService;
  private circuitBreaker: CircuitBreaker;
  private autoTradeEngine?: AutoTradeEngine;
  private newsRadar?: NewsRadar;
  private decisionEngine?: DecisionEngine;

  private chatHistory: ChatMessage[] = [];

  constructor(dependencies: {
    learningEngine: LearningEngine;
    ruleStore?: RuleStore;
    exchangeService: IExchangeService;
    circuitBreaker: CircuitBreaker;
    autoTradeEngine?: AutoTradeEngine;
    newsRadar?: NewsRadar;
    decisionEngine?: DecisionEngine;
  }) {
    this.learningEngine = dependencies.learningEngine;
    this.ruleStore = dependencies.ruleStore || new RuleStore('rules.json');
    this.exchangeService = dependencies.exchangeService;
    this.circuitBreaker = dependencies.circuitBreaker;
    this.autoTradeEngine = dependencies.autoTradeEngine;
    this.newsRadar = dependencies.newsRadar;
    this.decisionEngine = dependencies.decisionEngine;

    logger.info('🧠 [ChatAssistantService] Octopus Prime AI Conversational Assistant initialized.');
  }

  public getChatHistory(): ChatMessage[] {
    return [...this.chatHistory];
  }

  public clearChatHistory(): void {
    this.chatHistory = [];
    logger.info('🧹 [ChatAssistantService] Chat history cleared.');
  }

  public async processUserMessage(userText: string): Promise<ChatResponse> {
    const trimmed = userText.trim();
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    this.chatHistory.push(userMsg);

    // 1. Check for command/action intents
    const actionResult = await this.evaluateActionIntents(trimmed);

    // 2. Build live context
    const contextSnapshot = await this.buildLiveContextSnapshot();

    // 3. Generate response via Configured AI Provider (Claude, Gemini, OpenAI, or Local Cognitive Engine)
    let assistantReply = '';
    let modelUsed = 'Octopus-Local-Cognitive-Engine';

    const provider = (config.AI_PROVIDER || 'auto').toLowerCase();
    const claudeKey = (config.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '').trim();
    const geminiKey = (config.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
    const openaiKey = (config.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim();

    try {
      if ((provider === 'claude' || provider === 'auto') && claudeKey) {
        // 1. Anthropic Claude
        const model = config.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
        assistantReply = await this.callClaudeAPI(trimmed, contextSnapshot, claudeKey, model);
        modelUsed = `Anthropic Claude (${model})`;
      } else if ((provider === 'gemini' || provider === 'auto') && geminiKey) {
        // 2. Google Gemini
        const model = config.AI_CHAT_MODEL || 'gemini-2.5-flash';
        assistantReply = await this.callGeminiAPI(trimmed, contextSnapshot, geminiKey, model);
        modelUsed = `Google Gemini (${model})`;
      } else if ((provider === 'openai' || provider === 'auto') && openaiKey) {
        // 3. OpenAI
        const model = config.OPENAI_MODEL || 'gpt-4o';
        assistantReply = await this.callOpenAIAPI(trimmed, contextSnapshot, openaiKey, model);
        modelUsed = `OpenAI (${model})`;
      } else {
        // 4. Zero-Key Local Cognitive Engine
        assistantReply = await this.generateLocalCognitiveResponse(trimmed, contextSnapshot, actionResult);
      }
    } catch (err: any) {
      logger.warn(`⚠️ External AI API call failed (${err.message}). Falling back to Local Cognitive Engine.`);
      assistantReply = await this.generateLocalCognitiveResponse(trimmed, contextSnapshot, actionResult);
    }

    // Append action notes if an action occurred
    if (actionResult.executed && !assistantReply.includes(actionResult.message)) {
      assistantReply = `${actionResult.message}\n\n${assistantReply}`;
    }

    const assistantMsg: ChatMessage = {
      id: `ast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: 'assistant',
      content: assistantReply,
      timestamp: new Date().toISOString(),
      actionTaken: actionResult.executed ? actionResult.actionName : undefined,
      modelUsed,
    };
    this.chatHistory.push(assistantMsg);

    // Keep history at reasonable limit
    if (this.chatHistory.length > 50) {
      this.chatHistory = this.chatHistory.slice(-50);
    }

    const [balance, positions] = await Promise.all([
      this.exchangeService.fetchBalance(),
      this.exchangeService.fetchPositions(),
    ]);
    const allRules = this.ruleStore.getAllRules();

    return {
      message: assistantMsg,
      actionTaken: actionResult.executed ? actionResult.actionName : undefined,
      systemSummary: {
        regime: this.learningEngine.getMarketRegime(),
        totalRules: allRules.length,
        openPositionsCount: positions.length,
        totalBalanceUsd: balance.totalUsd,
        autoTradeActive: this.autoTradeEngine?.isEnabled() ?? true,
      },
    };
  }

  public getSuggestedPrompts(): string[] {
    const regime = this.learningEngine.getMarketRegime();
    const rules = this.ruleStore.getAllRules();
    const strongCount = rules.filter((r) => r.tier === RuleTier.STRONG_RULE).length;

    return [
      `📊 Öğrendiğin kuralları ve başarı oranlarını açıkla (${strongCount} Güçlü Kural)`,
      `⚡ Şu anki piyasa rejimi (${regime}) ve açık pozisyonlarımız ne durumda?`,
      `🛡️ Risk seviyemiz, devre kesici ve mikro-scalp hedeflerimiz nasıl?`,
      `🎯 Yeni bir kural hipotezi nasıl eklenir veya test edilir?`,
      `📈 Son sinyaller ve piyasa duygu analizini özetle`,
    ];
  }

  // ==========================================
  // ACTION INTENTS (COMMAND DISPATCHER)
  // ==========================================
  private async evaluateActionIntents(text: string): Promise<{
    executed: boolean;
    actionName?: string;
    message: string;
  }> {
    const lower = text.toLowerCase();

    // 0. Close Positions / Emergency Exit Intent ("çabuk şu emri kapat", "BTC pozisyonunu kapat", "tüm pozisyonları kapat")
    if (
      lower.includes('kapat') ||
      lower.includes('sonlandır') ||
      lower.includes('çık') ||
      lower.includes('boşalt') ||
      lower.includes('sat ve çık')
    ) {
      if (
        lower.includes('emri') ||
        lower.includes('emir') ||
        lower.includes('pozisyon') ||
        lower.includes('işlem') ||
        lower.includes('hepsini') ||
        lower.includes('tüm') ||
        lower.includes('acil') ||
        lower.includes('çabuk') ||
        lower.includes('şu')
      ) {
        const positions = await this.exchangeService.fetchPositions();
        if (!positions || positions.length === 0) {
          return {
            executed: true,
            actionName: 'CLOSE_POSITION_NONE',
            message: 'ℹ️ **Bilgi**: Kapatılacak aktif bir pozisyon bulunmuyor (Tüm kasa zaten nakitte).',
          };
        }

        // Check if user specified a coin e.g. "BTC pozisyonunu kapat", "ETH kapat"
        const knownSymbols = ['BTC', 'ETH', 'SOL', 'AVAX', 'NEAR', 'SUI', 'APT', 'ARB', 'OP', 'LINK', 'DOGE', 'PEPE', 'XRP', 'BNB'];
        const matchedCoin = knownSymbols.find((c) => lower.includes(c.toLowerCase()));

        if (matchedCoin) {
          const targetSym = `${matchedCoin}/USDT`;
          await this.exchangeService.closePosition(targetSym);
          return {
            executed: true,
            actionName: `CLOSE_POSITION_${matchedCoin}`,
            message: `⚡ **Acil Aksiyon Alındı**: **${targetSym}** pozisyonu anında kapatıldı ve teminat kasaya iade edildi.`,
          };
        } else {
          // Close ALL positions
          const closedCount = positions.length;
          for (const pos of positions) {
            await this.exchangeService.closePosition(pos.symbol);
          }
          return {
            executed: true,
            actionName: 'CLOSE_ALL_POSITIONS',
            message: `🚨 **Acil Aksiyon Alındı**: Açık olan **${closedCount} adet pozisyonun tümü** anında kapatıldı ve tüm bakiye güvenli şekilde nakte çekildi.`,
          };
        }
      }
    }

    // 1. Change Market Regime
    if (lower.includes('rejimi') || lower.includes('rejim')) {
      if (lower.includes('bull') || lower.includes('boğa')) {
        this.learningEngine.setMarketRegime(MarketRegime.BULL);
        return {
          executed: true,
          actionName: 'SET_REGIME_BULL',
          message: '🟢 **Aksiyon Alındı**: Piyasa rejimi **BULL (Boğa)** olarak güncellendi.',
        };
      } else if (lower.includes('bear') || lower.includes('ayı')) {
        this.learningEngine.setMarketRegime(MarketRegime.BEAR);
        return {
          executed: true,
          actionName: 'SET_REGIME_BEAR',
          message: '🔴 **Aksiyon Alındı**: Piyasa rejimi **BEAR (Ayı)** olarak güncellendi.',
        };
      } else if (lower.includes('sideways') || lower.includes('yatay')) {
        this.learningEngine.setMarketRegime(MarketRegime.SIDEWAYS);
        return {
          executed: true,
          actionName: 'SET_REGIME_SIDEWAYS',
          message: '🟡 **Aksiyon Alındı**: Piyasa rejimi **SIDEWAYS (Yatay)** olarak güncellendi.',
        };
      }
    }

    // 2. Reset Cooldown / Circuit Breaker
    if (
      lower.includes('cooldown') ||
      lower.includes('devre kesici') ||
      lower.includes('soğuma') ||
      lower.includes('reset risk')
    ) {
      if (lower.includes('sıfırla') || lower.includes('reset') || lower.includes('aç') || lower.includes('kaldır')) {
        this.circuitBreaker.resumeTrading('Kaptan AI sohbet komutu ile devre kesici sıfırlandı.');
        return {
          executed: true,
          actionName: 'RESET_CIRCUIT_BREAKER',
          message: '⚡ **Aksiyon Alındı**: Devre kesici (Circuit Breaker) ve ardışık kayıp sayacı sıfırlandı. İşlemler serbest.',
        };
      }
    }

    // 3. Toggle Auto-Trade
    if (lower.includes('oto-trade') || lower.includes('otomatik işlem') || lower.includes('otonom')) {
      if (lower.includes('durdur') || lower.includes('kapat') || lower.includes('pasif')) {
        if (this.autoTradeEngine) {
          this.autoTradeEngine.setEnabled(false);
          return {
            executed: true,
            actionName: 'DISABLE_AUTOTRADE',
            message: '🛑 **Aksiyon Alındı**: Otonom mikro-scalping motoru **DURDURULDU**.',
          };
        }
      } else if (lower.includes('başlat') || lower.includes('aç') || lower.includes('aktif')) {
        if (this.autoTradeEngine) {
          this.autoTradeEngine.setEnabled(true);
          return {
            executed: true,
            actionName: 'ENABLE_AUTOTRADE',
            message: '🚀 **Aksiyon Alındı**: Otonom mikro-scalping motoru **AKTİF** edildi ($0.30 hedef kâr).',
          };
        }
      }
    }

    // 4. Create custom hypothesis rule
    if (lower.includes('kural ekle') || lower.includes('hipotez oluştur')) {
      const ruleId = `rule_custom_${Date.now()}`;
      this.learningEngine.recordObservation(
        ruleId,
        `Kaptan Tarafından Oluşturulan Hipotez: ${text.slice(0, 60)}`,
        'HYBRID',
        'CUSTOM_STRATEGY',
        'kaptan_chat',
        true
      );
      return {
        executed: true,
        actionName: 'CREATE_RULE_HYPOTHESIS',
        message: `🧪 **Aksiyon Alındı**: Yeni kural hipotezi (${ruleId}) oluşturuldu ve öğrenme havuzuna eklendi.`,
      };
    }

    return { executed: false, message: '' };
  }

  // ==========================================
  // CONTEXT BUILDER
  // ==========================================
  private async buildLiveContextSnapshot(): Promise<string> {
    const [balance, positions] = await Promise.all([
      this.exchangeService.fetchBalance(),
      this.exchangeService.fetchPositions(),
    ]);
    const regime = this.learningEngine.getMarketRegime();
    const rules = this.ruleStore.getAllRules();
    const strongRules = rules.filter((r) => r.tier === RuleTier.STRONG_RULE);
    const weakRules = rules.filter((r) => r.tier === RuleTier.WEAK_RULE);
    const hypotheses = rules.filter((r) => r.tier === RuleTier.HYPOTHESIS);

    const cbState = this.circuitBreaker.getState();
    const autoTradeEnabled = this.autoTradeEngine?.isEnabled() ?? true;

    const totalUnrealizedPnl = positions.reduce((acc, p) => acc + (p.unrealizedPnl || 0), 0);

    const positionsFormatted =
      positions.length === 0
        ? 'Açık pozisyon bulunmuyor (Tüm kasa güvende/nakitte).'
        : positions
            .map(
              (p) =>
                `- **${p.symbol}** (${p.side} ${p.leverage || 1}x): Miktar=${p.amount.toFixed(4)}, Giriş=$${p.entryPrice.toFixed(2)}, Anlık=$${p.markPrice.toFixed(2)}, PnL=$${p.unrealizedPnl.toFixed(2)} (${(p.percentagePnl || 0).toFixed(1)}%), Likidasyon=$${(p.liquidationPrice || 0).toFixed(2)}`
            )
            .join('\n');

    const rulesFormatted = rules
      .map(
        (r) =>
          `- [${r.tier}] **${r.description}** (Kalıp: \`${r.pattern}\`): Başarı: %${((r.successRate || 0) * 100).toFixed(0)} (${r.successCount}K / ${r.failCount}Z, Toplam: ${r.observationCount} Gözlem, Güven Bonusu: +%${r.confidenceBonus})`
      )
      .join('\n');

    return `
=== OCTOPUS PRIME CANLI SİSTEM TELEMETRİSİ & BELLEĞİ ===
- Zaman: ${new Date().toLocaleString('tr-TR')}
- Portföy Toplam Bakiye: $${balance.totalUsd.toFixed(2)} (Kullanılabilir: $${balance.freeUsdt.toFixed(2)})
- Toplam Gerçekleşmemiş PnL: $${totalUnrealizedPnl.toFixed(2)}
- Aktif Piyasa Rejimi: ${regime} (Boğa/Ayı/Yatay)
- Devre Kesici (Risk): ${cbState.isHalted ? `🚨 SOĞUMA MODUNDA (Kalan: ${Math.round(cbState.remainingSeconds / 60)} dk)` : `🟢 NORMAL (Ardışık Kayıp: ${cbState.consecutiveLosses}/${config.COOLDOWN_CONSECUTIVE_LOSSES})`}
- Otonom Mikro-Scalp Motoru: ${autoTradeEnabled ? `AKTİF (Hedef: $${config.MICRO_SCALP_TARGET_USD}/işlem, Marjin: $${config.MICRO_SCALP_MARGIN_USD})` : 'PASİF'}

=== ÖĞRENİLEN STRATEJİ KURALLARI (${rules.length} Toplam) ===
- Güçlü Kurallar: ${strongRules.length} adet
- Zayıf Kurallar: ${weakRules.length} adet
- Test Aşamasındaki Hipotezler: ${hypotheses.length} adet
${rulesFormatted}

=== AÇIK POZİSYONLAR (${positions.length} Adet) ===
${positionsFormatted}
======================================================
`;
  }

  // ==========================================
  // CLAUDE LLM CALL (ANTHROPIC MESSAGES API)
  // ==========================================
  private async callClaudeAPI(
    userQuery: string,
    context: string,
    apiKey: string,
    model: string = 'claude-3-5-sonnet-20241022'
  ): Promise<string> {
    const endpoint = 'https://api.anthropic.com/v1/messages';

    const systemPrompt = `Sen "Octopus Prime" adlı otonom, kendi kendine öğrenen (self-learning), 3-kanallı (Grafik indikatörleri, Haber duygu analizi, Sosyal medya istihbaratı) kripto ticaret sisteminin Baş Yapay Zeka Beynisin (Octopus AI Core).
Kullanıcı senin Kaptanın (Sistem Yöneticisi ve Kıdemli Trader).
Karakterin: Zeki, net, samimi ama son derece profesyonel, fütüristik, veriye dayalı konuşan ve şeffaf bir baş danışman.
Cevaplarını her zaman Türkçe, anlaşılır, madde işaretleri veya vurgularla zenginleştirilmiş şekilde ver.
Aşağıda sana sistemin o anki gerçek ve anlık telemetrisi (öğrenilen kurallar, rejim, portföy, pozisyonlar, risk) veriliyor. Kaptanın serbest sohbetlerine, sorularına, strateji ve kaldıraç analizlerine tam bir quant trading ortağı gibi cevap ver.`;

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add recent history (up to last 6 turns)
    const recentHistory = this.chatHistory.slice(-6);
    for (const msg of recentHistory) {
      if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    // Ensure current user prompt is included with real-time context
    messages.push({
      role: 'user',
      content: `[GÜNCEL SİSTEM BİLGİLERİ VE TELEMETRİ]\n${context}\n\n[KAPTANIN MESAJI]: ${userQuery}`,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Claude API HTTP ${response.status}: ${errBody}`);
    }

    const data: any = await response.json();
    const contentBlock = data?.content?.[0]?.text;
    if (!contentBlock) {
      throw new Error('Claude response did not contain valid text content block.');
    }

    return contentBlock;
  }

  // ==========================================
  // GEMINI LLM CALL
  // ==========================================
  private async callGeminiAPI(
    userQuery: string,
    context: string,
    apiKey: string,
    model: string = 'gemini-2.5-flash'
  ): Promise<string> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const systemInstructionText = `Sen "Octopus Prime" adlı otonom, kendi kendine öğrenen (self-learning), 3-kanallı (Grafik indikatörleri, Haber duygu analizi, Sosyal medya istihbaratı) kripto ticaret sisteminin Baş Yapay Zeka Beynisin (Octopus AI Core).
Kullanıcı senin Kaptanın (Sistem Yöneticisi ve Kıdemli Trader).
Karakterin: Zeki, net, samimi ama son derece profesyonel, fütüristik, veriye dayalı konuşan ve şeffaf bir baş danışman.
Cevaplarını her zaman Türkçe, anlaşılır, madde işaretleri veya vurgularla zenginleştirilmiş şekilde ver.
Aşağıda sana sistemin o anki gerçek ve anlık telemetrisi (öğrenilen kurallar, rejim, portföy, pozisyonlar, risk) veriliyor. Tüm cevaplarında bu gerçek verileri referans alarak tam doğrulukla yanıtla. Kaptanın emirlerine ve sorularına tam bir pair-programming ve quant trading ortağı gibi cevap ver.`;

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Add recent history (up to last 6 turns)
    const recentHistory = this.chatHistory.slice(-6);
    for (const msg of recentHistory) {
      if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant') {
        contents.push({ role: 'model', parts: [{ text: msg.content }] });
      }
    }

    // Ensure current user prompt is included with context
    contents.push({
      role: 'user',
      parts: [
        {
          text: `[GÜNCEL SİSTEM BİLGİLERİ]\n${context}\n\n[KAPTANIN MESAJI]: ${userQuery}`,
        },
      ],
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstructionText }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1200,
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API HTTP ${response.status}: ${errBody}`);
    }

    const data: any = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('Gemini response did not contain valid text part.');
    }

    return candidateText;
  }

  // ==========================================
  // OPENAI LLM CALL
  // ==========================================
  private async callOpenAIAPI(
    userQuery: string,
    context: string,
    apiKey: string,
    model: string = 'gpt-4o'
  ): Promise<string> {
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const systemPrompt = `Sen "Octopus Prime" adlı otonom, kendi kendine öğrenen kripto ticaret sisteminin Baş Yapay Zeka Beynisin (Octopus AI Core).
Kullanıcı senin Kaptanın. Türkçe, profesyonel, analitik ve net cevap ver.`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: `${systemPrompt}\n\n[GÜNCEL SİSTEM BİLGİLERİ]\n${context}` },
    ];

    const recentHistory = this.chatHistory.slice(-6);
    for (const msg of recentHistory) {
      if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    messages.push({ role: 'user', content: userQuery });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI API HTTP ${response.status}: ${errBody}`);
    }

    const data: any = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('OpenAI response did not contain content.');
    return text;
  }

  // ==========================================
  // LOCAL COGNITIVE ENGINE (ZERO-KEY FALLBACK)
  // ==========================================
  private async generateLocalCognitiveResponse(
    userText: string,
    context: string,
    actionResult: { executed: boolean; message: string }
  ): Promise<string> {
    const lower = userText.toLowerCase();
    const rules = this.ruleStore.getAllRules();
    const strongRules = rules.filter((r) => r.tier === RuleTier.STRONG_RULE);
    const weakRules = rules.filter((r) => r.tier === RuleTier.WEAK_RULE);
    const hypotheses = rules.filter((r) => r.tier === RuleTier.HYPOTHESIS);
    const regime = this.learningEngine.getMarketRegime();

    // 0. Inquiries about margin vs balance / free margin / teminat / fark nedir
    if (
      lower.includes('teminat') ||
      lower.includes('boş teminat') ||
      lower.includes('bos teminat') ||
      lower.includes('fark ne') ||
      lower.includes('fark nedir') ||
      lower.includes('kullanılan teminat') ||
      lower.includes('serbest bakiye')
    ) {
      const balance = await this.exchangeService.fetchBalance();
      const positions = await this.exchangeService.fetchPositions();
      const totalBalance = balance.totalUsd;
      const freeMargin = balance.freeUsdt;
      const usedMargin = totalBalance - freeMargin;

      return `💰 **Boş Teminat ve Toplam Bakiye Analizi**

Kaptan, canlı hesabımızdaki bakiyelerin açıklaması ve anlık değerlerimiz:

1. 🏦 **Toplam Bakiye (Total Equity)**: **$${totalBalance.toFixed(2)}**
   - Kasanızın toplam değeridir. Açık pozisyonlardaki teminatlar + serbest nakit USDT toplamıdır.

2. 🔓 **Boş Teminat (Free Margin)**: **$${freeMargin.toFixed(2)}**
   - Pozisyonlara kilitlenmemiş, yeni bir alım-satım işlemi açmak için hazır olan serbest bakiyedir.

3. 🔒 **Kullanılan Teminat (Used Margin)**: **$${usedMargin.toFixed(2)}**
   - Şu an açık olan **${positions.length} adet pozisyonda** teminat olarak bağlı tutulan paradır.

📊 **Farkın Nedeni**: Toplam Bakiye ($${totalBalance.toFixed(2)}) ile Boş Teminat ($${freeMargin.toFixed(2)}) arasındaki **$${usedMargin.toFixed(2)}** tutarındaki fark, açık pozisyonlarınızın teminatıdır. Pozisyonlar kapandıkça kâr/zarar eklenerek Boş Teminat'a geri dönecektir.`;
    }

    // 1. Inquiries about learning persistence / file storage / memory
    if (
      lower.includes('nereye not') ||
      lower.includes('nereye yaz') ||
      lower.includes('nerede tut') ||
      lower.includes('hafıza') ||
      lower.includes('kaydediyor') ||
      lower.includes('rules.json')
    ) {
      return `💾 **Öğrenme Hafızası ve Kayıt Mimarisi Raporu**

Kaptan, öğrendiğim tüm tecrübeler ve sistem verileri disk üzerinde şu dosyalarda kalıcı olarak saklanır:

1. 🧠 **\`rules.json\`**: Doğrulanan tüm **Güçlü Kurallar** (\`${strongRules.length}\`), **Zayıf Kurallar** (\`${weakRules.length}\`) ve **Hipotezler** (\`${hypotheses.length}\`), başarı/başarısızlık sayıları, başarı oranları ve bağımsız kaynak teyitleri burada tutulur.
2. 📝 **\`feedback.json\`**: Arayüz üzerinden verdiğiniz 👍/👎 onay ve ret kayıtları bu dosyada saklanır.
3. 📈 **\`correlations.json\`**: Haber kaynaklarının fiyat hareketleriyle tarihsel korelasyon puanları tutulur.
4. 📜 **\`audit_log.json\`**: Sistemde ve ajanlar arasında gerçekleşen tüm işlemler zaman damgalı olarak arşivlenir.

💡 *Sistem her işlem kapandığında \`recordObservation\` ile \`rules.json\` dosyasını anında günceller; böylece sunucu yeniden başlasa bile öğrendiklerini asla unutmaz.*`;
    }

    // 2. Inquiries about trading rationale, leverage, tips, why a position was taken (10x, tüyo, nereden alıp girdin)
    if (
      lower.includes('10x') ||
      lower.includes('tüyo') ||
      lower.includes('nereden alıp') ||
      lower.includes('nasıl girdin') ||
      lower.includes('neden girdin') ||
      lower.includes('kaldıraç')
    ) {
      return `🎯 **İşlem Karar ve Kaldıraç Mantığı**

Kaptan, sistem hiçbir zaman rastgele tüyolarla veya hislerle işlem açmaz. Pozisyonlara giriş kararı **3 Bağımsız Kanalın Sentezi** ile verilir:

1. 📊 **Teknik Momentum**: 15 dakikalık grafiklerde **EMA 9/21 Kesişimi** ve **RSI (14)** aşırı satım/alım bölgeleri taranır.
2. 📰 **Haber Duygu Analizi**: CryptoPanic ve haber akışından gelen başlıklar ONNX DistilBERT duygu motoruyla puanlanır (+0.50 üzeri pozitif).
3. 💬 **Sosyal İstihbarat**: Telegram ve sosyal sinyal radarları taranarak teyit aranır.
4. 🧠 **Kural Uyumu Bonusu**: Hafızadaki kurallarla eşleşen sinyallere **+${strongRules[0]?.confidenceBonus || 20} puana varan** güven bonusu eklenir. Sinyal güven skoru **%${config.DECISION_SIGNAL_THRESHOLD}** barajını aştığında otonom işlem açılır.

⚙️ **Kaldıraç Güvenliği**: Kaldıraç oranı risk modelimizce **${config.DEFAULT_LEVERAGE}x - ${config.MAX_LEVERAGE_ALLOWED}x (isolated)** olarak sınırlandırılmıştır ve sermaye koruması için her mikrosaniyelik pozisyon $${config.MICRO_SCALP_STOP_LOSS_USD} stop-loss ile korunur.`;
    }

    // 3. Inquiries about AI models, Claude, Gemini, how to connect LLMs
    if (
      lower.includes('claude') ||
      lower.includes('gemini') ||
      lower.includes('gpt') ||
      lower.includes('model') ||
      lower.includes('bağla') ||
      lower.includes('api key')
    ) {
      return `🤖 **Yapay Zeka Modeli & Entegrasyon Rehberi**

Şu anda **Octopus Yerel Bilişsel Motor (Zero-Key Local Engine)** devrededir. 

Daha derin akıl yürütme (reasoning) ve serbest sohbet için **Anthropic Claude 3.5 Sonnet** bağlamak isterseniz:
1. Proje ana dizinindeki \`.env\` dosyasını açın.
2. Şu satırları ekleyin veya güncelleyin:
\`\`\`env
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxx
CLAUDE_MODEL=claude-3-5-sonnet-20241022
\`\`\`
3. Sistemi yeniden başlattığınızda asistan doğrudan **Claude 3.5 Sonnet** zekasıyla konuşmaya başlayacaktır.`;
    }

    // 4. Inquiries explicitly requesting learned rules list / details
    if (
      (lower.includes('kural') &&
        (lower.includes('liste') ||
          lower.includes('kaç') ||
          lower.includes('neler') ||
          lower.includes('göster') ||
          lower.includes('rapor') ||
          lower.includes('başarı'))) ||
      lower.includes('öğrendiğin kurallar')
    ) {
      let ruleList = rules
        .map(
          (r) =>
            `• **[${r.tier}]** ${r.description} (\`${r.pattern}\`)\n  - Başarı Oranı: **%${((r.successRate || 0) * 100).toFixed(0)}** (${r.successCount} Başarılı / ${r.failCount} Başarısız)\n  - Karar Motoru Bonusu: **+${r.confidenceBonus || 0} Puan**`
        )
        .join('\n\n');

      return `🧠 **Öğrenme Motoru ve Kural Durumu Raporu**

Kaptan, şu an hafızamda **${rules.length} adet** doğrulanmış ve test edilen strateji kalıbı bulunuyor:
- 🏆 **${strongRules.length} Güçlü Kural** (Yüksek güvenilirlik)
- ⚠️ **${weakRules.length} Zayıf Kural** (Doğrulama aşamasında)
- 🧪 **${hypotheses.length} Hipotez** (Gözlem altında)

${ruleList}

💡 *Sistem 3 kanaldan (Grafik, Haber, Sosyal) gelen sinyalleri bu kurallarla eşleştirerek güvenilirlik skoruna bonus ekler ve hatalı sinyalleri eler.*`;
    }

    // 5. Inquiries about open positions and portfolio
    if (lower.includes('pozisyon') || lower.includes('kasa') || lower.includes('bakiye') || lower.includes('pnl')) {
      return `💼 **Portföy ve Pozisyon Raporu**

Kaptan, portföy durumumuz güncel telemetriye göre şu şekildedir:
- 🌐 **Mevcut Piyasa Rejimi**: **${regime}**
- 🛡️ **Devre Kesici Durumu**: ${this.circuitBreaker.getState().isHalted ? '🚨 Soğuma Modunda' : '🟢 Güvenli / Aktif'}
- 🤖 **Otonom Scalper**: ${this.autoTradeEngine?.isEnabled() ? `Aktif ($${config.MICRO_SCALP_TARGET_USD} hedef kâr)` : 'Pasif'}

📊 *Detaylı açık pozisyonlar ve mum grafikleri sağ panelde canlı olarak TradingView üzerinde çizilmektedir.*`;
    }

    // 6. Inquiries about risk or cooldown
    if (lower.includes('risk') || lower.includes('cooldown') || lower.includes('kayıp') || lower.includes('güven')) {
      const cb = this.circuitBreaker.getState();
      return `🛡️ **Risk ve Devre Kesici Raporu**

- **Durum**: ${cb.isHalted ? `🚨 SOĞUMADA (${Math.round(cb.remainingSeconds / 60)} dk kaldı)` : '🟢 GÜVENLİ (İşlemler Devam Ediyor)'}
- **Ardışık Kayıp Sayacı**: ${cb.consecutiveLosses} / ${config.COOLDOWN_CONSECUTIVE_LOSSES} Maksimum
- **Kaldıraç Koruma Sınırı**: ${config.MAX_LEVERAGE_ALLOWED}x maksimum (Varsayılan: ${config.DEFAULT_LEVERAGE}x isolated)
- **Mikro-Scalp Savunması**: $${config.MICRO_SCALP_STOP_LOSS_USD} zarar kes stop-loss devrede.

İstediğiniz zaman bana *"Cooldown'ı sıfırla"* diyerek risk sayacını temizleyebilirsiniz.`;
    }

    // 7. Inquiries about market regime or coins
    if (lower.includes('btc') || lower.includes('eth') || lower.includes('sol') || lower.includes('piyasa') || lower.includes('durum')) {
      return `📊 **Piyasa & Varlık Analizi**

Kaptan, 3 kanallı tarama motorumuz devrede:
- **Piyasa Rejimi**: **${regime}** (Tüm sinyaller bu rejim filtresinden geçer)
- **Taranan Varlıklar**: BTC/USDT, ETH/USDT, SOL/USDT ve 12 Yüksek Hacimli Altcoin (DOGE, PEPE, AVAX, LINK, SUI, vb.)
- **Teknik Momentum**: 15m EMA(9/21) ve RSI(14) canlı akışı devam ediyor.

Rejimi değiştirmek isterseniz *"Piyasa rejimini BEAR yap"* veya *"Boğa rejimine geç"* demeniz yeterlidir.`;
    }

    // 8. Default General Conversational Response
    return `🫡 **Emredersiniz Kaptan!**

Octopus Prime Otonom Zeka Çekirdeği emrinizde. Sizin için arka planda:
1. **3-Kanallı Sinyal Sentezi**: Mum grafikleri, anlık haber duygu analizi ve sosyal radar verileri birleştiriliyor.
2. **Kendi Kendine Öğrenme**: Başarılı ve başarısız her işlem \`RuleStore\` üzerinde değerlendirilip kurallar güncelleniyor.
3. **Mikro-Scalping**: Küçük kâr hedefleri ($${config.MICRO_SCALP_TARGET_USD}) otonom olarak toplanıyor.

Bana öğrenilen kuralları sorabilir, rejim değişikliği yaptırabilir, risk durumunu inceletebilir veya yeni strateji hipotezleri ekletebilirsiniz. Ne yapmak istersiniz?`;
  }
}
