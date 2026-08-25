import { BaseRoomScene } from './BaseRoomScene.ts';
import { AGENT_CONFIGS } from '../config.ts';

export class NewsRoomScene extends BaseRoomScene {
  protected roomKey = 'NewsRoomScene';
  protected roomName = 'Haber Odası (Haber Takip, Makro & Düzenleme)';

  constructor() {
    super({ key: 'NewsRoomScene' });
  }

  protected createRoomContent(): void {
    const newsCfg = AGENT_CONFIGS.find((a) => a.role === 'Haber Takip')!;
    const macroCfg = AGENT_CONFIGS.find((a) => a.role === 'Makro Ekonomist')!;
    const regCfg = AGENT_CONFIGS.find((a) => a.role === 'Düzenleyici İzleyici')!;

    // Newsroom Decor: Whiteboards, TV Screens, Server Racks
    this.add.image(480, 220, 'news_board');
    this.add.image(60, 240, 'server_rack');
    this.add.image(900, 240, 'server_rack');
    this.add.image(300, 220, 'plant_texture');
    this.add.image(660, 220, 'cooler_texture');

    this.add.text(480, 270, '📰 KÜRESEL BASIN & HABER ANALİZ MERKEZİ', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#38bdf8',
    }).setOrigin(0.5);

    // 1. Makro Ekonomist (Left Desk)
    this.createAgentCharacter(macroCfg, 200, 380);

    // 2. Haber Takip (Center Desk)
    this.createAgentCharacter(newsCfg, 480, 380);

    // 3. Düzenleyici İzleyici (Right Desk)
    this.createAgentCharacter(regCfg, 760, 380);
  }
}
