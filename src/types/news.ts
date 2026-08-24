import { SceneSeverity } from '../config/constants.js';

export interface KeywordCategoryConfig {
  keywords: string[];
  strength: number;
  description: string;
}

export type KeywordsMap = Record<string, KeywordCategoryConfig>;

export interface RawNewsItem {
  title: string;
  summary: string;
  link: string;
  source: string;
  published: string;
}

export interface SentimentAnalysisResult {
  label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  score: number; // 0.0 to 1.0 confidence
  marketImpactDescription: string;
}

export interface ImpactScoringResult {
  impactScore: number; // 0.0 to 10.0
  severityLabel: SceneSeverity;
  severityEmoji: string;
  affectedMarkets: string[];
  top3Assets: string[];
  confidence: number;
}
