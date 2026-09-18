import { AgentRole, SceneSeverity } from './types/events.ts';

export const APP_CONFIG = {
  GAME_WIDTH: 960,
  GAME_HEIGHT: 640,
  WS_URLS: [
    'ws://localhost:3000/ws',
    'ws://127.0.0.1:3000/ws',
    'ws://localhost:3001/ws',
    'ws://127.0.0.1:3001/ws',
  ],
  REST_API_URL: 'http://localhost:3000/api',
  RECONNECT_INTERVAL_MS: 3000,
};

export interface AgentVisualConfig {
  role: AgentRole;
  name: string;
  avatarIcon: string;
  sceneKey: string;
  roomTitle: string;
  bodyColor: number;
  hairColor: number;
  shirtColor: number;
  deskColor: number;
}

export interface RoomConfig {
  key: string;
  name: string;
  shortName: string;
  icon: string;
  agentRoles: AgentRole[];
}

export const ROOMS: RoomConfig[] = [
  {
    key: 'PatronRoomScene',
    name: 'Yönetim Odası',
    shortName: 'Yönetim',
    icon: '🎩',
    agentRoles: ['Patron', 'Sekreterya'],
  },
  {
    key: 'NewsRoomScene',
    name: 'Haber Odası',
    shortName: 'Haber',
    icon: '📰',
    agentRoles: ['Haber Takip', 'Makro Ekonomist', 'Düzenleyici İzleyici'],
  },
  {
    key: 'TraderRoomScene',
    name: 'İşlem Odası',
    shortName: 'İşlem',
    icon: '🤖',
    agentRoles: ['Binance İşlemci', 'Likidite Gözlemcisi'],
  },
  {
    key: 'RiskRoomScene',
    name: 'Risk Odası',
    shortName: 'Risk',
    icon: '🛡️',
    agentRoles: ['Risk Analisti', 'Whale Takipçisi'],
  },
  {
    key: 'PortfolioRoomScene',
    name: 'Portföy Odası',
    shortName: 'Portföy',
    icon: '💰',
    agentRoles: ['Portföy Muhasebecisi'],
  },
  {
    key: 'SignalsRoomScene',
    name: 'Sinyal Odası',
    shortName: 'Sinyal',
    icon: '⚡',
    agentRoles: ['Sinyal Avcısı', 'Teknik Analist'],
  },
  {
    key: 'AssistantRoomScene',
    name: 'Asistan Odası',
    shortName: 'Asistan',
    icon: '🎖️',
    agentRoles: ['Görev Takipçisi', 'Baş Danışman'],
  },
];

export const AGENT_CONFIGS: AgentVisualConfig[] = [
  // 1. Yönetim Odası
  {
    role: 'Patron',
    name: 'Patron (Baş Analist)',
    avatarIcon: '🎩',
    sceneKey: 'PatronRoomScene',
    roomTitle: 'Yönetim Odası',
    bodyColor: 0xf59e0b, // Gold accessory
    hairColor: 0x475569, // Silver refined
    shirtColor: 0x1e3a8a, // Navy Suit
    deskColor: 0x78350f, // Mahogany luxury
  },
  {
    role: 'Sekreterya',
    name: 'Sekreterya',
    avatarIcon: '📋',
    sceneKey: 'PatronRoomScene',
    roomTitle: 'Yönetim Odası',
    bodyColor: 0x3b82f6,
    hairColor: 0x78350f,
    shirtColor: 0x93c5fd,
    deskColor: 0x475569,
  },

  // 2. Haber Odası
  {
    role: 'Haber Takip',
    name: 'Haber Takip',
    avatarIcon: '📰',
    sceneKey: 'NewsRoomScene',
    roomTitle: 'Haber Odası',
    bodyColor: 0x3b82f6, // Blue
    hairColor: 0x1e293b,
    shirtColor: 0x60a5fa,
    deskColor: 0x475569,
  },
  {
    role: 'Makro Ekonomist',
    name: 'Makro Ekonomist',
    avatarIcon: '🌍',
    sceneKey: 'NewsRoomScene',
    roomTitle: 'Haber Odası',
    bodyColor: 0x0284c7, // Sky Blue
    hairColor: 0x334155,
    shirtColor: 0x38bdf8,
    deskColor: 0x334155,
  },
  {
    role: 'Düzenleyici İzleyici',
    name: 'Düzenleyici İzleyici',
    avatarIcon: '⚖️',
    sceneKey: 'NewsRoomScene',
    roomTitle: 'Haber Odası',
    bodyColor: 0x64748b, // Slate
    hairColor: 0x0f172a,
    shirtColor: 0x94a3b8,
    deskColor: 0x334155,
  },

  // 3. İşlem Odası
  {
    role: 'Binance İşlemci',
    name: 'Binance İşlemci',
    avatarIcon: '🤖',
    sceneKey: 'TraderRoomScene',
    roomTitle: 'İşlem Odası',
    bodyColor: 0xf59e0b, // Amber / Binance Gold
    hairColor: 0x0f172a,
    shirtColor: 0xfbbf24,
    deskColor: 0x475569,
  },
  {
    role: 'Likidite Gözlemcisi',
    name: 'Likidite Gözlemcisi',
    avatarIcon: '💧',
    sceneKey: 'TraderRoomScene',
    roomTitle: 'İşlem Odası',
    bodyColor: 0x06b6d4, // Cyan
    hairColor: 0x164e63,
    shirtColor: 0x67e8f9,
    deskColor: 0x334155,
  },

  // 4. Risk Odası
  {
    role: 'Risk Analisti',
    name: 'Risk Analisti',
    avatarIcon: '🛡️',
    sceneKey: 'RiskRoomScene',
    roomTitle: 'Risk Odası',
    bodyColor: 0x10b981, // Emerald Green
    hairColor: 0x334155,
    shirtColor: 0x34d399,
    deskColor: 0x475569,
  },
  {
    role: 'Whale Takipçisi',
    name: 'Whale Takipçisi',
    avatarIcon: '🐋',
    sceneKey: 'RiskRoomScene',
    roomTitle: 'Risk Odası',
    bodyColor: 0x0d9488, // Teal
    hairColor: 0x134e4a,
    shirtColor: 0x2dd4bf,
    deskColor: 0x334155,
  },

  // 5. Portföy Odası
  {
    role: 'Portföy Muhasebecisi',
    name: 'Portföy Muhasebecisi',
    avatarIcon: '💰',
    sceneKey: 'PortfolioRoomScene',
    roomTitle: 'Portföy Odası',
    bodyColor: 0x8b5cf6, // Violet
    hairColor: 0x4c1d95,
    shirtColor: 0xa78bfa,
    deskColor: 0x334155,
  },

  // 6. Sinyal Odası
  {
    role: 'Sinyal Avcısı',
    name: 'Sinyal Avcısı (Ali)',
    avatarIcon: '⚡',
    sceneKey: 'SignalsRoomScene',
    roomTitle: 'Sinyal Odası',
    bodyColor: 0xec4899, // Pink / Fuchsia
    hairColor: 0x831843,
    shirtColor: 0xf472b6,
    deskColor: 0x334155,
  },
  {
    role: 'Teknik Analist',
    name: 'Teknik Analist',
    avatarIcon: '📐',
    sceneKey: 'SignalsRoomScene',
    roomTitle: 'Sinyal Odası',
    bodyColor: 0x6366f1, // Indigo
    hairColor: 0x1e1b4b,
    shirtColor: 0xa5b4fc,
    deskColor: 0x334155,
  },

  // 7. Asistan Odası (Kişisel Asistan Masası)
  {
    role: 'Görev Takipçisi',
    name: 'Görev Takipçisi (Operasyon)',
    avatarIcon: '📌',
    sceneKey: 'AssistantRoomScene',
    roomTitle: 'Asistan Odası',
    bodyColor: 0x38bdf8, // Steel Blue / Cyan
    hairColor: 0x334155,
    shirtColor: 0x1e3a8a, // Navy tailored vest
    deskColor: 0x1e293b,
  },
  {
    role: 'Baş Danışman',
    name: 'Baş Danışman (İstihbarat)',
    avatarIcon: '🧠',
    sceneKey: 'AssistantRoomScene',
    roomTitle: 'Asistan Odası',
    bodyColor: 0x10b981, // Emerald Smart
    hairColor: 0x0f172a,
    shirtColor: 0x064e3b, // Smart blazer
    deskColor: 0x064e3b,
  },
];

export const SEVERITY_COLORS: Record<SceneSeverity, { tint: number; alpha: number; name: string }> = {
  HAFİF: { tint: 0x10b981, alpha: 0.08, name: 'HAFİF (Normal)' },
  ORTA: { tint: 0xfacc15, alpha: 0.15, name: 'ORTA (Dikkat)' },
  AĞIR: { tint: 0xf97316, alpha: 0.25, name: 'AĞIR (Türbülans)' },
  'ÇOK AĞIR': { tint: 0xef4444, alpha: 0.35, name: 'ÇOK AĞIR (Kırmızı Alarm)' },
  KATASTROFİK: { tint: 0x991b1b, alpha: 0.50, name: 'KATASTROFİK (DEFCON 1)' },
};
