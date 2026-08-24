import fs from 'fs';
import path from 'path';
import { KeywordsManager } from '../src/services/news/KeywordsManager.js';

describe('KeywordsManager', () => {
  const testFilePath = path.join(__dirname, 'test_keywords.json');

  afterEach(() => {
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  it('should load default categories when file does not exist', () => {
    const manager = new KeywordsManager(testFilePath);
    const categories = manager.getCategories();

    expect(categories).toHaveProperty('defcon_1');
    expect(categories).toHaveProperty('crypto_specific');
    expect(categories.defcon_1.strength).toBe(1.0);
  });

  it('should accurately categorize high-impact geopolitical / defcon news', () => {
    const manager = new KeywordsManager(testFilePath);
    const result = manager.analyzeText(
      'Orta Doğu bölgesinde çatışma ve saldırı haberleri yayılıyor',
      'Piyasalarda panik satışları başladı'
    );

    expect(result.category).toBe('defcon_1');
    expect(result.strength).toBeGreaterThanOrEqual(1.0);
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
  });

  it('should accurately categorize crypto specific news', () => {
    const manager = new KeywordsManager(testFilePath);
    const result = manager.analyzeText(
      'Bitcoin ve Ethereum için yeni ETF onayı geldi',
      'Blockchain teknolojisi kurumsal alanda genişliyor'
    );

    expect(result.category).toBe('crypto_specific');
    expect(result.strength).toBeGreaterThanOrEqual(0.9);
  });

  it('should allow dynamic runtime keyword addition and persist', () => {
    const manager = new KeywordsManager(testFilePath);
    manager.addKeywords('custom_risk', ['likidite krizi', 'banka batığı'], 0.95, 'Özel Likidite Riski');

    const updated = manager.getCategories();
    expect(updated).toHaveProperty('custom_risk');
    expect(updated.custom_risk.keywords).toContain('likidite krizi');

    const result = manager.analyzeText('Büyük bir bankada likidite krizi baş gösterdi', '');
    expect(result.category).toBe('custom_risk');
    expect(result.strength).toBeGreaterThanOrEqual(0.95);
  });
});
