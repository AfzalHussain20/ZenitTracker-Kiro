/**
 * Leaderboard Service - Calculates and manages bug logger rankings
 * Provides quality scoring, time period filtering, and caching
 */

import { FirebaseConnector } from './firebase-connector';
import {
  LeaderboardEntry,
  LeaderboardQuery,
  LeaderboardCache,
  EnhancedBug,
  TimeRange,
  BugSeverity,
} from '@/types/bug-analytics';
import { Timestamp } from 'firebase/firestore';

export class LeaderboardService {
  private connector: FirebaseConnector;
  private cache: Map<string, LeaderboardCache> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour in milliseconds

  constructor(connector: FirebaseConnector) {
    this.connector = connector;
  }

  /**
   * Calculate leaderboard for a given time period
   */
  async calculateLeaderboard(query: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    const cacheKey = this.getCacheKey(query);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      const expiresAtMillis = typeof cached.expiresAt.toMillis === 'function' 
        ? cached.expiresAt.toMillis() 
        : Date.now() + this.CACHE_TTL;
      if (expiresAtMillis > Date.now()) {
        return cached.entries;
      }
    }

    // Determine time range
    const timeRange = this.getTimeRange(query);

    // Query bugs within time range, excluding deleted bugs
    const bugs = await this.connector.query<EnhancedBug>('bugs', {
      where: [
        {
          field: 'createdAt',
          operator: '>=',
          value: Timestamp.fromDate(timeRange.start),
        },
        {
          field: 'createdAt',
          operator: '<=',
          value: Timestamp.fromDate(timeRange.end),
        },
      ],
    });

    // Filter out deleted bugs
    const activeBugs = bugs.filter(bug => !bug.deletedAt);

    // Group bugs by reporter
    const bugsByUser = new Map<string, EnhancedBug[]>();
    for (const bug of activeBugs) {
      if (!bugsByUser.has(bug.reportedByUid)) {
        bugsByUser.set(bug.reportedByUid, []);
      }
      bugsByUser.get(bug.reportedByUid)!.push(bug);
    }

    // Calculate leaderboard entries
    const entries: LeaderboardEntry[] = [];
    for (const [userId, userBugs] of bugsByUser.entries()) {
      const entry = this.calculateUserEntry(userId, userBugs);
      entries.push(entry);
    }

    // Sort by bug count (descending), then by quality score (descending)
    entries.sort((a, b) => {
      if (b.bugCount !== a.bugCount) {
        return b.bugCount - a.bugCount;
      }
      return b.qualityScore - a.qualityScore;
    });

    // Assign ranks with tie-breaking
    let currentRank = 1;
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i].bugCount === entries[i - 1].bugCount) {
        // Same bug count = same rank
        entries[i].rank = entries[i - 1].rank;
      } else {
        entries[i].rank = currentRank;
      }
      currentRank++;
    }

    // Apply limit if specified
    const limitedEntries = query.limit ? entries.slice(0, query.limit) : entries;

    // Cache the results
    this.cacheResults(cacheKey, limitedEntries);

    return limitedEntries;
  }

  /**
   * Calculate quality score for a user
   */
  async getQualityScore(userId: string, timePeriod: TimeRange): Promise<number> {
    const bugs = await this.connector.query<EnhancedBug>('bugs', {
      where: [
        {
          field: 'reportedByUid',
          operator: '==',
          value: userId,
        },
        {
          field: 'createdAt',
          operator: '>=',
          value: Timestamp.fromDate(timePeriod.start),
        },
        {
          field: 'createdAt',
          operator: '<=',
          value: Timestamp.fromDate(timePeriod.end),
        },
      ],
    });

    // Filter out deleted bugs
    const activeBugs = bugs.filter(bug => !bug.deletedAt);

    if (activeBugs.length === 0) {
      return 0;
    }

    return this.calculateQualityScore(activeBugs);
  }

  /**
   * Get user's rank in the leaderboard
   */
  async getUserRank(userId: string, query: LeaderboardQuery): Promise<number> {
    const leaderboard = await this.calculateLeaderboard({ ...query, limit: undefined });
    const entry = leaderboard.find(e => e.userId === userId);
    return entry?.rank || -1;
  }

  /**
   * Invalidate cache for a specific time period
   */
  invalidateCache(timePeriod: string): void {
    for (const [key, _] of this.cache.entries()) {
      if (key.includes(timePeriod)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Calculate leaderboard entry for a user
   */
  private calculateUserEntry(userId: string, bugs: EnhancedBug[]): LeaderboardEntry {
    const severityDistribution = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      trivial: 0,
    };

    let totalResolutionTime = 0;
    let resolvedCount = 0;
    let reopenCount = 0;

    for (const bug of bugs) {
      // Count severity distribution
      severityDistribution[bug.categories.severity]++;

      // Calculate resolution time
      if (bug.resolutionTime) {
        totalResolutionTime += bug.resolutionTime;
        resolvedCount++;
      }

      // Count reopens
      if (bug.reopenCount) {
        reopenCount += bug.reopenCount;
      }
    }

    const averageResolutionTime = resolvedCount > 0 ? totalResolutionTime / resolvedCount : undefined;
    const reopenRate = bugs.length > 0 ? reopenCount / bugs.length : undefined;
    const qualityScore = this.calculateQualityScore(bugs);

    return {
      userId,
      userName: bugs[0]?.reportedByName || 'Unknown',
      photoURL: undefined, // Would need to fetch from user profile
      bugCount: bugs.length,
      severityDistribution,
      qualityScore,
      rank: 0, // Will be assigned later
      averageResolutionTime,
      reopenRate,
    };
  }

  /**
   * Calculate quality score based on bug characteristics
   */
  private calculateQualityScore(bugs: EnhancedBug[]): number {
    if (bugs.length === 0) {
      return 0;
    }

    let score = 0;

    // Severity weights
    const severityWeights: Record<BugSeverity, number> = {
      critical: 10,
      high: 7,
      medium: 5,
      low: 3,
      trivial: 1,
    };

    // Calculate weighted severity score
    for (const bug of bugs) {
      score += severityWeights[bug.categories.severity];
    }

    // Penalize for reopens
    const totalReopens = bugs.reduce((sum, bug) => sum + (bug.reopenCount || 0), 0);
    score -= totalReopens * 2;

    // Bonus for quick resolution
    const resolvedBugs = bugs.filter(bug => bug.resolutionTime);
    if (resolvedBugs.length > 0) {
      const avgResolutionTime = resolvedBugs.reduce((sum, bug) => sum + (bug.resolutionTime || 0), 0) / resolvedBugs.length;
      if (avgResolutionTime < 24) {
        score += 5; // Bonus for resolving within 24 hours
      }
    }

    // Normalize to 0-100 scale
    const maxPossibleScore = bugs.length * 10; // All critical bugs
    const normalizedScore = Math.max(0, Math.min(100, (score / maxPossibleScore) * 100));

    return Math.round(normalizedScore);
  }

  /**
   * Get time range based on query
   */
  private getTimeRange(query: LeaderboardQuery): TimeRange {
    const now = new Date();

    if (query.timePeriod === 'current_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { start, end, preset: 'current_month' };
    }

    if (query.timePeriod === 'previous_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { start, end, preset: 'previous_month' };
    }

    if (query.timePeriod === 'custom' && query.startDate && query.endDate) {
      return { start: query.startDate, end: query.endDate, preset: 'custom' };
    }

    // Default to current month
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { start, end, preset: 'current_month' };
  }

  /**
   * Generate cache key from query
   */
  private getCacheKey(query: LeaderboardQuery): string {
    return `${query.timePeriod}_${query.startDate?.getTime() || ''}_${query.endDate?.getTime() || ''}_${query.limit || 'all'}`;
  }

  /**
   * Cache leaderboard results
   */
  private cacheResults(key: string, entries: LeaderboardEntry[]): void {
    const now = Timestamp.now();
    const nowMillis = typeof now.toMillis === 'function' ? now.toMillis() : Date.now();
    
    // Create expiresAt timestamp - handle both real and mock Timestamp
    let expiresAt: Timestamp;
    if (typeof Timestamp.fromMillis === 'function') {
      expiresAt = Timestamp.fromMillis(nowMillis + this.CACHE_TTL);
    } else {
      // Fallback for test environment
      expiresAt = now;
    }

    this.cache.set(key, {
      timePeriod: key,
      entries,
      calculatedAt: now,
      expiresAt,
    });
  }
}
