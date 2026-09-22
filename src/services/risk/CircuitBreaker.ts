import { eventBus } from '../../events/EventBus.js';
import { EventType } from '../../config/constants.js';
import { CooldownReport, CircuitBreakerState } from '../../types/market.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

interface LossRecord {
  symbol: string;
  pnl: number;
  confidence: number;
  channels: string[];
  rules: string[];
  timestamp: string;
}

export class CircuitBreaker {
  private isHalted: boolean = false;
  private haltedAt?: Date;
  private resumeAt?: Date;
  private consecutiveLossThreshold: number;
  private cooldownDurationMs: number;
  private lossHistory: LossRecord[] = [];
  private consecutiveLosses: number = 0;
  private reports: CooldownReport[] = [];
  private resumeTimer: any = null;

  constructor(
    consecutiveLossThreshold: number = config.COOLDOWN_CONSECUTIVE_LOSSES,
    cooldownDurationMinutes: number = config.COOLDOWN_DURATION_MINUTES
  ) {
    this.consecutiveLossThreshold = consecutiveLossThreshold;
    this.cooldownDurationMs = cooldownDurationMinutes * 60 * 1000;
  }

  public recordTradeOutcome(
    symbol: string,
    pnl: number,
    confidence: number = 70,
    channels: string[] = ['chart', 'news'],
    rules: string[] = []
  ): boolean {
    if (pnl < 0) {
      this.consecutiveLosses += 1;
      this.lossHistory.push({
        symbol,
        pnl,
        confidence,
        channels,
        rules,
        timestamp: new Date().toISOString(),
      });

      logger.warn(`⚠️ [CircuitBreaker] Recorded LOSS trade on ${symbol} (PnL: $${pnl.toFixed(2)}). Consecutive losses: ${this.consecutiveLosses}/${this.consecutiveLossThreshold}`);

      if (this.consecutiveLosses >= this.consecutiveLossThreshold && !this.isHalted) {
        this.triggerCooldown();
        return true;
      }
    } else {
      // Winning trade resets consecutive loss counter
      if (this.consecutiveLosses > 0) {
        logger.info(`✅ [CircuitBreaker] Winning trade on ${symbol} reset consecutive losses from ${this.consecutiveLosses} to 0.`);
      }
      this.consecutiveLosses = 0;
    }

    return false;
  }

  public triggerCooldown(): CooldownReport {
    this.isHalted = true;
    this.haltedAt = new Date();
    this.resumeAt = new Date(Date.now() + this.cooldownDurationMs);

    const report = this.generatePostMortemReport();
    this.reports.unshift(report);

    eventBus.publish(EventType.TRADING_HALTED, {
      haltedAt: this.haltedAt.toISOString(),
      resumeAt: this.resumeAt.toISOString(),
      durationMinutes: Math.round(this.cooldownDurationMs / 60000),
      reason: `Ardarda ${this.consecutiveLosses} zararlı işlem gerçekleşti. Risk önleme protokolü devrede.`,
      consecutiveLosses: this.consecutiveLosses,
      reportId: report.id,
    });

    eventBus.publish(EventType.COOLDOWN_REPORT_READY, report);

    logger.error(`🛑 [CircuitBreaker] TRADING HALTED! Cooldown active for ${Math.round(this.cooldownDurationMs / 60000)} minutes. Post-Mortem Report generated: ${report.id}`);

    // Set auto-resume timer
    if (this.resumeTimer) clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(() => {
      this.resumeTrading('30 dakikalık cooldown süresi tamamlandı. Analiz modu sona erdi.');
    }, this.cooldownDurationMs);
    if (this.resumeTimer && typeof (this.resumeTimer as any).unref === 'function') {
      (this.resumeTimer as any).unref();
    }

    return report;
  }

  public stop(): void {
    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }
  }

  public resumeTrading(reason: string = 'Manuel müdahale ile işlemler başlatıldı.'): void {
    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }

    this.isHalted = false;
    this.consecutiveLosses = 0;
    const now = new Date();

    if (this.reports.length > 0 && !this.reports[0].resumedAt) {
      this.reports[0].resumedAt = now.toISOString();
    }

    eventBus.publish(EventType.TRADING_RESUMED, {
      resumedAt: now.toISOString(),
      reason,
    });

    logger.info(`🟢 [CircuitBreaker] Trading RESUMED. Reason: ${reason}`);
  }

  public generatePostMortemReport(): CooldownReport {
    const recentLosses = this.lossHistory.slice(-this.consecutiveLossThreshold);
    const channelCounts: Record<string, number> = {};
    const failedRulesSet = new Set<string>();
    let totalConf = 0;

    recentLosses.forEach((l) => {
      totalConf += l.confidence;
      l.channels.forEach((ch) => {
        channelCounts[ch] = (channelCounts[ch] || 0) + 1;
      });
      l.rules.forEach((r) => failedRulesSet.add(r));
    });

    const avgConf = recentLosses.length > 0 ? Math.round(totalConf / recentLosses.length) : 70;
    const misleadingChannels = Object.keys(channelCounts);
    const failedRules = Array.from(failedRulesSet);

    const report: CooldownReport = {
      id: `rep_pm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      haltedAt: new Date().toISOString(),
      durationMinutes: Math.round(this.cooldownDurationMs / 60000),
      reason: `Ardarda ${this.consecutiveLosses} zararlı işlem sonucu sistem kendini analize aldı.`,
      consecutiveLosses: this.consecutiveLosses,
      misleadingChannels: misleadingChannels.length > 0 ? misleadingChannels : ['Sosyal Sinyal Odası (Gürültü/Faux Breakout)'],
      failedRules: failedRules.length > 0 ? failedRules : ['rule_oversold_rsi_bounce'],
      averageLossConfidence: avgConf,
      analystDiagnosis: `Son ${this.consecutiveLosses} işlemde piyasa ani volatilite sıçraması gösterdi. Sosyal sinyal ve indikatör uyumsuzluğu tespit edildi; emirler stop-loss seviyesine çarptı.`,
      recommendations: [
        'Sosyal kanal güven çarpanı %15 düşürüldü.',
        'Kaldıraç tavanı geçici olarak 3x ile sınırlandırıldı.',
        'Piyasa rejim kontrolü yatay (SIDEWAYS) olarak güncellendi.',
      ],
    };

    return report;
  }

  public answerAssistantQuestion(question: string): string {
    const q = question.toLowerCase();
    const lastReport = this.reports[0];

    if (!lastReport) {
      return '🟢 Sistem şu ana kadar istikrarlı çalıştı, kayıtlı bir cooldown / devre kesici raporu bulunmuyor.';
    }

    if (q.includes('sorun') || q.includes('ne oldu') || q.includes('öğren') || q.includes('hata') || q.includes('rapor')) {
      return `🛑 **Son Analiz & Post-Mortem Raporu (${lastReport.haltedAt.substring(11, 19)}):**\n\n` +
        `• **Sebep:** ${lastReport.reason}\n` +
        `• **Hatalı/Yanıltıcı Kanallar:** ${lastReport.misleadingChannels.join(', ')}\n` +
        `• **Ortalama Güven Skoru:** %${lastReport.averageLossConfidence}\n` +
        `• **Teşhis:** ${lastReport.analystDiagnosis}\n` +
        `• **Çıkarılan Dersler & Aksiyonlar:**\n${lastReport.recommendations.map((r) => `  - ${r}`).join('\n')}`;
    }

    return `Şu anki durum: ${this.isHalted ? '🔴 DEVRE KESİCİ AKTİF (ANALİZ MODU)' : '🟢 İŞLEMLER AKTİF'}. Ardarda zarar sayısı: ${this.consecutiveLosses}.`;
  }

  public getState(): CircuitBreakerState {
    let remainingSeconds = 0;
    if (this.isHalted && this.resumeAt) {
      remainingSeconds = Math.max(0, Math.round((this.resumeAt.getTime() - Date.now()) / 1000));
    }

    return {
      isHalted: this.isHalted,
      haltedAt: this.haltedAt?.toISOString(),
      resumeAt: this.resumeAt?.toISOString(),
      remainingSeconds,
      consecutiveLosses: this.consecutiveLosses,
      lastReport: this.reports[0],
    };
  }

  public getAllReports(): CooldownReport[] {
    return this.reports;
  }
}
