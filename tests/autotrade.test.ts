import { AutoTradeEngine } from '../src/services/decision/AutoTradeEngine.js';
import { AltcoinScannerService } from '../src/services/market/AltcoinScannerService.js';
import { DecisionEngine } from '../src/services/decision/DecisionEngine.js';
import { BinanceService } from '../src/services/binance/BinanceService.js';
import { CorrelationTracker } from '../src/services/correlation/CorrelationTracker.js';
import { FeedbackSystem } from '../src/services/feedback/FeedbackSystem.js';
import { CircuitBreaker } from '../src/services/risk/CircuitBreaker.js';
import { EventType } from '../src/config/constants.js';
import { eventBus } from '../src/events/EventBus.js';

describe('AutoTradeEngine & AltcoinScanner (Autonomous Micro-Scalping)', () => {
  let binance: BinanceService;
  let circuitBreaker: CircuitBreaker;
  let autoTrade: AutoTradeEngine;
  let decision: DecisionEngine;
  let scanner: AltcoinScannerService;

  beforeEach(() => {
    binance = new BinanceService();
    circuitBreaker = new CircuitBreaker(3, 30);
    autoTrade = new AutoTradeEngine(binance, circuitBreaker, {
      autoTradingEnabled: true,
      targetProfitUsd: 0.30,
      stopLossUsd: 0.60,
      marginPerTradeUsd: 15.0,
      maxConcurrentPositions: 4,
    });

    const corr = new CorrelationTracker(binance);
    const fb = new FeedbackSystem();
    decision = new DecisionEngine(binance, corr, fb);
    scanner = new AltcoinScannerService(binance, decision, ['DOGE/USDT', 'PEPE/USDT']);
  });

  afterEach(() => {
    autoTrade.stop();
    scanner.stop();
  });

  it('should auto-execute trade proposals without manual user approval when enabled', async () => {
    let capturedAction: any = null;
    eventBus.once(EventType.AGENT_ACTION, (evt) => {
      capturedAction = evt;
    });

    const result = await autoTrade.handleAutonomousTradeProposal({
      proposalId: 'prop_test_1',
      signalId: 'sig_test_1',
      symbol: 'DOGE/USDT',
      side: 'BUY',
      estimatedAmountUsd: 15.0,
      suggestedLeverage: 5,
      suggestedMarginMode: 'isolated',
      signalScore: 85,
      status: 'SIMULATED',
      isDryRun: true,
      notes: 'Test Auto-Trade',
    });

    expect(result).toBe(true);
    expect(autoTrade.getStats().totalAutoTrades).toBe(1);
    expect(capturedAction).not.toBeNull();
    expect(capturedAction.payload.details).toContain('OTOMATİK İCRA');
  });

  it('should auto-close position when target micro-profit (>= $0.30) is reached', async () => {
    // Open a test position on Binance service
    await binance.executeOrder('PEPE/USDT', 'BUY', 15.0);

    // Mock an in-profit position
    const positions = await binance.fetchPositions();
    const pepePos = positions.find((p) => p.symbol.includes('PEPE'));
    if (pepePos) {
      pepePos.unrealizedPnl = 0.35; // +35 cents profit!
    }

    let profitAction: any = null;
    eventBus.on(EventType.AGENT_ACTION, (evt) => {
      if (evt.payload.actionName === 'Kâr Realize Edildi') {
        profitAction = evt;
      }
    });

    await autoTrade.monitorAndHarvestMicroProfits();

    expect(autoTrade.getStats().profitableExits).toBeGreaterThanOrEqual(1);
    expect(profitAction).not.toBeNull();
    expect(profitAction.payload.details).toContain('PASİF GELİR');
  });

  it('should scan altcoins and detect micro-scalping opportunities', async () => {
    const opp = await scanner.analyzeAltcoinOpportunity('DOGE/USDT');
    expect(opp).not.toBeNull();
    expect(opp?.symbol).toBe('DOGE/USDT');
    expect(opp?.rsi14).toBeDefined();
    expect(opp?.emaCross).toBeDefined();
  });

  it('should allow toggling auto-trading mode dynamically', () => {
    expect(autoTrade.isEnabled()).toBe(true);
    autoTrade.setEnabled(false);
    expect(autoTrade.isEnabled()).toBe(false);
    autoTrade.setEnabled(true);
    expect(autoTrade.isEnabled()).toBe(true);
  });
});
