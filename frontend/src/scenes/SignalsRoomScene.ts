import { BaseRoomScene } from './BaseRoomScene.ts';
import { AgentRole, SignalGeneratedPayload } from '../types/events.ts';
import { AGENT_CONFIGS } from '../config.ts';
import { wsService } from '../services/websocket.ts';
import { formatSignalDialogue } from '../utils/signalDialogue.ts';

export class SignalsRoomScene extends BaseRoomScene {
  protected agentRole: AgentRole = 'Sinyal Avcısı';
  protected roomName = 'Sinyal Avcısı (Ali) Odası';

  private wsUnsub: (() => void) | null = null;

  constructor() {
    super({ key: 'SignalsRoomScene' });
  }

  protected createRoomContent(): void {
    const config = AGENT_CONFIGS.find((a) => a.role === this.agentRole)!;

    // Room specific decor: Radar Station & Antennae
    this.add.image(200, 240, 'signal_radar_station');
    this.add.image(760, 240, 'trader_screens');
    this.add.image(80, 240, 'server_rack');
    this.add.image(880, 240, 'server_rack');

    this.add.text(200, 295, '⚡ ANLIK PİYASA RADARI', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#ec4899',
    }).setOrigin(0.5);

    this.add.text(760, 285, '🎯 SKOR EŞİĞİ >= 60 FIRSATLAR', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#f472b6',
    }).setOrigin(0.5);

    // Agent Character at Center Desk
    this.createAgentCharacter(config, 480, 360);

    // Listen to SIGNAL_GENERATED for direct template speech
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
          this.queueDialogue(line);
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
