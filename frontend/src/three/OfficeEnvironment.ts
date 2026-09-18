import * as THREE from 'three';

export interface DeskSlot {
  role: string;
  position: THREE.Vector3;
  rotationY: number;
}

export class OfficeEnvironment {
  public group: THREE.Group;
  public deskSlots: Map<string, DeskSlot> = new Map();
  public coffeeMachinePos = new THREE.Vector3(0, 0, -2.5);
  public waterCoolerPos = new THREE.Vector3(-2.8, 0, -2.5);
  public balconySpots: THREE.Vector3[] = [
    new THREE.Vector3(-2.5, 0, 10.5),
    new THREE.Vector3(0, 0, 10.5),
    new THREE.Vector3(2.5, 0, 10.5),
  ];
  public loungeSpots: THREE.Vector3[] = [
    new THREE.Vector3(2.8, 0, -2.5),
    new THREE.Vector3(3.6, 0, -2.5),
  ];

  // Blinking Server LEDs
  private serverLeds: THREE.MeshBasicMaterial[] = [];
  private chartMonitors: THREE.MeshBasicMaterial[] = [];
  private animTimer: number = 0;

  constructor() {
    this.group = new THREE.Group();
    this.buildFloorsAndWalls();
    this.buildCoffeeAndBreakArea();
    this.buildSmokingBalcony();
    this.buildManagementRoom();
    this.buildNewsRoom();
    this.buildTradingAndRiskRoom();
    this.buildSignalsAndPortfolioRoom();
    this.buildDecorations();
  }

  private buildFloorsAndWalls(): void {
    // 1. Main Indoor Floor (Polished wood/parquet aesthetic)
    const floorGeo = new THREE.BoxGeometry(28, 0.4, 20);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Modern dark slate parquet
      roughness: 0.3,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.2, 0);
    floor.receiveShadow = true;
    this.group.add(floor);

    // Floor accent tiles for rooms
    const tileGeo = new THREE.BoxGeometry(11, 0.42, 8.5);
    const tileMatA = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const tileMatB = new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.4 });

    const tile1 = new THREE.Mesh(tileGeo, tileMatA);
    tile1.position.set(-7.5, -0.19, -5.5);
    tile1.receiveShadow = true;
    const tile2 = new THREE.Mesh(tileGeo, tileMatB);
    tile2.position.set(7.5, -0.19, -5.5);
    tile2.receiveShadow = true;
    const tile3 = new THREE.Mesh(tileGeo, tileMatB);
    tile3.position.set(-7.5, -0.19, 5.5);
    tile3.receiveShadow = true;
    const tile4 = new THREE.Mesh(tileGeo, tileMatA);
    tile4.position.set(7.5, -0.19, 5.5);
    tile4.receiveShadow = true;
    this.group.add(tile1, tile2, tile3, tile4);

    // 2. Glass Partitions (Modern tinted glass with metal frames)
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.25,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.7,
      thickness: 0.5,
    });

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.8 });

    // Room divider walls
    this.createGlassWall(-7.5, -1.25, 11, 2.8, 0, frameMat, glassMat);
    this.createGlassWall(7.5, -1.25, 11, 2.8, 0, frameMat, glassMat);
    this.createGlassWall(-7.5, 1.25, 11, 2.8, 0, frameMat, glassMat);
    this.createGlassWall(7.5, 1.25, 11, 2.8, 0, frameMat, glassMat);

    this.createGlassWall(-1.8, -5.5, 8.5, 2.8, Math.PI / 2, frameMat, glassMat);
    this.createGlassWall(1.8, -5.5, 8.5, 2.8, Math.PI / 2, frameMat, glassMat);
    this.createGlassWall(-1.8, 5.5, 8.5, 2.8, Math.PI / 2, frameMat, glassMat);
    this.createGlassWall(1.8, 5.5, 8.5, 2.8, Math.PI / 2, frameMat, glassMat);

    // Perimeter Back Wall
    const backWallGeo = new THREE.BoxGeometry(28, 3.5, 0.4);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.8 });
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, 1.5, -10.2);
    backWall.receiveShadow = true;
    this.group.add(backWall);
  }

  private createGlassWall(
    x: number,
    z: number,
    length: number,
    height: number,
    rotY: number,
    frameMat: THREE.Material,
    glassMat: THREE.Material
  ): void {
    const wallGroup = new THREE.Group();
    wallGroup.position.set(x, height / 2, z);
    wallGroup.rotation.y = rotY;

    // Glass panel
    const glass = new THREE.Mesh(new THREE.BoxGeometry(length, height - 0.2, 0.08), glassMat);
    wallGroup.add(glass);

    // Bottom and top frames
    const bFrame = new THREE.Mesh(new THREE.BoxGeometry(length, 0.12, 0.14), frameMat);
    bFrame.position.y = -height / 2 + 0.06;
    const tFrame = new THREE.Mesh(new THREE.BoxGeometry(length, 0.12, 0.14), frameMat);
    tFrame.position.y = height / 2 - 0.06;
    wallGroup.add(bFrame, tFrame);

    this.group.add(wallGroup);
  }

  private buildCoffeeAndBreakArea(): void {
    const breakGroup = new THREE.Group();
    breakGroup.position.set(0, 0, -2.5);

    // 1. Coffee Bar Counter (L-Shape / Modern Wood Countertop)
    const counterMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4 });
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });

    const counterBase = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.9), baseMat);
    counterBase.position.y = 0.45;
    counterBase.castShadow = true;
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.05), counterMat);
    counterTop.position.y = 0.95;
    counterTop.castShadow = true;
    breakGroup.add(counterBase, counterTop);

    // 2. High-End Espresso Machine
    const machineMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });

    const machineBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.5), machineMat);
    machineBody.position.set(-0.5, 1.3, 0);
    const steamWand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3), chromeMat);
    steamWand.position.set(-0.25, 1.2, 0.2);
    steamWand.rotation.z = -0.3;
    const coffeeCups = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 8), chromeMat);
    coffeeCups.position.set(0.3, 1.06, 0.1);
    breakGroup.add(machineBody, steamWand, coffeeCups);

    // Sign above Coffee Bar: "☕ MOLA & KAHVE KÖŞESİ"
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 256;
    signCanvas.height = 64;
    const sCtx = signCanvas.getContext('2d')!;
    sCtx.fillStyle = '#0f172a';
    sCtx.fillRect(0, 0, 256, 64);
    sCtx.strokeStyle = '#f59e0b';
    sCtx.lineWidth = 4;
    sCtx.strokeRect(2, 2, 252, 60);
    sCtx.fillStyle = '#fbbf24';
    sCtx.font = 'bold 22px system-ui';
    sCtx.fillText('☕ KAHVE & MOLA', 24, 40);

    const signTex = new THREE.CanvasTexture(signCanvas);
    const signMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.45, 0.05),
      new THREE.MeshBasicMaterial({ map: signTex })
    );
    signMesh.position.set(0, 2.3, -0.4);
    breakGroup.add(signMesh);

    // 3. Water Cooler Dispenser
    const waterCoolerGroup = new THREE.Group();
    waterCoolerGroup.position.set(-2.8, 0, 0);

    const coolerBase = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.9, 0.45), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
    coolerBase.position.y = 0.45;
    const blueBottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.55, 16),
      new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6, roughness: 0.1 })
    );
    blueBottle.position.y = 1.15;
    waterCoolerGroup.add(coolerBase, blueBottle);
    breakGroup.add(waterCoolerGroup);

    // 4. Comfortable Lounge Sofa
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.8 });
    const sofaSeat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.7), sofaMat);
    sofaSeat.position.set(3.2, 0.2, 0);
    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 0.25), sofaMat);
    sofaBack.position.set(3.2, 0.5, -0.3);
    breakGroup.add(sofaSeat, sofaBack);

    this.group.add(breakGroup);
  }

  private buildSmokingBalcony(): void {
    const balconyGroup = new THREE.Group();
    balconyGroup.position.set(0, 0, 11);

    // 1. Balcony Wood Deck
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.35, 3.5), deckMat);
    deck.position.y = -0.2;
    deck.receiveShadow = true;
    balconyGroup.add(deck);

    // 2. Glass Railing
    const railMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.2 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.35, roughness: 0.1 });

    // Front Rail
    const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 0.05), glassMat);
    frontGlass.position.set(0, 0.6, 1.7);
    const frontTopBar = new THREE.Mesh(new THREE.BoxGeometry(10, 0.08, 0.12), railMat);
    frontTopBar.position.set(0, 1.2, 1.7);
    balconyGroup.add(frontGlass, frontTopBar);

    // Side Rails
    const leftGlass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 3.5), glassMat);
    leftGlass.position.set(-5, 0.6, 0);
    const rightGlass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 3.5), glassMat);
    rightGlass.position.set(5, 0.6, 0);
    balconyGroup.add(leftGlass, rightGlass);

    // 3. Standing Ashtray / Cigarette Bin
    const ashtrayMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    const ashtrayBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.9, 12), ashtrayMat);
    ashtrayBase.position.set(-1.8, 0.45, 0.8);
    const ashtrayTop = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.15, 0.15, 12), ashtrayMat);
    ashtrayTop.position.set(-1.8, 0.95, 0.8);
    balconyGroup.add(ashtrayBase, ashtrayTop);

    // Sign on Balcony: "🚬 SİGARA & TEMİZ HAVA ALANI"
    const bSignCanvas = document.createElement('canvas');
    bSignCanvas.width = 256;
    bSignCanvas.height = 64;
    const bCtx = bSignCanvas.getContext('2d')!;
    bCtx.fillStyle = '#0f172a';
    bCtx.fillRect(0, 0, 256, 64);
    bCtx.strokeStyle = '#94a3b8';
    bCtx.lineWidth = 4;
    bCtx.strokeRect(2, 2, 252, 60);
    bCtx.fillStyle = '#f8fafc';
    bCtx.font = 'bold 20px system-ui';
    bCtx.fillText('🚬 BALKON & SİGARA', 18, 40);

    const bSignMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.4, 0.05),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bSignCanvas) })
    );
    bSignMesh.position.set(0, 1.8, -0.2);
    balconyGroup.add(bSignMesh);

    this.group.add(balconyGroup);
  }

  private buildManagementRoom(): void {
    const room = new THREE.Group();
    room.position.set(-7.5, 0, -5.5);

    // Patron Luxury Desk
    this.createTradingDesk(room, 0, 0, Math.PI, 0x78350f, 'Patron', true);
    this.deskSlots.set('Patron', { role: 'Patron', position: new THREE.Vector3(-7.5, 0, -6.05), rotationY: 0 });

    // Sekreterya Desk
    this.createTradingDesk(room, -3.2, 0, Math.PI, 0x475569, 'Sekreterya', false);
    this.deskSlots.set('Sekreterya', { role: 'Sekreterya', position: new THREE.Vector3(-10.7, 0, -6.05), rotationY: 0 });

    // Golden Trophy on shelf
    const trophyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.1 });
    const trophy = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.35, 8), trophyMat);
    trophy.position.set(2.5, 1.4, -3.8);
    room.add(trophy);

    this.group.add(room);
  }

  private buildNewsRoom(): void {
    const room = new THREE.Group();
    room.position.set(7.5, 0, -5.5);

    // 3 News Desks
    this.createTradingDesk(room, -2.8, 0, Math.PI, 0x334155, 'Haber Takip', false);
    this.deskSlots.set('Haber Takip', { role: 'Haber Takip', position: new THREE.Vector3(4.7, 0, -6.05), rotationY: 0 });

    this.createTradingDesk(room, 0, 0, Math.PI, 0x334155, 'Makro Ekonomist', false);
    this.deskSlots.set('Makro Ekonomist', { role: 'Makro Ekonomist', position: new THREE.Vector3(7.5, 0, -6.05), rotationY: 0 });

    this.createTradingDesk(room, 2.8, 0, Math.PI, 0x334155, 'Düzenleyici İzleyici', false);
    this.deskSlots.set('Düzenleyici İzleyici', { role: 'Düzenleyici İzleyici', position: new THREE.Vector3(10.3, 0, -6.05), rotationY: 0 });

    // News Ticker Wall Screen
    const tickerCanvas = document.createElement('canvas');
    tickerCanvas.width = 512;
    tickerCanvas.height = 96;
    const tCtx = tickerCanvas.getContext('2d')!;
    tCtx.fillStyle = '#020617';
    tCtx.fillRect(0, 0, 512, 96);
    tCtx.fillStyle = '#38bdf8';
    tCtx.font = 'bold 24px monospace';
    tCtx.fillText('📰 CANLI HABER RADARI: FED & SEC', 20, 42);
    tCtx.fillStyle = '#10b981';
    tCtx.font = '18px monospace';
    tCtx.fillText('BTC ETF +%4.2 | BLOOMBERG TERMINAL ON', 20, 75);

    const tickerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.8, 0.08),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(tickerCanvas) })
    );
    tickerMesh.position.set(0, 2.3, -3.9);
    room.add(tickerMesh);

    this.group.add(room);
  }

  private buildTradingAndRiskRoom(): void {
    const room = new THREE.Group();
    room.position.set(-7.5, 0, 5.5);

    // Binance İşlemci (Dual Monitor Pro Desk)
    this.createTradingDesk(room, -2.8, 0, 0, 0x1e293b, 'Binance İşlemci', true);
    this.deskSlots.set('Binance İşlemci', { role: 'Binance İşlemci', position: new THREE.Vector3(-10.3, 0, 6.05), rotationY: Math.PI });

    // Likidite Gözlemcisi
    this.createTradingDesk(room, 0, 0, 0, 0x1e293b, 'Likidite Gözlemcisi', false);
    this.deskSlots.set('Likidite Gözlemcisi', { role: 'Likidite Gözlemcisi', position: new THREE.Vector3(-7.5, 0, 6.05), rotationY: Math.PI });

    // Risk Analisti
    this.createTradingDesk(room, 2.8, 0, 0, 0x1e293b, 'Risk Analisti', false);
    this.deskSlots.set('Risk Analisti', { role: 'Risk Analisti', position: new THREE.Vector3(-4.7, 0, 6.05), rotationY: Math.PI });

    // Whale Takipçisi
    this.createTradingDesk(room, -2.8, 2.8, 0, 0x1e293b, 'Whale Takipçisi', false);
    this.deskSlots.set('Whale Takipçisi', { role: 'Whale Takipçisi', position: new THREE.Vector3(-10.3, 0, 8.85), rotationY: Math.PI });

    // Server Rack with Blinking LEDs
    const serverRack = this.createServerRack();
    serverRack.position.set(4.2, 0, 2.5);
    room.add(serverRack);

    this.group.add(room);
  }

  private buildSignalsAndPortfolioRoom(): void {
    const room = new THREE.Group();
    room.position.set(7.5, 0, 5.5);

    // Sinyal Avcısı (Ali)
    this.createTradingDesk(room, -2.8, 0, 0, 0x831843, 'Sinyal Avcısı', true);
    this.deskSlots.set('Sinyal Avcısı', { role: 'Sinyal Avcısı', position: new THREE.Vector3(4.7, 0, 6.05), rotationY: Math.PI });

    // Teknik Analist
    this.createTradingDesk(room, 0, 0, 0, 0x1e1b4b, 'Teknik Analist', false);
    this.deskSlots.set('Teknik Analist', { role: 'Teknik Analist', position: new THREE.Vector3(7.5, 0, 6.05), rotationY: Math.PI });

    // Portföy Muhasebecisi
    this.createTradingDesk(room, 2.8, 0, 0, 0x4c1d95, 'Portföy Muhasebecisi', false);
    this.deskSlots.set('Portföy Muhasebecisi', { role: 'Portföy Muhasebecisi', position: new THREE.Vector3(10.3, 0, 6.05), rotationY: Math.PI });

    this.group.add(room);
  }

  private createTradingDesk(
    parent: THREE.Group,
    x: number,
    z: number,
    rotY: number,
    deskColor: number,
    _label: string,
    isDualMonitor: boolean = false
  ): void {
    const deskGroup = new THREE.Group();
    deskGroup.position.set(x, 0, z);
    deskGroup.rotation.y = rotY;

    // Desk Tabletop
    const topMat = new THREE.MeshStandardMaterial({ color: deskColor, roughness: 0.5 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.9), topMat);
    top.position.y = 0.72;
    top.castShadow = true;
    top.receiveShadow = true;

    // Legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.8), legMat);
    leg1.position.set(-0.74, 0.36, 0);
    const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.8), legMat);
    leg2.position.set(0.74, 0.36, 0);
    deskGroup.add(top, leg1, leg2);

    // Ergonomic Swivel Chair
    const chairGroup = new THREE.Group();
    chairGroup.position.set(0, 0, 0.55);

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.4 });
    const starBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 6), baseMat);
    starBase.position.y = 0.04;
    starBase.castShadow = true;

    const stemMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.38, 8), stemMat);
    stem.position.y = 0.22;

    const seatMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.08, 0.50), seatMat);
    chairSeat.position.y = 0.44;
    chairSeat.castShadow = true;

    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.55, 0.08), seatMat);
    chairBack.position.set(0, 0.76, 0.24);
    chairBack.castShadow = true;

    const armrestGeo = new THREE.BoxGeometry(0.06, 0.24, 0.34);
    const leftArmrest = new THREE.Mesh(armrestGeo, baseMat);
    leftArmrest.position.set(-0.28, 0.58, 0.02);
    const rightArmrest = new THREE.Mesh(armrestGeo, baseMat);
    rightArmrest.position.set(0.28, 0.58, 0.02);

    chairGroup.add(starBase, stem, chairSeat, chairBack, leftArmrest, rightArmrest);
    deskGroup.add(chairGroup);

    // Computer Monitors with Glowing Candlestick Chart Texture
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    this.chartMonitors.push(screenMat);

    const monitorBezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.42, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x020617, metalness: 0.9 })
    );
    monitorBezel.position.set(0, 1.05, -0.2);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.37, 0.02), screenMat);
    screen.position.set(0, 1.05, -0.17);
    deskGroup.add(monitorBezel, screen);

    if (isDualMonitor) {
      const screenMat2 = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      this.chartMonitors.push(screenMat2);

      const monitor2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.42, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x020617, metalness: 0.9 })
      );
      monitor2.position.set(0.55, 1.05, -0.15);
      monitor2.rotation.y = -0.3;
      const screen2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.37, 0.02), screenMat2);
      screen2.position.set(0.55, 1.05, -0.12);
      screen2.rotation.y = -0.3;
      deskGroup.add(monitor2, screen2);
    }

    // Keyboard & Mouse
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 0.18), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    kb.position.set(0, 0.77, 0.15);
    const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.12), new THREE.MeshStandardMaterial({ color: 0x475569 }));
    mouse.position.set(0.35, 0.77, 0.15);
    deskGroup.add(kb, mouse);

    parent.add(deskGroup);
  }

  private createServerRack(): THREE.Group {
    const rack = new THREE.Group();
    const rackBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 2.2, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.9, roughness: 0.2 })
    );
    rackBody.position.y = 1.1;
    rack.add(rackBody);

    // Blinking LEDs
    for (let i = 0; i < 6; i++) {
      const ledMat = new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x10b981 : 0x38bdf8 });
      this.serverLeds.push(ledMat);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.02), ledMat);
      led.position.set(-0.25 + (i % 3) * 0.25, 0.6 + Math.floor(i / 3) * 0.6, 0.41);
      rack.add(led);
    }
    return rack;
  }

  private buildDecorations(): void {
    // Potted Green Plants in office corners
    const plantCoords = [
      [-13, -9],
      [13, -9],
      [-13, 9],
      [13, 9],
      [-2.5, -9],
      [2.5, -9],
    ];

    const potMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });

    plantCoords.forEach(([px, pz]) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.6, 12), potMat);
      pot.position.set(px, 0.3, pz);
      pot.castShadow = true;

      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 1), leafMat);
      bush.position.set(px, 0.75, pz);
      bush.castShadow = true;
      this.group.add(pot, bush);
    });
  }

  public update(delta: number): void {
    this.animTimer += delta * 4;

    // Pulse blinking LEDs on server rack
    this.serverLeds.forEach((led, idx) => {
      const blink = Math.sin(this.animTimer * (3 + idx)) > 0;
      led.color.setHex(blink ? (idx % 2 === 0 ? 0x10b981 : 0x06b6d4) : 0x064e3b);
    });
  }
}
