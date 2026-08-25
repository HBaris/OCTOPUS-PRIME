import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.ts';
import { LobbyScene } from './scenes/LobbyScene.ts';
import { NewsRoomScene } from './scenes/NewsRoomScene.ts';
import { TraderRoomScene } from './scenes/TraderRoomScene.ts';
import { RiskRoomScene } from './scenes/RiskRoomScene.ts';
import { PortfolioRoomScene } from './scenes/PortfolioRoomScene.ts';
import { SignalsRoomScene } from './scenes/SignalsRoomScene.ts';
import { PatronRoomScene } from './scenes/PatronRoomScene.ts';
import { APP_CONFIG } from './config.ts';
import './services/positionsChartManager.ts';

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: APP_CONFIG.GAME_WIDTH,
  height: APP_CONFIG.GAME_HEIGHT,
  pixelArt: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    // Fixed pixel-perfect canvas rendering: prevents scroll-triggered infinite resize loops
    mode: Phaser.Scale.NONE,
  },
  backgroundColor: '#0b0f19',
  scene: [
    BootScene,
    LobbyScene,
    NewsRoomScene,
    TraderRoomScene,
    RiskRoomScene,
    PortfolioRoomScene,
    SignalsRoomScene,
    PatronRoomScene,
  ],
};

// Initialize Phaser Game instance
new Phaser.Game(gameConfig);

console.log('👾 Crypto Trading Agent Pixel Art Office Simulation (Lobby + 6 Rooms) initialized.');
