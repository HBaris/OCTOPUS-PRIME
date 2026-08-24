import { EventEmitter } from 'events';
import { EventType } from '../config/constants.js';
import { BaseEvent } from '../types/events.js';
import { logger } from '../utils/logger.js';

export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private eventHistory: BaseEvent[] = [];
  private readonly maxHistorySize = 200;

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public publish<T>(type: EventType, payload: T): BaseEvent<T> {
    const event: BaseEvent<T> = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      timestamp: new Date().toISOString(),
      payload,
    };

    // Store in history
    this.eventHistory.unshift(event as BaseEvent);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.pop();
    }

    logger.debug(`[EventBus] Emitting ${type}:`, payload);
    
    // Emit typed and generic wildcard
    this.emit(type, event);
    this.emit('*', event);

    return event;
  }

  public getRecentEvents(limit = 50): BaseEvent[] {
    return this.eventHistory.slice(0, limit);
  }

  public clearHistory(): void {
    this.eventHistory = [];
  }
}

export const eventBus = EventBus.getInstance();
