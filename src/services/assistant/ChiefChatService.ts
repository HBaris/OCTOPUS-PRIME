import { AltcoinScannerService } from '../market/AltcoinScannerService.js';
import { AutoTradeEngine } from '../decision/AutoTradeEngine.js';
import { EarlyLeakScannerService } from '../intelligence/EarlyLeakScannerService.js';
import { TechnicalAnalysisService } from '../analysis/TechnicalAnalysisService.js';
import { LearningEngine } from '../learning/LearningEngine.js';
import { IExchangeService } from '../exchange/IExchangeService.js';
import { NewsRadar } from '../news/NewsRadar.js';

export interface ChatReply {
  chiefName: string;
  chiefRole: string;
  avatarIcon: string;
  message: string;
  actionTaken?: string;
  metrics?: Record<string, any>;
  timestamp: string;
}

export class ChiefChatService {
  private altcoinScanner: AltcoinScannerService;
  private autoTradeEngine: AutoTradeEngine;
  private earlyLeakScanner: EarlyLeakScannerService;
  private technicalAnalysis: TechnicalAnalysisService;
  private learningEngine: LearningEngine;
  private exchangeService: IExchangeService;
  private newsRadar: NewsRadar;

  constructor(deps: {
    altcoinScanner: AltcoinScannerService;
    autoTradeEngine: AutoTradeEngine;
    earlyLeakScanner: EarlyLeakScannerService;
    technicalAnalysis: TechnicalAnalysisService;
    learningEngine: LearningEngine;
    exchangeService: IExchangeService;
    newsRadar: NewsRadar;
  }) {
    this.altcoinScanner = deps.altcoinScanner;
    this.autoTradeEngine = deps.autoTradeEngine;
    this.earlyLeakScanner = deps.earlyLeakScanner;
    this.technicalAnalysis = deps.technicalAnalysis;
    this.learningEngine = deps.learningEngine;
    this.exchangeService = deps.exchangeService;
    this.newsRadar = deps.newsRadar;
  }

  public async chatWithChief(roomId: string, rawMessage: string): Promise<ChatReply> {
    const text = rawMessage.toLowerCase().trim();
    const normalized = text
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ş/g, 's')
      .replace(/ü/g, 'u');

    switch (roomId) {
      case 'scanner':
        return this.chatWithScannerChief(normalized, rawMessage);
      case 'scalp':
        return this.chatWithScalpChief(normalized, rawMessage);
      case 'intelligence':
        return this.chatWithIntelligenceChief(normalized, rawMessage);
      case 'technical':
        return this.chatWithTechnicalChief(normalized, rawMessage);
      case 'news':
        return this.chatWithNewsChief(normalized, rawMessage);
      default:
        return this.chatWithScalpChief(normalized, rawMessage);
    }
  }

  // --- 1. PİYASA RADARI ŞEFİ ---
  private chatWithScannerChief(norm: string, raw: string): ChatReply {
    const radar = this.altcoinScanner.getRadarList();
    const top = radar.slice(0, 3);

    if (norm.includes('naptin') || norm.includes('ne yaptin') || norm.includes('durum') || norm.includes('ne var')) {
      const topSymbols = top.map((t) => `${t.symbol} (RSI: ${t.rsi14}, Skor: ${t.momentumScore})`).join(', ');
      return {
        chiefName: 'Piyasa Radarı Şefi',
        chiefRole: '1. Oda - Dinamik Piyasa Tarayıcısı',
        avatarIcon: '🌐',
        message: `Selam Barış! 300'den fazla USDT çiftini 7/24 tarıyorum. Şu an radarımdaki en sıcak hareketlilik: ${topSymbols || 'Piyasa sakin, taranıyor.'}. Hacim patlaması yakaladığım an Scalper ekibine paslıyorum!`,
        timestamp: new Date().toISOString(),
      };
    }

    if (norm.includes('nasil') || norm.includes('iyi mi')) {
      return {
        chiefName: 'Piyasa Radarı Şefi',
        chiefRole: '1. Oda - Dinamik Piyasa Tarayıcısı',
        avatarIcon: '🌐',
        message: 'Harikayım! Gözüm sürekli orderbook ve mumlarda. Hangi coinde para dönüyorsa anında radara alıyorum.',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      chiefName: 'Piyasa Radarı Şefi',
      chiefRole: '1. Oda - Dinamik Piyasa Tarayıcısı',
      avatarIcon: '🌐',
      message: `Radardaki ${radar.length} coini izliyorum. "En sıcak coin hangisi?" veya "Bugün durum ne?" diye sorabilirsin.`,
      timestamp: new Date().toISOString(),
    };
  }

  // --- 2. BAŞ SCALPER ---
  private async chatWithScalpChief(norm: string, raw: string): Promise<ChatReply> {
    // Check if it's an execution command
    if (
      norm.includes('cek') ||
      norm.includes('kapat') ||
      norm.includes('bosalt') ||
      norm.includes('sat') ||
      norm.includes('acil') ||
      norm.includes('iptal') ||
      norm.includes('dur') ||
      norm.includes('bekle') ||
      norm.includes('baslat') ||
      norm.includes('aktif') ||
      norm.includes('hedef') ||
      norm.includes('tp')
    ) {
      const execResult = await this.autoTradeEngine.processNaturalLanguageCommand(raw);
      return {
        chiefName: 'Baş Scalper',
        chiefRole: '2. Oda - Dinamik Scalping & İcra',
        avatarIcon: '⚡',
        message: execResult.message,
        actionTaken: execResult.actionTaken,
        timestamp: new Date().toISOString(),
      };
    }

    const stats = this.autoTradeEngine.getStats();
    const positions = await this.exchangeService.fetchPositions();
    const openCount = positions.filter((p) => Math.abs(p.amount) > 0).length;

    if (norm.includes('naptin') || norm.includes('ne yaptin') || norm.includes('durum') || norm.includes('kazan') || norm.includes('para')) {
      return {
        chiefName: 'Baş Scalper',
        chiefRole: '2. Oda - Dinamik Scalping & İcra',
        avatarIcon: '⚡',
        message: `Rapor veriyorum Barış! Şu ana kadar toplam ${stats.totalAutoTrades} otonom scalp işlemi açtım. ${stats.profitableExits} işlemden kârla çıktık. Kasaya toplam +$${stats.totalProfitHarvestedUsd.toFixed(2)} kâr kilitledik. Şu an ${openCount} açık pozisyonumuz var, kâr hedefini %${stats.targetProfitPercent} ve trailing stop'u %${stats.trailingStopPercent} olarak takip ediyorum.`,
        metrics: stats,
        timestamp: new Date().toISOString(),
      };
    }

    if (norm.includes('nasil') || norm.includes('naber') || norm.includes('selam') || norm.includes('merhaba')) {
      return {
        chiefName: 'Baş Scalper',
        chiefRole: '2. Oda - Dinamik Scalping & İcra',
        avatarIcon: '⚡',
        message: `Piyasanın nabzındayım, tetikte bekliyorum! İstihbarat ve radar ekiplerinden sinyal düştüğü an saniyesinde girip kârı alıp çıkmaya hazırım. Emrin olursa 'çek' demen yeterli!`,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      chiefName: 'Baş Scalper',
      chiefRole: '2. Oda - Dinamik Scalping & İcra',
      avatarIcon: '⚡',
      message: `Emrindeyim Barış! "Kaç para kazandık?", "Bugün naptın?" diye sorabilir veya "çek", "hedef %1.5", "durdur" gibi emirler verebilirsin.`,
      timestamp: new Date().toISOString(),
    };
  }

  // --- 3. İSTİHBARAT ŞEFİ ---
  private chatWithIntelligenceChief(norm: string, raw: string): ChatReply {
    const rules = this.learningEngine.getAllRules();
    const leaks = this.earlyLeakScanner.getRecentLeaks();
    const totalObservations = rules.reduce((acc, r) => acc + (r.observationCount || 0), 0);

    if (norm.includes('ogren') || norm.includes('hafiza') || norm.includes('ders') || norm.includes('kural')) {
      const topRule = rules.find((r) => r.tier === 'STRONG_RULE') || rules[0];
      return {
        chiefName: 'İstihbarat Şefi',
        chiefRole: '3. Oda - Öncü İstihbarat & Balina Tüyo',
        avatarIcon: '🕵️',
        message: `Hafızamızı sürekli güncelliyoruz Barış! rules.json dosyasında toplam ${rules.length} strateji kuralı ve ${totalObservations} gerçek piyasa gözlemi kayıtlı. Örneğin: CoinGecko arama trendleri ve CMC hacim patlamalarını test ederek Telegram öncesi erken giriş kurallarının başarı oranlarını hesapladık. Hatalardan ders çıkarıp zayıf kaynakların ağırlığını kısıyoruz!`,
        metrics: { totalRules: rules.length, totalObservations, regime: this.learningEngine.getMarketRegime() },
        timestamp: new Date().toISOString(),
      };
    }

    if (norm.includes('naptin') || norm.includes('ne yaptin') || norm.includes('haber') || norm.includes('tuyo') || norm.includes('balina')) {
      const last = leaks[0];
      return {
        chiefName: 'İstihbarat Şefi',
        chiefRole: '3. Oda - Öncü İstihbarat & Balina Tüyo',
        avatarIcon: '🕵️',
        message: `CoinGecko, CMC, CoinDesk, Cointelegraph TR ve CryptoPanic sitelerini saniyelik taradım. Son yakaladığım erken sinyal: "${last?.headline || 'Sakin'}". Telegram grupları duymadan önce fiyat tepkisini ölçüp kaydettim.`,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      chiefName: 'İstihbarat Şefi',
      chiefRole: '3. Oda - Öncü İstihbarat & Balina Tüyo',
      avatarIcon: '🕵️',
      message: `Tüm erken sızıntıları ve balina hareketlerini izliyorum. "Neler öğrendin?", "Hangi tüyolar geldi?" diye sorabilirsin.`,
      timestamp: new Date().toISOString(),
    };
  }

  // --- 4. BAŞ TEKNİKER ---
  private async chatWithTechnicalChief(norm: string, raw: string): Promise<ChatReply> {
    const radar = this.altcoinScanner.getRadarList();
    const sym = radar[0]?.symbol || 'SOL/USDT';
    const sr = await this.technicalAnalysis.analyzeSupportResistance(sym);

    if (norm.includes('naptin') || norm.includes('direnc') || norm.includes('destek') || norm.includes('kirilim') || norm.includes('durum')) {
      return {
        chiefName: 'Baş Tekniker',
        chiefRole: '4. Oda - Teknik Analiz & Direnç Avcısı',
        avatarIcon: '📈',
        message: `Tüm grafiklerin Pivot S1/S2/S3 ve R1/R2/R3 seviyelerini hesapladım. Şu an ${sym} için Destek: $${sr?.nearestSupport || 0}, Direnç: $${sr?.nearestResistance || 0}. Bollinger bant sıkışması ve 2x hacim kırılımı olan noktalardan sekme/patlama fırsatlarını kovalıyorum!`,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      chiefName: 'Baş Tekniker',
      chiefRole: '4. Oda - Teknik Analiz & Direnç Avcısı',
      avatarIcon: '📈',
      message: `Grafik ve matematik benim işim! Destek-direnç kırılımlarını ve Bollinger kanallarını inceliyorum.`,
      timestamp: new Date().toISOString(),
    };
  }

  // --- 5. HABER ŞEFİ ---
  private chatWithNewsChief(norm: string, raw: string): ChatReply {
    return {
      chiefName: 'Haber Şefi',
      chiefRole: '5. Oda - Makro & Haber Duyarlılık',
      avatarIcon: '📰',
      message: `Global kripto gündemini, FED faiz duyurularını ve regülasyon haberlerini 7/24 filtreliyorum. Kötü bir makro gelişme veya borsa FUD'ı gördüğüm an Patron'u ve Devre Kesici'yi (CircuitBreaker) uyarıyorum.`,
      timestamp: new Date().toISOString(),
    };
  }
}
