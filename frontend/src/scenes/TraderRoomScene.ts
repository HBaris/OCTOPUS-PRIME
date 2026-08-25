import { BaseRoomScene } from './BaseRoomScene.ts';
import { AgentRole } from '../types/events.ts';
import { AGENT_CONFIGS } from '../config.ts';

export class TraderRoomScene extends BaseRoomScene {
  protected agentRole: AgentRole = 'Binance İşlemci';
  protected roomName = 'Binance İşlem Operasyon Odası';

  constructor() {
    super({ key: 'TraderRoomScene' });
  }

  protected createRoomContent(): void {
    const config = AGENT_CONFIGS.find((a) => a.role === this.agentRole)!;

    // Room specific decor: Multi-screen Wall & Terminal Racks
    this.add.image(220, 240, 'trader_screens');
    this.add.image(740, 240, 'trader_screens');
    this.add.image(80, 240, 'server_rack');
    this.add.image(880, 240, 'cooler_texture');

    this.add.text(220, 285, '📈 BTC / ETH / SOL MİKRO-AKIS', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#f59e0b',
    }).setOrigin(0.5);

    this.add.text(740, 285, '⚡ CCXT TESTNET EMİR DEFTERİ', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#f59e0b',
    }).setOrigin(0.5);

    // Agent Character at Center Desk
    this.createAgentCharacter(config, 480, 360);
  }
}
