import { DecisionEngine } from '../src/services/decision/DecisionEngine.js';
import { BinanceService } from '../src/services/binance/BinanceService.js';
import { CorrelationTracker } from '../src/services/correlation/CorrelationTracker.js';
import { FeedbackSystem } from '../src/services/feedback/FeedbackSystem.js';

describe('DecisionEngine (Dynamic Leverage Mapping & Constraints)', () => {
  let engine: DecisionEngine;
  let binance: BinanceService;
  let corr: CorrelationTracker;
  let fb: FeedbackSystem;

  beforeEach(() => {
    binance = new BinanceService();
    corr = new CorrelationTracker(binance, 'test_lev_corr.json');
    fb = new FeedbackSystem('test_lev_fb.json');
    engine = new DecisionEngine(binance, corr, fb);
  });

  afterEach(() => {
    corr.stop();
  });

  test('should map confidence scores below 65 to 1x leverage (HOLD)', () => {
    expect(engine.calculateDynamicLeverage(50)).toBe(1);
    expect(engine.calculateDynamicLeverage(64)).toBe(1);
  });

  test('should map 65-74 confidence score to 2x leverage', () => {
    expect(engine.calculateDynamicLeverage(65)).toBe(2);
    expect(engine.calculateDynamicLeverage(70)).toBe(2);
    expect(engine.calculateDynamicLeverage(74)).toBe(2);
  });

  test('should map 75-84 confidence score to 4x leverage', () => {
    expect(engine.calculateDynamicLeverage(75)).toBe(4);
    expect(engine.calculateDynamicLeverage(80)).toBe(4);
  });

  test('should map 85-94 confidence score to 7x leverage', () => {
    expect(engine.calculateDynamicLeverage(85)).toBe(7);
    expect(engine.calculateDynamicLeverage(90)).toBe(7);
  });

  test('should map 95+ confidence score to 10x leverage (capped at MAX_LEVERAGE_ALLOWED)', () => {
    expect(engine.calculateDynamicLeverage(95)).toBe(10);
    expect(engine.calculateDynamicLeverage(100)).toBe(10);
  });
});
