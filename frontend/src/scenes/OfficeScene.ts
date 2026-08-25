import Phaser from 'phaser';
import { APP_CONFIG, AGENT_CONFIGS, AgentVisualConfig, SEVERITY_COLORS } from '../config.ts';
import {
  AgentRole,
  AgentState,
  SceneSeverity,
  AgentActionPayload,
  SceneSeverityPayload,
  RiskConfidencePayload,
  SpendingLimitWarningPayload,
  PortfolioUpdatePayload,
  NewNewsPayload,
  SignalGeneratedPayload,
  SystemStatusPayload,
  TradeProposalPayload,
} from '../types/events.ts';
import { wsService } from '../services/websocket.ts';
import { apiService } from '../services/api.ts';
import { formatSignalDialogue } from '../utils/signalDialogue.ts';

interface AgentEntity {
  config: AgentVisualConfig;
  container: Phaser.GameObjects.Container;
  bodySprite: Phaser.GameObjects.Rectangle;
  headSprite: Phaser.GameObjects.Rectangle;
  leftArm: Phaser.GameObjects.Rectangle;
  rightArm: Phaser.GameObjects.Rectangle;
  leftHand: Phaser.GameObjects.Rectangle;
  rightHand: Phaser.GameObjects.Rectangle;
  leftEye: Phaser.GameObjects.Rectangle;
  rightEye: Phaser.GameObjects.Rectangle;
  mouthGraphics: Phaser.GameObjects.Graphics;
  avatarText: Phaser.GameObjects.Text;
  stateText: Phaser.GameObjects.Text;
  bubbleContainer: Phaser.GameObjects.Container;
  bubbleBg: Phaser.GameObjects.Graphics;
  bubbleText: Phaser.GameObjects.Text;
  alertIcon: Phaser.GameObjects.Image;
  tradeIcon: Phaser.GameObjects.Image;
  warningBadge: Phaser.GameObjects.Container;
  confidenceBadge?: Phaser.GameObjects.Container;
  confidenceText?: Phaser.GameObjects.Text;
  currentState: AgentState;
  currentTask: string;
  monitorSprite: Phaser.GameObjects.Image;
  deskSprite: Phaser.GameObjects.Image;
  typingTween?: Phaser.Tweens.Tween;
}

export class OfficeScene extends Phaser.Scene {
  private agents: Map<AgentRole, AgentEntity> = new Map();
  private severityOverlay!: Phaser.GameObjects.Rectangle;
  private currentSeverity: SceneSeverity = 'HAFİF';
  private severityTween: Phaser.Tweens.Tween | null = null;

  // HUD Elements
  private statusBadgeText!: Phaser.GameObjects.Text;
  private statusDot!: Phaser.GameObjects.Arc;
  private balanceText!: Phaser.GameObjects.Text;
  private positionsText!: Phaser.GameObjects.Text;
  private severityText!: Phaser.GameObjects.Text;
  private tickerText!: Phaser.GameObjects.Text;

  // Notification Banner
  private bannerContainer!: Phaser.GameObjects.Container;
  private bannerText!: Phaser.GameObjects.Text;

  // Trade Proposal Approval Banner
  private proposalContainer!: Phaser.GameObjects.Container;
  private proposalText!: Phaser.GameObjects.Text;
  private proposalSubText!: Phaser.GameObjects.Text;
  private proposalTimerText!: Phaser.GameObjects.Text;
  private proposalExpiryTimer: Phaser.Time.TimerEvent | null = null;
  private currentProposal: TradeProposalPayload | null = null;

  // Sinyal Avcısı (Ali) Speech Queue
  private aliDialogueQueue: string[] = [];
  private isAliSpeaking = false;

  constructor() {
    super({ key: 'OfficeScene' });
  }

  public getCurrentSeverity(): SceneSeverity {
    return this.currentSeverity;
  }

  create(): void {
    this.createOfficeEnvironment();
    this.createDesksAndAgents();
    this.createAtmosphereOverlay();
    this.createHUD();
    this.createBarisButton();
    this.createTradeProposalBanner();
    this.createNotificationBanner();
    this.createEventTicker();

    this.initWebSocketListeners();
    this.fetchInitialState();
  }

  // ==========================================
  // 1. ENVIRONMENT & TILEMAP SETUP
  // ==========================================
  private createOfficeEnvironment(): void {
    const { GAME_WIDTH, GAME_HEIGHT } = APP_CONFIG;

    // Background Wall (Top 128px)
    for (let x = 0; x < GAME_WIDTH; x += 32) {
      for (let y = 0; y < 128; y += 32) {
        this.add.image(x + 16, y + 16, 'wall_tile');
      }
    }

    // Textured Floor (From y=128 down)
    for (let x = 0; x < GAME_WIDTH; x += 32) {
      for (let y = 128; y < GAME_HEIGHT; y += 32) {
        this.add.image(x + 16, y + 16, 'floor_tile');
      }
    }

    // Wall Divider Line
    const divider = this.add.graphics();
    divider.lineStyle(4, 0x334155);
    divider.lineBetween(0, 128, GAME_WIDTH, 128);

    // Wall Clock
    const clockBg = this.add.circle(480, 56, 18, 0x1e293b);
    clockBg.setStrokeStyle(2, 0x94a3b8);
    const clockText = this.add.text(480, 56, '15m', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#38bdf8',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: clockText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Office Decorations
    this.add.image(40, 75, 'server_rack');
    this.add.image(920, 110, 'plant_texture');
    this.add.image(40, 540, 'plant_texture');
    this.add.image(915, 520, 'cooler_texture');

    // Office Signboard
    const signBg = this.add.rectangle(480, 20, 240, 24, 0x0f172a);
    signBg.setStrokeStyle(2, 0x38bdf8);
    this.add.text(480, 20, '⚡ CRYPTO TRADING AGENTS ⚡', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#38bdf8',
    }).setOrigin(0.5);
  }

  // ==========================================
  // 2. AGENTS & DETAILED PIXEL ART CHARACTERS
  // ==========================================
  private createDesksAndAgents(): void {
    AGENT_CONFIGS.forEach((config) => {
      // 1. Desk Drop Shadow
      this.add.image(config.x, config.y + 40, 'desk_shadow');

      // 2. Chair
      this.add.image(config.x, config.y - 12, 'chair_texture');

      // 3. Desk
      const desk = this.add.image(config.x, config.y + 20, 'desk_texture');

      // 4. Monitor
      const monitor = this.add.image(config.x, config.y + 12, 'monitor_texture');

      // Monitor Screen Pulsing Animation
      this.tweens.add({
        targets: monitor,
        scaleY: 1.03,
        duration: 1200 + Math.random() * 600,
        yoyo: true,
        repeat: -1,
      });

      // 5. Agent Character Container
      const agentContainer = this.add.container(config.x, config.y - 16);

      // Character Torso / Body (Theme colored clothing)
      const body = this.add.rectangle(0, 8, 18, 16, config.shirtColor);
      body.setStrokeStyle(1, 0x0f172a);

      // Collar / Tie / Theme Accessory Detail
      const collar = this.add.rectangle(0, 1, 8, 4, config.bodyColor);
      const accessory = this.add.rectangle(0, 7, 4, 7, config.bodyColor);

      // Arms & Hands (Distinct from body, placed on desk/keyboard)
      const leftArm = this.add.rectangle(-12, 7, 6, 12, config.shirtColor);
      leftArm.setStrokeStyle(1, 0x0f172a);
      const leftHand = this.add.rectangle(-12, 14, 5, 5, 0xfed7aa);
      leftHand.setStrokeStyle(1, 0x0f172a);

      const rightArm = this.add.rectangle(12, 7, 6, 12, config.shirtColor);
      rightArm.setStrokeStyle(1, 0x0f172a);
      const rightHand = this.add.rectangle(12, 14, 5, 5, 0xfed7aa);
      rightHand.setStrokeStyle(1, 0x0f172a);

      // Agent Head (Skin Tone)
      const head = this.add.rectangle(0, -7, 18, 15, 0xfed7aa);
      head.setStrokeStyle(1, 0x0f172a);

      // Hair
      const hair = this.add.rectangle(0, -14, 20, 7, config.hairColor);
      const hairLeft = this.add.rectangle(-9, -9, 3, 6, config.hairColor);
      const hairRight = this.add.rectangle(9, -9, 3, 6, config.hairColor);

      // Eye Details (2x3 dark pixels + 1x1 white specular highlight)
      const leftEye = this.add.rectangle(-4, -8, 2, 3, 0x0f172a);
      const leftEyeLight = this.add.rectangle(-4, -9, 1, 1, 0xffffff);

      const rightEye = this.add.rectangle(4, -8, 2, 3, 0x0f172a);
      const rightEyeLight = this.add.rectangle(4, -9, 1, 1, 0xffffff);

      // Procedural Facial Expression (Mouth Graphics)
      const mouthGraphics = this.add.graphics();
      this.drawMouth(mouthGraphics, 'IDLE');

      // Agent Emoji Badge
      const emojiBadge = this.add.text(0, -28, config.avatarIcon, {
        fontSize: '15px',
      }).setOrigin(0.5);

      // Agent Role Tag
      const roleTagBg = this.add.rectangle(0, 48, 100, 16, 0x0f172a, 0.9);
      roleTagBg.setStrokeStyle(1, config.shirtColor);
      const roleText = this.add.text(0, 48, config.name, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#f8fafc',
      }).setOrigin(0.5);

      // Status Indicator Pill
      const stateText = this.add.text(0, 62, '● IDLE', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#10b981',
      }).setOrigin(0.5);

      // Speech / Thought Bubble (Wider and styled for dialogue)
      const bubbleContainer = this.add.container(0, -68);
      const bubbleBg = this.add.graphics();
      this.drawBubble(bubbleBg, 154, 38);
      const bubbleText = this.add.text(0, -4, 'Hazırda bekliyor', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#0f172a',
        align: 'center',
        wordWrap: { width: 144 },
      }).setOrigin(0.5);
      bubbleContainer.add([bubbleBg, bubbleText]);
      bubbleContainer.setVisible(false);

      // Alert Icon (!)
      const alertIcon = this.add.image(0, -44, 'alert_bubble');
      alertIcon.setVisible(false);
      this.tweens.add({
        targets: alertIcon,
        y: -50,
        duration: 500,
        yoyo: true,
        repeat: -1,
      });

      // Trade Badge
      const tradeIcon = this.add.image(16, -44, 'trading_badge');
      tradeIcon.setVisible(false);

      // Spending Limit Warning Badge (🛑)
      const warningBadge = this.add.container(0, -48);
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

      // Idle Breathing Animation (1-2px smooth vertical sine wave)
      this.tweens.add({
        targets: [head, hair, hairLeft, hairRight, leftEye, leftEyeLight, rightEye, rightEyeLight, mouthGraphics, emojiBadge],
        y: '-=2',
        duration: 1000 + Math.random() * 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Special Confidence Badge for "Risk Analisti"
      let confidenceBadge: Phaser.GameObjects.Container | undefined;
      let confidenceText: Phaser.GameObjects.Text | undefined;

      if (config.role === 'Risk Analisti') {
        confidenceBadge = this.add.container(config.x + 36, config.y - 32);
        const cBg = this.add.rectangle(0, 0, 38, 16, 0x064e3b, 0.95);
        cBg.setStrokeStyle(1, 0x10b981);
        confidenceText = this.add.text(0, 0, '%75', {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#34d399',
        }).setOrigin(0.5);
        confidenceBadge.add([cBg, confidenceText]);
      }

      // Interactive Click on Agent
      desk.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.showAgentDetails(config.role);
      });
      head.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.showAgentDetails(config.role);
      });

      const entity: AgentEntity = {
        config,
        container: agentContainer,
        bodySprite: body,
        headSprite: head,
        leftArm,
        rightArm,
        leftHand,
        rightHand,
        leftEye,
        rightEye,
        mouthGraphics,
        avatarText: emojiBadge,
        stateText,
        bubbleContainer,
        bubbleBg,
        bubbleText,
        alertIcon,
        tradeIcon,
        warningBadge,
        confidenceBadge,
        confidenceText,
        currentState: 'IDLE',
        currentTask: 'Beklemede',
        monitorSprite: monitor,
        deskSprite: desk,
      };

      this.agents.set(config.role, entity);
    });
  }

  /**
   * Procedural facial expression renderer based on agent state
   */
  private drawMouth(graphics: Phaser.GameObjects.Graphics, state: AgentState): void {
    graphics.clear();

    switch (state) {
      case 'IDLE':
        // Neutral calm straight line
        graphics.lineStyle(1, 0x334155, 1);
        graphics.lineBetween(-3, -3, 3, -3);
        break;

      case 'ANALYZING':
        // Thoughtful / slanted pensive line
        graphics.lineStyle(1.5, 0x1e293b, 1);
        graphics.lineBetween(-3, -2, 2, -4);
        break;

      case 'ALERTING':
        // Surprised open 'O' mouth
        graphics.fillStyle(0x991b1b, 1);
        graphics.fillCircle(0, -3, 2.5);
        graphics.lineStyle(1, 0x0f172a, 1);
        graphics.strokeCircle(0, -3, 2.5);
        break;

      case 'TRADING':
        // Determined, confident smile / smirk
        graphics.lineStyle(1.5, 0x047857, 1);
        graphics.beginPath();
        graphics.arc(0, -5, 3.5, 0.15 * Math.PI, 0.85 * Math.PI, false);
        graphics.strokePath();
        break;

      case 'SALUTING':
        // Wide cheerful happy smile
        graphics.fillStyle(0x0f172a, 1);
        graphics.fillCircle(0, -3, 3);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(-2, -5, 4, 1.5);
        break;
    }
  }

  // ==========================================
  // 3. ATMOSPHERE & SEVERITY LIGHTING
  // ==========================================
  private createAtmosphereOverlay(): void {
    const { GAME_WIDTH, GAME_HEIGHT } = APP_CONFIG;

    this.severityOverlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x10b981,
      0.08
    );
    this.severityOverlay.setDepth(10);
    this.severityOverlay.setBlendMode(Phaser.BlendModes.ADD);
  }

  public updateSceneSeverity(severity: SceneSeverity): void {
    this.currentSeverity = severity;
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
      ease: 'Power2',
    });

    if (this.severityText) {
      this.severityText.setText(`ORTAM: ${config.name}`);
      this.severityText.setColor(severity === 'KATASTROFİK' || severity === 'ÇOK AĞIR' ? '#ef4444' : '#10b981');
    }

    if (severity === 'KATASTROFİK') {
      this.severityTween = this.tweens.add({
        targets: this.severityOverlay,
        alpha: 0.65,
        duration: 400,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  // ==========================================
  // 4. TOP RETRO HUD PANEL
  // ==========================================
  private createHUD(): void {
    const { GAME_WIDTH } = APP_CONFIG;

    const hudBar = this.add.rectangle(GAME_WIDTH / 2, 22, GAME_WIDTH - 24, 34, 0x0f172a, 0.95);
    hudBar.setStrokeStyle(2, 0x1e293b);
    hudBar.setDepth(20);

    this.statusDot = this.add.circle(32, 22, 5, 0xef4444).setDepth(21);
    this.statusBadgeText = this.add.text(44, 22, 'OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#94a3b8',
    }).setOrigin(0, 0.5).setDepth(21);

    this.balanceText = this.add.text(180, 22, '💰 BAKIYE: $10,000.00', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#facc15',
    }).setOrigin(0, 0.5).setDepth(21);

    this.positionsText = this.add.text(380, 22, '📈 POZİSYON: 0', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#38bdf8',
    }).setOrigin(0, 0.5).setDepth(21);

    this.severityText = this.add.text(GAME_WIDTH - 30, 22, 'ORTAM: HAFİF', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#10b981',
    }).setOrigin(1, 0.5).setDepth(21);
  }

  // ==========================================
  // 5. "BARIŞ GELDİ 👋" BUTTON & GREETING
  // ==========================================
  private createBarisButton(): void {
    const { GAME_WIDTH } = APP_CONFIG;
    const btnX = GAME_WIDTH / 2;
    const btnY = 22;

    const btnBg = this.add.rectangle(btnX, btnY, 150, 24, 0x3b82f6, 1);
    btnBg.setStrokeStyle(2, 0x93c5fd);
    btnBg.setDepth(22);

    const btnText = this.add.text(btnX, btnY, 'Barış Geldi 👋', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(23);

    btnBg.setInteractive({ useHandCursor: true });

    btnBg.on('pointerover', () => {
      btnBg.setFillStyle(0x2563eb);
      btnBg.setScale(1.05);
      btnText.setScale(1.05);
    });

    btnBg.on('pointerout', () => {
      btnBg.setFillStyle(0x3b82f6);
      btnBg.setScale(1.0);
      btnText.setScale(1.0);
    });

    btnBg.on('pointerdown', async () => {
      btnBg.setFillStyle(0x1d4ed8);
      await this.triggerBarisGreeting();
    });
  }

  private async triggerBarisGreeting(): Promise<void> {
    this.showBanner('👋 BARIŞ GELDİ, KAPTAN! TÜM EKİP HAZIRDA! 🚀');

    this.agents.forEach((agent) => {
      this.setAgentState(agent.config.role, 'SALUTING', 'Hoş geldin Kaptan Barış!');

      this.tweens.add({
        targets: agent.container,
        y: agent.config.y - 32,
        duration: 250,
        yoyo: true,
        repeat: 3,
        ease: 'Bounce.easeOut',
      });
    });

    await apiService.triggerSignals();

    this.time.delayedCall(4000, () => {
      this.agents.forEach((agent) => {
        if (agent.currentState === 'SALUTING') {
          this.setAgentState(agent.config.role, 'IDLE', 'İzleme devam ediyor');
        }
      });
    });
  }

  // ==========================================
  // 6. MANUEL TRADE PROPOSAL APPROVAL BANNER (WITH SL / TP)
  // ==========================================
  private createTradeProposalBanner(): void {
    const { GAME_WIDTH } = APP_CONFIG;

    this.proposalContainer = this.add.container(GAME_WIDTH / 2, 70).setDepth(150);
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

    // Onayla Button (Green)
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

    // Reddet / Kapat Button
    const dismissBtn = this.add.rectangle(260, 0, 26, 26, 0xef4444, 1);
    dismissBtn.setStrokeStyle(1, 0xf87171);
    dismissBtn.setInteractive({ useHandCursor: true });
    const dismissText = this.add.text(260, 0, '✕', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#ffffff',
    }).setOrigin(0.5);

    dismissBtn.on('pointerdown', () => {
      this.dismissProposal('İşlem önerisi kullanıcı tarafından reddedildi.');
    });

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

  public showTradeProposal(proposal: any): void {
    console.log('⚡ [OfficeScene] Displaying TRADE_PROPOSAL banner:', proposal);
    const amount = Number(proposal.suggestedAmountUsd || proposal.estimatedAmountUsd || 50);
    const side = (proposal.side || 'BUY').toUpperCase() as 'BUY' | 'SELL';
    const symbol = proposal.symbol || 'BTC/USDT';

    const normalizedProposal: TradeProposalPayload = {
      proposalId: proposal.proposalId || `prop_${Date.now()}`,
      signalId: proposal.signalId || '',
      symbol,
      side,
      suggestedAmountUsd: amount,
      signalScore: proposal.signalScore || 75,
      reasoning: proposal.reasoning || proposal.notes || '',
      sourceCategory: proposal.sourceCategory,
      suggestedStopLoss: proposal.suggestedStopLoss,
      suggestedTakeProfit: proposal.suggestedTakeProfit,
      timestamp: proposal.timestamp || new Date().toISOString(),
    };

    this.currentProposal = normalizedProposal;
    this.proposalText.setText(`⚡ ÖNERİ: ${side} ${symbol} ($${amount})`);

    const slStr = proposal.suggestedStopLoss ? `SL: $${proposal.suggestedStopLoss.toLocaleString()}` : '';
    const tpStr = proposal.suggestedTakeProfit ? `TP: $${proposal.suggestedTakeProfit.toLocaleString()}` : '';
    const catStr = proposal.sourceCategory ? `[${proposal.sourceCategory}]` : '';

    this.proposalSubText.setText(
      [catStr, slStr, tpStr].filter(Boolean).join(' | ') || 'Algoritmik Strateji'
    );

    this.proposalContainer.setVisible(true);
    this.proposalContainer.setAlpha(0);
    this.proposalContainer.setDepth(150);

    this.tweens.add({
      targets: this.proposalContainer,
      alpha: 1,
      duration: 250,
    });

    this.showBanner(`⚡ YENİ İŞLEM ÖNERİSİ: ${side} ${symbol} ($${amount})`, 3500);

    // 30 seconds countdown
    let remaining = 30;
    this.proposalTimerText.setText(`(${remaining}s)`);

    if (this.proposalExpiryTimer) {
      this.proposalExpiryTimer.remove();
    }

    this.proposalExpiryTimer = this.time.addEvent({
      delay: 1000,
      repeat: 30,
      callback: () => {
        remaining--;
        if (remaining > 0) {
          this.proposalTimerText.setText(`(${remaining}s)`);
        } else {
          this.dismissProposal('İşlem önerisinin 30 saniyelik süresi doldu.');
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
      this.showBanner(`✅ Emir Testnet'e İletildi: ${proposal.side} ${proposal.symbol} ($${amount})`);
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

    this.tweens.add({
      targets: this.proposalContainer,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.proposalContainer.setVisible(false);
        if (reason) {
          this.updateTicker(reason);
        }
      },
    });
  }

  // ==========================================
  // 7. NOTIFICATION BANNER & TICKER
  // ==========================================
  private createNotificationBanner(): void {
    const { GAME_WIDTH } = APP_CONFIG;

    this.bannerContainer = this.add.container(GAME_WIDTH / 2, 110).setDepth(30);
    const bg = this.add.rectangle(0, 0, 540, 28, 0x1e293b, 0.95);
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
    this.bannerContainer.setAlpha(0);

    this.tweens.add({
      targets: this.bannerContainer,
      alpha: 1,
      duration: 200,
    });

    this.time.delayedCall(durationMs, () => {
      this.tweens.add({
        targets: this.bannerContainer,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          this.bannerContainer.setVisible(false);
        },
      });
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

    this.tickerText = this.add.text(120, GAME_HEIGHT - 16, 'Sistem başlatıldı. Event akışı bekleniyor...', {
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
  // 8. WEBSOCKET EVENT HANDLERS
  // ==========================================
  private initWebSocketListeners(): void {
    wsService.onStatusChange((status) => {
      if (this.statusBadgeText && this.statusDot) {
        if (status === 'CONNECTED') {
          this.statusBadgeText.setText('ONLINE');
          this.statusBadgeText.setColor('#10b981');
          this.statusDot.setFillStyle(0x10b981);
        } else if (status === 'CONNECTING') {
          this.statusBadgeText.setText('CONNECTING...');
          this.statusBadgeText.setColor('#facc15');
          this.statusDot.setFillStyle(0xfacc15);
        } else {
          this.statusBadgeText.setText('OFFLINE');
          this.statusBadgeText.setColor('#ef4444');
          this.statusDot.setFillStyle(0xef4444);
        }
      }
    });

    wsService.on<AgentActionPayload>('AGENT_ACTION', (payload) => {
      const stateMap: Record<string, AgentState> = {
        STARTED: 'ANALYZING',
        COMPLETED: 'IDLE',
        FAILED: 'ALERTING',
        WAITING: 'IDLE',
      };

      const newState = stateMap[payload.status] || 'IDLE';
      this.setAgentState(payload.agentRole, newState, payload.details);
    });

    wsService.on<SceneSeverityPayload>('SCENE_SEVERITY_UPDATE', (payload) => {
      this.updateSceneSeverity(payload.severityLabel);
      this.updateTicker(`[${payload.severityLabel}] ${payload.primaryReason}`);
    });

    wsService.on<RiskConfidencePayload>('RISK_CONFIDENCE_UPDATE', (payload) => {
      const riskAgent = this.agents.get('Risk Analisti');
      if (riskAgent && riskAgent.confidenceText) {
        const percent = Math.round(payload.confidenceScore * 100);
        riskAgent.confidenceText.setText(`%${percent}`);

        if (percent >= 80) riskAgent.confidenceText.setColor('#10b981');
        else if (percent >= 60) riskAgent.confidenceText.setColor('#facc15');
        else riskAgent.confidenceText.setColor('#ef4444');
      }
      this.updateTicker(`🛡️ Risk Analisti Güven Güncellemesi: %${Math.round(payload.confidenceScore * 100)}`);
    });

    wsService.on<SpendingLimitWarningPayload>('SPENDING_LIMIT_WARNING', (payload) => {
      const traderAgent = this.agents.get('Binance İşlemci');
      if (traderAgent) {
        traderAgent.warningBadge.setVisible(true);
        this.showBanner(`🛑 LİMİT UYARISI: ${payload.symbol} $${payload.attemptedSizeUsd} engellendi!`);

        this.time.delayedCall(3500, () => {
          traderAgent.warningBadge.setVisible(false);
        });
      }
    });

    wsService.on<PortfolioUpdatePayload>('PORTFOLIO_UPDATE', (payload) => {
      if (this.balanceText) {
        this.balanceText.setText(`💰 BAKIYE: $${payload.totalBalanceUsd.toLocaleString()}`);
      }
      if (this.positionsText) {
        this.positionsText.setText(`📈 POZİSYON: ${payload.positions.length}`);
      }
    });

    wsService.on<NewNewsPayload>('NEW_NEWS', (payload) => {
      this.setAgentState('Haber Takip', 'ALERTING', payload.title);
      this.updateTicker(`📰 [${payload.category}] ${payload.title}`);

      this.time.delayedCall(5000, () => {
        const newsAgent = this.agents.get('Haber Takip');
        if (newsAgent && newsAgent.currentState === 'ALERTING') {
          this.setAgentState('Haber Takip', 'IDLE', 'Tarama sürüyor');
        }
      });
    });

    // 8. SIGNAL_GENERATED -> "ALİ" (Sinyal Avcısı) Konuşma Balonu Kuyruğu
    wsService.on<SignalGeneratedPayload>('SIGNAL_GENERATED', (payload) => {
      if (payload.action !== 'HOLD') {
        this.setAgentState('Sinyal Avcısı', 'TRADING', `${payload.action} ${payload.symbol} (Skor: ${payload.signalScore})`);
        this.updateTicker(`⚡ Sinyal: ${payload.action} ${payload.symbol} | Skor: ${payload.signalScore}/100`);

        // Format speech dialogue via template function
        const dialogue = formatSignalDialogue({
          symbol: payload.symbol,
          action: payload.action,
          signalScore: payload.signalScore,
          category: payload.sourceCategory,
          reasoning: payload.reasoning,
        });

        if (dialogue) {
          this.queueAliDialogue(dialogue);
        }

        this.time.delayedCall(6000, () => {
          const sigAgent = this.agents.get('Sinyal Avcısı');
          if (sigAgent && sigAgent.currentState === 'TRADING' && !this.isAliSpeaking) {
            this.setAgentState('Sinyal Avcısı', 'IDLE', 'Fırsatlar izleniyor');
          }
        });
      }
    });

    // 9. TRADE_PROPOSAL -> Manuel İşlem Onayı Banner'ı
    wsService.on<any>('TRADE_PROPOSAL', (payload) => {
      console.log('🔔 [OfficeScene] Received TRADE_PROPOSAL from WebSocket:', payload);
      this.showTradeProposal(payload);
    });

    wsService.on<SystemStatusPayload>('SYSTEM_STATUS', (payload) => {
      if (payload.currentSceneSeverity) {
        this.updateSceneSeverity(payload.currentSceneSeverity.label as SceneSeverity);
      }
      if (payload.portfolioSummary && this.balanceText) {
        this.balanceText.setText(`💰 BAKIYE: $${payload.portfolioSummary.totalUsd.toLocaleString()}`);
        this.positionsText.setText(`📈 POZİSYON: ${payload.portfolioSummary.openPositionsCount}`);
      }
    });
  }

  // ==========================================
  // 9. "ALİ" (SİNYAL AVCISI) KONUŞMA KUYRUĞU
  // ==========================================
  private queueAliDialogue(dialogue: string): void {
    this.aliDialogueQueue.push(dialogue);
    if (!this.isAliSpeaking) {
      this.processAliDialogueQueue();
    }
  }

  private processAliDialogueQueue(): void {
    if (this.aliDialogueQueue.length === 0) {
      this.isAliSpeaking = false;
      return;
    }

    this.isAliSpeaking = true;
    const nextDialogue = this.aliDialogueQueue.shift()!;
    const sigAgent = this.agents.get('Sinyal Avcısı');
    if (!sigAgent) {
      this.isAliSpeaking = false;
      return;
    }

    // Show speech bubble
    sigAgent.bubbleText.setText(nextDialogue);
    sigAgent.bubbleContainer.setVisible(true);
    sigAgent.bubbleContainer.setAlpha(0);

    this.tweens.add({
      targets: sigAgent.bubbleContainer,
      alpha: 1,
      y: -68,
      duration: 250,
      ease: 'Back.easeOut',
    });

    // Retain for 4.5 seconds
    this.time.delayedCall(4500, () => {
      this.tweens.add({
        targets: sigAgent.bubbleContainer,
        alpha: 0,
        y: -64,
        duration: 300,
        onComplete: () => {
          sigAgent.bubbleContainer.setVisible(false);
          // Wait 500ms before showing next queued speech
          this.time.delayedCall(500, () => {
            this.processAliDialogueQueue();
          });
        },
      });
    });
  }

  // ==========================================
  // 10. AGENT STATE VISUAL TRANSITIONS
  // ==========================================
  public setAgentState(role: AgentRole, state: AgentState, taskDescription?: string): void {
    const agent = this.agents.get(role);
    if (!agent) return;

    agent.currentState = state;
    if (taskDescription) {
      agent.currentTask = taskDescription;
    }

    // Update facial mouth expression dynamically
    this.drawMouth(agent.mouthGraphics, state);

    agent.alertIcon.setVisible(false);
    agent.tradeIcon.setVisible(false);
    if (role !== 'Sinyal Avcısı' || !this.isAliSpeaking) {
      agent.bubbleContainer.setVisible(false);
    }

    // Stop previous typing tween if any
    if (agent.typingTween) {
      agent.typingTween.stop();
      agent.typingTween = undefined;
      agent.leftHand.setY(14);
      agent.rightHand.setY(14);
      agent.rightArm.setY(7);
    }

    switch (state) {
      case 'IDLE':
        agent.stateText.setText('● IDLE');
        agent.stateText.setColor('#10b981');
        break;

      case 'ANALYZING':
        agent.stateText.setText('⚙ ANALYZING');
        agent.stateText.setColor('#38bdf8');
        if (role !== 'Sinyal Avcısı' || !this.isAliSpeaking) {
          this.showAgentBubble(agent, taskDescription || 'Analiz ediliyor...');
        }
        // Typing hands motion on desk
        agent.typingTween = this.tweens.add({
          targets: [agent.leftHand, agent.rightHand],
          y: '-=2',
          duration: 160,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;

      case 'ALERTING':
        agent.stateText.setText('! ALERT');
        agent.stateText.setColor('#ef4444');
        agent.alertIcon.setVisible(true);
        if (role !== 'Sinyal Avcısı' || !this.isAliSpeaking) {
          this.showAgentBubble(agent, taskDescription || 'Uyarı!');
        }
        break;

      case 'TRADING':
        agent.stateText.setText('⚡ TRADING');
        agent.stateText.setColor('#f59e0b');
        agent.tradeIcon.setVisible(true);
        if (role !== 'Sinyal Avcısı' || !this.isAliSpeaking) {
          this.showAgentBubble(agent, taskDescription || 'İşlem yürütülüyor');
        }
        // Rapid typing hands motion
        agent.typingTween = this.tweens.add({
          targets: [agent.leftHand, agent.rightHand],
          y: '-=3',
          duration: 120,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;

      case 'SALUTING':
        agent.stateText.setText('👋 SELAM');
        agent.stateText.setColor('#ec4899');
        this.showAgentBubble(agent, taskDescription || 'Selamlar!');
        // Right hand salute position
        agent.rightHand.setY(6);
        agent.rightArm.setY(3);
        break;
    }
  }

  private showAgentBubble(agent: AgentEntity, text: string): void {
    agent.bubbleText.setText(text.slice(0, 48));
    agent.bubbleContainer.setVisible(true);

    this.time.delayedCall(4000, () => {
      if (agent.currentState !== 'ANALYZING' && (!this.isAliSpeaking || agent.config.role !== 'Sinyal Avcısı')) {
        agent.bubbleContainer.setVisible(false);
      }
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

  private showAgentDetails(role: AgentRole): void {
    const agent = this.agents.get(role);
    if (!agent) return;

    this.showBanner(`${agent.config.avatarIcon} ${role}: [${agent.currentState}] ${agent.currentTask}`);
  }

  private async fetchInitialState(): Promise<void> {
    const state = await apiService.fetchSystemState();
    if (state) {
      if (state.currentSceneSeverity) {
        this.updateSceneSeverity(state.currentSceneSeverity.label as SceneSeverity);
      }
      if (state.portfolioSummary && this.balanceText) {
        this.balanceText.setText(`💰 BAKIYE: $${state.portfolioSummary.totalUsd.toLocaleString()}`);
        this.positionsText.setText(`📈 POZİSYON: ${state.portfolioSummary.openPositionsCount}`);
      }
    }
  }
}
