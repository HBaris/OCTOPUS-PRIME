import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export interface CryptoPanicPost {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  currencies: string[];
  votes?: {
    positive: number;
    negative: number;
    important: number;
    liked: number;
  };
}

export class CryptoPanicClient {
  private apiKey: string;
  private baseUrl: string = 'https://cryptopanic.com/api/v1/posts/';

  constructor(apiKey: string = config.CRYPTOPANIC_API_KEY) {
    this.apiKey = apiKey;
  }

  public async fetchLatestPosts(): Promise<CryptoPanicPost[]> {
    if (!this.apiKey) {
      // Return simulated rapid news posts if no API key is provided
      return this.generateSimulatedFastPosts();
    }

    try {
      const url = `${this.baseUrl}?auth_token=${encodeURIComponent(this.apiKey)}&public=true&filter=hot`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      if (data && Array.isArray(data.results)) {
        return data.results.map((item: any) => ({
          id: `cp_${item.id}`,
          title: item.title,
          url: item.url,
          source: item.source?.title || 'CryptoPanic',
          publishedAt: item.published_at || new Date().toISOString(),
          currencies: (item.currencies || []).map((c: any) => c.code),
          votes: item.votes,
        }));
      }
      return [];
    } catch (err) {
      logger.warn('⚠️ [CryptoPanicClient] API request failed, falling back to simulated stream:', (err as Error).message);
      return this.generateSimulatedFastPosts();
    }
  }

  private generateSimulatedFastPosts(): CryptoPanicPost[] {
    const templates = [
      {
        title: 'Binance Futures lists new high-frequency perpetual contract with isolated margin',
        coins: ['BTC', 'ETH'],
        source: 'Binance Announcements',
      },
      {
        title: 'Institutional inflows reach record weekly highs across spot crypto instruments',
        coins: ['BTC', 'SOL'],
        source: 'CoinDesk Instant',
      },
      {
        title: 'Federal Reserve liquidity report indicates favorable macro environment for risk assets',
        coins: ['BTC'],
        source: 'Bloomberg Fast',
      },
    ];

    const pick = templates[Math.floor(Math.random() * templates.length)];
    return [
      {
        id: `cp_sim_${Date.now()}`,
        title: pick.title,
        url: 'https://cryptopanic.com',
        source: pick.source,
        publishedAt: new Date().toISOString(),
        currencies: pick.coins,
        votes: { positive: 45, negative: 3, important: 28, liked: 19 },
      },
    ];
  }
}
