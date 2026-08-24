export interface DecisionWeights {
  newsImpactWeight: number;       // default e.g. 0.35
  sentimentWeight: number;        // default e.g. 0.25
  priceMomentumWeight: number;    // default e.g. 0.25
  correlationWeight: number;      // default e.g. 0.15
}

export interface TradingSignal {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  signalScore: number; // 0 - 100
  confidence: number;  // 0 - 1
  breakdown: {
    newsImpactScore: number;
    sentimentScore: number;
    priceMomentumScore: number;
    correlationScore: number;
    feedbackWeightMultiplier: number;
  };
  reasoning: string;
  currentPrice: number;
  timestamp: string;
  status: 'PROPOSED' | 'EVALUATED' | 'IGNORED';
  outcome15mChecked?: boolean;
  actualPrice15mLater?: number;
  priceChange15mPercent?: number;
}
