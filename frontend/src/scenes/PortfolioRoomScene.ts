import { BaseRoomScene } from './BaseRoomScene.ts';
import { AGENT_CONFIGS } from '../config.ts';

export class PortfolioRoomScene extends BaseRoomScene {
  protected roomKey = 'PortfolioRoomScene';
  protected roomName = 'Portföy & Kripto Varlık Masası (4 Uzman)';

  constructor() {
    super({ key: 'PortfolioRoomScene' });
  }

  protected createRoomContent(): void {
    const portCfg = AGENT_CONFIGS.find((a) => a.role === 'Portföy Muhasebecisi')!;
    const btcCfg = AGENT_CONFIGS.find((a) => a.role === 'BTC Analisti')!;
    const ethCfg = AGENT_CONFIGS.find((a) => a.role === 'ETH Analisti')!;
    const solCfg = AGENT_CONFIGS.find((a) => a.role === 'SOL Analisti')!;

    // Portfolio Decor: Wall Vault & Grounded Floor Furniture
    this.add.image(480, 160, 'portfolio_vault');
    this.add.image(60, 410, 'plant_texture');
    this.add.image(900, 410, 'cooler_texture');

    this.add.text(480, 205, '💰 USDT KASASI, TEMİNAT VE KRİPTO ANALİZLERİ', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#a78bfa',
    }).setOrigin(0.5);

    // 4 Workstations lined up across the floor
    this.createAgentCharacter(portCfg, 160, 380);
    this.createAgentCharacter(btcCfg, 370, 380);
    this.createAgentCharacter(ethCfg, 580, 380);
    this.createAgentCharacter(solCfg, 790, 380);
  }
}
