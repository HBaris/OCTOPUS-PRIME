import { APP_CONFIG } from '../config.ts';
import { BaseEvent, EventType } from '../types/events.ts';

export type ConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
export type EventHandler<T = any> = (payload: T, event: BaseEvent<T>) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private urlIndex = 0;
  private isExplicitlyClosed = false;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private status: ConnectionStatus = 'DISCONNECTED';
  private reconnectTimer: any = null;

  constructor() {
    this.connect();
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
    console.log(`[WS] Attempting connection to ${targetUrl}...`);

    try {
      this.ws = new WebSocket(targetUrl);

      this.ws.onopen = () => {
        console.log(`[WS] Connected successfully to ${targetUrl}`);
        this.setStatus('CONNECTED');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as BaseEvent;
          if (parsed && parsed.type) {
            this.emitEvent(parsed.type, parsed.payload, parsed);
          }
        } catch (err) {
          console.warn('[WS] Failed to parse incoming WebSocket message:', event.data);
        }
      };

      this.ws.onclose = () => {
        console.log('[WS] Connection closed.');
        this.setStatus('DISCONNECTED');
        this.ws = null;
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn(`[WS] Connection error on ${targetUrl} (will try fallback/reconnect):`, err);
        // Switch to next fallback URL
        this.urlIndex++;
      };
    } catch (err) {
      console.warn('[WS] Error initializing WebSocket:', err);
      this.setStatus('DISCONNECTED');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, APP_CONFIG.RECONNECT_INTERVAL_MS);
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
