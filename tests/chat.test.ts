import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { ChatAssistantService } from '../src/services/ai/ChatAssistantService.js';
import { LearningEngine } from '../src/services/learning/LearningEngine.js';
import { RuleStore } from '../src/services/learning/RuleStore.js';
import { CircuitBreaker } from '../src/services/risk/CircuitBreaker.js';
import { AutoTradeEngine } from '../src/services/decision/AutoTradeEngine.js';
import { BinanceService } from '../src/services/binance/BinanceService.js';
import { MarketRegime, RuleTier } from '../src/config/constants.js';
import { createApp } from '../src/server/app.js';
import { AgentManager } from '../src/agents/AgentManager.js';
import { NewsRadar } from '../src/services/news/NewsRadar.js';
import { KeywordsManager } from '../src/services/news/KeywordsManager.js';
import { SentimentAnalyzer } from '../src/services/news/SentimentAnalyzer.js';
import { ImpactScorer } from '../src/services/impact/ImpactScorer.js';
import { DecisionEngine } from '../src/services/decision/DecisionEngine.js';
import { FeedbackSystem } from '../src/services/feedback/FeedbackSystem.js';
import { CorrelationTracker } from '../src/services/correlation/CorrelationTracker.js';

describe('ChatAssistantService & /api/chat Endpoints', () => {
  const testRulesFile = path.join(__dirname, 'test_chat_rules.json');
  let ruleStore: RuleStore;
  let learningEngine: LearningEngine;
  let circuitBreaker: CircuitBreaker;
  let exchangeService: BinanceService;
  let autoTradeEngine: AutoTradeEngine;
  let chatService: ChatAssistantService;
  let app: any;

  beforeEach(() => {
    if (fs.existsSync(testRulesFile)) fs.unlinkSync(testRulesFile);
    ruleStore = new RuleStore(testRulesFile);
    learningEngine = new LearningEngine(ruleStore);
    circuitBreaker = new CircuitBreaker(3, 30);
    exchangeService = new BinanceService();
    autoTradeEngine = new AutoTradeEngine(exchangeService, circuitBreaker);

    // Pre-seed a strong rule for testing
    learningEngine.recordObservation('rule_1', 'BULL EMA Kesişimi', 'TECHNICAL', 'EMA_BULL', 'src_a', true);
    learningEngine.recordObservation('rule_1', 'BULL EMA Kesişimi', 'TECHNICAL', 'EMA_BULL', 'src_b', true);
    learningEngine.recordObservation('rule_1', 'BULL EMA Kesişimi', 'TECHNICAL', 'EMA_BULL', 'src_c', true);
    learningEngine.recordObservation('rule_1', 'BULL EMA Kesişimi', 'TECHNICAL', 'EMA_BULL', 'src_d', true);

    chatService = new ChatAssistantService({
      learningEngine,
      ruleStore,
      exchangeService,
      circuitBreaker,
      autoTradeEngine,
    });

    const keywordsManager = new KeywordsManager();
    const sentimentAnalyzer = new SentimentAnalyzer();
    const impactScorer = new ImpactScorer();
    const newsRadar = new NewsRadar(keywordsManager, sentimentAnalyzer, impactScorer);
    const correlationTracker = new CorrelationTracker(exchangeService);
    const feedbackSystem = new FeedbackSystem();
    const decisionEngine = new DecisionEngine(
      exchangeService,
      correlationTracker,
      feedbackSystem,
      learningEngine,
      circuitBreaker
    );
    const agentManager = new AgentManager(exchangeService, correlationTracker);

    app = createApp({
      agentManager,
      exchangeService,
      newsRadar,
      keywordsManager,
      decisionEngine,
      feedbackSystem,
      learningEngine,
      circuitBreaker,
      autoTradeEngine,
      chatAssistantService: chatService,
    });
  });

  afterEach(() => {
    if (fs.existsSync(testRulesFile)) fs.unlinkSync(testRulesFile);
  });

  test('should process user inquiry about learned rules and return articulate reply', async () => {
    const response = await chatService.processUserMessage('Öğrendiğin kuralları listele ve göster');

    expect(response.message.role).toBe('assistant');
    expect(response.message.content).toContain('Öğrenme Motoru ve Kural Durumu Raporu');
    expect(response.message.content).toContain('BULL EMA Kesişimi');
    expect(response.systemSummary?.totalRules).toBeGreaterThanOrEqual(1);
  });

  test('should explain persistence architecture when asked where learning is saved', async () => {
    const response = await chatService.processUserMessage('Peki bu arkadaş öğrendiklerini nereye not ediyor?');

    expect(response.message.role).toBe('assistant');
    expect(response.message.content).toContain('Öğrenme Hafızası ve Kayıt Mimarisi Raporu');
    expect(response.message.content).toContain('rules.json');
    expect(response.message.content).toContain('feedback.json');
  });

  test('should explain leverage and signal rationale when asked about 10x or tips', async () => {
    const response = await chatService.processUserMessage('10x tüyosunu nereden alıp da girdin?');

    expect(response.message.role).toBe('assistant');
    expect(response.message.content).toContain('İşlem Karar ve Kaldıraç Mantığı');
    expect(response.message.content).toContain('3 Bağımsız Kanalın Sentezi');
  });

  test('should explain how to connect Claude when asked about Claude model', async () => {
    const response = await chatService.processUserMessage('Claude modelini bağlamak istersem nasıl bağlarız?');

    expect(response.message.role).toBe('assistant');
    expect(response.message.content).toContain('ANTHROPIC_API_KEY');
    expect(response.message.content).toContain('claude-3-5-sonnet');
  });

  test('should detect and execute market regime change intent via chat', async () => {
    const response = await chatService.processUserMessage('Piyasa rejimini BEAR olarak değiştir');

    expect(response.actionTaken).toBe('SET_REGIME_BEAR');
    expect(learningEngine.getMarketRegime()).toBe(MarketRegime.BEAR);
    expect(response.message.content).toContain('Piyasa rejimi **BEAR (Ayı)** olarak güncellendi');
  });

  test('should detect and execute cooldown reset intent', async () => {
    // Trigger cooldown first
    circuitBreaker.triggerCooldown();
    expect(circuitBreaker.getState().isHalted).toBe(true);

    const response = await chatService.processUserMessage("Devre kesiciyi ve cooldown'ı sıfırla");
    expect(response.actionTaken).toBe('RESET_CIRCUIT_BREAKER');
    expect(circuitBreaker.getState().isHalted).toBe(false);
  });

  test('should detect and execute close position intent via chat', async () => {
    // 1. Open a test position
    await exchangeService.executeOrder('BTC/USDT', 'BUY', 50);
    const positionsBefore = await exchangeService.fetchPositions();
    expect(positionsBefore.length).toBe(1);

    // 2. Command close via chat: "çabuk şu emri kapat"
    const response = await chatService.processUserMessage('çabuk şu emri kapat');
    expect(response.actionTaken).toBe('CLOSE_ALL_POSITIONS');
    expect(response.message.content).toContain('Acil Aksiyon Alındı');

    const positionsAfter = await exchangeService.fetchPositions();
    expect(positionsAfter.length).toBe(0);
  });

  test('should detect and execute auto-trade toggle intent', async () => {
    expect(autoTradeEngine.isEnabled()).toBe(true);

    const response = await chatService.processUserMessage('Oto-trade motorunu durdur');
    expect(response.actionTaken).toBe('DISABLE_AUTOTRADE');
    expect(autoTradeEngine.isEnabled()).toBe(false);
  });

  test('should return suggestions and manage chat history', () => {
    const suggestions = chatService.getSuggestedPrompts();
    expect(suggestions.length).toBeGreaterThanOrEqual(3);

    chatService.clearChatHistory();
    expect(chatService.getChatHistory().length).toBe(0);
  });

  // REST API Endpoints tests
  test('POST /api/chat/message should return 200 with assistant response', async () => {
    const res = await request(app)
      .post('/api/chat/message')
      .send({ message: 'Kasa ve pozisyon durumumuz nedir?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message.content).toContain('Portföy ve Pozisyon Raporu');
    expect(res.body.data.systemSummary.totalBalanceUsd).toBeGreaterThanOrEqual(0);
  });

  test('POST /api/chat/message with empty text should return 400', async () => {
    const res = await request(app)
      .post('/api/chat/message')
      .send({ message: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/chat/suggestions should return prompt suggestions', async () => {
    const res = await request(app).get('/api/chat/suggestions');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('POST /api/chat/clear should clear history', async () => {
    await request(app).post('/api/chat/message').send({ message: 'Test mesajı' });
    const clearRes = await request(app).post('/api/chat/clear');
    expect(clearRes.status).toBe(200);

    const histRes = await request(app).get('/api/chat/history');
    expect(histRes.body.data.length).toBe(0);
  });
});
