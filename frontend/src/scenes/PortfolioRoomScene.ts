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

    // Portfolio Decor: Heavy Gold Vault & Asset Screens
    this.add.image(480, 220, 'portfolio_vault');
    this.add.image(60, 240, 'plant_texture');
    this.add.image(900, 240, 'cooler_texture');

    this.add.text(480, 275, '💰 USDT KASASI, TEMİNAT VE KRİPTO ANALİZLERİ', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#a78bfa',
    }).setOrigin(0.5);

    // 1. Portföy Muhasebecisi (Top-Left)
    this.createAgentCharacter(portCfg, 200, 320);

    // 2. SOL Analisti (Top-Right)
    this.createAgentCharacter(solCfg, 760, 320);

    // 3. BTC Analisti (Bottom-Left)
    this.createAgentCharacter(btcCfg, 380, 460);

    // 4. ETH Analisti (Bottom-Right)
    this.createAgentCharacter(ethCfg, 580, 460);
  }
}
