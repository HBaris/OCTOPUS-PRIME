import Phaser from 'phaser';
import { APP_CONFIG, AGENT_CONFIGS, AgentVisualConfig, SEVERITY_COLORS } from '../config.ts';
import { AgentRole, AgentState, SceneSeverity, TradeProposalPayload, BriefingResponsePayload } from '../types/events.ts';
import { gameState } from '../services/gameState.ts';
import { apiService } from '../services/api.ts';

interface DoorEntity {
  config: AgentVisualConfig;
  container: Phaser.GameObjects.Container;
  doorSprite: Phaser.GameObjects.Image;
  stateText: Phaser.GameObjects.Text;
  titleText: Phaser.GameObjects.Text;
  glowGraphics: Phaser.GameObjects.Graphics;
}

export class LobbyScene extends Phaser.Scene {
  private doors: Map<AgentRole, DoorEntity> = new Map();
  private severityOverlay!: Phaser.GameObjects.Rectangle;
  private severityTween: Phaser.Tweens.Tween | null = null;

  // HUD Elements
  private statusBadgeText!: Phaser.GameObjects.Text;
  private statusDot!: Phaser.GameObjects.Arc;
  private balanceText!: Phaser.GameObjects.Text;
  private positionsText!: Phaser.GameObjects.Text;
  private severityText!: Phaser.GameObjects.Text;
  private tickerText!: Phaser.GameObjects.Text;

  // Proposal Banner
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

  constructor() {
    super({ key: 'LobbyScene' });
  }

  create(): void {
    this.cameras.main.fadeIn(300, 11, 15, 25);

    this.createLobbyEnvironment();
    this.createAtmosphereOverlay();
    this.createDoors();
    this.createHUD();
    this.createActionButton();
    this.createTradeProposalBanner();
    this.createEventTicker();

    this.bindGameStateEvents();
    this.syncInitialState();
  }

  // ==========================================
  // 1. LOBBY ENVIRONMENT
  // ==========================================
  private createLobbyEnvironment(): void {
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
        this.add.image(x + 16, y + 16, 'lobby_floor_tile');
      }
    }

    // Wall Divider Line
    const divider = this.add.graphics();
    divider.lineStyle(4, 0x334155);
    divider.lineBetween(0, 140, GAME_WIDTH, 140);

    // Wall Clock
    const clockBg = this.add.circle(GAME_WIDTH / 2, 60, 18, 0x1e293b);
    clockBg.setStrokeStyle(2, 0x94a3b8);
    const clockText = this.add.text(GAME_WIDTH / 2, 60, '15m', {
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

    // Lobby Signboard
    const signBg = this.add.rectangle(GAME_WIDTH / 2, 98, 420, 28, 0x0f172a, 0.95);
    signBg.setStrokeStyle(2, 0x38bdf8);
    this.add.text(GAME_WIDTH / 2, 98, '🏢 MERKEZ AJAN LOBİSİ & KORİDORU 🏢', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#38bdf8',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Decor Plants & Server Racks in Corners
    this.add.image(40, 220, 'server_rack');
    this.add.image(920, 220, 'server_rack');
    this.add.image(40, 520, 'plant_texture');
    this.add.image(920, 520, 'cooler_texture');
  }

  // ==========================================
  // 2. 6 INTERACTIVE DOORS
  // ==========================================
  private createDoors(): void {
    const doorCoordinates = [
      { role: 'Haber Takip', x: 200, y: 220 },
      { role: 'Binance İşlemci', x: 480, y: 220 },
      { role: 'Risk Analisti', x: 760, y: 220 },
      { role: 'Portföy Muhasebecisi', x: 140, y: 430 },
      { role: 'Sinyal Avcısı', x: 370, y: 430 },
      { role: 'Görev Takipçisi', x: 590, y: 430 },
      { role: 'Patron', x: 820, y: 430 },
    ];

    doorCoordinates.forEach(({ role, x, y }) => {
      const config = AGENT_CONFIGS.find((a) => a.role === role)!;
      const doorContainer = this.add.container(x, y);

      // Glow outline graphics
      const glow = this.add.graphics();
      glow.lineStyle(3, config.bodyColor, 0.8);
      glow.strokeRoundedRect(-40, -54, 80, 108, 6);
      glow.setVisible(false);

      // Door Sprite
      const door = this.add.image(0, 0, 'door_texture');
      door.setInteractive({ useHandCursor: true });

      // Room Title Badge above Door
      const titleBg = this.add.rectangle(0, -64, 134, 20, 0x0f172a, 0.95);
      titleBg.setStrokeStyle(1, config.bodyColor);
      const titleText = this.add.text(0, -64, `${config.avatarIcon} ${config.roomTitle}`, {
        fontFamily: 'monospace',
        fontSize: '10.5px',
        color: '#f8fafc',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      // Live State Indicator Pill below Door
      const stateBg = this.add.rectangle(0, 58, 106, 18, 0x0f172a, 0.9);
      stateBg.setStrokeStyle(1, 0x334155);
      const stateText = this.add.text(0, 58, '● IDLE', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#10b981',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      // Enter Room Button / Hint
      const enterHint = this.add.text(0, 78, 'Tıkla ve Gir ➜', {
        fontFamily: 'monospace',
        fontSize: '9.5px',
        color: '#94a3b8',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      doorContainer.add([glow, door, titleBg, titleText, stateBg, stateText, enterHint]);

      // Hover Effects
      door.on('pointerover', () => {
        glow.setVisible(true);
        doorContainer.setScale(1.04);
        enterHint.setColor('#38bdf8');
      });

      door.on('pointerout', () => {
        glow.setVisible(false);
        doorContainer.setScale(1.0);
        enterHint.setColor('#94a3b8');
      });

      door.on('pointerdown', () => {
        this.transitionToRoom(config.sceneKey);
      });

      this.doors.set(role as AgentRole, {
        config,
        container: doorContainer,
        doorSprite: door,
        stateText,
        titleText,
        glowGraphics: glow,
      });
    });
  }

  private transitionToRoom(sceneKey: string): void {
    this.cameras.main.fadeOut(250, 11, 15, 25);
    this.time.delayedCall(250, () => {
      this.scene.start(sceneKey);
    });
  }

  public updateDoorState(role: AgentRole, state: AgentState): void {
    const door = this.doors.get(role);
    if (!door) return;

    switch (state) {
      case 'IDLE':
        door.stateText.setText('● IDLE').setColor('#10b981');
        break;
      case 'ANALYZING':
        door.stateText.setText('⚙ ANALYZING').setColor('#38bdf8');
        break;
      case 'ALERTING':
        door.stateText.setText('! ALERT').setColor('#ef4444');
        break;
      case 'TRADING':
        door.stateText.setText('⚡ TRADING').setColor('#f59e0b');
        break;
      case 'SALUTING':
        door.stateText.setText('👋 SELAM').setColor('#ec4899');
        this.time.delayedCall(2500, () => {
          if (door.stateText.text.includes('SELAM')) {
            door.stateText.setText('● IDLE').setColor('#10b981');
          }
        });
        break;
    }
  }

  // ==========================================
  // 3. HUD, ATMOSPHERE & EVENT TICKER
  // ==========================================
  private createHUD(): void {
    const { GAME_WIDTH } = APP_CONFIG;

    const hudBar = this.add.rectangle(GAME_WIDTH / 2, 22, GAME_WIDTH - 24, 38, 0x0f172a, 0.95);
    hudBar.setStrokeStyle(2, 0x1e293b);
    hudBar.setDepth(20);

    this.statusDot = this.add.circle(30, 22, 6, 0x10b981).setDepth(21);
    this.statusBadgeText = this.add.text(42, 22, gameState.wsStatus, {
      fontFamily: 'monospace',
      fontSize: '11.5px',
      color: '#10b981',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(21);

    this.balanceText = this.add.text(125, 22, `💰 $${gameState.totalBalanceUsd.toLocaleString()}`, {
      fontFamily: 'monospace',
      fontSize: '12.5px',
      color: '#facc15',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(21);

    this.positionsText = this.add.text(265, 22, `📈 POZ: ${gameState.openPositionsCount}`, {
      fontFamily: 'monospace',
      fontSize: '12.5px',
      color: '#38bdf8',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(21);

    // Personal Assistant Executive Briefing Trigger in HUD
    const briefingBtn = this.add.rectangle(645, 22, 160, 26, 0x064e3b, 1).setDepth(21);
    briefingBtn.setStrokeStyle(1.5, 0x34d399);
    briefingBtn.setInteractive({ useHandCursor: true });
    const briefingTxt = this.add.text(645, 22, '📋 BANA BRİFİNG VER', {
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

  private createActionButton(): void {
    const btnX = 445;
    const btnY = 22;

    const btnBg = this.add.rectangle(btnX, btnY, 165, 28, 0x2563eb, 1);
    btnBg.setStrokeStyle(2, 0x60a5fa);
    btnBg.setDepth(22);

    this.add.text(btnX, btnY, 'LA KALKIN  LA ⚡', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(23);

    btnBg.setInteractive({ useHandCursor: true });
    btnBg.on('pointerover', () => btnBg.setFillStyle(0x1d4ed8));
    btnBg.on('pointerout', () => btnBg.setFillStyle(0x2563eb));
    btnBg.on('pointerdown', async () => {
      btnBg.setFillStyle(0x1e40af);
      gameState.setTicker('⚡ LA KALKIN LA! TÜM EKİP TEYAKKUZDA! 🚀');
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

    this.proposalContainer = this.add.container(GAME_WIDTH / 2, 70).setDepth(150);
    const bg = this.add.rectangle(0, 0, 720, 50, 0x0f172a, 0.98);
    bg.setStrokeStyle(2, 0xf59e0b);

    this.proposalText = this.add.text(-130, -9, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#fbbf24',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.proposalSubText = this.add.text(-130, 11, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#cbd5e1',
    }).setOrigin(0.5);

    this.proposalTimerText = this.add.text(105, 0, '(30s)', {
      fontFamily: 'monospace',
      fontSize: '11.5px',
      color: '#94a3b8',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const approveBtn = this.add.rectangle(205, 0, 110, 32, 0x10b981, 1);
    approveBtn.setStrokeStyle(1.5, 0x34d399);
    approveBtn.setInteractive({ useHandCursor: true });
    const approveText = this.add.text(205, 0, 'ONAYLA ✅', {
      fontFamily: 'monospace',
      fontSize: '11.5px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    approveBtn.on('pointerdown', async () => {
      if (this.currentProposal) {
        approveBtn.setFillStyle(0x059669);
        await this.executeManualProposal(this.currentProposal);
      }
    });

    const dismissBtn = this.add.rectangle(285, 0, 32, 32, 0xef4444, 1);
    dismissBtn.setStrokeStyle(1.5, 0xf87171);
    dismissBtn.setInteractive({ useHandCursor: true });
    const dismissText = this.add.text(285, 0, '✕', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    dismissBtn.on('pointerdown', () => this.dismissProposal());

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
    this.proposalText.setText(`🎩 PATRON ÖNERİSİ: ${side} ${symbol} ($${amount})`);

    const slStr = proposal.suggestedStopLoss ? `SL: $${proposal.suggestedStopLoss.toLocaleString()}` : '';
    const tpStr = proposal.suggestedTakeProfit ? `TP: $${proposal.suggestedTakeProfit.toLocaleString()}` : '';
    const catStr = proposal.sourceCategory ? `[${proposal.sourceCategory}]` : '';

    this.proposalSubText.setText(
      [catStr, slStr, tpStr].filter(Boolean).join(' | ') || 'Baş Analist Nihai Onayında'
    );

    this.proposalContainer.setVisible(true);

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
          this.dismissProposal();
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
      gameState.setTicker(`✅ Emir Testnet'e İletildi: ${proposal.side} ${proposal.symbol}`);
    } else {
      gameState.setTicker(`❌ Emir İletilemedi: ${result.message}`);
    }
    this.dismissProposal();
  }

  private dismissProposal(): void {
    if (this.proposalExpiryTimer) {
      this.proposalExpiryTimer.remove();
      this.proposalExpiryTimer = null;
    }
    this.currentProposal = null;
    this.proposalContainer.setVisible(false);
  }

  private createEventTicker(): void {
    const { GAME_WIDTH, GAME_HEIGHT } = APP_CONFIG;

    const tickerBar = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 16, GAME_WIDTH - 24, 26, 0x0f172a, 0.95);
    tickerBar.setStrokeStyle(1, 0x334155);
    tickerBar.setDepth(20);

    const tickerLabel = this.add.text(24, GAME_HEIGHT - 16, '📡 CANLI AKIŞ ↗', {
      fontFamily: 'monospace',
      fontSize: '10px',
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
    modalBg.setInteractive();

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
      gameState.onAgentStateChange(({ role, state }) => {
        this.updateDoorState(role, state);
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
      gameState.onTickerChange((msg) => {
        if (this.tickerText) this.tickerText.setText(msg.slice(0, 110));
      })
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
    gameState.agents.forEach((a) => {
      this.updateDoorState(a.role, a.state);
    });
    this.updateAtmosphere(gameState.severity);
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
