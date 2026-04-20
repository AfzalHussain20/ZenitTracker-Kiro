/**
 * Cache Layer - Multi-tier caching with memory and localStorage
 */

export interface CacheEntry {
  data: any;
  expiresAt: number;
}

export type CacheType = 'leaderboard' | 'sprintMetrics' | 'searchResults' | 'userPreferences';

export class CacheLayer {
  private memoryCache: Map<string, CacheEntry> = new Map();
  
  private readonly TTL: Record<CacheType, number> = {
    leaderboard: 5 * 60 * 1000, // 5 minutes
    sprintMetrics: 10 * 60 * 1000, // 10 minutes
    searchResults: 2 * 60 * 1000, // 2 minutes
    userPreferences: 30 * 60 * 1000, // 30 minutes
  };

  /**
   * Get cached data by key
   * Checks memory cache first, then localStorage
   */
  async get<T>(key: string, type: CacheType): Promise<T | null> {
    // Check memory cache first
    const cached = this.memoryCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data as T;
    }

    // Remove expired entry from memory
    if (cached) {
      this.memoryCache.delete(key);
    }

    // Check localStorage for persistent cache
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`cache_${key}`);
      if (stored) {
        try {
          const parsed: CacheEntry = JSON.parse(stored);
          if (Date.now() < parsed.expiresAt) {
            // Restore to memory cache
            this.memoryCache.set(key, parsed);
            return parsed.data as T;
          } else {
            // Remove expired entry from localStorage
            localStorage.removeItem(`cache_${key}`);
          }
        } catch (error) {
          console.error('Failed to parse cached data:', error);
          localStorage.removeItem(`cache_${key}`);
        }
      }
    }

    return null;
  }

  /**
   * Set cached data with TTL
   * Stores in both memory and localStorage
   */
  async set<T>(key: string, data: T, type: CacheType): Promise<void> {
    const entry: CacheEntry = {
      data,
      expiresAt: Date.now() + this.TTL[type],
    };

    // Store in memory cache
    this.memoryCache.set(key, entry);

    // Store in localStorage for persistence
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
      } catch (error) {
        console.error('Failed to store in localStorage:', error);
        // Continue even if localStorage fails (e.g., quota exceeded)
      }
    }
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidate(pattern: string): void {
    // Invalidate memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Invalidate localStorage
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache_') && key.includes(pattern)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear localStorage cache entries
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { memorySize: number; localStorageSize: number } {
    let localStorageSize = 0;

    if (typeof window !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache_')) {
          localStorageSize++;
        }
      }
    }

    return {
      memorySize: this.memoryCache.size,
      localStorageSize,
    };
  }

  /**
   * Clean up expired entries from both caches
   */
  cleanup(): void {
    const now = Date.now();

    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now >= entry.expiresAt) {
        this.memoryCache.delete(key);
      }
    }

    // Clean localStorage
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache_')) {
          try {
            const stored = localStorage.getItem(key);
            if (stored) {
              const parsed: CacheEntry = JSON.parse(stored);
              if (now >= parsed.expiresAt) {
                keysToRemove.push(key);
              }
            }
          } catch (error) {
            // Remove invalid entries
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  }
}
