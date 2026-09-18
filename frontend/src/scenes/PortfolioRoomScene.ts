import { BaseRoomScene } from './BaseRoomScene.ts';
import { AGENT_CONFIGS } from '../config.ts';

export class PortfolioRoomScene extends BaseRoomScene {
  protected roomKey = 'PortfolioRoomScene';
  protected roomName = 'Portföy Masası';

  constructor() {
    super({ key: 'PortfolioRoomScene' });
  }

  protected createRoomContent(): void {
    const portCfg = AGENT_CONFIGS.find((a) => a.role === 'Portföy Muhasebecisi')!;

    // Portfolio Decor: Wall Vault & Grounded Floor Furniture
    this.add.image(480, 160, 'portfolio_vault');
    this.add.image(60, 410, 'plant_texture');
    this.add.image(900, 410, 'cooler_texture');

    this.add.text(480, 205, '💰 USDT KASASI VE TEMİNAT YÖNETİMİ', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#a78bfa',
    }).setOrigin(0.5);

    // Workstation
    this.createAgentCharacter(portCfg, 480, 380);
  }
}
