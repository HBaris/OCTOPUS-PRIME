import { AgentRole, SceneSeverity } from './types/events.ts';

export const APP_CONFIG = {
  GAME_WIDTH: 960,
  GAME_HEIGHT: 640,
  WS_URLS: [
    'ws://localhost:3001/ws',
    'ws://localhost:3000/ws',
    'ws://127.0.0.1:3001/ws',
    'ws://127.0.0.1:3000/ws',
  ],
  REST_API_URL: 'http://localhost:3000/api',
  RECONNECT_INTERVAL_MS: 3000,
};

export interface AgentVisualConfig {
  role: AgentRole;
  name: string;
  avatarIcon: string;
  x: number;
  y: number;
  bodyColor: number;
  hairColor: number;
  shirtColor: number;
  deskColor: number;
}

export const AGENT_CONFIGS: AgentVisualConfig[] = [
  {
    role: 'Haber Takip',
    name: 'Haber Takip',
    avatarIcon: '📰',
    x: 180,
    y: 220,
    bodyColor: 0x3b82f6, // Blue
    hairColor: 0x1e293b,
    shirtColor: 0x60a5fa,
    deskColor: 0x475569,
  },
  {
    role: 'Binance İşlemci',
    name: 'Binance İşlemci',
    avatarIcon: '🤖',
    x: 480,
    y: 220,
    bodyColor: 0xf59e0b, // Amber / Binance Gold
    hairColor: 0x0f172a,
    shirtColor: 0xfbbf24,
    deskColor: 0x475569,
  },
  {
    role: 'Risk Analisti',
    name: 'Risk Analisti',
    avatarIcon: '🛡️',
    x: 780,
    y: 220,
    bodyColor: 0x10b981, // Emerald Green
    hairColor: 0x334155,
    shirtColor: 0x34d399,
    deskColor: 0x475569,
  },
  {
    role: 'Portföy Muhasebecisi',
    name: 'Portföy',
    avatarIcon: '💰',
    x: 320,
    y: 430,
    bodyColor: 0x8b5cf6, // Violet
    hairColor: 0x4c1d95,
    shirtColor: 0xa78bfa,
    deskColor: 0x334155,
  },
  {
    role: 'Sinyal Avcısı',
    name: 'Sinyal Avcısı',
    avatarIcon: '⚡',
    x: 640,
    y: 430,
    bodyColor: 0xec4899, // Pink / Fuchsia
    hairColor: 0x831843,
    shirtColor: 0xf472b6,
    deskColor: 0x334155,
  },
];

export const SEVERITY_COLORS: Record<SceneSeverity, { tint: number; alpha: number; name: string }> = {
  HAFİF: { tint: 0x10b981, alpha: 0.08, name: 'HAFİF (Normal)' },
  ORTA: { tint: 0xfacc15, alpha: 0.15, name: 'ORTA (Dikkat)' },
  AĞIR: { tint: 0xf97316, alpha: 0.25, name: 'AĞIR (Türbülans)' },
  'ÇOK AĞIR': { tint: 0xef4444, alpha: 0.35, name: 'ÇOK AĞIR (Kırmızı Alarm)' },
  KATASTROFİK: { tint: 0x991b1b, alpha: 0.50, name: 'KATASTROFİK (DEFCON 1)' },
};
