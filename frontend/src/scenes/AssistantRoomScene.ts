import { BaseRoomScene } from './BaseRoomScene.ts';
import { AGENT_CONFIGS } from '../config.ts';
import { wsService } from '../services/websocket.ts';
import { AgentActionPayload, NewNewsPayload, SignalGeneratedPayload } from '../types/events.ts';

export class AssistantRoomScene extends BaseRoomScene {
  protected roomKey = 'AssistantRoomScene';
  protected roomName = 'Asistan Odası (Kişisel Asistan Masası & Brifing)';

  private assistantUnsubs: Array<() => void> = [];

  constructor() {
    super({ key: 'AssistantRoomScene' });
  }

  protected createRoomContent(): void {
    const opsCfg = AGENT_CONFIGS.find((a) => a.role === 'Görev Takipçisi')!;
    const execCfg = AGENT_CONFIGS.find((a) => a.role === 'Baş Danışman')!;

    // Tactical Command & Briefing Decor
    this.add.image(320, 160, 'signal_radar_station');
    this.add.image(640, 160, 'trader_screens');
    this.add.image(60, 410, 'server_rack');
    this.add.image(900, 410, 'plant_texture');

    // Strategic Mission Labels
    this.add.text(320, 205, '📌 GÖREV TAKİBİ & EKİP DÖKÜMÜ', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#38bdf8',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(640, 205, '🧠 GENEL DURUM & HABER BRİFİNGİ', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#34d399',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Interactive Action Banner in the Room Center
    const bannerBg = this.add.rectangle(480, 260, 260, 30, 0x0f172a, 0.95);
    bannerBg.setStrokeStyle(1.5, 0xfbbf24);
    bannerBg.setInteractive({ useHandCursor: true });
    
    const bannerTxt = this.add.text(480, 260, '📋 BANA BRİFİNG VER (ÖZET)', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#fbbf24',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const onHover = () => {
      bannerBg.setFillStyle(0x1e293b, 1);
      bannerTxt.setColor('#ffffff');
    };
    const onOut = () => {
      bannerBg.setFillStyle(0x0f172a, 0.95);
      bannerTxt.setColor('#fbbf24');
    };

    bannerBg.on('pointerover', onHover);
    bannerBg.on('pointerout', onOut);
    bannerBg.on('pointerdown', () => this.openBriefingModal());

    // 1. Görev Takipçisi (Left Desk)
    this.createAgentCharacter(opsCfg, 320, 380);

    // 2. Baş Danışman (Right Desk)
    this.createAgentCharacter(execCfg, 640, 380);

    // Listen to real-time events to trigger assistant dialogs
    this.assistantUnsubs.push(
      wsService.on<AgentActionPayload>('AGENT_ACTION', (act) => {
        if (act.agentRole !== 'Görev Takipçisi' && act.agentRole !== 'Baş Danışman') {
          if (Math.random() < 0.3) {
            this.queueAgentDialogue(
              'Görev Takipçisi',
              `Kaptan! [${act.agentRole}] yeni operasyon yaptı: "${act.actionName}". Kaydedildi.`
            );
          }
        }
      })
    );

    this.assistantUnsubs.push(
      wsService.on<NewNewsPayload>('NEW_NEWS', (news) => {
        if (Math.random() < 0.35) {
          const impact = news.impact?.impactScore || 5;
          this.queueAgentDialogue(
            'Baş Danışman',
            `Kaptan! ${impact}/10 etkili yeni haber geldi: "${news.title.slice(0, 45)}...". Brifinge işlendi.`
          );
        }
      })
    );

    this.assistantUnsubs.push(
      wsService.on<SignalGeneratedPayload>('SIGNAL_GENERATED', (sig) => {
        if (sig.action !== 'HOLD') {
          this.queueAgentDialogue(
            'Görev Takipçisi',
            `Kaptan! Sinyal Odası ${sig.action} ${sig.symbol} (Skor: ${sig.signalScore}/100) üretti. Teyakkuzdayız!`
          );
        }
      })
    );
  }

  shutdown(): void {
    super.shutdown();
    this.assistantUnsubs.forEach((unsub) => unsub());
    this.assistantUnsubs = [];
  }
}
