import Parser from 'rss-parser';
import { RawNewsItem } from '../../types/news.js';
import { RSS_FEED_URLS } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

const COIN_MAP: Record<string, string> = {
  bitcoin: 'BTC',
  btc: 'BTC',
  ethereum: 'ETH',
  eth: 'ETH',
  solana: 'SOL',
  sol: 'SOL',
  binance: 'BNB',
  bnb: 'BNB',
  ripple: 'XRP',
  xrp: 'XRP',
  cardano: 'ADA',
  ada: 'ADA',
  dogecoin: 'DOGE',
  doge: 'DOGE',
  avalanche: 'AVAX',
  avax: 'AVAX',
  chainlink: 'LINK',
  link: 'LINK',
  polkadot: 'DOT',
  dot: 'DOT',
};

export class NewsFetcher {
  private parser: Parser;
  private feedUrls: string[];
  private seenNewsIds = new Set<string>();

  constructor(feedUrls = RSS_FEED_URLS) {
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CryptoAgent/1.0',
      },
    });
    this.feedUrls = feedUrls;
  }

  public async fetchLatestNews(): Promise<RawNewsItem[]> {
    const fetchedItems: RawNewsItem[] = [];

    for (const url of this.feedUrls) {
      try {
        const feed = await this.parser.parseURL(url);
        const sourceName = new URL(url).hostname.replace('www.', '');

        if (feed.items) {
          for (const item of feed.items.slice(0, 10)) {
            const title = (item.title || '').trim();
            const summary = (item.contentSnippet || item.content || item.summary || '').trim();
            const link = item.link || '';
            const published = item.pubDate || item.isoDate || new Date().toISOString();

            if (!title) continue;

            const id = `${title}_${sourceName}`;
            if (this.seenNewsIds.has(id)) {
              continue;
            }

            this.seenNewsIds.add(id);
            // Cap memory usage of seen ids
            if (this.seenNewsIds.size > 2000) {
              const iter = this.seenNewsIds.values();
              for (let i = 0; i < 500; i++) {
                this.seenNewsIds.delete(iter.next().value!);
              }
            }

            fetchedItems.push({
              title,
              summary,
              link,
              source: sourceName,
              published,
            });
          }
        }
      } catch (err) {
        logger.warn(`⚠️ Failed to fetch RSS feed (${url}): ${(err as Error).message}`);
      }
    }

    return fetchedItems;
  }

  public extractCoinSymbols(title: string, summary: string): string[] {
    const text = `${title} ${summary}`.toLowerCase();
    const symbols = new Set<string>();

    for (const [term, symbol] of Object.entries(COIN_MAP)) {
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      if (regex.test(text)) {
        symbols.add(symbol);
      }
    }

    // Default to BTC if no specific coin found
    if (symbols.size === 0) {
      symbols.add('BTC');
    }

    return Array.from(symbols);
  }
}
