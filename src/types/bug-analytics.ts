/**
 * Core data models for Bug Analytics and Categorization System
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Bug Models
// ============================================================================

export type BugType = 'functional' | 'ui' | 'performance' | 'security' | 'crash' | 'data';
export type BugSeverity = 'critical' | 'high' | 'medium' | 'low' | 'trivial';
export type BugComponent = 'authentication' | 'dashboard' | 'api' | 'database' | 'ui' | 'network';
export type BugStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'reopened';
export type BugPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export interface BugCategories {
  type: BugType;
  severity: BugSeverity;
  component: BugComponent;
  customFields: Record<string, any>;
}

export interface EnhancedBug {
  id: string;
  title: string;
  description: string;
  stepsToReproduce?: string;
  categories: BugCategories;
  tags: string[];
  status: BugStatus;
  priority: BugPriority;
  platform?: string;
  reportedByUid: string;
  reportedByName: string;
  assignedToUid?: string;
  assignedToName?: string;
  sprintId?: string;
  epicId?: string;
  storyId?: string;
  storyPoints?: number;
  searchableText?: string;
  resolutionTime?: number; // hours
  reopenCount?: number;
  viewCount?: number;
  lastViewedAt?: Timestamp;
  resolvedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}

export interface TaxonomyField {
  id: string;
  name: string;
  type: 'select' | 'multi-select' | 'text' | 'number';
  options?: string[];
  required: boolean;
  validation?: (value: any) => boolean;
}

export interface CategoryDefinitions {
  types: BugType[];
  severities: BugSeverity[];
  components: BugComponent[];
  customFields: TaxonomyField[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Analytics Models
// ============================================================================

export type AnalyticsDomain = 'user_action' | 'system_event' | 'performance_metric' | 'error_event';

export interface AnalyticsEvent {
  id: string;
  timestamp: Timestamp;
  eventType: string;
  domain: AnalyticsDomain;
  userId: string;
  userName?: string;
  metadata: Record<string, any>;
  sessionId?: string;
  bugId?: string;
  epicId?: string;
  storyId?: string;
  sprintId?: string;
  searchableText?: string;
}

export interface AggregatedEvents {
  groupKey: string;
  count: number;
  events: AnalyticsEvent[];
  timeRange: TimeRange;
}

export interface AnalyticsQuery {
  timeRange?: TimeRange;
  domain?: AnalyticsDomain;
  eventType?: string;
  userId?: string;
}

// ============================================================================
// Leaderboard Models
// ============================================================================

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  photoURL?: string;
  bugCount: number;
  severityDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    trivial: number;
  };
  qualityScore: number; // 0-100
  rank: number;
  averageResolutionTime?: number;
  reopenRate?: number;
}

export interface LeaderboardCache {
  timePeriod: string;
  entries: LeaderboardEntry[];
  calculatedAt: Timestamp;
  expiresAt: Timestamp;
}

export type LeaderboardTimePeriod = 'current_month' | 'previous_month' | 'custom';

export interface LeaderboardQuery {
  timePeriod: LeaderboardTimePeriod;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

// ============================================================================
// Sprint Models
// ============================================================================

export type SprintStatus = 'planned' | 'active' | 'completed';

export interface Sprint {
  id: string;
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
  goals: string[];
  status: SprintStatus;
  teamId?: string;
  teamName?: string;
  velocityTarget?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SprintMetrics {
  sprintId: string;
  totalBugs: number;
  resolvedBugs: number;
  openBugs: number;
  averageResolutionTime: number;
  bugsBySeverity: Record<BugSeverity, number>;
  bugsByComponent: Record<string, number>;
  velocityPoints?: number;
  burndownData: Array<{ date: Date; remaining: number }>;
}

// ============================================================================
// Epic and Story Models
// ============================================================================

export type EpicStatus = 'backlog' | 'in_progress' | 'completed' | 'archived';
export type StoryStatus = 'backlog' | 'in_progress' | 'in_review' | 'done' | 'blocked';
export type Priority = 'high' | 'medium' | 'low';

export interface Epic {
  id: string;
  title: string;
  description: string;
  status: EpicStatus;
  priority: Priority;
  ownerId: string;
  ownerName: string;
  storyIds: string[];
  completionPercentage: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  targetDate?: Timestamp;
  tags: string[];
  searchableText?: string;
}

export interface Story {
  id: string;
  title: string;
  description: string;
  epicId: string;
  status: StoryStatus;
  priority: Priority;
  assigneeId?: string;
  assigneeName?: string;
  storyPoints?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  blockedReason?: string;
  acceptanceCriteria: string[];
  bugIds: string[]; // linked bugs
  searchableText?: string;
}

// ============================================================================
// Time Filter Models
// ============================================================================

export type TimePreset = 
  | 'current_month' 
  | 'previous_month' 
  | 'last_7_days' 
  | 'last_30_days' 
  | 'last_quarter' 
  | 'last_year' 
  | 'all_time'
  | 'custom';

export interface TimeRange {
  start: Date;
  end: Date;
  preset?: TimePreset;
}

// ============================================================================
// Search Models
// ============================================================================

export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  facets?: string[];
  page?: number;
  hitsPerPage?: number;
}

export interface SearchFilters {
  category?: string[];
  severity?: string[];
  status?: string[];
  assignee?: string[];
  dateRange?: { start: Date; end: Date };
}

export interface SearchResult<T> {
  hits: T[];
  totalHits: number;
  facets: Record<string, FacetValue[]>;
  processingTimeMs: number;
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  query: SearchQuery;
  indexName: string;
  createdAt: Timestamp;
  lastUsedAt?: Timestamp;
  useCount: number;
}

export interface BugSearchDocument {
  objectID: string; // bug.id
  title: string;
  description: string;
  stepsToReproduce: string;
  type: string;
  severity: string;
  component: string;
  status: string;
  priority: string;
  platform: string;
  tags: string[];
  assignedToName?: string;
  reportedByName: string;
  createdAt: number; // timestamp
  updatedAt: number;
  sprintId?: string;
  epicId?: string;
  storyId?: string;
}

export interface EpicSearchDocument {
  objectID: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  ownerName: string;
  tags: string[];
  completionPercentage: number;
  createdAt: number;
  updatedAt: number;
}

export interface StorySearchDocument {
  objectID: string;
  title: string;
  description: string;
  epicId: string;
  status: string;
  priority: string;
  assigneeName?: string;
  storyPoints?: number;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Export Models
// ============================================================================

export type ExportFormat = 'excel' | 'csv' | 'pdf';
export type ExportFrequency = 'daily' | 'weekly' | 'monthly';

export interface ExportConfig {
  format: ExportFormat;
  data: any[];
  fileName: string;
  metadata?: {
    exportDate: Date;
    exportedBy: string;
    filters: Record<string, any>;
  };
  columns?: ColumnDefinition[];
}

export interface ColumnDefinition {
  key: string;
  label: string;
  format?: (value: any) => string;
}

export interface ExportMetadata {
  exportId: string;
  exportDate: Timestamp;
  exportedBy: string;
  exportedByName: string;
  format: ExportFormat;
  recordCount: number;
  filters: {
    timeRange?: TimeRange;
    categories?: string[];
    status?: string[];
    sprint?: string;
    [key: string]: any;
  };
  fileSize?: number;
  downloadUrl?: string;
  expiresAt?: Timestamp;
}

export interface ExportSchedule {
  id: string;
  userId: string;
  frequency: ExportFrequency;
  format: ExportFormat;
  query: any;
  emailTo: string[];
  nextRunDate: Date;
}

// ============================================================================
// User Preferences Models
// ============================================================================

export interface UserPreferences {
  userId: string;
  lastTimeFilter?: TimeRange;
  lastSprintId?: string;
  defaultChartTypes?: Record<string, ChartType>;
  savedSearchIds: string[];
  dashboardLayout?: any;
  notificationSettings?: {
    leaderboardUpdates: boolean;
    sprintSummaries: boolean;
    exportCompletion: boolean;
  };
}

// ============================================================================
// Visualization Models
// ============================================================================

export type ChartType = 'pie' | 'line' | 'bar' | 'area' | 'composed';

export interface ChartConfig {
  type: ChartType;
  data: any[];
  xKey?: string;
  yKeys: string[];
  colors?: string[];
  title: string;
  height?: number;
}

export interface MetricCard {
  title: string;
  value: number | string;
  change?: number; // percentage change
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ComponentType;
}

// ============================================================================
// Firebase Connector Models
// ============================================================================

export interface QueryOptions {
  limit?: number;
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  where?: WhereClause[];
  startAfter?: any;
}

export interface WhereClause {
  field: string;
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not-in' | 'array-contains' | 'array-contains-any';
  value: any;
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: any;
  hasMore: boolean;
}

export interface BatchOperation {
  type: 'create' | 'update' | 'delete';
  collection: string;
  docId?: string;
  data?: any;
}

// ============================================================================
// User Role Models
// ============================================================================

export type UserRole = 'admin' | 'manager' | 'developer' | 'viewer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
}

// ============================================================================
// Error Models
// ============================================================================

export interface BugAnalyticsError {
  code: string;
  message: string;
  statusCode: number;
  details?: any;
}
