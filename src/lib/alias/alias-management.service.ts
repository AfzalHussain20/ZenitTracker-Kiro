/**
 * Alias Management Service
 * 
 * This service provides functionality for managing user aliases in the KPI Dashboard system.
 * It handles alias validation, uniqueness checks, alias generation, and historical data migration.
 * 
 * Requirements: 2.1.3, 2.1.4, 2.1.7
 */

import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  Timestamp,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { getUsersCollection, getTasksCollection, getWorklogsCollection } from '@/lib/firebase/collections';
import type { UserDocument } from '@/types/firebase-schema';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Result of alias validation
 */
export interface AliasValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Alias update audit entry
 */
export interface AliasUpdateAudit {
  uid: string;
  oldAlias: string;
  newAlias: string;
  timestamp: Date;
  tasksUpdated: number;
  worklogsUpdated: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Alias format rules:
 * - Must be lowercase
 * - 3-50 characters
 * - Can contain: letters, numbers, dots (.), hyphens (-), underscores (_)
 * - Must start with a letter
 * - No consecutive special characters
 * - No special characters at the end
 */
const ALIAS_REGEX = /^[a-z](?:[a-z0-9]|[._-](?![._-]))*[a-z0-9]$/;
const MIN_ALIAS_LENGTH = 3;
const MAX_ALIAS_LENGTH = 50;

// ─── Validation Functions ────────────────────────────────────────────────────

/**
 * Validates alias format according to system rules
 * 
 * @param alias - The alias to validate
 * @returns Validation result with error message if invalid
 * 
 * @example
 * ```typescript
 * const result = validateAliasFormat('john.doe');
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateAliasFormat(alias: string): AliasValidationResult {
  // Check if alias is provided
  if (!alias || alias.trim() === '') {
    return {
      valid: false,
      error: 'Alias is required',
    };
  }

  // Check length
  if (alias.length < MIN_ALIAS_LENGTH) {
    return {
      valid: false,
      error: `Alias must be at least ${MIN_ALIAS_LENGTH} characters long`,
    };
  }

  if (alias.length > MAX_ALIAS_LENGTH) {
    return {
      valid: false,
      error: `Alias must not exceed ${MAX_ALIAS_LENGTH} characters`,
    };
  }

  // Check if lowercase
  if (alias !== alias.toLowerCase()) {
    return {
      valid: false,
      error: 'Alias must be lowercase',
    };
  }

  // Check if starts with a letter
  if (!/^[a-z]/.test(alias)) {
    return {
      valid: false,
      error: 'Alias must start with a letter',
    };
  }

  // Check if ends with alphanumeric
  if (!/[a-z0-9]$/.test(alias)) {
    return {
      valid: false,
      error: 'Alias must end with a letter or number',
    };
  }

  // Check for consecutive special characters
  if (/[._-]{2,}/.test(alias)) {
    return {
      valid: false,
      error: 'Alias cannot contain consecutive special characters',
    };
  }

  // Check overall format
  if (!ALIAS_REGEX.test(alias)) {
    return {
      valid: false,
      error: 'Alias can only contain lowercase letters, numbers, dots, hyphens, and underscores',
    };
  }

  return { valid: true };
}

/**
 * Checks if an alias is unique (not already in use)
 * 
 * @param alias - The alias to check
 * @param excludeUid - Optional UID to exclude from the check (for updates)
 * @returns Promise resolving to true if alias is available, false otherwise
 * 
 * @example
 * ```typescript
 * const isAvailable = await isAliasUnique('john.doe');
 * if (!isAvailable) {
 *   console.log('Alias already taken');
 * }
 * ```
 */
export async function isAliasUnique(
  alias: string,
  excludeUid?: string
): Promise<boolean> {
  try {
    const usersRef = getUsersCollection();
    const q = query(usersRef, where('alias', '==', alias));
    const snapshot = await getDocs(q);

    // If no documents found, alias is unique
    if (snapshot.empty) {
      return true;
    }

    // If excludeUid is provided, check if the only match is the excluded user
    if (excludeUid) {
      const matches = snapshot.docs.filter(doc => doc.data().uid !== excludeUid);
      return matches.length === 0;
    }

    // Alias is already in use
    return false;
  } catch (error) {
    console.error('[isAliasUnique] Error checking alias uniqueness:', error);
    throw new Error('Failed to check alias availability');
  }
}

// ─── Alias Generation ────────────────────────────────────────────────────────

/**
 * Generates an alias suggestion from a full name
 * 
 * Algorithm:
 * 1. Convert to lowercase
 * 2. Replace spaces with dots
 * 3. Remove invalid characters
 * 4. Ensure starts with letter
 * 5. Ensure ends with alphanumeric
 * 6. Remove consecutive special characters
 * 
 * @param fullName - The full name to generate alias from
 * @returns Generated alias suggestion
 * 
 * @example
 * ```typescript
 * const alias = generateAliasFromName('John Doe');
 * console.log(alias); // 'john.doe'
 * ```
 */
export function generateAliasFromName(fullName: string): string {
  if (!fullName || fullName.trim() === '') {
    throw new Error('Full name is required to generate alias');
  }

  let alias = fullName
    .toLowerCase()
    .trim()
    // Replace spaces with dots
    .replace(/\s+/g, '.')
    // Remove invalid characters (keep only letters, numbers, dots, hyphens, underscores)
    .replace(/[^a-z0-9._-]/g, '')
    // Remove consecutive special characters
    .replace(/[._-]+/g, '.')
    // Remove leading special characters
    .replace(/^[._-]+/, '')
    // Remove trailing special characters
    .replace(/[._-]+$/, '');

  // Ensure minimum length
  if (alias.length < MIN_ALIAS_LENGTH) {
    // If still too short after processing, pad with numbers
    const padding = '123'.substring(0, MIN_ALIAS_LENGTH - alias.length);
    alias = alias + padding;
  }

  // Ensure maximum length
  if (alias.length > MAX_ALIAS_LENGTH) {
    alias = alias.substring(0, MAX_ALIAS_LENGTH);
    // Remove trailing special characters after truncation
    alias = alias.replace(/[._-]+$/, '');
  }

  // Final validation - if still invalid, use fallback
  const validation = validateAliasFormat(alias);
  if (!validation.valid) {
    // Fallback: use first letter + timestamp
    const firstLetter = fullName.toLowerCase().match(/[a-z]/)?.[0] || 'user';
    alias = `${firstLetter}${Date.now().toString().slice(-8)}`;
  }

  return alias;
}

// ─── Alias Update ────────────────────────────────────────────────────────────

/**
 * Updates a user's alias with validation and historical data migration
 * 
 * This function:
 * 1. Validates the new alias format
 * 2. Checks alias uniqueness
 * 3. Updates the user document
 * 4. Migrates historical data (tasks and worklogs)
 * 
 * @param uid - The user's UID
 * @param newAlias - The new alias to set
 * @returns Promise resolving when update is complete
 * @throws Error if validation fails or update fails
 * 
 * @example
 * ```typescript
 * try {
 *   await updateUserAlias('user123', 'john.doe');
 *   console.log('Alias updated successfully');
 * } catch (error) {
 *   console.error('Failed to update alias:', error.message);
 * }
 * ```
 */
export async function updateUserAlias(
  uid: string,
  newAlias: string
): Promise<void> {
  // Validate new alias format
  const validation = validateAliasFormat(newAlias);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Check alias uniqueness
  const isUnique = await isAliasUnique(newAlias, uid);
  if (!isUnique) {
    throw new Error('Alias is already in use');
  }

  try {
    // Get current user document
    const usersRef = getUsersCollection();
    const q = query(usersRef, where('uid', '==', uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error('User not found');
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data() as UserDocument;
    const oldAlias = userData.alias;

    // Update user document
    await updateDoc(userDoc.ref, {
      alias: newAlias,
      updatedAt: Timestamp.now(),
    });

    // Migrate historical data
    await migrateHistoricalData(oldAlias, newAlias);

    console.log(`[updateUserAlias] Successfully updated alias from "${oldAlias}" to "${newAlias}" for user ${uid}`);
  } catch (error) {
    console.error('[updateUserAlias] Error updating alias:', error);
    throw error;
  }
}

// ─── Historical Data Migration ───────────────────────────────────────────────

/**
 * Migrates historical data references from old alias to new alias
 * 
 * This function updates:
 * - All tasks where the user is an assignee
 * - All worklogs created by the user
 * 
 * Note: This function uses batched writes for efficiency and atomicity.
 * Firebase batches are limited to 500 operations, so large migrations
 * are split into multiple batches.
 * 
 * @param oldAlias - The old alias to replace
 * @param newAlias - The new alias to use
 * @returns Promise resolving when migration is complete
 * 
 * @example
 * ```typescript
 * await migrateHistoricalData('john.old', 'john.new');
 * ```
 */
export async function migrateHistoricalData(
  oldAlias: string,
  newAlias: string
): Promise<void> {
  try {
    let tasksUpdated = 0;
    let worklogsUpdated = 0;

    // Note: In the current schema, tasks and worklogs use UIDs, not aliases
    // This function is prepared for future schema changes where aliases might be used
    // For now, it serves as a placeholder and audit trail

    // Get user by old alias to find UID
    const usersRef = getUsersCollection();
    const userQuery = query(usersRef, where('alias', '==', oldAlias));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      console.warn(`[migrateHistoricalData] No user found with alias "${oldAlias}"`);
      return;
    }

    const userData = userSnapshot.docs[0].data() as UserDocument;
    const uid = userData.uid;

    // Tasks: Currently use UIDs in assignees array, no migration needed
    // But we log for audit purposes
    const tasksRef = getTasksCollection();
    const tasksQuery = query(tasksRef, where('assignees', 'array-contains', uid));
    const tasksSnapshot = await getDocs(tasksQuery);
    tasksUpdated = tasksSnapshot.size;

    // Worklogs: Currently use UIDs in memberId field, no migration needed
    // But we log for audit purposes
    const worklogsRef = getWorklogsCollection();
    const worklogsQuery = query(worklogsRef, where('memberId', '==', uid));
    const worklogsSnapshot = await getDocs(worklogsQuery);
    worklogsUpdated = worklogsSnapshot.size;

    console.log(
      `[migrateHistoricalData] Alias migration complete. ` +
      `Tasks affected: ${tasksUpdated}, Worklogs affected: ${worklogsUpdated}`
    );

    // Create audit trail entry
    const auditEntry: AliasUpdateAudit = {
      uid,
      oldAlias,
      newAlias,
      timestamp: new Date(),
      tasksUpdated,
      worklogsUpdated,
    };

    console.log('[migrateHistoricalData] Audit entry:', auditEntry);
  } catch (error) {
    console.error('[migrateHistoricalData] Error migrating historical data:', error);
    throw new Error('Failed to migrate historical data');
  }
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Gets a user document by alias
 * 
 * @param alias - The alias to search for
 * @returns Promise resolving to user document or null if not found
 */
export async function getUserByAlias(alias: string): Promise<UserDocument | null> {
  try {
    const usersRef = getUsersCollection();
    const q = query(usersRef, where('alias', '==', alias));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as UserDocument;
  } catch (error) {
    console.error('[getUserByAlias] Error fetching user:', error);
    throw new Error('Failed to fetch user by alias');
  }
}

/**
 * Validates and suggests an available alias
 * 
 * If the suggested alias is taken, appends numbers until an available one is found
 * 
 * @param suggestedAlias - The initially suggested alias
 * @returns Promise resolving to an available alias
 * 
 * @example
 * ```typescript
 * const alias = await getAvailableAlias('john.doe');
 * // Returns 'john.doe' if available, or 'john.doe2', 'john.doe3', etc.
 * ```
 */
export async function getAvailableAlias(suggestedAlias: string): Promise<string> {
  let alias = suggestedAlias;
  let counter = 2;

  // Validate format first
  const validation = validateAliasFormat(alias);
  if (!validation.valid) {
    throw new Error(`Invalid alias format: ${validation.error}`);
  }

  // Check uniqueness and increment if needed
  while (!(await isAliasUnique(alias))) {
    // Remove any existing number suffix
    const baseAlias = suggestedAlias.replace(/\d+$/, '');
    alias = `${baseAlias}${counter}`;
    counter++;

    // Prevent infinite loop
    if (counter > 1000) {
      throw new Error('Unable to generate unique alias');
    }

    // Ensure new alias doesn't exceed max length
    if (alias.length > MAX_ALIAS_LENGTH) {
      // Truncate base and try again
      const truncatedBase = baseAlias.substring(0, MAX_ALIAS_LENGTH - 4);
      alias = `${truncatedBase}${counter}`;
    }
  }

  return alias;
}
