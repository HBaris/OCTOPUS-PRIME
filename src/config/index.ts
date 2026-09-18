import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  WS_PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  
  // Exchange Provider Selection
  EXCHANGE_PROVIDER: z.enum(['binance', 'okx']).default('binance'),

  // Binance Credentials
  BINANCE_API_KEY: z.string().default(''),
  BINANCE_API_SECRET: z.string().default(''),
  BINANCE_TESTNET: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(true),

  // OKX Demo Trading Credentials
  OKX_API_KEY: z.string().default(''),
  OKX_SECRET: z.string().default(''),
  OKX_PASSPHRASE: z.string().default(''),

  // Leverage & Margin Settings
  DEFAULT_LEVERAGE: z.coerce.number().min(1).default(5),
  DEFAULT_MARGIN_MODE: z.enum(['isolated', 'cross']).default('isolated'),
  MAX_LEVERAGE_ALLOWED: z.coerce.number().min(1).default(10),
  
  // Trading Safety Limits
  ENABLE_REAL_ORDERS: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  MAX_POSITION_SIZE_USD: z.coerce.number().positive().default(100.0),
  
  // Monitoring & Analysis Configuration
  RSS_CHECK_INTERVAL_SEC: z.coerce.number().min(10).default(180),
  DECISION_SIGNAL_THRESHOLD: z.coerce.number().min(0).max(100).default(70),
  CORRELATION_CHECK_MINUTES: z.coerce.number().min(1).default(15),

  // CryptoPanic API (Fast News)
  CRYPTOPANIC_API_KEY: z.string().default(''),

  // Social Intelligence (Telegram MTProto & Threads/X)
  TELEGRAM_API_ID: z.string().default(''),
  TELEGRAM_API_HASH: z.string().default(''),
  TELEGRAM_CHANNELS: z
    .string()
    .default('')
    .transform((val) =>
      val
        ? val
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    ),
  THREADS_TARGET_URL: z.string().default(''),

  // Circuit Breaker / Cooldown Settings
  COOLDOWN_CONSECUTIVE_LOSSES: z.coerce.number().min(1).default(3),
  COOLDOWN_DURATION_MINUTES: z.coerce.number().min(1).default(30),

  // Real-Time Stream Symbols
  MARKET_STREAM_SYMBOLS: z
    .string()
    .default('BTC/USDT,ETH/USDT,SOL/USDT')
    .transform((val) =>
      val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    ),

  // Autonomous Auto-Trading & Micro-Scalping (Passive Income Mode)
  AUTO_TRADING_ENABLED: z.preprocess((val) => val === undefined ? true : val === 'true' || val === true, z.boolean()).default(true),
  MICRO_SCALP_TARGET_USD: z.coerce.number().positive().default(0.30), // $0.30 (30 Cents target profit per trade)
  MICRO_SCALP_STOP_LOSS_USD: z.coerce.number().positive().default(0.60), // $0.60 stop loss defense
  MICRO_SCALP_MARGIN_USD: z.coerce.number().positive().default(15.0), // $15.0 isolated margin per micro trade
  MAX_CONCURRENT_POSITIONS: z.coerce.number().min(1).default(4),
  ALTCOIN_SCAN_INTERVAL_SEC: z.coerce.number().min(3).default(8),
  ALTCOIN_SYMBOLS: z
    .string()
    .default('DOGE/USDT,PEPE/USDT,AVAX/USDT,LINK/USDT,SUI/USDT,NEAR/USDT,ARB/USDT,OP/USDT,APT/USDT,XRP/USDT,SOL/USDT,BNB/USDT')
    .transform((val) =>
      val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  
  // Sentiment Model (Public multilingual sentiment model)
  SENTIMENT_MODEL: z.string().default('Xenova/distilbert-base-multilingual-cased-sentiments-student'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  logger.error('Invalid environment variables detected:', parsedEnv.error.format());
  throw new Error('Environment configuration validation failed.');
}

export const config = parsedEnv.data;

logger.info(
  `Configuration loaded: Environment=${config.NODE_ENV}, Port=${config.PORT}, WS_Port=${config.WS_PORT}, RealOrdersEnabled=${config.ENABLE_REAL_ORDERS}, MaxPositionSizeUSD=${config.MAX_POSITION_SIZE_USD}`
);
