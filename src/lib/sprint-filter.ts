/**
 * Sprint Filter - Manages sprint-based filtering and metrics
 * Provides sprint selection, date range filtering, and metrics calculation
 */

import { FirebaseConnector } from './firebase-connector';
import {
  Sprint,
  SprintMetrics,
  EnhancedBug,
  AnalyticsEvent,
  BugSeverity,
} from '@/types/bug-analytics';
import { Timestamp } from 'firebase/firestore';

export class SprintFilter {
  private connector: FirebaseConnector;

  constructor(connector: FirebaseConnector) {
    this.connector = connector;
  }

  /**
   * Get the currently active sprint
   */
  async getActiveSprint(): Promise<Sprint | null> {
    try {
      const sprints = await this.connector.query<Sprint>('sprints', {
        where: [
          {
            field: 'status',
            operator: '==',
            value: 'active',
          },
        ],
        limit: 1,
      });

      return sprints.length > 0 ? sprints[0] : null;
    } catch (error) {
      console.error('Error fetching active sprint:', error);
      throw error;
    }
  }

  /**
   * Get a sprint by ID
   */
  async getSprintById(sprintId: string): Promise<Sprint | null> {
    try {
      return await this.connector.read<Sprint>('sprints', sprintId);
    } catch (error) {
      console.error(`Error fetching sprint ${sprintId}:`, error);
      throw error;
    }
  }

  /**
   * Get sprints within a date range
   */
  async getSprintsByDateRange(start: Date, end: Date): Promise<Sprint[]> {
    try {
      const sprints = await this.connector.query<Sprint>('sprints', {
        where: [
          {
            field: 'startDate',
            operator: '<=',
            value: Timestamp.fromDate(end),
          },
          {
            field: 'endDate',
            operator: '>=',
            value: Timestamp.fromDate(start),
          },
        ],
        orderBy: { field: 'startDate', direction: 'desc' },
      });

      return sprints;
    } catch (error) {
      console.error('Error fetching sprints by date range:', error);
      throw error;
    }
  }

  /**
   * Filter bugs by sprint
   */
  async filterBugsBySprint(sprintId: string): Promise<EnhancedBug[]> {
    try {
      const sprint = await this.getSprintById(sprintId);
      if (!sprint) {
        return [];
      }

      const bugs = await this.connector.query<EnhancedBug>('bugs', {
        where: [
          {
            field: 'sprintId',
            operator: '==',
            value: sprintId,
          },
        ],
        orderBy: { field: 'createdAt', direction: 'desc' },
      });

      // Filter out deleted bugs
      return bugs.filter(bug => !bug.deletedAt);
    } catch (error) {
      console.error(`Error filtering bugs by sprint ${sprintId}:`, error);
      throw error;
    }
  }

  /**
   * Filter analytics events by sprint
   */
  async filterAnalyticsBySprint(sprintId: string): Promise<AnalyticsEvent[]> {
    try {
      const sprint = await this.getSprintById(sprintId);
      if (!sprint) {
        return [];
      }

      // Helper function to safely convert to Timestamp
      const toTimestamp = (value: any): Timestamp => {
        if (value && typeof value.toMillis === 'function') {
          return value;
        }
        if (value instanceof Date) {
          return Timestamp.fromDate(value);
        }
        return Timestamp.now();
      };

      const startDate = toTimestamp(sprint.startDate);
      const endDate = toTimestamp(sprint.endDate);

      const events = await this.connector.query<AnalyticsEvent>('analytics_events', {
        where: [
          {
            field: 'timestamp',
            operator: '>=',
            value: startDate,
          },
          {
            field: 'timestamp',
            operator: '<=',
            value: endDate,
          },
        ],
        orderBy: { field: 'timestamp', direction: 'desc' },
      });

      return events;
    } catch (error) {
      console.error(`Error filtering analytics by sprint ${sprintId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate metrics for a sprint
   */
  async calculateSprintMetrics(sprintId: string): Promise<SprintMetrics> {
    try {
      const bugs = await this.filterBugsBySprint(sprintId);

      const totalBugs = bugs.length;
      const resolvedBugs = bugs.filter(bug => 
        bug.status === 'closed' || bug.status === 'resolved'
      ).length;
      const openBugs = totalBugs - resolvedBugs;

      // Calculate average resolution time
      const resolvedBugsWithTime = bugs.filter(bug => bug.resolutionTime);
      const averageResolutionTime = resolvedBugsWithTime.length > 0
        ? resolvedBugsWithTime.reduce((sum, bug) => sum + (bug.resolutionTime || 0), 0) / resolvedBugsWithTime.length
        : 0;

      // Calculate bugs by severity
      const bugsBySeverity: Record<BugSeverity, number> = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        trivial: 0,
      };

      for (const bug of bugs) {
        bugsBySeverity[bug.categories.severity]++;
      }

      // Calculate bugs by component
      const bugsByComponent: Record<string, number> = {};
      for (const bug of bugs) {
        const component = bug.categories.component;
        bugsByComponent[component] = (bugsByComponent[component] || 0) + 1;
      }

      // Calculate velocity points (if available)
      const velocityPoints = bugs.reduce((sum, bug) => {
        return sum + (bug.storyPoints || 0);
      }, 0);

      // Generate burndown data (simplified - would need daily snapshots in production)
      const burndownData = this.generateBurndownData(bugs, sprintId);

      return {
        sprintId,
        totalBugs,
        resolvedBugs,
        openBugs,
        averageResolutionTime,
        bugsBySeverity,
        bugsByComponent,
        velocityPoints: velocityPoints > 0 ? velocityPoints : undefined,
        burndownData,
      };
    } catch (error) {
      console.error(`Error calculating sprint metrics for ${sprintId}:`, error);
      throw error;
    }
  }

  /**
   * Get data for multiple sprints (for comparison)
   */
  async getMultiSprintData(sprintIds: string[]): Promise<Record<string, any>> {
    try {
      const sprintData: Record<string, any> = {};

      for (const sprintId of sprintIds) {
        const sprint = await this.getSprintById(sprintId);
        const metrics = await this.calculateSprintMetrics(sprintId);
        const bugs = await this.filterBugsBySprint(sprintId);

        sprintData[sprintId] = {
          sprint,
          metrics,
          bugs,
        };
      }

      return sprintData;
    } catch (error) {
      console.error('Error fetching multi-sprint data:', error);
      throw error;
    }
  }

  /**
   * Generate burndown data for a sprint
   * Note: This is a simplified version. In production, you'd want daily snapshots.
   */
  private generateBurndownData(bugs: EnhancedBug[], sprintId: string): Array<{ date: Date; remaining: number }> {
    // Helper function to safely convert Timestamp to Date
    const toDate = (timestamp: any): Date => {
      if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
      }
      if (timestamp && typeof timestamp.toMillis === 'function') {
        return new Date(timestamp.toMillis());
      }
      if (timestamp instanceof Date) {
        return timestamp;
      }
      return new Date();
    };

    // Helper function to get milliseconds from Timestamp
    const toMillis = (timestamp: any): number => {
      if (timestamp && typeof timestamp.toMillis === 'function') {
        return timestamp.toMillis();
      }
      if (timestamp instanceof Date) {
        return timestamp.getTime();
      }
      return 0;
    };

    // Sort bugs by resolution date
    const resolvedBugs = bugs
      .filter(bug => bug.resolvedAt)
      .sort((a, b) => {
        const aTime = toMillis(a.resolvedAt);
        const bTime = toMillis(b.resolvedAt);
        return aTime - bTime;
      });

    const burndownData: Array<{ date: Date; remaining: number }> = [];
    let remaining = bugs.length;

    // Add initial point
    if (bugs.length > 0) {
      const firstBug = bugs[0];
      const startDate = toDate(firstBug.createdAt);
      burndownData.push({ date: startDate, remaining });
    }

    // Add points for each resolution
    for (const bug of resolvedBugs) {
      remaining--;
      const resolvedDate = toDate(bug.resolvedAt);
      burndownData.push({ date: resolvedDate, remaining });
    }

    return burndownData;
  }
}
