import {
  createChart,
  CandlestickSeries,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  ColorType,
  Time,
  IPriceLine,
} from 'lightweight-charts';
import { wsService } from './websocket.ts';
import { apiService } from './api.ts';
import { PortfolioUpdatePayload, SystemStatusPayload } from '../types/events.ts';

interface PositionItem {
  symbol: string;
  amount: number;
  entryPrice: number;
  currentPrice?: number;
  markPrice?: number;
  unrealizedPnl: number;
  percentagePnl?: number;
  side?: string;
  signalId?: string;
  sourceCategory?: string;
  stopLoss?: number;
  takeProfit?: number;
}

interface PositionCardState {
  symbol: string;
  cardEl: HTMLElement;
  chartContainerEl: HTMLElement;
  chart: IChartApi;
  series: ISeriesApi<'Candlestick'>;
  pollInterval: any;
  priceEl: HTMLElement;
  pnlEl: HTMLElement;
  sideTagEl: HTMLElement;
  entryEl: HTMLElement;
  sourceEl: HTMLElement;
  sltpContainerEl: HTMLElement;
  resizeObserver: ResizeObserver;
  stopLossLine?: IPriceLine;
  takeProfitLine?: IPriceLine;
}

export class PositionsChartManager {
  private cards: Map<string, PositionCardState> = new Map();
  private containerEl: HTMLElement | null = null;
  private placeholderEl: HTMLElement | null = null;
  private countBadgeEl: HTMLElement | null = null;

  constructor() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  private init(): void {
    this.containerEl = document.getElementById('positions-container');
    this.placeholderEl = document.getElementById('positions-empty-placeholder');
    this.countBadgeEl = document.getElementById('positions-count-badge');

    this.setupEventListeners();
    this.fetchInitialPositions();
  }

  private setupEventListeners(): void {
    // 1. Listen to PORTFOLIO_UPDATE via WebSocket
    wsService.on<PortfolioUpdatePayload>('PORTFOLIO_UPDATE', (payload) => {
      if (payload && Array.isArray(payload.positions)) {
        this.updatePositions(payload.positions);
      }
    });

    // 2. Listen to SYSTEM_STATUS
    wsService.on<SystemStatusPayload>('SYSTEM_STATUS', (payload) => {
      if (payload && payload.portfolioSummary) {
        // Fetch full portfolio to get positions list
        this.fetchInitialPositions();
      }
    });
  }

  private async fetchInitialPositions(): Promise<void> {
    const portfolioData = await apiService.fetchPortfolio();
    if (portfolioData && Array.isArray(portfolioData.positions)) {
      this.updatePositions(portfolioData.positions);
    }
  }

  /**
   * Synchronizes active position cards with current positions list
   */
  public updatePositions(positions: PositionItem[]): void {
    const currentSymbols = new Set(positions.map((p) => p.symbol));

    // 1. Remove closed positions
    for (const [symbol, cardState] of this.cards.entries()) {
      if (!currentSymbols.has(symbol)) {
        this.removePositionCard(symbol, cardState);
      }
    }

    // 2. Add or update active positions
    for (const pos of positions) {
      if (this.cards.has(pos.symbol)) {
        this.updateExistingCard(this.cards.get(pos.symbol)!, pos);
      } else {
        this.createPositionCard(pos);
      }
    }

    // 3. Update placeholder & count badge
    this.updatePlaceholderAndBadge();
  }

  private createPositionCard(pos: PositionItem): void {
    if (!this.containerEl) return;

    // Card Element
    const cardEl = document.createElement('div');
    cardEl.className = `position-card ${pos.unrealizedPnl >= 0 ? 'profit' : 'loss'}`;
    cardEl.id = `pos-card-${pos.symbol.replace('/', '-')}`;

    const side = pos.side || (pos.amount >= 0 ? 'LONG' : 'SHORT');
    const sideClass = side.toLowerCase();

    // Card Header
    const headerEl = document.createElement('div');
    headerEl.className = 'card-header';

    const symbolWrap = document.createElement('div');
    symbolWrap.className = 'card-symbol-wrap';

    const symbolEl = document.createElement('span');
    symbolEl.className = 'card-symbol';
    symbolEl.textContent = pos.symbol;

    const sideTagEl = document.createElement('span');
    sideTagEl.className = `card-side-tag ${sideClass}`;
    sideTagEl.textContent = side;

    symbolWrap.appendChild(symbolEl);
    symbolWrap.appendChild(sideTagEl);

    // Stats (Price & PnL)
    const statsEl = document.createElement('div');
    statsEl.className = 'card-stats';

    const priceEl = document.createElement('span');
    priceEl.className = 'card-price';
    const curPrice = pos.currentPrice || pos.entryPrice;
    priceEl.textContent = `$${curPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const pnlEl = document.createElement('span');
    const pnlSign = pos.unrealizedPnl >= 0 ? '+' : '';
    const pnlPercent =
      pos.percentagePnl !== undefined
        ? pos.percentagePnl
        : (pos.unrealizedPnl / (pos.entryPrice * (pos.amount || 1))) * 100;
    pnlEl.className = `card-pnl ${pos.unrealizedPnl >= 0 ? 'positive' : 'negative'}`;
    pnlEl.textContent = `${pnlSign}$${pos.unrealizedPnl.toFixed(2)} (${pnlSign}${pnlPercent.toFixed(2)}%)`;

    statsEl.appendChild(priceEl);
    statsEl.appendChild(pnlEl);

    headerEl.appendChild(symbolWrap);
    headerEl.appendChild(statsEl);
    cardEl.appendChild(headerEl);

    // SL/TP Badge Row (Header Sub-bar)
    const sltpContainerEl = document.createElement('div');
    sltpContainerEl.className = 'card-sltp-row';
    sltpContainerEl.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; padding: 4px 12px; background: #111a2e; border-bottom: 1px solid #1e293b;';

    const sourceEl = document.createElement('span');
    sourceEl.className = 'source-label';
    sourceEl.textContent = `⚡ Kaynak: ${this.formatCategory(pos.sourceCategory)}`;

    const sltpBadges = document.createElement('div');
    sltpBadges.style.cssText = 'display: flex; gap: 6px; align-items: center;';

    const slTag = document.createElement('span');
    slTag.className = 'sltp-tag sl';
    slTag.textContent = pos.stopLoss ? `SL: $${pos.stopLoss.toLocaleString()}` : `SL: $${(pos.entryPrice * 0.98).toFixed(1)}`;

    const tpTag = document.createElement('span');
    tpTag.className = 'sltp-tag tp';
    tpTag.textContent = pos.takeProfit ? `TP: $${pos.takeProfit.toLocaleString()}` : `TP: $${(pos.entryPrice * 1.04).toFixed(1)}`;

    sltpBadges.appendChild(slTag);
    sltpBadges.appendChild(tpTag);

    sltpContainerEl.appendChild(sourceEl);
    sltpContainerEl.appendChild(sltpBadges);
    cardEl.appendChild(sltpContainerEl);

    // Chart Container
    const chartContainerEl = document.createElement('div');
    chartContainerEl.className = 'card-chart-container';
    cardEl.appendChild(chartContainerEl);

    // Footer
    const footerEl = document.createElement('div');
    footerEl.className = 'card-footer';

    const entryEl = document.createElement('span');
    entryEl.className = 'entry-label';
    entryEl.textContent = `Giriş: $${pos.entryPrice.toLocaleString()} | Miktar: ${pos.amount}`;

    const intervalLabel = document.createElement('span');
    intervalLabel.textContent = '15m • CCXT';

    footerEl.appendChild(entryEl);
    footerEl.appendChild(intervalLabel);
    cardEl.appendChild(footerEl);

    // Mount to DOM
    this.containerEl.appendChild(cardEl);

    // Initialize Lightweight Chart
    const chart = createChart(chartContainerEl, {
      width: chartContainerEl.clientWidth || 344,
      height: 160,
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#94a3b8',
        fontSize: 10,
        fontFamily: 'monospace',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#334155',
        scaleMargins: {
          top: 0.18,
          bottom: 0.18,
        },
      },
      crosshair: {
        vertLine: { color: '#38bdf8', width: 1, style: 2 },
        horzLine: { color: '#38bdf8', width: 1, style: 2 },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    // Initial Candle Data Fetch
    this.loadCandles(pos.symbol, series, chart);

    // 3. Draw Stop-Loss and Take-Profit Reference Lines on the Chart
    const stopLossPrice = pos.stopLoss || (side === 'LONG' ? pos.entryPrice * 0.98 : pos.entryPrice * 1.02);
    const takeProfitPrice = pos.takeProfit || (side === 'LONG' ? pos.entryPrice * 1.04 : pos.entryPrice * 0.96);

    let stopLossLine: IPriceLine | undefined;
    let takeProfitLine: IPriceLine | undefined;

    try {
      stopLossLine = series.createPriceLine({
        price: stopLossPrice,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: 'SL',
      });

      takeProfitLine = series.createPriceLine({
        price: takeProfitPrice,
        color: '#10b981',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: 'TP',
      });
    } catch (err) {
      console.warn('[PositionsChart] Error creating SL/TP price lines:', err);
    }

    // 30s Polling Interval for chart updates
    const pollInterval = setInterval(() => {
      this.loadCandles(pos.symbol, series, chart);
    }, 30000);

    // Auto Resize Observer for responsive charts
    let resizeTimer: any = null;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            chart.applyOptions({ width: entry.contentRect.width });
            chart.timeScale().fitContent();
          }, 50);
        }
      }
    });
    resizeObserver.observe(chartContainerEl);

    // Save Card State
    this.cards.set(pos.symbol, {
      symbol: pos.symbol,
      cardEl,
      chartContainerEl,
      chart,
      series,
      pollInterval,
      priceEl,
      pnlEl,
      sideTagEl,
      entryEl,
      sourceEl,
      sltpContainerEl,
      resizeObserver,
      stopLossLine,
      takeProfitLine,
    });
  }

  private formatCategory(category?: string): string {
    if (!category) return 'Algoritmik';
    if (category === 'crypto_specific') return 'Kripto Özel';
    if (category === 'defcon_1') return 'DEFCON 1';
    if (category === 'geopolitical') return 'Jeopolitik';
    if (category === 'macro_economic') return 'Makroekonomi';
    return category;
  }

  private async loadCandles(
    symbol: string,
    series: ISeriesApi<'Candlestick'>,
    chart: IChartApi
  ): Promise<void> {
    try {
      const candles = await apiService.fetchCandles(symbol, '15m', 80);
      if (Array.isArray(candles) && candles.length > 0) {
        const formatted: CandlestickData<Time>[] = candles.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));

        series.setData(formatted);
        chart.timeScale().fitContent();
      }
    } catch (err) {
      console.warn(`[PositionsChartManager] Error loading candles for ${symbol}:`, err);
    }
  }

  private updateExistingCard(state: PositionCardState, pos: PositionItem): void {
    const isProfit = pos.unrealizedPnl >= 0;
    state.cardEl.className = `position-card ${isProfit ? 'profit' : 'loss'}`;

    const curPrice = pos.currentPrice || pos.entryPrice;
    state.priceEl.textContent = `$${curPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const pnlSign = isProfit ? '+' : '';
    const pnlPercent =
      pos.percentagePnl !== undefined
        ? pos.percentagePnl
        : (pos.unrealizedPnl / (pos.entryPrice * (pos.amount || 1))) * 100;
    state.pnlEl.className = `card-pnl ${isProfit ? 'positive' : 'negative'}`;
    state.pnlEl.textContent = `${pnlSign}$${pos.unrealizedPnl.toFixed(2)} (${pnlSign}${pnlPercent.toFixed(2)}%)`;

    state.entryEl.textContent = `Giriş: $${pos.entryPrice.toLocaleString()} | Miktar: ${pos.amount}`;
    state.sourceEl.textContent = `⚡ Kaynak: ${this.formatCategory(pos.sourceCategory)}`;

    // Update SL/TP reference lines if changed
    if (pos.stopLoss && state.stopLossLine) {
      state.stopLossLine.applyOptions({ price: pos.stopLoss });
    }
    if (pos.takeProfit && state.takeProfitLine) {
      state.takeProfitLine.applyOptions({ price: pos.takeProfit });
    }
  }

  private removePositionCard(symbol: string, cardState: PositionCardState): void {
    clearInterval(cardState.pollInterval);

    try {
      cardState.resizeObserver.disconnect();
      if (cardState.stopLossLine) {
        cardState.series.removePriceLine(cardState.stopLossLine);
      }
      if (cardState.takeProfitLine) {
        cardState.series.removePriceLine(cardState.takeProfitLine);
      }
      cardState.chart.remove();
    } catch (e) {
      // Ignored
    }

    // Remove from DOM
    if (cardState.cardEl.parentNode) {
      cardState.cardEl.parentNode.removeChild(cardState.cardEl);
    }

    this.cards.delete(symbol);
  }

  private updatePlaceholderAndBadge(): void {
    const count = this.cards.size;

    if (this.countBadgeEl) {
      this.countBadgeEl.textContent = count.toString();
    }

    if (this.placeholderEl) {
      this.placeholderEl.style.display = count === 0 ? 'flex' : 'none';
    }
  }
}

export const positionsChartManager = new PositionsChartManager();
