/**
 * Type-Safe Firebase Operations
 * 
 * This module provides utility functions for performing CRUD operations
 * on Firebase Firestore collections with full TypeScript type safety.
 */

import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint,
  DocumentReference,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import {
  getUsersCollection,
  getTasksCollection,
  getWorklogsCollection,
  getTeamMetricsCacheCollection,
} from './collections';
import type {
  UserDocument,
  TaskDocument,
  WorklogDocument,
  TeamMetricsCacheDocument,
  UserDocumentUpdate,
  TaskDocumentUpdate,
  WorklogDocumentUpdate,
} from '@/types/firebase-schema';

// ─── User Operations ─────────────────────────────────────────────────────────

/**
 * Create a new user document
 */
export async function createUser(
  userData: Omit<UserDocument, 'createdAt' | 'updatedAt'>
): Promise<string> {
  const usersRef = getUsersCollection();
  const now = Timestamp.now();
  
  const docRef = await addDoc(usersRef, {
    ...userData,
    createdAt: now,
    updatedAt: now,
  });
  
  return docRef.id;
}

/**
 * Get a user document by UID
 */
export async function getUserByUid(uid: string): Promise<UserDocument | null> {
  const usersRef = getUsersCollection();
  const q = query(usersRef, where('uid', '==', uid), limit(1));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  return snapshot.docs[0].data();
}

/**
 * Get a user document by alias
 */
export async function getUserByAlias(alias: string): Promise<UserDocument | null> {
  const usersRef = getUsersCollection();
  const q = query(usersRef, where('alias', '==', alias), limit(1));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  return snapshot.docs[0].data();
}

/**
 * Get all users in a team
 */
export async function getUsersByTeam(teamId: string): Promise<UserDocument[]> {
  const usersRef = getUsersCollection();
  const q = query(usersRef, where('team', '==', teamId));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Update a user document
 */
export async function updateUser(
  uid: string,
  updates: Partial<Omit<UserDocument, 'uid' | 'createdAt'>>
): Promise<void> {
  const usersRef = getUsersCollection();
  const q = query(usersRef, where('uid', '==', uid), limit(1));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    throw new Error(`User with UID ${uid} not found`);
  }
  
  const docRef = snapshot.docs[0].ref;
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Check if an alias is available (not already in use)
 */
export async function isAliasAvailable(alias: string): Promise<boolean> {
  const user = await getUserByAlias(alias);
  return user === null;
}

// ─── Task Operations ─────────────────────────────────────────────────────────

/**
 * Create a new task document
 */
export async function createTask(
  taskData: Omit<TaskDocument, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const tasksRef = getTasksCollection();
  const now = Timestamp.now();
  
  const docRef = await addDoc(tasksRef, {
    ...taskData,
    id: '', // Will be set to docRef.id after creation
    createdAt: now,
    updatedAt: now,
  });
  
  // Update the document with its own ID
  await updateDoc(docRef, { id: docRef.id });
  
  return docRef.id;
}

/**
 * Get a task document by ID
 */
export async function getTaskById(taskId: string): Promise<TaskDocument | null> {
  const tasksRef = getTasksCollection();
  const docRef = doc(tasksRef, taskId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return snapshot.data();
}

/**
 * Get all tasks assigned to a user
 */
export async function getTasksByAssignee(userId: string): Promise<TaskDocument[]> {
  const tasksRef = getTasksCollection();
  const q = query(
    tasksRef,
    where('assignees', 'array-contains', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Get all tasks for a team
 */
export async function getTasksByTeam(teamId: string): Promise<TaskDocument[]> {
  const tasksRef = getTasksCollection();
  const q = query(
    tasksRef,
    where('team', '==', teamId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Get tasks by status
 */
export async function getTasksByStatus(
  status: TaskDocument['status']
): Promise<TaskDocument[]> {
  const tasksRef = getTasksCollection();
  const q = query(
    tasksRef,
    where('status', '==', status),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Update a task document
 */
export async function updateTask(
  taskId: string,
  updates: Partial<Omit<TaskDocument, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> {
  const tasksRef = getTasksCollection();
  const docRef = doc(tasksRef, taskId);
  
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Delete a task document
 */
export async function deleteTask(taskId: string): Promise<void> {
  const tasksRef = getTasksCollection();
  const docRef = doc(tasksRef, taskId);
  await deleteDoc(docRef);
}

// ─── Worklog Operations ──────────────────────────────────────────────────────

/**
 * Create a new worklog document
 */
export async function createWorklog(
  worklogData: Omit<WorklogDocument, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const worklogsRef = getWorklogsCollection();
  const now = Timestamp.now();
  
  const docRef = await addDoc(worklogsRef, {
    ...worklogData,
    id: '', // Will be set to docRef.id after creation
    createdAt: now,
    updatedAt: now,
  });
  
  // Update the document with its own ID
  await updateDoc(docRef, { id: docRef.id });
  
  return docRef.id;
}

/**
 * Get a worklog document by ID
 */
export async function getWorklogById(worklogId: string): Promise<WorklogDocument | null> {
  const worklogsRef = getWorklogsCollection();
  const docRef = doc(worklogsRef, worklogId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return snapshot.data();
}

/**
 * Get all worklogs for a member
 */
export async function getWorklogsByMember(
  memberId: string,
  startDate?: Date,
  endDate?: Date
): Promise<WorklogDocument[]> {
  const worklogsRef = getWorklogsCollection();
  const constraints: QueryConstraint[] = [
    where('memberId', '==', memberId),
    orderBy('date', 'desc'),
  ];
  
  if (startDate) {
    constraints.push(where('date', '>=', Timestamp.fromDate(startDate)));
  }
  
  if (endDate) {
    constraints.push(where('date', '<=', Timestamp.fromDate(endDate)));
  }
  
  const q = query(worklogsRef, ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Get all worklogs for a task
 */
export async function getWorklogsByTask(taskId: string): Promise<WorklogDocument[]> {
  const worklogsRef = getWorklogsCollection();
  const q = query(
    worklogsRef,
    where('taskId', '==', taskId),
    orderBy('date', 'desc')
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Update a worklog document
 */
export async function updateWorklog(
  worklogId: string,
  updates: Partial<Omit<WorklogDocument, 'id' | 'createdAt'>>
): Promise<void> {
  const worklogsRef = getWorklogsCollection();
  const docRef = doc(worklogsRef, worklogId);
  
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Delete a worklog document
 */
export async function deleteWorklog(worklogId: string): Promise<void> {
  const worklogsRef = getWorklogsCollection();
  const docRef = doc(worklogsRef, worklogId);
  await deleteDoc(docRef);
}

/**
 * Calculate total time logged for a task
 */
export async function getTotalTimeLoggedForTask(taskId: string): Promise<number> {
  const worklogs = await getWorklogsByTask(taskId);
  return worklogs.reduce((total, worklog) => total + worklog.timeSpent, 0);
}

/**
 * Calculate total time logged by a member in a date range
 */
export async function getTotalTimeLoggedByMember(
  memberId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  const worklogs = await getWorklogsByMember(memberId, startDate, endDate);
  return worklogs.reduce((total, worklog) => total + worklog.timeSpent, 0);
}

// ─── Team Metrics Cache Operations ───────────────────────────────────────────

/**
 * Get cached team metrics if not expired
 */
export async function getCachedTeamMetrics(
  teamId: string
): Promise<TeamMetricsCacheDocument | null> {
  const cacheRef = getTeamMetricsCacheCollection();
  const now = Timestamp.now();
  
  const q = query(
    cacheRef,
    where('teamId', '==', teamId),
    where('ttl', '>', now),
    orderBy('ttl', 'desc'),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  return snapshot.docs[0].data();
}

/**
 * Set team metrics cache with 30-minute TTL
 */
export async function setCachedTeamMetrics(
  cacheData: Omit<TeamMetricsCacheDocument, 'calculatedAt' | 'ttl'>
): Promise<string> {
  const cacheRef = getTeamMetricsCacheCollection();
  const now = Timestamp.now();
  const ttl = Timestamp.fromMillis(now.toMillis() + 30 * 60 * 1000); // 30 minutes
  
  const docRef = await addDoc(cacheRef, {
    ...cacheData,
    calculatedAt: now,
    ttl,
  });
  
  return docRef.id;
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(): Promise<number> {
  const cacheRef = getTeamMetricsCacheCollection();
  const now = Timestamp.now();
  
  const q = query(cacheRef, where('ttl', '<', now));
  const snapshot = await getDocs(q);
  
  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);
  
  return snapshot.size;
}

/**
 * Clear all cache entries for a specific team
 */
export async function clearTeamCache(teamId: string): Promise<number> {
  const cacheRef = getTeamMetricsCacheCollection();
  
  const q = query(cacheRef, where('teamId', '==', teamId));
  const snapshot = await getDocs(q);
  
  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);
  
  return snapshot.size;
}

// ─── Batch Operations ────────────────────────────────────────────────────────

/**
 * Create multiple tasks in a batch
 */
export async function createTasksBatch(
  tasksData: Array<Omit<TaskDocument, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<string[]> {
  const taskIds: string[] = [];
  
  for (const taskData of tasksData) {
    const taskId = await createTask(taskData);
    taskIds.push(taskId);
  }
  
  return taskIds;
}

/**
 * Create multiple worklogs in a batch
 */
export async function createWorklogsBatch(
  worklogsData: Array<Omit<WorklogDocument, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<string[]> {
  const worklogIds: string[] = [];
  
  for (const worklogData of worklogsData) {
    const worklogId = await createWorklog(worklogData);
    worklogIds.push(worklogId);
  }
  
  return worklogIds;
}
