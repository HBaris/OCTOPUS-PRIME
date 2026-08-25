import Phaser from 'phaser';
import { APP_CONFIG, AGENT_CONFIGS, AgentVisualConfig, SEVERITY_COLORS } from '../config.ts';
import { AgentRole, AgentState, SceneSeverity, TradeProposalPayload } from '../types/events.ts';
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
    this.createBarisButton();
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
    const signBg = this.add.rectangle(GAME_WIDTH / 2, 98, 380, 26, 0x0f172a, 0.95);
    signBg.setStrokeStyle(2, 0x38bdf8);
    this.add.text(GAME_WIDTH / 2, 98, '🏢 MERKEZ AJAN LOBİSİ & KORİDORU 🏢', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#38bdf8',
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
      { role: 'Haber Takip', x: 200, y: 230 },
      { role: 'Binance İşlemci', x: 480, y: 230 },
      { role: 'Risk Analisti', x: 760, y: 230 },
      { role: 'Portföy Muhasebecisi', x: 200, y: 440 },
      { role: 'Sinyal Avcısı', x: 480, y: 440 },
      { role: 'Patron', x: 760, y: 440 },
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
      const titleBg = this.add.rectangle(0, -64, 126, 18, 0x0f172a, 0.95);
      titleBg.setStrokeStyle(1, config.bodyColor);
      const titleText = this.add.text(0, -64, `${config.avatarIcon} ${config.roomTitle}`, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#f8fafc',
      }).setOrigin(0.5);

      // Live State Indicator Pill below Door
      const stateBg = this.add.rectangle(0, 58, 100, 16, 0x0f172a, 0.9);
      stateBg.setStrokeStyle(1, 0x334155);
      const stateText = this.add.text(0, 58, '● IDLE', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#10b981',
      }).setOrigin(0.5);

      // Enter Room Button / Hint
      const enterHint = this.add.text(0, 76, 'Tıkla ve Gir ➜', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#94a3b8',
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
        break;
    }
  }

  // ==========================================
  // 3. HUD, ATMOSPHERE & EVENT TICKER
  // ==========================================
  private createHUD(): void {
    const { GAME_WIDTH } = APP_CONFIG;

    const hudBar = this.add.rectangle(GAME_WIDTH / 2, 22, GAME_WIDTH - 24, 34, 0x0f172a, 0.95);
    hudBar.setStrokeStyle(2, 0x1e293b);
    hudBar.setDepth(20);

    this.statusDot = this.add.circle(32, 22, 5, 0x10b981).setDepth(21);
    this.statusBadgeText = this.add.text(44, 22, gameState.wsStatus, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#10b981',
    }).setOrigin(0, 0.5).setDepth(21);

    this.balanceText = this.add.text(180, 22, `💰 BAKIYE: $${gameState.totalBalanceUsd.toLocaleString()}`, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#facc15',
    }).setOrigin(0, 0.5).setDepth(21);

    this.positionsText = this.add.text(380, 22, `📈 POZİSYON: ${gameState.openPositionsCount}`, {
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

  private createBarisButton(): void {
    const { GAME_WIDTH } = APP_CONFIG;
    const btnX = GAME_WIDTH / 2;
    const btnY = 22;

    const btnBg = this.add.rectangle(btnX, btnY, 140, 24, 0x3b82f6, 1);
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
      gameState.setTicker('👋 BARIŞ GELDİ, KAPTAN! TÜM ODALAR TEYAKKUZDA! 🚀');
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
        if (this.positionsText) this.positionsText.setText(`📈 POZİSYON: ${count}`);
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
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
    if (this.proposalExpiryTimer) {
      this.proposalExpiryTimer.remove();
      this.proposalExpiryTimer = null;
    }
  }
}
