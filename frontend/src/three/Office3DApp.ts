import * as THREE from 'three';
import { OfficeEnvironment } from './OfficeEnvironment.ts';
import { Character3D } from './Character3D.ts';
import { AgentBehaviorController } from './AgentBehaviorController.ts';
import { AGENT_CONFIGS } from '../config.ts';
import { wsService } from '../services/websocket.ts';
import { SceneSeverityPayload } from '../types/events.ts';

export class Office3DApp {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;

  // Environment & Controllers
  private environment: OfficeEnvironment;
  private behaviorController: AgentBehaviorController;

  // Lighting
  private ambientLight!: THREE.AmbientLight;
  private dirLight!: THREE.DirectionalLight;
  private coffeeLight!: THREE.PointLight;
  private targetAmbientColor = new THREE.Color(0x38bdf8);

  // Camera Navigation & Orbit Controls
  private targetCameraPos = new THREE.Vector3(0, 21, 23);
  private targetLookAt = new THREE.Vector3(0, 1, 1);
  private currentLookAt = new THREE.Vector3(0, 1, 1);
  private isDragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private spherical = { radius: 31, theta: 0, phi: Math.PI / 4 };

  // Raycaster for interactive clicks
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  constructor(containerId: string = 'game-container') {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060913); // Deep night cyberpunk slate
    this.scene.fog = new THREE.FogExp2(0x060913, 0.018);

    const w = this.container.clientWidth || 960;
    const h = this.container.clientHeight || 640;

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 1000);
    this.camera.position.copy(this.targetCameraPos);
    this.camera.lookAt(this.targetLookAt);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Clear previous elements if any
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    // 1. Setup Lighting
    this.setupLighting();

    // 2. Build Office 3D Architecture
    this.environment = new OfficeEnvironment();
    this.scene.add(this.environment.group);

    // 3. Initialize Agent Behavior Controller
    this.behaviorController = new AgentBehaviorController(this.environment);

    // 4. Spawn 3D Agents
    this.spawnAgents();

    // 5. Build Floating UI HUD (Room quick focus & break buttons)
    this.buildHUDOverlay();

    // 6. Setup Interaction & Resize Events
    this.setupEventListeners();

    // 7. Subscribe to Severity Light Updates
    this.subscribeToSeverity();

    // 8. Start Render Loop
    this.animate();

    console.log('✨ 3D Three.js Trading Office Visualizer initialized successfully.');
  }

  private setupLighting(): void {
    // 1. Ambient Light
    this.ambientLight = new THREE.AmbientLight(0x94a3b8, 0.9);
    this.scene.add(this.ambientLight);

    // 2. Key Directional Sun/Ceiling Light with Shadows
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.dirLight.position.set(15, 25, 15);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 70;
    this.dirLight.shadow.camera.left = -20;
    this.dirLight.shadow.camera.right = 20;
    this.dirLight.shadow.camera.top = 20;
    this.dirLight.shadow.camera.bottom = -20;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // 3. Point Light over Coffee Bar (Warm Amber)
    this.coffeeLight = new THREE.PointLight(0xf59e0b, 1.4, 8);
    this.coffeeLight.position.set(0, 2.5, -2.5);
    this.scene.add(this.coffeeLight);

    // 4. Point Light over Trading Floor (Cyber Blue)
    const traderLight = new THREE.PointLight(0x38bdf8, 1.2, 12);
    traderLight.position.set(-7.5, 3.0, 5.5);
    this.scene.add(traderLight);

    // 5. Point Light over Balcony (Cool White Skyline Glow)
    const balconyLight = new THREE.PointLight(0xe2e8f0, 0.9, 10);
    balconyLight.position.set(0, 2.5, 11);
    this.scene.add(balconyLight);
  }

  private spawnAgents(): void {
    AGENT_CONFIGS.forEach((config) => {
      const slot = this.environment.deskSlots.get(config.role);
      const deskPos = slot ? slot.position : new THREE.Vector3(0, 0, 0);
      const deskRot = slot ? slot.rotationY : 0;

      const character = new Character3D(config, deskPos, deskRot);
      this.behaviorController.registerCharacter(config.role, character);
      this.scene.add(character.group);
    });
  }

  private buildHUDOverlay(): void {
    // Top Bar HUD Overlay
    const hud = document.createElement('div');
    hud.className = 'three-hud-container';
    hud.innerHTML = `
      <div class="hud-room-bar">
        <button class="hud-btn active" data-room="all">🏢 Tüm Ofis</button>
        <button class="hud-btn" data-room="management">🎩 Yönetim</button>
        <button class="hud-btn" data-room="trading">🤖 İşlem & Risk</button>
        <button class="hud-btn" data-room="news">📰 Haber Odası</button>
        <button class="hud-btn" data-room="signals">⚡ Sinyal Odası</button>
        <button class="hud-btn" data-room="coffee">☕ Kahve Barı</button>
        <button class="hud-btn" data-room="balcony">🚬 Balkon</button>
      </div>
      <div class="hud-info-tag">
        <span>💡 <b>İpucu:</b> Karakterlere tıklayarak konuşabilir, fareyle ofisi 360° çevirebilirsiniz.</span>
      </div>
    `;

    this.container.style.position = 'relative';
    this.container.appendChild(hud);

    // Bind Room Focus buttons
    hud.querySelectorAll('.hud-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        hud.querySelectorAll('.hud-btn').forEach((b) => b.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');
        const room = (e.currentTarget as HTMLElement).dataset.room;
        this.focusOnRoom(room || 'all');
      });
    });
  }

  public focusOnRoom(roomKey: string): void {
    switch (roomKey) {
      case 'management':
        this.targetCameraPos.set(-7.5, 9, 2);
        this.targetLookAt.set(-7.5, 1, -5.5);
        break;
      case 'trading':
        this.targetCameraPos.set(-7.5, 10, 13);
        this.targetLookAt.set(-7.5, 1, 5.5);
        break;
      case 'news':
        this.targetCameraPos.set(7.5, 9, 2);
        this.targetLookAt.set(7.5, 1, -5.5);
        break;
      case 'signals':
        this.targetCameraPos.set(7.5, 10, 13);
        this.targetLookAt.set(7.5, 1, 5.5);
        break;
      case 'coffee':
        this.targetCameraPos.set(0, 6, 3);
        this.targetLookAt.set(0, 1, -2.5);
        break;
      case 'balcony':
        this.targetCameraPos.set(0, 6, 17);
        this.targetLookAt.set(0, 1, 11);
        break;
      case 'all':
      default:
        this.targetCameraPos.set(0, 21, 23);
        this.targetLookAt.set(0, 1, 1);
        break;
    }
  }

  private setupEventListeners(): void {
    const dom = this.renderer.domElement;

    // 1. Mouse Drag Orbit Controls
    dom.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    dom.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;

      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      // Orbit camera rotation
      this.spherical.theta -= deltaX * 0.005;
      this.spherical.phi = Math.max(0.2, Math.min(Math.PI / 2.2, this.spherical.phi - deltaY * 0.005));

      this.updateCameraFromSpherical();
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    // 2. Mouse Wheel Zoom
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.spherical.radius = Math.max(10, Math.min(50, this.spherical.radius + e.deltaY * 0.03));
      this.updateCameraFromSpherical();
    }, { passive: false });

    // 3. Raycast Click on Characters
    dom.addEventListener('click', (e) => {
      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const allChars = this.behaviorController.getAllCharacters();

      for (const char of allChars) {
        const intersects = this.raycaster.intersectObjects(char.group.children, true);
        if (intersects.length > 0) {
          // Interactive Click on Agent!
          const wittyQuotes = [
            'Grafikler çok hareketli, gözümü ekrandan ayırmıyorum!',
            'Binance Testnet emirleri saniyeler içinde geçiyor.',
            'Kaldıraç oranlarını risk modelimize göre ayarlıyoruz.',
            'Kahvemi tazeledim, analize devam ediyorum ☕',
          ];
          const q = wittyQuotes[Math.floor(Math.random() * wittyQuotes.length)];
          char.say(q, 4500, '#38bdf8');
          break;
        }
      }
    });

    // 4. Window Resize Observer
    window.addEventListener('resize', () => this.onResize());
  }

  private updateCameraFromSpherical(): void {
    const x = this.spherical.radius * Math.sin(this.spherical.phi) * Math.sin(this.spherical.theta);
    const y = this.spherical.radius * Math.cos(this.spherical.phi);
    const z = this.spherical.radius * Math.sin(this.spherical.phi) * Math.cos(this.spherical.theta);

    this.targetCameraPos.set(this.targetLookAt.x + x, y, this.targetLookAt.z + z);
  }

  private subscribeToSeverity(): void {
    wsService.on<SceneSeverityPayload>('SCENE_SEVERITY_UPDATE', (sev: SceneSeverityPayload) => {
      switch (sev.severityLabel) {
        case 'KATASTROFİK':
        case 'ÇOK AĞIR':
          this.targetAmbientColor.setHex(0xef4444); // Red Alarm
          break;
        case 'AĞIR':
        case 'ORTA':
          this.targetAmbientColor.setHex(0xf59e0b); // Amber Warning
          break;
        case 'HAFİF':
        default:
          this.targetAmbientColor.setHex(0x10b981); // Green Peaceful
          break;
      }
    });
  }

  private onResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);

    // Smoothly Lerp Camera & LookAt
    this.camera.position.lerp(this.targetCameraPos, delta * 4);
    this.currentLookAt.lerp(this.targetLookAt, delta * 4);
    this.camera.lookAt(this.currentLookAt);

    // Smoothly shift ambient light color
    this.ambientLight.color.lerp(this.targetAmbientColor, delta * 2);

    // Update 3D Subsystems
    this.environment.update(delta);
    this.behaviorController.update(delta);

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  };
}
