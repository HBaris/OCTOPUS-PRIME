import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    this.createProceduralTextures();
    this.scene.start('LobbyScene');
  }

  private createProceduralTextures(): void {
    // 1. Standard Floor Tile (32x32 retro textured tile)
    const floorCanvas = this.textures.createCanvas('floor_tile', 32, 32);
    if (floorCanvas) {
      const ctx = floorCanvas.getContext();
      ctx.fillStyle = '#182234';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#111927';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillRect(16, 16, 16, 16);
      ctx.fillStyle = '#202d42';
      for (let x = 2; x < 32; x += 4) {
        for (let y = 2; y < 32; y += 4) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.strokeStyle = '#28364f';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, 32, 32);
      floorCanvas.refresh();
    }

    // 2. Lobby Marble/Carpet Floor Tile (32x32)
    const lobbyFloorCanvas = this.textures.createCanvas('lobby_floor_tile', 32, 32);
    if (lobbyFloorCanvas) {
      const ctx = lobbyFloorCanvas.getContext();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 32, 32);
      // Red & gold royal carpet runner runner texture
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(4, 4, 24, 24);
      ctx.strokeStyle = '#312e81';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, 4, 24, 24);
      lobbyFloorCanvas.refresh();
    }

    // 3. Wall Tile (32x32 retro panel wall)
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

    // 4. Interactive Door Texture (72x100 retro styled doorway with brass knob & nameplate)
    const doorCanvas = this.textures.createCanvas('door_texture', 72, 100);
    if (doorCanvas) {
      const ctx = doorCanvas.getContext();
      // Outer Frame
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 72, 100);
      ctx.fillStyle = '#334155';
      ctx.fillRect(4, 4, 64, 92);
      // Door Wood Body
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(8, 8, 56, 84);
      // Top Glass / Light Window
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(16, 14, 40, 24);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(18, 16, 36, 4);
      // Lower Wood Inset Panel
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(16, 46, 40, 38);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(16, 46, 40, 38);
      // Gold Brass Knob
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(58, 62, 4, 0, Math.PI * 2);
      ctx.fill();
      doorCanvas.refresh();
    }

    // 5. Standard Desk (96x48)
    const deskCanvas = this.textures.createCanvas('desk_texture', 96, 48);
    if (deskCanvas) {
      const ctx = deskCanvas.getContext();
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, 96, 36);
      ctx.fillStyle = '#475569';
      ctx.fillRect(4, 4, 88, 28);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(4, 4, 88, 2);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 36, 96, 12);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 46, 96, 2);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(28, 14, 40, 14);
      deskCanvas.refresh();
    }

    // 6. Patron Mahogany Luxury Desk (120x56)
    const patronDeskCanvas = this.textures.createCanvas('patron_desk', 120, 56);
    if (patronDeskCanvas) {
      const ctx = patronDeskCanvas.getContext();
      ctx.fillStyle = '#451a03'; // Rich dark mahogany
      ctx.fillRect(0, 0, 120, 42);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(4, 4, 112, 34);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(4, 4, 112, 3);
      // Gold Inlay Trimming
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.strokeRect(8, 8, 104, 26);
      // Green Leather Writing Pad
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(36, 12, 48, 20);
      // Gold Desk Lamp / Nameplate
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(50, 6, 20, 4);
      // Desk Base & Front
      ctx.fillStyle = '#291102';
      ctx.fillRect(0, 42, 120, 14);
      patronDeskCanvas.refresh();
    }

    // 7. Drop Shadow
    const shadowCanvas = this.textures.createCanvas('desk_shadow', 120, 20);
    if (shadowCanvas) {
      const ctx = shadowCanvas.getContext();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(60, 10, 58, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      shadowCanvas.refresh();
    }

    // 8. Computer Monitor
    const monitorCanvas = this.textures.createCanvas('monitor_texture', 36, 32);
    if (monitorCanvas) {
      const ctx = monitorCanvas.getContext();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(2, 0, 32, 24);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(4, 2, 28, 20);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(6, 6, 12, 2);
      ctx.fillRect(6, 10, 20, 2);
      ctx.fillRect(6, 14, 16, 2);
      ctx.fillStyle = '#475569';
      ctx.fillRect(14, 24, 8, 5);
      ctx.fillRect(10, 29, 16, 3);
      monitorCanvas.refresh();
    }

    // 9. Office Chair
    const chairCanvas = this.textures.createCanvas('chair_texture', 32, 32);
    if (chairCanvas) {
      const ctx = chairCanvas.getContext();
      ctx.fillStyle = '#475569';
      ctx.fillRect(6, 4, 20, 14);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(8, 6, 16, 10);
      ctx.fillStyle = '#334155';
      ctx.fillRect(4, 18, 24, 10);
      chairCanvas.refresh();
    }

    // 10. Patron Leather High-Back Chair (40x44)
    const patronChairCanvas = this.textures.createCanvas('patron_chair', 40, 44);
    if (patronChairCanvas) {
      const ctx = patronChairCanvas.getContext();
      ctx.fillStyle = '#1e1b4b'; // Deep royal leather
      ctx.fillRect(6, 2, 28, 24);
      ctx.fillStyle = '#312e81';
      ctx.fillRect(8, 4, 24, 20);
      // Gold Buttons / Tufting
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(12, 8, 2, 2);
      ctx.fillRect(26, 8, 2, 2);
      ctx.fillRect(19, 15, 2, 2);
      // Cushion & Base
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(4, 26, 32, 12);
      patronChairCanvas.refresh();
    }

    // 11. News Whiteboard (120x70)
    const newsBoardCanvas = this.textures.createCanvas('news_board', 120, 70);
    if (newsBoardCanvas) {
      const ctx = newsBoardCanvas.getContext();
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, 0, 120, 70);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(4, 4, 112, 62);
      // Headlines & Sticky Notes
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(10, 10, 24, 18);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(40, 10, 24, 18);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(70, 10, 24, 18);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(10, 36, 40, 22);
      newsBoardCanvas.refresh();
    }

    // 12. Trader Multi-Screen Rig (100x60)
    const traderScreensCanvas = this.textures.createCanvas('trader_screens', 100, 60);
    if (traderScreensCanvas) {
      const ctx = traderScreensCanvas.getContext();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 100, 60);
      // 3 Mini Candlestick Displays
      ctx.fillStyle = '#10b981';
      ctx.fillRect(8, 8, 24, 20);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(38, 8, 24, 20);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(68, 8, 24, 20);
      traderScreensCanvas.refresh();
    }

    // 13. Risk Shield Emblem (64x64)
    const riskShieldCanvas = this.textures.createCanvas('risk_shield_emblem', 64, 64);
    if (riskShieldCanvas) {
      const ctx = riskShieldCanvas.getContext();
      ctx.fillStyle = '#064e3b';
      ctx.beginPath();
      ctx.moveTo(32, 4);
      ctx.lineTo(58, 16);
      ctx.lineTo(50, 48);
      ctx.lineTo(32, 60);
      ctx.lineTo(14, 48);
      ctx.lineTo(6, 16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('🛡️', 32, 40);
      riskShieldCanvas.refresh();
    }

    // 14. Portfolio Vault (80x80)
    const vaultCanvas = this.textures.createCanvas('portfolio_vault', 80, 80);
    if (vaultCanvas) {
      const ctx = vaultCanvas.getContext();
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, 80, 80);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, 76, 76);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(40, 40, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3;
      ctx.stroke();
      vaultCanvas.refresh();
    }

    // 15. Signal Radar Station (80x80)
    const radarCanvas = this.textures.createCanvas('signal_radar_station', 80, 80);
    if (radarCanvas) {
      const ctx = radarCanvas.getContext();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 80, 80);
      ctx.fillStyle = '#831843';
      ctx.beginPath();
      ctx.arc(40, 40, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(40, 40, 18, 0, Math.PI * 2);
      ctx.stroke();
      radarCanvas.refresh();
    }

    // 16. Patron Decision Board (140x70)
    const patronBoardCanvas = this.textures.createCanvas('patron_summary_board', 140, 70);
    if (patronBoardCanvas) {
      const ctx = patronBoardCanvas.getContext();
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(0, 0, 140, 70);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, 136, 66);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('⚡ AJAN RAPORLARI ÖZETİ', 12, 16);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(10, 24, 120, 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(12, 32, 32, 8);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(52, 32, 32, 8);
      ctx.fillStyle = '#ec4899';
      ctx.fillRect(92, 32, 32, 8);
      patronBoardCanvas.refresh();
    }

    // 17. Return to Lobby Door/Button (90x32)
    const returnDoorCanvas = this.textures.createCanvas('return_door', 90, 32);
    if (returnDoorCanvas) {
      const ctx = returnDoorCanvas.getContext();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 90, 32);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 88, 30);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚪 LOBİYE DÖN', 45, 16);
      returnDoorCanvas.refresh();
    }

    // 18. Server Rack & Plants
    const serverCanvas = this.textures.createCanvas('server_rack', 40, 80);
    if (serverCanvas) {
      const ctx = serverCanvas.getContext();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 40, 80);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(1, 1, 38, 78);
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

    const plantCanvas = this.textures.createCanvas('plant_texture', 24, 32);
    if (plantCanvas) {
      const ctx = plantCanvas.getContext();
      ctx.fillStyle = '#b45309';
      ctx.fillRect(4, 16, 16, 16);
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

    const coolerCanvas = this.textures.createCanvas('cooler_texture', 24, 48);
    if (coolerCanvas) {
      const ctx = coolerCanvas.getContext();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(12, 12, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(2, 20, 20, 28);
      coolerCanvas.refresh();
    }

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
