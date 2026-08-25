import { BaseRoomScene } from './BaseRoomScene.ts';
import { AGENT_CONFIGS } from '../config.ts';
import { wsService } from '../services/websocket.ts';
import { TradeProposalPayload } from '../types/events.ts';

export class PatronRoomScene extends BaseRoomScene {
  protected roomKey = 'PatronRoomScene';
  protected roomName = 'Yönetim Odası (Patron & Sekreterya)';

  private wsUnsub: (() => void) | null = null;

  constructor() {
    super({ key: 'PatronRoomScene' });
  }

  protected createRoomContent(): void {
    const patronCfg = AGENT_CONFIGS.find((a) => a.role === 'Patron')!;
    const secCfg = AGENT_CONFIGS.find((a) => a.role === 'Sekreterya')!;

    // Executive Suite Decor: Luxury Mahogany Decision Board & Status Displays
    this.add.image(220, 230, 'patron_summary_board');
    this.add.image(740, 230, 'news_board');
    this.add.image(60, 240, 'plant_texture');
    this.add.image(900, 240, 'cooler_texture');

    this.add.text(220, 280, '🎩 NİHAİ KARAR MASASI', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#fbbf24',
    }).setOrigin(0.5);

    this.add.text(740, 280, '📋 OPERASYON KAYITLARI', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    // 1. Patron Character at Grand Mahogany Desk (Left-Center)
    this.createAgentCharacter(patronCfg, 360, 380);

    // 2. Sekreterya Character at Office Workstation (Right-Center)
    this.createAgentCharacter(secCfg, 680, 380);

    // Listen to TRADE_PROPOSAL for Patron's executive voice
    this.wsUnsub = wsService.on<TradeProposalPayload>('TRADE_PROPOSAL', (payload) => {
      const line = `Ekip raporlarını inceledim, ${payload.symbol} için ${payload.side} kararı verdim, Kaptan onayına sunuyorum. 🎩`;
      this.queueAgentDialogue('Patron', line);
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
