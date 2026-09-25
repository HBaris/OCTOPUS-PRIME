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

  // Autonomous Trend & Momentum Trading Engine (Swing & Momentum Mode)
  AUTO_TRADING_ENABLED: z.preprocess((val) => val === undefined ? true : val === 'true' || val === true, z.boolean()).default(true),
  AUTOTRADE_TARGET_PROFIT_PERCENT: z.coerce.number().positive().default(2.5), // %2.5 target profit per trade
  AUTOTRADE_TRAILING_STOP_PERCENT: z.coerce.number().positive().default(0.8), // %0.8 trailing stop distance
  AUTOTRADE_STOP_LOSS_PERCENT: z.coerce.number().positive().default(1.5), // %1.5 dynamic stop loss defense
  AUTOTRADE_MARGIN_USD: z.coerce.number().positive().default(50.0), // $50.0 margin per trade
  MAX_CONCURRENT_POSITIONS: z.coerce.number().min(1).default(4),
  ALTCOIN_SCAN_INTERVAL_SEC: z.coerce.number().min(3).default(8),
  ALTCOIN_SYMBOLS: z
    .string()
    .default('BTC/USDT,ETH/USDT,SOL/USDT,AVAX/USDT,NEAR/USDT,SUI/USDT,APT/USDT,ARB/USDT,OP/USDT,LINK/USDT,INJ/USDT,TIA/USDT,RENDER/USDT,FET/USDT,DOGE/USDT,PEPE/USDT,SHIB/USDT,ADA/USDT,DOT/USDT,ATOM/USDT,MATIC/USDT,ICP/USDT,SEI/USDT,JUP/USDT,WIF/USDT,BONK/USDT,FTM/USDT,STX/USDT,RUNE/USDT,KAS/USDT,GALA/USDT,FIL/USDT,LTC/USDT,BCH/USDT,UNI/USDT,AAVE/USDT,MKR/USDT,CRV/USDT,LDO/USDT,DYDX/USDT,BLUR/USDT,PYTH/USDT,ALT/USDT,1000CAT/USDT,1000CHEEMS/USDT,1000SATS/USDT,1MBABYDOGE/USDT,ACE/USDT,ALGO/USDT,XRP/USDT,BNB/USDT')
    .transform((val) =>
      val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  
  // Sentiment Model (Public multilingual sentiment model)
  SENTIMENT_MODEL: z.string().default('Xenova/distilbert-base-multilingual-cased-sentiments-student'),

  // AI Conversational Intelligence & Brain Providers
  AI_PROVIDER: z.enum(['auto', 'claude', 'gemini', 'openai', 'local']).default('auto'),
  
  // Anthropic Claude
  ANTHROPIC_API_KEY: z.string().default(''),
  CLAUDE_MODEL: z.string().default('claude-3-5-sonnet-20241022'),
  
  // Google Gemini
  GEMINI_API_KEY: z.string().default(''),
  AI_CHAT_MODEL: z.string().default('gemini-2.5-flash'),

  // OpenAI
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o'),
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
