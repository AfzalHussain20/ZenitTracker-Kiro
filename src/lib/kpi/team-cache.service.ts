/**
 * Enhanced Team Caching Service with 30-minute TTL
 * 
 * Provides efficient caching for Jira team data to reduce API calls
 * while maintaining data freshness.
 */

import { JiraTeam, TeamCacheEntry } from '@/types/kpi-dashboard';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds

class TeamCacheService {
  private cache: Map<string, TeamCacheEntry> = new Map();
  private userCache: Map<string, any> = new Map();

  /**
   * Get cached teams if available and not expired
   */
  get(key: string = 'default'): JiraTeam[] | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const isExpired = (now - entry.timestamp) > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set teams in cache with TTL
   */
  set(teams: JiraTeam[], key: string = 'default'): void {
    const entry: TeamCacheEntry = {
      data: teams,
      timestamp: Date.now(),
      ttl: CACHE_TTL,
      lastRefresh: new Date(),
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if cache has valid data
   */
  has(key: string = 'default'): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    const now = Date.now();
    const isExpired = (now - entry.timestamp) > entry.ttl;

    return !isExpired;
  }

  /**
   * Get cache metadata
   */
  getMetadata(key: string = 'default'): { lastRefresh: Date; expiresAt: Date } | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    return {
      lastRefresh: entry.lastRefresh,
      expiresAt: new Date(entry.timestamp + entry.ttl),
    };
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string = 'default'): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.userCache.clear();
  }

  /**
   * Get user from cache
   */
  getUser(accountId: string): any | null {
    return this.userCache.get(accountId) || null;
  }

  /**
   * Set user in cache
   */
  setUser(accountId: string, user: any): void {
    this.userCache.set(accountId, user);
  }

  /**
   * Check if user is cached
   */
  hasUser(accountId: string): boolean {
    return this.userCache.has(accountId);
  }

  /**
   * Clear user cache
   */
  clearUserCache(): void {
    this.userCache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    teamCacheSize: number;
    userCacheSize: number;
    entries: Array<{ key: string; size: number; expiresIn: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      size: entry.data.length,
      expiresIn: Math.max(0, entry.ttl - (now - entry.timestamp)),
    }));

    return {
      teamCacheSize: this.cache.size,
      userCacheSize: this.userCache.size,
      entries,
    };
  }
}

// Export singleton instance
export const teamCacheService = new TeamCacheService();
