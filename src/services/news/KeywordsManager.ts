import fs from 'fs';
import path from 'path';
import { KeywordsMap, KeywordCategoryConfig } from '../../types/news.js';
import { logger } from '../../utils/logger.js';

export class KeywordsManager {
  private keywordsFilePath: string;
  private categories: KeywordsMap = {};

  constructor(filePath = 'keywords.json') {
    this.keywordsFilePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
    this.loadKeywords();
  }

  public loadKeywords(): void {
    try {
      if (fs.existsSync(this.keywordsFilePath)) {
        const raw = fs.readFileSync(this.keywordsFilePath, 'utf-8');
        this.categories = JSON.parse(raw);
        logger.info(`✅ Loaded ${Object.keys(this.categories).length} keyword categories from ${this.keywordsFilePath}`);
      } else {
        logger.warn(`⚠️ Keywords file not found at ${this.keywordsFilePath}. Creating default template.`);
        this.categories = this.getDefaultCategories();
        this.saveKeywords();
      }
    } catch (err) {
      logger.error('❌ Error reading keywords.json:', err);
      this.categories = this.getDefaultCategories();
    }
  }

  public saveKeywords(): void {
    try {
      fs.writeFileSync(this.keywordsFilePath, JSON.stringify(this.categories, null, 2), 'utf-8');
      logger.info('✅ Saved keywords to keywords.json');
    } catch (err) {
      logger.error('❌ Failed to save keywords.json:', err);
    }
  }

  public getCategories(): KeywordsMap {
    return { ...this.categories };
  }

  public addKeywords(category: string, newKeywords: string[], strength = 0.8, description = 'Dinamik eklendi'): void {
    if (!this.categories[category]) {
      this.categories[category] = {
        keywords: [],
        strength,
        description,
      };
    }

    for (const kw of newKeywords) {
      const lower = kw.toLowerCase().trim();
      if (!this.categories[category].keywords.includes(lower)) {
        this.categories[category].keywords.push(lower);
      }
    }

    this.saveKeywords();
  }

  public analyzeText(title: string, summary: string): { category: string; strength: number; matchedKeywords: string[] } {
    const text = `${title} ${summary}`.toLowerCase();

    let highestCategory = 'NORMAL';
    let highestStrength = 0;
    let bestMatches: string[] = [];

    for (const [category, config] of Object.entries(this.categories)) {
      const matched = config.keywords.filter((kw) => text.includes(kw.toLowerCase()));
      const matchCount = matched.length;

      if (matchCount > 0) {
        // Boost strength according to number of keyword matches
        const categoryStrength = config.strength * (1 + (matchCount - 1) * 0.15);

        if (categoryStrength > highestStrength) {
          highestStrength = categoryStrength;
          highestCategory = category;
          bestMatches = matched;
        }
      }
    }

    return {
      category: highestCategory,
      strength: Math.min(highestStrength, 1.0),
      matchedKeywords: bestMatches,
    };
  }

  private getDefaultCategories(): KeywordsMap {
    return {
      defcon_1: {
        keywords: ['savaş', 'çatışma', 'vuruldu', 'saldırı', 'çöküş', 'darbe', 'nükleer', 'war', 'attack', 'crash', 'collapse'],
        strength: 1.0,
        description: 'Finansal pazarı tamamen çöktürecek olaylar',
      },
      defcon_2: {
        keywords: ['fed faiz artış', 'merkez bankası', 'enflasyon', 'durgunluk', 'recession', 'rate hike', 'systemic risk'],
        strength: 0.85,
        description: 'Piyasaya orta/yüksek seviye etki',
      },
      crypto_specific: {
        keywords: ['bitcoin', 'ethereum', 'kripto', 'blockchain', 'sec', 'binance', 'crypto', 'etf', 'halving', 'liquidation'],
        strength: 0.9,
        description: 'Kripto pazarına özel etkiler',
      },
      oil_sensitive: {
        keywords: ['petrol', 'opec', 'enerji', 'ambargo', 'oil', 'crude', 'energy crisis'],
        strength: 0.8,
        description: 'Petrol ve enerji fiyatlarını etkiler',
      },
      geopolitical: {
        keywords: ['jeopolitik', 'ticaret savaşı', 'tarife', 'yaptırım', 'sanction', 'geopolitical', 'tariff'],
        strength: 0.75,
        description: 'Uluslararası gerilimler',
      },
      gold_flight: {
        keywords: ['altın', 'güvenli liman', 'safe haven', 'gold', 'volatilite', 'risk off'],
        strength: 0.7,
        description: 'Altın ve güvenli varlık akışı',
      },
    };
  }
}
