/**
 * Firebase Collections Utility
 * 
 * This module provides type-safe collection references and helper functions
 * for interacting with Firebase Firestore collections.
 */

import { 
  collection, 
  CollectionReference, 
  DocumentData,
  Firestore
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import type {
  UserDocument,
  TaskDocument,
  WorklogDocument,
  TeamMetricsCacheDocument
} from '@/types/firebase-schema';

// ─── Collection Names ────────────────────────────────────────────────────────

/**
 * Firebase collection names as constants to prevent typos
 */
export const COLLECTION_NAMES = {
  USERS: 'users',
  TASKS: 'tasks',
  WORKLOGS: 'worklogs',
  TEAM_METRICS_CACHE: 'team_metrics_cache',
} as const;

// ─── Type-Safe Collection References ─────────────────────────────────────────

/**
 * Helper function to create a typed collection reference
 */
function createCollection<T = DocumentData>(
  firestore: Firestore,
  collectionName: string
): CollectionReference<T> {
  return collection(firestore, collectionName) as CollectionReference<T>;
}

/**
 * Get a type-safe reference to the users collection
 */
export function getUsersCollection(firestore: Firestore = db): CollectionReference<UserDocument> {
  return createCollection<UserDocument>(firestore, COLLECTION_NAMES.USERS);
}

/**
 * Get a type-safe reference to the tasks collection
 */
export function getTasksCollection(firestore: Firestore = db): CollectionReference<TaskDocument> {
  return createCollection<TaskDocument>(firestore, COLLECTION_NAMES.TASKS);
}

/**
 * Get a type-safe reference to the worklogs collection
 */
export function getWorklogsCollection(firestore: Firestore = db): CollectionReference<WorklogDocument> {
  return createCollection<WorklogDocument>(firestore, COLLECTION_NAMES.WORKLOGS);
}

/**
 * Get a type-safe reference to the team_metrics_cache collection
 */
export function getTeamMetricsCacheCollection(firestore: Firestore = db): CollectionReference<TeamMetricsCacheDocument> {
  return createCollection<TeamMetricsCacheDocument>(firestore, COLLECTION_NAMES.TEAM_METRICS_CACHE);
}

// ─── Collection Helpers ──────────────────────────────────────────────────────

/**
 * Get all collection references in a single object
 */
export function getCollections(firestore: Firestore = db) {
  return {
    users: getUsersCollection(firestore),
    tasks: getTasksCollection(firestore),
    worklogs: getWorklogsCollection(firestore),
    teamMetricsCache: getTeamMetricsCacheCollection(firestore),
  };
}

/**
 * Collection metadata for documentation and validation
 */
export const COLLECTION_METADATA = {
  [COLLECTION_NAMES.USERS]: {
    name: 'users',
    description: 'User profiles with alias tracking',
    indexes: [
      { fields: ['alias'], unique: true },
      { fields: ['jiraAccountId'], unique: true },
      { fields: ['team'], unique: false },
    ],
  },
  [COLLECTION_NAMES.TASKS]: {
    name: 'tasks',
    description: 'Work allocation tasks with Jira compatibility',
    indexes: [
      { fields: ['assignees'], arrayContains: true },
      { fields: ['team'], unique: false },
      { fields: ['status'], unique: false },
      { fields: ['createdAt'], unique: false, order: 'desc' },
    ],
  },
  [COLLECTION_NAMES.WORKLOGS]: {
    name: 'worklogs',
    description: 'Time tracking entries',
    indexes: [
      { fields: ['memberId', 'date'], composite: true },
      { fields: ['taskId'], unique: false },
      { fields: ['date'], unique: false, order: 'desc' },
    ],
  },
  [COLLECTION_NAMES.TEAM_METRICS_CACHE]: {
    name: 'team_metrics_cache',
    description: 'Cached team performance metrics (30-minute TTL)',
    indexes: [
      { fields: ['teamId', 'ttl'], composite: true },
    ],
  },
} as const;
