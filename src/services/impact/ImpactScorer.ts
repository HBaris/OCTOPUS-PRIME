import { SceneSeverity, EventType } from '../../config/constants.js';
import { ImpactScoringResult } from '../../types/news.js';
import { eventBus } from '../../events/EventBus.js';
import { logger } from '../../utils/logger.js';

export class ImpactScorer {
  private categoryMultipliers: Record<string, number> = {
    defcon_1: 1.0,
    defcon_2: 0.85,
    crypto_specific: 0.90,
    oil_sensitive: 0.75,
    geopolitical: 0.80,
    gold_flight: 0.70,
    NORMAL: 0.40,
  };

  public calculateImpact(
    title: string,
    category: string,
    categoryStrength: number,
    sentimentConfidence: number,
    correlatedAssets: Record<string, number> = { btc: 0.8, eth: 0.7, sol: 0.6 }
  ): ImpactScoringResult {
    // Base strength combining keyword strength and sentiment confidence
    const baseScore = (categoryStrength * 0.6 + sentimentConfidence * 0.4) * 10;
    const catMultiplier = this.categoryMultipliers[category] ?? 0.5;
    
    // Check how many assets are strongly affected (> 0.4 correlation)
    const strongCorrelations = Object.values(correlatedAssets).filter((val) => Math.abs(val) >= 0.4);
    const multiplicityBonus = 1 + (strongCorrelations.length * 0.08);

    const calculatedImpact = Math.min(baseScore * catMultiplier * multiplicityBonus, 10.0);
    const impactScore = Math.round(calculatedImpact * 10) / 10;

    const { severityLabel, severityEmoji, affectedMarkets } = this.determineSeverity(impactScore);

    // Top 3 affected assets sorted by absolute correlation
    const top3Assets = Object.entries(correlatedAssets)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 3)
      .map(([asset]) => asset.toUpperCase());

    const result: ImpactScoringResult = {
      impactScore,
      severityLabel,
      severityEmoji,
      affectedMarkets,
      top3Assets: top3Assets.length > 0 ? top3Assets : ['BTC', 'ETH', 'SOL'],
      confidence: Math.round(sentimentConfidence * 100) / 100,
    };

    // Emit event for Pixel Art Office atmosphere / lighting update
    eventBus.publish(EventType.SCENE_SEVERITY_UPDATE, {
      severityLabel: result.severityLabel,
      impactScore: result.impactScore,
      primaryReason: title.slice(0, 100),
      topAffectedAssets: result.top3Assets,
      timestamp: new Date().toISOString(),
    });

    logger.debug(`[ImpactScorer] Calculated impact=${impactScore}, severity=${severityLabel} for category=${category}`);

    return result;
  }

  private determineSeverity(score: number): {
    severityLabel: SceneSeverity;
    severityEmoji: string;
    affectedMarkets: string[];
  } {
    if (score >= 8.5) {
      return {
        severityLabel: SceneSeverity.KATASTROFIK,
        severityEmoji: '🚨',
        affectedMarkets: ['BTC', 'ETH', 'SOL', 'STOCKS', 'GOLD', 'OIL'],
      };
    } else if (score >= 7.0) {
      return {
        severityLabel: SceneSeverity.COK_AGIR,
        severityEmoji: '🔴',
        affectedMarkets: ['BTC', 'ETH', 'SOL', 'GOLD'],
      };
    } else if (score >= 5.0) {
      return {
        severityLabel: SceneSeverity.AGIR,
        severityEmoji: '🟠',
        affectedMarkets: ['BTC', 'ETH', 'SOL'],
      };
    } else if (score >= 3.0) {
      return {
        severityLabel: SceneSeverity.ORTA,
        severityEmoji: '🟡',
        affectedMarkets: ['BTC', 'ETH'],
      };
    } else {
      return {
        severityLabel: SceneSeverity.HAFIF,
        severityEmoji: '🟢',
        affectedMarkets: ['BTC'],
      };
    }
  }
}
