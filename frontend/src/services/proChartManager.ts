import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  LineData,
  ColorType,
  Time,
  LineStyle,
  IPriceLine,
} from 'lightweight-charts';
import { wsService } from './websocket.ts';
import { apiService } from './api.ts';
import { PortfolioUpdatePayload } from '../types/events.ts';

export interface TickerData {
  symbol: string;
  lastPrice: number;
  change24hPercent: number;
  high24h: number;
  low24h: number;
  volume24hUsd: number;
}

export class ProChartManager {
  private containerEl!: HTMLElement;
  private chartApi!: IChartApi;
  private candleSeries!: ISeriesApi<'Candlestick'>;
  private volumeSeries!: ISeriesApi<'Histogram'>;
  private ma7Series!: ISeriesApi<'Line'>;
  private ma25Series!: ISeriesApi<'Line'>;
  private ma99Series!: ISeriesApi<'Line'>;

  // Price overlay lines for active position
  private entryPriceLine?: IPriceLine;
  private stopLossLine?: IPriceLine;
  private takeProfitLine?: IPriceLine;
  private liquidationLine?: IPriceLine;

  // State
  private currentSymbol: string = 'ALT/USDT';
  private currentTimeframe: string = '15m';
  private activePositions: Map<string, any> = new Map();

  // DOM Elements
  private symbolTitleEl!: HTMLElement;
  private priceValEl!: HTMLElement;
  private changeValEl!: HTMLElement;
  private highValEl!: HTMLElement;
  private lowValEl!: HTMLElement;
  private volValEl!: HTMLElement;
  private orderBookBidsEl!: HTMLElement;
  private orderBookAsksEl!: HTMLElement;
  private marketTradesListEl!: HTMLElement;
  private symbolSelectEl!: HTMLSelectElement;

  constructor() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  private init(): void {
    this.createProChartUI();
    this.initLightweightChart();
    this.setupEventListeners();
    this.loadSymbolData(this.currentSymbol, this.currentTimeframe);
  }

  private createProChartUI(): void {
    let panel = document.getElementById('pro-chart-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'pro-chart-panel';
      panel.className = 'pro-chart-panel';

      // Insert before or inside app layout
      const appLayout = document.getElementById('app-layout');
      if (appLayout && appLayout.parentNode) {
        appLayout.parentNode.insertBefore(panel, appLayout);
      } else {
        document.body.appendChild(panel);
      }
    }

    panel.innerHTML = `
      <!-- Pro Chart Header Ticker Strip -->
      <div class="pro-header-strip">
        <div class="pro-symbol-group">
          <div class="symbol-select-wrapper">
            <select id="pro-symbol-select" class="pro-symbol-select">
              <option value="ALT/USDT">ALT/USDT</option>
              <option value="BTC/USDT">BTC/USDT</option>
              <option value="ETH/USDT">ETH/USDT</option>
              <option value="SOL/USDT">SOL/USDT</option>
              <option value="AVAX/USDT">AVAX/USDT</option>
              <option value="NEAR/USDT">NEAR/USDT</option>
              <option value="DOGE/USDT">DOGE/USDT</option>
              <option value="PEPE/USDT">PEPE/USDT</option>
              <option value="SUI/USDT">SUI/USDT</option>
              <option value="ARB/USDT">ARB/USDT</option>
              <option value="1000CAT/USDT">1000CAT/USDT</option>
              <option value="1000CHEEMS/USDT">1000CHEEMS/USDT</option>
              <option value="1000SATS/USDT">1000SATS/USDT</option>
              <option value="1MBABYDOGE/USDT">1MBABYDOGE/USDT</option>
            </select>
          </div>
          <h2 id="pro-symbol-title" class="pro-symbol-title">ALT/USDT</h2>
          <span class="pro-market-badge">PERP ISOLATED</span>
        </div>

        <div class="pro-metrics-group">
          <div class="pro-metric-item">
            <span class="metric-lbl">Son Fiyat</span>
            <span id="pro-price-val" class="metric-val text-green">$0.00806</span>
          </div>
          <div class="pro-metric-item">
            <span class="metric-lbl">24s Değişim</span>
            <span id="pro-change-val" class="metric-val text-green">+7.81%</span>
          </div>
          <div class="pro-metric-item">
            <span class="metric-lbl">24s En Yüksek</span>
            <span id="pro-high-val" class="metric-val">$0.00810</span>
          </div>
          <div class="pro-metric-item">
            <span class="metric-lbl">24s En Düşük</span>
            <span id="pro-low-val" class="metric-val">$0.00742</span>
          </div>
          <div class="pro-metric-item">
            <span class="metric-lbl">24s Hacim (USDT)</span>
            <span id="pro-vol-val" class="metric-val">$871,313</span>
          </div>
        </div>

        <!-- Timeframe Toolbar -->
        <div class="pro-timeframe-toolbar">
          <button class="tf-btn" data-tf="1m">1m</button>
          <button class="tf-btn" data-tf="5m">5m</button>
          <button class="tf-btn active" data-tf="15m">15m</button>
          <button class="tf-btn" data-tf="1h">1h</button>
          <button class="tf-btn" data-tf="4h">4h</button>
        </div>
      </div>

      <!-- Main Pro Chart Area + Orderbook Side Panels -->
      <div class="pro-chart-body">
        <!-- Order Book Left Panel -->
        <div class="pro-side-panel orderbook-panel">
          <div class="panel-header">Derinlik (Order Book)</div>
          <div class="orderbook-list">
            <div class="ob-section asks-section" id="pro-ob-asks">
              <!-- Asks rendered here -->
            </div>
            <div class="ob-mid-price" id="pro-ob-mid-price">$0.00806</div>
            <div class="ob-section bids-section" id="pro-ob-bids">
              <!-- Bids rendered here -->
            </div>
          </div>
        </div>

        <!-- Center Pro Chart Container -->
        <div class="pro-chart-canvas-wrapper">
          <div class="pro-chart-legend">
            <span class="legend-ma ma7">MA(7): <b id="ma7-val">-</b></span>
            <span class="legend-ma ma25">MA(25): <b id="ma25-val">-</b></span>
            <span class="legend-ma ma99">MA(99): <b id="ma99-val">-</b></span>
            <span class="legend-vol">VOL: <b id="vol-val">-</b></span>
          </div>
          <div id="pro-chart-canvas" class="pro-chart-canvas"></div>
        </div>

        <!-- Market Trades Right Panel -->
        <div class="pro-side-panel trades-panel">
          <div class="panel-header">Son İşlemler (Trades)</div>
          <div class="trades-list" id="pro-market-trades">
            <!-- Market trades rendered here -->
          </div>
        </div>
      </div>
    `;

    this.containerEl = panel.querySelector('#pro-chart-canvas') as HTMLElement;
    this.symbolTitleEl = panel.querySelector('#pro-symbol-title') as HTMLElement;
    this.priceValEl = panel.querySelector('#pro-price-val') as HTMLElement;
    this.changeValEl = panel.querySelector('#pro-change-val') as HTMLElement;
    this.highValEl = panel.querySelector('#pro-high-val') as HTMLElement;
    this.lowValEl = panel.querySelector('#pro-low-val') as HTMLElement;
    this.volValEl = panel.querySelector('#pro-vol-val') as HTMLElement;
    this.orderBookBidsEl = panel.querySelector('#pro-ob-bids') as HTMLElement;
    this.orderBookAsksEl = panel.querySelector('#pro-ob-asks') as HTMLElement;
    this.marketTradesListEl = panel.querySelector('#pro-market-trades') as HTMLElement;
    this.symbolSelectEl = panel.querySelector('#pro-symbol-select') as HTMLSelectElement;
  }

  private initLightweightChart(): void {
    if (!this.containerEl) return;

    this.chartApi = createChart(this.containerEl, {
      width: this.containerEl.clientWidth || 640,
      height: 480,
      layout: {
        background: { type: ColorType.Solid, color: '#090d16' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.4)', style: LineStyle.Dotted },
        horzLines: { color: 'rgba(30, 41, 59, 0.4)', style: LineStyle.Dotted },
      },
      crosshair: {
        mode: 0, // Normal crosshair
        vertLine: { color: '#38bdf8', width: 1, style: LineStyle.Dashed },
        horzLine: { color: '#38bdf8', width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        textColor: '#cbd5e1',
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // 1. Candlestick Series
    this.candleSeries = this.chartApi.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    // 2. Volume Histogram Series (lower pane)
    this.volumeSeries = this.chartApi.addSeries(HistogramSeries, {
      color: '#38bdf8',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    this.volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // 3. Moving Average Line Series
    this.ma7Series = this.chartApi.addSeries(LineSeries, {
      color: '#eab308',
      lineWidth: 1,
      crosshairMarkerVisible: false,
    });

    this.ma25Series = this.chartApi.addSeries(LineSeries, {
      color: '#ec4899',
      lineWidth: 1,
      crosshairMarkerVisible: false,
    });

    this.ma99Series = this.chartApi.addSeries(LineSeries, {
      color: '#8b5cf6',
      lineWidth: 1,
      crosshairMarkerVisible: false,
    });

    // Resize Observer
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === this.containerEl) {
          const w = entry.contentRect.width;
          if (w > 0) this.chartApi.applyOptions({ width: w });
        }
      }
    });
    ro.observe(this.containerEl);
  }

  private setupEventListeners(): void {
    // 1. Symbol Selector Dropdown
    this.symbolSelectEl?.addEventListener('change', (e) => {
      const selected = (e.target as HTMLSelectElement).value;
      this.switchSymbol(selected);
    });

    // 2. Timeframe Buttons
    const tfBtns = document.querySelectorAll('.pro-timeframe-toolbar .tf-btn');
    tfBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tfBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const tf = btn.getAttribute('data-tf') || '15m';
        this.currentTimeframe = tf;
        this.loadSymbolData(this.currentSymbol, tf);
      });
    });

    // 3. WebSocket Portfolio Updates to draw active position overlay lines
    wsService.on<PortfolioUpdatePayload>('PORTFOLIO_UPDATE', (payload) => {
      if (payload && Array.isArray(payload.positions)) {
        this.activePositions.clear();
        for (const pos of payload.positions) {
          this.activePositions.set(pos.symbol, pos);
        }
        // If current displayed symbol is active, update price overlay lines
        if (this.activePositions.has(this.currentSymbol)) {
          this.updatePositionOverlayLines(this.activePositions.get(this.currentSymbol));
        } else {
          this.clearPositionOverlayLines();
        }
      }
    });
  }

  public async switchSymbol(symbol: string): Promise<void> {
    if (!symbol) return;
    this.currentSymbol = symbol;
    if (this.symbolTitleEl) this.symbolTitleEl.textContent = symbol;
    if (this.symbolSelectEl && this.symbolSelectEl.value !== symbol) {
      // Add symbol to dropdown if not existing
      let opt = this.symbolSelectEl.querySelector(`option[value="${symbol}"]`);
      if (!opt) {
        opt = document.createElement('option');
        (opt as HTMLOptionElement).value = symbol;
        opt.textContent = symbol;
        this.symbolSelectEl.appendChild(opt);
      }
      this.symbolSelectEl.value = symbol;
    }

    await this.loadSymbolData(symbol, this.currentTimeframe);

    // If active position exists for this symbol, draw price lines
    if (this.activePositions.has(symbol)) {
      this.updatePositionOverlayLines(this.activePositions.get(symbol));
    } else {
      this.clearPositionOverlayLines();
    }
  }

  private async loadSymbolData(symbol: string, timeframe: string): Promise<void> {
    try {
      let candles = await apiService.fetchCandles(symbol, timeframe);
      if (!candles || candles.length === 0) {
        candles = this.generateFallbackCandles(symbol);
      }

      const formattedCandles: CandlestickData<Time>[] = [];
      const formattedVol: HistogramData<Time>[] = [];
      const closes: number[] = [];

      for (const c of candles) {
        const timeVal = (new Date(c.timestamp).getTime() / 1000) as Time;
        formattedCandles.push({
          time: timeVal,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        });

        formattedVol.push({
          time: timeVal,
          value: c.volume || 1000,
          color: c.close >= c.open ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)',
        });

        closes.push(c.close);
      }

      this.candleSeries.setData(formattedCandles);
      this.volumeSeries.setData(formattedVol);

      // Compute Moving Averages
      const ma7Data = this.calculateMA(formattedCandles, 7);
      const ma25Data = this.calculateMA(formattedCandles, 25);
      const ma99Data = this.calculateMA(formattedCandles, 99);

      this.ma7Series.setData(ma7Data);
      this.ma25Series.setData(ma25Data);
      this.ma99Series.setData(ma99Data);

      // Update Ticker Info
      const lastCandle = candles[candles.length - 1];
      const firstCandle = candles[0];
      const changePct = ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100;
      const high24h = Math.max(...candles.map((c: any) => c.high));
      const low24h = Math.min(...candles.map((c: any) => c.low));
      const vol24h = candles.reduce((acc: number, c: any) => acc + (c.volume || 0) * c.close, 0);

      this.updateTickerDisplay({
        symbol,
        lastPrice: lastCandle.close,
        change24hPercent: changePct,
        high24h,
        low24h,
        volume24hUsd: vol24h > 0 ? vol24h : 871313,
      });

      // Update Order Book & Market Trades simulation for selected symbol
      this.renderOrderBookAndTrades(lastCandle.close);

      this.chartApi.timeScale().fitContent();
    } catch (err) {
      console.warn(`Failed to load chart data for ${symbol}:`, err);
    }
  }

  private calculateMA(candles: CandlestickData<Time>[], period: number): LineData<Time>[] {
    const maData: LineData<Time>[] = [];
    for (let i = 0; i < candles.length; i++) {
      if (i < period - 1) continue;
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += candles[i - j].close;
      }
      maData.push({
        time: candles[i].time,
        value: sum / period,
      });
    }
    return maData;
  }

  private updateTickerDisplay(data: TickerData): void {
    if (this.priceValEl) {
      this.priceValEl.textContent = `$${data.lastPrice < 1 ? data.lastPrice.toFixed(5) : data.lastPrice.toFixed(2)}`;
      this.priceValEl.className = `metric-val ${data.change24hPercent >= 0 ? 'text-green' : 'text-red'}`;
    }
    if (this.changeValEl) {
      this.changeValEl.textContent = `${data.change24hPercent >= 0 ? '+' : ''}${data.change24hPercent.toFixed(2)}%`;
      this.changeValEl.className = `metric-val ${data.change24hPercent >= 0 ? 'text-green' : 'text-red'}`;
    }
    if (this.highValEl) this.highValEl.textContent = `$${data.high24h < 1 ? data.high24h.toFixed(5) : data.high24h.toFixed(2)}`;
    if (this.lowValEl) this.lowValEl.textContent = `$${data.low24h < 1 ? data.low24h.toFixed(5) : data.low24h.toFixed(2)}`;
    if (this.volValEl) this.volValEl.textContent = `$${Math.round(data.volume24hUsd).toLocaleString()}`;
  }

  private renderOrderBookAndTrades(basePrice: number): void {
    if (!this.orderBookAsksEl || !this.orderBookBidsEl || !this.marketTradesListEl) return;

    // Generate 6 Ask depth rows
    let asksHtml = '';
    for (let i = 6; i >= 1; i--) {
      const p = basePrice * (1 + i * 0.0004);
      const qty = Math.floor(Math.random() * 8000 + 500);
      const total = (p * qty).toFixed(1);
      asksHtml += `<div class="ob-row ask-row">
        <span class="ob-price text-red">$${p < 1 ? p.toFixed(5) : p.toFixed(2)}</span>
        <span class="ob-qty">${qty}</span>
        <span class="ob-total">$${total}</span>
      </div>`;
    }
    this.orderBookAsksEl.innerHTML = asksHtml;

    // Mid price
    const midEl = document.getElementById('pro-ob-mid-price');
    if (midEl) midEl.textContent = `$${basePrice < 1 ? basePrice.toFixed(5) : basePrice.toFixed(2)}`;

    // Generate 6 Bid depth rows
    let bidsHtml = '';
    for (let i = 1; i <= 6; i++) {
      const p = basePrice * (1 - i * 0.0004);
      const qty = Math.floor(Math.random() * 8000 + 500);
      const total = (p * qty).toFixed(1);
      bidsHtml += `<div class="ob-row bid-row">
        <span class="ob-price text-green">$${p < 1 ? p.toFixed(5) : p.toFixed(2)}</span>
        <span class="ob-qty">${qty}</span>
        <span class="ob-total">$${total}</span>
      </div>`;
    }
    this.orderBookBidsEl.innerHTML = bidsHtml;

    // Generate Market Trades Feed
    let tradesHtml = '';
    const now = new Date();
    for (let i = 0; i < 8; i++) {
      const isBuy = Math.random() > 0.45;
      const deltaP = (Math.random() - 0.5) * 0.001 * basePrice;
      const p = basePrice + deltaP;
      const qty = Math.floor(Math.random() * 5000 + 100);
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String((now.getSeconds() - i * 2 + 60) % 60).padStart(2, '0')}`;
      tradesHtml += `<div class="trade-row ${isBuy ? 'trade-buy' : 'trade-sell'}">
        <span class="trade-price">${p < 1 ? p.toFixed(5) : p.toFixed(2)}</span>
        <span class="trade-qty">${qty}</span>
        <span class="trade-time">${timeStr}</span>
      </div>`;
    }
    this.marketTradesListEl.innerHTML = tradesHtml;
  }

  private updatePositionOverlayLines(pos: any): void {
    this.clearPositionOverlayLines();
    if (!pos) return;

    // 1. Entry Price Line
    if (pos.entryPrice) {
      this.entryPriceLine = this.candleSeries.createPriceLine({
        price: pos.entryPrice,
        color: '#0284c7',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `GİRİŞ: $${pos.entryPrice}`,
      });
    }

    // 2. Take Profit Line
    if (pos.takeProfit) {
      this.takeProfitLine = this.candleSeries.createPriceLine({
        price: pos.takeProfit,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `TP: $${pos.takeProfit}`,
      });
    }

    // 3. Stop Loss Line
    if (pos.stopLoss) {
      this.stopLossLine = this.candleSeries.createPriceLine({
        price: pos.stopLoss,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `SL: $${pos.stopLoss}`,
      });
    }

    // 4. Liquidation Line
    if (pos.liquidationPrice && pos.liquidationPrice > 0) {
      this.liquidationLine = this.candleSeries.createPriceLine({
        price: pos.liquidationPrice,
        color: '#f97316',
        lineWidth: 2,
        lineStyle: LineStyle.LargeDashed,
        axisLabelVisible: true,
        title: `LİKİDASYON: $${pos.liquidationPrice}`,
      });
    }
  }

  private clearPositionOverlayLines(): void {
    if (this.entryPriceLine) {
      this.candleSeries.removePriceLine(this.entryPriceLine);
      this.entryPriceLine = undefined;
    }
    if (this.takeProfitLine) {
      this.candleSeries.removePriceLine(this.takeProfitLine);
      this.takeProfitLine = undefined;
    }
    if (this.stopLossLine) {
      this.candleSeries.removePriceLine(this.stopLossLine);
      this.stopLossLine = undefined;
    }
    if (this.liquidationLine) {
      this.candleSeries.removePriceLine(this.liquidationLine);
      this.liquidationLine = undefined;
    }
  }

  private generateFallbackCandles(symbol: string): any[] {
    const candles: any[] = [];
    const now = Date.now();
    const intervalMs = 15 * 60 * 1000;
    const basePrice = symbol.includes('PEPE')
      ? 0.000009
      : symbol.includes('DOGE')
      ? 0.14
      : symbol.includes('BTC')
      ? 68000
      : symbol.includes('ETH')
      ? 2600
      : symbol.includes('SOL')
      ? 140
      : 2.5;

    let current = basePrice;
    for (let i = 50; i >= 0; i--) {
      const ts = now - i * intervalMs;
      const variation = (Math.sin(i * 0.5) + (Math.random() - 0.48)) * (basePrice * 0.008);
      const open = current;
      const close = current + variation;
      const high = Math.max(open, close) + basePrice * 0.004;
      const low = Math.min(open, close) - basePrice * 0.004;
      candles.push({
        timestamp: ts,
        open: Math.max(0.000001, open),
        high: Math.max(0.000001, high),
        low: Math.max(0.000001, low),
        close: Math.max(0.000001, close),
        volume: Math.round(10000 + Math.random() * 50000),
      });
      current = close;
    }
    return candles;
  }
}

export const proChartManager = new ProChartManager();
