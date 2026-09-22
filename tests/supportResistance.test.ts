import { TechnicalAnalysisService } from '../src/services/analysis/TechnicalAnalysisService.js';
import { IExchangeService } from '../src/services/exchange/IExchangeService.js';

describe('TechnicalAnalysisService (Oda 4 - Teknik Analiz & Direnç/Destek Avcısı)', () => {
  let taService: TechnicalAnalysisService;
  let mockExchange: IExchangeService;

  beforeEach(() => {
    mockExchange = {
      fetchBalance: jest.fn(),
      fetchPositions: jest.fn(),
      executeOrder: jest.fn(),
      fetchCandles: jest.fn(),
      fetchTicker: jest.fn().mockResolvedValue({ symbol: 'SOL/USDT', lastPrice: 150, volume: 20000000 }),
      setLeverage: jest.fn(),
      calculateLiquidationPrice: jest.fn(),
      fetchFundingRate: jest.fn(),
      getMaxLeverage: jest.fn(),
      getIsSimulation: jest.fn().mockReturnValue(true),
      closePosition: jest.fn(),
    };

    taService = new TechnicalAnalysisService(mockExchange);
  });

  it('should calculate classic Pivot Points with R1-R3 and S1-S3 correctly', () => {
    const pivots = taService.calculatePivotPoints(110, 90, 100);

    // Pivot = (110 + 90 + 100) / 3 = 100
    expect(pivots.pivot).toBe(100);
    // R1 = 2 * 100 - 90 = 110
    expect(pivots.r1).toBe(110);
    // S1 = 2 * 100 - 110 = 90
    expect(pivots.s1).toBe(90);
    // R2 = 100 + (110 - 90) = 120
    expect(pivots.r2).toBe(120);
    // S2 = 100 - (110 - 90) = 80
    expect(pivots.s2).toBe(80);
  });

  it('should calculate Bollinger Bands (upper, middle, lower, bandwidth, %B)', () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + Math.sin(i) * 5);
    const bb = taService.calculateBollingerBands(closes, 20, 2);

    expect(bb.upper).toBeGreaterThan(bb.middle);
    expect(bb.middle).toBeGreaterThan(bb.lower);
    expect(bb.bandwidth).toBeGreaterThan(0);
  });

  it('should perform comprehensive S/R analysis and detect breakout signals', async () => {
    const mockCandles = Array.from({ length: 50 }, (_, i) => ({
      time: 1000 + i * 900,
      open: 100 + i * 0.5,
      high: 102 + i * 0.5,
      low: 99 + i * 0.5,
      close: 101 + i * 0.5,
      volume: i === 49 ? 5000 : 1000, // Volume surge on last candle
    }));

    (mockExchange.fetchCandles as jest.Mock).mockResolvedValue(mockCandles);

    const result = await taService.analyzeSupportResistance('SOL/USDT', '15m');

    expect(result).toBeDefined();
    expect(result?.symbol).toBe('SOL/USDT');
    expect(result?.pivots).toBeDefined();
    expect(result?.bollinger).toBeDefined();
    expect(result?.nearestSupport).toBeDefined();
    expect(result?.nearestResistance).toBeDefined();
    expect(result?.volumeBreakoutDetected).toBe(true);
  });
});
