/**
 * Unit Tests for TeamCacheService
 * 
 * Tests cover:
 * - Cache hit/miss scenarios
 * - TTL expiration logic
 * - Cache invalidation
 */

import { teamCacheService } from './team-cache.service';
import { JiraTeam } from '@/types/kpi-dashboard';

describe('TeamCacheService', () => {
  // Mock data
  const mockTeams: JiraTeam[] = [
    {
      id: 'team-1',
      name: 'Dev Team',
      members: [
        { accountId: 'user-1', displayName: 'John Doe', avatarUrl: 'https://example.com/avatar1.jpg' },
        { accountId: 'user-2', displayName: 'Jane Smith', avatarUrl: 'https://example.com/avatar2.jpg' },
      ],
      teamType: 'dev',
    },
    {
      id: 'team-2',
      name: 'QA Team',
      members: [
        { accountId: 'user-3', displayName: 'Bob Johnson', avatarUrl: 'https://example.com/avatar3.jpg' },
      ],
      teamType: 'qa',
    },
  ];

  beforeEach(() => {
    // Clear cache before each test
    teamCacheService.clear();
  });

  describe('Cache Hit/Miss Scenarios', () => {
    it('should return null on cache miss (no data)', () => {
      const result = teamCacheService.get('default');
      expect(result).toBeNull();
    });

    it('should return cached data on cache hit', () => {
      teamCacheService.set(mockTeams, 'default');
      const result = teamCacheService.get('default');
      
      expect(result).toEqual(mockTeams);
      expect(result).toHaveLength(2);
      expect(result![0].name).toBe('Dev Team');
    });

    it('should handle multiple cache keys independently', () => {
      const teams1 = [mockTeams[0]];
      const teams2 = [mockTeams[1]];

      teamCacheService.set(teams1, 'key1');
      teamCacheService.set(teams2, 'key2');

      expect(teamCacheService.get('key1')).toEqual(teams1);
      expect(teamCacheService.get('key2')).toEqual(teams2);
      expect(teamCacheService.get('key3')).toBeNull();
    });

    it('should return true for has() when cache exists and is valid', () => {
      teamCacheService.set(mockTeams, 'default');
      expect(teamCacheService.has('default')).toBe(true);
    });

    it('should return false for has() when cache does not exist', () => {
      expect(teamCacheService.has('nonexistent')).toBe(false);
    });

    it('should preserve data integrity on retrieval', () => {
      teamCacheService.set(mockTeams, 'default');
      const result = teamCacheService.get('default');
      
      expect(result).toEqual(mockTeams);
      expect(result![0].members).toHaveLength(2);
      expect(result![1].members[0].displayName).toBe('Bob Johnson');
    });
  });

  describe('TTL Expiration Logic', () => {
    it('should return null when cache has expired', () => {
      // Set cache with current timestamp
      teamCacheService.set(mockTeams, 'default');
      
      // Mock Date.now to simulate time passing (31 minutes = 1860000ms)
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 31 * 60 * 1000);

      const result = teamCacheService.get('default');
      expect(result).toBeNull();

      // Restore Date.now
      Date.now = originalNow;
    });

    it('should return data when cache has not expired', () => {
      teamCacheService.set(mockTeams, 'default');
      
      // Mock Date.now to simulate time passing (29 minutes = 1740000ms)
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 29 * 60 * 1000);

      const result = teamCacheService.get('default');
      expect(result).toEqual(mockTeams);

      // Restore Date.now
      Date.now = originalNow;
    });

    it('should return false for has() when cache has expired', () => {
      teamCacheService.set(mockTeams, 'default');
      
      // Mock Date.now to simulate time passing (31 minutes)
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 31 * 60 * 1000);

      expect(teamCacheService.has('default')).toBe(false);

      // Restore Date.now
      Date.now = originalNow;
    });

    it('should automatically remove expired cache on get()', () => {
      teamCacheService.set(mockTeams, 'default');
      
      // Mock Date.now to simulate expiration
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 31 * 60 * 1000);

      // First get should return null and remove the entry
      expect(teamCacheService.get('default')).toBeNull();
      
      // Restore Date.now
      Date.now = originalNow;
      
      // Second get should still return null (entry was removed)
      expect(teamCacheService.get('default')).toBeNull();
    });

    it('should handle cache at exact TTL boundary (30 minutes)', () => {
      teamCacheService.set(mockTeams, 'default');
      
      // Mock Date.now to simulate exactly 30 minutes
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 30 * 60 * 1000);

      // At exactly 30 minutes, cache should still be valid (not expired)
      const result = teamCacheService.get('default');
      expect(result).toEqual(mockTeams);

      // Restore Date.now
      Date.now = originalNow;
    });

    it('should handle cache just after TTL boundary', () => {
      teamCacheService.set(mockTeams, 'default');
      
      // Mock Date.now to simulate 30 minutes + 1ms
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 30 * 60 * 1000 + 1);

      // Just after 30 minutes, cache should be expired
      const result = teamCacheService.get('default');
      expect(result).toBeNull();

      // Restore Date.now
      Date.now = originalNow;
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate specific cache key', () => {
      teamCacheService.set(mockTeams, 'default');
      expect(teamCacheService.get('default')).toEqual(mockTeams);

      teamCacheService.invalidate('default');
      expect(teamCacheService.get('default')).toBeNull();
    });

    it('should only invalidate specified key, not others', () => {
      teamCacheService.set(mockTeams, 'key1');
      teamCacheService.set(mockTeams, 'key2');

      teamCacheService.invalidate('key1');

      expect(teamCacheService.get('key1')).toBeNull();
      expect(teamCacheService.get('key2')).toEqual(mockTeams);
    });

    it('should handle invalidation of non-existent key gracefully', () => {
      expect(() => {
        teamCacheService.invalidate('nonexistent');
      }).not.toThrow();
    });

    it('should clear all cache entries', () => {
      teamCacheService.set(mockTeams, 'key1');
      teamCacheService.set(mockTeams, 'key2');
      teamCacheService.set(mockTeams, 'key3');

      teamCacheService.clear();

      expect(teamCacheService.get('key1')).toBeNull();
      expect(teamCacheService.get('key2')).toBeNull();
      expect(teamCacheService.get('key3')).toBeNull();
    });

    it('should clear both team cache and user cache', () => {
      teamCacheService.set(mockTeams, 'default');
      teamCacheService.setUser('user-1', { name: 'John Doe' });

      teamCacheService.clear();

      expect(teamCacheService.get('default')).toBeNull();
      expect(teamCacheService.getUser('user-1')).toBeNull();
    });
  });

  describe('Cache Metadata', () => {
    it('should return metadata for cached entry', () => {
      const beforeSet = new Date();
      teamCacheService.set(mockTeams, 'default');
      const afterSet = new Date();

      const metadata = teamCacheService.getMetadata('default');

      expect(metadata).not.toBeNull();
      expect(metadata!.lastRefresh).toBeInstanceOf(Date);
      expect(metadata!.lastRefresh.getTime()).toBeGreaterThanOrEqual(beforeSet.getTime());
      expect(metadata!.lastRefresh.getTime()).toBeLessThanOrEqual(afterSet.getTime());
      expect(metadata!.expiresAt).toBeInstanceOf(Date);
      expect(metadata!.expiresAt.getTime()).toBeGreaterThan(metadata!.lastRefresh.getTime());
    });

    it('should return null metadata for non-existent cache', () => {
      const metadata = teamCacheService.getMetadata('nonexistent');
      expect(metadata).toBeNull();
    });

    it('should calculate correct expiration time', () => {
      teamCacheService.set(mockTeams, 'default');
      const metadata = teamCacheService.getMetadata('default');

      const expectedExpiration = metadata!.lastRefresh.getTime() + 30 * 60 * 1000;
      expect(metadata!.expiresAt.getTime()).toBe(expectedExpiration);
    });
  });

  describe('User Cache', () => {
    it('should cache user data', () => {
      const userData = { name: 'John Doe', email: 'john@example.com' };
      teamCacheService.setUser('user-1', userData);

      const result = teamCacheService.getUser('user-1');
      expect(result).toEqual(userData);
    });

    it('should return null for non-existent user', () => {
      const result = teamCacheService.getUser('nonexistent');
      expect(result).toBeNull();
    });

    it('should check if user exists in cache', () => {
      teamCacheService.setUser('user-1', { name: 'John Doe' });

      expect(teamCacheService.hasUser('user-1')).toBe(true);
      expect(teamCacheService.hasUser('user-2')).toBe(false);
    });

    it('should clear only user cache', () => {
      teamCacheService.set(mockTeams, 'default');
      teamCacheService.setUser('user-1', { name: 'John Doe' });

      teamCacheService.clearUserCache();

      expect(teamCacheService.get('default')).toEqual(mockTeams);
      expect(teamCacheService.getUser('user-1')).toBeNull();
    });

    it('should handle multiple users independently', () => {
      const user1 = { name: 'John Doe' };
      const user2 = { name: 'Jane Smith' };

      teamCacheService.setUser('user-1', user1);
      teamCacheService.setUser('user-2', user2);

      expect(teamCacheService.getUser('user-1')).toEqual(user1);
      expect(teamCacheService.getUser('user-2')).toEqual(user2);
    });
  });

  describe('Cache Statistics', () => {
    it('should return correct cache statistics', () => {
      teamCacheService.set(mockTeams, 'key1');
      teamCacheService.set([mockTeams[0]], 'key2');
      teamCacheService.setUser('user-1', { name: 'John' });
      teamCacheService.setUser('user-2', { name: 'Jane' });

      const stats = teamCacheService.getStats();

      expect(stats.teamCacheSize).toBe(2);
      expect(stats.userCacheSize).toBe(2);
      expect(stats.entries).toHaveLength(2);
      expect(stats.entries[0].key).toBe('key1');
      expect(stats.entries[0].size).toBe(2);
      expect(stats.entries[1].key).toBe('key2');
      expect(stats.entries[1].size).toBe(1);
    });

    it('should calculate correct expiresIn time', () => {
      teamCacheService.set(mockTeams, 'default');
      
      const stats = teamCacheService.getStats();
      const expiresIn = stats.entries[0].expiresIn;

      // Should be close to 30 minutes (1800000ms), allow 1 second tolerance
      expect(expiresIn).toBeGreaterThan(30 * 60 * 1000 - 1000);
      expect(expiresIn).toBeLessThanOrEqual(30 * 60 * 1000);
    });

    it('should return zero statistics for empty cache', () => {
      const stats = teamCacheService.getStats();

      expect(stats.teamCacheSize).toBe(0);
      expect(stats.userCacheSize).toBe(0);
      expect(stats.entries).toHaveLength(0);
    });

    it('should show negative expiresIn for expired entries', () => {
      teamCacheService.set(mockTeams, 'default');
      
      // Mock Date.now to simulate time passing (31 minutes)
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 31 * 60 * 1000);

      const stats = teamCacheService.getStats();
      
      // expiresIn should be 0 (clamped by Math.max(0, ...))
      expect(stats.entries[0].expiresIn).toBe(0);

      // Restore Date.now
      Date.now = originalNow;
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty teams array', () => {
      teamCacheService.set([], 'empty');
      const result = teamCacheService.get('empty');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle teams with no members', () => {
      const emptyTeam: JiraTeam[] = [{
        id: 'team-empty',
        name: 'Empty Team',
        members: [],
      }];

      teamCacheService.set(emptyTeam, 'default');
      const result = teamCacheService.get('default');

      expect(result).toEqual(emptyTeam);
      expect(result![0].members).toHaveLength(0);
    });

    it('should handle rapid successive cache operations', () => {
      for (let i = 0; i < 100; i++) {
        teamCacheService.set(mockTeams, `key-${i}`);
      }

      for (let i = 0; i < 100; i++) {
        expect(teamCacheService.get(`key-${i}`)).toEqual(mockTeams);
      }

      const stats = teamCacheService.getStats();
      expect(stats.teamCacheSize).toBe(100);
    });

    it('should handle cache overwrite', () => {
      const teams1 = [mockTeams[0]];
      const teams2 = [mockTeams[1]];

      teamCacheService.set(teams1, 'default');
      expect(teamCacheService.get('default')).toEqual(teams1);

      teamCacheService.set(teams2, 'default');
      expect(teamCacheService.get('default')).toEqual(teams2);
    });

    it('should store reference to teams array', () => {
      const teams = [...mockTeams];
      teamCacheService.set(teams, 'key1');
      
      const cached = teamCacheService.get('key1');
      expect(cached).toEqual(teams);
      expect(cached).toHaveLength(2);
    });
  });
});
