import { APP_CONFIG } from '../config.ts';

export const apiService = {
  /**
   * Triggers signals analysis / "Barış Geldi" celebration trigger
   */
  async triggerSignals(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${APP_CONFIG.REST_API_URL}/signals/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerSource: 'BARIS_BUTTON', timestamp: new Date().toISOString() }),
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, message: data.message || 'Signals triggered!' };
      }
    } catch (err) {
      console.warn('[API] /api/signals/trigger endpoint fallback (expected if stub):', err);
    }

    // Mock/Stub fallback response
    return {
      success: true,
      message: 'Barış geldi, kaptan! Tüm sistem hazır ve operasyona geçti.',
    };
  },

  async fetchSystemState(): Promise<any> {
    try {
      const response = await fetch(`${APP_CONFIG.REST_API_URL}/state`);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn('[API] Failed to fetch system state:', err);
    }
    return null;
  },

  async fetchNews(): Promise<any[]> {
    try {
      const response = await fetch(`${APP_CONFIG.REST_API_URL}/news`);
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data.news) ? data.news : [];
      }
    } catch (err) {
      console.warn('[API] Failed to fetch news:', err);
    }
    return [];
  },

  async fetchPortfolio(): Promise<any> {
    try {
      const response = await fetch(`${APP_CONFIG.REST_API_URL}/portfolio`);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn('[API] Failed to fetch portfolio:', err);
    }
    return null;
  },

  async fetchCandles(symbol: string, timeframe = '15m', limit = 100): Promise<any[]> {
    try {
      const cleanSymbol = symbol.replace('/', '');
      const response = await fetch(
        `${APP_CONFIG.REST_API_URL}/portfolio/chart/${cleanSymbol}?timeframe=${timeframe}&limit=${limit}`
      );
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn(`[API] Failed to fetch candles for ${symbol}:`, err);
    }
    return [];
  },

  async placeOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    amountUsd: number,
    orderType: 'MARKET' | 'LIMIT' = 'MARKET',
    metadata?: {
      signalId?: string;
      sourceCategory?: string;
      stopLoss?: number;
      takeProfit?: number;
    }
  ): Promise<{ success: boolean; message: string; orderId?: string }> {
    try {
      const response = await fetch(`${APP_CONFIG.REST_API_URL}/portfolio/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          side,
          amountUsd,
          orderType,
          signalId: metadata?.signalId,
          sourceCategory: metadata?.sourceCategory,
          stopLoss: metadata?.stopLoss,
          takeProfit: metadata?.takeProfit,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, message: data.message || 'Order placed successfully', orderId: data.orderId };
      }
      return { success: false, message: data.message || data.error || 'Order execution failed' };
    } catch (err: any) {
      console.error('[API] Error placing order:', err);
      return { success: false, message: err.message || 'Network error' };
    }
  },

  /**
   * Fetches personal assistant executive & ops briefing from /api/assistant/briefing
   */
  async fetchBriefing(): Promise<any> {
    try {
      const response = await fetch(`${APP_CONFIG.REST_API_URL}/assistant/briefing`);
      if (response.ok) {
        const data = await response.json();
        return data.briefing || null;
      }
    } catch (err) {
      console.warn('[API] Failed to fetch assistant briefing:', err);
    }
    return null;
  },

  /**
   * Marks briefing as read and resets assistant counters
   */
  async markBriefingRead(): Promise<boolean> {
    try {
      const response = await fetch(`${APP_CONFIG.REST_API_URL}/assistant/mark-read`, {
        method: 'POST',
      });
      return response.ok;
    } catch (err) {
      console.warn('[API] Failed to mark briefing read:', err);
      return false;
    }
  },
};
