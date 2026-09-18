import path from 'path';
import fs from 'fs';
import { LearningEngine } from '../src/services/learning/LearningEngine.js';
import { RuleStore } from '../src/services/learning/RuleStore.js';
import { RuleTier, MarketRegime } from '../src/config/constants.js';

describe('LearningEngine (Multi-Tier Rules & Regime Tracking)', () => {
  const testRulesFile = path.join(__dirname, 'test_rules_learning.json');
  let store: RuleStore;
  let engine: LearningEngine;

  beforeEach(() => {
    if (fs.existsSync(testRulesFile)) fs.unlinkSync(testRulesFile);
    store = new RuleStore(testRulesFile);
    engine = new LearningEngine(store);
  });

  afterEach(() => {
    if (fs.existsSync(testRulesFile)) fs.unlinkSync(testRulesFile);
  });

  test('should create new rule as HYPOTHESIS with 0% confidence bonus', () => {
    const rule = engine.recordObservation(
      'rule_test_1',
      'Test Pattern 1',
      'TECHNICAL',
      'EMA_BULLISH+VOL_SPIKE',
      'chart_ws',
      true
    );

    expect(rule.tier).toBe(RuleTier.HYPOTHESIS);
    expect(rule.confidenceBonus).toBe(0);
    expect(rule.observationCount).toBe(1);
    expect(rule.independentSources).toContain('chart_ws');
  });

  test('should promote HYPOTHESIS to WEAK_RULE when 4+ observations from 4 distinct sources have >=60% win rate', () => {
    engine.recordObservation('rule_test_2', 'Pattern 2', 'HYBRID', 'P2', 'src_a', true);
    engine.recordObservation('rule_test_2', 'Pattern 2', 'HYBRID', 'P2', 'src_b', true);
    engine.recordObservation('rule_test_2', 'Pattern 2', 'HYBRID', 'P2', 'src_c', true);
    const rule = engine.recordObservation('rule_test_2', 'Pattern 2', 'HYBRID', 'P2', 'src_d', true);

    expect(rule.observationCount).toBe(4);
    expect(rule.independentSources.length).toBe(4);
    expect(rule.tier).toBe(RuleTier.WEAK_RULE);
    expect(rule.confidenceBonus).toBe(8);
  });

  test('should NOT promote to STRONG_RULE if verified in only 1 market regime', () => {
    engine.setMarketRegime(MarketRegime.BULL);

    // 16 winning observations, all in BULL regime
    for (let i = 0; i < 16; i++) {
      engine.recordObservation('rule_test_3', 'Pattern 3', 'HYBRID', 'P3', `source_${i % 5}`, true);
    }

    const rule = engine.getRule('rule_test_3');
    expect(rule?.observationCount).toBe(16);
    expect(rule?.regimesSeen.length).toBe(1);
    // Cannot be STRONG_RULE because only 1 regime
    expect(rule?.tier).toBe(RuleTier.WEAK_RULE);
  });

  test('should promote to STRONG_RULE when verified in 2+ market regimes with 15+ observations', () => {
    // 10 observations in BULL
    engine.setMarketRegime(MarketRegime.BULL);
    for (let i = 0; i < 10; i++) {
      engine.recordObservation('rule_test_4', 'Pattern 4', 'HYBRID', 'P4', `source_${i % 5}`, true);
    }

    // 6 observations in BEAR
    engine.setMarketRegime(MarketRegime.BEAR);
    for (let i = 10; i < 16; i++) {
      engine.recordObservation('rule_test_4', 'Pattern 4', 'HYBRID', 'P4', `source_${i % 5}`, true);
    }

    const rule = engine.getRule('rule_test_4');
    expect(rule?.observationCount).toBe(16);
    expect(rule?.regimesSeen.length).toBe(2);
    expect(rule?.regimesSeen).toContain(MarketRegime.BULL);
    expect(rule?.regimesSeen).toContain(MarketRegime.BEAR);
    expect(rule?.tier).toBe(RuleTier.STRONG_RULE);
    expect(rule?.confidenceBonus).toBe(20);
  });

  test('should decay STRONG_RULE to WEAK_RULE when recent trade success rate drops below 45%', () => {
    // Set up strong rule
    engine.setMarketRegime(MarketRegime.BULL);
    for (let i = 0; i < 10; i++) {
      engine.recordObservation('rule_test_5', 'Pattern 5', 'HYBRID', 'P5', `src_${i % 4}`, true);
    }
    engine.setMarketRegime(MarketRegime.SIDEWAYS);
    for (let i = 0; i < 6; i++) {
      engine.recordObservation('rule_test_5', 'Pattern 5', 'HYBRID', 'P5', `src_${i % 4}`, true);
    }

    let rule = engine.getRule('rule_test_5');
    expect(rule?.tier).toBe(RuleTier.STRONG_RULE);

    // Now inject 12 consecutive failures (so recent win rate drops to 40%)
    for (let i = 0; i < 12; i++) {
      rule = engine.recordObservation('rule_test_5', 'Pattern 5', 'HYBRID', 'P5', `src_${i % 4}`, false);
    }

    expect(rule?.tier).toBe(RuleTier.WEAK_RULE);
  });
});
