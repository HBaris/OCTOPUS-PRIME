import path from 'path';
import fs from 'fs';
import { DecisionEngine } from '../src/services/decision/DecisionEngine.js';
import { BinanceService } from '../src/services/binance/BinanceService.js';
import { CorrelationTracker } from '../src/services/correlation/CorrelationTracker.js';
import { FeedbackSystem } from '../src/services/feedback/FeedbackSystem.js';
import { EventType } from '../src/config/constants.js';
import { eventBus } from '../src/events/EventBus.js';

describe('DecisionEngine', () => {
  const corrFile = path.join(__dirname, 'test_dec_corr.json');
  const fbFile = path.join(__dirname, 'test_dec_fb.json');

  let binance: BinanceService;
  let corr: CorrelationTracker;
  let fb: FeedbackSystem;
  let engine: DecisionEngine;

  beforeEach(() => {
    binance = new BinanceService();
    corr = new CorrelationTracker(binance, corrFile);
    fb = new FeedbackSystem(fbFile);
    engine = new DecisionEngine(binance, corr, fb);
  });

  afterEach(() => {
    corr.stop();
    if (fs.existsSync(corrFile)) fs.unlinkSync(corrFile);
    if (fs.existsSync(fbFile)) fs.unlinkSync(fbFile);
  });

  it('should generate a BUY signal and TRADE_PROPOSAL when positive news impact is high', async () => {
    let capturedProposal: any = null;
    eventBus.once(EventType.TRADE_PROPOSAL, (evt) => {
      capturedProposal = evt;
    });

    const signal = await engine.evaluateNewsSignal(
      'BTC',
      9.5,
      'POSITIVE',
      0.95,
      'Bitcoin ETF onayı resmileşti ve devasa kurumsal girişler başladı',
      'crypto_specific'
    );

    expect(signal).not.toBeNull();
    expect(signal?.signalScore).toBeGreaterThanOrEqual(70);
    expect(signal?.action).toBe('BUY');
    expect(signal?.breakdown).toHaveProperty('newsImpactScore');
    expect(capturedProposal).not.toBeNull();
    expect(capturedProposal.payload.side).toBe('BUY');
    expect(capturedProposal.payload.isDryRun).toBe(true);
    expect(capturedProposal.payload.sourceCategory).toBe('crypto_specific');
    expect(capturedProposal.payload.suggestedStopLoss).toBeGreaterThan(0);
    expect(capturedProposal.payload.suggestedTakeProfit).toBeGreaterThan(0);
  });

  it('should generate a HOLD signal when news impact is low', async () => {
    const signal = await engine.evaluateNewsSignal(
      'BTC',
      1.5,
      'NEUTRAL',
      0.4,
      'Piyasada sakin bir gün geçiriliyor',
      'NORMAL'
    );

    expect(signal).not.toBeNull();
    expect(signal?.action).toBe('HOLD');
  });
});
