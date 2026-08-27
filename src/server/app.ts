import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '../config/index.js';
import { AgentManager } from '../agents/AgentManager.js';
import { IExchangeService } from '../services/exchange/IExchangeService.js';
import { NewsRadar } from '../services/news/NewsRadar.js';
import { KeywordsManager } from '../services/news/KeywordsManager.js';
import { DecisionEngine } from '../services/decision/DecisionEngine.js';
import { FeedbackSystem } from '../services/feedback/FeedbackSystem.js';

import { createHealthRouter } from './routes/health.route.js';
import { createStateRouter } from './routes/state.route.js';
import { createPortfolioRouter } from './routes/portfolio.route.js';
import { createNewsRouter } from './routes/news.route.js';
import { createSignalsRouter } from './routes/signals.route.js';
import { createFeedbackRouter } from './routes/feedback.route.js';
import { createAssistantRouter } from './routes/assistant.route.js';
import { AssistantService } from '../services/assistant/AssistantService.js';
import { errorHandler } from './middleware/errorHandler.js';

export interface AppDependencies {
  agentManager: AgentManager;
  exchangeService?: IExchangeService;
  binanceService?: IExchangeService; // Backward compatibility
  newsRadar: NewsRadar;
  keywordsManager: KeywordsManager;
  decisionEngine: DecisionEngine;
  feedbackSystem: FeedbackSystem;
  assistantService?: AssistantService;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();
  const exchange = deps.exchangeService || deps.binanceService;
  if (!exchange) {
    throw new Error('Neither exchangeService nor binanceService was provided to createApp.');
  }

  // 1. Security HTTP Headers
  app.use(helmet());

  // 2. Strict CORS Configuration (Only configured origin allowed, no wildcard)
  const allowedOrigins = [
    config.FRONTEND_ORIGIN,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  // 3. Body Parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 4. API Routes
  app.use('/api/health', createHealthRouter());
  app.use('/api/state', createStateRouter(deps.agentManager));
  app.use('/api/portfolio', createPortfolioRouter(exchange!));
  app.use('/api/news', createNewsRouter(deps.newsRadar, deps.keywordsManager));
  app.use('/api/signals', createSignalsRouter(deps.decisionEngine));
  app.use('/api/feedback', createFeedbackRouter(deps.feedbackSystem));
  const assistantService = deps.assistantService || new AssistantService();
  app.use('/api/assistant', createAssistantRouter(assistantService));

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      path: req.originalUrl,
    });
  });

  // 5. Centralized Error Handler (No stack trace leaks)
  app.use(errorHandler);

  return app;
}
