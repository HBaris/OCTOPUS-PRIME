import Phaser from 'phaser';
import { APP_CONFIG, AgentVisualConfig, SEVERITY_COLORS } from '../config.ts';
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
}

export abstract class BaseRoomScene extends Phaser.Scene {
  protected abstract agentRole: AgentRole;
  protected abstract roomName: string;

  protected characterEntity: RoomCharacterEntity | null = null;
  private severityOverlay!: Phaser.GameObjects.Rectangle;
  private severityTween: Phaser.Tweens.Tween | null = null;

  // HUD Elements
  private statusBadgeText!: Phaser.GameObjects.Text;
  private statusDot!: Phaser.GameObjects.Arc;
  private balanceText!: Phaser.GameObjects.Text;
  private positionsText!: Phaser.GameObjects.Text;
  private severityText!: Phaser.GameObjects.Text;
  private tickerText!: Phaser.GameObjects.Text;

  // Notification & Trade Proposal Banners
  private bannerContainer!: Phaser.GameObjects.Container;
  private bannerText!: Phaser.GameObjects.Text;
  private proposalContainer!: Phaser.GameObjects.Container;
  private proposalText!: Phaser.GameObjects.Text;
  private proposalSubText!: Phaser.GameObjects.Text;
  private proposalTimerText!: Phaser.GameObjects.Text;
  private proposalExpiryTimer: Phaser.Time.TimerEvent | null = null;
  private currentProposal: TradeProposalPayload | null = null;

  // Dialogue Queue
  private dialogueQueue: string[] = [];
  private isSpeaking = false;
  private unsubs: Array<() => void> = [];

  create(): void {
    this.cameras.main.fadeIn(300, 11, 15, 25);

    this.createRoomBaseEnvironment();
    this.createAtmosphereOverlay();
    this.createHUD();
    this.createReturnButton();
    this.createBarisButton();
    this.createTradeProposalBanner();
    this.createNotificationBanner();
    this.createEventTicker();

    // Call subclass specific room builder
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

    // Room Signboard Header
    const signBg = this.add.rectangle(GAME_WIDTH / 2, 54, 300, 26, 0x0f172a, 0.95);
    signBg.setStrokeStyle(2, 0x38bdf8);
    this.add.text(GAME_WIDTH / 2, 54, `🏢 ${this.roomName.toUpperCase()}`, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#38bdf8',
    }).setOrigin(0.5);
  }

  protected createAgentCharacter(config: AgentVisualConfig, x = 480, y = 350): RoomCharacterEntity {
    // 1. Desk Drop Shadow
    this.add.image(x, y + 42, 'desk_shadow');

    // 2. Chair
    const chairTexture = config.role === 'Patron' ? 'patron_chair' : 'chair_texture';
    this.add.image(x, y - 12, chairTexture);

    // 3. Desk
    const deskTexture = config.role === 'Patron' ? 'patron_desk' : 'desk_texture';
    const desk = this.add.image(x, y + 20, deskTexture);

    // 4. Monitor (or Desk accessories)
    const monitor = this.add.image(x, y + 10, 'monitor_texture');
    this.tweens.add({
      targets: monitor,
      scaleY: 1.03,
      duration: 1400,
      yoyo: true,
      repeat: -1,
    });

    // 5. Container
    const agentContainer = this.add.container(x, y - 16);

    // Body
    const body = this.add.rectangle(0, 8, 18, 16, config.shirtColor);
    body.setStrokeStyle(1, 0x0f172a);

    const collar = this.add.rectangle(0, 1, 8, 4, config.bodyColor);
    const accessory = this.add.rectangle(0, 7, 4, 7, config.bodyColor);

    // Arms & Hands
    const leftArm = this.add.rectangle(-12, 7, 6, 12, config.shirtColor);
    leftArm.setStrokeStyle(1, 0x0f172a);
    const leftHand = this.add.rectangle(-12, 14, 5, 5, 0xfed7aa);
    leftHand.setStrokeStyle(1, 0x0f172a);

    const rightArm = this.add.rectangle(12, 7, 6, 12, config.shirtColor);
    rightArm.setStrokeStyle(1, 0x0f172a);
    const rightHand = this.add.rectangle(12, 14, 5, 5, 0xfed7aa);
    rightHand.setStrokeStyle(1, 0x0f172a);

    // Head & Hair
    const head = this.add.rectangle(0, -7, 18, 15, 0xfed7aa);
    head.setStrokeStyle(1, 0x0f172a);

    const hair = this.add.rectangle(0, -14, 20, 7, config.hairColor);
    const hairLeft = this.add.rectangle(-9, -9, 3, 6, config.hairColor);
    const hairRight = this.add.rectangle(9, -9, 3, 6, config.hairColor);

    // Eyes
    const leftEye = this.add.rectangle(-4, -8, 2, 3, 0x0f172a);
    const leftEyeLight = this.add.rectangle(-4, -9, 1, 1, 0xffffff);
    const rightEye = this.add.rectangle(4, -8, 2, 3, 0x0f172a);
    const rightEyeLight = this.add.rectangle(4, -9, 1, 1, 0xffffff);

    // Mouth Graphics
    const mouthGraphics = this.add.graphics();
    this.drawMouth(mouthGraphics, 'IDLE');

    // Emoji Badge
    const emojiBadge = this.add.text(0, -28, config.avatarIcon, {
      fontSize: '16px',
    }).setOrigin(0.5);

    // Role Tag
    const roleTagBg = this.add.rectangle(0, 52, 130, 16, 0x0f172a, 0.95);
    roleTagBg.setStrokeStyle(1, config.shirtColor);
    const roleText = this.add.text(0, 52, config.name, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#f8fafc',
    }).setOrigin(0.5);

    // Status Pill
    const stateText = this.add.text(0, 68, '● IDLE', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#10b981',
    }).setOrigin(0.5);

    // Speech Bubble
    const bubbleContainer = this.add.container(0, -72);
    const bubbleBg = this.add.graphics();
    this.drawBubble(bubbleBg, 180, 42);
    const bubbleText = this.add.text(0, -4, 'Hazırda bekliyor', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#0f172a',
      align: 'center',
      wordWrap: { width: 168 },
    }).setOrigin(0.5);
    bubbleContainer.add([bubbleBg, bubbleText]);
    bubbleContainer.setVisible(false);

    // Alert & Trade Icons
    const alertIcon = this.add.image(0, -46, 'alert_bubble');
    alertIcon.setVisible(false);
    this.tweens.add({
      targets: alertIcon,
      y: -52,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    const tradeIcon = this.add.image(18, -46, 'trading_badge');
    tradeIcon.setVisible(false);

    const warningBadge = this.add.container(0, -50);
    const stopImg = this.add.image(0, 0, 'warning_stop');
    const stopText = this.add.text(0, -18, 'LİMİT AŞIMI!', {
      fontFamily: 'monospace',
      fontSize: '8px',
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

    // Breathing Animation
    this.tweens.add({
      targets: [head, hair, hairLeft, hairRight, leftEye, leftEyeLight, rightEye, rightEyeLight, mouthGraphics, emojiBadge],
      y: '-=2',
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Special Confidence Badge for Risk Analisti
    let confidenceBadge: Phaser.GameObjects.Container | undefined;
    let confidenceText: Phaser.GameObjects.Text | undefined;

    if (config.role === 'Risk Analisti') {
      confidenceBadge = this.add.container(x + 46, y - 32);
      const cBg = this.add.rectangle(0, 0, 44, 18, 0x064e3b, 0.95);
      cBg.setStrokeStyle(1, 0x10b981);
      confidenceText = this.add.text(0, 0, '%75', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#34d399',
      }).setOrigin(0.5);
      confidenceBadge.add([cBg, confidenceText]);
    }

    desk.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.showBanner(`${config.avatarIcon} ${config.role}: [${stateText.text}]`);
    });

    this.characterEntity = {
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
    };

    return this.characterEntity;
  }

  protected drawMouth(graphics: Phaser.GameObjects.Graphics, state: AgentState): void {
    graphics.clear();
    switch (state) {
      case 'IDLE':
        graphics.lineStyle(1, 0x334155, 1);
        graphics.lineBetween(-3, -3, 3, -3);
        break;
      case 'ANALYZING':
        graphics.lineStyle(1.5, 0x1e293b, 1);
        graphics.lineBetween(-3, -2, 2, -4);
        break;
      case 'ALERTING':
        graphics.fillStyle(0x991b1b, 1);
        graphics.fillCircle(0, -3, 2.5);
        graphics.lineStyle(1, 0x0f172a, 1);
        graphics.strokeCircle(0, -3, 2.5);
        break;
      case 'TRADING':
        graphics.lineStyle(1.5, 0x047857, 1);
        graphics.beginPath();
        graphics.arc(0, -5, 3.5, 0.15 * Math.PI, 0.85 * Math.PI, false);
        graphics.strokePath();
        break;
      case 'SALUTING':
        graphics.fillStyle(0x0f172a, 1);
        graphics.fillCircle(0, -3, 3);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(-2, -5, 4, 1.5);
        break;
    }
  }

  public setLocalAgentState(state: AgentState, taskDescription?: string): void {
    if (!this.characterEntity) return;

    this.drawMouth(this.characterEntity.mouthGraphics, state);
    this.characterEntity.alertIcon.setVisible(false);
    this.characterEntity.tradeIcon.setVisible(false);

    if (this.characterEntity.typingTween) {
      this.characterEntity.typingTween.stop();
      this.characterEntity.typingTween = undefined;
      this.characterEntity.leftHand.setY(14);
      this.characterEntity.rightHand.setY(14);
      this.characterEntity.rightArm.setY(7);
    }

    switch (state) {
      case 'IDLE':
        this.characterEntity.stateText.setText('● IDLE').setColor('#10b981');
        break;
      case 'ANALYZING':
        this.characterEntity.stateText.setText('⚙ ANALYZING').setColor('#38bdf8');
        this.characterEntity.typingTween = this.tweens.add({
          targets: [this.characterEntity.leftHand, this.characterEntity.rightHand],
          y: '-=2',
          duration: 160,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        if (taskDescription && !this.isSpeaking) {
          this.queueDialogue(taskDescription);
        }
        break;
      case 'ALERTING':
        this.characterEntity.stateText.setText('! ALERT').setColor('#ef4444');
        this.characterEntity.alertIcon.setVisible(true);
        if (taskDescription && !this.isSpeaking) {
          this.queueDialogue(taskDescription);
        }
        break;
      case 'TRADING':
        this.characterEntity.stateText.setText('⚡ TRADING').setColor('#f59e0b');
        this.characterEntity.tradeIcon.setVisible(true);
        this.characterEntity.typingTween = this.tweens.add({
          targets: [this.characterEntity.leftHand, this.characterEntity.rightHand],
          y: '-=3',
          duration: 120,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        if (taskDescription && !this.isSpeaking) {
          this.queueDialogue(taskDescription);
        }
        break;
      case 'SALUTING':
        this.characterEntity.stateText.setText('👋 SELAM').setColor('#ec4899');
        this.characterEntity.rightHand.setY(6);
        this.characterEntity.rightArm.setY(3);
        break;
    }
  }

  public queueDialogue(text: string): void {
    this.dialogueQueue.push(text);
    if (!this.isSpeaking) {
      this.processDialogueQueue();
    }
  }

  private processDialogueQueue(): void {
    if (!this.characterEntity || this.dialogueQueue.length === 0) {
      this.isSpeaking = false;
      return;
    }

    this.isSpeaking = true;
    const nextText = this.dialogueQueue.shift()!;
    this.characterEntity.bubbleText.setText(nextText.slice(0, 64));
    this.characterEntity.bubbleContainer.setVisible(true);
    this.characterEntity.bubbleContainer.setAlpha(0);

    this.tweens.add({
      targets: this.characterEntity.bubbleContainer,
      alpha: 1,
      y: -74,
      duration: 250,
      ease: 'Back.easeOut',
    });

    this.time.delayedCall(4500, () => {
      if (!this.characterEntity) return;
      this.tweens.add({
        targets: this.characterEntity.bubbleContainer,
        alpha: 0,
        y: -70,
        duration: 300,
        onComplete: () => {
          if (this.characterEntity) this.characterEntity.bubbleContainer.setVisible(false);
          this.time.delayedCall(400, () => this.processDialogueQueue());
        },
      });
    });
  }

  private drawBubble(graphics: Phaser.GameObjects.Graphics, width: number, height: number): void {
    graphics.clear();
    graphics.fillStyle(0xffffff, 0.98);
    graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 6);
    graphics.lineStyle(1, 0x1e293b);
    graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 6);

    graphics.fillStyle(0xffffff, 0.98);
    graphics.beginPath();
    graphics.moveTo(-4, height / 2);
    graphics.lineTo(4, height / 2);
    graphics.lineTo(0, height / 2 + 5);
    graphics.closePath();
    graphics.fillPath();
  }

  // ==========================================
  // HUD, BUTTONS & COMMON CONTROLS
  // ==========================================
  private createHUD(): void {
    const { GAME_WIDTH } = APP_CONFIG;

    const hudBar = this.add.rectangle(GAME_WIDTH / 2, 22, GAME_WIDTH - 24, 34, 0x0f172a, 0.95);
    hudBar.setStrokeStyle(2, 0x1e293b);
    hudBar.setDepth(20);

    this.statusDot = this.add.circle(130, 22, 5, 0x10b981).setDepth(21);
    this.statusBadgeText = this.add.text(142, 22, 'ONLINE', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#10b981',
    }).setOrigin(0, 0.5).setDepth(21);

    this.balanceText = this.add.text(260, 22, `💰 BAKIYE: $${gameState.totalBalanceUsd.toLocaleString()}`, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#facc15',
    }).setOrigin(0, 0.5).setDepth(21);

    this.positionsText = this.add.text(440, 22, `📈 POZİSYON: ${gameState.openPositionsCount}`, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#38bdf8',
    }).setOrigin(0, 0.5).setDepth(21);

    this.severityText = this.add.text(GAME_WIDTH - 30, 22, `ORTAM: ${gameState.severity}`, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#10b981',
    }).setOrigin(1, 0.5).setDepth(21);
  }

  private createReturnButton(): void {
    const returnBtn = this.add.image(60, 22, 'return_door').setDepth(25);
    returnBtn.setInteractive({ useHandCursor: true });

    returnBtn.on('pointerover', () => returnBtn.setScale(1.05));
    returnBtn.on('pointerout', () => returnBtn.setScale(1.0));
    returnBtn.on('pointerdown', () => this.returnToLobby());
  }

  private returnToLobby(): void {
    this.cameras.main.fadeOut(250, 11, 15, 25);
    this.time.delayedCall(250, () => {
      this.scene.start('LobbyScene');
    });
  }

  private createBarisButton(): void {
    const { GAME_WIDTH } = APP_CONFIG;
    const btnX = GAME_WIDTH / 2 + 100;
    const btnY = 22;

    const btnBg = this.add.rectangle(btnX, btnY, 130, 24, 0x3b82f6, 1);
    btnBg.setStrokeStyle(2, 0x93c5fd);
    btnBg.setDepth(22);

    this.add.text(btnX, btnY, 'Barış Geldi 👋', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(23);

    btnBg.setInteractive({ useHandCursor: true });
    btnBg.on('pointerover', () => btnBg.setFillStyle(0x2563eb));
    btnBg.on('pointerout', () => btnBg.setFillStyle(0x3b82f6));
    btnBg.on('pointerdown', async () => {
      btnBg.setFillStyle(0x1d4ed8);
      this.showBanner('👋 BARIŞ GELDİ, KAPTAN! ODA TEYAKKUZDA! 🚀');
      if (this.characterEntity) {
        this.setLocalAgentState('SALUTING', 'Hoş geldin Kaptan!');
      }
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

    this.proposalContainer = this.add.container(GAME_WIDTH / 2, 80).setDepth(150);
    const bg = this.add.rectangle(0, 0, 620, 42, 0x0f172a, 0.98);
    bg.setStrokeStyle(2, 0xf59e0b);

    this.proposalText = this.add.text(-120, -7, '', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#fbbf24',
    }).setOrigin(0.5);

    this.proposalSubText = this.add.text(-120, 9, '', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    this.proposalTimerText = this.add.text(90, 0, '(30s)', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    const approveBtn = this.add.rectangle(185, 0, 95, 26, 0x10b981, 1);
    approveBtn.setStrokeStyle(1, 0x34d399);
    approveBtn.setInteractive({ useHandCursor: true });
    const approveText = this.add.text(185, 0, 'ONAYLA ✅', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#ffffff',
    }).setOrigin(0.5);

    approveBtn.on('pointerdown', async () => {
      if (this.currentProposal) {
        approveBtn.setFillStyle(0x059669);
        await this.executeManualProposal(this.currentProposal);
      }
    });

    const dismissBtn = this.add.rectangle(260, 0, 26, 26, 0xef4444, 1);
    dismissBtn.setStrokeStyle(1, 0xf87171);
    dismissBtn.setInteractive({ useHandCursor: true });
    const dismissText = this.add.text(260, 0, '✕', {
      fontFamily: 'monospace',
      fontSize: '9px',
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

    this.bannerContainer = this.add.container(GAME_WIDTH / 2, 114).setDepth(30);
    const bg = this.add.rectangle(0, 0, 540, 26, 0x1e293b, 0.95);
    bg.setStrokeStyle(2, 0x38bdf8);

    this.bannerText = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '9px',
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

    const tickerBar = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 16, GAME_WIDTH - 24, 24, 0x0f172a, 0.95);
    tickerBar.setStrokeStyle(1, 0x334155);
    tickerBar.setDepth(20);

    this.add.text(24, GAME_HEIGHT - 16, '📡 CANLI AKIŞ:', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#38bdf8',
    }).setOrigin(0, 0.5).setDepth(21);

    this.tickerText = this.add.text(120, GAME_HEIGHT - 16, gameState.latestTicker, {
      fontFamily: 'monospace',
      fontSize: '8px',
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
        if (role === this.agentRole) {
          this.setLocalAgentState(state, task);
        }
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
    const localAgent = gameState.agents.get(this.agentRole);
    if (localAgent) {
      this.setLocalAgentState(localAgent.state, localAgent.currentTask);
      if (this.characterEntity && this.characterEntity.confidenceText && localAgent.confidence !== undefined) {
        this.characterEntity.confidenceText.setText(`%${Math.round(localAgent.confidence * 100)}`);
      }
    }
    this.updateAtmosphere(gameState.severity);
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
