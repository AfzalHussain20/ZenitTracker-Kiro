/**
 * Investigation JSON — structured output of the Jira forensic engine.
 * Replaces the ASCII string output from buildDeepAnalysis for the report page.
 * The chat still works as before; this is additive.
 */

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface InvestigationMetadata {
  id: string;
  reporterName: string;
  query: string;
  generatedAt: string;
  totalIssuesAnalyzed: number;
  jql: string;
  investigationScore: number; // 0–100
  riskLevel: RiskLevel;
}

export interface ReporterOverview {
  name: string;
  totalFiled: number;
  open: number;
  resolved: number;
  resolutionRate: number;
  activeDays: number;
  allTimeAvgPerDay: number;
  last7DayAvgPerDay: number;
  teamAvgPerReporter: number;
  vsTeamAvg: 'above_2x' | 'above' | 'below' | 'at';
  platformCount: number;
  platforms: { name: string; count: number }[];
  statusBreakdown: { status: string; count: number }[];
  priorityBreakdown: { priority: string; count: number }[];
  typeBreakdown: { type: string; count: number }[];
}

export interface TimelineEntry {
  date: string; // YYYY-MM-DD
  count: number;
  isSpikeDay: boolean;
  isRecentWeek: boolean;
}

export interface VelocityAnalysis {
  topSpikeDays: { date: string; count: number; isSpike: boolean }[];
  maxSingleDay: number;
  medianDay: number;
  spikeRatio: number; // maxDay / medianDay
  spikeWarning: string | null;
}

export interface DuplicateCluster {
  id: string;
  normalisedTitle: string;
  count: number;
  ticketIds: string[];
  platforms: string[];
  dates: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'; // HIGH = exact title, MEDIUM = 90% match, LOW = 70%
  engineeringImpact: 'BLOCKER' | 'MAJOR' | 'MINOR';
}

export interface SameDayCluster {
  date: string;
  titleSnippet: string;
  platforms: string[];
  tickets: { key: string; platform: string; summary: string }[];
  isCrossPlatform: boolean;
}

export interface PlatformCluster {
  platform: string;
  count: number;
  percentage: number;
  isSingleFocus: boolean; // >60% concentration
}

export interface Evidence {
  id: string;
  type: 'SPIKE' | 'DUPLICATE' | 'CROSS_PLATFORM' | 'RESOLUTION' | 'VELOCITY';
  title: string;
  description: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  metrics: { label: string; value: string | number }[];
  relatedTickets: string[];
  severity: RiskLevel;
}

export interface AIFindings {
  executiveSummary: string;
  verdict: RiskLevel;
  verdictReason: string;
  nextSteps: string[];
  generatedFrom: 'ai' | 'fallback';
}

export interface InvestigationReport {
  metadata: InvestigationMetadata;
  reporter: ReporterOverview;
  timeline: TimelineEntry[];
  velocity: VelocityAnalysis;
  duplicateClusters: DuplicateCluster[];
  sameDayClusters: SameDayCluster[];
  platformClusters: PlatformCluster[];
  evidence: Evidence[];
  aiFindings: AIFindings;
  // Cross-reporter comparison (simplified)
  teamComparison: {
    teamAvgBugsPerPerson: number;
    teamAvgResolutionRate: number;
    teamTopReporters: { name: string; count: number; rate: number }[];
    reporterRank: number;
    totalReporters: number;
  };
}
