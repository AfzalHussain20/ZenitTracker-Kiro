/**
 * Integration Tests for Alias Management System
 * 
 * Tests the complete end-to-end flows for alias management including:
 * - Alias creation and validation
 * - Uniqueness enforcement across multiple users
 * - Alias updates with historical data migration
 * - Concurrent alias operations
 * - Error recovery scenarios
 * 
 * Validates Requirements: 2.1.1-2.1.7
 */

import {
  validateAliasFormat,
  isAliasUnique,
  generateAliasFromName,
  updateUserAlias,
  getUserByAlias,
  getAvailableAlias,
} from '../alias-management.service';
import {
  createUser,
  getUserByUid,
  updateUser,
} from '@/lib/firebase/operations';
import * as firestore from 'firebase/firestore';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  doc: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toMillis: () => Date.now() })),
    fromDate: jest.fn((date) => ({ toMillis: () => date.getTime() })),
  },
  orderBy: jest.fn(),
  limit: jest.fn(),
}));

jest.mock('@/lib/firebaseConfig', () => ({
  db: {},
}));

jest.mock('@/lib/firebase/collections', () => ({
  getUsersCollection: jest.fn(() => 'users-collection'),
  getTasksCollection: jest.fn(() => 'tasks-collection'),
  getWorklogsCollection: jest.fn(() => 'worklogs-collection'),
}));

describe('Alias System Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Validates: Requirements 2.1.1, 2.1.2, 2.1.3
   * End-to-end alias creation workflow
   */
  describe('Complete alias creation workflow', () => {
    it('should create user with valid unique alias', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      const mockAddDoc = firestore.addDoc as jest.MockedFunction<typeof firestore.addDoc>;

      // Mock alias uniqueness check (alias is available)
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      } as any);

      // Mock user creation
      mockAddDoc.mockResolvedValue({
        id: 'user-doc-id',
      } as any);

      // Step 1: Generate alias from name
      const alias = generateAliasFromName('John Doe');
      expect(alias).toBe('john.doe');

      // Step 2: Validate alias format
      const validation = validateAliasFormat(alias);
      expect(validation.valid).toBe(true);

      // Step 3: Check alias uniqueness
      const isUnique = await isAliasUnique(alias);
      expect(isUnique).toBe(true);

      // Step 4: Create user with alias
      const userId = await createUser({
        uid: 'user-123',
        alias: 'john.doe',
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        jiraAccountId: 'jira-123',
        team: 'dev-team',
        role: 'Developer',
        contactDetails: {
          email: 'john.doe@example.com',
        },
      });

      expect(userId).toBe('user-doc-id');
      expect(mockAddDoc).toHaveBeenCalledWith(
        'users-collection',
        expect.objectContaining({
          alias: 'john.doe',
          fullName: 'John Doe',
        })
      );
    });

    it('should handle alias generation for complex names', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;

      // Mock alias uniqueness check
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      } as any);

      // Test various name formats
      const testCases = [
        { name: 'Mary Jane Watson', expected: 'mary.jane.watson' },
        { name: 'José María García', expected: 'jos.mara.garca' },
        { name: 'John   Doe   Smith', expected: 'john.doe.smith' },
        { name: 'John-Paul Smith', expected: 'john.paul.smith' },
        { name: 'John@Doe#123', expected: 'johndoe123' },
      ];

      for (const testCase of testCases) {
        const alias = generateAliasFromName(testCase.name);
        expect(alias).toBe(testCase.expected);

        const validation = validateAliasFormat(alias);
        expect(validation.valid).toBe(true);

        const isUnique = await isAliasUnique(alias);
        expect(isUnique).toBe(true);
      }
    });

    it('should auto-increment alias when suggested alias is taken', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;

      // Mock: first check shows alias is taken, second check shows incremented alias is available
      mockGetDocs
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            {
              data: () => ({ uid: 'other-user', alias: 'john.doe' }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          empty: true,
          docs: [],
        } as any);

      const suggestedAlias = 'john.doe';
      const availableAlias = await getAvailableAlias(suggestedAlias);

      expect(availableAlias).toBe('john.doe2');
    });
  });

  /**
   * Validates: Requirement 2.1.3
   * Uniqueness enforcement across multiple users
   */
  describe('Alias uniqueness enforcement', () => {
    it('should prevent duplicate aliases across different users', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;

      // Mock: alias already exists for another user
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => ({ uid: 'existing-user', alias: 'john.doe' }),
          },
        ],
      } as any);

      const isUnique = await isAliasUnique('john.doe');
      expect(isUnique).toBe(false);
    });

    it('should allow same alias for same user during update', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;

      // Mock: alias exists but belongs to the user being updated
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => ({ uid: 'user-123', alias: 'john.doe' }),
          },
        ],
      } as any);

      const isUnique = await isAliasUnique('john.doe', 'user-123');
      expect(isUnique).toBe(true);
    });

    it('should detect conflicts when multiple users try to claim same alias', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;

      // Simulate concurrent alias checks
      const alias = 'popular.alias';

      // First user checks - alias is available
      mockGetDocs.mockResolvedValueOnce({
        empty: true,
        docs: [],
      } as any);

      const firstCheck = await isAliasUnique(alias);
      expect(firstCheck).toBe(true);

      // Second user checks - alias is now taken
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            data: () => ({ uid: 'first-user', alias: 'popular.alias' }),
          },
        ],
      } as any);

      const secondCheck = await isAliasUnique(alias);
      expect(secondCheck).toBe(false);
    });

    it('should enforce uniqueness across all teams', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;

      // Mock: alias exists in different team
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => ({
              uid: 'user-in-qa-team',
              alias: 'john.doe',
              team: 'qa-team',
            }),
          },
        ],
      } as any);

      // Try to use same alias in dev team
      const isUnique = await isAliasUnique('john.doe');
      expect(isUnique).toBe(false);
    });
  });

  /**
   * Validates: Requirements 2.1.4, 2.1.7
   * Alias updates with historical data migration
   */
  describe('Alias update workflow', () => {
    it('should update alias and migrate historical data', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      const mockUpdateDoc = firestore.updateDoc as jest.MockedFunction<typeof firestore.updateDoc>;

      // Mock uniqueness check (new alias is available)
      mockGetDocs
        .mockResolvedValueOnce({
          empty: true,
          docs: [],
        } as any)
        // Mock user fetch
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            {
              ref: 'user-doc-ref',
              data: () => ({
                uid: 'user-123',
                alias: 'old.alias',
                fullName: 'John Doe',
              }),
            },
          ],
        } as any)
        // Mock user query for migration
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            {
              data: () => ({ uid: 'user-123', alias: 'old.alias' }),
            },
          ],
        } as any)
        // Mock tasks query
        .mockResolvedValueOnce({
          size: 5,
          docs: [],
        } as any)
        // Mock worklogs query
        .mockResolvedValueOnce({
          size: 10,
          docs: [],
        } as any);

      mockUpdateDoc.mockResolvedValue(undefined as any);

      await updateUserAlias('user-123', 'new.alias');

      // Verify user document was updated
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'user-doc-ref',
        expect.objectContaining({
          alias: 'new.alias',
        })
      );

      // Verify migration queries were executed
      expect(mockGetDocs).toHaveBeenCalledTimes(5);
    });

    it('should validate new alias before updating', async () => {
      // Try to update with invalid alias
      await expect(updateUserAlias('user-123', 'INVALID')).rejects.toThrow(
        'must be lowercase'
      );

      await expect(updateUserAlias('user-123', 'ab')).rejects.toThrow(
        'at least 3 characters'
      );

      await expect(updateUserAlias('user-123', 'john..doe')).rejects.toThrow(
        'consecutive special characters'
      );
    });

    it('should prevent updating to an already-taken alias', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;

      // Mock: new alias is already taken by another user
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => ({ uid: 'other-user', alias: 'taken.alias' }),
          },
        ],
      } as any);

      await expect(updateUserAlias('user-123', 'taken.alias')).rejects.toThrow(
        'already in use'
      );
    });

    it('should handle alias update for non-existent user', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;

      mockGetDocs
        // Mock uniqueness check (alias is available)
        .mockResolvedValueOnce({
          empty: true,
          docs: [],
        } as any)
        // Mock user fetch (user not found)
        .mockResolvedValueOnce({
          empty: true,
          docs: [],
        } as any);

      await expect(updateUserAlias('nonexistent-user', 'new.alias')).rejects.toThrow(
        'User not found'
      );
    });

    it('should maintain data consistency during alias update', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      const mockUpdateDoc = firestore.updateDoc as jest.MockedFunction<typeof firestore.updateDoc>;

      const oldAlias = 'john.old';
      const newAlias = 'john.new';

      mockGetDocs
        // Uniqueness check
        .mockResolvedValueOnce({
          empty: true,
          docs: [],
        } as any)
        // User fetch
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            {
              ref: 'user-doc-ref',
              data: () => ({ uid: 'user-123', alias: oldAlias }),
            },
          ],
        } as any)
        // Migration: user query
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            {
              data: () => ({ uid: 'user-123', alias: oldAlias }),
            },
          ],
        } as any)
        // Migration: tasks query
        .mockResolvedValueOnce({
          size: 3,
          docs: [
            { id: 'task-1', data: () => ({ assignees: ['user-123'] }) },
            { id: 'task-2', data: () => ({ assignees: ['user-123'] }) },
            { id: 'task-3', data: () => ({ assignees: ['user-123'] }) },
          ],
        } as any)
        // Migration: worklogs query
        .mockResolvedValueOnce({
          size: 7,
          docs: [
            { id: 'worklog-1', data: () => ({ memberId: 'user-123' }) },
            { id: 'worklog-2', data: () => ({ memberId: 'user-123' }) },
            { id: 'worklog-3', data: () => ({ memberId: 'user-123' }) },
            { id: 'worklog-4', data: () => ({ memberId: 'user-123' }) },
            { id: 'worklog-5', data: () => ({ memberId: 'user-123' }) },
            { id: 'worklog-6', data: () => ({ memberId: 'user-123' }) },
            { id: 'worklog-7', data: () => ({ memberId: 'user-123' }) },
          ],
        } as any);

      mockUpdateDoc.mockResolvedValue(undefined as any);

      await updateUserAlias('user-123', newAlias);

      // Verify update was called
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'user-doc-ref',
        expect.objectContaining({
          alias: newAlias,
        })
      );
    });
  });

  /**
   * Validates: Requirements 2.1.5, 2.1.6
   * Searching and filtering by alias
   */
  describe('Alias search and retrieval', () => {
    it('should retrieve user by alias', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;

      const mockUser = {
        uid: 'user-123',
        alias: 'john.doe',
        fullName: 'John Doe',
        email: 'john.doe@example.com',
      };

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => mockUser,
          },
        ],
      } as any);

      const user = await getUserByAlias('john.doe');

      expect(user).toEqual(mockUser);
    });

    it('should return null for non-existent alias', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;

      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      } as any);

      const user = await getUserByAlias('nonexistent.alias');

      expect(user).toBeNull();
    });

    it('should handle case-sensitive alias search', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;

      // Aliases are lowercase, so uppercase search should not match
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      } as any);

      const user = await getUserByAlias('JOHN.DOE');

      expect(user).toBeNull();
    });
  });

  /**
   * Validates: Requirement 2.1.7
   * Alias format validation edge cases
   */
  describe('Alias validation edge cases', () => {
    it('should validate minimum length alias', () => {
      const result = validateAliasFormat('abc');
      expect(result.valid).toBe(true);
    });

    it('should validate maximum length alias', () => {
      const maxAlias = 'a' + 'b'.repeat(48) + 'c'; // 50 characters
      const result = validateAliasFormat(maxAlias);
      expect(result.valid).toBe(true);
    });

    it('should reject alias with only special characters', () => {
      const result = validateAliasFormat('...');
      expect(result.valid).toBe(false);
    });

    it('should accept alias with numbers', () => {
      const result = validateAliasFormat('user123');
      expect(result.valid).toBe(true);
    });

    it('should accept alias with mixed valid characters', () => {
      const result = validateAliasFormat('john.doe-smith_123');
      expect(result.valid).toBe(true);
    });

    it('should reject alias with spaces', () => {
      const result = validateAliasFormat('john doe');
      expect(result.valid).toBe(false);
    });

    it('should reject alias with invalid special characters', () => {
      const invalidChars = ['@', '#', '$', '%', '^', '&', '*', '(', ')', '+', '='];

      for (const char of invalidChars) {
        const result = validateAliasFormat(`john${char}doe`);
        expect(result.valid).toBe(false);
      }
    });
  });

  /**
   * Validates: Error recovery scenarios
   */
  describe('Error recovery and edge cases', () => {
    it('should handle database connection errors gracefully', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;

      mockGetDocs.mockRejectedValue(new Error('Database connection failed'));

      await expect(isAliasUnique('john.doe')).rejects.toThrow(
        'Failed to check alias availability'
      );
    });

    it('should handle empty alias input', () => {
      const result = validateAliasFormat('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Alias is required');
    });

    it('should handle whitespace-only alias', () => {
      const result = validateAliasFormat('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Alias is required');
    });

    it('should handle very long name generation', () => {
      const longName = 'A'.repeat(100) + ' ' + 'B'.repeat(100);
      const alias = generateAliasFromName(longName);

      expect(alias.length).toBeLessThanOrEqual(50);

      const validation = validateAliasFormat(alias);
      expect(validation.valid).toBe(true);
    });

    it('should handle name with only invalid characters', () => {
      const alias = generateAliasFromName('!!!@@@###');

      // Should generate fallback alias
      expect(alias).toBeDefined();
      expect(alias.length).toBeGreaterThanOrEqual(3);

      const validation = validateAliasFormat(alias);
      expect(validation.valid).toBe(true);
    });

    it('should handle concurrent alias generation for same name', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;

      const name = 'John Doe';
      const baseAlias = 'john.doe';

      // First request: base alias is available
      mockGetDocs.mockResolvedValueOnce({
        empty: true,
        docs: [],
      } as any);

      const firstAlias = await getAvailableAlias(baseAlias);
      expect(firstAlias).toBe(baseAlias);

      // Second request: base alias is taken, get incremented version
      mockGetDocs
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ data: () => ({ alias: baseAlias }) }],
        } as any)
        .mockResolvedValueOnce({
          empty: true,
          docs: [],
        } as any);

      const secondAlias = await getAvailableAlias(baseAlias);
      expect(secondAlias).toBe('john.doe2');

      // Third request: both base and incremented are taken
      mockGetDocs
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ data: () => ({ alias: baseAlias }) }],
        } as any)
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ data: () => ({ alias: 'john.doe2' }) }],
        } as any)
        .mockResolvedValueOnce({
          empty: true,
          docs: [],
        } as any);

      const thirdAlias = await getAvailableAlias(baseAlias);
      expect(thirdAlias).toBe('john.doe3');
    });
  });

  /**
   * Validates: Complete user lifecycle with alias
   */
  describe('Complete user lifecycle', () => {
    it('should handle full user lifecycle: create → update → search', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      const mockAddDoc = firestore.addDoc as jest.MockedFunction<typeof firestore.addDoc>;
      const mockUpdateDoc = firestore.updateDoc as jest.MockedFunction<typeof firestore.updateDoc>;

      // Step 1: Create user with generated alias
      const name = 'John Doe';
      const alias = generateAliasFromName(name);
      expect(alias).toBe('john.doe');

      // Check uniqueness
      mockGetDocs.mockResolvedValueOnce({
        empty: true,
        docs: [],
      } as any);

      const isUnique = await isAliasUnique(alias);
      expect(isUnique).toBe(true);

      // Create user
      mockAddDoc.mockResolvedValue({ id: 'user-doc-id' } as any);

      const userId = await createUser({
        uid: 'user-123',
        alias: 'john.doe',
        fullName: name,
        email: 'john.doe@example.com',
        jiraAccountId: 'jira-123',
        team: 'dev-team',
        role: 'Developer',
        contactDetails: { email: 'john.doe@example.com' },
      });

      expect(userId).toBe('user-doc-id');

      // Step 2: Update alias
      const newAlias = 'j.doe';

      mockGetDocs
        // Uniqueness check
        .mockResolvedValueOnce({
          empty: true,
          docs: [],
        } as any)
        // User fetch
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            {
              ref: 'user-doc-ref',
              data: () => ({ uid: 'user-123', alias: 'john.doe' }),
            },
          ],
        } as any)
        // Migration queries
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ data: () => ({ uid: 'user-123', alias: 'john.doe' }) }],
        } as any)
        .mockResolvedValueOnce({ size: 0, docs: [] } as any)
        .mockResolvedValueOnce({ size: 0, docs: [] } as any);

      mockUpdateDoc.mockResolvedValue(undefined as any);

      await updateUserAlias('user-123', newAlias);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'user-doc-ref',
        expect.objectContaining({ alias: newAlias })
      );

      // Step 3: Search by new alias
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            data: () => ({
              uid: 'user-123',
              alias: newAlias,
              fullName: name,
            }),
          },
        ],
      } as any);

      const foundUser = await getUserByAlias(newAlias);

      expect(foundUser).toMatchObject({
        uid: 'user-123',
        alias: newAlias,
        fullName: name,
      });
    });
  });
});
