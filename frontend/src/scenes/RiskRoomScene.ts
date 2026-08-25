import { BaseRoomScene } from './BaseRoomScene.ts';
import { AgentRole } from '../types/events.ts';
import { AGENT_CONFIGS } from '../config.ts';

export class RiskRoomScene extends BaseRoomScene {
  protected agentRole: AgentRole = 'Risk Analisti';
  protected roomName = 'Risk & Korelasyon Analiz Odası';

  constructor() {
    super({ key: 'RiskRoomScene' });
  }

  protected createRoomContent(): void {
    const config = AGENT_CONFIGS.find((a) => a.role === this.agentRole)!;

    // Room specific decor: Large Risk Shield Emblem & Servers
    this.add.image(200, 240, 'risk_shield_emblem');
    this.add.image(760, 240, 'news_board');
    this.add.image(80, 240, 'server_rack');
    this.add.image(880, 240, 'plant_texture');

    this.add.text(200, 290, '🛡️ EMA α=0.3 KORELASYON KALKANI', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#10b981',
    }).setOrigin(0.5);

    this.add.text(760, 290, '📊 15 DAKİKALIK ETKİ DOĞRULAMA', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#34d399',
    }).setOrigin(0.5);

    // Agent Character at Center Desk
    this.createAgentCharacter(config, 480, 360);
  }
}
