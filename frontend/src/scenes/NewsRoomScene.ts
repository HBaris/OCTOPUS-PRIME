import { BaseRoomScene } from './BaseRoomScene.ts';
import { AgentRole } from '../types/events.ts';
import { AGENT_CONFIGS } from '../config.ts';

export class NewsRoomScene extends BaseRoomScene {
  protected agentRole: AgentRole = 'Haber Takip';
  protected roomName = 'Haber Takip Odası (RSS & Küresel Basın)';

  constructor() {
    super({ key: 'NewsRoomScene' });
  }

  protected createRoomContent(): void {
    const config = AGENT_CONFIGS.find((a) => a.role === this.agentRole)!;

    // Room specific decor: News Whiteboard & Server Racks
    this.add.image(200, 240, 'news_board');
    this.add.image(80, 240, 'server_rack');
    this.add.image(880, 240, 'server_rack');
    this.add.image(760, 250, 'plant_texture');

    // Whiteboard Label
    this.add.text(200, 290, '📰 KÜRESEL BASIN PANOSU', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    // Agent Character at Center Desk
    this.createAgentCharacter(config, 480, 360);
  }
}
