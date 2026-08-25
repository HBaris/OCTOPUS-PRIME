import { BaseRoomScene } from './BaseRoomScene.ts';
import { AGENT_CONFIGS } from '../config.ts';
import { wsService } from '../services/websocket.ts';
import { SignalGeneratedPayload } from '../types/events.ts';
import { formatSignalDialogue } from '../utils/signalDialogue.ts';

export class SignalsRoomScene extends BaseRoomScene {
  protected roomKey = 'SignalsRoomScene';
  protected roomName = 'Sinyal & Teknik Analiz Odası (Ali & Teknik)';

  private wsUnsub: (() => void) | null = null;

  constructor() {
    super({ key: 'SignalsRoomScene' });
  }

  protected createRoomContent(): void {
    const sigCfg = AGENT_CONFIGS.find((a) => a.role === 'Sinyal Avcısı')!;
    const techCfg = AGENT_CONFIGS.find((a) => a.role === 'Teknik Analist')!;

    // Room Decor: Radar Station, Technical Oscillators, Servers
    this.add.image(340, 220, 'signal_radar_station');
    this.add.image(640, 220, 'trader_screens');
    this.add.image(60, 240, 'server_rack');
    this.add.image(900, 240, 'server_rack');

    this.add.text(340, 270, '⚡ ANLIK SİNYAL RADARI (ALİ)', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ec4899',
    }).setOrigin(0.5);

    this.add.text(640, 270, '📐 MOMENTUM VE GRAFİK İNCELEMESİ', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#a5b4fc',
    }).setOrigin(0.5);

    // 1. Sinyal Avcısı (Ali) Character (Left Desk)
    this.createAgentCharacter(sigCfg, 340, 380);

    // 2. Teknik Analist Character (Right Desk)
    this.createAgentCharacter(techCfg, 640, 380);

    // Listen to SIGNAL_GENERATED for Ali's speech queue
    this.wsUnsub = wsService.on<SignalGeneratedPayload>('SIGNAL_GENERATED', (payload) => {
      if (payload.action !== 'HOLD') {
        const line = formatSignalDialogue({
          symbol: payload.symbol,
          action: payload.action,
          signalScore: payload.signalScore,
          category: payload.sourceCategory,
          reasoning: payload.reasoning,
        });
        if (line) {
          this.queueAgentDialogue('Sinyal Avcısı', line);
        }
      }
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
