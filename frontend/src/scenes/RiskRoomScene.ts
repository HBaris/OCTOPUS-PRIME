import { BaseRoomScene } from './BaseRoomScene.ts';
import { AGENT_CONFIGS } from '../config.ts';

export class RiskRoomScene extends BaseRoomScene {
  protected roomKey = 'RiskRoomScene';
  protected roomName = 'Risk Odası (Risk Analisti & Whale Takipçisi)';

  constructor() {
    super({ key: 'RiskRoomScene' });
  }

  protected createRoomContent(): void {
    const riskCfg = AGENT_CONFIGS.find((a) => a.role === 'Risk Analisti')!;
    const whaleCfg = AGENT_CONFIGS.find((a) => a.role === 'Whale Takipçisi')!;

    // Risk Room Decor: Shield Emblem, Whale Radar, Server Racks
    this.add.image(340, 220, 'risk_shield_emblem');
    this.add.image(640, 220, 'signal_radar_station');
    this.add.image(60, 240, 'server_rack');
    this.add.image(900, 240, 'plant_texture');

    this.add.text(340, 270, '🛡️ EMA α=0.3 KORELASYON GÜVENİ', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#10b981',
    }).setOrigin(0.5);

    this.add.text(640, 270, '🐋 BALİNA VE BÜYÜK HACİM RADARI', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#2dd4bf',
    }).setOrigin(0.5);

    // 1. Risk Analisti Character (Left Desk)
    this.createAgentCharacter(riskCfg, 340, 380);

    // 2. Whale Takipçisi Character (Right Desk)
    this.createAgentCharacter(whaleCfg, 640, 380);
  }
}
