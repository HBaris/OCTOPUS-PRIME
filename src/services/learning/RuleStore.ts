import fs from 'fs';
import path from 'path';
import { LearningRule } from '../../types/market.js';
import { logger } from '../../utils/logger.js';

export class RuleStore {
  private filePath: string;
  private rules: Map<string, LearningRule> = new Map();

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(process.cwd(), 'rules.json');
    this.loadRules();
  }

  public loadRules(): void {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data: LearningRule[] = JSON.parse(raw);
        this.rules.clear();
        for (const rule of data) {
          this.rules.set(rule.id, rule);
        }
        logger.info(`🧠 [RuleStore] Loaded ${this.rules.size} learning rules from ${this.filePath}`);
      } catch (err) {
        logger.warn('⚠️ [RuleStore] Error reading rules file, initializing empty store:', err);
      }
    } else {
      this.initDefaultRules();
      this.saveRules();
    }
  }

  public saveRules(): void {
    try {
      const data = Array.from(this.rules.values());
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      logger.error('❌ [RuleStore] Failed to save rules to disk:', err);
    }
  }

  public getRule(id: string): LearningRule | undefined {
    return this.rules.get(id);
  }

  public getAllRules(): LearningRule[] {
    return Array.from(this.rules.values());
  }

  public setRule(rule: LearningRule): void {
    this.rules.set(rule.id, rule);
    this.saveRules();
  }

  public deleteRule(id: string): boolean {
    const deleted = this.rules.delete(id);
    if (deleted) this.saveRules();
    return deleted;
  }

  private initDefaultRules(): void {
    const defaults: LearningRule[] = [
      {
        id: 'rule_bull_ema_news',
        description: 'BULLISH EMA Kesişimi + Yüksek Etkili Olumlu Kripto Haberi',
        conditionType: 'HYBRID',
        pattern: 'EMA_BULLISH+NEWS_POSITIVE',
        confidenceBonus: 20,
        observationCount: 18,
        independentSources: ['chart_ws', 'news_coindesk', 'news_bloomberg', 'telegram_alpha'],
        regimesSeen: ['BULL', 'SIDEWAYS'],
        tier: 'STRONG_RULE',
        successCount: 15,
        failCount: 3,
        successRate: 0.83,
        recentTradeOutcomes: [true, true, true, false, true, true, true, true, true, false, true, true, true, true, true],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 'rule_oversold_rsi_bounce',
        description: 'RSI Aşırı Satım (<=30) + Hacim Sıçraması',
        conditionType: 'TECHNICAL',
        pattern: 'RSI_OVERSOLD+VOL_SPIKE',
        confidenceBonus: 8,
        observationCount: 6,
        independentSources: ['binance_candles', 'okx_candles', 'orderbook_depth', 'crypto_panic'],
        regimesSeen: ['BEAR'],
        tier: 'WEAK_RULE',
        successCount: 4,
        failCount: 2,
        successRate: 0.66,
        recentTradeOutcomes: [true, false, true, true, false, true],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      },
    ];

    defaults.forEach((r) => this.rules.set(r.id, r));
  }
}
