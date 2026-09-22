import { Office3DApp } from './three/Office3DApp.ts';
import './services/positionsChartManager.ts';
import './services/activityLogManager.ts';
import './services/roomOverlayManager.ts';

// Initialize Three.js 3D Office Application
new Office3DApp('game-container');

console.log('🏢 Octopus Prime 3D Trading Office Simulation initialized.');

