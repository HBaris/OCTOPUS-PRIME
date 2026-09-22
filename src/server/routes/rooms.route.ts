import { Router, Request, Response } from 'express';
import { AltcoinScannerService } from '../../services/market/AltcoinScannerService.js';
import { AutoTradeEngine } from '../../services/decision/AutoTradeEngine.js';
import { EarlyLeakScannerService } from '../../services/intelligence/EarlyLeakScannerService.js';
import { TechnicalAnalysisService } from '../../services/analysis/TechnicalAnalysisService.js';
import { NewsRadar } from '../../services/news/NewsRadar.js';
import { LearningEngine } from '../../services/learning/LearningEngine.js';
import { IExchangeService } from '../../services/exchange/IExchangeService.js';
import { ChiefChatService } from '../../services/assistant/ChiefChatService.js';

export function createRoomsRouter(deps: {
  altcoinScannerService: AltcoinScannerService;
  autoTradeEngine: AutoTradeEngine;
  earlyLeakScannerService: EarlyLeakScannerService;
  technicalAnalysisService: TechnicalAnalysisService;
  newsRadar: NewsRadar;
  learningEngine: LearningEngine;
  exchangeService: IExchangeService;
  chiefChatService?: ChiefChatService;
}): Router {
  const router = Router();
  const chiefChat =
    deps.chiefChatService ||
    new ChiefChatService({
      altcoinScanner: deps.altcoinScannerService,
      autoTradeEngine: deps.autoTradeEngine,
      earlyLeakScanner: deps.earlyLeakScannerService,
      technicalAnalysis: deps.technicalAnalysisService,
      learningEngine: deps.learningEngine,
      exchangeService: deps.exchangeService,
      newsRadar: deps.newsRadar,
    });

  // 1. Universal Scanner Room Data (Oda 1)
  router.get('/scanner', async (_req: Request, res: Response) => {
    try {
      const radarList = deps.altcoinScannerService.getRadarList();
      const symbols = deps.altcoinScannerService.getSymbols();

      res.json({
        success: true,
        room: 'UNIVERSAL_SCANNER',
        title: '🌐 Dinamik Piyasa Tarayıcısı Odası',
        unitChief: 'Piyasa Radarı Şefi',
        totalUniverseCount: symbols.length,
        radarCoins: radarList,
        topHotCoins: radarList.slice(0, 8),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // 2. Dynamic Scalping Room Data (Oda 2)
  router.get('/scalp', async (_req: Request, res: Response) => {
    try {
      const positions = await deps.exchangeService.fetchPositions();
      const balance = await deps.exchangeService.fetchBalance();
      const stats = deps.autoTradeEngine.getStats();
      const recentOrders = deps.autoTradeEngine.getRecentOrders();

      res.json({
        success: true,
        room: 'SMART_SCALPER',
        title: '⚡ Dinamik Scalping Odası',
        unitChief: 'Baş Scalper',
        isAutoTradingEnabled: deps.autoTradeEngine.isEnabled(),
        stats,
        balance,
        positions,
        recentOrders,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // Natural Language Command Execution (Backward-compatible alias)
  router.post('/scalp/command', async (req: Request, res: Response) => {
    try {
      const { command } = req.body;
      if (!command || typeof command !== 'string') {
        return res.status(400).json({ success: false, error: 'Command text is required' });
      }

      const result = await deps.autoTradeEngine.processNaturalLanguageCommand(command);
      res.json({
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // Universal Unit Chief Conversational Chat Endpoint (All Rooms)
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { roomId, message } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, error: 'Message text is required' });
      }

      const reply = await chiefChat.chatWithChief(roomId || 'scalp', message);
      res.json({
        success: true,
        ...reply,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // 3. Early Intelligence & Whale Leak Room Data (Oda 3)
  router.get('/intelligence', async (_req: Request, res: Response) => {
    try {
      const leaks = deps.earlyLeakScannerService.getRecentLeaks();
      const rules = deps.learningEngine.getAllRules();
      const regime = deps.learningEngine.getMarketRegime();

      res.json({
        success: true,
        room: 'EARLY_INTELLIGENCE',
        title: '🕵️ Öncü İstihbarat & Balina Tüyo Odası',
        unitChief: 'İstihbarat Şefi',
        sourcesMonitored: [
          'www.coingecko.com',
          'www.coinmarketcap.com',
          'www.coindesk.com',
          'www.cointelegraph-tr.com',
          'www.cryptopanic.com',
        ],
        recentLeaks: leaks,
        learnedRules: rules,
        currentRegime: regime,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // 4. Technical Analysis & S/R Breakout Room Data (Oda 4)
  router.get('/technical', async (_req: Request, res: Response) => {
    try {
      const radarList = deps.altcoinScannerService.getRadarList();
      const topSymbols = radarList.slice(0, 6).map((r) => r.symbol);
      const candidates = topSymbols.length > 0 ? topSymbols : ['SOL/USDT', 'NEAR/USDT', 'SUI/USDT', 'PEPE/USDT'];

      const analyses = [];
      for (const sym of candidates) {
        const sr = await deps.technicalAnalysisService.analyzeSupportResistance(sym, '15m');
        if (sr) analyses.push(sr);
      }

      res.json({
        success: true,
        room: 'TECHNICAL_ANALYSIS',
        title: '📈 Teknik Analiz & Direnç/Destek Avcısı Odası',
        unitChief: 'Baş Tekniker',
        analyses,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // 5. Macro & News Room Data (Oda 5)
  router.get('/news', async (_req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        room: 'MACRO_NEWS',
        title: '📰 Makro & Haber Duyarlılık Odası',
        unitChief: 'Haber Şefi',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  return router;
}
