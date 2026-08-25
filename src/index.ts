import http from 'http';
import { config } from './config/index.js';
import { KeywordsManager } from './services/news/KeywordsManager.js';
import { SentimentAnalyzer } from './services/news/SentimentAnalyzer.js';
import { ImpactScorer } from './services/impact/ImpactScorer.js';
import { NewsRadar } from './services/news/NewsRadar.js';
import { getExchangeService } from './services/exchange/ExchangeFactory.js';
import { CorrelationTracker } from './services/correlation/CorrelationTracker.js';
import { FeedbackSystem } from './services/feedback/FeedbackSystem.js';
import { DecisionEngine } from './services/decision/DecisionEngine.js';
import { AgentManager } from './agents/AgentManager.js';
import { createApp } from './server/app.js';
import { WebSocketServer } from './server/websocket/WebSocketServer.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  logger.info('🚀 Initializing Crypto Trading Agent Backend System...');

  // 1. Initialize core data and analysis services
  const keywordsManager = new KeywordsManager('keywords.json');
  const sentimentAnalyzer = new SentimentAnalyzer(config.SENTIMENT_MODEL);
  const impactScorer = new ImpactScorer();
  const newsRadar = new NewsRadar(keywordsManager, sentimentAnalyzer, impactScorer);

  // 2. Initialize Exchange Service (Binance or OKX based on config)
  const exchangeService = getExchangeService();
  const correlationTracker = new CorrelationTracker(exchangeService, 'correlations.json');
  const feedbackSystem = new FeedbackSystem('feedback.json');
  const decisionEngine = new DecisionEngine(exchangeService, correlationTracker, feedbackSystem);

  // 3. Initialize 15 Agent Roles
  const agentManager = new AgentManager(exchangeService, correlationTracker);

  // 4. Create Express HTTP Application
  const app = createApp({
    agentManager,
    exchangeService,
    newsRadar,
    keywordsManager,
    decisionEngine,
    feedbackSystem,
  });

  const server = http.createServer(app);

  // 5. Attach WebSocket Server
  const wsServer = new WebSocketServer(
    server,
    config.WS_PORT,
    agentManager,
    feedbackSystem,
    newsRadar
  );

  // 6. Start Background Jobs
  correlationTracker.startMonitorLoop(30);
  newsRadar.startPeriodicScan(config.RSS_CHECK_INTERVAL_SEC);

  // 7. Start HTTP Server
  server.listen(config.PORT, () => {
    logger.info(`✨ REST API Server listening at http://localhost:${config.PORT}`);
    logger.info(`📡 WebSocket Event Stream ready at ws://localhost:${config.PORT}/ws`);
    logger.info('👾 Pixel Art Office Visualizer backend is active and ready!');
  });

  // Graceful Shutdown
  const shutdown = () => {
    logger.info('🛑 Gracefully shutting down Crypto Agent Backend...');
    newsRadar.stop();
    correlationTracker.stop();
    wsServer.close();
    server.close(() => {
      logger.info('👋 Server closed successfully.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  logger.error('💥 Fatal bootstrap error:', err);
  process.exit(1);
});
