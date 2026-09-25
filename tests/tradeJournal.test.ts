import path from 'path';
import fs from 'fs';
import { TradeJournalService } from '../src/services/learning/TradeJournalService.js';
import { LearningEngine } from '../src/services/learning/LearningEngine.js';
import { RuleStore } from '../src/services/learning/RuleStore.js';
import express from 'express';
import request from 'supertest';
import { createLearningRouter } from '../src/server/routes/learning.route.js';

describe('TradeJournalService & Knowledge Distillation System', () => {
  const testDir = path.join(__dirname, 'test_journal_data');
  const rawHistoryFile = path.join(testDir, 'test_trade_history.json');
  const distilledFile = path.join(testDir, 'test_distilled_lessons.json');
  const rulesFile = path.join(testDir, 'test_rules.json');

  let journalService: TradeJournalService;
  let learningEngine: LearningEngine;

  beforeEach(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    if (fs.existsSync(rawHistoryFile)) fs.unlinkSync(rawHistoryFile);
    if (fs.existsSync(distilledFile)) fs.unlinkSync(distilledFile);
    if (fs.existsSync(rulesFile)) fs.unlinkSync(rulesFile);

    learningEngine = new LearningEngine(new RuleStore(rulesFile));
    journalService = new TradeJournalService({
      rawHistoryPath: rawHistoryFile,
      distilledPath: distilledFile,
      learningEngine,
    });
  });

  afterEach(() => {
    if (fs.existsSync(rawHistoryFile)) fs.unlinkSync(rawHistoryFile);
    if (fs.existsSync(distilledFile)) fs.unlinkSync(distilledFile);
    if (fs.existsSync(rulesFile)) fs.unlinkSync(rulesFile);
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {}
    }
  });

  test('should record trade entry and persist to raw history file', () => {
    const entry = journalService.recordTradeEntry({
      id: 'trade_btc_1',
      symbol: 'BTC/USDT',
      side: 'LONG',
      entryPrice: 65000,
      amount: 0.1,
      leverage: 5,
      marginUsed: 1300,
      status: 'OPEN',
      entryTime: new Date().toISOString(),
    });

    expect(entry.id).toBe('trade_btc_1');
    expect(entry.status).toBe('OPEN');

    // Verify on disk
    expect(fs.existsSync(rawHistoryFile)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(rawHistoryFile, 'utf-8'));
    expect(saved.length).toBe(1);
    expect(saved[0].symbol).toBe('BTC/USDT');
  });

  test('should record trade exit, synthesize reflection lesson and trigger knowledge distillation', () => {
    journalService.recordTradeEntry({
      id: 'trade_sol_1',
      symbol: 'SOL/USDT',
      side: 'LONG',
      entryPrice: 150,
      amount: 2,
      leverage: 5,
      marginUsed: 60,
      status: 'OPEN',
      entryTime: new Date(Date.now() - 120000).toISOString(),
    });

    const exit = journalService.recordTradeExit({
      symbol: 'SOL/USDT',
      exitPrice: 153,
      pnlUsd: 6.0,
      exitReason: 'Trailing Stop Kâr Hasadı (%2.0)',
      orderId: 'trade_sol_1',
    });

    expect(exit).not.toBeNull();
    expect(exit?.status).toBe('CLOSED');
    expect(exit?.pnlUsd).toBe(6.0);
    expect(exit?.exitPrice).toBe(153);
    expect(exit?.lessonLearned).toBeDefined();
    expect(exit?.lessonLearned).toContain('hasadı');

    // Check distilled knowledge updated
    const distilled = journalService.getDistilledKnowledge();
    expect(distilled.performanceSummary.totalTrades).toBe(1);
    expect(distilled.performanceSummary.winningTrades).toBe(1);
    expect(distilled.performanceSummary.winRatePercent).toBe(100);
    expect(distilled.performanceSummary.netPnlUsd).toBe(6.0);
    expect(distilled.coinPerformance['SOL/USDT']).toBeDefined();
    expect(distilled.coinPerformance['SOL/USDT'].winRate).toBe(100);

    // Verify distilled knowledge was written to disk
    expect(fs.existsSync(distilledFile)).toBe(true);
  });

  test('should compute multiple trade statistics, profit factor and coin performance matrix', () => {
    // 3 wins on BTC
    for (let i = 1; i <= 3; i++) {
      journalService.recordTradeEntry({
        id: `btc_${i}`,
        symbol: 'BTC/USDT',
        side: 'LONG',
        entryPrice: 60000,
        amount: 0.05,
        leverage: 5,
        marginUsed: 600,
        status: 'OPEN',
        entryTime: new Date().toISOString(),
      });
      journalService.recordTradeExit({
        symbol: 'BTC/USDT',
        exitPrice: 60600,
        pnlUsd: 15.0,
        orderId: `btc_${i}`,
        exitReason: 'Dinamik Kâr Hedefi Ulaşıldı',
      });
    }

    // 1 loss on ETH
    journalService.recordTradeEntry({
      id: 'eth_loss_1',
      symbol: 'ETH/USDT',
      side: 'LONG',
      entryPrice: 3000,
      amount: 1,
      leverage: 5,
      marginUsed: 600,
      status: 'OPEN',
      entryTime: new Date().toISOString(),
    });
    journalService.recordTradeExit({
      symbol: 'ETH/USDT',
      exitPrice: 2970,
      pnlUsd: -10.0,
      orderId: 'eth_loss_1',
      exitReason: 'Dinamik Stop-Loss Tetiklendi',
    });

    const perf = journalService.getPerformanceSummary();
    expect(perf.totalTrades).toBe(4);
    expect(perf.winningTrades).toBe(3);
    expect(perf.losingTrades).toBe(1);
    expect(perf.winRatePercent).toBe(75);
    expect(perf.totalProfitHarvestedUsd).toBe(45);
    expect(perf.totalLossUsd).toBe(10);
    expect(perf.netPnlUsd).toBe(35);
    expect(perf.profitFactor).toBe(4.5);

    const distilled = journalService.getDistilledKnowledge();
    expect(distilled.coinPerformance['BTC/USDT'].totalTrades).toBe(3);
    expect(distilled.coinPerformance['BTC/USDT'].winRate).toBe(100);
    expect(distilled.coinPerformance['ETH/USDT'].totalTrades).toBe(1);
    expect(distilled.coinPerformance['ETH/USDT'].winRate).toBe(0);
  });

  test('GET /api/learning/journal should return performance summary, distilled lessons and recent trades', async () => {
    // Record sample trade
    journalService.recordTradeEntry({
      id: 'test_api_trade',
      symbol: 'NEAR/USDT',
      side: 'LONG',
      entryPrice: 5.0,
      amount: 10,
      leverage: 5,
      marginUsed: 10,
      status: 'OPEN',
      entryTime: new Date().toISOString(),
    });
    journalService.recordTradeExit({
      symbol: 'NEAR/USDT',
      exitPrice: 5.2,
      pnlUsd: 2.0,
      orderId: 'test_api_trade',
      exitReason: 'TP Hit',
    });

    const app = express();
    app.use(express.json());
    app.use('/api/learning', createLearningRouter(learningEngine, journalService));

    const res = await request(app).get('/api/learning/journal');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.performanceSummary).toBeDefined();
    expect(res.body.performanceSummary.totalTrades).toBe(1);
    expect(res.body.distilledLessons).toBeInstanceOf(Array);
    expect(res.body.distilledLessons.length).toBeGreaterThan(0);
    expect(res.body.recentTrades).toBeInstanceOf(Array);
    expect(res.body.recentTrades[0].symbol).toBe('NEAR/USDT');
  });
});
