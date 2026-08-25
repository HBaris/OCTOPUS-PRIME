import { BinanceService } from '../src/services/binance/BinanceService.js';
import { EventType } from '../src/config/constants.js';
import { eventBus } from '../src/events/EventBus.js';

describe('BinanceService', () => {
  let binance: BinanceService;

  beforeEach(() => {
    binance = new BinanceService();
  });

  it('should return simulated balance when no keys are present', async () => {
    const balance = await binance.getBalance();
    expect(balance.totalUsd).toBeGreaterThanOrEqual(1000);
    expect(balance.freeUsdt).toBeGreaterThanOrEqual(1000);
    expect(balance.assets).toHaveProperty('USDT');
  });

  it('should execute simulated orders and update positions in dry-run mode', async () => {
    let capturedOrderEvent: any = null;
    eventBus.once(EventType.ORDER_SIMULATED, (evt) => {
      capturedOrderEvent = evt;
    });

    const result = await binance.executeOrder('BTC/USDT', 'BUY', 50.0);
    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.orderId).toBeDefined();

    expect(capturedOrderEvent).not.toBeNull();
    expect(capturedOrderEvent.payload.totalUsd).toBe(50.0);

    const positions = await binance.getPositions();
    expect(positions.length).toBeGreaterThan(0);
    expect(positions[0].symbol).toBe('BTC/USDT');
  });

  it('should block orders exceeding MAX_POSITION_SIZE_USD and emit SPENDING_LIMIT_WARNING', async () => {
    let capturedLimitWarning: any = null;
    eventBus.once(EventType.SPENDING_LIMIT_WARNING, (evt) => {
      capturedLimitWarning = evt;
    });

    // Attempt $50,000 order when limit is $100
    const result = await binance.executeOrder('BTC/USDT', 'BUY', 50000.0);

    expect(result.success).toBe(false);
    expect(result.message).toContain('exceeds maximum allowed position limit');
    expect(capturedLimitWarning).not.toBeNull();
    expect(capturedLimitWarning.payload.attemptedSizeUsd).toBe(50000.0);
    expect(capturedLimitWarning.payload.actionBlocked).toBe(true);
  });

  it('should store attribution metadata and SL/TP on simulated positions', async () => {
    const metadata = {
      signalId: 'sig_test_123',
      sourceCategory: 'crypto_specific',
      stopLoss: 67000,
      takeProfit: 71500,
    };

    const result = await binance.executeOrder('ETH/USDT', 'BUY', 40.0, 'MARKET', metadata);
    expect(result.success).toBe(true);

    const positions = await binance.getPositions();
    const ethPos = positions.find((p) => p.symbol === 'ETH/USDT');

    expect(ethPos).toBeDefined();
    expect(ethPos?.signalId).toBe('sig_test_123');
    expect(ethPos?.sourceCategory).toBe('crypto_specific');
    expect(ethPos?.stopLoss).toBe(67000);
    expect(ethPos?.takeProfit).toBe(71500);
  });
});
