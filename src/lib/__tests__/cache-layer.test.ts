/**
 * Unit tests for CacheLayer
 */

import { CacheLayer, CacheType } from '../cache-layer';

describe('CacheLayer', () => {
  let cacheLayer: CacheLayer;
  let mockGetItem: jest.Mock;
  let mockSetItem: jest.Mock;
  let mockRemoveItem: jest.Mock;
  let mockKey: jest.Mock;

  beforeEach(() => {
    cacheLayer = new CacheLayer();
    
    // Create mock functions
    mockGetItem = jest.fn();
    mockSetItem = jest.fn();
    mockRemoveItem = jest.fn();
    mockKey = jest.fn();
    
    // Mock localStorage
    global.localStorage = {
      getItem: mockGetItem,
      setItem: mockSetItem,
      removeItem: mockRemoveItem,
      clear: jest.fn(),
      length: 0,
      key: mockKey,
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get and set', () => {
    it('should store and retrieve data from memory cache', async () => {
      const key = 'test-key';
      const data = { value: 'test-data' };
      const type: CacheType = 'leaderboard';

      await cacheLayer.set(key, data, type);
      const result = await cacheLayer.get(key, type);

      expect(result).toEqual(data);
    });

    it('should return null for non-existent key', async () => {
      const result = await cacheLayer.get('non-existent', 'leaderboard');

      expect(result).toBeNull();
    });

    it('should handle localStorage operations gracefully', async () => {
      const key = 'test-key';
      const data = { value: 'test-data' };
      const type: CacheType = 'userPreferences';

      // Should not throw
      await expect(cacheLayer.set(key, data, type)).resolves.not.toThrow();
      await expect(cacheLayer.get(key, type)).resolves.not.toThrow();
    });
  });

  describe('invalidate', () => {
    it('should invalidate cache entries matching pattern', async () => {
      // Set up some cache entries
      await cacheLayer.set('user-123-data', { name: 'John' }, 'userPreferences');
      await cacheLayer.set('user-456-data', { name: 'Jane' }, 'userPreferences');
      await cacheLayer.set('sprint-data', { id: 1 }, 'sprintMetrics');

      // Mock localStorage keys
      mockKey.mockImplementation((index: number) => {
        const keys = ['cache_user-123-data', 'cache_user-456-data', 'cache_sprint-data'];
        return keys[index] || null;
      });
      Object.defineProperty(global.localStorage, 'length', { value: 3, writable: true });

      // Invalidate all user data
      cacheLayer.invalidate('user');

      // Check that user entries are removed
      const result1 = await cacheLayer.get('user-123-data', 'userPreferences');
      const result2 = await cacheLayer.get('user-456-data', 'userPreferences');
      const result3 = await cacheLayer.get('sprint-data', 'sprintMetrics');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).not.toBeNull(); // Sprint data should still exist
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', async () => {
      await cacheLayer.set('key1', { data: 1 }, 'leaderboard');
      await cacheLayer.set('key2', { data: 2 }, 'sprintMetrics');

      cacheLayer.clear();

      const result1 = await cacheLayer.get('key1', 'leaderboard');
      const result2 = await cacheLayer.get('key2', 'sprintMetrics');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      await cacheLayer.set('key1', { data: 1 }, 'leaderboard');
      await cacheLayer.set('key2', { data: 2 }, 'sprintMetrics');

      // Mock localStorage length
      Object.defineProperty(global.localStorage, 'length', { value: 2, writable: true });
      mockKey.mockImplementation((index: number) => {
        const keys = ['cache_key1', 'cache_key2'];
        return keys[index] || null;
      });

      const stats = cacheLayer.getStats();

      expect(stats.memorySize).toBe(2);
      expect(stats.localStorageSize).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should handle cleanup operations gracefully', async () => {
      const key = 'test-key';
      const data = { value: 'test' };

      await cacheLayer.set(key, data, 'searchResults');

      // Should not throw
      expect(() => cacheLayer.cleanup()).not.toThrow();
    });

    it('should keep non-expired entries', async () => {
      const key = 'valid-key';
      const data = { value: 'test' };

      await cacheLayer.set(key, data, 'userPreferences');

      cacheLayer.cleanup();

      const result = await cacheLayer.get(key, 'userPreferences');
      expect(result).toEqual(data);
    });
  });
});
