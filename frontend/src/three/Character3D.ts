import * as THREE from 'three';
import { AgentVisualConfig } from '../config.ts';

export type AgentState =
  | 'WORKING'
  | 'WALKING'
  | 'DRINKING_COFFEE'
  | 'SMOKING'
  | 'DRINKING_WATER'
  | 'CHATTING'
  | 'ALERT';

export interface Waypoint {
  x: number;
  z: number;
  name?: string;
}

export class Character3D {
  public group: THREE.Group;
  public role: string;
  public name: string;
  public config: AgentVisualConfig;
  public currentState: AgentState = 'WORKING';

  // Desk Home Position & Rotation
  public deskPosition: THREE.Vector3;
  public deskRotationY: number;

  // Pathfinding / Navigation
  private path: THREE.Vector3[] = [];
  private currentPathIndex: number = 0;
  private moveSpeed: number = 3.5;
  private onPathComplete: (() => void) | null = null;

  // Hierarchical Body Parts
  private bodyMesh!: THREE.Mesh;
  private headGroup!: THREE.Group;
  private leftArmPivot!: THREE.Group;
  private rightArmPivot!: THREE.Group;
  private leftThighPivot!: THREE.Group;
  private leftKneePivot!: THREE.Group;
  private rightThighPivot!: THREE.Group;
  private rightKneePivot!: THREE.Group;

  // Props
  private coffeeMugMesh!: THREE.Mesh;
  private cigaretteMesh!: THREE.Mesh;
  private cigaretteGlowMesh!: THREE.Mesh;
  private smokeParticles!: THREE.Points;
  private smokeGeometry!: THREE.BufferGeometry;
  private smokePositions!: Float32Array;

  // 3D Speech Bubble & Status Label
  private speechSprite!: THREE.Sprite;
  private speechCanvas!: HTMLCanvasElement;
  private speechCtx!: CanvasRenderingContext2D;
  private speechTexture!: THREE.CanvasTexture;
  private speechTimer: any = null;

  // Animation Timers
  private animTime: number = Math.random() * 10;
  private isAlerted: boolean = false;

  constructor(config: AgentVisualConfig, deskPos: THREE.Vector3, deskRotY: number = 0) {
    this.config = config;
    this.role = config.role;
    this.name = config.name;
    this.deskPosition = deskPos.clone();
    this.deskRotationY = deskRotY;

    this.group = new THREE.Group();
    this.group.position.copy(deskPos);
    this.group.rotation.y = deskRotY;

    this.buildCharacterMesh();
    this.buildProps();
    this.buildSpeechSprite();

    // Start in working pose
    this.setWorkingPose();
  }

  private buildCharacterMesh(): void {
    // Shared Materials
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd1a4,
      roughness: 0.6,
      metalness: 0.1,
    });

    const shirtMaterial = new THREE.MeshStandardMaterial({
      color: this.config.shirtColor,
      roughness: 0.7,
      metalness: 0.1,
    });

    const pantsMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Dark navy trousers
      roughness: 0.8,
    });

    const hairMaterial = new THREE.MeshStandardMaterial({
      color: this.config.hairColor,
      roughness: 0.9,
    });

    const shoeMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.5,
    });

    // 1. Torso (Body)
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.65, 0.35);
    this.bodyMesh = new THREE.Mesh(torsoGeo, shirtMaterial);
    this.bodyMesh.position.y = 0.95;
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.group.add(this.bodyMesh);

    // Tie or Badge Detail for Patron / Manager
    if (this.role === 'Patron') {
      const tieGeo = new THREE.BoxGeometry(0.12, 0.4, 0.04);
      const tieMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 });
      const tie = new THREE.Mesh(tieGeo, tieMat);
      tie.position.set(0, -0.05, 0.18);
      this.bodyMesh.add(tie);
    } else if (this.role.includes('Analist') || this.role.includes('İşlemci')) {
      // ID Badge
      const badgeGeo = new THREE.BoxGeometry(0.1, 0.14, 0.03);
      const badgeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 });
      const badge = new THREE.Mesh(badgeGeo, badgeMat);
      badge.position.set(0.16, 0.1, 0.18);
      this.bodyMesh.add(badge);
    }

    // 2. Head Group (Head + Hair + Face Features)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.52, 0);

    // Head
    const headGeo = new THREE.BoxGeometry(0.42, 0.44, 0.4);
    const headMesh = new THREE.Mesh(headGeo, skinMaterial);
    headMesh.castShadow = true;
    this.headGroup.add(headMesh);

    // Hair
    const hairGeo = new THREE.BoxGeometry(0.46, 0.18, 0.44);
    const hairMesh = new THREE.Mesh(hairGeo, hairMaterial);
    hairMesh.position.y = 0.2;
    this.headGroup.add(hairMesh);

    // Glasses for certain roles
    if (this.role.includes('Makro') || this.role.includes('Muhasebeci') || this.role.includes('Risk')) {
      const glassGeo = new THREE.BoxGeometry(0.34, 0.08, 0.04);
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.8 });
      const glasses = new THREE.Mesh(glassGeo, glassMat);
      glasses.position.set(0, 0.04, 0.21);
      this.headGroup.add(glasses);
    }

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.02);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.1, 0.04, 0.21);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.1, 0.04, 0.21);
    this.headGroup.add(leftEye, rightEye);

    this.bodyMesh.add(this.headGroup);

    // 3. Arms with Shoulder Pivots
    const armGeo = new THREE.BoxGeometry(0.16, 0.55, 0.16);
    const handGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);

    // Left Arm
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.35, 0.25, 0);
    const leftArmMesh = new THREE.Mesh(armGeo, shirtMaterial);
    leftArmMesh.position.y = -0.25;
    leftArmMesh.castShadow = true;
    const leftHand = new THREE.Mesh(handGeo, skinMaterial);
    leftHand.position.y = -0.55;
    this.leftArmPivot.add(leftArmMesh, leftHand);
    this.bodyMesh.add(this.leftArmPivot);

    // Right Arm
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.35, 0.25, 0);
    const rightArmMesh = new THREE.Mesh(armGeo, shirtMaterial);
    rightArmMesh.position.y = -0.25;
    rightArmMesh.castShadow = true;
    const rightHand = new THREE.Mesh(handGeo, skinMaterial);
    rightHand.position.y = -0.55;
    this.rightArmPivot.add(rightArmMesh, rightHand);
    this.bodyMesh.add(this.rightArmPivot);

    // 4. Legs with 2-segment Hip & Knee Pivots
    const thighGeo = new THREE.BoxGeometry(0.18, 0.32, 0.18);
    const shinGeo = new THREE.BoxGeometry(0.16, 0.30, 0.16);
    const shoeGeo = new THREE.BoxGeometry(0.20, 0.12, 0.26);

    // Left Leg (Thigh + Knee/Shin + Shoe)
    this.leftThighPivot = new THREE.Group();
    this.leftThighPivot.position.set(-0.16, 0.65, 0);
    const leftThighMesh = new THREE.Mesh(thighGeo, pantsMaterial);
    leftThighMesh.position.y = -0.16;
    leftThighMesh.castShadow = true;
    this.leftThighPivot.add(leftThighMesh);

    this.leftKneePivot = new THREE.Group();
    this.leftKneePivot.position.set(0, -0.32, 0);
    const leftShinMesh = new THREE.Mesh(shinGeo, pantsMaterial);
    leftShinMesh.position.y = -0.15;
    leftShinMesh.castShadow = true;
    const leftShoe = new THREE.Mesh(shoeGeo, shoeMaterial);
    leftShoe.position.set(0, -0.30, 0.04);
    leftShoe.castShadow = true;
    this.leftKneePivot.add(leftShinMesh, leftShoe);
    this.leftThighPivot.add(this.leftKneePivot);
    this.group.add(this.leftThighPivot);

    // Right Leg (Thigh + Knee/Shin + Shoe)
    this.rightThighPivot = new THREE.Group();
    this.rightThighPivot.position.set(0.16, 0.65, 0);
    const rightThighMesh = new THREE.Mesh(thighGeo, pantsMaterial);
    rightThighMesh.position.y = -0.16;
    rightThighMesh.castShadow = true;
    this.rightThighPivot.add(rightThighMesh);

    this.rightKneePivot = new THREE.Group();
    this.rightKneePivot.position.set(0, -0.32, 0);
    const rightShinMesh = new THREE.Mesh(shinGeo, pantsMaterial);
    rightShinMesh.position.y = -0.15;
    rightShinMesh.castShadow = true;
    const rightShoe = new THREE.Mesh(shoeGeo, shoeMaterial);
    rightShoe.position.set(0, -0.30, 0.04);
    rightShoe.castShadow = true;
    this.rightKneePivot.add(rightShinMesh, rightShoe);
    this.rightThighPivot.add(this.rightKneePivot);
    this.group.add(this.rightThighPivot);
  }

  private buildProps(): void {
    // 1. Coffee Mug
    const mugGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.14, 12);
    const mugMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    this.coffeeMugMesh = new THREE.Mesh(mugGeo, mugMat);
    this.coffeeMugMesh.position.set(0, -0.62, 0.12);
    this.coffeeMugMesh.visible = false;
    this.rightArmPivot.add(this.coffeeMugMesh);

    // Coffee Liquid inside
    const liquidGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12);
    const liquidMat = new THREE.MeshBasicMaterial({ color: 0x451a03 });
    const liquid = new THREE.Mesh(liquidGeo, liquidMat);
    liquid.position.y = 0.06;
    this.coffeeMugMesh.add(liquid);

    // 2. Cigarette & Glowing Tip
    const cigGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6);
    const cigMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    this.cigaretteMesh = new THREE.Mesh(cigGeo, cigMat);
    this.cigaretteMesh.rotation.x = Math.PI / 2;
    this.cigaretteMesh.position.set(0, -0.6, 0.14);
    this.cigaretteMesh.visible = false;
    this.rightArmPivot.add(this.cigaretteMesh);

    const glowGeo = new THREE.SphereGeometry(0.025, 6, 6);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff4500 });
    this.cigaretteGlowMesh = new THREE.Mesh(glowGeo, glowMat);
    this.cigaretteGlowMesh.position.set(0, 0.06, 0);
    this.cigaretteMesh.add(this.cigaretteGlowMesh);

    // 3. Smoke Particles for Cigarette / Coffee Steam
    const particleCount = 20;
    this.smokeGeometry = new THREE.BufferGeometry();
    this.smokePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
      this.smokePositions[i] = 0;
    }
    this.smokeGeometry.setAttribute('position', new THREE.BufferAttribute(this.smokePositions, 3));

    const smokeMaterial = new THREE.PointsMaterial({
      color: 0xcccccc,
      size: 0.06,
      transparent: true,
      opacity: 0.5,
    });
    this.smokeParticles = new THREE.Points(this.smokeGeometry, smokeMaterial);
    this.smokeParticles.visible = false;
    this.group.add(this.smokeParticles);
  }

  private buildSpeechSprite(): void {
    this.speechCanvas = document.createElement('canvas');
    this.speechCanvas.width = 384;
    this.speechCanvas.height = 160;
    this.speechCtx = this.speechCanvas.getContext('2d')!;

    this.speechTexture = new THREE.CanvasTexture(this.speechCanvas);
    this.speechTexture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this.speechTexture,
      transparent: true,
      depthTest: false,
    });

    this.speechSprite = new THREE.Sprite(spriteMat);
    this.speechSprite.scale.set(2.4, 1.0, 1.0);
    this.speechSprite.position.set(0, 2.3, 0);
    this.speechSprite.visible = false; // Hidden by default to avoid visual clutter
    this.group.add(this.speechSprite);
  }

  public renderSpeechBubble(icon: string, title: string, text: string, accentColor: string = '#10b981'): void {
    const ctx = this.speechCtx;
    const w = this.speechCanvas.width;
    const h = this.speechCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Draw Rounded Bubble Box
    const radius = 16;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 28, radius);
    ctx.fill();
    ctx.stroke();

    // Bubble pointer arrow
    ctx.beginPath();
    ctx.moveTo(w / 2 - 12, h - 20);
    ctx.lineTo(w / 2, h - 6);
    ctx.lineTo(w / 2 + 12, h - 20);
    ctx.fillStyle = accentColor;
    ctx.fill();

    // Title / Header
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`${icon} ${title}`, 22, 42);

    // Text Body
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '18px system-ui, sans-serif';

    // Text truncation / wrapping
    const maxLen = 32;
    const displayText = text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
    ctx.fillText(displayText, 22, 78);

    // Status Pill
    ctx.fillStyle = accentColor;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`● ${this.getStateLabel()}`, 22, 108);

    this.speechTexture.needsUpdate = true;
  }

  public say(text: string, durationMs: number = 5000, accentColor: string = '#38bdf8'): void {
    if (this.speechTimer) {
      clearTimeout(this.speechTimer);
      this.speechTimer = null;
    }

    this.renderSpeechBubble(this.config.avatarIcon, this.name, text, accentColor);
    this.speechSprite.visible = true;

    // Auto-disappear after duration (default 5s) if no new update arrives
    this.speechTimer = setTimeout(() => {
      this.speechSprite.visible = false;
      this.speechTimer = null;
    }, durationMs);
  }

  public hideSpeechBubble(): void {
    if (this.speechTimer) {
      clearTimeout(this.speechTimer);
      this.speechTimer = null;
    }
    this.speechSprite.visible = false;
  }

  private getStateLabel(): string {
    switch (this.currentState) {
      case 'WORKING':
        return 'Çalışıyor';
      case 'WALKING':
        return 'Yürüyor';
      case 'DRINKING_COFFEE':
        return 'Kahve Molası ☕';
      case 'SMOKING':
        return 'Sigara Molası 🚬';
      case 'DRINKING_WATER':
        return 'Su Molası 💧';
      case 'CHATTING':
        return 'İstişare Ediyor 💬';
      case 'ALERT':
        return 'SİNYAL ALARMI ⚡';
      default:
        return 'Aktif';
    }
  }

  // --- State Machine & Poses ---

  public setWorkingPose(): void {
    this.currentState = 'WORKING';
    this.coffeeMugMesh.visible = false;
    this.cigaretteMesh.visible = false;
    this.smokeParticles.visible = false;

    // Sit pose: hips lowered to chair cushion level (y = 0.44), thighs horizontal, knees bent 90 deg down to floor
    this.bodyMesh.position.y = 0.68;
    this.leftThighPivot.position.set(-0.16, 0.44, 0.05);
    this.leftThighPivot.rotation.set(Math.PI / 2, 0, 0);
    this.leftKneePivot.rotation.set(-Math.PI / 2, 0, 0);

    this.rightThighPivot.position.set(0.16, 0.44, 0.05);
    this.rightThighPivot.rotation.set(Math.PI / 2, 0, 0);
    this.rightKneePivot.rotation.set(-Math.PI / 2, 0, 0);

    // Arms forward resting comfortably on desk/keyboard
    this.leftArmPivot.rotation.set(Math.PI / 3, -0.15, 0);
    this.rightArmPivot.rotation.set(Math.PI / 3, 0.15, 0);
  }

  public setStandingPose(): void {
    this.bodyMesh.position.y = 0.95;
    this.leftThighPivot.position.set(-0.16, 0.65, 0);
    this.leftThighPivot.rotation.set(0, 0, 0);
    this.leftKneePivot.rotation.set(0, 0, 0);

    this.rightThighPivot.position.set(0.16, 0.65, 0);
    this.rightThighPivot.rotation.set(0, 0, 0);
    this.rightKneePivot.rotation.set(0, 0, 0);

    this.leftArmPivot.rotation.set(0, 0, 0);
    this.rightArmPivot.rotation.set(0, 0, 0);
  }

  public startCoffeeBreak(targetPos: THREE.Vector3, onArrive?: () => void): void {
    this.say('Bir kahve alıp geliyorum...', 3500, '#f59e0b');
    this.walkTo(targetPos, () => {
      this.currentState = 'DRINKING_COFFEE';
      this.coffeeMugMesh.visible = true;
      this.cigaretteMesh.visible = false;
      this.smokeParticles.visible = true;
      this.say('Kahve Molası ☕', 5000, '#f59e0b');
      if (onArrive) onArrive();
    });
  }

  public startSmokeBreak(targetPos: THREE.Vector3, onArrive?: () => void): void {
    this.say('Balkona hava almaya çıkıyorum...', 3500, '#94a3b8');
    this.walkTo(targetPos, () => {
      this.currentState = 'SMOKING';
      this.coffeeMugMesh.visible = false;
      this.cigaretteMesh.visible = true;
      this.smokeParticles.visible = true;
      this.say('Sigara Molası 🚬', 5000, '#94a3b8');
      if (onArrive) onArrive();
    });
  }

  public returnToDesk(onComplete?: () => void): void {
    this.coffeeMugMesh.visible = false;
    this.cigaretteMesh.visible = false;
    this.smokeParticles.visible = false;
    this.say('Masaya dönüyorum...', 2500, '#38bdf8');

    this.walkTo(this.deskPosition, () => {
      this.group.rotation.y = this.deskRotationY;
      this.setWorkingPose();
      this.say('Görev Başında', 3000, '#10b981');
      if (onComplete) onComplete();
    });
  }

  public triggerAlertPreemption(reason: string, onReturnToDesk?: () => void): void {
    this.alertToDesk(reason, onReturnToDesk);
  }

  public alertToDesk(reason: string, onReturnToDesk?: () => void): void {
    this.isAlerted = true;
    this.moveSpeed = 6.0; // Run speed!
    this.say(`🚨 ${reason}! Masaya koşuyorum!`, 4000, '#ef4444');

    this.coffeeMugMesh.visible = false;
    this.cigaretteMesh.visible = false;
    this.smokeParticles.visible = false;

    this.walkTo(this.deskPosition, () => {
      this.group.rotation.y = this.deskRotationY;
      this.setWorkingPose();
      this.moveSpeed = 3.5;
      this.isAlerted = false;
      this.say(`💻 ${reason} işleme alındı!`, 3000, '#10b981');
      if (onReturnToDesk) onReturnToDesk();
    });
  }

  public walkTo(target: THREE.Vector3, onComplete?: () => void): void {
    this.currentState = 'WALKING';
    this.setStandingPose();

    // Generate simple waypoint path (start -> intermediate -> target)
    const current = this.group.position.clone();
    const intermediate = new THREE.Vector3(current.x, 0, target.z);

    this.path = [intermediate, target.clone()];
    this.currentPathIndex = 0;
    this.onPathComplete = onComplete || null;
  }

  public update(delta: number): void {
    this.animTime += delta * 4;

    // 1. Navigation / Walking logic
    if (this.currentState === 'WALKING' && this.path.length > 0) {
      const targetPoint = this.path[this.currentPathIndex];
      const currentPos = this.group.position;
      const dir = new THREE.Vector3().subVectors(targetPoint, currentPos);
      dir.y = 0;
      const dist = dir.length();

      if (dist < 0.1) {
        this.currentPathIndex++;
        if (this.currentPathIndex >= this.path.length) {
          this.path = [];
          if (this.onPathComplete) {
            const cb = this.onPathComplete;
            this.onPathComplete = null;
            cb();
          }
        }
      } else {
        dir.normalize();
        const step = Math.min(dist, this.moveSpeed * delta);
        currentPos.addScaledVector(dir, step);

        // Smoothly rotate towards movement direction
        const targetAngle = Math.atan2(dir.x, dir.z);
        this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetAngle, 0.2);

        // Walking limb swing animation
        const swing = Math.sin(this.animTime * 2) * 0.55;
        this.leftThighPivot.rotation.x = swing;
        this.leftKneePivot.rotation.x = Math.max(0, -swing * 0.4);
        this.rightThighPivot.rotation.x = -swing;
        this.rightKneePivot.rotation.x = Math.max(0, swing * 0.4);
        this.leftArmPivot.rotation.x = -swing;
        this.rightArmPivot.rotation.x = swing;

        // Slight torso vertical bobbing
        this.bodyMesh.position.y = 0.95 + Math.abs(Math.sin(this.animTime * 2)) * 0.05;
      }
      return;
    }

    // 2. Working / Typing Animation
    if (this.currentState === 'WORKING') {
      const typingSpeed = this.isAlerted ? 12 : 6;
      const leftKey = Math.sin(this.animTime * typingSpeed) * 0.15;
      const rightKey = Math.cos(this.animTime * typingSpeed) * 0.15;

      this.leftArmPivot.rotation.x = Math.PI / 3 + leftKey;
      this.rightArmPivot.rotation.x = Math.PI / 3 + rightKey;

      // Subtle head nodding / screen looking
      this.headGroup.rotation.x = 0.1 + Math.sin(this.animTime * 0.8) * 0.05;
      this.headGroup.rotation.y = Math.cos(this.animTime * 0.5) * 0.08;
      return;
    }

    // 3. Drinking Coffee Animation
    if (this.currentState === 'DRINKING_COFFEE') {
      const sipCycle = Math.sin(this.animTime * 0.8);
      // Raise cup to mouth periodically
      if (sipCycle > 0.4) {
        this.rightArmPivot.rotation.set(Math.PI * 0.65, 0.3, 0);
        this.headGroup.rotation.x = -0.15; // tilt head slightly back
      } else {
        this.rightArmPivot.rotation.set(Math.PI * 0.25, 0.2, 0);
        this.headGroup.rotation.x = 0;
      }
      this.updateSmokeParticles(0.02, 0.08);
      return;
    }

    // 4. Smoking Animation
    if (this.currentState === 'SMOKING') {
      const puffCycle = Math.sin(this.animTime * 0.6);
      if (puffCycle > 0.5) {
        // Bring cigarette to lips
        this.rightArmPivot.rotation.set(Math.PI * 0.72, 0.35, 0);
        this.headGroup.rotation.x = -0.1;
        this.cigaretteGlowMesh.scale.set(1.5, 1.5, 1.5);
      } else {
        // Lower arm
        this.rightArmPivot.rotation.set(Math.PI * 0.2, 0.2, 0);
        this.headGroup.rotation.x = 0.05;
        this.cigaretteGlowMesh.scale.set(1.0, 1.0, 1.0);
      }
      this.updateSmokeParticles(0.04, 0.12);
      return;
    }
  }

  private updateSmokeParticles(riseSpeed: number, spread: number): void {
    if (!this.smokePositions) return;
    const pos = this.smokePositions;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] += riseSpeed; // Y rises
      pos[i] += (Math.random() - 0.5) * spread * 0.1; // X drift
      pos[i + 2] += (Math.random() - 0.5) * spread * 0.1; // Z drift

      // Reset when too high
      if (pos[i + 1] > 1.2) {
        pos[i] = 0.2;
        pos[i + 1] = 0.4;
        pos[i + 2] = 0.2;
      }
    }
    this.smokeGeometry.attributes.position.needsUpdate = true;
  }
}
