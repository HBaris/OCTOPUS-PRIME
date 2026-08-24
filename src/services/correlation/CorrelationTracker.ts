import fs from 'fs';
import path from 'path';
import { DEFAULT_CORRELATIONS, EventType } from '../../config/constants.js';
import { eventBus } from '../../events/EventBus.js';
import { BinanceService } from '../binance/BinanceService.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export interface TrackedEventRecord {
  id: string;
  eventType: string;
  symbol: string;
  initialPrice: number;
  expectedDirection: number; // +1 for up, -1 for down
  timestamp: string;
  checkTime: string;
  evaluated: boolean;
  actualPrice?: number;
  actualChangePercent?: number;
  accuracy?: number;
}

export class CorrelationTracker {
  private correlationsFilePath: string;
  private correlations: Record<string, Record<string, number>> = {};
  private eventLog: TrackedEventRecord[] = [];
  private binanceService: BinanceService;
  private monitorTimer: NodeJS.Timeout | null = null;
  private emaAccuracy = 0.75; // Starting confidence base
  private readonly alpha = 0.3; // 30% weight to new data, 70% to previous

  constructor(binanceService: BinanceService, filePath = 'correlations.json') {
    this.binanceService = binanceService;
    this.correlationsFilePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
    this.loadCorrelations();
  }

  public loadCorrelations(): void {
    try {
      if (fs.existsSync(this.correlationsFilePath)) {
        const raw = fs.readFileSync(this.correlationsFilePath, 'utf-8');
        this.correlations = JSON.parse(raw);
        logger.info(`✅ Loaded correlations from ${this.correlationsFilePath}`);
      } else {
        this.correlations = { ...DEFAULT_CORRELATIONS };
        this.saveCorrelations();
      }
    } catch (err) {
      logger.error('❌ Error loading correlations.json:', err);
      this.correlations = { ...DEFAULT_CORRELATIONS };
    }
  }

  public saveCorrelations(): void {
    try {
      fs.writeFileSync(this.correlationsFilePath, JSON.stringify(this.correlations, null, 2), 'utf-8');
      logger.info('✅ Saved correlations to correlations.json');
    } catch (err) {
      logger.error('❌ Failed to save correlations.json:', err);
    }
  }

  public getCorrelations(): Record<string, Record<string, number>> {
    return { ...this.correlations };
  }

  public getEmaAccuracy(): number {
    return Math.round(this.emaAccuracy * 100) / 100;
  }

  public async trackEvent(
    eventType: string,
    symbol: string,
    expectedDirection: number, // 1 or -1
    minutesDelay = config.CORRELATION_CHECK_MINUTES
  ): Promise<string> {
    const ticker = await this.binanceService.getTicker(symbol);
    const now = new Date();
    const checkTime = new Date(now.getTime() + minutesDelay * 60 * 1000);

    const record: TrackedEventRecord = {
      id: `corr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      eventType,
      symbol,
      initialPrice: ticker.lastPrice,
      expectedDirection,
      timestamp: now.toISOString(),
      checkTime: checkTime.toISOString(),
      evaluated: false,
    };

    this.eventLog.push(record);
    logger.info(
      `📍 [CorrelationTracker] Tracking event "${eventType}" for ${symbol} @ $${ticker.lastPrice}. Will evaluate in ${minutesDelay}m.`
    );

    return record.id;
  }

  public async checkPendingEvents(): Promise<void> {
    const now = new Date();

    for (const event of this.eventLog) {
      if (!event.evaluated && new Date(event.checkTime) <= now) {
        await this.evaluateEvent(event);
      }
    }
  }

  public async evaluateEvent(event: TrackedEventRecord): Promise<void> {
    try {
      const ticker = await this.binanceService.getTicker(event.symbol);
      const currentPrice = ticker.lastPrice;
      const changePercent = (currentPrice - event.initialPrice) / event.initialPrice;

      // Accuracy formula: Was direction correct?
      const actualDirection = changePercent >= 0 ? 1 : -1;
      const isAccurate = actualDirection === event.expectedDirection ? 1.0 : 0.0;
      
      // Calculate scaled accuracy based on magnitude
      const accuracyScore = isAccurate ? Math.min(1.0, 0.5 + Math.abs(changePercent) * 20) : Math.max(0.0, 0.5 - Math.abs(changePercent) * 20);

      // Update EMA accuracy
      this.emaAccuracy = (1 - this.alpha) * this.emaAccuracy + this.alpha * accuracyScore;

      event.evaluated = true;
      event.actualPrice = currentPrice;
      event.actualChangePercent = Math.round(changePercent * 10000) / 100;
      event.accuracy = Math.round(accuracyScore * 100) / 100;

      // Update correlation matrix
      const assetKey = event.symbol.split('/')[0].toLowerCase();
      if (!this.correlations[event.eventType]) {
        this.correlations[event.eventType] = {};
      }

      const oldCorr = this.correlations[event.eventType][assetKey] ?? (event.expectedDirection * 0.6);
      const newCorr = (1 - this.alpha) * oldCorr + this.alpha * (changePercent * 10);
      this.correlations[event.eventType][assetKey] = Math.round(Math.max(-1.0, Math.min(1.0, newCorr)) * 100) / 100;

      this.saveCorrelations();

      // Emit RISK_CONFIDENCE_UPDATE event for Risk Analyst Agent
      const evaluatedCount = this.eventLog.filter((e) => e.evaluated).length;
      const avgAccuracy = this.eventLog
        .filter((e) => e.evaluated && e.accuracy !== undefined)
        .reduce((sum, e) => sum + (e.accuracy || 0), 0) / (evaluatedCount || 1);

      eventBus.publish(EventType.RISK_CONFIDENCE_UPDATE, {
        confidenceScore: this.getEmaAccuracy(),
        accuracyRate: Math.round(avgAccuracy * 100) / 100,
        totalTrackedEvents: this.eventLog.length,
        evaluatedEvents: evaluatedCount,
        recentEmaAccuracy: this.getEmaAccuracy(),
        analystComment: this.getAnalystComment(this.emaAccuracy),
      });

      logger.info(
        `📊 [CorrelationTracker] Evaluated event "${event.eventType}" on ${event.symbol}: Initial=$${event.initialPrice} -> Final=$${currentPrice} (${event.actualChangePercent}%). New EMA Confidence: ${this.getEmaAccuracy()}`
      );
    } catch (err) {
      logger.error('❌ [CorrelationTracker] Error evaluating event:', err);
    }
  }

  private getAnalystComment(confidence: number): string {
    if (confidence >= 0.8) {
      return '🟢 Yüksek Güven: Son tahminlerin isabet oranı yüksek, risk toleransı genişletilebilir.';
    } else if (confidence >= 0.6) {
      return '🟡 Orta Güven: Piyasa korelasyonları makul seviyede, standart pozisyon yönetimi.';
    } else {
      return '🔴 Düşük Güven: Volatilite ve sapmalar yüksek, sinyal eşikleri sıkılaştırılmalı.';
    }
  }

  public startMonitorLoop(intervalSec = 30): void {
    if (this.monitorTimer) clearInterval(this.monitorTimer);

    this.monitorTimer = setInterval(() => {
      this.checkPendingEvents();
    }, intervalSec * 1000);
    logger.info('🔄 [CorrelationTracker] Started background event evaluation loop');
  }

  public stop(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
  }

  public getTrackedEvents(): TrackedEventRecord[] {
    return [...this.eventLog];
  }
}
