import { AutoTradeEngine } from '../src/services/decision/AutoTradeEngine.js';
import { CircuitBreaker } from '../src/services/risk/CircuitBreaker.js';
import { IExchangeService } from '../src/services/exchange/IExchangeService.js';
import { Position } from '../src/types/market.js';

describe('AutoTradeEngine (Oda 2 - Dinamik Scalping & Doğal Dil Komutları)', () => {
  let autoTradeEngine: AutoTradeEngine;
  let circuitBreaker: CircuitBreaker;
  let mockExchange: IExchangeService;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(3, 10);
    mockExchange = {
      fetchBalance: jest.fn().mockResolvedValue({ totalBalanceUsdt: 10000, freeBalanceUsdt: 10000, usedMarginUsdt: 0 }),
      fetchPositions: jest.fn().mockResolvedValue([]),
      executeOrder: jest.fn().mockResolvedValue({ success: true, orderId: 'ord_123', price: 100 }),
      fetchCandles: jest.fn().mockResolvedValue([]),
      fetchTicker: jest.fn().mockResolvedValue({ symbol: 'SOL/USDT', lastPrice: 100 }),
      setLeverage: jest.fn().mockResolvedValue(undefined),
      calculateLiquidationPrice: jest.fn().mockReturnValue(80),
      fetchFundingRate: jest.fn().mockResolvedValue({ rate: 0.0001, nextFundingTime: new Date() }),
      getMaxLeverage: jest.fn().mockResolvedValue(20),
      getIsSimulation: jest.fn().mockReturnValue(true),
      closePosition: jest.fn().mockResolvedValue({ success: true }),
    };

    autoTradeEngine = new AutoTradeEngine(mockExchange, circuitBreaker, {
      autoTradingEnabled: true,
      targetProfitPercent: 1.0,
      trailingStopPercent: 0.3,
      stopLossPercent: 1.5,
      marginPerTradeUsd: 20,
    });
  });

  afterEach(() => {
    autoTradeEngine.stop();
  });

  it('should process natural language command "çek" and close all open positions', async () => {
    const mockPositions: Position[] = [
      { symbol: 'SOL/USDT', side: 'LONG', amount: 1, entryPrice: 100, markPrice: 100.8, unrealizedPnl: 0.8, percentagePnl: 4.0, leverage: 5, marginUsed: 20 },
      { symbol: 'NEAR/USDT', side: 'LONG', amount: 4, entryPrice: 5, markPrice: 5.1, unrealizedPnl: 0.4, percentagePnl: 2.0, leverage: 5, marginUsed: 20 },
    ];
    (mockExchange.fetchPositions as jest.Mock).mockResolvedValue(mockPositions);

    const result = await autoTradeEngine.processNaturalLanguageCommand('çek');

    expect(result.success).toBe(true);
    expect(result.actionTaken).toBe('EMERGENCY_CLOSE_ALL');
    expect(result.message).toContain('Baş Scalper tüm açık pozisyonları derhal kapattı');
    expect(mockExchange.closePosition).toHaveBeenCalledTimes(2);
  });

  it('should process natural language command "hedef %2.5" and update target profit', async () => {
    const result = await autoTradeEngine.processNaturalLanguageCommand('hedef %2.5');

    expect(result.success).toBe(true);
    expect(result.actionTaken).toBe('SET_TP');
    expect(autoTradeEngine.getStats().targetProfitPercent).toBe(2.5);
  });

  it('should trigger dynamic trailing stop exit when profit reaches target and drops by trailing margin', async () => {
    const pos: Position = {
      symbol: 'SOL/USDT',
      side: 'LONG',
      amount: 1,
      entryPrice: 100,
      markPrice: 101.2,
      unrealizedPnl: 0.24, // 1.2% profit on $20 margin (above 1.0% target, but below 1.5x instant exit)
      percentagePnl: 1.2,
      leverage: 5,
      marginUsed: 20,
    };
    (mockExchange.fetchPositions as jest.Mock).mockResolvedValue([pos]);

    // 1st tick: price peaks at +1.2% (trailing stop activates)
    await autoTradeEngine.monitorAndHarvestProfits();
    expect(mockExchange.closePosition).not.toHaveBeenCalled();

    // 2nd tick: profit pulls back from 1.2% to 0.8% (drop 0.4% > 0.3% trailing stop threshold)
    pos.unrealizedPnl = 0.16; // 0.8% profit on $20 margin
    pos.markPrice = 100.8;
    await autoTradeEngine.monitorAndHarvestProfits();

    expect(mockExchange.closePosition).toHaveBeenCalledWith('SOL/USDT', 'LONG');
    expect(autoTradeEngine.getStats().profitableExits).toBe(1);
  });
});
