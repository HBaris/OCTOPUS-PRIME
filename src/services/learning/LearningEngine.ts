import { RuleStore } from './RuleStore.js';
import { LearningRule } from '../../types/market.js';
import { eventBus } from '../../events/EventBus.js';
import { EventType, RuleTier, MarketRegime } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

export class LearningEngine {
  private ruleStore: RuleStore;
  private currentRegime: MarketRegime = MarketRegime.BULL;

  constructor(ruleStore?: RuleStore) {
    this.ruleStore = ruleStore || new RuleStore();
  }

  public setMarketRegime(regime: MarketRegime): void {
    this.currentRegime = regime;
    logger.info(`🌐 [LearningEngine] Market regime updated to: ${regime}`);
  }

  public getMarketRegime(): MarketRegime {
    return this.currentRegime;
  }

  public getMatchingRuleBonus(patterns: string[]): { totalBonus: number; appliedRules: LearningRule[] } {
    let totalBonus = 0;
    const appliedRules: LearningRule[] = [];

    const allRules = this.ruleStore.getAllRules();
    for (const rule of allRules) {
      if (patterns.includes(rule.pattern)) {
        if (rule.tier === RuleTier.STRONG_RULE) {
          totalBonus += rule.confidenceBonus || 20;
          appliedRules.push(rule);
        } else if (rule.tier === RuleTier.WEAK_RULE) {
          totalBonus += rule.confidenceBonus || 8;
          appliedRules.push(rule);
        }
        // Hypothesis rules give 0 bonus
      }
    }

    return { totalBonus: Math.min(25, totalBonus), appliedRules };
  }

  public recordObservation(
    ruleId: string,
    description: string,
    conditionType: 'TECHNICAL' | 'NEWS' | 'SOCIAL' | 'HYBRID',
    pattern: string,
    source: string,
    isSuccessful: boolean
  ): LearningRule {
    let rule = this.ruleStore.getRule(ruleId);

    if (!rule) {
      // Create new Hypothesis
      rule = {
        id: ruleId,
        description,
        conditionType,
        pattern,
        confidenceBonus: 0,
        observationCount: 1,
        independentSources: [this.sanitizeSource(source)],
        regimesSeen: [this.currentRegime],
        tier: RuleTier.HYPOTHESIS,
        successCount: isSuccessful ? 1 : 0,
        failCount: isSuccessful ? 0 : 1,
        successRate: isSuccessful ? 1.0 : 0.0,
        recentTradeOutcomes: [isSuccessful],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      this.ruleStore.setRule(rule);
      this.publishRuleEvent(rule, 'CREATED');
      return rule;
    }

    // Update existing rule
    rule.observationCount += 1;
    if (isSuccessful) rule.successCount += 1;
    else rule.failCount += 1;

    rule.successRate = rule.successCount / (rule.observationCount || 1);

    const cleanSrc = this.sanitizeSource(source);
    if (!rule.independentSources.includes(cleanSrc)) {
      rule.independentSources.push(cleanSrc);
    }

    if (!rule.regimesSeen.includes(this.currentRegime)) {
      rule.regimesSeen.push(this.currentRegime);
    }

    rule.recentTradeOutcomes.push(isSuccessful);
    if (rule.recentTradeOutcomes.length > 20) {
      rule.recentTradeOutcomes.shift();
    }

    rule.lastUpdated = new Date().toISOString();

    // Check for promotion or decay
    this.evaluateRuleTier(rule);

    this.ruleStore.setRule(rule);
    return rule;
  }

  public evaluateRuleTier(rule: LearningRule): void {
    const recentWins = rule.recentTradeOutcomes.filter(Boolean).length;
    const recentRate = rule.recentTradeOutcomes.length > 0 ? recentWins / rule.recentTradeOutcomes.length : rule.successRate;

    const prevTier = rule.tier;

    // 1. Decay Check (if last outcomes are bad)
    if (rule.recentTradeOutcomes.length >= 8 && recentRate < 0.45) {
      if (rule.tier === RuleTier.STRONG_RULE) {
        rule.tier = RuleTier.WEAK_RULE;
        rule.confidenceBonus = 8;
        this.publishRuleEvent(rule, 'DECAYED');
        logger.warn(`🔻 [LearningEngine] Rule "${rule.id}" decayed from STRONG_RULE to WEAK_RULE due to low recent win rate (${Math.round(recentRate * 100)}%)`);
        return;
      } else if (rule.tier === RuleTier.WEAK_RULE) {
        rule.tier = RuleTier.HYPOTHESIS;
        rule.confidenceBonus = 0;
        this.publishRuleEvent(rule, 'DECAYED');
        logger.warn(`🔻 [LearningEngine] Rule "${rule.id}" decayed from WEAK_RULE to HYPOTHESIS`);
        return;
      }
    }

    // 2. Promotion to STRONG_RULE
    // Conditions: >= 15 observations, >= 2 distinct regimes, >= 70% success rate
    if (
      rule.observationCount >= 15 &&
      rule.regimesSeen.length >= 2 &&
      rule.successRate >= 0.70 &&
      rule.independentSources.length >= 4
    ) {
      if (rule.tier !== RuleTier.STRONG_RULE) {
        rule.tier = RuleTier.STRONG_RULE;
        rule.confidenceBonus = 20;
        this.publishRuleEvent(rule, 'PROMOTED');
        logger.info(`🌟 [LearningEngine] Rule "${rule.id}" PROMOTED to STRONG_RULE! (Observations: ${rule.observationCount}, Regimes: [${rule.regimesSeen.join(', ')}], WinRate: ${Math.round(rule.successRate * 100)}%)`);
        return;
      }
    }

    // 3. Promotion to WEAK_RULE
    // Conditions: >= 4 observations, >= 4 independent sources, >= 60% success rate
    if (
      rule.observationCount >= 4 &&
      rule.independentSources.length >= 4 &&
      rule.successRate >= 0.60
    ) {
      if (rule.tier === RuleTier.HYPOTHESIS) {
        rule.tier = RuleTier.WEAK_RULE;
        rule.confidenceBonus = 8;
        this.publishRuleEvent(rule, 'PROMOTED');
        logger.info(`⭐ [LearningEngine] Rule "${rule.id}" PROMOTED to WEAK_RULE! (Sources: ${rule.independentSources.length}, WinRate: ${Math.round(rule.successRate * 100)}%)`);
        return;
      }
    }
  }

  public getAllRules(): LearningRule[] {
    return this.ruleStore.getAllRules();
  }

  public getRule(id: string): LearningRule | undefined {
    return this.ruleStore.getRule(id);
  }

  private sanitizeSource(source: string): string {
    return source.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
  }

  private publishRuleEvent(rule: LearningRule, action: 'PROMOTED' | 'DEMOTED' | 'DECAYED' | 'CREATED'): void {
    eventBus.publish(EventType.LEARNING_RULE_UPDATED, {
      ruleId: rule.id,
      description: rule.description,
      tier: rule.tier,
      confidenceBonus: rule.confidenceBonus,
      observationCount: rule.observationCount,
      regimesSeen: rule.regimesSeen,
      action,
      timestamp: new Date().toISOString(),
    });
  }
}
