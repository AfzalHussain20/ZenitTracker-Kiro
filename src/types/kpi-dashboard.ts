/**
 * Type definitions for Advanced KPI Dashboard System
 */

// ─── Team Types ──────────────────────────────────────────────────────────────
export type TeamType = 
  | 'dev' 
  | 'qa' 
  | 'ui_ux' 
  | 'database' 
  | 'api' 
  | 'sms' 
  | 'analytics' 
  | 'generic';

export interface TeamMember {
  accountId: string;
  displayName: string;
  avatarUrl?: string;
}

export interface JiraTeam {
  id: string;
  name: string;
  members: TeamMember[];
  teamType?: TeamType;
}

// ─── Cache Types ─────────────────────────────────────────────────────────────
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface TeamCacheEntry extends CacheEntry<JiraTeam[]> {
  lastRefresh: Date;
}

// ─── Metric Types ────────────────────────────────────────────────────────────
export interface MetricDefinition {
  key: string;
  label: string;
  description: string;
  applicableTeamTypes: TeamType[];
  calculation: (issues: any[]) => number;
}

export interface MetricValue {
  key: string;
  label: string;
  value: number;
  description?: string;
}

export interface WorkDistribution {
  stories: number;
  bugs: number;
  tasks: number;
  epics: number;
  subtasks: number;
}

export interface TeamMetrics {
  totalMembers: number;
  activeTasks: number;
  completionRate: number;
  workDistribution: WorkDistribution;
  relevantMetrics: MetricValue[];
}

// ─── Team Classification ─────────────────────────────────────────────────────
export interface TeamClassificationResult {
  teamType: TeamType;
  confidence: number;
  reasons: string[];
}
