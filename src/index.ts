import http from 'http';
import { config } from './config/index.js';
import { KeywordsManager } from './services/news/KeywordsManager.js';
import { SentimentAnalyzer } from './services/news/SentimentAnalyzer.js';
import { ImpactScorer } from './services/impact/ImpactScorer.js';
import { NewsRadar } from './services/news/NewsRadar.js';
import { getExchangeService } from './services/exchange/ExchangeFactory.js';
import { CorrelationTracker } from './services/correlation/CorrelationTracker.js';
import { FeedbackSystem } from './services/feedback/FeedbackSystem.js';
import { LearningEngine } from './services/learning/LearningEngine.js';
import { RuleStore } from './services/learning/RuleStore.js';
import { CircuitBreaker } from './services/risk/CircuitBreaker.js';
import { DecisionEngine } from './services/decision/DecisionEngine.js';
import { AssistantService } from './services/assistant/AssistantService.js';
import { AutoTradeEngine } from './services/decision/AutoTradeEngine.js';
import { MarketStreamService } from './services/market/MarketStreamService.js';
import { AltcoinScannerService } from './services/market/AltcoinScannerService.js';
import { TelegramListener } from './services/social/TelegramListener.js';
import { ThreadsObserver } from './services/social/ThreadsObserver.js';
import { AgentManager } from './agents/AgentManager.js';
import { createApp } from './server/app.js';
import { WebSocketServer } from './server/websocket/WebSocketServer.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  logger.info('🚀 Initializing Octopus Prime 3-Channel Scalping Backend System...');

  // 1. Initialize core data and analysis services
  const keywordsManager = new KeywordsManager('keywords.json');
  const sentimentAnalyzer = new SentimentAnalyzer(config.SENTIMENT_MODEL);
  const impactScorer = new ImpactScorer();
  const newsRadar = new NewsRadar(keywordsManager, sentimentAnalyzer, impactScorer);

  // 2. Initialize Exchange Service (Binance or OKX)
  const exchangeService = getExchangeService();
  const correlationTracker = new CorrelationTracker(exchangeService, 'correlations.json');
  const feedbackSystem = new FeedbackSystem('feedback.json');
  const assistantService = new AssistantService();

  // 3. Initialize Learning Engine & Circuit Breaker
  const ruleStore = new RuleStore('rules.json');
  const learningEngine = new LearningEngine(ruleStore);
  const circuitBreaker = new CircuitBreaker(
    config.COOLDOWN_CONSECUTIVE_LOSSES,
    config.COOLDOWN_DURATION_MINUTES
  );

  // 4. Initialize 3-Channel Sinks
  const marketStreamService = new MarketStreamService(exchangeService);
  const telegramListener = new TelegramListener();
  const threadsObserver = new ThreadsObserver();

  // 5. Initialize Decision Engine with 3-Channel synthesis
  const decisionEngine = new DecisionEngine(
    exchangeService,
    correlationTracker,
    feedbackSystem,
    learningEngine,
    circuitBreaker
  );

  // 6. Initialize Autonomous Auto-Trading & Altcoin Opportunity Scanner
  const autoTradeEngine = new AutoTradeEngine(exchangeService, circuitBreaker);
  const altcoinScannerService = new AltcoinScannerService(exchangeService, decisionEngine);

  // 7. Initialize Agent Manager
  const agentManager = new AgentManager(exchangeService, correlationTracker);

  // 8. Create Express HTTP Application
  const app = createApp({
    agentManager,
    exchangeService,
    newsRadar,
    keywordsManager,
    decisionEngine,
    feedbackSystem,
    assistantService,
    learningEngine,
    circuitBreaker,
    autoTradeEngine,
  });

  const server = http.createServer(app);

  // 9. Attach WebSocket Server
  const wsServer = new WebSocketServer(
    server,
    config.WS_PORT,
    agentManager,
    feedbackSystem,
    newsRadar
  );

  // 10. Start Background Streaming, Scanning & Auto-Trading Jobs
  correlationTracker.startMonitorLoop(30);
  newsRadar.startPeriodicScan(config.RSS_CHECK_INTERVAL_SEC);
  await marketStreamService.start();
  await altcoinScannerService.start();
  await autoTradeEngine.start();
  await telegramListener.start();
  await threadsObserver.start();

  // 11. Start HTTP Server
  server.listen(config.PORT, () => {
    logger.info(`✨ REST API Server listening at http://localhost:${config.PORT}`);
    logger.info(`📡 WebSocket Event Stream ready at ws://localhost:${config.PORT}/ws`);
    logger.info(`🤖 Autonomous Passive Income & Micro-Scalp Engine ACTIVE (Target: $${config.MICRO_SCALP_TARGET_USD}/trade)`);
    logger.info('👾 3-Channel Pixel Art Office Visualizer backend is active and ready!');
  });

  // Graceful Shutdown
  const shutdown = () => {
    logger.info('🛑 Gracefully shutting down Crypto Agent Backend...');
    newsRadar.stop();
    correlationTracker.stop();
    marketStreamService.stop();
    altcoinScannerService.stop();
    autoTradeEngine.stop();
    telegramListener.stop();
    threadsObserver.stop();
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
