import { Timestamp } from "firebase/firestore";

export type Platform =
  | "Android TV"
  | "Apple TV"
  | "Fire TV"
  | "LG TV"
  | "Samsung TV"
  | "Roku"
  | "Web"
  | "Mobile (Android)"
  | "Mobile (iOS)"
  | "Other";

export interface PlatformDetails {
  platformName: Platform;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  browserName?: string; // For Web
  browserVersion?: string; // For Web
  customPlatformName?: string; // If Platform is "Other"
}

export type TestCaseStatus = "Pass" | "Fail" | "N/A" | "Untested" | "Fail (Known)"; // "Fail (Known)" kept for legacy data compatibility

export interface TestCase {
  id: string; // Will be a unique ID within the session, e.g., a timestamp-based string
  orderIndex: number; // To preserve original order from Excel
  testBed: string;
  testCaseTitle: string; // "Test Case" from Excel
  testSteps: string;
  expectedResult: string;
  actualResult?: string;
  notes?: string;
  status: TestCaseStatus;
  bugId?: string; // If status is "Fail" or "Fail (Known)"
  bugTitle?: string; // Auto-fetched title from Jira
  naReason?: string; // If status is "N/A"
  attachments?: string[]; // URLs to attachments if any
  linkedBugs?: string[]; // Multiple Jira bug IDs mapped to this test case
  lastModified: Date | Timestamp;
  priority?: "High" | "Medium" | "Low";
  platform?: string;
}

export interface TestSession {
  id: string; // Firestore document ID
  userId: string;
  userName: string; // Name of the tester
  platformDetails: PlatformDetails;
  testCases: TestCase[]; // Test cases are now an array within the session document
  status: "In Progress" | "Completed" | "Aborted";
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  completedAt?: Date | Timestamp; // To track total session time
  summary?: {
    total: number;
    pass: number;
    fail: number;
    na: number;
    untested: number;
    failKnown: number;
  };
  reasonForIncompletion?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Date | Timestamp;
  role: 'tester' | 'lead';
  photoURL?: string;
}

export type ManagedTestCasePriority = "High" | "Medium" | "Low";
export type ManagedTestCaseStatus = 'Pass' | 'Fail' | 'Blocked' | 'Not Run';

export interface ManagedTestCase {
  id: string;
  title: string;
  module: string;
  priority: ManagedTestCasePriority;
  status: ManagedTestCaseStatus;
  preconditions?: string;
  testData?: string;
  testSteps: string[];
  expectedResult: string;
  automationTag?: string;
  lastUpdatedBy: string;
  lastUpdatedByUid: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  // Fields for PRD extraction
  source?: 'PRD' | 'Manual' | 'AI';
  phase?: string;
}

export type TaskPriority = 'High' | 'Medium' | 'Low';
export type TaskStatus = 'Pending' | 'In Progress' | 'Done' | 'Blocked';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedToUid: string;
  assignedToName: string;
  assignedByUid: string;
  assignedByName: string;
  dueDate?: string; // ISO date string
  sessionId?: string; // optional link to a test session
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// ─── Bug Tracker ──────────────────────────────────────────────────────────────
export type BugSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
export type BugPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type BugStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed' | "Won't Fix";

export interface Bug {
  id: string;
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedResult: string;
  actualResult: string;
  severity: BugSeverity;
  priority: BugPriority;
  status: BugStatus;
  platform: string;
  appVersion?: string;
  environment?: string;
  labels: string[];
  assignedToUid?: string;
  assignedToName?: string;
  reportedByUid: string;
  reportedByName: string;
  sessionId?: string;       // link to TestSession
  testCaseId?: string;      // link to ManagedTestCase
  jiraTicketId?: string;    // for future Jira sync
  jiraTicketUrl?: string;
  attachments?: string[];
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  resolvedAt?: Date | Timestamp;
}

// ─── Daily Notes ──────────────────────────────────────────────────────────────
export type NoteCategory = 'meeting' | 'todo' | 'idea' | 'reference' | 'bug' | 'general';

export interface Note {
  id: string;
  title: string;
  content: string;
  plainText: string;
  tags: string[];
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  userId: string;
  userName: string;
  pinned: boolean;
  archived: boolean;
  category: NoteCategory;
  linkedBugs?: string[];
  linkedSession?: string;
}

// ─── Firebase Schema Exports ──────────────────────────────────────────────────
export type {
  UserDocument,
  TaskDocument,
  WorklogDocument,
  TeamMetricsCacheDocument,
  TaskPriority as FirebaseTaskPriority,
  TaskStatus as FirebaseTaskStatus,
  WorkDistribution,
  UserDocumentUpdate,
  TaskDocumentUpdate,
  WorklogDocumentUpdate,
} from './firebase-schema';

export { isTaskPriority, isTaskStatus } from './firebase-schema';
