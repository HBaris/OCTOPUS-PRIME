import fs from 'fs';
import path from 'path';
import { CorrelationTracker } from '../src/services/correlation/CorrelationTracker.js';
import { BinanceService } from '../src/services/binance/BinanceService.js';
import { EventType } from '../src/config/constants.js';
import { eventBus } from '../src/events/EventBus.js';

describe('CorrelationTracker', () => {
  const testFile = path.join(__dirname, 'test_correlations.json');
  let binanceService: BinanceService;
  let tracker: CorrelationTracker;

  beforeEach(() => {
    binanceService = new BinanceService();
    tracker = new CorrelationTracker(binanceService, testFile);
  });

  afterEach(() => {
    tracker.stop();
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  it('should track new events with initial price and checkTime', async () => {
    const eventId = await tracker.trackEvent('fed_raises_rates', 'BTC/USDT', -1, 15);
    const events = tracker.getTrackedEvents();

    expect(events.length).toBe(1);
    expect(events[0].id).toBe(eventId);
    expect(events[0].initialPrice).toBeGreaterThan(0);
    expect(events[0].evaluated).toBe(false);
  });

  it('should evaluate event and update EMA accuracy and emit RISK_CONFIDENCE_UPDATE', async () => {
    let capturedRiskEvent: any = null;
    eventBus.once(EventType.RISK_CONFIDENCE_UPDATE, (evt) => {
      capturedRiskEvent = evt;
    });

    await tracker.trackEvent('crypto_crash', 'BTC/USDT', -1, 0); // 0 minute delay for test
    await tracker.checkPendingEvents();

    const events = tracker.getTrackedEvents();
    expect(events[0].evaluated).toBe(true);
    expect(events[0].actualPrice).toBeGreaterThan(0);
    expect(tracker.getEmaAccuracy()).toBeGreaterThanOrEqual(0.0);
    expect(capturedRiskEvent).not.toBeNull();
    expect(capturedRiskEvent.payload).toHaveProperty('confidenceScore');
    expect(capturedRiskEvent.payload).toHaveProperty('analystComment');
  });
});
