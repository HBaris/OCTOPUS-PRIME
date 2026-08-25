import Phaser from 'phaser';
import { APP_CONFIG, AgentVisualConfig, ROOMS, SEVERITY_COLORS } from '../config.ts';
import { AgentRole, AgentState, SceneSeverity, TradeProposalPayload } from '../types/events.ts';
import { gameState } from '../services/gameState.ts';
import { apiService } from '../services/api.ts';

export interface RoomCharacterEntity {
  config: AgentVisualConfig;
  container: Phaser.GameObjects.Container;
  bodySprite: Phaser.GameObjects.Rectangle;
  headSprite: Phaser.GameObjects.Rectangle;
  leftArm: Phaser.GameObjects.Rectangle;
  rightArm: Phaser.GameObjects.Rectangle;
  leftHand: Phaser.GameObjects.Rectangle;
  rightHand: Phaser.GameObjects.Rectangle;
  mouthGraphics: Phaser.GameObjects.Graphics;
  stateText: Phaser.GameObjects.Text;
  bubbleContainer: Phaser.GameObjects.Container;
  bubbleBg: Phaser.GameObjects.Graphics;
  bubbleText: Phaser.GameObjects.Text;
  alertIcon: Phaser.GameObjects.Image;
  tradeIcon: Phaser.GameObjects.Image;
  warningBadge: Phaser.GameObjects.Container;
  confidenceBadge?: Phaser.GameObjects.Container;
  confidenceText?: Phaser.GameObjects.Text;
  typingTween?: Phaser.Tweens.Tween;
  dialogueQueue: string[];
  isSpeaking: boolean;
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

  private unsubs: Array<() => void> = [];

  create(): void {
    this.cameras.main.fadeIn(250, 11, 15, 25);

    this.createRoomBaseEnvironment();
    this.createAtmosphereOverlay();
    this.createHUD();
    this.createNavigationControls();
    this.createMiniMap();
    this.createBarisButton();
    this.createTradeProposalBanner();
    this.createNotificationBanner();
    this.createEventTicker();

    // Call subclass specific multi-character room builder
    this.createRoomContent();

    this.bindGameStateEvents();
    this.syncInitialState();
  }

  protected abstract createRoomContent(): void;

  private createRoomBaseEnvironment(): void {
    const { GAME_WIDTH, GAME_HEIGHT } = APP_CONFIG;

    // Wall (Top 140px)
    for (let x = 0; x < GAME_WIDTH; x += 32) {
      for (let y = 0; y < 140; y += 32) {
        this.add.image(x + 16, y + 16, 'wall_tile');
      }
    }

    // Floor (From 140px down)
    for (let x = 0; x < GAME_WIDTH; x += 32) {
      for (let y = 140; y < GAME_HEIGHT; y += 32) {
        this.add.image(x + 16, y + 16, 'floor_tile');
      }
    }

    // Wall Divider Line
    const divider = this.add.graphics();
    divider.lineStyle(4, 0x334155);
    divider.lineBetween(0, 140, GAME_WIDTH, 140);

    // Large High-Contrast Room Signboard Header
    const signBg = this.add.rectangle(GAME_WIDTH / 2, 54, 380, 32, 0x0f172a, 0.98);
    signBg.setStrokeStyle(2, 0x38bdf8);
    this.add.text(GAME_WIDTH / 2, 54, `🏢 ${this.roomName.toUpperCase()}`, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#38bdf8',
    }).setOrigin(0.5);
  }

  // ==========================================
  // ENHANCED PROCEDURAL CHARACTER FACTORY (+50% SCALE)
  // ==========================================
  protected createAgentCharacter(config: AgentVisualConfig, x: number, y: number): RoomCharacterEntity {
    // 1. Desk Drop Shadow
    const isPatron = config.role === 'Patron';
    this.add.image(x, y + 46, 'desk_shadow');

    // 2. Chair
    const chairTexture = isPatron ? 'patron_chair' : 'chair_texture';
    this.add.image(x, y - 14, chairTexture);

    // 3. Desk
    const deskTexture = isPatron ? 'patron_desk' : 'desk_texture';
    const desk = this.add.image(x, y + 22, deskTexture);

    // 4. Monitor / Workstation Screen
    const monitor = this.add.image(x, y + 10, 'monitor_texture');
    this.tweens.add({
      targets: monitor,
      scaleY: 1.04,
      duration: 1200 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
    });

    // 5. Container
    const agentContainer = this.add.container(x, y - 20);

    // Body (24x22 enlarged)
    const body = this.add.rectangle(0, 10, 24, 22, config.shirtColor);
    body.setStrokeStyle(1.5, 0x0f172a);

    const collar = this.add.rectangle(0, 0, 10, 5, config.bodyColor);
    const accessory = this.add.rectangle(0, 8, 5, 10, config.bodyColor);

    // Arms & Hands (Distinct)
    const leftArm = this.add.rectangle(-16, 9, 8, 16, config.shirtColor);
    leftArm.setStrokeStyle(1.5, 0x0f172a);
    const leftHand = this.add.rectangle(-16, 18, 7, 7, 0xfed7aa);
    leftHand.setStrokeStyle(1.5, 0x0f172a);

    const rightArm = this.add.rectangle(16, 9, 8, 16, config.shirtColor);
    rightArm.setStrokeStyle(1.5, 0x0f172a);
    const rightHand = this.add.rectangle(16, 18, 7, 7, 0xfed7aa);
    rightHand.setStrokeStyle(1.5, 0x0f172a);

    // Head & Hair (22x18 enlarged)
    const head = this.add.rectangle(0, -9, 22, 18, 0xfed7aa);
    head.setStrokeStyle(1.5, 0x0f172a);

    const hair = this.add.rectangle(0, -18, 24, 9, config.hairColor);
    const hairLeft = this.add.rectangle(-11, -11, 4, 8, config.hairColor);
    const hairRight = this.add.rectangle(11, -11, 4, 8, config.hairColor);

    // Eyes (3x4 with highlight)
    const leftEye = this.add.rectangle(-5, -10, 3, 4, 0x0f172a);
    const leftEyeLight = this.add.rectangle(-5, -11, 1.5, 1.5, 0xffffff);
    const rightEye = this.add.rectangle(5, -10, 3, 4, 0x0f172a);
    const rightEyeLight = this.add.rectangle(5, -11, 1.5, 1.5, 0xffffff);

    // Dynamic Facial Expression
    const mouthGraphics = this.add.graphics();
    this.drawMouth(mouthGraphics, 'IDLE');

    // Emoji Badge (+50% font)
    const emojiBadge = this.add.text(0, -34, config.avatarIcon, {
      fontSize: '20px',
    }).setOrigin(0.5);

    // Role Tag (+50% font)
    const roleTagBg = this.add.rectangle(0, 58, 140, 20, 0x0f172a, 0.95);
    roleTagBg.setStrokeStyle(1.5, config.shirtColor);
    const roleText = this.add.text(0, 58, config.name, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#f8fafc',
    }).setOrigin(0.5);

    // State Pill (+50% font)
    const stateText = this.add.text(0, 76, '● IDLE', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#10b981',
    }).setOrigin(0.5);

    // Speech Bubble (+50% scale, 210x48)
    const bubbleContainer = this.add.container(0, -82);
    const bubbleBg = this.add.graphics();
    this.drawBubble(bubbleBg, 210, 48);
    const bubbleText = this.add.text(0, -4, 'Hazırda bekliyor', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#0f172a',
      align: 'center',
      wordWrap: { width: 195 },
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

    const tradeIcon = this.add.image(22, -56, 'trading_badge');
    tradeIcon.setVisible(false);

    const warningBadge = this.add.container(0, -60);
    const stopImg = this.add.image(0, 0, 'warning_stop');
    const stopText = this.add.text(0, -20, 'LİMİT AŞIMI!', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ef4444',
    }).setOrigin(0.5);
    warningBadge.add([stopImg, stopText]);
    warningBadge.setVisible(false);

    agentContainer.add([
      leftArm,
      leftHand,
      rightArm,
      rightHand,
      body,
      collar,
      accessory,
      head,
      hair,
      hairLeft,
      hairRight,
      leftEye,
      leftEyeLight,
      rightEye,
      rightEyeLight,
      mouthGraphics,
      emojiBadge,
      roleTagBg,
      roleText,
      stateText,
      alertIcon,
      tradeIcon,
      warningBadge,
      bubbleContainer,
    ]);

    // Idle Breathing
    this.tweens.add({
      targets: [head, hair, hairLeft, hairRight, leftEye, leftEyeLight, rightEye, rightEyeLight, mouthGraphics, emojiBadge],
      y: '-=3',
      duration: 1100 + Math.random() * 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Special Confidence Badge
    let confidenceBadge: Phaser.GameObjects.Container | undefined;
    let confidenceText: Phaser.GameObjects.Text | undefined;

    if (config.role === 'Risk Analisti') {
      confidenceBadge = this.add.container(x + 50, y - 36);
      const cBg = this.add.rectangle(0, 0, 48, 20, 0x064e3b, 0.95);
      cBg.setStrokeStyle(1.5, 0x10b981);
      confidenceText = this.add.text(0, 0, '%75', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#34d399',
      }).setOrigin(0.5);
      confidenceBadge.add([cBg, confidenceText]);
    }

    desk.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.showBanner(`${config.avatarIcon} ${config.role}: [${stateText.text}]`);
    });

    const entity: RoomCharacterEntity = {
      config,
      container: agentContainer,
      bodySprite: body,
      headSprite: head,
      leftArm,
      rightArm,
      leftHand,
      rightHand,
      mouthGraphics,
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
    };

    this.agentsInRoom.set(config.role, entity);
    return entity;
  }

  protected drawMouth(graphics: Phaser.GameObjects.Graphics, state: AgentState): void {
    graphics.clear();
    switch (state) {
      case 'IDLE':
        graphics.lineStyle(1.5, 0x334155, 1);
        graphics.lineBetween(-4, -4, 4, -4);
        break;
      case 'ANALYZING':
        graphics.lineStyle(2, 0x1e293b, 1);
        graphics.lineBetween(-4, -3, 3, -5);
        break;
      case 'ALERTING':
        graphics.fillStyle(0x991b1b, 1);
        graphics.fillCircle(0, -4, 3.5);
        graphics.lineStyle(1.5, 0x0f172a, 1);
        graphics.strokeCircle(0, -4, 3.5);
        break;
      case 'TRADING':
        graphics.lineStyle(2, 0x047857, 1);
        graphics.beginPath();
        graphics.arc(0, -6, 4.5, 0.15 * Math.PI, 0.85 * Math.PI, false);
        graphics.strokePath();
        break;
      case 'SALUTING':
        graphics.fillStyle(0x0f172a, 1);
        graphics.fillCircle(0, -4, 4);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(-3, -6, 6, 2);
        break;
    }
  }

  public setAgentStateInRoom(role: AgentRole, state: AgentState, taskDescription?: string): void {
    const agent = this.agentsInRoom.get(role);
    if (!agent) return;

    this.drawMouth(agent.mouthGraphics, state);
    agent.alertIcon.setVisible(false);
    agent.tradeIcon.setVisible(false);

    if (agent.typingTween) {
      agent.typingTween.stop();
      agent.typingTween = undefined;
      agent.leftHand.setY(18);
      agent.rightHand.setY(18);
      agent.rightArm.setY(9);
    }

    switch (state) {
      case 'IDLE':
        agent.stateText.setText('● IDLE').setColor('#10b981');
        break;
      case 'ANALYZING':
        agent.stateText.setText('⚙ ANALYZING').setColor('#38bdf8');
        agent.typingTween = this.tweens.add({
          targets: [agent.leftHand, agent.rightHand],
          y: '-=3',
          duration: 160,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
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
        agent.typingTween = this.tweens.add({
          targets: [agent.leftHand, agent.rightHand],
          y: '-=4',
          duration: 120,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        if (taskDescription && !agent.isSpeaking) {
          this.queueAgentDialogue(role, taskDescription);
        }
        break;
      case 'SALUTING':
        agent.stateText.setText('👋 SELAM').setColor('#ec4899');
        agent.rightHand.setY(8);
        agent.rightArm.setY(4);
        break;
    }
  }

  public queueAgentDialogue(role: AgentRole, text: string): void {
    const agent = this.agentsInRoom.get(role);
    if (!agent) return;

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
    agent.bubbleText.setText(nextText.slice(0, 70));
    agent.bubbleContainer.setVisible(true);
    agent.bubbleContainer.setAlpha(0);

    this.tweens.add({
      targets: agent.bubbleContainer,
      alpha: 1,
      y: -88,
      duration: 250,
      ease: 'Back.easeOut',
    });

    this.time.delayedCall(4500, () => {
      this.tweens.add({
        targets: agent.bubbleContainer,
        alpha: 0,
        y: -82,
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
  // HUD, NAVIGATION & MINI-MAP (KROKİ)
  // ==========================================
  private createHUD(): void {
    const { GAME_WIDTH } = APP_CONFIG;

    const hudBar = this.add.rectangle(GAME_WIDTH / 2, 22, GAME_WIDTH - 24, 34, 0x0f172a, 0.95);
    hudBar.setStrokeStyle(2, 0x1e293b);
    hudBar.setDepth(20);

    this.statusDot = this.add.circle(180, 22, 6, 0x10b981).setDepth(21);
    this.statusBadgeText = this.add.text(194, 22, 'ONLINE', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#10b981',
    }).setOrigin(0, 0.5).setDepth(21);

    this.balanceText = this.add.text(290, 22, `💰 BAKIYE: $${gameState.totalBalanceUsd.toLocaleString()}`, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#facc15',
    }).setOrigin(0, 0.5).setDepth(21);

    this.positionsText = this.add.text(490, 22, `📈 POZİSYON: ${gameState.openPositionsCount}`, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#38bdf8',
    }).setOrigin(0, 0.5).setDepth(21);

    this.severityText = this.add.text(GAME_WIDTH - 30, 22, `ORTAM: ${gameState.severity}`, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#10b981',
    }).setOrigin(1, 0.5).setDepth(21);
  }

  private createNavigationControls(): void {
    const currentIdx = ROOMS.findIndex((r) => r.key === this.roomKey);
    const prevRoom = ROOMS[(currentIdx - 1 + ROOMS.length) % ROOMS.length];
    const nextRoom = ROOMS[(currentIdx + 1) % ROOMS.length];

    // Left Previous Room Button
    const prevBtn = this.add.rectangle(85, 22, 130, 26, 0x1e293b, 1).setDepth(25);
    prevBtn.setStrokeStyle(1.5, 0x38bdf8);
    prevBtn.setInteractive({ useHandCursor: true });
    this.add.text(85, 22, `◀ ${prevRoom.shortName}`, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#38bdf8',
    }).setOrigin(0.5).setDepth(26);

    prevBtn.on('pointerover', () => prevBtn.setFillStyle(0x334155));
    prevBtn.on('pointerout', () => prevBtn.setFillStyle(0x1e293b));
    prevBtn.on('pointerdown', () => this.switchRoom(prevRoom.key));

    // Right Next Room Button
    const nextBtn = this.add.rectangle(730, 22, 130, 26, 0x1e293b, 1).setDepth(25);
    nextBtn.setStrokeStyle(1.5, 0x38bdf8);
    nextBtn.setInteractive({ useHandCursor: true });
    this.add.text(730, 22, `${nextRoom.shortName} ▶`, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#38bdf8',
    }).setOrigin(0.5).setDepth(26);

    nextBtn.on('pointerover', () => nextBtn.setFillStyle(0x334155));
    nextBtn.on('pointerout', () => nextBtn.setFillStyle(0x1e293b));
    nextBtn.on('pointerdown', () => this.switchRoom(nextRoom.key));
  }

  private createMiniMap(): void {
    const { GAME_WIDTH } = APP_CONFIG;
    const startX = GAME_WIDTH - 150;
    const startY = 60;

    this.miniMapContainer = this.add.container(startX, startY).setDepth(35);

    const mapBg = this.add.rectangle(0, 0, 260, 36, 0x0f172a, 0.95);
    mapBg.setStrokeStyle(1.5, 0x334155);
    this.miniMapContainer.add(mapBg);

    const spacing = 40;
    ROOMS.forEach((room, idx) => {
      const rx = (idx - 2.5) * spacing;
      const isCurrent = room.key === this.roomKey;

      const iconBox = this.add.rectangle(rx, 0, 34, 28, isCurrent ? 0x1e3a8a : 0x1e293b, 1);
      iconBox.setStrokeStyle(isCurrent ? 2 : 1, isCurrent ? 0x38bdf8 : 0x475569);
      iconBox.setInteractive({ useHandCursor: true });

      const iconText = this.add.text(rx, -2, room.icon, { fontSize: '14px' }).setOrigin(0.5);

      // Status LED dot
      const dotColor = gameState.getRoomStatusColor(room.key);
      const dot = this.add.circle(rx + 11, 9, 3.5, dotColor);

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

  private createBarisButton(): void {
    const btnX = 140;
    const btnY = 54;

    const btnBg = this.add.rectangle(btnX, btnY, 150, 28, 0x3b82f6, 1).setDepth(22);
    btnBg.setStrokeStyle(2, 0x93c5fd);

    this.add.text(btnX, btnY, 'Barış Geldi 👋', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(23);

    btnBg.setInteractive({ useHandCursor: true });
    btnBg.on('pointerover', () => btnBg.setFillStyle(0x2563eb));
    btnBg.on('pointerout', () => btnBg.setFillStyle(0x3b82f6));
    btnBg.on('pointerdown', async () => {
      btnBg.setFillStyle(0x1d4ed8);
      this.showBanner('👋 BARIŞ GELDİ, KAPTAN! ODA TEYAKKUZDA! 🚀');
      this.agentsInRoom.forEach((agent) => {
        this.setAgentStateInRoom(agent.config.role, 'SALUTING', 'Hoş geldin Kaptan!');
      });
      await apiService.triggerSignals();
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
    const bg = this.add.rectangle(0, 0, 680, 48, 0x0f172a, 0.98);
    bg.setStrokeStyle(2, 0xf59e0b);

    this.proposalText = this.add.text(-140, -8, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#fbbf24',
    }).setOrigin(0.5);

    this.proposalSubText = this.add.text(-140, 10, '', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    this.proposalTimerText = this.add.text(100, 0, '(30s)', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    const approveBtn = this.add.rectangle(200, 0, 105, 30, 0x10b981, 1);
    approveBtn.setStrokeStyle(1.5, 0x34d399);
    approveBtn.setInteractive({ useHandCursor: true });
    const approveText = this.add.text(200, 0, 'ONAYLA ✅', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
    }).setOrigin(0.5);

    approveBtn.on('pointerdown', async () => {
      if (this.currentProposal) {
        approveBtn.setFillStyle(0x059669);
        await this.executeManualProposal(this.currentProposal);
      }
    });

    const dismissBtn = this.add.rectangle(285, 0, 30, 30, 0xef4444, 1);
    dismissBtn.setStrokeStyle(1.5, 0xf87171);
    dismissBtn.setInteractive({ useHandCursor: true });
    const dismissText = this.add.text(285, 0, '✕', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffffff',
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
    const amount = Number(proposal.suggestedAmountUsd || proposal.estimatedAmountUsd || 50);
    const side = (proposal.side || 'BUY').toUpperCase() as 'BUY' | 'SELL';
    const symbol = proposal.symbol || 'BTC/USDT';

    this.currentProposal = proposal;
    this.proposalText.setText(`🎩 PATRON KARARI: ${side} ${symbol} ($${amount})`);

    const slStr = proposal.suggestedStopLoss ? `SL: $${proposal.suggestedStopLoss.toLocaleString()}` : '';
    const tpStr = proposal.suggestedTakeProfit ? `TP: $${proposal.suggestedTakeProfit.toLocaleString()}` : '';
    const catStr = proposal.sourceCategory ? `[${proposal.sourceCategory}]` : '';

    this.proposalSubText.setText(
      [catStr, slStr, tpStr].filter(Boolean).join(' | ') || 'Baş Analist Nihai Onayında'
    );

    this.proposalContainer.setVisible(true);
    this.proposalContainer.setAlpha(1);

    this.showBanner(`⚡ PATRON ÖNERİSİ: ${side} ${symbol} ($${amount})`, 3500);

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

    const tickerBar = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 16, GAME_WIDTH - 24, 26, 0x0f172a, 0.95);
    tickerBar.setStrokeStyle(1, 0x334155);
    tickerBar.setDepth(20);

    this.add.text(24, GAME_HEIGHT - 16, '📡 CANLI AKIŞ:', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#38bdf8',
    }).setOrigin(0, 0.5).setDepth(21);

    this.tickerText = this.add.text(140, GAME_HEIGHT - 16, gameState.latestTicker, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#94a3b8',
    }).setOrigin(0, 0.5).setDepth(21);
  }

  public updateTicker(message: string): void {
    if (this.tickerText) {
      this.tickerText.setText(message.slice(0, 110));
    }
  }

  // ==========================================
  // STATE SYNC & SUBSCRIPTIONS
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
        if (this.positionsText) this.positionsText.setText(`📈 POZİSYON: ${count}`);
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
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
    if (this.proposalExpiryTimer) {
      this.proposalExpiryTimer.remove();
      this.proposalExpiryTimer = null;
    }
  }
}
