import Phaser from 'phaser';
import { APP_CONFIG, AgentVisualConfig, ROOMS, SEVERITY_COLORS } from '../config.ts';
import { AgentRole, AgentState, SceneSeverity, TradeProposalPayload, BriefingResponsePayload } from '../types/events.ts';
import { gameState } from '../services/gameState.ts';
import { apiService } from '../services/api.ts';
import { PixelCharacterGenerator } from '../utils/pixelCharacterGenerator.ts';

export interface RoomCharacterEntity {
  config: AgentVisualConfig;
  container: Phaser.GameObjects.Container;
  characterSprite: Phaser.GameObjects.Image;
  stateText: Phaser.GameObjects.Text;
  bubbleContainer: Phaser.GameObjects.Container;
  bubbleBg: Phaser.GameObjects.Graphics;
  bubbleText: Phaser.GameObjects.Text;
  alertIcon: Phaser.GameObjects.Image;
  tradeIcon: Phaser.GameObjects.Image;
  warningBadge: Phaser.GameObjects.Container;
  confidenceBadge?: Phaser.GameObjects.Container;
  confidenceText?: Phaser.GameObjects.Text;
  dialogueQueue: string[];
  isSpeaking: boolean;
  lastSpokenText?: string;
  isWandering?: boolean;
  walkingContainer?: Phaser.GameObjects.Container;
  walkingSprite?: Phaser.GameObjects.Image;
  deskPos: { x: number; y: number };
}

export abstract class BaseRoomScene extends Phaser.Scene {
  protected abstract roomKey: string;
  protected abstract roomName: string;

  protected agentsInRoom: Map<AgentRole, RoomCharacterEntity> = new Map();
  private severityOverlay!: Phaser.GameObjects.Rectangle;
  private severityTween: Phaser.Tweens.Tween | null = null;

  // HUD Elements
  private statusBadgeText!: Phaser.GameObjects.Text;
  private statusDot!: Phaser.GameObjects.Arc;
  private balanceText!: Phaser.GameObjects.Text;
  private positionsText!: Phaser.GameObjects.Text;
  private severityText!: Phaser.GameObjects.Text;
  private tickerText!: Phaser.GameObjects.Text;

  // Mini-Map Elements
  private miniMapContainer!: Phaser.GameObjects.Container;
  private miniMapDots: Map<string, Phaser.GameObjects.Arc> = new Map();

  // Notification & Trade Proposal Banners
  private bannerContainer!: Phaser.GameObjects.Container;
  private bannerText!: Phaser.GameObjects.Text;
  private proposalContainer!: Phaser.GameObjects.Container;
  private proposalText!: Phaser.GameObjects.Text;
  private proposalSubText!: Phaser.GameObjects.Text;
  private proposalTimerText!: Phaser.GameObjects.Text;
  private proposalExpiryTimer: Phaser.Time.TimerEvent | null = null;
  private currentProposal: TradeProposalPayload | null = null;

  // Live Stream Terminal Modal
  private streamModalContainer?: Phaser.GameObjects.Container;
  private streamModalUnsub?: () => void;
  private currentStreamFilter: 'ALL' | 'NEWS' | 'AGENT' | 'TRADE' | 'RISK' = 'ALL';
  private currentStreamPage = 0;
  private streamItemsPerPage = 6;

  // Personal Assistant Briefing Modal
  private briefingModalContainer?: Phaser.GameObjects.Container;
  private currentBriefingTab: 'TASK' | 'EXECUTIVE' = 'TASK';
  private latestBriefingData: BriefingResponsePayload | null = null;

  private unsubs: Array<() => void> = [];

  create(): void {
    this.cameras.main.fadeIn(250, 11, 15, 25);

    this.createRoomBaseEnvironment();
    this.createAtmosphereOverlay();
    this.createHUD();
    this.createNavigationControls();
    this.createMiniMap();
    this.createActionButton();
    this.createTradeProposalBanner();
    this.createNotificationBanner();
    this.createEventTicker();

    // Call subclass specific multi-character room builder
    this.createRoomContent();

    this.setupWanderingScheduler();
    this.bindGameStateEvents();
    this.syncInitialState();
  }

  protected abstract createRoomContent(): void;

  // ==========================================
  // 1. CLASSIC 2D SIDE-VIEW OFFICE ENVIRONMENT
  // ==========================================
  private createRoomBaseEnvironment(): void {
    const { GAME_WIDTH, GAME_HEIGHT } = APP_CONFIG;

    // A. Wall (Top to Floor): Warm Acoustic Wood Slats & Brick Details
    for (let x = 0; x < GAME_WIDTH; x += 32) {
      for (let y = 0; y < 450; y += 32) {
        this.add.image(x + 16, y + 16, 'wall_tile');
      }
    }

    // B. Large Office Windows on Wall (x=220 and x=740)
    const win1 = this.add.image(220, 120, 'office_window');
    const win2 = this.add.image(740, 120, 'office_window');

    // Subtle window light shimmer
    this.tweens.add({
      targets: [win1, win2],
      alpha: 0.92,
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // C. Baseboard / Skirting Board (Süpürgelik) at wall-floor boundary
    const baseboard = this.add.graphics();
    baseboard.fillStyle(0x1e1b18, 1);
    baseboard.fillRect(0, 442, GAME_WIDTH, 8);
    baseboard.fillStyle(0x362c24, 1);
    baseboard.fillRect(0, 442, GAME_WIDTH, 2);

    // D. Floor (From 450px down): Warm Parquet Wood Tiles
    for (let x = 0; x < GAME_WIDTH; x += 32) {
      for (let y = 450; y < GAME_HEIGHT; y += 32) {
        this.add.image(x + 16, y + 16, 'floor_tile');
      }
    }

    // E. Wall-Floor Contact Shadow
    const wallShadow = this.add.graphics();
    wallShadow.fillStyle(0x000000, 0.4);
    wallShadow.fillRect(0, 450, GAME_WIDTH, 10);

    // F. Large High-Contrast Room Signboard Header
    const signBg = this.add.rectangle(GAME_WIDTH / 2, 54, 380, 32, 0x0f172a, 0.98);
    signBg.setStrokeStyle(2, 0x38bdf8);
    this.add.text(GAME_WIDTH / 2, 54, `🏢 ${this.roomName.toUpperCase()}`, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#38bdf8',
    }).setOrigin(0.5);
  }

  // ==========================================
  // 2. UNIFIED SIDE-VIEW WORKSTATION FACTORY
  // ==========================================
  protected createAgentCharacter(config: AgentVisualConfig, x: number, y: number): RoomCharacterEntity {
    // Layer 1: Ceiling Spotlight Soft Radial Glow on Workstation
    const spotlight = this.add.graphics();
    spotlight.fillStyle(0xfde047, 0.04);
    spotlight.fillCircle(x, y - 5, 95);

    // Layer 2: Complete Unified 3/4 Diagonal Workstation (128x112)
    const agentContainer = this.add.container(x, y);

    const initialTexture = PixelCharacterGenerator.getTextureKey(config.role, 'IDLE');
    const characterSprite = this.add.image(0, 0, initialTexture).setScale(1.15);
    characterSprite.setInteractive({ useHandCursor: true });

    agentContainer.add(characterSprite);

    // Natural Idle Breathing
    this.tweens.add({
      targets: characterSprite,
      scaleY: 1.165,
      duration: 1400 + Math.random() * 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Layer 3: HUD Tags & Speech Bubble
    const overlayContainer = this.add.container(x, y);

    // Role Tag (Placed cleanly under desk foot)
    const roleTagBg = this.add.rectangle(0, 74, 155, 24, 0x0f172a, 0.95);
    roleTagBg.setStrokeStyle(1.5, config.shirtColor);
    const roleText = this.add.text(0, 74, `${config.avatarIcon} ${config.name}`, {
      fontFamily: 'monospace',
      fontSize: '11.5px',
      color: '#f8fafc',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // State Pill
    const stateText = this.add.text(0, 95, '● IDLE', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#10b981',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Speech Bubble (230x54) - Positioned cleanly over workstation
    const bubbleContainer = this.add.container(0, -82);
    const bubbleBg = this.add.graphics();
    this.drawBubble(bubbleBg, 230, 54);
    const bubbleText = this.add.text(0, -4, 'Hazırda bekliyor', {
      fontFamily: 'monospace',
      fontSize: '11.5px',
      color: '#0f172a',
      align: 'center',
      fontStyle: 'bold',
      wordWrap: { width: 215 },
    }).setOrigin(0.5);
    bubbleContainer.add([bubbleBg, bubbleText]);
    bubbleContainer.setVisible(false);

    // Alert & Trade Badges
    const alertIcon = this.add.image(0, -56, 'alert_bubble');
    alertIcon.setVisible(false);
    this.tweens.add({
      targets: alertIcon,
      y: -62,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    const tradeIcon = this.add.image(26, -56, 'trading_badge');
    tradeIcon.setVisible(false);

    const warningBadge = this.add.container(0, -62);
    const stopImg = this.add.image(0, 0, 'warning_stop');
    const stopText = this.add.text(0, -18, 'LİMİT AŞIMI!', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ef4444',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    warningBadge.add([stopImg, stopText]);
    warningBadge.setVisible(false);

    overlayContainer.add([
      roleTagBg,
      roleText,
      stateText,
      alertIcon,
      tradeIcon,
      warningBadge,
      bubbleContainer,
    ]);

    // Special Confidence Badge for Risk Analyst
    let confidenceBadge: Phaser.GameObjects.Container | undefined;
    let confidenceText: Phaser.GameObjects.Text | undefined;

    if (config.role === 'Risk Analisti') {
      confidenceBadge = this.add.container(x + 58, y - 24);
      const cBg = this.add.rectangle(0, 0, 48, 20, 0x064e3b, 0.95);
      cBg.setStrokeStyle(1.5, 0x10b981);
      confidenceText = this.add.text(0, 0, '%75', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#34d399',
      }).setOrigin(0.5);
      confidenceBadge.add([cBg, confidenceText]);
    }

    const entity: RoomCharacterEntity = {
      config,
      container: agentContainer,
      characterSprite,
      stateText,
      bubbleContainer,
      bubbleBg,
      bubbleText,
      alertIcon,
      tradeIcon,
      warningBadge,
      confidenceBadge,
      confidenceText,
      dialogueQueue: [],
      isSpeaking: false,
      lastSpokenText: undefined,
      isWandering: false,
      deskPos: { x, y },
    };

    characterSprite.on('pointerdown', () => this.handleAgentClick(entity));
    alertIcon.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.handleAgentClick(entity));
    roleTagBg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.handleAgentClick(entity));

    this.agentsInRoom.set(config.role, entity);
    return entity;
  }

  public handleAgentClick(agent: RoomCharacterEntity): void {
    // If personal assistant clicked, trigger speech and open briefing modal immediately
    if (agent.config.role === 'Görev Takipçisi') {
      this.showBanner('📌 [Görev Takipçisi]: Kaptan! Siz yokken kaydedilen tüm operasyon dökümü açılıyor...');
      this.openBriefingModal('TASK');
      return;
    }
    if (agent.config.role === 'Baş Danışman') {
      this.showBanner('🧠 [Baş Danışman]: Kaptan! Kaçırdığınız kritik haberler ve yönetici brifingi açılıyor...');
      this.openBriefingModal('EXECUTIVE');
      return;
    }

    if (agent.isWandering) {
      this.showBanner(`🚶 ${agent.config.avatarIcon} ${agent.config.role}: [Ayakta Mola Veriyor - Masaya dönmek için "LA KALKIN LA" butonuna basabilirsiniz]`);
      return;
    }

    if (agent.lastSpokenText) {
      // Re-trigger dialogue bubble with the last spoken text / alert
      agent.bubbleText.setText(agent.lastSpokenText.slice(0, 70));
      agent.bubbleContainer.setVisible(true);
      agent.bubbleContainer.setAlpha(0);
      agent.bubbleContainer.setY(-68);

      this.tweens.add({
        targets: agent.bubbleContainer,
        alpha: 1,
        y: -74,
        duration: 250,
        ease: 'Back.easeOut',
      });

      this.time.delayedCall(4500, () => {
        if (!agent.isSpeaking) {
          this.tweens.add({
            targets: agent.bubbleContainer,
            alpha: 0,
            y: -68,
            duration: 300,
            onComplete: () => agent.bubbleContainer.setVisible(false),
          });
        }
      });

      this.showBanner(`📢 [${agent.config.role}] Son Bildirim: "${agent.lastSpokenText}"`);
    } else if (agent.alertIcon.visible || agent.stateText.text.includes('ALERT')) {
      agent.bubbleText.setText('⚠️ Acil Durum: Piyasa anomalisi ve yüksek volatilite tespit edildi!');
      agent.bubbleContainer.setVisible(true);
      agent.bubbleContainer.setAlpha(0);
      agent.bubbleContainer.setY(-68);

      this.tweens.add({
        targets: agent.bubbleContainer,
        alpha: 1,
        y: -74,
        duration: 250,
        ease: 'Back.easeOut',
      });

      this.time.delayedCall(4500, () => {
        if (!agent.isSpeaking) {
          this.tweens.add({
            targets: agent.bubbleContainer,
            alpha: 0,
            y: -68,
            duration: 300,
            onComplete: () => agent.bubbleContainer.setVisible(false),
          });
        }
      });

      this.showBanner(`⚠️ [${agent.config.role}]: Yüksek volatilite uyarısı aktif!`);
    } else {
      this.showBanner(`${agent.config.avatarIcon} ${agent.config.role}: [${agent.stateText.text}] - Piyasa hazırda izleniyor.`);
    }
  }

  public setAgentStateInRoom(role: AgentRole, state: AgentState, taskDescription?: string): void {
    const agent = this.agentsInRoom.get(role);
    if (!agent) return;

    // If agent is wandering and a non-idle state is triggered, immediately return them to desk
    if (agent.isWandering && state !== 'IDLE') {
      this.returnAgentToDesk(agent);
    }

    // Dynamically switch handcrafted unified side-view workstation sprite for state
    agent.characterSprite.setTexture(PixelCharacterGenerator.getTextureKey(role, state));

    agent.alertIcon.setVisible(false);
    agent.tradeIcon.setVisible(false);

    if (taskDescription) {
      agent.lastSpokenText = taskDescription;
    }

    switch (state) {
      case 'IDLE':
        agent.stateText.setText('● IDLE').setColor('#10b981');
        break;
      case 'ANALYZING':
        agent.stateText.setText('⚙ ANALYZING').setColor('#38bdf8');
        if (taskDescription && !agent.isSpeaking) {
          this.queueAgentDialogue(role, taskDescription);
        }
        break;
      case 'ALERTING':
        agent.stateText.setText('! ALERT').setColor('#ef4444');
        agent.alertIcon.setVisible(true);
        if (taskDescription && !agent.isSpeaking) {
          this.queueAgentDialogue(role, taskDescription);
        }
        break;
      case 'TRADING':
        agent.stateText.setText('⚡ TRADING').setColor('#f59e0b');
        agent.tradeIcon.setVisible(true);
        if (taskDescription && !agent.isSpeaking) {
          this.queueAgentDialogue(role, taskDescription);
        }
        break;
      case 'SALUTING':
        agent.stateText.setText('👋 SELAM').setColor('#ec4899');
        if (taskDescription && !agent.isSpeaking) {
          this.queueAgentDialogue(role, taskDescription);
        }
        // Auto-revert back to IDLE typing pose with hands on desk after 2.5 seconds
        this.time.delayedCall(2500, () => {
          if (agent.stateText.text.includes('SELAM')) {
            this.setAgentStateInRoom(role, 'IDLE');
          }
        });
        break;
    }
  }

  public queueAgentDialogue(role: AgentRole, text: string): void {
    const agent = this.agentsInRoom.get(role);
    if (!agent) return;

    agent.lastSpokenText = text;
    agent.dialogueQueue.push(text);
    if (!agent.isSpeaking) {
      this.processAgentDialogueQueue(agent);
    }
  }

  private processAgentDialogueQueue(agent: RoomCharacterEntity): void {
    if (agent.dialogueQueue.length === 0) {
      agent.isSpeaking = false;
      return;
    }

    agent.isSpeaking = true;
    const nextText = agent.dialogueQueue.shift()!;
    agent.lastSpokenText = nextText;
    agent.bubbleText.setText(nextText.slice(0, 70));
    agent.bubbleContainer.setVisible(true);
    agent.bubbleContainer.setAlpha(0);

    this.tweens.add({
      targets: agent.bubbleContainer,
      alpha: 1,
      y: -74,
      duration: 250,
      ease: 'Back.easeOut',
    });

    this.time.delayedCall(4500, () => {
      this.tweens.add({
        targets: agent.bubbleContainer,
        alpha: 0,
        y: -68,
        duration: 300,
        onComplete: () => {
          agent.bubbleContainer.setVisible(false);
          this.time.delayedCall(400, () => this.processAgentDialogueQueue(agent));
        },
      });
    });
  }

  private drawBubble(graphics: Phaser.GameObjects.Graphics, width: number, height: number): void {
    graphics.clear();
    graphics.fillStyle(0xffffff, 0.98);
    graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
    graphics.lineStyle(1.5, 0x1e293b);
    graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);

    graphics.fillStyle(0xffffff, 0.98);
    graphics.beginPath();
    graphics.moveTo(-5, height / 2);
    graphics.lineTo(5, height / 2);
    graphics.lineTo(0, height / 2 + 6);
    graphics.closePath();
    graphics.fillPath();
  }

  // ==========================================
  // 3. HUD, NAVIGATION & MINI-MAP (KROKİ)
  // ==========================================
  private createHUD(): void {
    const { GAME_WIDTH } = APP_CONFIG;

    const hudBar = this.add.rectangle(GAME_WIDTH / 2, 22, GAME_WIDTH - 24, 38, 0x0f172a, 0.95);
    hudBar.setStrokeStyle(2, 0x1e293b);
    hudBar.setDepth(20);

    this.statusDot = this.add.circle(150, 22, 6.5, 0x10b981).setDepth(21);
    this.statusBadgeText = this.add.text(162, 22, 'ONLINE', {
      fontFamily: 'monospace',
      fontSize: '11.5px',
      color: '#10b981',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(21);

    this.balanceText = this.add.text(238, 22, `💰 $${gameState.totalBalanceUsd.toLocaleString()}`, {
      fontFamily: 'monospace',
      fontSize: '12.5px',
      color: '#facc15',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(21);

    this.positionsText = this.add.text(375, 22, `📈 POZ: ${gameState.openPositionsCount}`, {
      fontFamily: 'monospace',
      fontSize: '12.5px',
      color: '#38bdf8',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(21);

    // Personal Assistant Executive Briefing Trigger in HUD
    const briefingBtn = this.add.rectangle(525, 22, 160, 26, 0x064e3b, 1).setDepth(21);
    briefingBtn.setStrokeStyle(1.5, 0x34d399);
    briefingBtn.setInteractive({ useHandCursor: true });
    const briefingTxt = this.add.text(525, 22, '📋 BANA BRİFİNG VER', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#34d399',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(22);

    briefingBtn.on('pointerover', () => {
      briefingBtn.setFillStyle(0x047857);
      briefingTxt.setColor('#ffffff');
    });
    briefingBtn.on('pointerout', () => {
      briefingBtn.setFillStyle(0x064e3b);
      briefingTxt.setColor('#34d399');
    });
    briefingBtn.on('pointerdown', () => this.openBriefingModal());

    this.severityText = this.add.text(GAME_WIDTH - 25, 22, `ORTAM: ${gameState.severity}`, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#10b981',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(21);
  }

  private createNavigationControls(): void {
    const currentIdx = ROOMS.findIndex((r) => r.key === this.roomKey);
    const prevRoom = ROOMS[(currentIdx - 1 + ROOMS.length) % ROOMS.length];
    const nextRoom = ROOMS[(currentIdx + 1) % ROOMS.length];

    // Left Previous Room Button
    const prevBtn = this.add.rectangle(75, 22, 115, 26, 0x1e293b, 1).setDepth(25);
    prevBtn.setStrokeStyle(1.5, 0x38bdf8);
    prevBtn.setInteractive({ useHandCursor: true });
    this.add.text(75, 22, `◀ ${prevRoom.shortName}`, {
      fontFamily: 'monospace',
      fontSize: '11.5px',
      color: '#38bdf8',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(26);

    prevBtn.on('pointerover', () => prevBtn.setFillStyle(0x334155));
    prevBtn.on('pointerout', () => prevBtn.setFillStyle(0x1e293b));
    prevBtn.on('pointerdown', () => this.switchRoom(prevRoom.key));

    // Right Next Room Button
    const nextBtn = this.add.rectangle(695, 22, 115, 26, 0x1e293b, 1).setDepth(25);
    nextBtn.setStrokeStyle(1.5, 0x38bdf8);
    nextBtn.setInteractive({ useHandCursor: true });
    this.add.text(695, 22, `${nextRoom.shortName} ▶`, {
      fontFamily: 'monospace',
      fontSize: '11.5px',
      color: '#38bdf8',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(26);

    nextBtn.on('pointerover', () => nextBtn.setFillStyle(0x334155));
    nextBtn.on('pointerout', () => nextBtn.setFillStyle(0x1e293b));
    nextBtn.on('pointerdown', () => this.switchRoom(nextRoom.key));
  }

  private createMiniMap(): void {
    const { GAME_WIDTH } = APP_CONFIG;
    const startX = GAME_WIDTH - 155;
    const startY = 60;

    this.miniMapContainer = this.add.container(startX, startY).setDepth(35);

    const mapBg = this.add.rectangle(0, 0, 285, 36, 0x0f172a, 0.95);
    mapBg.setStrokeStyle(1.5, 0x334155);
    this.miniMapContainer.add(mapBg);

    const spacing = 38;
    ROOMS.forEach((room, idx) => {
      const rx = (idx - 3.0) * spacing;
      const isCurrent = room.key === this.roomKey;

      const iconBox = this.add.rectangle(rx, 0, 32, 28, isCurrent ? 0x1e3a8a : 0x1e293b, 1);
      iconBox.setStrokeStyle(isCurrent ? 2 : 1, isCurrent ? 0x38bdf8 : 0x475569);
      iconBox.setInteractive({ useHandCursor: true });

      const iconText = this.add.text(rx, -2, room.icon, { fontSize: '15px' }).setOrigin(0.5);

      // Status LED dot
      const dotColor = gameState.getRoomStatusColor(room.key);
      const dot = this.add.circle(rx + 10, 9, 3.5, dotColor);

      this.miniMapDots.set(room.key, dot);

      iconBox.on('pointerover', () => iconBox.setScale(1.1));
      iconBox.on('pointerout', () => iconBox.setScale(1.0));
      iconBox.on('pointerdown', () => this.switchRoom(room.key));

      this.miniMapContainer.add([iconBox, iconText, dot]);
    });
  }

  public updateMiniMapDots(): void {
    ROOMS.forEach((room) => {
      const dot = this.miniMapDots.get(room.key);
      if (dot) {
        dot.setFillStyle(gameState.getRoomStatusColor(room.key));
      }
    });
  }

  protected switchRoom(targetKey: string): void {
    if (targetKey === this.roomKey) return;
    this.cameras.main.fadeOut(200, 11, 15, 25);
    this.time.delayedCall(200, () => {
      this.scene.start(targetKey);
    });
  }

  private createActionButton(): void {
    const btnX = 145;
    const btnY = 56;

    const btnBg = this.add.rectangle(btnX, btnY, 165, 30, 0x2563eb, 1).setDepth(22);
    btnBg.setStrokeStyle(2, 0x60a5fa);

    this.add.text(btnX, btnY, 'LA KALKIN  LA ⚡', {
      fontFamily: 'monospace',
      fontSize: '12.5px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(23);

    btnBg.setInteractive({ useHandCursor: true });
    btnBg.on('pointerover', () => btnBg.setFillStyle(0x1d4ed8));
    btnBg.on('pointerout', () => btnBg.setFillStyle(0x2563eb));
    btnBg.on('pointerdown', async () => {
      btnBg.setFillStyle(0x1e40af);
      this.recallAllAgentsToDesks();
      this.showBanner('⚡ LA KALKIN LA! TÜM EKİP MASALARINA DÖNDÜ VE TEYAKKUZDA! 🚀');
      this.agentsInRoom.forEach((agent) => {
        this.setAgentStateInRoom(agent.config.role, 'SALUTING', 'Emredersiniz Kaptan!');
      });
      await apiService.triggerSignals();
    });
  }

  // ==========================================
  // WANDERING & IDLE OFFICE MOBILITY SYSTEM
  // ==========================================
  private setupWanderingScheduler(): void {
    this.time.addEvent({
      delay: 10000,
      loop: true,
      callback: () => {
        const idleAgents = Array.from(this.agentsInRoom.values()).filter(
          (a) => !a.isWandering && a.stateText.text.includes('IDLE') && !a.isSpeaking
        );

        if (idleAgents.length > 0) {
          const candidate = idleAgents[Math.floor(Math.random() * idleAgents.length)];
          this.startAgentWandering(candidate);
        }
      },
    });
  }

  private startAgentWandering(agent: RoomCharacterEntity): void {
    if (agent.isWandering || !agent.stateText.text.includes('IDLE') || agent.isSpeaking) return;

    agent.isWandering = true;

    // Switch desk to empty workstation
    const isPatron = agent.config.role === 'Patron';
    agent.characterSprite.setTexture(PixelCharacterGenerator.getEmptyTextureKey(isPatron));

    // Choose random idle activity
    const activities = [
      { act: 'coffee', label: '☕ Kahve alıyor...', targetX: 880 + Math.random() * 40 },
      { act: 'papers', label: '📑 Evrak taşıyor...', targetX: 200 + Math.random() * 520 },
      { act: 'smoke', label: '🚬 Mola veriyor...', targetX: 110 + Math.random() * 70 },
      { act: 'tablet', label: '📱 Rapor inceliyor...', targetX: 480 + (Math.random() - 0.5) * 200 },
    ];
    const choice = activities[Math.floor(Math.random() * activities.length)];

    const startX = agent.deskPos.x;
    const startY = agent.deskPos.y - 4;
    const facingLeft = choice.targetX < startX;

    // Create walking container
    const walkingContainer = this.add.container(startX, startY).setDepth(28);

    const walkingSprite = this.add.image(
      0,
      0,
      PixelCharacterGenerator.getWalkingTextureKey(agent.config.role, choice.act, facingLeft)
    );
    walkingSprite.setInteractive({ useHandCursor: true });
    walkingSprite.on('pointerdown', () => this.handleAgentClick(agent));

    // Mini activity badge
    const pillBg = this.add.rectangle(0, -68, 128, 18, 0x0f172a, 0.95);
    pillBg.setStrokeStyle(1.5, agent.config.shirtColor);
    const pillText = this.add.text(0, -68, choice.label, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#f8fafc',
    }).setOrigin(0.5);

    walkingContainer.add([walkingSprite, pillBg, pillText]);

    agent.walkingContainer = walkingContainer;
    agent.walkingSprite = walkingSprite;

    // Stepping bobbing animation
    const bobTween = this.tweens.add({
      targets: walkingSprite,
      y: '-=3',
      duration: 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const travelDist = Math.abs(choice.targetX - startX);
    const walkDuration = Math.max(2500, travelDist * 9);

    // Walk to destination
    this.tweens.add({
      targets: walkingContainer,
      x: choice.targetX,
      duration: walkDuration,
      ease: 'Linear',
      onComplete: () => {
        bobTween.stop();
        walkingSprite.setY(0);

        // Pause at destination for 4-5 seconds
        this.time.delayedCall(4500, () => {
          if (!agent.isWandering || !agent.walkingContainer) return;

          // Turn around and walk back to desk
          const returnFacingLeft = startX < choice.targetX;
          walkingSprite.setTexture(
            PixelCharacterGenerator.getWalkingTextureKey(agent.config.role, choice.act, returnFacingLeft)
          );

          const returnBob = this.tweens.add({
            targets: walkingSprite,
            y: '-=3',
            duration: 180,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });

          this.tweens.add({
            targets: walkingContainer,
            x: startX,
            duration: walkDuration,
            ease: 'Linear',
            onComplete: () => {
              returnBob.stop();
              this.returnAgentToDesk(agent);
            },
          });
        });
      },
    });
  }

  public returnAgentToDesk(agent: RoomCharacterEntity): void {
    if (agent.walkingContainer) {
      this.tweens.killTweensOf(agent.walkingContainer);
      if (agent.walkingSprite) {
        this.tweens.killTweensOf(agent.walkingSprite);
      }
      agent.walkingContainer.destroy();
      agent.walkingContainer = undefined;
      agent.walkingSprite = undefined;
    }

    agent.isWandering = false;

    // Restore seated texture
    const currentRoleState = agent.stateText.text.includes('ALERT')
      ? 'ALERTING'
      : (agent.stateText.text.includes('TRADING')
        ? 'TRADING'
        : (agent.stateText.text.includes('ANALYZING')
          ? 'ANALYZING'
          : (agent.stateText.text.includes('SALUTING') ? 'SALUTING' : 'IDLE')));

    agent.characterSprite.setTexture(PixelCharacterGenerator.getTextureKey(agent.config.role, currentRoleState));
  }

  public recallAllAgentsToDesks(): void {
    this.agentsInRoom.forEach((agent) => {
      if (agent.isWandering && agent.walkingContainer) {
        this.tweens.killTweensOf(agent.walkingContainer);
        if (agent.walkingSprite) {
          this.tweens.killTweensOf(agent.walkingSprite);
        }

        const startX = agent.deskPos.x;
        const currentX = agent.walkingContainer.x;
        const facingLeft = startX < currentX;

        agent.walkingSprite?.setTexture(
          PixelCharacterGenerator.getWalkingTextureKey(agent.config.role, 'normal', facingLeft)
        );

        // Fast run back to desk
        this.tweens.add({
          targets: agent.walkingContainer,
          x: startX,
          duration: 600,
          ease: 'Cubic.easeOut',
          onComplete: () => {
            this.returnAgentToDesk(agent);
          },
        });
      }
    });
  }

  private createAtmosphereOverlay(): void {
    const { GAME_WIDTH, GAME_HEIGHT } = APP_CONFIG;
    this.severityOverlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x10b981,
      0.08
    ).setDepth(10).setBlendMode(Phaser.BlendModes.ADD);
  }

  public updateAtmosphere(severity: SceneSeverity): void {
    const config = SEVERITY_COLORS[severity] || SEVERITY_COLORS['HAFİF'];
    if (this.severityTween) {
      this.severityTween.stop();
      this.severityTween = null;
    }
    this.tweens.add({
      targets: this.severityOverlay,
      fillColor: config.tint,
      alpha: config.alpha,
      duration: 1000,
    });
    if (this.severityText) {
      this.severityText.setText(`ORTAM: ${config.name}`);
      this.severityText.setColor(severity === 'KATASTROFİK' || severity === 'ÇOK AĞIR' ? '#ef4444' : '#10b981');
    }
  }

  private createTradeProposalBanner(): void {
    const { GAME_WIDTH } = APP_CONFIG;

    this.proposalContainer = this.add.container(GAME_WIDTH / 2, 92).setDepth(150);
    const bg = this.add.rectangle(0, 0, 720, 54, 0x0f172a, 0.98);
    bg.setStrokeStyle(2, 0xf59e0b);

    this.proposalText = this.add.text(-140, -10, '', {
      fontFamily: 'monospace',
      fontSize: '12.5px',
      color: '#fbbf24',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.proposalSubText = this.add.text(-140, 12, '', {
      fontFamily: 'monospace',
      fontSize: '11.5px',
      color: '#cbd5e1',
    }).setOrigin(0.5);

    this.proposalTimerText = this.add.text(110, 0, '(30s)', {
      fontFamily: 'monospace',
      fontSize: '11.5px',
      color: '#94a3b8',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const approveBtn = this.add.rectangle(215, 0, 115, 34, 0x10b981, 1);
    approveBtn.setStrokeStyle(1.5, 0x34d399);
    approveBtn.setInteractive({ useHandCursor: true });
    const approveText = this.add.text(215, 0, 'ONAYLA ✅', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    approveBtn.on('pointerdown', async () => {
      if (this.currentProposal) {
        approveBtn.setFillStyle(0x059669);
        await this.executeManualProposal(this.currentProposal);
      }
    });

    const dismissBtn = this.add.rectangle(300, 0, 34, 34, 0xef4444, 1);
    dismissBtn.setStrokeStyle(1.5, 0xf87171);
    dismissBtn.setInteractive({ useHandCursor: true });
    const dismissText = this.add.text(300, 0, '✕', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    dismissBtn.on('pointerdown', () => this.dismissProposal('İşlem reddedildi.'));

    this.proposalContainer.add([
      bg,
      this.proposalText,
      this.proposalSubText,
      this.proposalTimerText,
      approveBtn,
      approveText,
      dismissBtn,
      dismissText,
    ]);
    this.proposalContainer.setVisible(false);
  }

  public showTradeProposal(proposal: TradeProposalPayload): void {
    const margin = Number(proposal.suggestedAmountUsd || proposal.estimatedAmountUsd || 50);
    const leverage = proposal.suggestedLeverage || 5;
    const posSize = proposal.estimatedPositionSizeUsd || (margin * leverage);
    const side = (proposal.side || 'BUY').toUpperCase() as 'BUY' | 'SELL';
    const symbol = proposal.symbol || 'BTC/USDT';

    this.currentProposal = proposal;
    this.proposalText.setText(`🎩 PATRON: ${side} ${symbol} (${leverage}x Kaldıraç)`);

    const slStr = proposal.suggestedStopLoss ? `SL: $${proposal.suggestedStopLoss.toLocaleString()}` : '';
    const tpStr = proposal.suggestedTakeProfit ? `TP: $${proposal.suggestedTakeProfit.toLocaleString()}` : '';
    const catStr = proposal.sourceCategory ? `[${proposal.sourceCategory}]` : '';

    this.proposalSubText.setText(
      `Margin: $${margin} | Poz. Büyüklüğü: $${posSize} | ${[catStr, slStr, tpStr].filter(Boolean).join(' | ')}`
    );

    this.proposalContainer.setVisible(true);
    this.proposalContainer.setAlpha(1);

    this.showBanner(`⚡ PATRON ÖNERİSİ: ${side} ${symbol} (${leverage}x, Margin: $${margin}, Poz: $${posSize})`, 3500);

    let remaining = 30;
    this.proposalTimerText.setText(`(${remaining}s)`);

    if (this.proposalExpiryTimer) this.proposalExpiryTimer.remove();
    this.proposalExpiryTimer = this.time.addEvent({
      delay: 1000,
      repeat: 30,
      callback: () => {
        remaining--;
        if (remaining > 0) {
          this.proposalTimerText.setText(`(${remaining}s)`);
        } else {
          this.dismissProposal('Süre doldu.');
        }
      },
    });
  }

  private async executeManualProposal(proposal: TradeProposalPayload): Promise<void> {
    const amount = Number(proposal.suggestedAmountUsd || proposal.estimatedAmountUsd || 50);
    const result = await apiService.placeOrder(
      proposal.symbol,
      proposal.side,
      amount,
      'MARKET',
      {
        signalId: proposal.signalId,
        sourceCategory: proposal.sourceCategory,
        stopLoss: proposal.suggestedStopLoss,
        takeProfit: proposal.suggestedTakeProfit,
      }
    );

    if (result.success) {
      this.showBanner(`✅ Emir Testnet'e İletildi: ${proposal.side} ${proposal.symbol}`);
    } else {
      this.showBanner(`❌ Emir İletilemedi: ${result.message}`);
    }
    this.dismissProposal();
  }

  private dismissProposal(reason?: string): void {
    if (this.proposalExpiryTimer) {
      this.proposalExpiryTimer.remove();
      this.proposalExpiryTimer = null;
    }
    this.currentProposal = null;
    this.proposalContainer.setVisible(false);
    if (reason) this.updateTicker(reason);
  }

  private createNotificationBanner(): void {
    const { GAME_WIDTH } = APP_CONFIG;

    this.bannerContainer = this.add.container(GAME_WIDTH / 2, 126).setDepth(30);
    const bg = this.add.rectangle(0, 0, 580, 28, 0x1e293b, 0.95);
    bg.setStrokeStyle(2, 0x38bdf8);

    this.bannerText = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#38bdf8',
    }).setOrigin(0.5);

    this.bannerContainer.add([bg, this.bannerText]);
    this.bannerContainer.setVisible(false);
  }

  public showBanner(message: string, durationMs = 3500): void {
    this.bannerText.setText(message);
    this.bannerContainer.setVisible(true);
    this.bannerContainer.setAlpha(1);

    this.time.delayedCall(durationMs, () => {
      this.bannerContainer.setVisible(false);
    });
  }

  private createEventTicker(): void {
    const { GAME_WIDTH, GAME_HEIGHT } = APP_CONFIG;

    const tickerBar = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 18, GAME_WIDTH - 24, 30, 0x0f172a, 0.95);
    tickerBar.setStrokeStyle(1, 0x334155);
    tickerBar.setDepth(20);

    const tickerLabel = this.add.text(24, GAME_HEIGHT - 18, '📡 CANLI AKIŞ ↗', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#38bdf8',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(21);

    this.tickerText = this.add.text(160, GAME_HEIGHT - 18, gameState.latestTicker, {
      fontFamily: 'monospace',
      fontSize: '11.5px',
      color: '#cbd5e1',
    }).setOrigin(0, 0.5).setDepth(21);

    // Interactive clicking to open full Stream & News Terminal Drawer
    tickerBar.setInteractive({ useHandCursor: true });
    tickerLabel.setInteractive({ useHandCursor: true });
    this.tickerText.setInteractive({ useHandCursor: true });

    const onHover = () => {
      tickerBar.setStrokeStyle(1.5, 0x38bdf8);
      tickerLabel.setColor('#60a5fa');
    };
    const onOut = () => {
      tickerBar.setStrokeStyle(1, 0x334155);
      tickerLabel.setColor('#38bdf8');
    };

    tickerBar.on('pointerover', onHover);
    tickerBar.on('pointerout', onOut);
    tickerBar.on('pointerdown', () => this.openLiveStreamTerminal());

    tickerLabel.on('pointerover', onHover);
    tickerLabel.on('pointerout', onOut);
    tickerLabel.on('pointerdown', () => this.openLiveStreamTerminal());

    this.tickerText.on('pointerover', onHover);
    this.tickerText.on('pointerout', onOut);
    this.tickerText.on('pointerdown', () => this.openLiveStreamTerminal());
  }

  public updateTicker(message: string): void {
    if (this.tickerText) {
      this.tickerText.setText(message.slice(0, 110));
    }
  }

  public openLiveStreamTerminal(): void {
    if (this.streamModalContainer) {
      this.closeLiveStreamTerminal();
      return;
    }

    const { GAME_WIDTH, GAME_HEIGHT } = APP_CONFIG;
    this.streamModalContainer = this.add.container(0, 0).setDepth(300);

    // 1. Dark backdrop (clicks outside close modal)
    const backdrop = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x070d1a, 0.85);
    backdrop.setInteractive();
    backdrop.on('pointerdown', () => this.closeLiveStreamTerminal());

    // 2. Main Terminal Window
    const winW = 900;
    const winH = 550;
    const winX = GAME_WIDTH / 2;
    const winY = GAME_HEIGHT / 2;

    const modalBg = this.add.rectangle(winX, winY, winW, winH, 0x0b1328, 0.98);
    modalBg.setStrokeStyle(2, 0x38bdf8);
    modalBg.setInteractive(); // Prevent clicking through

    // 3. Header Bar
    const headerBg = this.add.rectangle(winX, 68, winW, 44, 0x111e38, 1);
    headerBg.setStrokeStyle(1, 0x1e293b);

    const titleText = this.add.text(
      winX - winW / 2 + 22,
      68,
      '📡 MERKEZ AJAN CANLI AKIŞ & HABER TERMİNALİ (15 AJAN & TÜM ODALAR)',
      {
        fontFamily: 'monospace',
        fontSize: '13.5px',
        color: '#38bdf8',
        fontStyle: 'bold',
      }
    ).setOrigin(0, 0.5);

    // Close button
    const closeBtn = this.add.rectangle(winX + winW / 2 - 28, 68, 30, 30, 0xef4444, 1);
    closeBtn.setStrokeStyle(1.5, 0xf87171);
    closeBtn.setInteractive({ useHandCursor: true });
    const closeText = this.add.text(winX + winW / 2 - 28, 68, '✕', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    closeBtn.on('pointerdown', () => this.closeLiveStreamTerminal());

    // Content container for tabs & list
    const contentContainer = this.add.container(0, 0);

    this.streamModalContainer.add([
      backdrop,
      modalBg,
      headerBg,
      titleText,
      closeBtn,
      closeText,
      contentContainer,
    ]);

    // Initial render of tabs & stream items
    this.renderStreamTerminalContent(contentContainer, winX, winY, winW, winH);

    // Live update when new items arrive while modal is open
    this.streamModalUnsub = gameState.onStreamUpdate(() => {
      if (this.streamModalContainer) {
        this.renderStreamTerminalContent(contentContainer, winX, winY, winW, winH);
      }
    });
  }

  public closeLiveStreamTerminal(): void {
    if (this.streamModalUnsub) {
      this.streamModalUnsub();
      this.streamModalUnsub = undefined;
    }
    if (this.streamModalContainer) {
      this.streamModalContainer.destroy();
      this.streamModalContainer = undefined;
    }
  }

  private renderStreamTerminalContent(
    container: Phaser.GameObjects.Container,
    winX: number,
    winY: number,
    winW: number,
    winH: number
  ): void {
    container.removeAll(true);

    // Category / Filter Tabs
    const newsCount = gameState.streamHistory.filter((i) => i.type === 'NEWS').length;
    const agentCount = gameState.streamHistory.filter((i) => i.type === 'AGENT').length;
    const tradeCount = gameState.streamHistory.filter((i) => i.type === 'TRADE' || i.type === 'SIGNAL').length;
    const riskCount = gameState.streamHistory.filter((i) => i.type === 'RISK').length;

    const tabs: Array<{ id: 'ALL' | 'NEWS' | 'AGENT' | 'TRADE' | 'RISK'; label: string }> = [
      { id: 'ALL', label: `🔥 TÜMÜ (${gameState.streamHistory.length})` },
      { id: 'NEWS', label: `📰 HABERLER (${newsCount})` },
      { id: 'AGENT', label: `💬 AJANLAR (${agentCount})` },
      { id: 'TRADE', label: `⚡ İŞLEMLER (${tradeCount})` },
      { id: 'RISK', label: `🛡️ RİSK (${riskCount})` },
    ];

    let tabStartX = winX - winW / 2 + 25;
    const tabY = 114;

    tabs.forEach((tab) => {
      const isSelected = this.currentStreamFilter === tab.id;
      const btnW = tab.label.length * 8.5 + 28;
      const tabBg = this.add.rectangle(tabStartX + btnW / 2, tabY, btnW, 30, isSelected ? 0x2563eb : 0x182444, 1);
      tabBg.setStrokeStyle(1.5, isSelected ? 0x60a5fa : 0x334155);
      tabBg.setInteractive({ useHandCursor: true });

      const tabTxt = this.add.text(tabStartX + btnW / 2, tabY, tab.label, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: isSelected ? '#ffffff' : '#94a3b8',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      tabBg.on('pointerdown', () => {
        this.currentStreamFilter = tab.id;
        this.currentStreamPage = 0;
        this.renderStreamTerminalContent(container, winX, winY, winW, winH);
      });

      container.add([tabBg, tabTxt]);
      tabStartX += btnW + 12;
    });

    // Filter Items
    let filtered = gameState.streamHistory;
    if (this.currentStreamFilter === 'NEWS') {
      filtered = filtered.filter((i) => i.type === 'NEWS');
    } else if (this.currentStreamFilter === 'AGENT') {
      filtered = filtered.filter((i) => i.type === 'AGENT');
    } else if (this.currentStreamFilter === 'TRADE') {
      filtered = filtered.filter((i) => i.type === 'TRADE' || i.type === 'SIGNAL');
    } else if (this.currentStreamFilter === 'RISK') {
      filtered = filtered.filter((i) => i.type === 'RISK');
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / this.streamItemsPerPage));
    if (this.currentStreamPage >= totalPages) this.currentStreamPage = totalPages - 1;

    const pageItems = filtered.slice(
      this.currentStreamPage * this.streamItemsPerPage,
      (this.currentStreamPage + 1) * this.streamItemsPerPage
    );

    // List rendering
    const listStartY = 168;
    const rowH = 54;

    if (pageItems.length === 0) {
      const emptyTxt = this.add.text(winX, 290, 'Henüz bu kategoride canlı bildirim akışı yok.', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#64748b',
      }).setOrigin(0.5);
      container.add(emptyTxt);
    } else {
      pageItems.forEach((item, idx) => {
        const rowY = listStartY + idx * (rowH + 8) + rowH / 2;
        const rowBg = this.add.rectangle(winX, rowY, winW - 44, rowH, 0x101b35, 0.95);
        rowBg.setStrokeStyle(1, 0x1e293b);

        // Time Badge
        const timeTxt = this.add.text(winX - winW / 2 + 35, rowY - 12, `[${item.timeStr}]`, {
          fontFamily: 'monospace',
          fontSize: '11.5px',
          color: '#64748b',
          fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        // Source Pill
        const srcTxt = this.add.text(winX - winW / 2 + 130, rowY - 12, `${item.avatarIcon} ${item.source}`, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: item.highlightColor || '#38bdf8',
          fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        // Room Location Tag
        const roomTxt = this.add.text(winX - winW / 2 + 350, rowY - 12, `📍 ${item.roomTitle}`, {
          fontFamily: 'monospace',
          fontSize: '11.5px',
          color: '#a78bfa',
          fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        // Message body
        const msgTxt = this.add.text(winX - winW / 2 + 35, rowY + 12, item.message.slice(0, 105), {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#f1f5f9',
        }).setOrigin(0, 0.5);

        container.add([rowBg, timeTxt, srcTxt, roomTxt, msgTxt]);
      });
    }

    // Pagination & Footer controls
    const footerY = 512;

    const pageInfo = this.add.text(
      winX,
      footerY,
      `Sayfa ${this.currentStreamPage + 1} / ${totalPages} (Toplam ${filtered.length} Kayıt)`,
      {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#94a3b8',
        fontStyle: 'bold',
      }
    ).setOrigin(0.5);

    if (this.currentStreamPage > 0) {
      const prevBtn = this.add.rectangle(winX - 190, footerY, 90, 28, 0x1e293b, 1);
      prevBtn.setStrokeStyle(1.5, 0x38bdf8);
      prevBtn.setInteractive({ useHandCursor: true });
      const prevTxt = this.add.text(winX - 190, footerY, '◀ Önceki', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#38bdf8',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      prevBtn.on('pointerdown', () => {
        this.currentStreamPage--;
        this.renderStreamTerminalContent(container, winX, winY, winW, winH);
      });

      container.add([prevBtn, prevTxt]);
    }

    if (this.currentStreamPage < totalPages - 1) {
      const nextBtn = this.add.rectangle(winX + 190, footerY, 90, 28, 0x1e293b, 1);
      nextBtn.setStrokeStyle(1.5, 0x38bdf8);
      nextBtn.setInteractive({ useHandCursor: true });
      const nextTxt = this.add.text(winX + 190, footerY, 'Sonraki ▶', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#38bdf8',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      nextBtn.on('pointerdown', () => {
        this.currentStreamPage++;
        this.renderStreamTerminalContent(container, winX, winY, winW, winH);
      });

      container.add([nextBtn, nextTxt]);
    }

    container.add(pageInfo);
  }

  // ==========================================
  // 3.5 PERSONAL ASSISTANT BRIEFING MODAL
  // ==========================================
  public async openBriefingModal(initialTab: 'TASK' | 'EXECUTIVE' = 'TASK'): Promise<void> {
    if (this.briefingModalContainer) {
      this.closeBriefingModal();
      return;
    }

    this.currentBriefingTab = initialTab;
    const { GAME_WIDTH, GAME_HEIGHT } = APP_CONFIG;

    this.briefingModalContainer = this.add.container(0, 0).setDepth(320);

    // 1. Dark Backdrop
    const backdrop = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x030712, 0.9);
    backdrop.setInteractive();
    backdrop.on('pointerdown', () => this.closeBriefingModal());

    // 2. Main Window Frame
    const winW = 900;
    const winH = 550;
    const winX = GAME_WIDTH / 2;
    const winY = GAME_HEIGHT / 2;

    const modalBg = this.add.rectangle(winX, winY, winW, winH, 0x091224, 0.98);
    modalBg.setStrokeStyle(2, 0x34d399);
    modalBg.setInteractive();

    // 3. Header Bar
    const headerBg = this.add.rectangle(winX, 68, winW, 44, 0x064e3b, 1);
    headerBg.setStrokeStyle(1, 0x059669);

    const titleText = this.add.text(
      winX - winW / 2 + 25,
      68,
      '🎖️ KİŞİSEL ASİSTAN KOMUTA BRİFİNGİ',
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#f8fafc',
        fontStyle: 'bold',
      }
    ).setOrigin(0, 0.5);

    // Close button
    const closeBtn = this.add.rectangle(winX + winW / 2 - 28, 68, 30, 30, 0xef4444, 1);
    closeBtn.setStrokeStyle(1.5, 0xf87171);
    closeBtn.setInteractive({ useHandCursor: true });
    const closeText = this.add.text(winX + winW / 2 - 28, 68, '✕', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    closeBtn.on('pointerdown', () => this.closeBriefingModal());

    const contentContainer = this.add.container(0, 0);

    this.briefingModalContainer.add([
      backdrop,
      modalBg,
      headerBg,
      titleText,
      closeBtn,
      closeText,
      contentContainer,
    ]);

    // Show loading state
    const loadingTxt = this.add.text(winX, winY, '⏳ Asistan verileri ve odalar arası operasyonlar derleniyor...', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#38bdf8',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    contentContainer.add(loadingTxt);

    // Fetch live briefing data from backend
    const data = await apiService.fetchBriefing();
    if (data) {
      this.latestBriefingData = data;
    }

    this.renderBriefingModalContent(contentContainer, winX, winY, winW, winH);
  }

  public closeBriefingModal(): void {
    if (this.briefingModalContainer) {
      this.briefingModalContainer.destroy();
      this.briefingModalContainer = undefined;
    }
  }

  private renderBriefingModalContent(
    container: Phaser.GameObjects.Container,
    winX: number,
    winY: number,
    winW: number,
    winH: number
  ): void {
    container.removeAll(true);

    const b = this.latestBriefingData;

    // Tabs Bar (Clean, Centered, Large)
    const tabY = 114;
    const tab1W = 390;
    const tab2W = 390;

    // Tab 1: Görev Takibi
    const isTab1 = this.currentBriefingTab === 'TASK';
    const tab1Bg = this.add.rectangle(winX - 205, tabY, tab1W, 34, isTab1 ? 0x1d4ed8 : 0x111e38, 1);
    tab1Bg.setStrokeStyle(1.5, isTab1 ? 0x60a5fa : 0x334155);
    tab1Bg.setInteractive({ useHandCursor: true });
    const tab1Txt = this.add.text(winX - 205, tabY, `📌 GÖREV TAKİBİ (${b ? b.unreadCounts.agentActions : 0} İşlem)`, {
      fontFamily: 'monospace',
      fontSize: '12.5px',
      color: isTab1 ? '#ffffff' : '#94a3b8',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    tab1Bg.on('pointerdown', () => {
      this.currentBriefingTab = 'TASK';
      this.renderBriefingModalContent(container, winX, winY, winW, winH);
    });

    // Tab 2: Genel Özet & İstihbarat
    const isTab2 = this.currentBriefingTab === 'EXECUTIVE';
    const tab2Bg = this.add.rectangle(winX + 205, tabY, tab2W, 34, isTab2 ? 0x059669 : 0x111e38, 1);
    tab2Bg.setStrokeStyle(1.5, isTab2 ? 0x34d399 : 0x334155);
    tab2Bg.setInteractive({ useHandCursor: true });
    const tab2Txt = this.add.text(winX + 205, tabY, `🧠 GENEL ÖZET & HABERLER (${b ? b.unreadCounts.news : 0} Haber)`, {
      fontFamily: 'monospace',
      fontSize: '12.5px',
      color: isTab2 ? '#ffffff' : '#94a3b8',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    tab2Bg.on('pointerdown', () => {
      this.currentBriefingTab = 'EXECUTIVE';
      this.renderBriefingModalContent(container, winX, winY, winW, winH);
    });

    container.add([tab1Bg, tab1Txt, tab2Bg, tab2Txt]);

    if (this.currentBriefingTab === 'TASK') {
      // ==========================================
      // TAB 1: GÖREV TAKİBİ (GÖREV TAKİPÇİSİ RAPORU)
      // ==========================================
      const task = b?.taskSummary;

      // 1. Top 3 Metric Cards
      const cardY = 162;
      const cardW = 270;
      const cardH = 44;

      const p1 = this.add.rectangle(winX - 280, cardY, cardW, cardH, 0x0f1c3a, 1);
      p1.setStrokeStyle(1.5, 0x2563eb);
      const t1 = this.add.text(winX - 280, cardY, `⚡ Toplam Operasyon: ${task ? task.totalAgentActions : 0}`, {
        fontFamily: 'monospace',
        fontSize: '12.5px',
        color: '#60a5fa',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const p2 = this.add.rectangle(winX, cardY, cardW, cardH, 0x0f1c3a, 1);
      p2.setStrokeStyle(1.5, 0x38bdf8);
      const t2 = this.add.text(winX, cardY, `🏢 En Aktif: ${task ? task.mostActiveRoom : 'Haber'}`, {
        fontFamily: 'monospace',
        fontSize: '12.5px',
        color: '#38bdf8',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const p3 = this.add.rectangle(winX + 280, cardY, cardW, cardH, 0x0f1c3a, 1);
      p3.setStrokeStyle(1.5, 0xf59e0b);
      const t3 = this.add.text(winX + 280, cardY, `🚨 Kritik Uyarı: ${task ? task.criticalAlertsCount : 0}`, {
        fontFamily: 'monospace',
        fontSize: '12.5px',
        color: '#fbbf24',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      container.add([p1, t1, p2, t2, p3, t3]);

      // 2. Assistant Status Note Banner
      const noteY = 216;
      const noteBg = this.add.rectangle(winX, noteY, winW - 50, 42, 0x111c38, 0.95);
      noteBg.setStrokeStyle(1.5, 0x38bdf8);
      const noteTxt = this.add.text(
        winX,
        noteY,
        `📌 GÖREV TAKİPÇİSİ: ${task?.summaryParagraph ? task.summaryParagraph.slice(0, 110) : 'Tüm ajanlar görev yerlerinde rutin tarama gerçekleştiriyor.'}`,
        {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#f1f5f9',
          fontStyle: 'bold',
          align: 'center',
        }
      ).setOrigin(0.5);
      container.add([noteBg, noteTxt]);

      // 3. Operations Table List
      const opsTitleY = 265;
      const opsTitle = this.add.text(winX - winW / 2 + 30, opsTitleY, '📋 EN SON EKİP OPERASYONLARI & AKSİYON DÖKÜMÜ:', {
        fontFamily: 'monospace',
        fontSize: '12.5px',
        color: '#94a3b8',
        fontStyle: 'bold',
      });
      container.add(opsTitle);

      const opsList = task?.keyOperations || ['Tüm ajanlar görev yerlerinde rutin tarama gerçekleştirdi.'];
      opsList.slice(0, 4).forEach((op, idx) => {
        const rowY = 302 + idx * 42;
        const rowBg = this.add.rectangle(winX, rowY, winW - 50, 34, 0x0c152a, 0.95);
        rowBg.setStrokeStyle(1, 0x1e293b);
        const rowTxt = this.add.text(winX - winW / 2 + 45, rowY, `⚡ ${op}`, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#f8fafc',
        }).setOrigin(0, 0.5);
        container.add([rowBg, rowTxt]);
      });
    } else {
      // ==========================================
      // TAB 2: GENEL ÖZET (BAŞ DANIŞMAN RAPORU)
      // ==========================================
      const exec = b?.executiveSummary;
      const pnl = exec?.portfolioSummary.pnlUsd || 0;

      // 1. Top 3 Metric Cards
      const cardY = 162;
      const cardW = 270;
      const cardH = 44;

      const p1 = this.add.rectangle(winX - 280, cardY, cardW, cardH, 0x064e3b, 1);
      p1.setStrokeStyle(1.5, 0x10b981);
      const t1 = this.add.text(winX - 280, cardY, `📰 Kaçırılan Haber: ${exec ? exec.totalMissedNews : 0}`, {
        fontFamily: 'monospace',
        fontSize: '12.5px',
        color: '#34d399',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const p2 = this.add.rectangle(winX, cardY, cardW, cardH, 0x064e3b, 1);
      p2.setStrokeStyle(1.5, 0xfacc15);
      const t2 = this.add.text(winX, cardY, `🛡️ Piyasa Ortamı: ${exec ? exec.currentSeverity : 'HAFİF'}`, {
        fontFamily: 'monospace',
        fontSize: '12.5px',
        color: '#fde047',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const p3 = this.add.rectangle(winX + 280, cardY, cardW, cardH, 0x064e3b, 1);
      p3.setStrokeStyle(1.5, pnl >= 0 ? 0x10b981 : 0xef4444);
      const t3 = this.add.text(
        winX + 280,
        cardY,
        `💰 Kasa: $${exec?.portfolioSummary.currentBalance.toLocaleString() || '10,000'} (${pnl >= 0 ? '+' : ''}$${pnl.toFixed(1)})`,
        {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: pnl >= 0 ? '#34d399' : '#f87171',
          fontStyle: 'bold',
        }
      ).setOrigin(0.5);

      container.add([p1, t1, p2, t2, p3, t3]);

      // 2. Captain Actionable Takeaway Banner
      const takeY = 216;
      const takeBg = this.add.rectangle(winX, takeY, winW - 50, 42, 0x1a1808, 0.95);
      takeBg.setStrokeStyle(2, 0xfacc15);
      const takeTxt = this.add.text(
        winX,
        takeY,
        exec?.captainTakeaway || '🛡️ DENGELİ SEYİR: Piyasalar sakin ve risk parametreleri güvenli aralıkta.',
        {
          fontFamily: 'monospace',
          fontSize: '12.5px',
          color: '#fde047',
          fontStyle: 'bold',
          align: 'center',
        }
      ).setOrigin(0.5);
      container.add([takeBg, takeTxt]);

      // 3. Top News Headlines List
      const headTitleY = 265;
      const headTitle = this.add.text(winX - winW / 2 + 30, headTitleY, '📰 EN KRİTİK HABER BAŞLIKLARI & SENTİMENT:', {
        fontFamily: 'monospace',
        fontSize: '12.5px',
        color: '#94a3b8',
        fontStyle: 'bold',
      });
      container.add(headTitle);

      const headlines = exec?.topHeadlines || [];
      if (headlines.length === 0) {
        const noNews = this.add.text(winX, 330, 'Henüz yeni kaçırılan haber kaydı yok.', {
          fontFamily: 'monospace',
          fontSize: '12.5px',
          color: '#64748b',
        }).setOrigin(0.5);
        container.add(noNews);
      } else {
        headlines.slice(0, 4).forEach((n, idx) => {
          const rowY = 302 + idx * 42;
          const rowBg = this.add.rectangle(winX, rowY, winW - 50, 34, 0x061914, 0.95);
          rowBg.setStrokeStyle(1, 0x134e4a);

          const badgeColor = n.sentiment === 'POSITIVE' ? '#10b981' : n.sentiment === 'NEGATIVE' ? '#ef4444' : '#facc15';
          const sentTxt = this.add.text(winX - winW / 2 + 45, rowY, `[${n.sentiment}]`, {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: badgeColor,
            fontStyle: 'bold',
          }).setOrigin(0, 0.5);

          const titleTxt = this.add.text(winX - winW / 2 + 160, rowY, n.title.slice(0, 85), {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#f8fafc',
          }).setOrigin(0, 0.5);

          container.add([rowBg, sentTxt, titleTxt]);
        });
      }
    }

    // ==========================================
    // FOOTER ACTION BUTTONS
    // ==========================================
    const footerY = 512;

    // 1. Refresh Button
    const refBtn = this.add.rectangle(winX - 275, footerY, 150, 34, 0x1e293b, 1);
    refBtn.setStrokeStyle(1.5, 0x38bdf8);
    refBtn.setInteractive({ useHandCursor: true });
    const refTxt = this.add.text(winX - 275, footerY, '🔄 Özeti Yenile', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#38bdf8',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    refBtn.on('pointerdown', async () => {
      refTxt.setText('⏳ Yenileniyor...');
      const updated = await apiService.fetchBriefing();
      if (updated) this.latestBriefingData = updated;
      this.renderBriefingModalContent(container, winX, winY, winW, winH);
    });

    // 2. Mark as Read Button
    const markBtn = this.add.rectangle(winX - 85, footerY, 200, 34, 0x064e3b, 1);
    markBtn.setStrokeStyle(1.5, 0x34d399);
    markBtn.setInteractive({ useHandCursor: true });
    const markTxt = this.add.text(winX - 85, footerY, '✅ Okundu Say (Sıfırla)', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#34d399',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    markBtn.on('pointerdown', async () => {
      markTxt.setText('⏳ Sıfırlanıyor...');
      await apiService.markBriefingRead();
      this.showBanner('✅ Kişisel Asistan brifingi okundu olarak kaydedildi!');
      const updated = await apiService.fetchBriefing();
      if (updated) this.latestBriefingData = updated;
      this.renderBriefingModalContent(container, winX, winY, winW, winH);
    });

    // 3. Wake Team Action Button
    const wakeBtn = this.add.rectangle(winX + 125, footerY, 175, 34, 0x78350f, 1);
    wakeBtn.setStrokeStyle(1.5, 0xfbbf24);
    wakeBtn.setInteractive({ useHandCursor: true });
    const wakeTxt = this.add.text(winX + 125, footerY, '⚡ LA KALKIN LA!', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#fbbf24',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    wakeBtn.on('pointerdown', async () => {
      this.recallAllAgentsToDesks();
      this.showBanner('⚡ LA KALKIN LA! TÜM EKİP MASALARINA DÖNDÜ VE TEYAKKUZDA! 🚀');
      this.agentsInRoom.forEach((agent) => {
        this.setAgentStateInRoom(agent.config.role, 'SALUTING', 'Emredersiniz Kaptan!');
      });
      await apiService.triggerSignals();
      this.closeBriefingModal();
    });

    // 4. Close Modal Button
    const closeBtn2 = this.add.rectangle(winX + 295, footerY, 110, 34, 0x1e293b, 1);
    closeBtn2.setStrokeStyle(1, 0x64748b);
    closeBtn2.setInteractive({ useHandCursor: true });
    const closeTxt2 = this.add.text(winX + 295, footerY, '✕ Kapat', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#94a3b8',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    closeBtn2.on('pointerdown', () => this.closeBriefingModal());

    container.add([refBtn, refTxt, markBtn, markTxt, wakeBtn, wakeTxt, closeBtn2, closeTxt2]);
  }

  // ==========================================
  // 4. STATE SYNC & SUBSCRIPTIONS
  // ==========================================
  private bindGameStateEvents(): void {
    this.unsubs.push(
      gameState.onAgentStateChange(({ role, state, task }) => {
        if (this.agentsInRoom.has(role)) {
          this.setAgentStateInRoom(role, state, task);
        }
        this.updateMiniMapDots();
      })
    );

    this.unsubs.push(
      gameState.onSeverityChange((sev) => this.updateAtmosphere(sev))
    );

    this.unsubs.push(
      gameState.onPortfolioChange(({ balance, count }) => {
        if (this.balanceText) this.balanceText.setText(`💰 BAKIYE: $${balance.toLocaleString()}`);
        if (this.positionsText) this.positionsText.setText(`📈 POZ: ${count}`);
      })
    );

    this.unsubs.push(
      gameState.onProposal((prop) => this.showTradeProposal(prop))
    );

    this.unsubs.push(
      gameState.onTickerChange((t) => this.updateTicker(t))
    );

    this.unsubs.push(
      gameState.onStatusChange((status) => {
        if (this.statusBadgeText && this.statusDot) {
          this.statusBadgeText.setText(status);
          const color = status === 'ONLINE' ? '#10b981' : status === 'CONNECTING' ? '#facc15' : '#ef4444';
          const dot = status === 'ONLINE' ? 0x10b981 : status === 'CONNECTING' ? 0xfacc15 : 0xef4444;
          this.statusBadgeText.setColor(color);
          this.statusDot.setFillStyle(dot);
        }
      })
    );
  }

  private syncInitialState(): void {
    this.agentsInRoom.forEach((_, role) => {
      const stateData = gameState.agents.get(role);
      if (stateData) {
        this.setAgentStateInRoom(role, stateData.state, stateData.currentTask);
      }
    });
    this.updateAtmosphere(gameState.severity);
    this.updateMiniMapDots();
  }

  shutdown(): void {
    this.closeBriefingModal();
    this.closeLiveStreamTerminal();
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
    if (this.proposalExpiryTimer) {
      this.proposalExpiryTimer.remove();
      this.proposalExpiryTimer = null;
    }
  }
}
