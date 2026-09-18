import { IExchangeService } from '../exchange/IExchangeService.js';
import { CircuitBreaker } from '../risk/CircuitBreaker.js';
import { eventBus } from '../../events/EventBus.js';
import { EventType, AgentRole, AgentState } from '../../config/constants.js';
import { TradeProposalPayload } from '../../types/events.js';
import { PositionInfo } from '../../types/market.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export interface AutoTradeStats {
  totalAutoTrades: number;
  profitableExits: number;
  stopLossExits: number;
  totalProfitHarvestedUsd: number;
  activePositionsCount: number;
  autoTradingEnabled: boolean;
}

export class AutoTradeEngine {
  private exchangeService: IExchangeService;
  private circuitBreaker: CircuitBreaker;
  private isAutoTradingEnabled: boolean;
  private targetProfitUsd: number;
  private stopLossUsd: number;
  private marginPerTradeUsd: number;
  private maxConcurrentPositions: number;

  private monitorTimer: any = null;
  private isProcessingExits: boolean = false;
  private isExecutingProposal: boolean = false;

  // Performance Stats
  private stats: AutoTradeStats = {
    totalAutoTrades: 0,
    profitableExits: 0,
    stopLossExits: 0,
    totalProfitHarvestedUsd: 0,
    activePositionsCount: 0,
    autoTradingEnabled: true,
  };

  constructor(
    exchangeService: IExchangeService,
    circuitBreaker: CircuitBreaker,
    options?: {
      autoTradingEnabled?: boolean;
      targetProfitUsd?: number;
      stopLossUsd?: number;
      marginPerTradeUsd?: number;
      maxConcurrentPositions?: number;
    }
  ) {
    this.exchangeService = exchangeService;
    this.circuitBreaker = circuitBreaker;
    this.isAutoTradingEnabled = options?.autoTradingEnabled ?? config.AUTO_TRADING_ENABLED;
    this.targetProfitUsd = options?.targetProfitUsd ?? config.MICRO_SCALP_TARGET_USD;
    this.stopLossUsd = options?.stopLossUsd ?? config.MICRO_SCALP_STOP_LOSS_USD;
    this.marginPerTradeUsd = options?.marginPerTradeUsd ?? config.MICRO_SCALP_MARGIN_USD;
    this.maxConcurrentPositions = options?.maxConcurrentPositions ?? config.MAX_CONCURRENT_POSITIONS;

    this.stats.autoTradingEnabled = this.isAutoTradingEnabled;

    this.initEventListeners();
  }

  public async start(): Promise<void> {
    logger.info(
      `🤖 [AutoTradeEngine] Autonomous Micro-Scalping & Passive Income Engine started. Target Profit: $${this.targetProfitUsd} per trade, Margin: $${this.marginPerTradeUsd}, Max Concurrent: ${this.maxConcurrentPositions}`
    );

    if (config.NODE_ENV !== 'test') {
      // 2.5-second loop to monitor and harvest micro profits (30 cents TP)
      this.monitorTimer = setInterval(() => {
        this.monitorAndHarvestMicroProfits();
      }, 2500);
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
      details: enabled ? 'Otonom Pasif Gelir Modu Aktif (Kullanıcı onayı gerekmeksizin 30 cent mikro-scalp devrede)' : 'Manuel Onay Moduna Geçildi',
      metadata: { autoTradingEnabled: enabled },
    });
  }

  public getStats(): AutoTradeStats {
    return { ...this.stats };
  }

  private initEventListeners(): void {
    // Listen for TRADE_PROPOSAL from DecisionEngine
    eventBus.on(EventType.TRADE_PROPOSAL, async (event) => {
      if (!this.isAutoTradingEnabled) return;
      const proposal = event.payload as TradeProposalPayload;
      await this.handleAutonomousTradeProposal(proposal);
    });
  }

  /**
   * Automatically executes trade proposals without asking user
   */
  public async handleAutonomousTradeProposal(proposal: TradeProposalPayload): Promise<boolean> {
    if (!this.isAutoTradingEnabled) {
      logger.debug('[AutoTradeEngine] Auto-trading disabled, skipping automatic execution.');
      return false;
    }

    if (this.isExecutingProposal) return false;
    this.isExecutingProposal = true;

    try {
      // 1. Circuit Breaker Check
      if (this.circuitBreaker.getState().isHalted) {
        logger.warn(`🛑 [AutoTradeEngine] Cannot auto-execute ${proposal.symbol}: Circuit Breaker is active.`);
        return false;
      }

      // 2. Concurrency Check
      const activePositions = await this.exchangeService.fetchPositions();
      this.stats.activePositionsCount = activePositions.length;

      if (activePositions.length >= this.maxConcurrentPositions) {
        logger.warn(
          `⚠️ [AutoTradeEngine] Maximum concurrent positions reached (${activePositions.length}/${this.maxConcurrentPositions}). Skipping ${proposal.symbol}.`
        );
        return false;
      }

      // Check if we already have a position in this coin
      const cleanSymbol = proposal.symbol.replace('/', '');
      const existing = activePositions.find((p) => p.symbol.replace('/', '') === cleanSymbol);
      if (existing) {
        logger.debug(`ℹ️ [AutoTradeEngine] Position already open for ${proposal.symbol}, skipping duplicate entry.`);
        return false;
      }

      const amountToTrade = this.marginPerTradeUsd;
      const leverage = proposal.suggestedLeverage || config.DEFAULT_LEVERAGE || 5;
      const marginMode = proposal.suggestedMarginMode || 'isolated';

      logger.info(
        `⚡ [AutoTradeEngine] AUTO-EXECUTING: ${proposal.side} ${proposal.symbol} | Margin: $${amountToTrade} | Leverage: ${leverage}x (${marginMode}) | Target Profit: +$${this.targetProfitUsd}`
      );

      // Execute on exchange
      const orderResult = await this.exchangeService.executeOrder({
        symbol: proposal.symbol,
        side: proposal.side,
        amountUsd: amountToTrade,
        type: 'MARKET',
        leverage,
        marginMode,
        options: {
          signalId: proposal.signalId,
          sourceCategory: proposal.sourceCategory || 'autonomous_microscalp',
          stopLoss: proposal.suggestedStopLoss,
          takeProfit: proposal.suggestedTakeProfit,
        },
      });

      if (orderResult.success) {
        this.stats.totalAutoTrades++;

        eventBus.publish(EventType.AGENT_ACTION, {
          agentRole: AgentRole.BINANCE_TRADER,
          actionName: 'Otonom Emir Açılışı',
          status: 'COMPLETED',
          details: `⚡ [OTOMATİK İCRA] ${proposal.symbol} için ${leverage}x ${proposal.side} pozisyonu $${amountToTrade} marjinle açıldı. Hedef Kâr: +$${this.targetProfitUsd}`,
          metadata: {
            orderId: orderResult.orderId,
            symbol: proposal.symbol,
            side: proposal.side,
            amountUsd: amountToTrade,
            leverage,
          },
        });

        // Trigger balance & position refresh
        const updatedBal = await this.exchangeService.fetchBalance();
        const updatedPositions = await this.exchangeService.fetchPositions();
        eventBus.publish(EventType.PORTFOLIO_UPDATE, {
          totalBalanceUsd: updatedBal.totalUsd,
          freeUsdt: updatedBal.freeUsdt,
          positions: updatedPositions,
          totalUnrealizedPnl: updatedPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0),
          isTestnet: true,
        });

        return true;
      }

      return false;
    } catch (err) {
      logger.error(`❌ [AutoTradeEngine] Error auto-executing ${proposal.symbol}:`, (err as Error).message);
      return false;
    } finally {
      this.isExecutingProposal = false;
    }
  }

  /**
   * Continuous Micro-Profit Harvester (Checks every 2-3s)
   * Closes positions when target micro-profit (e.g. +$0.30) is reached or Stop Loss hit.
   */
  public async monitorAndHarvestMicroProfits(): Promise<void> {
    if (this.isProcessingExits) return;
    this.isProcessingExits = true;

    try {
      const positions = await this.exchangeService.fetchPositions();
      this.stats.activePositionsCount = positions.length;

      if (!positions || positions.length === 0) return;

      for (const pos of positions) {
        const pnl = pos.unrealizedPnl;
        const positionSide = (pos as any).side || 'LONG';
        const exitSide: 'BUY' | 'SELL' = positionSide === 'LONG' ? 'SELL' : 'BUY';

        // 1. Take Profit Exit (+30 Cents or higher)
        if (pnl >= this.targetProfitUsd) {
          logger.info(
            `💰 [AutoTradeEngine] TARGET PROFIT HIT: ${pos.symbol} (+$${pnl.toFixed(2)} >= $${this.targetProfitUsd}). AUTO-CLOSING POSITION!`
          );

          await this.closePosition(pos, exitSide, 'PROFIT_TAKE', pnl);
        }
        // 2. Stop Loss Defense Exit
        else if (pnl <= -this.stopLossUsd) {
          logger.warn(
            `🛡️ [AutoTradeEngine] STOP LOSS TRIGGERED: ${pos.symbol} (-$${Math.abs(pnl).toFixed(2)} <= -$${this.stopLossUsd}). AUTO-CLOSING POSITION!`
          );

          await this.closePosition(pos, exitSide, 'STOP_LOSS', pnl);
        }
      }
    } catch (err) {
      logger.debug(`[AutoTradeEngine] Error in micro-scalp monitor loop: ${(err as Error).message}`);
    } finally {
      this.isProcessingExits = false;
    }
  }

  private async closePosition(
    pos: PositionInfo,
    exitSide: 'BUY' | 'SELL',
    reason: 'PROFIT_TAKE' | 'STOP_LOSS',
    pnl: number
  ): Promise<void> {
    try {
      const positionValueUsd = Math.max(5.0, pos.amount * (pos.currentPrice || pos.markPrice || 1.0));

      const exitResult = await this.exchangeService.executeOrder({
        symbol: pos.symbol,
        side: exitSide,
        amountUsd: positionValueUsd,
        type: 'MARKET',
        options: {
          sourceCategory: `autoclose_${reason.toLowerCase()}`,
        },
      });

      if (exitResult.success) {
        if (reason === 'PROFIT_TAKE') {
          this.stats.profitableExits++;
          this.stats.totalProfitHarvestedUsd += pnl;

          eventBus.publish(EventType.AGENT_ACTION, {
            agentRole: AgentRole.BINANCE_TRADER,
            actionName: 'Kâr Realize Edildi',
            status: 'COMPLETED',
            details: `💰 [PASİF GELİR] ${pos.symbol} pozisyonu +$${pnl.toFixed(2)} kâr ile otomatik kapatıldı! (Hedef: $${this.targetProfitUsd})`,
            metadata: { symbol: pos.symbol, realizedPnl: pnl, reason },
          });
        } else {
          this.stats.stopLossExits++;
          this.stats.totalProfitHarvestedUsd += pnl;

          eventBus.publish(EventType.AGENT_ACTION, {
            agentRole: AgentRole.RISK_ANALYST,
            actionName: 'Stop-Loss Koruması',
            status: 'COMPLETED',
            details: `🛡️ [STOP LOSS] ${pos.symbol} -$${Math.abs(pnl).toFixed(2)} ile sermaye koruması amacıyla kapatıldı.`,
            metadata: { symbol: pos.symbol, realizedPnl: pnl, reason },
          });
        }

        // Notify CircuitBreaker of trade outcome
        this.circuitBreaker.recordTradeOutcome(pos.symbol, pnl);

        // Refresh state
        const balance = await this.exchangeService.fetchBalance();
        const updatedPos = await this.exchangeService.fetchPositions();
        eventBus.publish(EventType.PORTFOLIO_UPDATE, {
          totalBalanceUsd: balance.totalUsd,
          freeUsdt: balance.freeUsdt,
          positions: updatedPos,
          totalUnrealizedPnl: updatedPos.reduce((sum, p) => sum + p.unrealizedPnl, 0),
          isTestnet: true,
        });
      }
    } catch (err) {
      logger.error(`❌ [AutoTradeEngine] Failed to auto-close position ${pos.symbol}:`, (err as Error).message);
    }
  }
}
