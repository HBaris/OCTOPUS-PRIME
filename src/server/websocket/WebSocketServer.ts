import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { eventBus } from '../../events/EventBus.js';
import { EventType, FeedbackEmoji } from '../../config/constants.js';
import { AgentManager } from '../../agents/AgentManager.js';
import { FeedbackSystem } from '../../services/feedback/FeedbackSystem.js';
import { NewsRadar } from '../../services/news/NewsRadar.js';
import { logger } from '../../utils/logger.js';

export class WebSocketServer {
  private wss: WSServer;
  private agentManager: AgentManager;
  private feedbackSystem: FeedbackSystem;
  private newsRadar: NewsRadar;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    server: HttpServer | null,
    port: number,
    agentManager: AgentManager,
    feedbackSystem: FeedbackSystem,
    newsRadar: NewsRadar
  ) {
    this.agentManager = agentManager;
    this.feedbackSystem = feedbackSystem;
    this.newsRadar = newsRadar;

    if (server) {
      this.wss = new WSServer({ server, path: '/ws' });
      logger.info(`🔌 WebSocket server attached to HTTP server on path /ws`);
    } else {
      this.wss = new WSServer({ port });
      logger.info(`🔌 Standalone WebSocket server listening on port ${port}`);
    }

    this.init();
  }

  private init(): void {
    this.wss.on('connection', async (ws: WebSocket, req) => {
      const clientIp = req.socket.remoteAddress;
      logger.info(`⚡ [WebSocket] Client connected from ${clientIp} (Total clients: ${this.wss.clients.size})`);

      // Send initial state snapshot upon connection
      try {
        const initialState = await this.agentManager.getSystemState();
        ws.send(
          JSON.stringify({
            type: EventType.SYSTEM_STATUS,
            timestamp: new Date().toISOString(),
            payload: initialState,
          })
        );
      } catch (err) {
        logger.error('Error sending initial state to WS client:', err);
      }

      // Handle incoming messages from frontend
      ws.on('message', async (data: Buffer | string) => {
        try {
          const parsed = JSON.parse(data.toString());
          await this.handleClientMessage(ws, parsed);
        } catch (err) {
          logger.warn('Invalid JSON message received on WebSocket:', data.toString());
          ws.send(JSON.stringify({ error: 'Invalid JSON format' }));
        }
      });

      ws.on('close', () => {
        logger.info(`🔌 [WebSocket] Client disconnected (Remaining: ${this.wss.clients.size})`);
      });

      ws.on('error', (err) => {
        logger.error('[WebSocket] Client error:', err);
      });
    });

    // Bridge all EventBus events to WebSocket clients
    eventBus.on('*', (event) => {
      this.broadcast(event);
    });

    // Heartbeat to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.ping();
        }
      }
    }, 30000);
  }

  private async handleClientMessage(ws: WebSocket, msg: { type?: string; payload?: any }): Promise<void> {
    switch (msg.type) {
      case 'PING':
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        break;

      case 'REQUEST_STATE': {
        const state = await this.agentManager.getSystemState();
        ws.send(JSON.stringify({ type: EventType.SYSTEM_STATUS, payload: state }));
        break;
      }

      case 'SUBMIT_FEEDBACK': {
        if (msg.payload && msg.payload.targetId && msg.payload.emoji) {
          const emoji = msg.payload.emoji as FeedbackEmoji;
          const recorded = this.feedbackSystem.recordFeedback(
            msg.payload.targetId,
            emoji,
            msg.payload.userNotes
          );
          ws.send(JSON.stringify({ type: 'FEEDBACK_ACK', payload: recorded }));
        }
        break;
      }

      case 'TRIGGER_SCAN': {
        const discovered = await this.newsRadar.scanOnce();
        ws.send(JSON.stringify({ type: 'SCAN_COMPLETE', payload: { count: discovered.length } }));
        break;
      }

      default:
        logger.debug('[WebSocket] Unhandled client message type:', msg.type);
    }
  }

  public broadcast(data: unknown): void {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
  }
}
