import { AltcoinScannerService } from '../src/services/market/AltcoinScannerService.js';
import { DecisionEngine } from '../src/services/decision/DecisionEngine.js';
import { IExchangeService } from '../src/services/exchange/IExchangeService.js';

describe('AltcoinScannerService (Oda 1 - Dinamik Piyasa Tarayıcısı)', () => {
  let scanner: AltcoinScannerService;
  let mockExchange: IExchangeService;
  let mockDecisionEngine: any;

  beforeEach(() => {
    mockExchange = {
      fetchBalance: jest.fn(),
      fetchPositions: jest.fn(),
      executeOrder: jest.fn(),
      fetchCandles: jest.fn().mockResolvedValue([]),
      fetchTicker: jest.fn().mockResolvedValue({ symbol: 'SOL/USDT', lastPrice: 150, volume: 25000000 }),
      setLeverage: jest.fn(),
      calculateLiquidationPrice: jest.fn(),
      fetchFundingRate: jest.fn(),
      getMaxLeverage: jest.fn(),
      getIsSimulation: jest.fn().mockReturnValue(true),
      closePosition: jest.fn(),
    };

    mockDecisionEngine = {
      evaluateMultiChannelSignal: jest.fn().mockResolvedValue(undefined),
    };

    scanner = new AltcoinScannerService(mockExchange, mockDecisionEngine as any, [
      'SOL/USDT', 'NEAR/USDT', 'SUI/USDT', 'PEPE/USDT'
    ]);
  });

  afterEach(() => {
    scanner.stop();
  });

  it('should scan batch and populate radar list with momentum scores', async () => {
    await scanner.scanNextAltcoinBatch();
    const radar = scanner.getRadarList();

    expect(Array.isArray(radar)).toBe(true);
    expect(radar.length).toBeGreaterThan(0);

    const first = radar[0];
    expect(first).toHaveProperty('symbol');
    expect(first).toHaveProperty('lastPrice');
    expect(first).toHaveProperty('rsi14');
    expect(first).toHaveProperty('emaCross');
    expect(first).toHaveProperty('momentumScore');
    expect(first).toHaveProperty('suggestedAction');
  });
});
