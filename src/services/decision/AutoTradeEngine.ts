import { IExchangeService } from '../exchange/IExchangeService.js';
import { CircuitBreaker } from '../risk/CircuitBreaker.js';
import { eventBus } from '../../events/EventBus.js';
import { EventType, AgentRole } from '../../config/constants.js';
import { TradeProposalPayload } from '../../types/events.js';
import { PositionInfo, Position } from '../../types/market.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export interface AutoTradeStats {
  totalAutoTrades: number;
  profitableExits: number;
  stopLossExits: number;
  totalProfitHarvestedUsd: number;
  activePositionsCount: number;
  autoTradingEnabled: boolean;
  targetProfitPercent: number;
  trailingStopPercent: number;
  stopLossPercent: number;
}

export interface ExecutedOrderRecord {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  amountUsd: number;
  entryPrice: number;
  exitPrice?: number;
  pnlUsd?: number;
  pnlPercent?: number;
  exitReason?: string;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  closedAt?: string;
}

export class AutoTradeEngine {
  private exchangeService: IExchangeService;
  private circuitBreaker: CircuitBreaker;
  private isAutoTradingEnabled: boolean;
  private targetProfitPercent: number; // e.g. 0.8%
  private trailingStopPercent: number;  // e.g. 0.35%
  private stopLossPercent: number;      // e.g. 1.2%
  private marginPerTradeUsd: number;
  private maxConcurrentPositions: number;

  private monitorTimer: any = null;
  private isProcessingExits: boolean = false;
  private isExecutingProposal: boolean = false;
  private highestProfitPercent: Map<string, number> = new Map();
  private recentOrders: ExecutedOrderRecord[] = [];

  private stats: AutoTradeStats;

  constructor(
    exchangeService: IExchangeService,
    circuitBreaker: CircuitBreaker,
    options?: {
      autoTradingEnabled?: boolean;
      targetProfitPercent?: number;
      trailingStopPercent?: number;
      stopLossPercent?: number;
      marginPerTradeUsd?: number;
      maxConcurrentPositions?: number;
    }
  ) {
    this.exchangeService = exchangeService;
    this.circuitBreaker = circuitBreaker;
    this.isAutoTradingEnabled = options?.autoTradingEnabled ?? config.AUTO_TRADING_ENABLED;
    this.targetProfitPercent = options?.targetProfitPercent ?? 0.8;
    this.trailingStopPercent = options?.trailingStopPercent ?? 0.35;
    this.stopLossPercent = options?.stopLossPercent ?? 1.2;
    this.marginPerTradeUsd = options?.marginPerTradeUsd ?? config.MICRO_SCALP_MARGIN_USD;
    this.maxConcurrentPositions = options?.maxConcurrentPositions ?? config.MAX_CONCURRENT_POSITIONS;

    this.stats = {
      totalAutoTrades: 0,
      profitableExits: 0,
      stopLossExits: 0,
      totalProfitHarvestedUsd: 0,
      activePositionsCount: 0,
      autoTradingEnabled: this.isAutoTradingEnabled,
      targetProfitPercent: this.targetProfitPercent,
      trailingStopPercent: this.trailingStopPercent,
      stopLossPercent: this.stopLossPercent,
    };

    this.initEventListeners();
  }

  public async start(): Promise<void> {
    logger.info(
      `🤖 [AutoTradeEngine] Intelligent Dynamic Scalper started. Target TP: %${this.targetProfitPercent}, Trailing Stop: %${this.trailingStopPercent}, Stop Loss: %${this.stopLossPercent}, Margin: $${this.marginPerTradeUsd}`
    );

    if (config.NODE_ENV !== 'test') {
      this.monitorTimer = setInterval(() => {
        this.monitorAndHarvestProfits();
      }, 2000);
    }
  }

  public stop(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    logger.info('🛑 [AutoTradeEngine] Auto-trade monitoring loop stopped.');
  }

  public isEnabled(): boolean {
    return this.isAutoTradingEnabled;
  }

  public setEnabled(enabled: boolean): void {
    this.isAutoTradingEnabled = enabled;
    this.stats.autoTradingEnabled = enabled;
    logger.info(`🤖 [AutoTradeEngine] Auto-Trading state toggled to: ${enabled ? 'ENABLED' : 'DISABLED'}`);

    eventBus.publish(EventType.AGENT_ACTION, {
      agentRole: AgentRole.BINANCE_TRADER,
      actionName: 'Oto-Trade Modu',
      status: 'COMPLETED',
      details: enabled
        ? `Dinamik Scalping Modu Aktif (Hedef: %${this.targetProfitPercent} TP + Trailing Stop)`
        : 'Manuel Onay Moduna Geçildi',
      timestamp: new Date().toISOString(),
    });
  }

  public getStats(): AutoTradeStats {
    return { ...this.stats };
  }

  public getRecentOrders(): ExecutedOrderRecord[] {
    return [...this.recentOrders];
  }

  public setTargetProfitPercent(pct: number): void {
    if (pct > 0 && pct <= 10) {
      this.targetProfitPercent = Number(pct.toFixed(2));
      this.stats.targetProfitPercent = this.targetProfitPercent;
      logger.info(`🎯 [AutoTradeEngine] Target Profit % updated to: ${this.targetProfitPercent}%`);
    }
  }

  public setStopLossPercent(pct: number): void {
    if (pct > 0 && pct <= 15) {
      this.stopLossPercent = Number(pct.toFixed(2));
      this.stats.stopLossPercent = this.stopLossPercent;
      logger.info(`🛡️ [AutoTradeEngine] Stop Loss % updated to: ${this.stopLossPercent}%`);
    }
  }

  public async processNaturalLanguageCommand(rawCommand: string): Promise<{ success: boolean; message: string; actionTaken: string }> {
    let text = rawCommand.toLowerCase().trim();
    // Normalize Turkish characters
    const normalized = text
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ş/g, 's')
      .replace(/ü/g, 'u')
      .replace(/\?/g, 'c'); // in case of charset mangling ?ek -> cek

    logger.info(`🗣️ [AutoTradeEngine] Processing Natural Language Command: "${rawCommand}" (normalized: "${normalized}")`);

    // 1. Emergency Exit / Close all positions ("çek", "kapat", "acil sat", "pozisyonları boşalt", "iptal et")
    if (
      normalized.includes('cek') ||
      normalized.includes('kapat') ||
      normalized.includes('bosalt') ||
      normalized.includes('sat') ||
      normalized.includes('acil') ||
      normalized.includes('iptal') ||
      normalized.includes('panik')
    ) {
      const closedCount = await this.emergencyCloseAllPositions('Kullanıcı Doğal Dil Komutu: Çek / Kapat');
      const msg = closedCount > 0
        ? `🫡 Emredersiniz! Baş Scalper tüm açık pozisyonları derhal kapattı ve piyasadan çekildi. (${closedCount} pozisyon nakde çevrildi)`
        : `🫡 Emredersiniz! Kontrol ettim, şu an açık pozisyon bulunmuyor. Piyasa güvenli izleme modunda.`;

      eventBus.publish(EventType.AGENT_ACTION, {
        agentRole: AgentRole.BINANCE_TRADER,
        actionName: 'Doğal Dil Komutu',
        status: 'COMPLETED',
        details: msg,
        timestamp: new Date().toISOString(),
      });

      return { success: true, message: msg, actionTaken: 'EMERGENCY_CLOSE_ALL' };
    }

    // 2. Pause Trading ("dur", "durdur", "bekle", "mola")
    if (text.includes('dur') || text.includes('bekle') || text.includes('mola') || text.includes('pause')) {
      this.setEnabled(false);
      const msg = `⏸️ Baş Scalper: Otomatik alım-satım durduruldu. Yeni işlem açılmayacak, mevcut durum izleniyor.`;
      return { success: true, message: msg, actionTaken: 'PAUSE_TRADING' };
    }

    // 3. Resume Trading ("başlat", "devam", "aktif", "basla")
    if (text.includes('başlat') || text.includes('baslat') || text.includes('devam') || text.includes('aktif') || text.includes('calis')) {
      this.setEnabled(true);
      const msg = `🚀 Baş Scalper: Dinamik Scalping motoru aktif edildi! Fırsatlar taranıyor ve kâr hedefleri devrede.`;
      return { success: true, message: msg, actionTaken: 'RESUME_TRADING' };
    }

    // 4. Update Target Profit ("hedef %1", "tp %1.5")
    const tpMatch = text.match(/(?:hedef|tp|kar|kâr)\s*%?\s*(\d+(?:[.,]\d+)?)/);
    if (tpMatch && tpMatch[1]) {
      const val = parseFloat(tpMatch[1].replace(',', '.'));
      this.setTargetProfitPercent(val);
      const msg = `🎯 Baş Scalper: Kâr alma hedefi dinamik %${val} olarak güncellendi.`;
      return { success: true, message: msg, actionTaken: 'SET_TP' };
    }

    // Default fallback
    return {
      success: true,
      message: `🤖 Baş Scalper komutunuzu dinledi: "${rawCommand}". 'çek' diyerek pozisyonları kapatabilir, 'hedef %1' ile kâr oranını değiştirebilirsiniz.`,
      actionTaken: 'INFO',
    };
  }

  public async emergencyCloseAllPositions(reason = 'Emergency close'): Promise<number> {
    try {
      const positions = await this.exchangeService.fetchPositions();
      const openPositions = positions.filter((p: Position) => Math.abs(p.amount) > 0);

      let closed = 0;
      for (const pos of openPositions) {
        await this.exchangeService.closePosition(pos.symbol);
        this.highestProfitPercent.delete(pos.symbol);
        closed++;
      }

      logger.info(`🚨 [AutoTradeEngine] Emergency closed ${closed} positions. Reason: ${reason}`);
      return closed;
    } catch (err) {
      logger.error('❌ [AutoTradeEngine] Error during emergency close:', err);
      return 0;
    }
  }

  private initEventListeners(): void {
    eventBus.on(EventType.TRADE_PROPOSAL, async (event: any) => {
      const proposal: TradeProposalPayload = event?.payload || event;
      if (!proposal || !proposal.symbol) {
        return;
      }

      if (!this.isAutoTradingEnabled) {
        logger.debug(`[AutoTradeEngine] Auto-trade disabled. Ignoring proposal ${proposal.proposalId}`);
        return;
      }

      if (this.circuitBreaker.getState().isHalted) {
        logger.warn(`🛑 [AutoTradeEngine] Trading halted by CircuitBreaker. Proposal ignored.`);
        return;
      }

      await this.executeProposalAutonomous(proposal);
    });
  }

  public async executeProposalAutonomous(proposal: TradeProposalPayload): Promise<void> {
    if (this.isExecutingProposal) return;
    this.isExecutingProposal = true;

    try {
      const positions = await this.exchangeService.fetchPositions();
      const openPositions = positions.filter((p: Position) => Math.abs(p.amount) > 0);

      if (openPositions.length >= this.maxConcurrentPositions) {
        logger.info(
          `⚠️ [AutoTradeEngine] Max concurrent positions limit reached (${openPositions.length}/${this.maxConcurrentPositions}). Skipping ${proposal.symbol}.`
        );
        return;
      }

      const alreadyOpen = openPositions.some((p: Position) => p.symbol === proposal.symbol);
      if (alreadyOpen) {
        logger.debug(`[AutoTradeEngine] Already have an open position for ${proposal.symbol}. Skipping.`);
        return;
      }

      const marginUsd = this.marginPerTradeUsd;
      const leverage = proposal.suggestedLeverage || 5;

      logger.info(
        `⚡ [AutoTradeEngine] Auto-Executing Scalp Order: ${proposal.side} ${proposal.symbol} | Margin: $${marginUsd} (${leverage}x) | Target: %${this.targetProfitPercent} TP`
      );

      const orderResult = await this.exchangeService.executeOrder({
        symbol: proposal.symbol,
        side: proposal.side,
        amountUsd: marginUsd,
        type: 'MARKET',
        leverage,
        marginMode: 'isolated',
      });

      if (orderResult.success) {
        this.stats.totalAutoTrades += 1;
        this.highestProfitPercent.set(proposal.symbol, 0);

        const record: ExecutedOrderRecord = {
          id: orderResult.orderId || `ord_${Date.now()}`,
          symbol: proposal.symbol,
          side: proposal.side,
          amountUsd: marginUsd,
          entryPrice: orderResult.price || 0,
          status: 'OPEN',
          createdAt: new Date().toISOString(),
        };
        this.recentOrders.unshift(record);
        if (this.recentOrders.length > 50) this.recentOrders.pop();

        eventBus.publish(EventType.AGENT_ACTION, {
          agentRole: AgentRole.BINANCE_TRADER,
          actionName: 'Dinamik Scalp Emri Açıldı',
          status: 'COMPLETED',
          details: `Baş Scalper ${proposal.symbol} için ${proposal.side} pozisyonu açtı (Marjin: $${marginUsd}, Kaldıraç: ${leverage}x, Hedef: %${this.targetProfitPercent})`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      logger.error('❌ [AutoTradeEngine] Error executing auto-trade proposal:', err);
    } finally {
      this.isExecutingProposal = false;
    }
  }

  public async monitorAndHarvestProfits(): Promise<void> {
    if (this.isProcessingExits) return;
    this.isProcessingExits = true;

    try {
      const positions = await this.exchangeService.fetchPositions();
      const openPositions = positions.filter((p: Position) => Math.abs(p.amount) > 0);
      this.stats.activePositionsCount = openPositions.length;

      for (const pos of openPositions) {
        const pnlUsd = pos.unrealizedPnl || 0;
        const margin = pos.marginUsed || this.marginPerTradeUsd;
        const currentPnlPct = (pnlUsd / margin) * 100;

        // Track peak profit % for Trailing Stop
        const peak = Math.max(this.highestProfitPercent.get(pos.symbol) || 0, currentPnlPct);
        this.highestProfitPercent.set(pos.symbol, peak);

        let shouldExit = false;
        let exitReason = '';

        // 1. Dynamic Take-Profit & Trailing Stop Exit
        if (peak >= this.targetProfitPercent) {
          // If profit peaked above target and fell back by trailingStopPercent
          if (currentPnlPct <= (peak - this.trailingStopPercent)) {
            shouldExit = true;
            exitReason = `Trailing Stop Kâr Hasadı (Zirve: %${peak.toFixed(2)}, Çıkış: %${currentPnlPct.toFixed(2)}, Kâr: +$${pnlUsd.toFixed(2)})`;
          } else if (currentPnlPct >= this.targetProfitPercent * 1.5) {
            // Instant profit lock on strong momentum surge
            shouldExit = true;
            exitReason = `Dinamik Kâr Hedefi Ulaşıldı (+%${currentPnlPct.toFixed(2)} / +$${pnlUsd.toFixed(2)})`;
          }
        }

        // 2. Dynamic Stop-Loss Triggered
        if (currentPnlPct <= -this.stopLossPercent) {
          shouldExit = true;
          exitReason = `Dinamik Stop-Loss Tetiklendi (-%${Math.abs(currentPnlPct).toFixed(2)} / -$${Math.abs(pnlUsd).toFixed(2)})`;
        }

        if (shouldExit) {
          logger.info(`✨ [AutoTradeEngine] Closing ${pos.symbol}: ${exitReason}`);
          await this.exchangeService.closePosition(pos.symbol, pos.side);
          this.highestProfitPercent.delete(pos.symbol);

          // Update record
          const orderRec = this.recentOrders.find((o) => o.symbol === pos.symbol && o.status === 'OPEN');
          if (orderRec) {
            orderRec.status = 'CLOSED';
            orderRec.pnlUsd = pnlUsd;
            orderRec.pnlPercent = Number(currentPnlPct.toFixed(2));
            orderRec.exitReason = exitReason;
            orderRec.closedAt = new Date().toISOString();
          }

          if (pnlUsd >= 0) {
            this.stats.profitableExits += 1;
            this.stats.totalProfitHarvestedUsd += pnlUsd;
          } else {
            this.stats.stopLossExits += 1;
          }

          eventBus.publish(EventType.AGENT_ACTION, {
            agentRole: AgentRole.BINANCE_TRADER,
            actionName: 'Pozisyon Kapatıldı',
            status: 'COMPLETED',
            details: `${pos.symbol} pozisyonu kapatıldı. ${exitReason}`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      logger.debug(`[AutoTradeEngine] Monitor tick error: ${(err as Error).message}`);
    } finally {
      this.isProcessingExits = false;
    }
  }
}
