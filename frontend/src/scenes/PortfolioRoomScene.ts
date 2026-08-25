import { BaseRoomScene } from './BaseRoomScene.ts';
import { AgentRole } from '../types/events.ts';
import { AGENT_CONFIGS } from '../config.ts';

export class PortfolioRoomScene extends BaseRoomScene {
  protected agentRole: AgentRole = 'Portföy Muhasebecisi';
  protected roomName = 'Portföy & Hazine Muhasebe Odası';

  constructor() {
    super({ key: 'PortfolioRoomScene' });
  }

  protected createRoomContent(): void {
    const config = AGENT_CONFIGS.find((a) => a.role === this.agentRole)!;

    // Room specific decor: Heavy Gold Vault & Asset Screens
    this.add.image(200, 240, 'portfolio_vault');
    this.add.image(760, 240, 'news_board');
    this.add.image(80, 240, 'plant_texture');
    this.add.image(880, 240, 'cooler_texture');

    this.add.text(200, 295, '💰 USDT KASASI & PnL DEFTERİ', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#a78bfa',
    }).setOrigin(0.5);

    this.add.text(760, 290, '📊 AÇIK POZİSYON VE TEMİNATLAR', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#c4b5fd',
    }).setOrigin(0.5);

    // Agent Character at Center Desk
    this.createAgentCharacter(config, 480, 360);
  }
}
