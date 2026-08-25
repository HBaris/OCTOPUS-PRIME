import { BaseRoomScene } from './BaseRoomScene.ts';
import { AGENT_CONFIGS } from '../config.ts';

export class TraderRoomScene extends BaseRoomScene {
  protected roomKey = 'TraderRoomScene';
  protected roomName = 'İşlem Odası (Binance İşlemci & Likidite)';

  constructor() {
    super({ key: 'TraderRoomScene' });
  }

  protected createRoomContent(): void {
    const traderCfg = AGENT_CONFIGS.find((a) => a.role === 'Binance İşlemci')!;
    const liqCfg = AGENT_CONFIGS.find((a) => a.role === 'Likidite Gözlemcisi')!;

    // Trading Floor Decor: Wall Screens & Grounded Floor Furniture
    this.add.image(320, 160, 'trader_screens');
    this.add.image(640, 160, 'trader_screens');
    this.add.image(60, 410, 'server_rack');
    this.add.image(900, 410, 'cooler_texture');

    this.add.text(320, 205, '📈 CCXT TESTNET EMİR İLETİMİ', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#f59e0b',
    }).setOrigin(0.5);

    this.add.text(640, 205, '💧 DERİNLİK VE LİKİDİTE KONTROLÜ', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#06b6d4',
    }).setOrigin(0.5);

    // 1. Binance İşlemci Character (Left Desk)
    this.createAgentCharacter(traderCfg, 320, 380);

    // 2. Likidite Gözlemcisi Character (Right Desk)
    this.createAgentCharacter(liqCfg, 640, 380);
  }
}
