import { CircuitBreaker } from '../src/services/risk/CircuitBreaker.js';
import { EventType } from '../src/config/constants.js';
import { eventBus } from '../src/events/EventBus.js';

describe('CircuitBreaker (Cooldown & Post-Mortem Analysis)', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker(3, 30); // 3 consecutive losses, 30 minutes
  });

  afterEach(() => {
    breaker.stop();
    breaker.resumeTrading('Test cleanup');
  });

  test('should not halt trading on 1 or 2 losses', () => {
    const halt1 = breaker.recordTradeOutcome('BTC/USDT', -20, 80, ['chart']);
    expect(halt1).toBe(false);
    expect(breaker.getState().isHalted).toBe(false);

    const halt2 = breaker.recordTradeOutcome('ETH/USDT', -15, 75, ['news']);
    expect(halt2).toBe(false);
    expect(breaker.getState().isHalted).toBe(false);
  });

  test('should halt trading and emit TRADING_HALTED on 3rd consecutive loss', () => {
    let capturedHaltEvent: any = null;
    let capturedReportEvent: any = null;

    eventBus.once(EventType.TRADING_HALTED, (evt) => {
      capturedHaltEvent = evt;
    });
    eventBus.once(EventType.COOLDOWN_REPORT_READY, (evt) => {
      capturedReportEvent = evt;
    });

    breaker.recordTradeOutcome('BTC/USDT', -25, 80, ['chart', 'social'], ['rule_bull_ema_news']);
    breaker.recordTradeOutcome('SOL/USDT', -30, 85, ['social'], ['rule_bull_ema_news']);
    const halted = breaker.recordTradeOutcome('ETH/USDT', -20, 70, ['news', 'social'], []);

    expect(halted).toBe(true);
    expect(breaker.getState().isHalted).toBe(true);
    expect(breaker.getState().remainingSeconds).toBeGreaterThan(0);

    expect(capturedHaltEvent).not.toBeNull();
    expect(capturedHaltEvent.payload.durationMinutes).toBe(30);

    expect(capturedReportEvent).not.toBeNull();
    expect(capturedReportEvent.payload.misleadingChannels).toContain('social');
    expect(capturedReportEvent.payload.failedRules).toContain('rule_bull_ema_news');
  });

  test('should answer assistant post-mortem questions accurately', () => {
    breaker.recordTradeOutcome('BTC/USDT', -10, 80, ['social']);
    breaker.recordTradeOutcome('BTC/USDT', -15, 75, ['social']);
    breaker.recordTradeOutcome('BTC/USDT', -20, 70, ['social']);

    const answer = breaker.answerAssistantQuestion('Sorun neydi, ne öğrendiniz?');
    expect(answer).toContain('Post-Mortem');
    expect(answer).toContain('Teşhis');
    expect(answer).toContain('Çıkarılan Dersler');
  });

  test('should reset consecutive loss counter upon a profitable trade', () => {
    breaker.recordTradeOutcome('BTC/USDT', -10, 80);
    breaker.recordTradeOutcome('BTC/USDT', -15, 75);
    expect(breaker.getState().consecutiveLosses).toBe(2);

    // Winning trade
    breaker.recordTradeOutcome('BTC/USDT', 45, 90);
    expect(breaker.getState().consecutiveLosses).toBe(0);
    expect(breaker.getState().isHalted).toBe(false);
  });
});
