import { DecisionEngine } from '../src/services/decision/DecisionEngine.js';
import { BinanceService } from '../src/services/binance/BinanceService.js';
import { CorrelationTracker } from '../src/services/correlation/CorrelationTracker.js';
import { FeedbackSystem } from '../src/services/feedback/FeedbackSystem.js';
import { LearningEngine } from '../src/services/learning/LearningEngine.js';
import { CircuitBreaker } from '../src/services/risk/CircuitBreaker.js';
import { SocialSignal, TechnicalIndicatorSignal } from '../src/types/market.js';

describe('Multi-Channel Constraints & Social Signal Filtering', () => {
  let engine: DecisionEngine;
  let binance: BinanceService;
  let corr: CorrelationTracker;
  let fb: FeedbackSystem;
  let learning: LearningEngine;
  let breaker: CircuitBreaker;

  beforeEach(() => {
    binance = new BinanceService();
    corr = new CorrelationTracker(binance, 'test_soc_corr.json');
    fb = new FeedbackSystem('test_soc_fb.json');
    learning = new LearningEngine();
    breaker = new CircuitBreaker(3, 30);
    engine = new DecisionEngine(binance, corr, fb, learning, breaker);
  });

  afterEach(() => {
    corr.stop();
  });

  test('should REJECT social signal alone without technical or news corroboration', async () => {
    const socialSignal: SocialSignal = {
      id: 'tg_1',
      source: 'telegram',
      channelOrUser: 'CryptoWhaleVIP',
      coin: 'BTC',
      sentiment: 'POSITIVE',
      rawContent: 'BTC PUMP TO THE MOON 100X',
      confidenceScore: 75,
      timestamp: new Date().toISOString(),
    };

    const signal = await engine.evaluateMultiChannelSignal({
      symbol: 'BTC/USDT',
      socialSignal,
    });

    // Social signal alone must NOT open trades (returns null / hold)
    expect(signal).toBeNull();
  });

  test('should ACCEPT and execute BUY when social signal is corroborated by bullish technical indicators', async () => {
    const socialSignal: SocialSignal = {
      id: 'tg_2',
      source: 'telegram',
      channelOrUser: 'CryptoWhaleVIP',
      coin: 'BTC',
      sentiment: 'POSITIVE',
      rawContent: 'BTC Breakout',
      confidenceScore: 60,
      timestamp: new Date().toISOString(),
    };

    const technicalSignal: TechnicalIndicatorSignal = {
      symbol: 'BTC/USDT',
      timeframe: '15m',
      lastPrice: 68500,
      ema9: 68600,
      ema21: 68300,
      emaCross: 'BULLISH',
      rsi14: 55,
      rsiCondition: 'NEUTRAL',
      volumeSpikeRatio: 2.2,
      volumeSpikeDetected: true,
      bidAskImbalance: 0.4,
      suggestedAction: 'BUY',
      confidenceScore: 85,
      timestamp: new Date().toISOString(),
    };

    const signal = await engine.evaluateMultiChannelSignal({
      symbol: 'BTC/USDT',
      socialSignal,
      technicalSignal,
    });

    expect(signal).not.toBeNull();
    expect(signal?.action).toBe('BUY');
    expect(signal?.signalScore).toBeGreaterThanOrEqual(70);
  });

  test('should BLOCK all signals when CircuitBreaker is HALTED', async () => {
    breaker.recordTradeOutcome('BTC/USDT', -20);
    breaker.recordTradeOutcome('BTC/USDT', -20);
    breaker.recordTradeOutcome('BTC/USDT', -20); // 3 losses -> halted

    expect(breaker.getState().isHalted).toBe(true);

    const technicalSignal: TechnicalIndicatorSignal = {
      symbol: 'BTC/USDT',
      timeframe: '15m',
      lastPrice: 68500,
      ema9: 68600,
      ema21: 68300,
      emaCross: 'BULLISH',
      rsi14: 55,
      rsiCondition: 'NEUTRAL',
      volumeSpikeRatio: 2.2,
      volumeSpikeDetected: true,
      bidAskImbalance: 0.4,
      suggestedAction: 'BUY',
      confidenceScore: 95,
      timestamp: new Date().toISOString(),
    };

    const signal = await engine.evaluateMultiChannelSignal({
      symbol: 'BTC/USDT',
      technicalSignal,
    });

    expect(signal).toBeNull();
  });
});
