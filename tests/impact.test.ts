import { ImpactScorer } from '../src/services/impact/ImpactScorer.js';
import { SceneSeverity, EventType } from '../src/config/constants.js';
import { eventBus } from '../src/events/EventBus.js';

describe('ImpactScorer', () => {
  let scorer: ImpactScorer;

  beforeEach(() => {
    scorer = new ImpactScorer();
  });

  it('should score DEFCON_1 events with high impact score and KATASTROFIK or COK_AGIR severity', () => {
    let capturedEvent: any = null;
    eventBus.once(EventType.SCENE_SEVERITY_UPDATE, (evt) => {
      capturedEvent = evt;
    });

    const result = scorer.calculateImpact(
      'Global ölçekte beklenmeyen savaş ilanı ve finansal piyasaların çöküşü',
      'defcon_1',
      1.0,
      0.95,
      { btc: -0.9, stocks: -0.85, gold: 0.9, oil: 0.8 }
    );

    expect(result.impactScore).toBeGreaterThanOrEqual(7.0);
    expect([SceneSeverity.KATASTROFIK, SceneSeverity.COK_AGIR]).toContain(result.severityLabel);
    expect(result.top3Assets.length).toBe(3);
    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.payload.severityLabel).toBe(result.severityLabel);
  });

  it('should score normal low-impact events as HAFIF or ORTA', () => {
    const result = scorer.calculateImpact(
      'Kripto topluluğunda haftalık rutin geliştirici güncellemesi yapıldı',
      'NORMAL',
      0.2,
      0.5,
      { btc: 0.1 }
    );

    expect(result.impactScore).toBeLessThan(5.0);
    expect([SceneSeverity.HAFIF, SceneSeverity.ORTA]).toContain(result.severityLabel);
  });
});
