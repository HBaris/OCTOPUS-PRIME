import { SentimentAnalyzer } from '../src/services/news/SentimentAnalyzer.js';
import { SentimentLabel } from '../src/config/constants.js';

describe('SentimentAnalyzer', () => {
  let analyzer: SentimentAnalyzer;

  beforeAll(() => {
    analyzer = new SentimentAnalyzer();
  });

  it('should detect positive sentiment in English and Turkish headlines', async () => {
    const resEn = await analyzer.analyze('Bitcoin surges to new record high with massive adoption');
    expect(resEn.label).toBe(SentimentLabel.POSITIVE);
    expect(resEn.score).toBeGreaterThan(0.6);

    const resTr = await analyzer.analyze('Kripto piyasasında büyük yükseliş ve rekor kazanç dalgası');
    expect(resTr.label).toBe(SentimentLabel.POSITIVE);
    expect(resTr.score).toBeGreaterThan(0.6);
  });

  it('should detect negative sentiment in crash / crisis headlines', async () => {
    const resEn = await analyzer.analyze('Major crypto exchange faces hack and liquidation collapse');
    expect(resEn.label).toBe(SentimentLabel.NEGATIVE);
    expect(resEn.score).toBeGreaterThan(0.6);

    const resTr = await analyzer.analyze('Piyasalarda sert düşüş ve panik satışı başladı');
    expect(resTr.label).toBe(SentimentLabel.NEGATIVE);
    expect(resTr.score).toBeGreaterThan(0.6);
  });

  it('should detect neutral sentiment for balanced or empty text', async () => {
    const res = await analyzer.analyze('Federal Reserve held standard monthly meeting');
    expect(res.label).toBe(SentimentLabel.NEUTRAL);
  });
});
