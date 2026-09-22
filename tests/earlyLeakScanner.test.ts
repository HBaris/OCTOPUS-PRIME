import { EarlyLeakScannerService } from '../src/services/intelligence/EarlyLeakScannerService.js';
import { LearningEngine } from '../src/services/learning/LearningEngine.js';
import { RuleStore } from '../src/services/learning/RuleStore.js';
import { IExchangeService } from '../src/services/exchange/IExchangeService.js';
import { RuleTier } from '../src/config/constants.js';

describe('EarlyLeakScannerService (Oda 3 - Öncü İstihbarat & Balina Tüyo Odası)', () => {
  let earlyLeakScanner: EarlyLeakScannerService;
  let learningEngine: LearningEngine;
  let ruleStore: RuleStore;
  let mockExchange: IExchangeService;

  beforeEach(() => {
    ruleStore = new RuleStore();
    learningEngine = new LearningEngine(ruleStore);

    mockExchange = {
      fetchBalance: jest.fn().mockResolvedValue({ totalBalanceUsdt: 10000, freeBalanceUsdt: 10000, usedMarginUsdt: 0 }),
      fetchPositions: jest.fn().mockResolvedValue([]),
      executeOrder: jest.fn().mockResolvedValue({ success: true, orderId: 'ord_test' }),
      fetchCandles: jest.fn().mockResolvedValue([]),
      fetchTicker: jest.fn().mockResolvedValue({ symbol: 'PEPE/USDT', lastPrice: 0.000010, volume: 50000000 }),
      setLeverage: jest.fn().mockResolvedValue(undefined),
      calculateLiquidationPrice: jest.fn().mockReturnValue(0.000008),
      fetchFundingRate: jest.fn().mockResolvedValue({ rate: 0.0001, nextFundingTime: new Date() }),
      getMaxLeverage: jest.fn().mockResolvedValue(20),
      getIsSimulation: jest.fn().mockReturnValue(true),
      closePosition: jest.fn().mockResolvedValue({ success: true }),
    };

    earlyLeakScanner = new EarlyLeakScannerService(learningEngine, mockExchange);
  });

  afterEach(() => {
    earlyLeakScanner.stop();
  });

  it('should scan and discover leaks from 5 primary sources', async () => {
    await earlyLeakScanner.scanAllSources();
    const leaks = earlyLeakScanner.getRecentLeaks();

    expect(Array.isArray(leaks)).toBe(true);
    expect(leaks.length).toBeGreaterThan(0);

    const first = leaks[0];
    expect(first).toHaveProperty('source');
    expect(first).toHaveProperty('headline');
    expect(first).toHaveProperty('symbol');
    expect(first).toHaveProperty('urgency');
    expect(first).toHaveProperty('initialPrice');
  });

  it('should evaluate outcome and record lessons in LearningEngine when price surges', async () => {
    // Inject a pending leak with older timestamp
    const now = Date.now();
    (earlyLeakScanner as any).leaks.unshift({
      id: 'leak_test_pump',
      source: 'CoinGecko',
      sourceUrl: 'https://coingecko.com',
      symbol: 'PEPE/USDT',
      headline: 'PEPE Trending #1',
      summary: 'Huge search explosion',
      leakType: 'TRENDING_SEARCH',
      urgency: 'HIGH',
      detectedAt: new Date(now - 10 * 60 * 1000).toISOString(),
      initialPrice: 0.0000090,
      observationOutcome: 'PENDING',
    });

    // Mock higher price (+11% surge)
    (mockExchange.fetchTicker as jest.Mock).mockResolvedValue({
      symbol: 'PEPE/USDT',
      lastPrice: 0.0000100,
    });

    await earlyLeakScanner.verifyPendingLeakOutcomes();

    const leak = earlyLeakScanner.getRecentLeaks().find((l) => l.id === 'leak_test_pump');
    expect(leak?.observationOutcome).toBe('SUCCESS');
    expect(leak?.priceChangePct15m).toBeGreaterThan(0.5);

    // Verify LearningEngine recorded this observation
    const rules = learningEngine.getAllRules();
    expect(rules.length).toBeGreaterThan(0);
    const rule = rules.find((r) => r.id === 'rule_coingecko_trending_search');
    expect(rule).toBeDefined();
    expect(rule?.successCount).toBeGreaterThanOrEqual(1);
    expect(rule?.successRate).toBeGreaterThan(0);
  });
});
