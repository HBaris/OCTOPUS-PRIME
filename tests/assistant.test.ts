import { AssistantService } from '../src/services/assistant/AssistantService.js';
import { eventBus } from '../src/events/EventBus.js';
import { EventType, AgentRole, SceneSeverity } from '../src/config/constants.js';

describe('AssistantService & Personal Briefing Engine', () => {
  let assistantService: AssistantService;

  beforeEach(() => {
    assistantService = new AssistantService();
  });

  it('should initialize with 0 missed items and start timestamp', () => {
    const briefing = assistantService.getFullBriefing();
    expect(briefing).toHaveProperty('generatedAt');
    expect(briefing).toHaveProperty('sinceTimestamp');
    expect(briefing.unreadCounts.news).toBe(0);
    expect(briefing.unreadCounts.agentActions).toBe(0);
    expect(briefing.taskSummary.totalAgentActions).toBe(0);
    expect(briefing.executiveSummary.totalMissedNews).toBe(0);
  });

  it('should record missed news and generate executive summary accurately', () => {
    eventBus.publish(EventType.NEW_NEWS, {
      title: 'SEC spot Bitcoin ETF onayını resmen duyurdu',
      link: 'https://news.example.com/sec-etf',
      pubDate: new Date().toISOString(),
      category: 'crypto_specific',
      sentiment: { label: 'POSITIVE', score: 0.95 },
      impact: { impactScore: 9, affectedCoins: ['BTC'] },
      matchedCoins: ['BTC'],
    });

    eventBus.publish(EventType.NEW_NEWS, {
      title: 'Global merkez bankaları faiz indirim döngüsüne girdi',
      link: 'https://news.example.com/macro-rate',
      pubDate: new Date().toISOString(),
      category: 'geopolitical',
      sentiment: { label: 'POSITIVE', score: 0.7 },
      impact: { impactScore: 7, affectedCoins: ['BTC', 'GOLD'] },
      matchedCoins: ['BTC'],
    });

    const briefing = assistantService.getFullBriefing();
    expect(briefing.unreadCounts.news).toBe(2);
    expect(briefing.executiveSummary.totalMissedNews).toBe(2);
    expect(briefing.executiveSummary.topHeadlines.length).toBe(2);
    expect(briefing.executiveSummary.topHeadlines.some((h) => h.title.includes('SEC spot Bitcoin ETF'))).toBe(true);
    expect(briefing.executiveSummary.categoryBreakdown['crypto_specific']).toBe(1);
    expect(briefing.executiveSummary.categoryBreakdown['geopolitical']).toBe(1);
    expect(briefing.executiveSummary.captainTakeaway).toBeDefined();
  });

  it('should record agent actions and generate task breakdown summary (Görev Takipçisi)', () => {
    eventBus.publish(EventType.AGENT_ACTION, {
      agentRole: AgentRole.RISK_ANALYST,
      actionName: 'Volatilite Uyarısı',
      status: 'COMPLETED',
      timestamp: new Date().toISOString(),
      details: 'BTC volatilite bandı %4 genişledi',
    });

    eventBus.publish(EventType.AGENT_ACTION, {
      agentRole: AgentRole.SIGNAL_HUNTER,
      actionName: 'Sinyal Analizi',
      status: 'COMPLETED',
      timestamp: new Date().toISOString(),
      details: 'BTC/USDT BUY fırsatı tarandı',
    });

    eventBus.publish(EventType.SIGNAL_GENERATED, {
      action: 'BUY',
      symbol: 'BTC/USDT',
      signalScore: 88,
      confidence: 0.9,
      reason: 'Güçlü hacim ve pozitif ETF haberi',
      timestamp: new Date().toISOString(),
    });

    const briefing = assistantService.getFullBriefing();
    expect(briefing.unreadCounts.agentActions).toBe(2);
    expect(briefing.unreadCounts.signals).toBe(1);
    expect(briefing.taskSummary.totalAgentActions).toBe(2);
    expect(briefing.taskSummary.activeAgentsCount).toBe(2);
    expect(briefing.taskSummary.keyOperations.some((op) => op.includes('Sinyal Odası'))).toBe(true);
    expect(briefing.taskSummary.summaryParagraph).toContain('15 uzman ajanımız');
  });

  it('should reflect DEFCON severity changes and portfolio balance in executive summary', () => {
    eventBus.publish(EventType.SCENE_SEVERITY_UPDATE, {
      severityLabel: SceneSeverity.AGIR,
      impactScore: 7.5,
      primaryReason: 'Jeopolitik tansiyon ve ani likidasyon dalgası',
      topAffectedAssets: ['BTC', 'ETH'],
      timestamp: new Date().toISOString(),
    });

    eventBus.publish(EventType.PORTFOLIO_UPDATE, {
      totalBalanceUsd: 10450,
      freeBalanceUsd: 8000,
      lockedBalanceUsd: 2450,
      positions: [
        {
          symbol: 'BTCUSDT',
          side: 'LONG',
          amount: 0.05,
          entryPrice: 65000,
          markPrice: 66500,
          unrealizedPnl: 75,
          leverage: 5,
          liquidationPrice: 53000,
          margin: 650,
          pnlPercent: 11.5,
        },
      ],
      timestamp: new Date().toISOString(),
    });

    const briefing = assistantService.getFullBriefing();
    expect(briefing.executiveSummary.currentSeverity).toBe(SceneSeverity.AGIR);
    expect(briefing.executiveSummary.severityReason).toContain('Jeopolitik tansiyon');
    expect(briefing.executiveSummary.portfolioSummary.currentBalance).toBe(10450);
    expect(briefing.executiveSummary.portfolioSummary.pnlUsd).toBe(450);
    expect(briefing.executiveSummary.portfolioSummary.openPositionsCount).toBe(1);
  });

  it('should reset unread counts when marked as read', () => {
    eventBus.publish(EventType.NEW_NEWS, {
      title: 'Eski haber',
      link: 'https://news.example.com/old',
      pubDate: new Date().toISOString(),
      category: 'crypto_specific',
      sentiment: { label: 'NEUTRAL', score: 0.5 },
      impact: { impactScore: 4, affectedCoins: [] },
      matchedCoins: [],
    });

    expect(assistantService.getFullBriefing().unreadCounts.news).toBe(1);

    const markResult = assistantService.markAsRead();
    expect(markResult.success).toBe(true);

    const resetBriefing = assistantService.getFullBriefing();
    expect(resetBriefing.unreadCounts.news).toBe(0);
    expect(resetBriefing.unreadCounts.agentActions).toBe(0);
    expect(resetBriefing.unreadCounts.signals).toBe(0);
  });
});
