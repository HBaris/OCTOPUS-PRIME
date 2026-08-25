import Phaser from 'phaser';
import { AgentRole, AgentState } from '../types/events.ts';
import { AGENT_CONFIGS } from '../config.ts';

export class PixelCharacterGenerator {
  public static generateAllAgentTextures(scene: Phaser.Scene): void {
    const states: AgentState[] = ['IDLE', 'ANALYZING', 'ALERTING', 'TRADING', 'SALUTING'];

    AGENT_CONFIGS.forEach((cfg) => {
      states.forEach((st) => {
        const textureKey = this.getTextureKey(cfg.role, st);
        if (!scene.textures.exists(textureKey)) {
          const canvas = scene.textures.createCanvas(textureKey, 128, 112);
          if (canvas) {
            const ctx = canvas.getContext();
            this.drawEnlargedDiagonalWorkstation(ctx, cfg.role, st);
            canvas.refresh();
          }
        }
      });
    });
  }

  public static getTextureKey(role: AgentRole, state: AgentState): string {
    const safeRole = role.replace(/[\s()]/g, '_');
    return `workstation_v2_${safeRole}_${state}`;
  }

  private static drawEnlargedDiagonalWorkstation(
    ctx: CanvasRenderingContext2D,
    role: AgentRole,
    state: AgentState
  ): void {
    ctx.imageSmoothingEnabled = false;

    const palette = this.getAgentPalette(role);
    const isPatron = role === 'Patron';

    // 1. Floor Drop Shadows (Under chair wheels and desk legs)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(40, 104, 28, 6, -0.05, 0, Math.PI * 2); // Chair base shadow
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(92, 104, 30, 6, 0, 0, Math.PI * 2); // Desk feet shadow
    ctx.fill();

    // 2. Desk in Subtle 3/4 Diagonal View (Enlarged, Spacious 74x40)
    this.drawEnlargedDiagonalDesk(ctx, isPatron);

    // 3. Ergonomic Office Chair in Subtle 3/4 Diagonal View
    this.drawEnlargedDiagonalChair(ctx, isPatron);

    // 4. Character Lower Body & Trousers Seated
    this.drawSeatedTrousersAndShoes(ctx, palette);

    // 5. Character Torso & Outfit (3/4 Diagonal)
    this.drawSeatedTorso(ctx, palette, state);

    // 6. Character Head, Face & Hair (3/4 Diagonal)
    this.drawHeadAndFace(ctx, palette, role, state);

    // 7. Desktop Items (Enlarged Glowing Laptop, RGB Mousepad, Steaming Mug, Pen)
    this.drawDesktopItems(ctx, state, isPatron);

    // 8. Arms & Hands Typing on Keyboard/Laptop
    this.drawArmsAndTypingHands(ctx, palette, state);

    // 9. Role-Specific Accessories (Glasses, Headset, Badge, Pins)
    this.drawRoleAccessories(ctx, palette, role);

    // 10. Dynamic State Emote / FX (Lightning, Exclamation, Gear)
    this.drawStateEmote(ctx, state);
  }

  private static drawEnlargedDiagonalDesk(ctx: CanvasRenderingContext2D, isPatron: boolean): void {
    const woodTop = isPatron ? '#78350f' : '#475569';
    const woodBevel = isPatron ? '#5c2406' : '#334155';
    const woodDark = isPatron ? '#451a03' : '#1e293b';
    const legColor = isPatron ? '#291102' : '#0f172a';

    // A. Metal / Wood Legs & Cable Management Box
    ctx.fillStyle = legColor;
    ctx.fillRect(88, 70, 8, 30); // Center pillar
    ctx.fillRect(116, 72, 6, 28); // Rear right leg

    ctx.fillStyle = woodDark;
    ctx.fillRect(89, 70, 6, 29);
    ctx.fillRect(117, 72, 4, 27);

    // B. Desk Feet on Floor
    ctx.fillStyle = legColor;
    ctx.beginPath();
    ctx.roundRect(76, 98, 34, 6, 2);
    ctx.fill();
    ctx.fillStyle = woodBevel;
    ctx.fillRect(77, 99, 32, 2);

    ctx.fillStyle = legColor;
    ctx.beginPath();
    ctx.roundRect(110, 98, 16, 5, 2);
    ctx.fill();

    // C. Tabletop Main Surface (Subtle 3/4 Diagonal Parallelogram, 76x30)
    ctx.fillStyle = legColor; // Perimeter outline
    ctx.beginPath();
    ctx.moveTo(56, 68);
    ctx.lineTo(124, 68);
    ctx.lineTo(120, 98);
    ctx.lineTo(52, 98);
    ctx.closePath();
    ctx.fill();

    // Front/Side Edge Bevel (Thickness)
    ctx.fillStyle = woodBevel;
    ctx.beginPath();
    ctx.moveTo(52, 94);
    ctx.lineTo(120, 94);
    ctx.lineTo(120, 98);
    ctx.lineTo(52, 98);
    ctx.closePath();
    ctx.fill();

    // Top Table Surface (Spacious wooden/charcoal board)
    ctx.fillStyle = woodTop;
    ctx.beginPath();
    ctx.moveTo(56, 68);
    ctx.lineTo(124, 68);
    ctx.lineTo(120, 94);
    ctx.lineTo(52, 94);
    ctx.closePath();
    ctx.fill();

    // Top Highlight Edge
    ctx.fillStyle = isPatron ? '#fbbf24' : '#64748b';
    ctx.fillRect(57, 68, 66, 2);

    // Inlaid Executive Leather Blotter or Deskmat
    ctx.fillStyle = isPatron ? '#064e3b' : '#0f172a';
    ctx.beginPath();
    ctx.moveTo(60, 72);
    ctx.lineTo(108, 72);
    ctx.lineTo(105, 92);
    ctx.lineTo(57, 92);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = isPatron ? '#10b981' : '#38bdf8';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private static drawEnlargedDiagonalChair(ctx: CanvasRenderingContext2D, isPatron: boolean): void {
    const frameColor = isPatron ? '#291102' : '#0f172a';
    const cushionDark = isPatron ? '#1e1b4b' : '#1e293b';
    const cushionBase = isPatron ? '#312e81' : '#334155';
    const cushionLight = isPatron ? '#f59e0b' : '#475569';

    // A. 5-Star Wheeled Base on floor
    ctx.fillStyle = frameColor;
    ctx.fillRect(36, 88, 8, 14); // Hydraulic stem
    ctx.fillStyle = '#64748b';
    ctx.fillRect(38, 89, 4, 12);

    // Star Base Legs
    ctx.fillStyle = frameColor;
    ctx.beginPath();
    ctx.roundRect(20, 98, 40, 5, 2);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.fillRect(22, 99, 36, 2);

    // Caster Wheels
    ctx.fillStyle = '#090d16';
    ctx.fillRect(18, 102, 5, 4);
    ctx.fillRect(38, 102, 5, 4);
    ctx.fillRect(56, 102, 5, 4);

    // B. High Ergonomic Backrest (Left side, subtle 3/4 angle)
    ctx.fillStyle = frameColor;
    ctx.beginPath();
    ctx.roundRect(14, 30, 16, 48, [8, 6, 2, 6]);
    ctx.fill();

    ctx.fillStyle = cushionDark;
    ctx.beginPath();
    ctx.roundRect(16, 32, 12, 44, [7, 5, 2, 5]);
    ctx.fill();

    ctx.fillStyle = cushionBase;
    ctx.beginPath();
    ctx.roundRect(17, 33, 10, 42, [6, 4, 2, 4]);
    ctx.fill();

    if (isPatron) {
      // Luxury gold buttons
      ctx.fillStyle = cushionLight;
      ctx.fillRect(19, 40, 3, 3);
      ctx.fillRect(19, 52, 3, 3);
      ctx.fillRect(19, 64, 3, 3);
    }

    // C. Padded Seat Cushion (3/4 Angle)
    ctx.fillStyle = frameColor;
    ctx.beginPath();
    ctx.roundRect(22, 76, 34, 12, [4, 6, 4, 4]);
    ctx.fill();

    ctx.fillStyle = cushionDark;
    ctx.beginPath();
    ctx.roundRect(24, 78, 30, 9, [3, 5, 3, 3]);
    ctx.fill();

    ctx.fillStyle = cushionBase;
    ctx.fillRect(26, 79, 27, 7);

    // D. Ergonomic Armrest (3/4 Side View)
    ctx.fillStyle = frameColor;
    ctx.fillRect(24, 64, 20, 5);
    ctx.fillRect(28, 69, 5, 9);
    ctx.fillStyle = cushionLight;
    ctx.fillRect(25, 64, 18, 2);
  }

  private static drawSeatedTrousersAndShoes(
    ctx: CanvasRenderingContext2D,
    palette: CharacterPalette
  ): void {
    // A. Thighs & Trousers Seated on Cushion
    ctx.fillStyle = '#090d16'; // Outline
    ctx.beginPath();
    ctx.roundRect(30, 74, 30, 16, [4, 8, 2, 6]);
    ctx.fill();

    ctx.fillStyle = palette.trousersColor || '#1e293b';
    ctx.beginPath();
    ctx.roundRect(31, 75, 28, 14, [3, 7, 2, 5]);
    ctx.fill();

    // B. Calves & Lower Legs
    ctx.fillStyle = palette.trousersColor || '#1e293b';
    ctx.fillRect(48, 86, 10, 12);
    ctx.fillStyle = '#090d16';
    ctx.strokeRect(48, 86, 10, 12);

    // C. Dress Shoes on Floor
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect(48, 97, 16, 6, [3, 5, 1, 1]);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.fillRect(50, 98, 13, 2);
  }

  private static drawSeatedTorso(
    ctx: CanvasRenderingContext2D,
    palette: CharacterPalette,
    _state: AgentState
  ): void {
    // Torso Silhouette (Leaning comfortably forward towards desk)
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect(28, 44, 32, 34, [10, 10, 4, 6]);
    ctx.fill();

    ctx.fillStyle = palette.jacketDark;
    ctx.beginPath();
    ctx.roundRect(30, 46, 28, 30, [8, 8, 3, 4]);
    ctx.fill();

    ctx.fillStyle = palette.jacketBase;
    ctx.beginPath();
    ctx.roundRect(31, 47, 26, 28, [7, 7, 2, 3]);
    ctx.fill();

    // Shoulder top highlight
    ctx.fillStyle = palette.jacketLight;
    ctx.fillRect(32, 47, 18, 3);

    // White Shirt Inner V-Neck & Tie
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(44, 46);
    ctx.lineTo(54, 56);
    ctx.lineTo(49, 62);
    ctx.closePath();
    ctx.fill();

    // Tie
    ctx.fillStyle = palette.tieColor;
    ctx.beginPath();
    ctx.moveTo(48, 48);
    ctx.lineTo(53, 54);
    ctx.lineTo(51, 68);
    ctx.lineTo(48, 68);
    ctx.closePath();
    ctx.fill();

    // Gold Tie Pin
    if (palette.goldTrim) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(48, 56, 4, 2.5);
    }
  }

  private static drawHeadAndFace(
    ctx: CanvasRenderingContext2D,
    palette: CharacterPalette,
    role: AgentRole,
    state: AgentState
  ): void {
    // Head Silhouette (3/4 Diagonal)
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect(36, 18, 30, 30, [10, 12, 6, 10]);
    ctx.fill();

    // Skin Base
    ctx.fillStyle = palette.skinTone;
    ctx.beginPath();
    ctx.roundRect(37, 19, 28, 28, [9, 11, 5, 9]);
    ctx.fill();

    // Nose Profile (Pointing right-forward)
    ctx.fillStyle = palette.skinTone;
    ctx.fillRect(63, 31, 4, 5);
    ctx.fillStyle = '#090d16';
    ctx.strokeRect(63, 31, 4, 5);

    // Warm Rosy Cheek Blush
    ctx.fillStyle = 'rgba(251, 113, 133, 0.55)';
    ctx.fillRect(51, 35, 7, 5);

    // Expressive Eye (3/4 Angle with Specular Twinkle)
    if (state === 'ALERTING') {
      // Wide Alarmed Eye
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(49, 26, 10, 10);
      ctx.fillStyle = '#090d16';
      ctx.strokeRect(49, 26, 10, 10);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(53, 28, 5, 6);
    } else if (state === 'ANALYZING') {
      // Sharp Calculating Squint
      ctx.fillStyle = '#090d16';
      ctx.fillRect(49, 30, 10, 3.5);
      ctx.fillStyle = palette.eyeColor;
      ctx.fillRect(50, 31, 8, 4.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(52, 31, 3, 3);
    } else {
      // Standard / Trading / Saluting (Beautiful Large Expressive Eye)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(49, 26, 9, 9);
      ctx.fillStyle = '#090d16';
      ctx.strokeRect(49, 26, 9, 9);
      ctx.fillStyle = palette.eyeColor;
      ctx.fillRect(51, 27, 6.5, 7);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(53, 28, 4, 5);
      // Pure White Specular Highlight Twinkle
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(51, 27, 3, 3);

      // Eyebrow
      ctx.fillStyle = palette.hairDark;
      ctx.fillRect(49, 23, 9, 2.5);
    }

    // Dynamic Mouth
    switch (state) {
      case 'IDLE':
        ctx.fillStyle = '#881337';
        ctx.fillRect(56, 40, 5, 2.5);
        break;
      case 'ANALYZING':
        ctx.fillStyle = '#090d16';
        ctx.fillRect(55, 40, 6, 2.5);
        break;
      case 'ALERTING':
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(58, 40, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.arc(58, 40, 2.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'TRADING':
        ctx.fillStyle = '#047857';
        ctx.fillRect(55, 39, 7, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(56, 39, 5, 1.5);
        break;
      case 'SALUTING':
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(58, 39, 4, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(56, 39, 5, 2);
        break;
    }

    // Hairstyle
    this.drawEnlargedHair(ctx, palette, role);
  }

  private static drawEnlargedHair(
    ctx: CanvasRenderingContext2D,
    palette: CharacterPalette,
    role: AgentRole
  ): void {
    ctx.fillStyle = palette.hairDark;

    if (role === 'Patron') {
      // Slicked hair with silver streaks & beard
      ctx.fillRect(32, 14, 30, 14);
      ctx.fillRect(28, 18, 8, 18);
      ctx.fillStyle = palette.hairBase;
      ctx.fillRect(34, 15, 26, 11);
      // Silver streak
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(36, 17, 14, 3);
      // Trimmed goatee
      ctx.fillStyle = palette.hairDark;
      ctx.fillRect(56, 42, 6, 4);
    } else if (role === 'Sekreterya') {
      // Elegant top bun & side strands
      ctx.fillRect(32, 14, 30, 14);
      ctx.fillRect(28, 18, 8, 18);
      // Top bun
      ctx.fillRect(32, 9, 12, 10);
      ctx.fillStyle = palette.hairBase;
      ctx.fillRect(33, 10, 10, 8);
      ctx.fillStyle = palette.hairBase;
      ctx.fillRect(34, 15, 26, 11);
      // Gold hairpin
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(28, 11, 18, 2.5);
    } else if (role === 'Sinyal Avcısı') {
      // Anime spiky fuchsia hair
      ctx.fillRect(30, 12, 34, 16);
      ctx.fillRect(26, 16, 9, 18);
      ctx.fillStyle = palette.hairBase;
      ctx.fillRect(32, 14, 30, 12);
      // Spikes
      ctx.fillStyle = palette.hairLight;
      ctx.fillRect(30, 9, 7, 6);
      ctx.fillRect(42, 9, 7, 5);
      ctx.fillRect(54, 10, 6, 5);
    } else if (role === 'BTC Analisti') {
      // Tousled golden hair
      ctx.fillRect(30, 12, 32, 15);
      ctx.fillStyle = palette.hairBase;
      ctx.fillRect(32, 14, 28, 11);
      ctx.fillStyle = palette.hairLight;
      ctx.fillRect(34, 9, 9, 6);
      ctx.fillRect(46, 10, 8, 5);
    } else {
      // Standard clean side-part
      ctx.fillRect(32, 14, 32, 14);
      ctx.fillRect(28, 18, 8, 18);
      ctx.fillStyle = palette.hairBase;
      ctx.fillRect(34, 15, 28, 11);
      ctx.fillStyle = palette.hairLight;
      ctx.fillRect(38, 15, 18, 3);
    }
  }

  private static drawDesktopItems(
    ctx: CanvasRenderingContext2D,
    state: AgentState,
    isPatron: boolean
  ): void {
    const laptopColor = isPatron ? '#78350f' : '#1e293b';
    const glowColor = state === 'TRADING' ? '#10b981' : state === 'ALERTING' ? '#ef4444' : '#38bdf8';

    // A. Open Laptop Base on Desk (32x5)
    ctx.fillStyle = laptopColor;
    ctx.fillRect(66, 68, 24, 4);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(68, 68, 20, 1.5); // Keyboard well

    // B. Laptop Angled Screen (Subtle 3/4 diagonal, 26x20)
    ctx.fillStyle = laptopColor;
    ctx.beginPath();
    ctx.moveTo(82, 68);
    ctx.lineTo(92, 50);
    ctx.lineTo(96, 51);
    ctx.lineTo(86, 70);
    ctx.closePath();
    ctx.fill();

    // Glowing Display Screen
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(81, 67);
    ctx.lineTo(90, 51);
    ctx.lineTo(93, 52);
    ctx.lineTo(84, 69);
    ctx.closePath();
    ctx.fill();

    // Candlestick Charts / Terminal Output Lines on Screen
    ctx.fillStyle = glowColor;
    ctx.fillRect(83, 54, 6, 2);
    ctx.fillRect(81, 58, 8, 2);
    ctx.fillRect(79, 63, 6, 2);

    // C. Ceramic Coffee Mug (Large, with Steam)
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(104, 62, 9, 10, [1, 1, 3, 3]);
    ctx.fill();
    ctx.fillStyle = '#78350f';
    ctx.fillRect(105, 63, 7, 3); // Dark coffee

    // Rising Steam Wisps
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(106, 57, 2, 3);
    ctx.fillRect(109, 53, 2, 3);
  }

  private static drawArmsAndTypingHands(
    ctx: CanvasRenderingContext2D,
    palette: CharacterPalette,
    state: AgentState
  ): void {
    if (state === 'SALUTING') {
      // Right arm raised in crisp salute to forehead
      ctx.fillStyle = palette.jacketBase;
      ctx.fillRect(52, 26, 10, 20);
      ctx.fillStyle = palette.jacketLight;
      ctx.fillRect(52, 26, 10, 2.5);
      ctx.fillStyle = '#090d16';
      ctx.strokeRect(52, 26, 10, 20);

      ctx.fillStyle = palette.skinTone;
      ctx.fillRect(60, 24, 10, 9);
      ctx.fillStyle = '#090d16';
      ctx.strokeRect(60, 24, 10, 9);

      // Left hand on laptop
      ctx.fillStyle = palette.jacketDark;
      ctx.fillRect(40, 58, 24, 9);
      ctx.fillStyle = palette.skinTone;
      ctx.fillRect(62, 62, 10, 8);
    } else {
      // Both arms reaching forward, typing actively on the laptop keyboard
      // Left Arm (Back)
      ctx.fillStyle = palette.jacketDark;
      ctx.fillRect(40, 56, 26, 9);
      ctx.fillStyle = palette.skinShadow;
      ctx.fillRect(64, 60, 10, 8);

      // Right Arm (Front)
      ctx.fillStyle = palette.jacketBase;
      ctx.fillRect(42, 60, 28, 10);
      ctx.fillStyle = palette.jacketLight;
      ctx.fillRect(42, 60, 28, 2.5);
      ctx.fillStyle = '#090d16';
      ctx.strokeRect(42, 60, 28, 10);

      // Right Hand typing on keyboard
      ctx.fillStyle = palette.skinTone;
      ctx.fillRect(68, 62, 11, 9);
      ctx.fillStyle = '#090d16';
      ctx.strokeRect(68, 62, 11, 9);

      // Distinct finger lines
      ctx.fillStyle = '#090d16';
      ctx.fillRect(74, 65, 2, 5);
    }
  }

  private static drawRoleAccessories(
    ctx: CanvasRenderingContext2D,
    _palette: CharacterPalette,
    role: AgentRole
  ): void {
    // 1. Glasses / Spectacles
    if (['Risk Analisti', 'Makro Ekonomist', 'Portföy Muhasebecisi', 'Sekreterya', 'Teknik Analist'].includes(role)) {
      ctx.strokeStyle = role === 'Portföy Muhasebecisi' ? '#fbbf24' : '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(48, 25, 12, 11);
      // Earpiece arm going back to ear
      ctx.beginPath();
      ctx.moveTo(48, 29);
      ctx.lineTo(36, 28);
      ctx.stroke();
    }

    // 2. Headsets with Boom Mic
    if (['Binance İşlemci', 'Sinyal Avcısı', 'Whale Takipçisi'].includes(role)) {
      const earColor = role === 'Sinyal Avcısı' ? '#ec4899' : role === 'Binance İşlemci' ? '#f59e0b' : '#2dd4bf';
      // Headband
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(46, 24, 20, Math.PI, 0);
      ctx.stroke();
      // Earcup
      ctx.fillStyle = earColor;
      ctx.beginPath();
      ctx.ellipse(38, 32, 6, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#090d16';
      ctx.stroke();
      // Microphone boom
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(38, 36);
      ctx.lineTo(56, 42);
      ctx.stroke();
      ctx.fillStyle = earColor;
      ctx.fillRect(54, 41, 4, 4);
    }

    // 3. Press Badge / Pencil Behind Ear
    if (role === 'Haber Takip') {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(34, 22, 3.5, 12); // Pencil behind ear
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(46, 58, 9, 11); // Press badge
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(47, 59, 7, 4);
    }
  }

  private static drawStateEmote(ctx: CanvasRenderingContext2D, state: AgentState): void {
    if (state === 'ANALYZING') {
      // Rotating thought spark / cyan gear
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(88, 12, 7, 7);
      ctx.fillRect(87, 13, 9, 5);
    } else if (state === 'ALERTING') {
      // Red exclamation badge
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(90, 16, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(89, 12, 3, 6);
      ctx.fillRect(89, 20, 3, 2.5);
    } else if (state === 'TRADING') {
      // Golden lightning spark
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(90, 8);
      ctx.lineTo(84, 17);
      ctx.lineTo(90, 17);
      ctx.lineTo(87, 26);
      ctx.lineTo(95, 16);
      ctx.lineTo(90, 16);
      ctx.closePath();
      ctx.fill();
    }
  }

  private static getAgentPalette(role: AgentRole): CharacterPalette {
    const skinTone = '#fed7aa';
    const skinShadow = '#fba378';

    switch (role) {
      case 'Patron':
        return {
          skinTone,
          skinShadow,
          hairBase: '#64748b',
          hairDark: '#334155',
          hairLight: '#cbd5e1',
          jacketBase: '#1e3a8a',
          jacketDark: '#0f172a',
          jacketLight: '#3b82f6',
          tieColor: '#b91c1c',
          eyeColor: '#1e293b',
          trousersColor: '#1e293b',
          goldTrim: true,
        };
      case 'Sekreterya':
        return {
          skinTone,
          skinShadow,
          hairBase: '#78350f',
          hairDark: '#451a03',
          hairLight: '#92400e',
          jacketBase: '#334155',
          jacketDark: '#0f172a',
          jacketLight: '#64748b',
          tieColor: '#ec4899',
          eyeColor: '#1e3a8a',
          trousersColor: '#0f172a',
          goldTrim: true,
        };
      case 'Haber Takip':
        return {
          skinTone,
          skinShadow,
          hairBase: '#1e293b',
          hairDark: '#0f172a',
          hairLight: '#334155',
          jacketBase: '#2563eb',
          jacketDark: '#1d4ed8',
          jacketLight: '#60a5fa',
          tieColor: '#f59e0b',
          eyeColor: '#0284c7',
          trousersColor: '#1e293b',
        };
      case 'Binance İşlemci':
        return {
          skinTone,
          skinShadow,
          hairBase: '#1c1917',
          hairDark: '#09090b',
          hairLight: '#27272a',
          jacketBase: '#f59e0b',
          jacketDark: '#b45309',
          jacketLight: '#fde047',
          tieColor: '#09090b',
          eyeColor: '#f59e0b',
          trousersColor: '#18181b',
          goldTrim: true,
        };
      case 'Risk Analisti':
        return {
          skinTone,
          skinShadow,
          hairBase: '#334155',
          hairDark: '#0f172a',
          hairLight: '#475569',
          jacketBase: '#059669',
          jacketDark: '#064e3b',
          jacketLight: '#34d399',
          tieColor: '#065f46',
          eyeColor: '#059669',
          trousersColor: '#1e293b',
        };
      case 'Portföy Muhasebecisi':
        return {
          skinTone,
          skinShadow,
          hairBase: '#4c1d95',
          hairDark: '#2e1065',
          hairLight: '#6d28d9',
          jacketBase: '#7c3aed',
          jacketDark: '#4c1d95',
          jacketLight: '#a78bfa',
          tieColor: '#fbbf24',
          eyeColor: '#7c3aed',
          trousersColor: '#2e1065',
          goldTrim: true,
        };
      case 'Sinyal Avcısı':
        return {
          skinTone,
          skinShadow,
          hairBase: '#db2777',
          hairDark: '#831843',
          hairLight: '#f472b6',
          jacketBase: '#be185d',
          jacketDark: '#831843',
          jacketLight: '#f472b6',
          tieColor: '#0f172a',
          eyeColor: '#db2777',
          trousersColor: '#18181b',
        };
      case 'BTC Analisti':
        return {
          skinTone,
          skinShadow,
          hairBase: '#f59e0b',
          hairDark: '#78350f',
          hairLight: '#fde047',
          jacketBase: '#ea580c',
          jacketDark: '#9a3412',
          jacketLight: '#fb923c',
          tieColor: '#fbbf24',
          eyeColor: '#ea580c',
          trousersColor: '#1e293b',
          goldTrim: true,
        };
      case 'ETH Analisti':
        return {
          skinTone,
          skinShadow,
          hairBase: '#4338ca',
          hairDark: '#1e1b4b',
          hairLight: '#6366f1',
          jacketBase: '#4f46e5',
          jacketDark: '#312e81',
          jacketLight: '#818cf8',
          tieColor: '#c084fc',
          eyeColor: '#6366f1',
          trousersColor: '#1e1b4b',
        };
      case 'SOL Analisti':
        return {
          skinTone,
          skinShadow,
          hairBase: '#0d9488',
          hairDark: '#042f2e',
          hairLight: '#14b8a6',
          jacketBase: '#059669',
          jacketDark: '#064e3b',
          jacketLight: '#34d399',
          tieColor: '#a855f7',
          eyeColor: '#10b981',
          trousersColor: '#042f2e',
        };
      case 'Makro Ekonomist':
        return {
          skinTone,
          skinShadow,
          hairBase: '#94a3b8',
          hairDark: '#475569',
          hairLight: '#e2e8f0',
          jacketBase: '#78350f',
          jacketDark: '#451a03',
          jacketLight: '#92400e',
          tieColor: '#fbbf24',
          eyeColor: '#0f172a',
          trousersColor: '#451a03',
        };
      case 'Whale Takipçisi':
        return {
          skinTone,
          skinShadow,
          hairBase: '#0f766e',
          hairDark: '#134e4a',
          hairLight: '#2dd4bf',
          jacketBase: '#0e7490',
          jacketDark: '#155e75',
          jacketLight: '#38bdf8',
          tieColor: '#2dd4bf',
          eyeColor: '#0284c7',
          trousersColor: '#164e63',
        };
      case 'Düzenleyici İzleyici':
        return {
          skinTone,
          skinShadow,
          hairBase: '#18181b',
          hairDark: '#09090b',
          hairLight: '#3f3f46',
          jacketBase: '#334155',
          jacketDark: '#0f172a',
          jacketLight: '#64748b',
          tieColor: '#3b82f6',
          eyeColor: '#334155',
          trousersColor: '#0f172a',
        };
      case 'Teknik Analist':
        return {
          skinTone,
          skinShadow,
          hairBase: '#3730a3',
          hairDark: '#1e1b4b',
          hairLight: '#6366f1',
          jacketBase: '#4338ca',
          jacketDark: '#312e81',
          jacketLight: '#818cf8',
          tieColor: '#38bdf8',
          eyeColor: '#4f46e5',
          trousersColor: '#1e1b4b',
        };
      case 'Likidite Gözlemcisi':
      default:
        return {
          skinTone,
          skinShadow,
          hairBase: '#0284c7',
          hairDark: '#075985',
          hairLight: '#38bdf8',
          jacketBase: '#0891b2',
          jacketDark: '#155e75',
          jacketLight: '#67e8f9',
          tieColor: '#06b6d4',
          eyeColor: '#0891b2',
          trousersColor: '#0f172a',
        };
    }
  }
}

interface CharacterPalette {
  skinTone: string;
  skinShadow: string;
  hairBase: string;
  hairDark: string;
  hairLight: string;
  jacketBase: string;
  jacketDark: string;
  jacketLight: string;
  tieColor: string;
  eyeColor: string;
  trousersColor?: string;
  goldTrim?: boolean;
}
