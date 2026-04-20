/**
 * Unit tests for Intelligent Metric Filter Service
 */

import { intelligentMetricFilterService } from '../intelligent-metric-filter.service';
import { TeamType } from '@/types/kpi-dashboard';

describe('IntelligentMetricFilterService', () => {
  describe('getIntelligentMetrics', () => {
    it('should filter out bug metrics when team has no bugs', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 3 },
        { issueType: 'Task', statusCategory: 'Done' },
      ];

      const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');

      // Should not include bug-related metrics
      const metricKeys = result.metrics.map((m) => m.key);
      expect(metricKeys).not.toContain('bugs_found');
      expect(metricKeys).not.toContain('bugs_resolved');
      expect(metricKeys).not.toContain('defects_logged');
    });

    it('should include bug metrics when team has bugs', () => {
      const issues = [
        { issueType: 'Bug', statusCategory: 'Done' },
        { issueType: 'Bug', statusCategory: 'In Progress' },
        { issueType: 'Story', statusCategory: 'Done' },
      ];

      const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'qa');

      // Should include bug-related metrics
      const metricKeys = result.metrics.map((m) => m.key);
      expect(metricKeys).toContain('bugs_found');
    });

    it('should return work distribution analysis', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done' },
        { issueType: 'Story', statusCategory: 'Done' },
        { issueType: 'Bug', statusCategory: 'Done' },
        { issueType: 'Task', statusCategory: 'Done' },
      ];

      const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');

      expect(result.workDistribution).toEqual({
        stories: 2,
        bugs: 1,
        tasks: 1,
        epics: 0,
        subtasks: 0,
      });
    });

    it('should return work focus indicator', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done' },
        { issueType: 'Story', statusCategory: 'Done' },
        { issueType: 'Story', statusCategory: 'Done' },
        { issueType: 'Bug', statusCategory: 'Done' },
      ];

      const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');

      expect(result.workFocus.primary).toBe('Stories');
      expect(result.workFocus.percentage).toBe(75);
    });

    it('should track filtered metric count', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
      ];

      const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');

      expect(result.filteredCount).toBeGreaterThan(0);
      expect(result.totalAvailableMetrics).toBeGreaterThan(result.metrics.length);
    });

    it('should handle empty issue list', () => {
      const result = intelligentMetricFilterService.getIntelligentMetrics([], 'dev');

      expect(result.metrics).toEqual([]);
      expect(result.workDistribution).toEqual({
        stories: 0,
        bugs: 0,
        tasks: 0,
        epics: 0,
        subtasks: 0,
      });
      expect(result.workFocus.primary).toBe('No Work Items');
    });
  });

  describe('getWorkFocusIndicator', () => {
    it('should identify primary work type', () => {
      const issues = [
        { issueType: 'Bug', statusCategory: 'Done' },
        { issueType: 'Bug', statusCategory: 'Done' },
        { issueType: 'Bug', statusCategory: 'Done' },
        { issueType: 'Story', statusCategory: 'Done' },
      ];

      const focus = intelligentMetricFilterService.getWorkFocusIndicator(issues);

      expect(focus.primary).toBe('Bugs');
      expect(focus.percentage).toBe(75);
      expect(focus.description).toContain('bug');
    });

    it('should handle equal distribution', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done' },
        { issueType: 'Bug', statusCategory: 'Done' },
      ];

      const focus = intelligentMetricFilterService.getWorkFocusIndicator(issues);

      expect(focus.percentage).toBe(50);
    });
  });

  describe('shouldDisplayMetric', () => {
    it('should return false for bug metrics when no bugs exist', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done' },
        { issueType: 'Task', statusCategory: 'Done' },
      ];

      const shouldDisplay = intelligentMetricFilterService.shouldDisplayMetric(
        'bugs_found',
        issues
      );

      expect(shouldDisplay).toBe(false);
    });

    it('should return true for bug metrics when bugs exist', () => {
      const issues = [
        { issueType: 'Bug', statusCategory: 'Done' },
        { issueType: 'Story', statusCategory: 'Done' },
      ];

      const shouldDisplay = intelligentMetricFilterService.shouldDisplayMetric(
        'bugs_found',
        issues
      );

      expect(shouldDisplay).toBe(true);
    });

    it('should return true for non-work-type-specific metrics', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done' },
      ];

      // Assuming 'commits' is not work-type specific
      const shouldDisplay = intelligentMetricFilterService.shouldDisplayMetric(
        'commits',
        issues
      );

      expect(shouldDisplay).toBe(true);
    });
  });

  describe('getMetricsWithContext', () => {
    it('should provide context for excluded metrics', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
      ];

      const context = intelligentMetricFilterService.getMetricsWithContext(issues, 'dev');

      expect(context.displayedMetrics.length).toBeGreaterThan(0);
      expect(context.excludedMetrics.length).toBeGreaterThan(0);
      
      // Should have exclusion reasons
      const bugMetricExcluded = context.excludedMetrics.find(
        (e) => e.metric.key === 'bugs_found' || e.metric.key.includes('bug')
      );
      
      if (bugMetricExcluded) {
        expect(bugMetricExcluded.reason).toBeDefined();
      }
    });

    it('should include work distribution in context', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done' },
        { issueType: 'Bug', statusCategory: 'Done' },
      ];

      const context = intelligentMetricFilterService.getMetricsWithContext(issues, 'dev');

      expect(context.workDistribution).toBeDefined();
      expect(context.workDistribution.stories).toBe(1);
      expect(context.workDistribution.bugs).toBe(1);
    });

    it('should include work focus in context', () => {
      const issues = [
        { issueType: 'Task', statusCategory: 'Done' },
        { issueType: 'Task', statusCategory: 'Done' },
      ];

      const context = intelligentMetricFilterService.getMetricsWithContext(issues, 'dev');

      expect(context.workFocus).toBeDefined();
      expect(context.workFocus.primary).toBe('Tasks');
    });
  });

  describe('getFilteringSummary', () => {
    it('should provide summary statistics', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
        { issueType: 'Task', statusCategory: 'Done' },
      ];

      const summary = intelligentMetricFilterService.getFilteringSummary(issues, 'dev');

      expect(summary.totalMetrics).toBeGreaterThan(0);
      expect(summary.displayedMetrics).toBeGreaterThan(0);
      expect(summary.filteredByWorkType).toBeGreaterThanOrEqual(0);
      expect(summary.filteredByZeroValue).toBeGreaterThanOrEqual(0);
      expect(summary.workDistribution).toBeDefined();
    });

    it('should count work type filtering correctly', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
      ];

      const summary = intelligentMetricFilterService.getFilteringSummary(issues, 'qa');

      // QA team with only stories should filter out bug-specific metrics
      expect(summary.filteredByWorkType).toBeGreaterThan(0);
    });

    it('should count zero value filtering correctly', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'In Progress' }, // Not done
      ];

      const summary = intelligentMetricFilterService.getFilteringSummary(issues, 'dev');

      // Should have some zero-value metrics filtered
      expect(summary.filteredByZeroValue).toBeGreaterThan(0);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle QA team with only bugs correctly', () => {
      const issues = [
        { issueType: 'Bug', statusCategory: 'Done' },
        { issueType: 'Bug', statusCategory: 'Done' },
        { issueType: 'Bug', statusCategory: 'In Progress', priority: 'High' },
      ];

      const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'qa');

      // Should show bug metrics
      const metricKeys = result.metrics.map((m) => m.key);
      expect(metricKeys).toContain('bugs_found');
      expect(metricKeys).toContain('bugs_resolved');

      // Should not show story metrics (if QA has story-specific metrics)
      expect(result.workDistribution.bugs).toBe(3);
      expect(result.workDistribution.stories).toBe(0);
    });

    it('should handle Dev team with mixed work correctly', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 3 },
        { issueType: 'Bug', statusCategory: 'Done' },
        { issueType: 'Task', statusCategory: 'Done' },
      ];

      const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');

      // Should show metrics for all work types present
      expect(result.workDistribution.stories).toBe(2);
      expect(result.workDistribution.bugs).toBe(1);
      expect(result.workDistribution.tasks).toBe(1);

      // Should have multiple metrics displayed
      expect(result.metrics.length).toBeGreaterThan(0);
    });

    it('should handle team with no completed work', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'In Progress' },
        { issueType: 'Bug', statusCategory: 'To Do' },
      ];

      const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');

      // Should still analyze work distribution
      expect(result.workDistribution.stories).toBe(1);
      expect(result.workDistribution.bugs).toBe(1);

      // But metrics should be filtered due to zero values
      expect(result.metrics.length).toBe(0);
    });
  });
});
