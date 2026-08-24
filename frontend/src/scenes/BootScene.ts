import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    this.createProceduralTextures();
    this.scene.start('OfficeScene');
  }

  private createProceduralTextures(): void {
    // 1. Floor Tile (32x32 retro checkered office carpet/tile)
    const floorCanvas = this.textures.createCanvas('floor_tile', 32, 32);
    if (floorCanvas) {
      const ctx = floorCanvas.getContext();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillRect(16, 16, 16, 16);
      // Subtle grid border
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, 32, 32);
      floorCanvas.refresh();
    }

    // 2. Wall Tile (32x32 retro brick / panel wall)
    const wallCanvas = this.textures.createCanvas('wall_tile', 32, 32);
    if (wallCanvas) {
      const ctx = wallCanvas.getContext();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(2, 2, 28, 28);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, 28, 28);
      wallCanvas.refresh();
    }

    // 3. Desk (96x48 wooden / metallic workstation)
    const deskCanvas = this.textures.createCanvas('desk_texture', 96, 48);
    if (deskCanvas) {
      const ctx = deskCanvas.getContext();
      // Desk Top
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, 96, 36);
      ctx.fillStyle = '#475569';
      ctx.fillRect(4, 4, 88, 28);
      // Desk Front Border
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 36, 96, 12);
      // Keyboard Mat
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(28, 14, 40, 14);
      deskCanvas.refresh();
    }

    // 4. Computer Monitor (36x32)
    const monitorCanvas = this.textures.createCanvas('monitor_texture', 36, 32);
    if (monitorCanvas) {
      const ctx = monitorCanvas.getContext();
      // Monitor Bezel
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(2, 0, 32, 24);
      // Screen
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(4, 2, 28, 20);
      // Terminal scanlines
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(6, 6, 12, 2);
      ctx.fillRect(6, 10, 20, 2);
      ctx.fillRect(6, 14, 16, 2);
      // Stand
      ctx.fillStyle = '#475569';
      ctx.fillRect(14, 24, 8, 5);
      ctx.fillRect(10, 29, 16, 3);
      monitorCanvas.refresh();
    }

    // 5. Office Chair (32x32)
    const chairCanvas = this.textures.createCanvas('chair_texture', 32, 32);
    if (chairCanvas) {
      const ctx = chairCanvas.getContext();
      // Backrest
      ctx.fillStyle = '#475569';
      ctx.fillRect(6, 4, 20, 14);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(8, 6, 16, 10);
      // Seat
      ctx.fillStyle = '#334155';
      ctx.fillRect(4, 18, 24, 10);
      chairCanvas.refresh();
    }

    // 6. Server Rack (40x80)
    const serverCanvas = this.textures.createCanvas('server_rack', 40, 80);
    if (serverCanvas) {
      const ctx = serverCanvas.getContext();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 40, 80);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(1, 1, 38, 78);
      // Server slots
      for (let y = 6; y < 74; y += 12) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(4, y, 32, 8);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(6, y + 3, 3, 3);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(12, y + 3, 3, 3);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(18, y + 3, 3, 3);
      }
      serverCanvas.refresh();
    }

    // 7. Plant Pot (24x32)
    const plantCanvas = this.textures.createCanvas('plant_texture', 24, 32);
    if (plantCanvas) {
      const ctx = plantCanvas.getContext();
      // Pot
      ctx.fillStyle = '#b45309';
      ctx.fillRect(4, 16, 16, 16);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(2, 14, 20, 4);
      // Foliage
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(12, 10, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(10, 8, 5, 0, Math.PI * 2);
      ctx.fill();
      plantCanvas.refresh();
    }

    // 8. Water Cooler (24x48)
    const coolerCanvas = this.textures.createCanvas('cooler_texture', 24, 48);
    if (coolerCanvas) {
      const ctx = coolerCanvas.getContext();
      // Bottle
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(12, 12, 10, 0, Math.PI * 2);
      ctx.fill();
      // Base
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(2, 20, 20, 28);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(6, 28, 4, 4);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(14, 28, 4, 4);
      coolerCanvas.refresh();
    }

    // 9. Alert Bubble (32x32)
    const alertCanvas = this.textures.createCanvas('alert_bubble', 32, 32);
    if (alertCanvas) {
      const ctx = alertCanvas.getContext();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(16, 14, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 16, 14);
      alertCanvas.refresh();
    }

    // 10. Trading Indicator Icon (28x28)
    const tradeCanvas = this.textures.createCanvas('trading_badge', 28, 28);
    if (tradeCanvas) {
      const ctx = tradeCanvas.getContext();
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(14, 14, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', 14, 14);
      tradeCanvas.refresh();
    }

    // 11. Warning Badge 🛑 (32x32)
    const stopCanvas = this.textures.createCanvas('warning_stop', 32, 32);
    if (stopCanvas) {
      const ctx = stopCanvas.getContext();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(16, 16, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(8, 13, 16, 6);
      stopCanvas.refresh();
    }
  }
}
