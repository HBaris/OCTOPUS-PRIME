import request from 'supertest';
import { createApp } from '../src/server/app.js';
import { KeywordsManager } from '../src/services/news/KeywordsManager.js';
import { SentimentAnalyzer } from '../src/services/news/SentimentAnalyzer.js';
import { ImpactScorer } from '../src/services/impact/ImpactScorer.js';
import { NewsRadar } from '../src/services/news/NewsRadar.js';
import { BinanceService } from '../src/services/binance/BinanceService.js';
import { CorrelationTracker } from '../src/services/correlation/CorrelationTracker.js';
import { FeedbackSystem } from '../src/services/feedback/FeedbackSystem.js';
import { DecisionEngine } from '../src/services/decision/DecisionEngine.js';
import { AgentManager } from '../src/agents/AgentManager.js';
import { FeedbackEmoji } from '../src/config/constants.js';

describe('REST API Endpoints', () => {
  let app: any;
  let correlationTracker: CorrelationTracker;
  let newsRadar: NewsRadar;

  beforeAll(() => {
    const keywordsManager = new KeywordsManager('keywords.json');
    const sentimentAnalyzer = new SentimentAnalyzer();
    const impactScorer = new ImpactScorer();
    newsRadar = new NewsRadar(keywordsManager, sentimentAnalyzer, impactScorer);

    const binanceService = new BinanceService();
    correlationTracker = new CorrelationTracker(binanceService, 'tests/api_corr.json');
    const feedbackSystem = new FeedbackSystem('tests/api_fb.json');
    const decisionEngine = new DecisionEngine(binanceService, correlationTracker, feedbackSystem);
    const agentManager = new AgentManager(binanceService, correlationTracker);

    app = createApp({
      agentManager,
      binanceService,
      newsRadar,
      keywordsManager,
      decisionEngine,
      feedbackSystem,
    });
  });

  afterAll(() => {
    correlationTracker.stop();
    newsRadar.stop();
  });

  it('GET /api/health should return ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/state should return system and 5 agent states', async () => {
    const res = await request(app).get('/api/state');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('agents');
    expect(res.body).toHaveProperty('currentSceneSeverity');
    expect(res.body).toHaveProperty('portfolioSummary');
    expect(Object.keys(res.body.agents).length).toBe(5);
  });

  it('GET /api/portfolio should return balance and positions', async () => {
    const res = await request(app).get('/api/portfolio');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('balance');
    expect(res.body).toHaveProperty('positions');
  });

  it('POST /api/portfolio/order should validate body with zod', async () => {
    const invalidRes = await request(app).post('/api/portfolio/order').send({ symbol: 'B' });
    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error).toBe('Validation failed');

    const validRes = await request(app).post('/api/portfolio/order').send({
      symbol: 'BTC/USDT',
      side: 'BUY',
      amountUsd: 25.0,
      orderType: 'MARKET',
    });
    expect(validRes.status).toBe(200);
    expect(validRes.body.success).toBe(true);
  });

  it('POST /api/feedback should record feedback and return stats', async () => {
    const res = await request(app).post('/api/feedback').send({
      targetId: 'sig_test_1',
      emoji: FeedbackEmoji.ACCURATE,
      userNotes: 'Harika sinyal',
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Feedback recorded successfully');
    expect(res.body.feedback.emoji).toBe(FeedbackEmoji.ACCURATE);
  });

  it('GET /api/news/keywords should return keywords structure', async () => {
    const res = await request(app).get('/api/news/keywords');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('defcon_1');
  });
});
