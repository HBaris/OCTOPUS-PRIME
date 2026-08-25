import { config } from '../../config/index.js';
import { IExchangeService } from './IExchangeService.js';
import { binanceService, BinanceService } from '../binance/BinanceService.js';
import { okxService, OkxService } from '../okx/OkxService.js';
import { logger } from '../../utils/logger.js';

let cachedService: IExchangeService | null = null;

export function getExchangeService(providerOverride?: 'binance' | 'okx'): IExchangeService {
  const provider = providerOverride || config.EXCHANGE_PROVIDER || 'binance';

  if (!cachedService || providerOverride) {
    if (provider === 'okx') {
      logger.info('🏢 [ExchangeFactory] Selected Exchange Provider: OKX Demo Trading');
      cachedService = okxService;
    } else {
      logger.info('🏢 [ExchangeFactory] Selected Exchange Provider: Binance (Futures/Spot Testnet)');
      cachedService = binanceService;
    }
  }

  return cachedService;
}

export const exchangeService: IExchangeService = getExchangeService();
export { IExchangeService, BinanceService, OkxService };
