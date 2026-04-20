/**
 * Firebase Schema Type Definitions
 * 
 * This file contains TypeScript interfaces for all Firebase Firestore collections
 * used in the Advanced KPI Dashboard System.
 * 
 * Collections:
 * - users: User profiles with alias tracking
 * - tasks: Work allocation tasks with Jira compatibility
 * - worklogs: Time tracking entries
 * - team_metrics_cache: Cached team performance metrics
 */

import { Timestamp } from 'firebase/firestore';

// ─── Users Collection ────────────────────────────────────────────────────────

/**
 * User document stored in the 'users' collection
 * 
 * Indexes required:
 * - alias (unique)
 * - jiraAccountId (unique)
 * - team
 */
export interface UserDocument {
  /** Firebase Auth UID */
  uid: string;
  
  /** Unique alias for the user (used for tracking) */
  alias: string;
  
  /** Full name of the user */
  fullName: string;
  
  /** Primary email address */
  email: string;
  
  /** Jira account ID for integration */
  jiraAccountId: string;
  
  /** Team ID the user belongs to */
  team: string;
  
  /** User role (e.g., Developer, QA Engineer, Manager) */
  role: string;
  
  /** Contact information */
  contactDetails: {
    email: string;
    phone?: string;
  };
  
  /** Document creation timestamp */
  createdAt: Timestamp;
  
  /** Last update timestamp */
  updatedAt: Timestamp;
}

// ─── Tasks Collection ────────────────────────────────────────────────────────

/**
 * Task priority levels
 */
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';

/**
 * Task status values
 */
export type TaskStatus = 'todo' | 'in_progress' | 'done';

/**
 * Task document stored in the 'tasks' collection
 * Schema is compatible with Jira issue structure for future integration
 * 
 * Indexes required:
 * - assignees (array-contains)
 * - team
 * - status
 * - createdAt (desc)
 */
export interface TaskDocument {
  /** Unique task identifier */
  id: string;
  
  /** Task title */
  title: string;
  
  /** Detailed task description */
  description: string;
  
  /** Task priority level */
  priority: TaskPriority;
  
  /** Estimated effort in hours */
  estimatedEffort: number;
  
  /** Array of assigned user UIDs */
  assignees: string[];
  
  /** Optional team ID for team-level tasks */
  team?: string;
  
  /** Current task status */
  status: TaskStatus;
  
  /** Task creation timestamp */
  createdAt: Timestamp;
  
  /** UID of the user who created the task */
  createdBy: string;
  
  /** Last update timestamp */
  updatedAt: Timestamp;
  
  /** Optional due date */
  dueDate?: Timestamp;
  
  // ─── Jira Integration Placeholders ───────────────────────────────────────
  
  /** Jira issue key (e.g., "SUN-123") - for future integration */
  jiraIssueKey?: string;
  
  /** Jira project key (e.g., "SUN") - for future integration */
  jiraProjectKey?: string;
  
  /** Jira issue type (e.g., "Story", "Bug", "Task") - for future integration */
  jiraIssueType?: string;
}

// ─── Worklogs Collection ─────────────────────────────────────────────────────

/**
 * Worklog document stored in the 'worklogs' collection
 * 
 * Indexes required:
 * - memberId + date (composite index)
 * - taskId
 * - date (desc)
 */
export interface WorklogDocument {
  /** Unique worklog identifier */
  id: string;
  
  /** ID of the task this worklog is for */
  taskId: string;
  
  /** UID of the user who logged the work */
  memberId: string;
  
  /** Date when the work was performed */
  date: Timestamp;
  
  /** Time spent in hours */
  timeSpent: number;
  
  /** Description of work performed */
  description: string;
  
  /** Worklog creation timestamp */
  createdAt: Timestamp;
  
  /** Last update timestamp */
  updatedAt: Timestamp;
}

// ─── Team Metrics Cache Collection ───────────────────────────────────────────

/**
 * Work distribution breakdown by issue type
 */
export interface WorkDistribution {
  stories: number;
  bugs: number;
  tasks: number;
  epics: number;
  subtasks: number;
}

/**
 * Cached team metrics document stored in the 'team_metrics_cache' collection
 * Cache TTL: 30 minutes
 * 
 * Indexes required:
 * - teamId + ttl (composite index)
 */
export interface TeamMetricsCacheDocument {
  /** Team ID this cache entry is for */
  teamId: string;
  
  /** Timestamp when metrics were calculated */
  calculatedAt: Timestamp;
  
  /** Start date of the metrics period */
  startDate: Timestamp;
  
  /** End date of the metrics period */
  endDate: Timestamp;
  
  /** Calculated metrics data */
  metrics: {
    /** Total number of team members */
    totalMembers: number;
    
    /** Number of active tasks */
    activeTasks: number;
    
    /** Task completion rate (0-100) */
    completionRate: number;
    
    /** Work distribution by issue type */
    workDistribution: WorkDistribution;
    
    /** Team-relevant metrics (key-value pairs) */
    relevantMetrics: Record<string, number>;
  };
  
  /** Time-to-live timestamp (30 minutes from calculatedAt) */
  ttl: Timestamp;
}

// ─── Type Guards ─────────────────────────────────────────────────────────────

/**
 * Type guard to check if a value is a valid TaskPriority
 */
export function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && 
    ['Low', 'Medium', 'High', 'Critical'].includes(value);
}

/**
 * Type guard to check if a value is a valid TaskStatus
 */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && 
    ['todo', 'in_progress', 'done'].includes(value);
}

// ─── Helper Types ────────────────────────────────────────────────────────────

/**
 * Partial user document for updates (all fields optional except uid)
 */
export type UserDocumentUpdate = Partial<Omit<UserDocument, 'uid' | 'createdAt'>> & {
  uid: string;
  updatedAt: Timestamp;
};

/**
 * Partial task document for updates (all fields optional except id)
 */
export type TaskDocumentUpdate = Partial<Omit<TaskDocument, 'id' | 'createdAt' | 'createdBy'>> & {
  id: string;
  updatedAt: Timestamp;
};

/**
 * Partial worklog document for updates (all fields optional except id)
 */
export type WorklogDocumentUpdate = Partial<Omit<WorklogDocument, 'id' | 'createdAt'>> & {
  id: string;
  updatedAt: Timestamp;
};
