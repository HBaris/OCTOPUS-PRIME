import { APP_CONFIG } from '../config.ts';
import { BaseEvent, EventType } from '../types/events.ts';

export type ConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
export type EventHandler<T = any> = (payload: T, event: BaseEvent<T>) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private urlIndex = 0;
  private lastWorkingUrlIndex = 0;
  private consecutiveFailures = 0;
  private isExplicitlyClosed = false;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private status: ConnectionStatus = 'DISCONNECTED';
  private reconnectTimer: any = null;
  private pingInterval: any = null;

  constructor() {
    this.connect();
    this.setupHMRCleanup();
  }

  private setupHMRCleanup(): void {
    if (import.meta && (import.meta as any).hot) {
      (import.meta as any).hot.dispose(() => {
        console.log('[WS] Cleaning up WebSocket connection for Vite HMR...');
        this.close();
      });
    }
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      for (const listener of this.statusListeners) {
        try {
          listener(newStatus);
        } catch (e) {
          console.error('[WS] Error in status listener:', e);
        }
      }
    }
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    this.setStatus('CONNECTING');

    const targetUrl = APP_CONFIG.WS_URLS[this.urlIndex % APP_CONFIG.WS_URLS.length];
    console.log(`[WS] Connecting to ${targetUrl}...`);

    try {
      this.ws = new WebSocket(targetUrl);

      this.ws.onopen = () => {
        console.log(`[WS] Connected successfully to ${targetUrl}`);
        this.setStatus('CONNECTED');
        this.lastWorkingUrlIndex = this.urlIndex;
        this.consecutiveFailures = 0;

        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        // Start client-side keepalive ping every 20 seconds
        this.startKeepAlive();
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as BaseEvent;
          if (parsed && parsed.type) {
            if ((parsed.type as string) === 'PONG') {
              // Internal keep-alive heartbeat response
              return;
            }
            this.emitEvent(parsed.type, parsed.payload, parsed);
          }
        } catch (err) {
          console.warn('[WS] Failed to parse incoming WebSocket message:', event.data);
        }
      };

      this.ws.onclose = () => {
        this.stopKeepAlive();
        this.setStatus('DISCONNECTED');
        this.ws = null;

        if (!this.isExplicitlyClosed) {
          this.consecutiveFailures++;
          // If failed repeatedly on this URL, try next fallback
          if (this.consecutiveFailures >= 2) {
            this.urlIndex = (this.urlIndex + 1) % APP_CONFIG.WS_URLS.length;
          } else {
            // Otherwise retry the last known working URL first
            this.urlIndex = this.lastWorkingUrlIndex;
          }
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn(`[WS] WebSocket error on ${targetUrl}:`, err);
      };
    } catch (err) {
      console.warn('[WS] Error instantiating WebSocket:', err);
      this.setStatus('DISCONNECTED');
      this.consecutiveFailures++;
      this.urlIndex = (this.urlIndex + 1) % APP_CONFIG.WS_URLS.length;
      this.scheduleReconnect();
    }
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
      }
    }, 20000);
  }

  private stopKeepAlive(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    // Exponential backoff: 1s, 2s, 3s, max 5s
    const delay = Math.min(1000 * Math.pow(1.3, this.consecutiveFailures), 5000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  public on<T = any>(type: EventType | '*', handler: EventHandler<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);

    return () => {
      this.listeners.get(type)?.delete(handler);
    };
  }

  private emitEvent(type: EventType, payload: any, fullEvent: BaseEvent): void {
    // Specific event listeners
    const specificHandlers = this.listeners.get(type);
    if (specificHandlers) {
      for (const handler of specificHandlers) {
        try {
          handler(payload, fullEvent);
        } catch (err) {
          console.error(`[WS] Error in event handler for ${type}:`, err);
        }
      }
    }

    // Wildcard listeners
    const wildcardHandlers = this.listeners.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler(payload, fullEvent);
        } catch (err) {
          console.error(`[WS] Error in wildcard handler for ${type}:`, err);
        }
      }
    }
  }

  public send(type: string, payload?: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload, timestamp: new Date().toISOString() }));
    } else {
      console.warn('[WS] Cannot send message, socket is not open:', type);
    }
  }

  public close(): void {
    this.isExplicitlyClosed = true;
    this.stopKeepAlive();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('DISCONNECTED');
  }
}

export const wsService = new WebSocketService();
