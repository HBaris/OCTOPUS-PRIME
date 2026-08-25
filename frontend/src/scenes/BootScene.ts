import Phaser from 'phaser';
import { PixelCharacterGenerator } from '../utils/pixelCharacterGenerator.ts';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    this.createProceduralTextures();
    PixelCharacterGenerator.generateAllAgentTextures(this);
    this.scene.start('PatronRoomScene');
  }

  private createProceduralTextures(): void {
    // 1. Warm Parquet Wood Floor Tile (32x32, 3/4 top-down planks)
    const parquetCanvas = this.textures.createCanvas('floor_tile', 32, 32);
    if (parquetCanvas) {
      const ctx = parquetCanvas.getContext();
      ctx.fillStyle = '#1e1b18'; // Dark wood base
      ctx.fillRect(0, 0, 32, 32);

      // Plank 1 (Top)
      ctx.fillStyle = '#2b231c';
      ctx.fillRect(0, 0, 32, 15);
      ctx.fillStyle = '#362c24';
      ctx.fillRect(1, 1, 30, 2);
      ctx.fillStyle = '#221b16';
      ctx.fillRect(0, 15, 32, 1);

      // Plank 2 (Bottom)
      ctx.fillStyle = '#302720';
      ctx.fillRect(0, 16, 32, 15);
      ctx.fillStyle = '#3d3229';
      ctx.fillRect(1, 17, 30, 2);
      ctx.fillStyle = '#181310';
      ctx.fillRect(0, 31, 32, 1);

      // Vertical Staggered Plank Seams
      ctx.fillStyle = '#181310';
      ctx.fillRect(18, 0, 1, 15);
      ctx.fillRect(8, 16, 1, 15);

      // Wood Grain Accents
      ctx.fillStyle = '#221c17';
      ctx.fillRect(4, 5, 8, 1);
      ctx.fillRect(22, 9, 6, 1);
      ctx.fillRect(12, 22, 10, 1);
      ctx.fillRect(24, 26, 5, 1);

      parquetCanvas.refresh();
    }

    // 2. Modern Acoustic Office Carpet Tile (32x32, textured charcoal-slate)
    const carpetCanvas = this.textures.createCanvas('lobby_floor_tile', 32, 32);
    if (carpetCanvas) {
      const ctx = carpetCanvas.getContext();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#182234';
      ctx.fillRect(2, 2, 28, 28);
      ctx.fillStyle = '#1e293b';
      for (let x = 4; x < 28; x += 4) {
        for (let y = 4; y < 28; y += 4) {
          ctx.fillRect(x, y, 2, 2);
        }
      }
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(1, 1, 30, 30);
      carpetCanvas.refresh();
    }

    // 3. Acoustic Wood Slat Wall Tile (32x32)
    const wallCanvas = this.textures.createCanvas('wall_tile', 32, 32);
    if (wallCanvas) {
      const ctx = wallCanvas.getContext();
      ctx.fillStyle = '#0b0f19'; // Deep shadow backing
      ctx.fillRect(0, 0, 32, 32);

      // Vertical warm acoustic oak slats
      const slatColors = ['#451a03', '#5a2206', '#3b1602', '#521f05'];
      for (let i = 0; i < 4; i++) {
        const x = i * 8;
        ctx.fillStyle = slatColors[i % slatColors.length];
        ctx.fillRect(x + 1, 0, 6, 32);
        // Highlight on left of slat
        ctx.fillStyle = '#78350f';
        ctx.fillRect(x + 1, 0, 1, 32);
        // Shadow on right of slat
        ctx.fillStyle = '#220b01';
        ctx.fillRect(x + 6, 0, 1, 32);
      }
      wallCanvas.refresh();
    }

    // 4. Panoramic Night City Skyline Window (150x85, modern floor-to-ceiling glass)
    const windowCanvas = this.textures.createCanvas('office_window', 150, 85);
    if (windowCanvas) {
      const ctx = windowCanvas.getContext();
      // Night Sky Gradient
      const grad = ctx.createLinearGradient(0, 0, 0, 85);
      grad.addColorStop(0, '#030712');
      grad.addColorStop(0.6, '#0f172a');
      grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 150, 85);

      // Distant Stars & Moon glow
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(20, 12, 1.5, 1.5);
      ctx.fillRect(65, 8, 1, 1);
      ctx.fillRect(110, 15, 1.5, 1.5);
      ctx.fillRect(135, 10, 1, 1);
      ctx.fillRect(80, 20, 1, 1);

      // Distant Skyscrapers Silhouette
      ctx.fillStyle = '#090d16';
      ctx.fillRect(10, 30, 24, 55);
      ctx.fillRect(40, 20, 32, 65);
      ctx.fillRect(78, 35, 20, 50);
      ctx.fillRect(102, 16, 38, 69);

      // Midground Skyscraper Windows (Illuminated Golden & Cyan Lights)
      const windowColors = ['#fde047', '#38bdf8', '#fbbf24', '#ffffff', '#1e293b'];
      for (let bx = 14; bx < 30; bx += 5) {
        for (let by = 36; by < 75; by += 7) {
          ctx.fillStyle = windowColors[Math.floor(Math.random() * windowColors.length)];
          ctx.fillRect(bx, by, 3, 4);
        }
      }
      for (let bx = 45; bx < 68; bx += 6) {
        for (let by = 26; by < 78; by += 8) {
          ctx.fillStyle = windowColors[Math.floor(Math.random() * windowColors.length)];
          ctx.fillRect(bx, by, 3, 4);
        }
      }
      for (let bx = 108; bx < 136; bx += 6) {
        for (let by = 22; by < 80; by += 7) {
          ctx.fillStyle = windowColors[Math.floor(Math.random() * windowColors.length)];
          ctx.fillRect(bx, by, 3, 4);
        }
      }

      // Red Beacon Lights on Skyscraper tops
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(55, 18, 2, 2);
      ctx.fillRect(120, 14, 2, 2);

      // Sleek Dark Aluminum Window Frame & Mullions
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, 150, 85);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(50, 0);
      ctx.lineTo(50, 85);
      ctx.moveTo(100, 0);
      ctx.lineTo(100, 85);
      ctx.moveTo(0, 42);
      ctx.lineTo(150, 42);
      ctx.stroke();

      // Glass Specular Reflection Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(60, 0);
      ctx.lineTo(30, 85);
      ctx.lineTo(0, 85);
      ctx.closePath();
      ctx.fill();

      windowCanvas.refresh();
    }

    // 5. Modern 3/4 Side-Diagonal Isometric Workstation Desk (110x72)
    const deskCanvas = this.textures.createCanvas('topdown_desk', 110, 72);
    if (deskCanvas) {
      const ctx = deskCanvas.getContext();
      // Floor Contact Shadow (Angled diagonally)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(55, 68, 50, 4, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // Side Panel & Metal Legs (Front-Right View)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(82, 38, 20, 28);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(10, 44, 6, 22);
      ctx.fillRect(84, 40, 16, 24);

      // Main Tabletop Surface (Receding diagonally back-left to front-right)
      ctx.fillStyle = '#334155'; // Front edge thickness bevel
      ctx.fillRect(4, 36, 102, 6);

      ctx.fillStyle = '#475569'; // Top surface
      ctx.beginPath();
      ctx.moveTo(14, 4);
      ctx.lineTo(106, 4);
      ctx.lineTo(106, 36);
      ctx.lineTo(4, 36);
      ctx.closePath();
      ctx.fill();

      // Top Highlight
      ctx.fillStyle = '#64748b';
      ctx.fillRect(4, 4, 102, 2.5);

      // Angled Mousepad
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(14, 10, 52, 22);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(14, 10, 52, 22);

      // Mechanical RGB Keyboard (In front of seated character)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(18, 15, 34, 13);
      ctx.fillStyle = '#38bdf8';
      for (let kx = 21; kx < 50; kx += 4) {
        ctx.fillRect(kx, 17, 2.5, 2.5);
        ctx.fillRect(kx, 22, 2.5, 2.5);
      }

      // Mouse
      ctx.fillStyle = '#64748b';
      ctx.fillRect(55, 17, 7, 10);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(57, 18, 1, 3);

      // Open Angled Laptop / Terminal (Far Right of Desk, 28x22)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(72, 8, 26, 18);
      ctx.fillStyle = '#0284c7'; // Screen glow
      ctx.fillRect(74, 10, 22, 14);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(76, 12, 14, 2);
      ctx.fillRect(76, 16, 18, 2);
      ctx.fillRect(76, 20, 10, 2);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(70, 26, 30, 3); // Laptop base

      // Ceramic Coffee Mug
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(8, 20, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(8, 20, 3, 0, Math.PI * 2);
      ctx.fill();

      deskCanvas.refresh();
    }

    // 6. Patron Luxury Mahogany 3/4 Side-Diagonal Executive Desk (130x76)
    const patronDeskCanvas = this.textures.createCanvas('patron_topdown_desk', 130, 76);
    if (patronDeskCanvas) {
      const ctx = patronDeskCanvas.getContext();
      // Floor Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(65, 72, 60, 4, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // Heavy Mahogany Front & Side Base
      ctx.fillStyle = '#291102';
      ctx.fillRect(96, 40, 26, 30);
      ctx.fillStyle = '#451a03';
      ctx.fillRect(10, 44, 88, 24);
      ctx.fillRect(98, 42, 22, 26);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.strokeRect(16, 48, 76, 14);

      // Top Surface Mahogany
      ctx.fillStyle = '#5c2406';
      ctx.fillRect(4, 38, 122, 6); // Bevel
      ctx.fillStyle = '#78350f';
      ctx.fillRect(4, 4, 122, 34);

      // Polished Top Highlight
      ctx.fillStyle = '#92400e';
      ctx.fillRect(4, 4, 122, 3);

      // Inlaid Gold Border Trim
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.strokeRect(8, 6, 114, 28);

      // Green Leather Writing Blotter
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(16, 10, 60, 22);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1;
      ctx.strokeRect(16, 10, 60, 22);

      // Mechanical Keyboard on Blotter
      ctx.fillStyle = '#18181b';
      ctx.fillRect(24, 15, 36, 13);
      ctx.fillStyle = '#fbbf24';
      for (let kx = 27; kx < 56; kx += 4) {
        ctx.fillRect(kx, 17, 2.5, 2.5);
        ctx.fillRect(kx, 22, 2.5, 2.5);
      }

      // Brass Banker's Lamp (Left Corner)
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(10, 10, 3, 10);
      ctx.fillStyle = '#047857';
      ctx.fillRect(7, 8, 10, 5);

      // Executive Gold Laptop (Right Side, 30x22)
      ctx.fillStyle = '#78350f';
      ctx.fillRect(86, 8, 28, 20);
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(88, 10, 24, 16);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(90, 12, 16, 2);
      ctx.fillRect(90, 16, 20, 2);
      ctx.fillRect(90, 20, 12, 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(84, 28, 32, 3);

      // Gold Seal
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(80, 16, 4, 0, Math.PI * 2);
      ctx.fill();

      patronDeskCanvas.refresh();
    }

    // 7. Dual Curved Monitor Array (96x48, 3/4 angle viewed from top-front)
    const curvedMonCanvas = this.textures.createCanvas('curved_multi_monitors', 96, 48);
    if (curvedMonCanvas) {
      const ctx = curvedMonCanvas.getContext();
      // Sturdy Metal Stand Base
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(38, 40, 20, 6);
      ctx.fillRect(46, 32, 4, 10);

      // Left Monitor (Angled 15 deg inward)
      ctx.fillStyle = '#0f172a'; // Bezel
      ctx.fillRect(4, 4, 42, 30);
      ctx.fillStyle = '#0284c7'; // Screen background
      ctx.fillRect(6, 6, 38, 26);
      // Candlestick Chart
      ctx.fillStyle = '#10b981';
      ctx.fillRect(10, 16, 4, 10);
      ctx.fillRect(18, 12, 4, 14);
      ctx.fillRect(32, 8, 4, 18);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(25, 14, 4, 12);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(8, 24);
      ctx.lineTo(20, 18);
      ctx.lineTo(34, 10);
      ctx.stroke();

      // Right Monitor (Angled 15 deg inward)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(50, 4, 42, 30);
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(52, 6, 38, 26);
      // Code & Terminal Output
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(56, 10, 16, 2);
      ctx.fillRect(56, 14, 28, 2);
      ctx.fillRect(56, 18, 22, 2);
      ctx.fillStyle = '#a78bfa';
      ctx.fillRect(56, 22, 30, 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(56, 26, 14, 2);

      // Top Screen Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(6, 6, 38, 3);
      ctx.fillRect(52, 6, 38, 3);

      curvedMonCanvas.refresh();
    }

    // 8. Patron Luxury Triple Monitor Rig (120x52)
    const tripleMonCanvas = this.textures.createCanvas('patron_triple_monitors', 120, 52);
    if (tripleMonCanvas) {
      const ctx = tripleMonCanvas.getContext();
      ctx.fillStyle = '#334155';
      ctx.fillRect(50, 42, 20, 6);
      ctx.fillRect(58, 32, 4, 12);

      // 3 Screens (Left, Center, Right)
      const screens = [
        { x: 4, w: 34, bg: '#064e3b', title: 'PnL' },
        { x: 42, w: 36, bg: '#1e1b4b', title: 'DECISION' },
        { x: 82, w: 34, bg: '#0f172a', title: 'FLOW' },
      ];

      screens.forEach((s) => {
        ctx.fillStyle = '#020617';
        ctx.fillRect(s.x, 2, s.w, 32);
        ctx.fillStyle = s.bg;
        ctx.fillRect(s.x + 2, 4, s.w - 4, 28);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(s.x + 4, 8, 12, 2);
        ctx.fillRect(s.x + 4, 13, s.w - 8, 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(s.x + 4, 18, s.w - 12, 2);
        ctx.fillRect(s.x + 4, 23, s.w - 16, 2);
      });

      tripleMonCanvas.refresh();
    }

    // 9. Ergonomic Mesh Office Chair (44x48, 3/4 top-down perspective)
    const chairCanvas = this.textures.createCanvas('chair_texture', 44, 48);
    if (chairCanvas) {
      const ctx = chairCanvas.getContext();
      // Wheel Base (5-star caster legs on floor)
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(22, 28, 14, 0, Math.PI * 2);
      ctx.fill();

      // Padded Seat Cushion (3/4 top-down oval)
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.ellipse(22, 26, 16, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.ellipse(22, 25, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Armrests (Left & Right)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(3, 18, 5, 14);
      ctx.fillRect(36, 18, 5, 14);
      ctx.fillStyle = '#475569';
      ctx.fillRect(4, 19, 3, 12);
      ctx.fillRect(37, 19, 3, 12);

      // High Contoured Mesh Backrest
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(8, 2, 28, 14);
      ctx.fillStyle = '#475569';
      ctx.fillRect(10, 4, 24, 10);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(10, 4, 24, 2); // Headrest/Top rim

      chairCanvas.refresh();
    }

    // 10. Patron Leather Executive Armchair (48x52, 3/4 top-down)
    const patronChairCanvas = this.textures.createCanvas('patron_chair', 48, 52);
    if (patronChairCanvas) {
      const ctx = patronChairCanvas.getContext();
      // Mahogany Base
      ctx.fillStyle = '#291102';
      ctx.beginPath();
      ctx.arc(24, 30, 16, 0, Math.PI * 2);
      ctx.fill();

      // Deep Navy / Charcoal Tufted Leather Cushion
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(24, 28, 18, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.ellipse(24, 27, 16, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Gold Rivets / Tufting
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(18, 24, 2, 2);
      ctx.fillRect(30, 24, 2, 2);
      ctx.fillRect(24, 30, 2, 2);

      // Padded Armrests
      ctx.fillStyle = '#451a03';
      ctx.fillRect(2, 18, 6, 16);
      ctx.fillRect(40, 18, 6, 16);

      // High Backrest with Gold Piping
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(6, 2, 36, 16);
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(8, 4, 32, 12);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.strokeRect(8, 4, 32, 12);

      patronChairCanvas.refresh();
    }

    // 11. Large Tropical Office Plant (Monstera in Ceramic Pot, 48x64)
    const plantCanvas = this.textures.createCanvas('plant_texture', 48, 64);
    if (plantCanvas) {
      const ctx = plantCanvas.getContext();
      // Pot Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(24, 58, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // White Ceramic Modern Pot
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(12, 38, 24, 20);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(10, 36, 28, 4);
      ctx.fillStyle = '#3f2212'; // Soil
      ctx.fillRect(12, 36, 24, 3);

      // Monstera Split Leaves
      const drawLeaf = (lx: number, ly: number, size: number, angle: number) => {
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(angle);
        ctx.fillStyle = '#047857';
        ctx.beginPath();
        ctx.ellipse(0, 0, size, size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#10b981';
        ctx.fillRect(-size * 0.8, -1, size * 1.6, 2);
        ctx.restore();
      };

      drawLeaf(24, 22, 16, -0.2);
      drawLeaf(14, 16, 14, -0.6);
      drawLeaf(34, 18, 14, 0.5);
      drawLeaf(22, 8, 12, 0.1);
      drawLeaf(36, 28, 10, 0.8);
      drawLeaf(10, 26, 10, -0.9);

      plantCanvas.refresh();
    }

    // 12. Office Water Cooler with Bubbles (32x60)
    const coolerCanvas = this.textures.createCanvas('cooler_texture', 32, 60);
    if (coolerCanvas) {
      const ctx = coolerCanvas.getContext();
      // Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(16, 56, 14, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Base & Dispenser Body
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(4, 20, 24, 36);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(4, 20, 24, 3);

      // Dispenser Niche & Taps
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(8, 28, 16, 14);
      ctx.fillStyle = '#38bdf8'; // Cold tap
      ctx.fillRect(10, 30, 4, 3);
      ctx.fillStyle = '#ef4444'; // Hot tap
      ctx.fillRect(18, 30, 4, 3);

      // Blue Transparent Water Jug
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(16, 12, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8'; // Water highlight
      ctx.fillRect(10, 6, 4, 8);

      coolerCanvas.refresh();
    }

    // 13. Server Rack with Blinking LEDs (44x76)
    const serverCanvas = this.textures.createCanvas('server_rack', 44, 76);
    if (serverCanvas) {
      const ctx = serverCanvas.getContext();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(22, 72, 20, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cabinet
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(2, 0, 40, 72);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 0, 40, 72);

      // Server Units & LEDs
      for (let y = 6; y < 66; y += 10) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(6, y, 32, 7);
        // Status LEDs
        ctx.fillStyle = '#10b981'; // Green OK
        ctx.fillRect(8, y + 2, 2.5, 2.5);
        ctx.fillStyle = '#38bdf8'; // Blue Activity
        ctx.fillRect(13, y + 2, 2.5, 2.5);
        ctx.fillStyle = '#f59e0b'; // Amber Data
        ctx.fillRect(18, y + 2, 2.5, 2.5);
        // Vents
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(24, y + 2, 12, 3);
      }

      serverCanvas.refresh();
    }

    // 14. Whiteboard (140x76, with diagrams & colorful sticky notes)
    const newsBoardCanvas = this.textures.createCanvas('news_board', 140, 76);
    if (newsBoardCanvas) {
      const ctx = newsBoardCanvas.getContext();
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, 140, 76);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(4, 4, 132, 68);

      // Title header line
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(10, 10, 40, 4);

      // Diagram & Flowchart lines
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(10, 20, 30, 18);
      ctx.strokeRect(55, 20, 30, 18);
      ctx.beginPath();
      ctx.moveTo(40, 29);
      ctx.lineTo(55, 29);
      ctx.stroke();

      // Colorful Post-it Sticky Notes
      const stickies = [
        { x: 95, y: 12, c: '#fde047' },
        { x: 115, y: 12, c: '#f472b6' },
        { x: 95, y: 32, c: '#67e8f9' },
        { x: 115, y: 32, c: '#86efac' },
        { x: 10, y: 46, c: '#fde047' },
        { x: 34, y: 46, c: '#fca5a5' },
      ];
      stickies.forEach((s) => {
        ctx.fillStyle = s.c;
        ctx.fillRect(s.x, s.y, 16, 16);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(s.x, s.y + 14, 16, 2);
      });

      // Marker Tray & Pens
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(30, 72, 80, 4);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(45, 71, 10, 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(60, 71, 10, 2);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(75, 71, 10, 2);

      newsBoardCanvas.refresh();
    }

    // 15. Risk Shield Emblem (72x72)
    const riskShieldCanvas = this.textures.createCanvas('risk_shield_emblem', 72, 72);
    if (riskShieldCanvas) {
      const ctx = riskShieldCanvas.getContext();
      ctx.fillStyle = '#064e3b';
      ctx.beginPath();
      ctx.moveTo(36, 4);
      ctx.lineTo(66, 16);
      ctx.lineTo(58, 56);
      ctx.lineTo(36, 68);
      ctx.lineTo(14, 56);
      ctx.lineTo(6, 16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('🛡️', 36, 46);
      riskShieldCanvas.refresh();
    }

    // 16. Portfolio Vault (84x84)
    const vaultCanvas = this.textures.createCanvas('portfolio_vault', 84, 84);
    if (vaultCanvas) {
      const ctx = vaultCanvas.getContext();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 84, 84);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 5;
      ctx.strokeRect(2, 2, 80, 80);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(42, 42, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(39, 24, 6, 36);
      ctx.fillRect(24, 39, 36, 6);
      vaultCanvas.refresh();
    }

    // 17. Signal Radar Station (84x84)
    const radarCanvas = this.textures.createCanvas('signal_radar_station', 84, 84);
    if (radarCanvas) {
      const ctx = radarCanvas.getContext();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 84, 84);
      ctx.fillStyle = '#831843';
      ctx.beginPath();
      ctx.arc(42, 42, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(42, 42, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(42, 6);
      ctx.lineTo(42, 78);
      ctx.moveTo(6, 42);
      ctx.lineTo(78, 42);
      ctx.stroke();
      radarCanvas.refresh();
    }

    // 18. Patron Decision Board (150x80)
    const patronSummaryCanvas = this.textures.createCanvas('patron_summary_board', 150, 80);
    if (patronSummaryCanvas) {
      const ctx = patronSummaryCanvas.getContext();
      ctx.fillStyle = '#291102';
      ctx.fillRect(0, 0, 150, 80);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(4, 4, 142, 72);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, 142, 72);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('📊 EKİP RAPOR KONSOLU', 12, 18);

      const items = ['📰 HABER: AKTİF', '🤖 İŞLEM: HAZIR', '🛡️ RİSK: %75', '💰 PnL: $0.00'];
      items.forEach((item, idx) => {
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(item, 12, 34 + idx * 11);
      });

      patronSummaryCanvas.refresh();
    }

    // 19. Trader Screens (110x64)
    const traderScreensCanvas = this.textures.createCanvas('trader_screens', 110, 64);
    if (traderScreensCanvas) {
      const ctx = traderScreensCanvas.getContext();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 110, 64);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, 110, 64);

      // 3 Display Panels
      ctx.fillStyle = '#10b981';
      ctx.fillRect(6, 6, 30, 52);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(40, 6, 30, 52);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(74, 6, 30, 52);

      traderScreensCanvas.refresh();
    }

    // 20. Alert & Stop Badges
    const alertCanvas = this.textures.createCanvas('alert_bubble', 24, 24);
    if (alertCanvas) {
      const ctx = alertCanvas.getContext();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(12, 12, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', 12, 17);
      alertCanvas.refresh();
    }

    const tradeCanvas = this.textures.createCanvas('trading_badge', 24, 24);
    if (tradeCanvas) {
      const ctx = tradeCanvas.getContext();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(12, 12, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡', 12, 16);
      tradeCanvas.refresh();
    }

    const warningCanvas = this.textures.createCanvas('warning_stop', 28, 28);
    if (warningCanvas) {
      const ctx = warningCanvas.getContext();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(14, 14, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(6, 12, 16, 4);
      warningCanvas.refresh();
    }
  }
}
