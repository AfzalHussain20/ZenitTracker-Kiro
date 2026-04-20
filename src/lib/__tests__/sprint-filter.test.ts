/**
 * Unit Tests for Sprint Filter
 * Feature: bug-analytics-categorization-system
 */

import { SprintFilter } from '../sprint-filter';
import { FirebaseConnector } from '../firebase-connector';
import { Sprint, EnhancedBug, SprintMetrics } from '@/types/bug-analytics';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase Connector
const mockDb = {} as any;

describe('SprintFilter - Unit Tests', () => {
  let connector: FirebaseConnector;
  let sprintFilter: SprintFilter;

  beforeEach(() => {
    connector = new FirebaseConnector(mockDb);
    sprintFilter = new SprintFilter(connector);
    jest.clearAllMocks();
  });

  describe('Active Sprint Retrieval', () => {
    /**
     * Test: Active sprint retrieval
     * Requirements: 4.1
     */
    test('should retrieve the active sprint', async () => {
      const activeSprint: Sprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        startDate: Timestamp.fromDate(new Date('2024-01-01')),
        endDate: Timestamp.fromDate(new Date('2024-01-14')),
        goals: ['Complete feature X'],
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      jest.spyOn(connector, 'query').mockResolvedValue([activeSprint]);

      const result = await sprintFilter.getActiveSprint();

      expect(result).toEqual(activeSprint);
      expect(connector.query).toHaveBeenCalledWith('sprints', {
        where: [{ field: 'status', operator: '==', value: 'active' }],
        limit: 1,
      });
    });

    test('should return null when no active sprint exists', async () => {
      jest.spyOn(connector, 'query').mockResolvedValue([]);

      const result = await sprintFilter.getActiveSprint();

      expect(result).toBeNull();
    });
  });

  describe('Sprint Metrics Calculation', () => {
    /**
     * Test: Sprint metrics calculation
     * Requirements: 4.5
     */
    test('should calculate sprint metrics correctly', async () => {
      const sprintId = 'sprint-1';
      const sprint: Sprint = {
        id: sprintId,
        name: 'Sprint 1',
        startDate: Timestamp.fromDate(new Date('2024-01-01')),
        endDate: Timestamp.fromDate(new Date('2024-01-14')),
        goals: [],
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const bugs: EnhancedBug[] = [
        {
          id: 'bug-1',
          title: 'Bug 1',
          description: 'Critical bug',
          categories: {
            type: 'functional',
            severity: 'critical',
            component: 'api',
            customFields: {},
          },
          tags: [],
          status: 'resolved',
          priority: 'P0',
          reportedByUid: 'user-1',
          reportedByName: 'User 1',
          sprintId,
          resolutionTime: 24,
          storyPoints: 5,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        {
          id: 'bug-2',
          title: 'Bug 2',
          description: 'High priority bug',
          categories: {
            type: 'ui',
            severity: 'high',
            component: 'dashboard',
            customFields: {},
          },
          tags: [],
          status: 'open',
          priority: 'P1',
          reportedByUid: 'user-2',
          reportedByName: 'User 2',
          sprintId,
          storyPoints: 3,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        {
          id: 'bug-3',
          title: 'Bug 3',
          description: 'Medium priority bug',
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
          reportedByName: 'User 1',
          sprintId,
          resolutionTime: 48,
          storyPoints: 2,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
      ];

      jest.spyOn(connector, 'read').mockResolvedValue(sprint);
      jest.spyOn(connector, 'query').mockResolvedValue(bugs);

      const metrics = await sprintFilter.calculateSprintMetrics(sprintId);

      expect(metrics.sprintId).toBe(sprintId);
      expect(metrics.totalBugs).toBe(3);
      expect(metrics.resolvedBugs).toBe(2); // resolved + closed
      expect(metrics.openBugs).toBe(1);
      expect(metrics.averageResolutionTime).toBe(36); // (24 + 48) / 2
      expect(metrics.bugsBySeverity.critical).toBe(1);
      expect(metrics.bugsBySeverity.high).toBe(1);
      expect(metrics.bugsBySeverity.medium).toBe(1);
      expect(metrics.bugsByComponent.api).toBe(2);
      expect(metrics.bugsByComponent.dashboard).toBe(1);
      expect(metrics.velocityPoints).toBe(10); // 5 + 3 + 2
      expect(metrics.burndownData).toBeDefined();
    });

    test('should handle sprint with no bugs', async () => {
      const sprintId = 'sprint-empty';
      const sprint: Sprint = {
        id: sprintId,
        name: 'Empty Sprint',
        startDate: Timestamp.now(),
        endDate: Timestamp.now(),
        goals: [],
        status: 'planned',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      jest.spyOn(connector, 'read').mockResolvedValue(sprint);
      jest.spyOn(connector, 'query').mockResolvedValue([]);

      const metrics = await sprintFilter.calculateSprintMetrics(sprintId);

      expect(metrics.totalBugs).toBe(0);
      expect(metrics.resolvedBugs).toBe(0);
      expect(metrics.openBugs).toBe(0);
      expect(metrics.averageResolutionTime).toBe(0);
      expect(metrics.velocityPoints).toBeUndefined();
    });

    test('should exclude deleted bugs from metrics', async () => {
      const sprintId = 'sprint-2';
      const sprint: Sprint = {
        id: sprintId,
        name: 'Sprint 2',
        startDate: Timestamp.now(),
        endDate: Timestamp.now(),
        goals: [],
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const bugs: EnhancedBug[] = [
        {
          id: 'bug-1',
          title: 'Bug 1',
          description: 'Active bug',
          categories: {
            type: 'functional',
            severity: 'high',
            component: 'api',
            customFields: {},
          },
          tags: [],
          status: 'open',
          priority: 'P1',
          reportedByUid: 'user-1',
          reportedByName: 'User 1',
          sprintId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        {
          id: 'bug-2',
          title: 'Bug 2',
          description: 'Deleted bug',
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
          reportedByName: 'User 1',
          sprintId,
          deletedAt: Timestamp.now(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
      ];

      jest.spyOn(connector, 'read').mockResolvedValue(sprint);
      jest.spyOn(connector, 'query').mockResolvedValue(bugs);

      const metrics = await sprintFilter.calculateSprintMetrics(sprintId);

      // Only the non-deleted bug should be counted
      expect(metrics.totalBugs).toBe(1);
    });
  });

  describe('Multi-Sprint Data Aggregation', () => {
    /**
     * Test: Multi-sprint data aggregation
     * Requirements: 4.4
     */
    test('should aggregate data from multiple sprints', async () => {
      const sprint1: Sprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        startDate: Timestamp.now(),
        endDate: Timestamp.now(),
        goals: [],
        status: 'completed',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const sprint2: Sprint = {
        id: 'sprint-2',
        name: 'Sprint 2',
        startDate: Timestamp.now(),
        endDate: Timestamp.now(),
        goals: [],
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const bugs1: EnhancedBug[] = [
        {
          id: 'bug-1',
          title: 'Bug 1',
          description: 'Sprint 1 bug',
          categories: {
            type: 'functional',
            severity: 'high',
            component: 'api',
            customFields: {},
          },
          tags: [],
          status: 'resolved',
          priority: 'P1',
          reportedByUid: 'user-1',
          reportedByName: 'User 1',
          sprintId: 'sprint-1',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
      ];

      const bugs2: EnhancedBug[] = [
        {
          id: 'bug-2',
          title: 'Bug 2',
          description: 'Sprint 2 bug',
          categories: {
            type: 'ui',
            severity: 'medium',
            component: 'dashboard',
            customFields: {},
          },
          tags: [],
          status: 'open',
          priority: 'P2',
          reportedByUid: 'user-2',
          reportedByName: 'User 2',
          sprintId: 'sprint-2',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
      ];

      // Mock read to return the appropriate sprint
      jest.spyOn(connector, 'read').mockImplementation(async (collection, docId) => {
        if (docId === 'sprint-1') return sprint1;
        if (docId === 'sprint-2') return sprint2;
        return null;
      });

      // Mock query to return bugs for the appropriate sprint
      jest.spyOn(connector, 'query').mockImplementation(async (collection, options) => {
        const sprintIdFilter = options.where?.find(w => w.field === 'sprintId');
        if (sprintIdFilter?.value === 'sprint-1') return bugs1;
        if (sprintIdFilter?.value === 'sprint-2') return bugs2;
        return [];
      });

      const multiSprintData = await sprintFilter.getMultiSprintData(['sprint-1', 'sprint-2']);

      expect(Object.keys(multiSprintData)).toHaveLength(2);
      expect(multiSprintData['sprint-1'].sprint).toEqual(sprint1);
      expect(multiSprintData['sprint-1'].bugs).toEqual(bugs1);
      expect(multiSprintData['sprint-2'].sprint).toEqual(sprint2);
      expect(multiSprintData['sprint-2'].bugs).toEqual(bugs2);
    });

    test('should handle empty sprint list', async () => {
      const multiSprintData = await sprintFilter.getMultiSprintData([]);

      expect(Object.keys(multiSprintData)).toHaveLength(0);
    });
  });

  describe('Sprint Retrieval', () => {
    test('should get sprint by ID', async () => {
      const sprint: Sprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        startDate: Timestamp.now(),
        endDate: Timestamp.now(),
        goals: [],
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      jest.spyOn(connector, 'read').mockResolvedValue(sprint);

      const result = await sprintFilter.getSprintById('sprint-1');

      expect(result).toEqual(sprint);
      expect(connector.read).toHaveBeenCalledWith('sprints', 'sprint-1');
    });

    test('should return null for non-existent sprint', async () => {
      jest.spyOn(connector, 'read').mockResolvedValue(null);

      const result = await sprintFilter.getSprintById('non-existent');

      expect(result).toBeNull();
    });

    test('should get sprints by date range', async () => {
      const sprints: Sprint[] = [
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          startDate: Timestamp.fromDate(new Date('2024-01-01')),
          endDate: Timestamp.fromDate(new Date('2024-01-14')),
          goals: [],
          status: 'completed',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        {
          id: 'sprint-2',
          name: 'Sprint 2',
          startDate: Timestamp.fromDate(new Date('2024-01-15')),
          endDate: Timestamp.fromDate(new Date('2024-01-28')),
          goals: [],
          status: 'active',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
      ];

      jest.spyOn(connector, 'query').mockResolvedValue(sprints);

      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const result = await sprintFilter.getSprintsByDateRange(start, end);

      expect(result).toEqual(sprints);
      expect(connector.query).toHaveBeenCalledWith('sprints', expect.objectContaining({
        where: expect.arrayContaining([
          expect.objectContaining({ field: 'startDate' }),
          expect.objectContaining({ field: 'endDate' }),
        ]),
      }));
    });
  });
});
