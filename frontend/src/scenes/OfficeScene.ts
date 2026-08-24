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
} from '../types/events.ts';
import { wsService } from '../services/websocket.ts';
import { apiService } from '../services/api.ts';
import { formatSignalDialogue } from '../utils/signalDialogue.ts';

interface TradeProposalPayload {
  proposalId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  suggestedAmountUsd: number;
  signalScore: number;
  reasoning: string;
  timestamp: string;
}

interface AgentEntity {
  config: AgentVisualConfig;
  container: Phaser.GameObjects.Container;
  bodySprite: Phaser.GameObjects.Rectangle;
  headSprite: Phaser.GameObjects.Rectangle;
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
  // 2. AGENTS & DESKS SETUP
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

      // Agent Body (Pixel shape)
      const body = this.add.rectangle(0, 8, 20, 16, config.shirtColor);
      body.setStrokeStyle(1, 0x0f172a);

      // Agent Head
      const head = this.add.rectangle(0, -6, 16, 14, 0xfde047);
      head.setStrokeStyle(1, 0x0f172a);

      // Agent Hair
      const hair = this.add.rectangle(0, -12, 18, 6, config.hairColor);

      // Agent Emoji Badge
      const emojiBadge = this.add.text(0, -26, config.avatarIcon, {
        fontSize: '16px',
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
      const bubbleContainer = this.add.container(0, -64);
      const bubbleBg = this.add.graphics();
      this.drawBubble(bubbleBg, 150, 36);
      const bubbleText = this.add.text(0, -4, 'Hazırda bekliyor', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#0f172a',
        align: 'center',
        wordWrap: { width: 140 },
      }).setOrigin(0.5);
      bubbleContainer.add([bubbleBg, bubbleText]);
      bubbleContainer.setVisible(false);

      // Alert Icon (!)
      const alertIcon = this.add.image(0, -42, 'alert_bubble');
      alertIcon.setVisible(false);
      this.tweens.add({
        targets: alertIcon,
        y: -48,
        duration: 500,
        yoyo: true,
        repeat: -1,
      });

      // Trade Badge
      const tradeIcon = this.add.image(16, -42, 'trading_badge');
      tradeIcon.setVisible(false);

      // Spending Limit Warning Badge (🛑)
      const warningBadge = this.add.container(0, -46);
      const stopImg = this.add.image(0, 0, 'warning_stop');
      const stopText = this.add.text(0, -18, 'LİMİT AŞIMI!', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#ef4444',
      }).setOrigin(0.5);
      warningBadge.add([stopImg, stopText]);
      warningBadge.setVisible(false);

      agentContainer.add([body, head, hair, emojiBadge, roleTagBg, roleText, stateText, alertIcon, tradeIcon, warningBadge, bubbleContainer]);

      // Idle Breathing Animation (1-2px smooth vertical sine wave)
      this.tweens.add({
        targets: [head, hair, emojiBadge],
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
  // 6. MANUEL TRADE PROPOSAL APPROVAL BANNER
  // ==========================================
  private createTradeProposalBanner(): void {
    const { GAME_WIDTH } = APP_CONFIG;

    this.proposalContainer = this.add.container(GAME_WIDTH / 2, 70).setDepth(35);
    const bg = this.add.rectangle(0, 0, 580, 36, 0x0f172a, 0.98);
    bg.setStrokeStyle(2, 0xf59e0b);

    this.proposalText = this.add.text(-120, 0, '', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#fbbf24',
    }).setOrigin(0.5);

    this.proposalTimerText = this.add.text(80, 0, '(30s)', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    // Onayla Button (Green)
    const approveBtn = this.add.rectangle(170, 0, 90, 22, 0x10b981, 1);
    approveBtn.setStrokeStyle(1, 0x34d399);
    approveBtn.setInteractive({ useHandCursor: true });
    const approveText = this.add.text(170, 0, 'ONAYLA ✅', {
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
    const dismissBtn = this.add.rectangle(240, 0, 24, 22, 0xef4444, 1);
    dismissBtn.setStrokeStyle(1, 0xf87171);
    dismissBtn.setInteractive({ useHandCursor: true });
    const dismissText = this.add.text(240, 0, '✕', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#ffffff',
    }).setOrigin(0.5);

    dismissBtn.on('pointerdown', () => {
      this.dismissProposal('İşlem önerisi kullanıcı tarafından reddedildi.');
    });

    this.proposalContainer.add([bg, this.proposalText, this.proposalTimerText, approveBtn, approveText, dismissBtn, dismissText]);
    this.proposalContainer.setVisible(false);
  }

  public showTradeProposal(proposal: TradeProposalPayload): void {
    this.currentProposal = proposal;
    this.proposalText.setText(`⚡ ÖNERİ: ${proposal.side} ${proposal.symbol} ($${proposal.suggestedAmountUsd})`);
    this.proposalContainer.setVisible(true);
    this.proposalContainer.setAlpha(0);

    this.tweens.add({
      targets: this.proposalContainer,
      alpha: 1,
      duration: 250,
    });

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
    const result = await apiService.placeOrder(
      proposal.symbol,
      proposal.side,
      proposal.suggestedAmountUsd,
      'MARKET'
    );

    if (result.success) {
      this.showBanner(`✅ Emir Testnet'e İletildi: ${proposal.side} ${proposal.symbol} ($${proposal.suggestedAmountUsd})`);
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
    wsService.on<TradeProposalPayload>('TRADE_PROPOSAL', (payload) => {
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

    agent.alertIcon.setVisible(false);
    agent.tradeIcon.setVisible(false);
    if (role !== 'Sinyal Avcısı' || !this.isAliSpeaking) {
      agent.bubbleContainer.setVisible(false);
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
        break;

      case 'SALUTING':
        agent.stateText.setText('👋 SELAM');
        agent.stateText.setColor('#ec4899');
        this.showAgentBubble(agent, taskDescription || 'Selamlar!');
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
