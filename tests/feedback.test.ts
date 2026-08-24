import fs from 'fs';
import path from 'path';
import { FeedbackSystem } from '../src/services/feedback/FeedbackSystem.js';
import { FeedbackEmoji, EventType } from '../src/config/constants.js';
import { eventBus } from '../src/events/EventBus.js';

describe('FeedbackSystem', () => {
  const testFile = path.join(__dirname, 'test_feedback.json');
  let fb: FeedbackSystem;

  beforeEach(() => {
    fb = new FeedbackSystem(testFile);
  });

  afterEach(() => {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  });

  it('should record user emoji reactions and emit FEEDBACK_RECEIVED', () => {
    let capturedEvent: any = null;
    eventBus.once(EventType.FEEDBACK_RECEIVED, (evt) => {
      capturedEvent = evt;
    });

    const recorded = fb.recordFeedback('sig_123', FeedbackEmoji.ACCURATE, 'Mükemmel sinyal');
    expect(recorded.meaning).toBe('accurate');
    expect(recorded.emoji).toBe(FeedbackEmoji.ACCURATE);

    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.payload.targetId).toBe('sig_123');
  });

  it('should calculate accuracy and false alarm rates', () => {
    fb.recordFeedback('sig_1', FeedbackEmoji.ACCURATE);
    fb.recordFeedback('sig_2', FeedbackEmoji.ACTIONABLE);
    fb.recordFeedback('sig_3', FeedbackEmoji.FALSE_ALARM);

    const stats = fb.analyzeFeedback();
    expect(stats.totalFeedbackCount).toBe(3);
    expect(stats.accuracyRate).toBeCloseTo(0.67, 1);
    expect(stats.falseAlarmRate).toBeCloseTo(0.33, 1);
    expect(fb.getAdaptiveWeightMultiplier()).toBeDefined();
  });
});
