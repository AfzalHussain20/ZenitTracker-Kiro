/**
 * Integration tests for Work Distribution Analyzer
 * 
 * Tests the complete flow from Jira issues → work distribution analysis → metric filtering
 * Validates Requirements 2.2.1-2.2.10
 */

import { workDistributionService } from '../work-distribution.service';
import { intelligentMetricFilterService } from '../intelligent-metric-filter.service';
import { metricMappingService } from '../metric-mapping.service';
import { TeamType } from '@/types/kpi-dashboard';

describe('Work Analyzer Integration Tests', () => {
  describe('Complete flow: Jira issues → work distribution → metric filtering', () => {
    /**
     * Validates: Requirements 2.2.1, 2.2.2, 2.2.3
     */
    it('should analyze work distribution and filter metrics for dev team with stories', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 3 },
        { issueType: 'Story', statusCategory: 'In Progress', storyPoints: 8 },
        { issueType: 'Task', statusCategory: 'Done' },
      ];

      // Step 1: Analyze work distribution
      const workAnalysis = workDistributionService.analyzeWorkDistribution(issues);
      
      expect(workAnalysis.distribution.stories).toBe(3);
      expect(workAnalysis.distribution.tasks).toBe(1);
      expect(workAnalysis.distribution.bugs).toBe(0);
      expect(workAnalysis.total).toBe(4);
      expect(workAnalysis.workFocus.primary).toBe('Stories');

      // Step 2: Get intelligent metrics
      const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');

      // Should include story metrics
      const metricKeys = result.metrics.map((m) => m.key);
      expect(metricKeys).toContain('stories_completed');
      expect(metricKeys).toContain('story_points');

      // Should exclude bug metrics (no bugs in work distribution)
      expect(metricKeys).not.toContain('bugs_found');
      expect(metricKeys).not.toContain('bugs_resolved');

      // Verify work distribution in result
      expect(result.workDistribution).toEqual(workAnalysis.distribution);
      expect(result.workFocus.primary).toBe('Stories');
    });

    /**
     * Validates: Requirements 2.2.4, 2.2.5
     */
    it('should emphasize bug metrics for QA team with primarily bugs', () => {
      const issues = [
        { issueType: 'Bug', statusCategory: 'Done', priority: 'High' },
        { issueType: 'Bug', statusCategory: 'Done', priority: 'Medium' },
        { issueType: 'Bug', statusCategory: 'Done', priority: 'Low' },
        { issueType: 'Bug', statusCategory: 'In Progress', priority: 'Critical' },
        { issueType: 'Task', statusCategory: 'Done' },
      ];

      // Step 1: Analyze work distribution
      const workAnalysis = workDistributionService.analyzeWorkDistribution(issues);
      
      expect(workAnalysis.distribution.bugs).toBe(4);
      expect(workAnalysis.distribution.tasks).toBe(1);
      expect(workAnalysis.workFocus.primary).toBe('Bugs');
      expect(workAnalysis.workFocus.percentage).toBe(80);

      // Step 2: Get intelligent metrics
      const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'qa');

      // Should include bug metrics
      const metricKeys = result.metrics.map((m) => m.key);
      expect(metricKeys).toContain('bugs_found');
      expect(metricKeys).toContain('bugs_resolved');

      // Verify work focus indicator
      expect(result.workFocus.primary).toBe('Bugs');
      expect(result.workFocus.description).toContain('bug');
    });

    /**
     * Validates: Requirements 2.2.6, 2.2.7
     */
    it('should handle mixed work distribution and show all relevant metrics', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 3 },
        { issueType: 'Bug', statusCategory: 'Done' },
        { issueType: 'Bug', statusCategory: 'Done' },
        { issueType: 'Task', statusCategory: 'Done' },
        { issueType: 'Task', statusCategory: 'Done' },
      ];

      // Step 1: Analyze work distribution
      const workAnalysis = workDistributionService.analyzeWorkDistribution(issues);
      
      expect(workAnalysis.distribution.stories).toBe(2);
      expect(workAnalysis.distribution.bugs).toBe(2);
      expect(workAnalysis.distribution.tasks).toBe(2);
      expect(workAnalysis.total).toBe(6);

      // Step 2: Calculate percentages
      const percentages = workDistributionService.calculatePercentages(
        workAnalysis.distribution,
        workAnalysis.total
      );
      
      expect(percentages.stories).toBeCloseTo(33.3, 1);
      expect(percentages.bugs).toBeCloseTo(33.3, 1);
      expect(percentages.tasks).toBeCloseTo(33.3, 1);

      // Step 3: Get intelligent metrics for QA team (which has bug metrics)
      const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'qa');

      // Should include metrics for work types present in QA team's metric definitions
      const metricKeys = result.metrics.map((m) => m.key);
      expect(metricKeys).toContain('bugs_found');
      expect(metricKeys).toContain('bugs_resolved');

      // Verify work distribution breakdown
      const breakdown = workDistributionService.generateBreakdown(
        workAnalysis.distribution,
        workAnalysis.total
      );
      
      expect(breakdown).toHaveLength(3);
      expect(breakdown.every((item) => item.percentage > 0)).toBe(true);
    });
  });

  describe('Edge case: Empty teams', () => {
    /**
     * Validates: Requirement 2.2.8 - Handle teams with no work items
     */
    it('should handle team with no work items gracefully', () => {
      const issues: any[] = [];

      // Step 1: Analyze work distribution
      const workAnalysis = workDistributionService.analyzeWorkDistribution(issues);
      
      expect(workAnalysis.distribution).toEqual({
        stories: 0,
        bugs: 0,
        tasks: 0,
        epics: 0,
        subtasks: 0,
      });
      expect(workAnalysis.total).toBe(0);
      expect(workAnalysis.hasWork).toBe(false);
      expect(workAnalysis.workFocus.primary).toBe('No Work Items');
      expect(workAnalysis.workFocus.percentage).toBe(0);

      // Step 2: Get intelligent metrics
      const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');

      // Should return empty metrics array
      expect(result.metrics).toEqual([]);
      expect(result.workDistribution).toEqual(workAnalysis.distribution);
      expect(result.workFocus.primary).toBe('No Work Items');

      // Step 3: Verify breakdown is empty
      const breakdown = workDistributionService.generateBreakdown(
        workAnalysis.distribution,
        workAnalysis.total
      );
      
      expect(breakdown).toEqual([]);
    });

    /**
     * Validates: Requirement 2.2.8 - Handle teams with only in-progress work
     */
    it('should handle team with only in-progress work (no completed items)', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'In Progress' },
        { issueType: 'Bug', statusCategory: 'To Do' },
        { issueType: 'Task', statusCategory: 'In Progress' },
      ];

      // Step 1: Analyze work distribution (counts all items)
      const workAnalysis = workDistributionService.analyzeWorkDistribution(issues);
      
      expect(workAnalysis.distribution.stories).toBe(1);
      expect(workAnalysis.distribution.bugs).toBe(1);
      expect(workAnalysis.distribution.tasks).toBe(1);
      expect(workAnalysis.hasWork).toBe(true);

      // Step 2: Get intelligent metrics (filters by completion)
      const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');

      // Should have work distribution but no completed metrics
      expect(result.workDistribution.stories).toBe(1);
      expect(result.workDistribution.bugs).toBe(1);
      expect(result.workDistribution.tasks).toBe(1);

      // Metrics should be filtered due to zero completion values
      expect(result.metrics.length).toBe(0);
    });
  });

  describe('Edge case: Single work type', () => {
    /**
     * Validates: Requirement 2.2.5 - Handle teams with single work type
     */
    it('should handle team with only stories (100% story focus)', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 3 },
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 8 },
        { issueType: 'Story', statusCategory: 'In Progress', storyPoints: 2 },
      ];

      // Step 1: Analyze work distribution
      const workAnalysis = workDistributionService.analyzeWorkDistribution(issues);
      
      expect(workAnalysis.distribution.stories).toBe(4);
      expect(workAnalysis.distribution.bugs).toBe(0);
      expect(workAnalysis.distribution.tasks).toBe(0);
      expect(workAnalysis.total).toBe(4);
      expect(workAnalysis.workFocus.primary).toBe('Stories');
      expect(workAnalysis.workFocus.percentage).toBe(100);

      // Step 2: Get intelligent metrics
      const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');

      // Should only include story-related metrics
      const metricKeys = result.metrics.map((m) => m.key);
      expect(metricKeys).toContain('stories_completed');
      expect(metricKeys).toContain('story_points');

      // Should exclude all bug and task-specific metrics
      expect(metricKeys).not.toContain('bugs_found');
      expect(metricKeys).not.toContain('bugs_resolved');

      // Verify breakdown shows only stories
      const breakdown = workDistributionService.generateBreakdown(
        workAnalysis.distribution,
        workAnalysis.total
      );
      
      expect(breakdown).toHaveLength(1);
      expect(breakdown[0].type).toBe('Stories');
      expect(breakdown[0].percentage).toBe(100);
    });

    /**
     * Validates: Requirement 2.2.4 - Handle teams with only bugs
     */
    it('should handle team with only bugs (100% bug focus)', () => {
      const issues = [
        { issueType: 'Bug', statusCategory: 'Done', priority: 'High' },
        { issueType: 'Bug', statusCategory: 'Done', priority: 'Medium' },
        { issueType: 'Bug', statusCategory: 'In Progress', priority: 'Critical' },
      ];

      // Step 1: Analyze work distribution
      const workAnalysis = workDistributionService.analyzeWorkDistribution(issues);
      
      expect(workAnalysis.distribution.bugs).toBe(3);
      expect(workAnalysis.distribution.stories).toBe(0);
      expect(workAnalysis.total).toBe(3);
      expect(workAnalysis.workFocus.primary).toBe('Bugs');
      expect(workAnalysis.workFocus.percentage).toBe(100);

      // Step 2: Get intelligent metrics
      const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'qa');

      // Should only include bug-related metrics
      const metricKeys = result.metrics.map((m) => m.key);
      expect(metricKeys).toContain('bugs_found');
      expect(metricKeys).toContain('bugs_resolved');

      // Should exclude story-specific metrics
      expect(metricKeys).not.toContain('stories_completed');
      expect(metricKeys).not.toContain('story_points');

      // Verify breakdown shows only bugs
      const breakdown = workDistributionService.generateBreakdown(
        workAnalysis.distribution,
        workAnalysis.total
      );
      
      expect(breakdown).toHaveLength(1);
      expect(breakdown[0].type).toBe('Bugs');
      expect(breakdown[0].percentage).toBe(100);
    });

    /**
     * Validates: Handle teams with only tasks
     */
    it('should handle team with only tasks (100% task focus)', () => {
      const issues = [
        { issueType: 'Task', statusCategory: 'Done' },
        { issueType: 'Task', statusCategory: 'Done' },
        { issueType: 'Task', statusCategory: 'In Progress' },
      ];

      // Step 1: Analyze work distribution
      const workAnalysis = workDistributionService.analyzeWorkDistribution(issues);
      
      expect(workAnalysis.distribution.tasks).toBe(3);
      expect(workAnalysis.distribution.stories).toBe(0);
      expect(workAnalysis.distribution.bugs).toBe(0);
      expect(workAnalysis.total).toBe(3);
      expect(workAnalysis.workFocus.primary).toBe('Tasks');
      expect(workAnalysis.workFocus.percentage).toBe(100);

      // Step 2: Get intelligent metrics
      const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');

      // Should include task-related metrics
      const metricKeys = result.metrics.map((m) => m.key);
      expect(metricKeys).toContain('tasks_done');

      // Verify breakdown shows only tasks
      const breakdown = workDistributionService.generateBreakdown(
        workAnalysis.distribution,
        workAnalysis.total
      );
      
      expect(breakdown).toHaveLength(1);
      expect(breakdown[0].type).toBe('Tasks');
      expect(breakdown[0].percentage).toBe(100);
    });
  });

  describe('Various work item distributions', () => {
    /**
     * Validates: Requirement 2.2.7 - Work distribution breakdown
     */
    it('should handle 80/20 distribution (dominant work type)', () => {
      const issues = [
        ...Array(8).fill({ issueType: 'Story', statusCategory: 'Done', storyPoints: 5 }),
        ...Array(2).fill({ issueType: 'Bug', statusCategory: 'Done' }),
      ];

      // Step 1: Analyze work distribution
      const workAnalysis = workDistributionService.analyzeWorkDistribution(issues);
      
      expect(workAnalysis.distribution.stories).toBe(8);
      expect(workAnalysis.distribution.bugs).toBe(2);
      expect(workAnalysis.total).toBe(10);

      // Step 2: Calculate percentages
      const percentages = workDistributionService.calculatePercentages(
        workAnalysis.distribution,
        workAnalysis.total
      );
      
      expect(percentages.stories).toBe(80);
      expect(percentages.bugs).toBe(20);

      // Step 3: Get dominant work types
      const dominant = workDistributionService.getDominantWorkTypes(
        workAnalysis.distribution,
        workAnalysis.total,
        20
      );
      
      expect(dominant).toContain('Stories');
      expect(dominant).toContain('Bugs');
      expect(dominant).toHaveLength(2);

      // Step 4: Verify work focus
      expect(workAnalysis.workFocus.primary).toBe('Stories');
      expect(workAnalysis.workFocus.percentage).toBe(80);
    });

    /**
     * Validates: Requirement 2.2.7 - Work distribution breakdown
     */
    it('should handle even distribution across multiple work types', () => {
      const issues = [
        ...Array(3).fill({ issueType: 'Story', statusCategory: 'Done', storyPoints: 5 }),
        ...Array(3).fill({ issueType: 'Bug', statusCategory: 'Done' }),
        ...Array(3).fill({ issueType: 'Task', statusCategory: 'Done' }),
        ...Array(1).fill({ issueType: 'Epic', statusCategory: 'Done' }),
      ];

      // Step 1: Analyze work distribution
      const workAnalysis = workDistributionService.analyzeWorkDistribution(issues);
      
      expect(workAnalysis.distribution.stories).toBe(3);
      expect(workAnalysis.distribution.bugs).toBe(3);
      expect(workAnalysis.distribution.tasks).toBe(3);
      expect(workAnalysis.distribution.epics).toBe(1);
      expect(workAnalysis.total).toBe(10);

      // Step 2: Generate breakdown
      const breakdown = workDistributionService.generateBreakdown(
        workAnalysis.distribution,
        workAnalysis.total
      );
      
      expect(breakdown).toHaveLength(4);
      
      // Verify sorted by count
      expect(breakdown[0].count).toBeGreaterThanOrEqual(breakdown[1].count);
      expect(breakdown[1].count).toBeGreaterThanOrEqual(breakdown[2].count);
      expect(breakdown[2].count).toBeGreaterThanOrEqual(breakdown[3].count);

      // Step 3: Get intelligent metrics
      const result = intelligentMetricFilterService.getIntelligentMetrics(issues, 'dev');

      // Should include metrics for all work types
      const metricKeys = result.metrics.map((m) => m.key);
      expect(metricKeys.length).toBeGreaterThan(0);
    });

    /**
     * Validates: Requirement 2.2.9 - Dynamic metric adaptation
     */
    it('should adapt metrics as work patterns change over time', () => {
      // Initial period: mostly stories
      const initialIssues = [
        ...Array(5).fill({ issueType: 'Story', statusCategory: 'Done', storyPoints: 5 }),
        { issueType: 'Bug', statusCategory: 'Done' },
      ];

      const initialAnalysis = workDistributionService.analyzeWorkDistribution(initialIssues);
      const initialResult = intelligentMetricFilterService.getIntelligentMetrics(
        initialIssues,
        'dev'
      );

      expect(initialAnalysis.workFocus.primary).toBe('Stories');
      const initialMetricKeys = initialResult.metrics.map((m) => m.key);
      expect(initialMetricKeys).toContain('stories_completed');

      // Later period: shift to bugs (use QA team which has bug metrics)
      const laterIssues = [
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
        ...Array(5).fill({ issueType: 'Bug', statusCategory: 'Done' }),
      ];

      const laterAnalysis = workDistributionService.analyzeWorkDistribution(laterIssues);
      const laterResult = intelligentMetricFilterService.getIntelligentMetrics(
        laterIssues,
        'qa' // Use QA team which has bug metrics defined
      );

      expect(laterAnalysis.workFocus.primary).toBe('Bugs');
      const laterMetricKeys = laterResult.metrics.map((m) => m.key);
      expect(laterMetricKeys).toContain('bugs_resolved');

      // Verify metrics adapted to new work pattern
      expect(initialAnalysis.workFocus.primary).not.toBe(laterAnalysis.workFocus.primary);
    });
  });

  describe('Integration with metric mapping service', () => {
    /**
     * Validates: Requirements 2.2.2, 2.2.3 - Metric calculation integration
     */
    it('should integrate work distribution with metric calculation', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 3 },
        { issueType: 'Bug', statusCategory: 'Done' },
      ];

      // Step 1: Analyze work distribution
      const workAnalysis = workDistributionService.analyzeWorkDistribution(issues);

      // Step 2: Calculate all metrics (without filtering)
      const allMetrics = metricMappingService.calculateMetrics(issues, 'dev', false);

      // Step 3: Get intelligent filtered metrics
      const filteredResult = intelligentMetricFilterService.getIntelligentMetrics(
        issues,
        'dev'
      );

      // Verify filtering occurred
      expect(filteredResult.metrics.length).toBeLessThanOrEqual(allMetrics.length);
      expect(filteredResult.filteredCount).toBeGreaterThanOrEqual(0);
      expect(filteredResult.totalAvailableMetrics).toBe(allMetrics.length);

      // Verify work distribution matches
      expect(filteredResult.workDistribution).toEqual(workAnalysis.distribution);
    });

    /**
     * Validates: Requirement 2.2.10 - Filtering by work item type
     */
    it('should support filtering by work item type', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 3 },
        { issueType: 'Bug', statusCategory: 'Done' },
        { issueType: 'Task', statusCategory: 'Done' },
      ];

      // Filter to only stories
      const storyIssues = issues.filter((i) => i.issueType === 'Story');
      const storyAnalysis = workDistributionService.analyzeWorkDistribution(storyIssues);
      
      expect(storyAnalysis.distribution.stories).toBe(2);
      expect(storyAnalysis.distribution.bugs).toBe(0);
      expect(storyAnalysis.distribution.tasks).toBe(0);

      // Filter to only bugs
      const bugIssues = issues.filter((i) => i.issueType === 'Bug');
      const bugAnalysis = workDistributionService.analyzeWorkDistribution(bugIssues);
      
      expect(bugAnalysis.distribution.bugs).toBe(1);
      expect(bugAnalysis.distribution.stories).toBe(0);

      // Verify metrics adapt to filtered data
      const storyResult = intelligentMetricFilterService.getIntelligentMetrics(
        storyIssues,
        'dev'
      );
      const storyMetricKeys = storyResult.metrics.map((m) => m.key);
      expect(storyMetricKeys).not.toContain('bugs_found');
    });
  });

  describe('Metric filtering context and summary', () => {
    /**
     * Validates: Requirement 2.2.8 - Provide context for metric decisions
     */
    it('should provide detailed context for filtering decisions', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
        { issueType: 'Task', statusCategory: 'Done' },
      ];

      const context = intelligentMetricFilterService.getMetricsWithContext(issues, 'dev');

      // Should have displayed metrics
      expect(context.displayedMetrics.length).toBeGreaterThan(0);

      // Should have excluded metrics with reasons
      expect(context.excludedMetrics.length).toBeGreaterThan(0);
      context.excludedMetrics.forEach((excluded) => {
        expect(excluded.reason).toBeDefined();
        expect(excluded.metric).toBeDefined();
      });

      // Should include work distribution
      expect(context.workDistribution).toBeDefined();
      expect(context.workDistribution.stories).toBe(1);
      expect(context.workDistribution.tasks).toBe(1);

      // Should include work focus
      expect(context.workFocus).toBeDefined();
      expect(context.workFocus.primary).toBeDefined();
    });

    /**
     * Validates: Requirement 2.2.8 - Filtering summary statistics
     */
    it('should provide filtering summary with statistics', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 3 },
      ];

      const summary = intelligentMetricFilterService.getFilteringSummary(issues, 'dev');

      expect(summary.totalMetrics).toBeGreaterThan(0);
      expect(summary.displayedMetrics).toBeGreaterThan(0);
      expect(summary.filteredByWorkType).toBeGreaterThanOrEqual(0);
      expect(summary.filteredByZeroValue).toBeGreaterThanOrEqual(0);
      expect(summary.workDistribution).toBeDefined();

      // Verify counts add up
      const totalFiltered = summary.filteredByWorkType + summary.filteredByZeroValue;
      expect(summary.displayedMetrics + totalFiltered).toBeLessThanOrEqual(
        summary.totalMetrics
      );
    });
  });
});
