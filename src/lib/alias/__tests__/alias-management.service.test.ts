/**
 * Unit Tests for Alias Management Service
 * 
 * Tests cover:
 * - Alias format validation
 * - Alias uniqueness checks
 * - Alias generation from names
 * - Alias updates with validation
 * - Historical data migration
 */

import {
  validateAliasFormat,
  isAliasUnique,
  generateAliasFromName,
  updateUserAlias,
  migrateHistoricalData,
  getUserByAlias,
  getAvailableAlias,
  type AliasValidationResult,
} from '../alias-management.service';
import * as firestore from 'firebase/firestore';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toMillis: () => Date.now() })),
  },
  writeBatch: jest.fn(),
  doc: jest.fn(),
}));

jest.mock('@/lib/firebaseConfig', () => ({
  db: {},
}));

jest.mock('@/lib/firebase/collections', () => ({
  getUsersCollection: jest.fn(() => 'users-collection'),
  getTasksCollection: jest.fn(() => 'tasks-collection'),
  getWorklogsCollection: jest.fn(() => 'worklogs-collection'),
}));

describe('Alias Management Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Alias Format Validation Tests ────────────────────────────────────────

  describe('validateAliasFormat', () => {
    it('should accept valid lowercase alphanumeric alias', () => {
      const result = validateAliasFormat('john123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid alias with dots', () => {
      const result = validateAliasFormat('john.doe');
      expect(result.valid).toBe(true);
    });

    it('should accept valid alias with hyphens', () => {
      const result = validateAliasFormat('john-doe');
      expect(result.valid).toBe(true);
    });

    it('should accept valid alias with underscores', () => {
      const result = validateAliasFormat('john_doe');
      expect(result.valid).toBe(true);
    });

    it('should accept valid alias with mixed special characters', () => {
      const result = validateAliasFormat('john.doe-smith_123');
      expect(result.valid).toBe(true);
    });

    it('should reject empty alias', () => {
      const result = validateAliasFormat('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Alias is required');
    });

    it('should reject alias shorter than 3 characters', () => {
      const result = validateAliasFormat('ab');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 3 characters');
    });

    it('should reject alias longer than 50 characters', () => {
      const longAlias = 'a'.repeat(51);
      const result = validateAliasFormat(longAlias);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not exceed 50 characters');
    });

    it('should reject uppercase letters', () => {
      const result = validateAliasFormat('JohnDoe');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Alias must be lowercase');
    });

    it('should reject alias starting with number', () => {
      const result = validateAliasFormat('123john');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Alias must start with a letter');
    });

    it('should reject alias starting with special character', () => {
      const result = validateAliasFormat('.john');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Alias must start with a letter');
    });

    it('should reject alias ending with special character', () => {
      const result = validateAliasFormat('john.');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Alias must end with a letter or number');
    });

    it('should reject consecutive dots', () => {
      const result = validateAliasFormat('john..doe');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('consecutive special characters');
    });

    it('should reject consecutive hyphens', () => {
      const result = validateAliasFormat('john--doe');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('consecutive special characters');
    });

    it('should reject consecutive underscores', () => {
      const result = validateAliasFormat('john__doe');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('consecutive special characters');
    });

    it('should reject mixed consecutive special characters', () => {
      const result = validateAliasFormat('john.-doe');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('consecutive special characters');
    });

    it('should reject invalid characters', () => {
      const result = validateAliasFormat('john@doe');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase letters, numbers, dots, hyphens, and underscores');
    });

    it('should reject spaces', () => {
      const result = validateAliasFormat('john doe');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase letters, numbers, dots, hyphens, and underscores');
    });

    it('should accept minimum length alias', () => {
      const result = validateAliasFormat('abc');
      expect(result.valid).toBe(true);
    });

    it('should accept maximum length alias', () => {
      const maxAlias = 'a' + 'b'.repeat(48) + 'c'; // 50 characters
      const result = validateAliasFormat(maxAlias);
      expect(result.valid).toBe(true);
    });
  });

  // ─── Alias Uniqueness Tests ───────────────────────────────────────────────

  describe('isAliasUnique', () => {
    it('should return true when alias is not in use', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      } as any);

      const result = await isAliasUnique('john.doe');
      expect(result).toBe(true);
    });

    it('should return false when alias is already in use', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => ({ uid: 'user123', alias: 'john.doe' }),
          },
        ],
      } as any);

      const result = await isAliasUnique('john.doe');
      expect(result).toBe(false);
    });

    it('should return true when alias is used by excluded user', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => ({ uid: 'user123', alias: 'john.doe' }),
          },
        ],
      } as any);

      const result = await isAliasUnique('john.doe', 'user123');
      expect(result).toBe(true);
    });

    it('should return false when alias is used by different user', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => ({ uid: 'user456', alias: 'john.doe' }),
          },
        ],
      } as any);

      const result = await isAliasUnique('john.doe', 'user123');
      expect(result).toBe(false);
    });

    it('should throw error on database failure', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      mockGetDocs.mockRejectedValue(new Error('Database error'));

      await expect(isAliasUnique('john.doe')).rejects.toThrow('Failed to check alias availability');
    });
  });

  // ─── Alias Generation Tests ────────────────────────────────────────────────

  describe('generateAliasFromName', () => {
    it('should generate alias from simple name', () => {
      const alias = generateAliasFromName('John Doe');
      expect(alias).toBe('john.doe');
    });

    it('should generate alias from name with multiple spaces', () => {
      const alias = generateAliasFromName('John   Doe   Smith');
      expect(alias).toBe('john.doe.smith');
    });

    it('should remove invalid characters', () => {
      const alias = generateAliasFromName('John@Doe#Smith');
      expect(alias).toBe('johndoesmith');
    });

    it('should handle names with numbers', () => {
      const alias = generateAliasFromName('John Doe 123');
      expect(alias).toBe('john.doe.123');
    });

    it('should handle names with hyphens', () => {
      const alias = generateAliasFromName('Mary-Jane Watson');
      expect(alias).toBe('mary.jane.watson');
    });

    it('should convert to lowercase', () => {
      const alias = generateAliasFromName('JOHN DOE');
      expect(alias).toBe('john.doe');
    });

    it('should trim whitespace', () => {
      const alias = generateAliasFromName('  John Doe  ');
      expect(alias).toBe('john.doe');
    });

    it('should handle single name', () => {
      const alias = generateAliasFromName('John');
      expect(alias).toBe('john'); // 4 characters, no padding needed
    });

    it('should pad very short names', () => {
      const alias = generateAliasFromName('Jo');
      expect(alias).toBe('jo1'); // Padded to meet minimum length of 3
    });

    it('should truncate long names', () => {
      const longName = 'A'.repeat(60) + ' ' + 'B'.repeat(60);
      const alias = generateAliasFromName(longName);
      expect(alias.length).toBeLessThanOrEqual(50);
    });

    it('should handle names with special characters', () => {
      const alias = generateAliasFromName('José María García');
      expect(alias).toBe('jos.mara.garca');
    });

    it('should throw error for empty name', () => {
      expect(() => generateAliasFromName('')).toThrow('Full name is required');
    });

    it('should throw error for whitespace-only name', () => {
      expect(() => generateAliasFromName('   ')).toThrow('Full name is required');
    });

    it('should remove consecutive special characters', () => {
      const alias = generateAliasFromName('John...Doe');
      expect(alias).toBe('john.doe');
    });

    it('should remove leading special characters', () => {
      const alias = generateAliasFromName('...John Doe');
      expect(alias).toBe('john.doe');
    });

    it('should remove trailing special characters', () => {
      const alias = generateAliasFromName('John Doe...');
      expect(alias).toBe('john.doe');
    });

    it('should handle names with only special characters gracefully', () => {
      const alias = generateAliasFromName('!!!');
      expect(alias).toMatch(/^[a-z]/); // Should start with a letter
      expect(alias.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ─── Alias Update Tests ────────────────────────────────────────────────────

  describe('updateUserAlias', () => {
    it('should update alias successfully', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      const mockUpdateDoc = firestore.updateDoc as jest.MockedFunction<typeof firestore.updateDoc>;

      // Mock uniqueness check (alias is unique)
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
              data: () => ({ uid: 'user123', alias: 'old.alias' }),
            },
          ],
        } as any)
        // Mock user query for migration (getUserByAlias in migrateHistoricalData)
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            {
              data: () => ({ uid: 'user123', alias: 'old.alias' }),
            },
          ],
        } as any)
        // Mock tasks query for migration
        .mockResolvedValueOnce({
          size: 5,
          docs: [],
        } as any)
        // Mock worklogs query for migration
        .mockResolvedValueOnce({
          size: 10,
          docs: [],
        } as any);

      mockUpdateDoc.mockResolvedValue(undefined as any);

      await updateUserAlias('user123', 'new.alias');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'user-doc-ref',
        expect.objectContaining({
          alias: 'new.alias',
        })
      );
    });

    it('should reject invalid alias format', async () => {
      await expect(updateUserAlias('user123', 'INVALID')).rejects.toThrow('must be lowercase');
    });

    it('should reject non-unique alias', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      
      // First call: uniqueness check returns false (alias is taken)
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            data: () => ({ uid: 'other-user', alias: 'taken.alias' }),
          },
        ],
      } as any);

      await expect(updateUserAlias('user123', 'taken.alias')).rejects.toThrow('already in use');
    });

    it('should reject update for non-existent user', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      mockGetDocs
        .mockResolvedValueOnce({
          empty: true,
          docs: [],
        } as any)
        .mockResolvedValueOnce({
          empty: true,
          docs: [],
        } as any);

      await expect(updateUserAlias('nonexistent', 'new.alias')).rejects.toThrow('User not found');
    });
  });

  // ─── Historical Data Migration Tests ──────────────────────────────────────

  describe('migrateHistoricalData', () => {
    it('should log migration statistics', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      mockGetDocs
        // Mock user query
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            {
              data: () => ({ uid: 'user123', alias: 'old.alias' }),
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

      await migrateHistoricalData('old.alias', 'new.alias');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tasks affected: 5')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Worklogs affected: 10')
      );

      consoleSpy.mockRestore();
    });

    it('should handle user not found gracefully', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      } as any);

      await migrateHistoricalData('nonexistent', 'new.alias');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No user found with alias')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should throw error on database failure', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      mockGetDocs.mockRejectedValue(new Error('Database error'));

      await expect(migrateHistoricalData('old.alias', 'new.alias')).rejects.toThrow(
        'Failed to migrate historical data'
      );
    });
  });

  // ─── Utility Function Tests ────────────────────────────────────────────────

  describe('getUserByAlias', () => {
    it('should return user document when found', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      const mockUser = {
        uid: 'user123',
        alias: 'john.doe',
        fullName: 'John Doe',
      };

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => mockUser,
          },
        ],
      } as any);

      const result = await getUserByAlias('john.doe');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      } as any);

      const result = await getUserByAlias('nonexistent');
      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      mockGetDocs.mockRejectedValue(new Error('Database error'));

      await expect(getUserByAlias('john.doe')).rejects.toThrow('Failed to fetch user by alias');
    });
  });

  describe('getAvailableAlias', () => {
    it('should return original alias if available', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      } as any);

      const result = await getAvailableAlias('john.doe');
      expect(result).toBe('john.doe');
    });

    it('should append number if alias is taken', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      mockGetDocs
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ data: () => ({ alias: 'john.doe' }) }],
        } as any)
        .mockResolvedValueOnce({
          empty: true,
          docs: [],
        } as any);

      const result = await getAvailableAlias('john.doe');
      expect(result).toBe('john.doe2');
    });

    it('should increment number until available alias found', async () => {
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      mockGetDocs
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ data: () => ({ alias: 'john.doe' }) }],
        } as any)
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ data: () => ({ alias: 'john.doe2' }) }],
        } as any)
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ data: () => ({ alias: 'john.doe3' }) }],
        } as any)
        .mockResolvedValueOnce({
          empty: true,
          docs: [],
        } as any);

      const result = await getAvailableAlias('john.doe');
      expect(result).toBe('john.doe4');
    });

    it('should throw error for invalid alias format', async () => {
      await expect(getAvailableAlias('INVALID')).rejects.toThrow('Invalid alias format');
    });

    it('should handle long aliases by truncating', async () => {
      const longAlias = 'a'.repeat(50);
      const mockGetDocs = firestore.getDocs as jest.MockedFunction<typeof firestore.getDocs>;
      mockGetDocs
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ data: () => ({ alias: longAlias }) }],
        } as any)
        .mockResolvedValueOnce({
          empty: true,
          docs: [],
        } as any);

      const result = await getAvailableAlias(longAlias);
      expect(result.length).toBeLessThanOrEqual(50);
      expect(result).toMatch(/\d+$/); // Should end with a number
    });
  });
});
