import { BinanceService } from '../src/services/binance/BinanceService.js';
import { OkxService } from '../src/services/okx/OkxService.js';
import { getExchangeService } from '../src/services/exchange/ExchangeFactory.js';
import { IExchangeService } from '../src/services/exchange/IExchangeService.js';

describe('Exchange Abstraction Layer & Leverage Risk Architecture', () => {
  let binance: IExchangeService;
  let okx: IExchangeService;

  beforeAll(() => {
    binance = new BinanceService();
    okx = new OkxService();
  });

  afterAll(() => {
    if (binance.stopPricePoller) binance.stopPricePoller();
    if (okx.stopPricePoller) okx.stopPricePoller();
  });

  describe('IExchangeService Interface Conformance', () => {
    test('BinanceService should implement all IExchangeService methods', () => {
      expect(typeof binance.fetchBalance).toBe('function');
      expect(typeof binance.fetchPositions).toBe('function');
      expect(typeof binance.executeOrder).toBe('function');
      expect(typeof binance.fetchCandles).toBe('function');
      expect(typeof binance.fetchTicker).toBe('function');
      expect(typeof binance.setLeverage).toBe('function');
      expect(typeof binance.calculateLiquidationPrice).toBe('function');
      expect(typeof binance.fetchFundingRate).toBe('function');
      expect(typeof binance.getMaxLeverage).toBe('function');
      expect(typeof binance.getIsSimulation).toBe('function');
    });

    test('OkxService should implement all IExchangeService methods', () => {
      expect(typeof okx.fetchBalance).toBe('function');
      expect(typeof okx.fetchPositions).toBe('function');
      expect(typeof okx.executeOrder).toBe('function');
      expect(typeof okx.fetchCandles).toBe('function');
      expect(typeof okx.fetchTicker).toBe('function');
      expect(typeof okx.setLeverage).toBe('function');
      expect(typeof okx.calculateLiquidationPrice).toBe('function');
      expect(typeof okx.fetchFundingRate).toBe('function');
      expect(typeof okx.getMaxLeverage).toBe('function');
      expect(typeof okx.getIsSimulation).toBe('function');
    });
  });

  describe('Liquidation Price Calculation Math', () => {
    const entryPrice = 50000;
    const leverage = 5; // 5x leverage -> 20% initial margin

    test('should accurately calculate LONG liquidation price with 0.5% maintenance margin rate', () => {
      // LONG formula: entryPrice * (1 - 1/leverage + maintenanceMarginRate)
      // 50000 * (1 - 0.20 + 0.005) = 50000 * 0.805 = 40250
      const binanceLiq = binance.calculateLiquidationPrice('BTC/USDT', entryPrice, leverage, 'LONG', 'isolated');
      const okxLiq = okx.calculateLiquidationPrice('BTC/USDT', entryPrice, leverage, 'LONG', 'isolated');

      expect(binanceLiq).toBe(40250);
      expect(okxLiq).toBe(40250);
      expect(binanceLiq).toBeLessThan(entryPrice);
    });

    test('should accurately calculate SHORT liquidation price with 0.5% maintenance margin rate', () => {
      // SHORT formula: entryPrice * (1 + 1/leverage - maintenanceMarginRate)
      // 50000 * (1 + 0.20 - 0.005) = 50000 * 1.195 = 59750
      const binanceLiq = binance.calculateLiquidationPrice('BTC/USDT', entryPrice, leverage, 'SHORT', 'isolated');
      const okxLiq = okx.calculateLiquidationPrice('BTC/USDT', entryPrice, leverage, 'SHORT', 'isolated');

      expect(binanceLiq).toBe(59750);
      expect(okxLiq).toBe(59750);
      expect(binanceLiq).toBeGreaterThan(entryPrice);
    });

    test('should handle 10x leverage tighter liquidation distances', () => {
      const lev10 = 10;
      // LONG 10x: 50000 * (1 - 0.10 + 0.005) = 50000 * 0.905 = 45250
      const liq10Long = binance.calculateLiquidationPrice('BTC/USDT', entryPrice, lev10, 'LONG');
      expect(liq10Long).toBe(45250);

      // SHORT 10x: 50000 * (1 + 0.10 - 0.005) = 50000 * 1.095 = 54750
      const liq10Short = binance.calculateLiquidationPrice('BTC/USDT', entryPrice, lev10, 'SHORT');
      expect(liq10Short).toBe(54750);
    });
  });

  describe('OkxService Simulation Fallback Safety', () => {
    test('should run in simulation mode when API credentials are empty without crashing', async () => {
      expect(okx.getIsSimulation()).toBe(true);

      const balance = await okx.fetchBalance();
      expect(balance.totalUsd).toBeGreaterThanOrEqual(1000);
      expect(balance.freeUsdt).toBeGreaterThanOrEqual(1000);

      const ticker = await okx.fetchTicker('BTC/USDT');
      expect(ticker.lastPrice).toBeGreaterThan(0);
      expect(ticker.symbol).toBe('BTC/USDT');

      const funding = await okx.fetchFundingRate('BTC/USDT');
      expect(funding.rate).toBeDefined();
      expect(funding.nextFundingTime).toBeInstanceOf(Date);
    });

    test('should execute simulated order with leverage and attach liquidation price', async () => {
      const result = await okx.executeOrder({
        symbol: 'BTC/USDT',
        side: 'BUY',
        amountUsd: 50,
        leverage: 5,
        marginMode: 'isolated',
      });

      expect(result.success).toBe(true);
      expect(result.isSimulated).toBe(true);
      expect(result.leverage).toBe(5);
      expect(result.marginMode).toBe('isolated');
      expect(result.marginUsed).toBe(50);
      expect(result.totalUsd).toBe(250); // 50 * 5
      expect(result.liquidationPrice).toBeGreaterThan(0);

      const positions = await okx.fetchPositions();
      const btcPos = positions.find((p) => p.symbol === 'BTC/USDT');
      expect(btcPos).toBeDefined();
      expect(btcPos?.leverage).toBe(5);
      expect(btcPos?.liquidationPrice).toBeDefined();
    });
  });

  describe('ExchangeFactory Selection', () => {
    test('should provide BinanceService by default', () => {
      const service = getExchangeService('binance');
      expect(service).toBeInstanceOf(BinanceService);
    });

    test('should provide OkxService when configured', () => {
      const service = getExchangeService('okx');
      expect(service).toBeInstanceOf(OkxService);
    });
  });
});
