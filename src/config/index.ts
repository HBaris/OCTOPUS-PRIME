import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  WS_PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  
  // Binance Credentials
  BINANCE_API_KEY: z.string().default(''),
  BINANCE_API_SECRET: z.string().default(''),
  BINANCE_TESTNET: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(true),
  
  // Trading Safety Limits
  ENABLE_REAL_ORDERS: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  MAX_POSITION_SIZE_USD: z.coerce.number().positive().default(100.0),
  
  // Monitoring & Analysis Configuration
  RSS_CHECK_INTERVAL_SEC: z.coerce.number().min(10).default(180),
  DECISION_SIGNAL_THRESHOLD: z.coerce.number().min(0).max(100).default(70),
  CORRELATION_CHECK_MINUTES: z.coerce.number().min(1).default(15),
  
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
