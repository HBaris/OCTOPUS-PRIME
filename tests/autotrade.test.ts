import { AutoTradeEngine } from '../src/services/decision/AutoTradeEngine.js';
import { AltcoinScannerService } from '../src/services/market/AltcoinScannerService.js';
import { DecisionEngine } from '../src/services/decision/DecisionEngine.js';
import { BinanceService } from '../src/services/binance/BinanceService.js';
import { CorrelationTracker } from '../src/services/correlation/CorrelationTracker.js';
import { FeedbackSystem } from '../src/services/feedback/FeedbackSystem.js';
import { CircuitBreaker } from '../src/services/risk/CircuitBreaker.js';
import { EventType } from '../src/config/constants.js';
import { eventBus } from '../src/events/EventBus.js';

describe('AutoTradeEngine & AltcoinScanner (Intelligent Dynamic Scalper)', () => {
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
      targetProfitPercent: 1.0,
      trailingStopPercent: 0.3,
      stopLossPercent: 1.5,
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

    await autoTrade.executeProposalAutonomous({
      proposalId: 'prop_test_1',
      signalId: 'sig_test_1',
      symbol: 'DOGE/USDT',
      side: 'BUY',
      estimatedAmountUsd: 15.0,
      suggestedLeverage: 5,
      suggestedMarginMode: 'isolated',
      signalScore: 85,
      status: 'PENDING_APPROVAL',
      isDryRun: true,
      notes: 'Autonomous test proposal',
    });

    expect(autoTrade.getStats().totalAutoTrades).toBe(1);
    expect(capturedAction).not.toBeNull();
    expect(capturedAction.payload.actionName).toContain('Scalp Emri Açıldı');
  });

  it('should auto-close position when dynamic take profit is reached', async () => {
    // Open a test position on Binance service
    await binance.executeOrder({
      symbol: 'PEPE/USDT',
      side: 'BUY',
      amountUsd: 15.0,
      type: 'MARKET',
    });

    // Mock an in-profit position (+2% on $15 margin)
    const positions = await binance.fetchPositions();
    const pepePos = positions.find((p) => p.symbol.includes('PEPE'));
    if (pepePos) {
      pepePos.unrealizedPnl = 0.35; // +$0.35 profit
      pepePos.marginUsed = 15.0;
    }

    let profitAction: any = null;
    eventBus.on(EventType.AGENT_ACTION, (evt) => {
      if (evt.payload.actionName === 'Pozisyon Kapatıldı') {
        profitAction = evt;
      }
    });

    await autoTrade.monitorAndHarvestProfits();

    expect(autoTrade.getStats().profitableExits).toBeGreaterThanOrEqual(1);
    expect(profitAction).not.toBeNull();
  });

  it('should scan altcoins and detect opportunities', async () => {
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
