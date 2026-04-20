/**
 * Unit tests for MetricMappingService
 */

import { metricMappingService } from '../metric-mapping.service';
import { TeamType } from '@/types/kpi-dashboard';

describe('MetricMappingService', () => {
  describe('getRelevantMetrics', () => {
    it('returns dev metrics for dev team type', () => {
      const metrics = metricMappingService.getRelevantMetrics('dev');
      
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.some(m => m.key === 'stories_completed')).toBe(true);
      expect(metrics.some(m => m.key === 'tasks_done')).toBe(true);
      expect(metrics.some(m => m.key === 'story_points')).toBe(true);
    });

    it('returns qa metrics for qa team type', () => {
      const metrics = metricMappingService.getRelevantMetrics('qa');
      
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.some(m => m.key === 'bugs_found')).toBe(true);
      expect(metrics.some(m => m.key === 'bugs_resolved')).toBe(true);
      expect(metrics.some(m => m.key === 'test_cases_executed')).toBe(true);
    });

    it('returns ui_ux metrics for ui_ux team type', () => {
      const metrics = metricMappingService.getRelevantMetrics('ui_ux');
      
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.some(m => m.key === 'design_tasks')).toBe(true);
      expect(metrics.some(m => m.key === 'mockups_created')).toBe(true);
    });

    it('returns generic metrics for unknown team type', () => {
      const metrics = metricMappingService.getRelevantMetrics('generic');
      
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.some(m => m.key === 'total_issues')).toBe(true);
      expect(metrics.some(m => m.key === 'stories')).toBe(true);
      expect(metrics.some(m => m.key === 'tasks')).toBe(true);
      expect(metrics.some(m => m.key === 'bugs')).toBe(true);
    });
  });

  describe('calculateMetrics', () => {
    it('calculates dev team metrics correctly', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 3 },
        { issueType: 'Task', statusCategory: 'Done' },
        { issueType: 'Bug', statusCategory: 'Done' },
      ];
      
      const metrics = metricMappingService.calculateMetrics(issues, 'dev');
      
      const storiesCompleted = metrics.find(m => m.key === 'stories_completed');
      expect(storiesCompleted?.value).toBe(2);
      
      const storyPoints = metrics.find(m => m.key === 'story_points');
      expect(storyPoints?.value).toBe(8);
      
      const tasksDone = metrics.find(m => m.key === 'tasks_done');
      expect(tasksDone?.value).toBe(1);
    });

    it('calculates qa team metrics correctly', () => {
      const issues = [
        { issueType: 'Bug', statusCategory: 'Done' },
        { issueType: 'Bug', statusCategory: 'In Progress' },
        { issueType: 'Bug', statusCategory: 'Done', priority: 'High' },
        { issueType: 'Task', statusCategory: 'Done', summary: 'Execute test cases' },
      ];
      
      const metrics = metricMappingService.calculateMetrics(issues, 'qa');
      
      const bugsFound = metrics.find(m => m.key === 'bugs_found');
      expect(bugsFound?.value).toBe(3);
      
      const bugsResolved = metrics.find(m => m.key === 'bugs_resolved');
      expect(bugsResolved?.value).toBe(2);
      
      const testCases = metrics.find(m => m.key === 'test_cases_executed');
      expect(testCases?.value).toBe(1);
    });

    it('excludes zero-value metrics by default', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done' },
      ];
      
      const metrics = metricMappingService.calculateMetrics(issues, 'dev');
      
      // commits, pull_requests, code_reviews should be excluded (they return 0)
      expect(metrics.some(m => m.key === 'commits' && m.value === 0)).toBe(false);
      expect(metrics.some(m => m.key === 'pull_requests' && m.value === 0)).toBe(false);
      expect(metrics.some(m => m.key === 'code_reviews' && m.value === 0)).toBe(false);
    });

    it('includes zero-value metrics when excludeZeroValues is false', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done' },
      ];
      
      const metrics = metricMappingService.calculateMetrics(issues, 'dev', false);
      
      // commits, pull_requests, code_reviews should be included even with 0 value
      expect(metrics.some(m => m.key === 'commits')).toBe(true);
      expect(metrics.some(m => m.key === 'pull_requests')).toBe(true);
      expect(metrics.some(m => m.key === 'code_reviews')).toBe(true);
    });

    it('handles empty issue list', () => {
      const metrics = metricMappingService.calculateMetrics([], 'dev');
      
      // Should return empty array when all metrics are 0 and excludeZeroValues is true
      expect(metrics).toEqual([]);
    });

    it('returns all metrics with zero values when excludeZeroValues is false', () => {
      const metrics = metricMappingService.calculateMetrics([], 'dev', false);
      
      // Should return all dev metrics with 0 values
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.every(m => m.value === 0)).toBe(true);
    });
  });

  describe('isMetricRelevant', () => {
    it('returns true for dev metrics on dev team', () => {
      expect(metricMappingService.isMetricRelevant('stories_completed', 'dev')).toBe(true);
      expect(metricMappingService.isMetricRelevant('story_points', 'dev')).toBe(true);
      expect(metricMappingService.isMetricRelevant('tasks_done', 'dev')).toBe(true);
    });

    it('returns false for qa metrics on dev team', () => {
      expect(metricMappingService.isMetricRelevant('bugs_found', 'dev')).toBe(false);
      expect(metricMappingService.isMetricRelevant('test_cases_executed', 'dev')).toBe(false);
    });

    it('returns true for qa metrics on qa team', () => {
      expect(metricMappingService.isMetricRelevant('bugs_found', 'qa')).toBe(true);
      expect(metricMappingService.isMetricRelevant('bugs_resolved', 'qa')).toBe(true);
    });

    it('returns false for dev metrics on qa team', () => {
      expect(metricMappingService.isMetricRelevant('stories_completed', 'qa')).toBe(false);
      expect(metricMappingService.isMetricRelevant('story_points', 'qa')).toBe(false);
    });

    it('returns false for non-existent metrics', () => {
      expect(metricMappingService.isMetricRelevant('non_existent_metric', 'dev')).toBe(false);
    });
  });

  describe('getMetricKeys', () => {
    it('returns all metric keys for dev team', () => {
      const keys = metricMappingService.getMetricKeys('dev');
      
      expect(keys).toContain('stories_completed');
      expect(keys).toContain('tasks_done');
      expect(keys).toContain('story_points');
      expect(keys).toContain('commits');
      expect(keys).toContain('pull_requests');
      expect(keys).toContain('code_reviews');
    });

    it('returns all metric keys for qa team', () => {
      const keys = metricMappingService.getMetricKeys('qa');
      
      expect(keys).toContain('bugs_found');
      expect(keys).toContain('bugs_resolved');
      expect(keys).toContain('test_cases_executed');
    });
  });

  describe('getMetricDefinition', () => {
    it('returns metric definition for valid metric key', () => {
      const metric = metricMappingService.getMetricDefinition('stories_completed', 'dev');
      
      expect(metric).toBeDefined();
      expect(metric?.key).toBe('stories_completed');
      expect(metric?.label).toBe('Stories Completed');
      expect(metric?.calculation).toBeDefined();
    });

    it('returns undefined for invalid metric key', () => {
      const metric = metricMappingService.getMetricDefinition('non_existent', 'dev');
      
      expect(metric).toBeUndefined();
    });

    it('returns undefined for metric not applicable to team type', () => {
      const metric = metricMappingService.getMetricDefinition('bugs_found', 'dev');
      
      expect(metric).toBeUndefined();
    });
  });

  describe('calculateSingleMetric', () => {
    it('calculates single metric correctly', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
        { issueType: 'Story', statusCategory: 'Done', storyPoints: 3 },
      ];
      
      const value = metricMappingService.calculateSingleMetric('stories_completed', issues, 'dev');
      
      expect(value).toBe(2);
    });

    it('returns null for non-existent metric', () => {
      const issues = [
        { issueType: 'Story', statusCategory: 'Done' },
      ];
      
      const value = metricMappingService.calculateSingleMetric('non_existent', issues, 'dev');
      
      expect(value).toBeNull();
    });

    it('returns null for metric not applicable to team type', () => {
      const issues = [
        { issueType: 'Bug', statusCategory: 'Done' },
      ];
      
      const value = metricMappingService.calculateSingleMetric('bugs_found', issues, 'dev');
      
      expect(value).toBeNull();
    });
  });

  describe('getSupportedTeamTypes', () => {
    it('returns all supported team types', () => {
      const types = metricMappingService.getSupportedTeamTypes();
      
      expect(types).toContain('dev');
      expect(types).toContain('qa');
      expect(types).toContain('ui_ux');
      expect(types).toContain('database');
      expect(types).toContain('api');
      expect(types).toContain('sms');
      expect(types).toContain('analytics');
      expect(types).toContain('generic');
    });
  });
});
