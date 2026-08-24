import { formatSignalDialogue } from '../src/utils/signalDialogue.js';

describe('Signal Dialogue Formatter (Ali - Sinyal Avcısı)', () => {
  it('should return null (silent) when action is HOLD', () => {
    const result = formatSignalDialogue({
      symbol: 'BTC/USDT',
      action: 'HOLD',
      signalScore: 75,
      reasoning: 'Market is sideways',
    });
    expect(result).toBeNull();
  });

  it('should return null (silent) when signalScore is below 60', () => {
    const result = formatSignalDialogue({
      symbol: 'ETH/USDT',
      action: 'BUY',
      signalScore: 54,
      reasoning: 'Weak momentum',
    });
    expect(result).toBeNull();
  });

  it('should format BUY with crypto_specific / positive news accurately', () => {
    const result = formatSignalDialogue({
      symbol: 'SOL/USDT',
      action: 'BUY',
      signalScore: 72,
      category: 'crypto_specific',
      sentimentLabel: 'POSITIVE',
    });
    expect(result).toBe('SOL için güçlü haber var Kaptan, gözüm üstünde! 👀');
  });

  it('should format high confidence BUY (score >= 80) with excitement', () => {
    const result = formatSignalDialogue({
      symbol: 'BTC/USDT',
      action: 'BUY',
      signalScore: 85,
    });
    expect(result).toBe('BTC için çok güçlü alım sinyali var Kaptan, kaçırmayalım! 🔥');
  });

  it('should format SELL with negative sentiment / high score as warning', () => {
    const result = formatSignalDialogue({
      symbol: 'ETH/USDT',
      action: 'SELL',
      signalScore: 82,
      sentimentLabel: 'NEGATIVE',
    });
    expect(result).toBe('ETH tarafında sert baskı var Kaptan, dikkatli olalım! ⚠️');
  });

  it('should format standard SELL as cautionary remark', () => {
    const result = formatSignalDialogue({
      symbol: 'BTC/USDT',
      action: 'SELL',
      signalScore: 68,
    });
    expect(result).toBe('BTC için rüzgar tersine döndü, tedbirli olalım. 📉');
  });
});
