import { Office3DApp } from './three/Office3DApp.ts';
import './services/proChartManager.ts';
import './services/positionsChartManager.ts';
import './services/activityLogManager.ts';
import { roomOverlayManager } from './services/roomOverlayManager.ts';
import './services/chatAssistantManager.ts';

// Initialize Three.js 3D Office Application
new Office3DApp('game-container');

// Bind Journal & Lessons button
document.getElementById('btn-open-journal')?.addEventListener('click', () => {
  roomOverlayManager.openRoom('journal');
});

console.log('🏢 Octopus Prime 3D Trading Office Simulation initialized.');

