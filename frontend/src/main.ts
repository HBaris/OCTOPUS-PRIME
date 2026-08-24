import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.ts';
import { OfficeScene } from './scenes/OfficeScene.ts';
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
  scene: [BootScene, OfficeScene],
};

// Initialize Phaser Game instance
new Phaser.Game(gameConfig);

console.log('👾 Crypto Trading Agent Pixel Art Office Simulation & Positions Chart initialized.');
