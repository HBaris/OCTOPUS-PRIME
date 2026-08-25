import { BaseRoomScene } from './BaseRoomScene.ts';
import { AgentRole, TradeProposalPayload } from '../types/events.ts';
import { AGENT_CONFIGS } from '../config.ts';
import { wsService } from '../services/websocket.ts';

export class PatronRoomScene extends BaseRoomScene {
  protected agentRole: AgentRole = 'Patron';
  protected roomName = 'Baş Analist & Yönetim Odası (Patron)';

  private wsUnsub: (() => void) | null = null;

  constructor() {
    super({ key: 'PatronRoomScene' });
  }

  protected createRoomContent(): void {
    const config = AGENT_CONFIGS.find((a) => a.role === this.agentRole)!;

    // Executive Suite Decor: Luxury Mahogany Furniture, Decision Board, Chandelier/Plants
    this.add.image(200, 240, 'patron_summary_board');
    this.add.image(760, 240, 'news_board');
    this.add.image(80, 240, 'plant_texture');
    this.add.image(880, 240, 'plant_texture');

    this.add.text(200, 290, '🎩 NİHAİ KARAR MASASI', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#fbbf24',
    }).setOrigin(0.5);

    this.add.text(760, 290, '📊 TÜM EKİP KORELASYONLARI', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    // Patron Character at Luxury Mahogany Desk
    this.createAgentCharacter(config, 480, 360);

    // Listen to TRADE_PROPOSAL for Patron's executive speech
    this.wsUnsub = wsService.on<TradeProposalPayload>('TRADE_PROPOSAL', (payload) => {
      const line = `Ekip raporlarını inceledim, ${payload.symbol} için ${payload.side} kararı verdim, Kaptan onayına sunuyorum. 🎩`;
      this.queueDialogue(line);
    });
  }

  shutdown(): void {
    super.shutdown();
    if (this.wsUnsub) {
      this.wsUnsub();
      this.wsUnsub = null;
    }
  }
}
