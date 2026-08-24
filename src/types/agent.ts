import { AgentRole, AgentState } from '../config/constants.js';

export interface AgentInfo {
  role: AgentRole;
  name: string;
  avatarIcon: string;
  state: AgentState;
  currentTask: string;
  lastActive: string;
  confidence?: number;
  stats: {
    actionsCount: number;
    successRate?: number;
    customMetric?: string;
  };
}

export interface SystemState {
  timestamp: string;
  agents: Record<AgentRole, AgentInfo>;
  currentSceneSeverity: {
    label: string;
    score: number;
  };
  riskConfidence: {
    score: number;
    accuracy: number;
  };
  portfolioSummary: {
    totalUsd: number;
    unrealizedPnl: number;
    openPositionsCount: number;
  };
  recentEvents: unknown[];
}
