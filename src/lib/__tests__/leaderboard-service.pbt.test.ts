/**
 * Property-Based Tests for Leaderboard Service
 * Feature: bug-analytics-categorization-system
 */

import fc from 'fast-check';
import { LeaderboardService } from '../leaderboard-service';
import { FirebaseConnector } from '../firebase-connector';
import { EnhancedBug, BugSeverity } from '@/types/bug-analytics';
import { Timestamp } from 'firebase/firestore';

const mockDb = {} as any;

describe('LeaderboardService - Property-Based Tests', () => {
  let connector: FirebaseConnector;
  let service: LeaderboardService;

  beforeEach(() => {
    connector = new FirebaseConnector(mockDb);
    service = new LeaderboardService(connector);
    jest.clearAllMocks();
    // Clear cache to prevent test interference
    service.invalidateCache('current_month');
    service.invalidateCache('previous_month');
  });

  /**
   * Property 9: Leaderboard Ranking Consistency
   * Validates: Requirements 3.3, 3.6
   * 
   * Property: Users with more bugs should have better (lower) ranks.
   * Users with equal bug counts should have the same rank.
   */
  test('Property 9: Ranking Consistency - users with more bugs rank higher', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 20 }),
            bugCount: fc.integer({ min: 1, max: 50 }),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (users) => {
          // Create unique users
          const uniqueUsers = users.map((u, idx) => ({
            ...u,
            userId: `user-${idx}`,
          }));

          // Generate bugs for each user
          const allBugs: EnhancedBug[] = [];
          for (const user of uniqueUsers) {
            for (let i = 0; i < user.bugCount; i++) {
              allBugs.push({
                id: `bug-${user.userId}-${i}`,
                title: 'Test Bug',
                description: 'Test',
                categories: {
                  type: 'functional',
                  severity: 'medium',
                  component: 'api',
                  customFields: {},
                },
                tags: [],
                status: 'open',
                priority: 'P2',
                reportedByUid: user.userId,
                reportedByName: `User ${user.userId}`,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
              } as EnhancedBug);
            }
          }

          jest.spyOn(connector, 'query').mockResolvedValue(allBugs);

          const leaderboard = await service.calculateLeaderboard({
            timePeriod: 'current_month',
          });

          // Property: Users should be sorted by bug count (descending)
          for (let i = 1; i < leaderboard.length; i++) {
            expect(leaderboard[i - 1].bugCount).toBeGreaterThanOrEqual(leaderboard[i].bugCount);
          }

          // Property: Users with equal bug counts should have equal ranks
          for (let i = 1; i < leaderboard.length; i++) {
            if (leaderboard[i].bugCount === leaderboard[i - 1].bugCount) {
              expect(leaderboard[i].rank).toBe(leaderboard[i - 1].rank);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 10: Leaderboard Entry Completeness
   * Validates: Requirements 3.4
   * 
   * Property: Every leaderboard entry should have all required fields.
   */
  test('Property 10: Entry Completeness - all entries have required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 20 }),
            severity: fc.constantFrom<BugSeverity>('critical', 'high', 'medium', 'low', 'trivial'),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (bugData) => {
          const bugs: EnhancedBug[] = bugData.map((data, idx) => ({
            id: `bug-${idx}`,
            title: 'Test Bug',
            description: 'Test',
            categories: {
              type: 'functional',
              severity: data.severity,
              component: 'api',
              customFields: {},
            },
            tags: [],
            status: 'open',
            priority: 'P2',
            reportedByUid: data.userId,
            reportedByName: `User ${data.userId}`,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          } as EnhancedBug));

          jest.spyOn(connector, 'query').mockResolvedValue(bugs);

          const leaderboard = await service.calculateLeaderboard({
            timePeriod: 'current_month',
          });

          // Property: All entries should have required fields
          for (const entry of leaderboard) {
            expect(entry).toHaveProperty('userId');
            expect(entry).toHaveProperty('userName');
            expect(entry).toHaveProperty('bugCount');
            expect(entry).toHaveProperty('severityDistribution');
            expect(entry).toHaveProperty('qualityScore');
            expect(entry).toHaveProperty('rank');
            
            expect(entry.bugCount).toBeGreaterThan(0);
            expect(entry.rank).toBeGreaterThan(0);
            expect(entry.qualityScore).toBeGreaterThanOrEqual(0);
            expect(entry.qualityScore).toBeLessThanOrEqual(100);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 11: Deleted Bug Exclusion
   * Validates: Requirements 3.7
   * 
   * Property: Deleted bugs should not be counted in the leaderboard.
   */
  test('Property 11: Deleted Bug Exclusion - deleted bugs are not counted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 5 }),
        async (activeBugCount, deletedBugCount) => {
          // Create fresh instances for each iteration to avoid cache pollution
          const freshConnector = new FirebaseConnector(mockDb);
          const freshService = new LeaderboardService(freshConnector);
          
          const bugs: EnhancedBug[] = [];
          
          // Add active bugs
          for (let i = 0; i < activeBugCount; i++) {
            bugs.push({
              id: `bug-active-${i}`,
              title: 'Active Bug',
              description: 'Test',
              categories: {
                type: 'functional',
                severity: 'medium',
                component: 'api',
                customFields: {},
              },
              tags: [],
              status: 'open',
              priority: 'P2',
              reportedByUid: 'user-1',
              reportedByName: 'Test User',
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            } as EnhancedBug);
          }

          // Add deleted bugs
          for (let i = 0; i < deletedBugCount; i++) {
            bugs.push({
              id: `bug-deleted-${i}`,
              title: 'Deleted Bug',
              description: 'Test',
              categories: {
                type: 'functional',
                severity: 'medium',
                component: 'api',
                customFields: {},
              },
              tags: [],
              status: 'closed',
              priority: 'P2',
              reportedByUid: 'user-1',
              reportedByName: 'Test User',
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
              deletedAt: Timestamp.now(), // Marked as deleted
            } as EnhancedBug);
          }

          jest.spyOn(freshConnector, 'query').mockResolvedValueOnce(bugs);

          const leaderboard = await freshService.calculateLeaderboard({
            timePeriod: 'current_month',
          });

          // Property: Only active bugs should be counted
          if (leaderboard.length > 0) {
            expect(leaderboard[0].bugCount).toBe(activeBugCount);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
