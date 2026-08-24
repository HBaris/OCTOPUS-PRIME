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
};
