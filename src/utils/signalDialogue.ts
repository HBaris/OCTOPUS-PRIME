export interface SignalDialogueInput {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  signalScore: number;
  category?: string;
  sentimentLabel?: string;
  reasoning?: string;
}

/**
 * Translates signal metrics into natural, friendly office dialogue for "Ali" (Sinyal Avcısı).
 * Returns null if the action is HOLD or signal score is below 60 to keep screen clean.
 */
export function formatSignalDialogue(input: SignalDialogueInput): string | null {
  const { symbol, action, signalScore, category, sentimentLabel, reasoning } = input;

  // 1. Silent condition: HOLD or score < 60
  if (action === 'HOLD' || signalScore < 60) {
    return null;
  }

  const cleanSymbol = symbol.includes('/') ? symbol.split('/')[0] : symbol;
  const lowerReasoning = (reasoning || '').toLowerCase();
  
  const isCryptoSpecific = category === 'crypto_specific' || lowerReasoning.includes('crypto') || lowerReasoning.includes('kripto');
  const isPositive = sentimentLabel === 'POSITIVE' || lowerReasoning.includes('pozitif') || lowerReasoning.includes('yükseliş') || lowerReasoning.includes('rally');
  const isNegative = sentimentLabel === 'NEGATIVE' || lowerReasoning.includes('negatif') || lowerReasoning.includes('düşüş') || lowerReasoning.includes('baskı') || lowerReasoning.includes('crash');

  // 2. BUY Dialogues
  if (action === 'BUY') {
    if (signalScore >= 80) {
      return `${cleanSymbol} için çok güçlü alım sinyali var Kaptan, kaçırmayalım! 🔥`;
    }
    if (isCryptoSpecific || isPositive) {
      return `${cleanSymbol} için güçlü haber var Kaptan, gözüm üstünde! 👀`;
    }
    return `${cleanSymbol} tarafında alım fırsatı kokusu alıyorum! 🚀`;
  }

  // 3. SELL Dialogues
  if (action === 'SELL') {
    if (signalScore >= 80 || isNegative) {
      return `${cleanSymbol} tarafında sert baskı var Kaptan, dikkatli olalım! ⚠️`;
    }
    return `${cleanSymbol} için rüzgar tersine döndü, tedbirli olalım. 📉`;
  }

  return null;
}
