/**
 * Unit tests for Work Distribution Service
 */

import { workDistributionService } from '../work-distribution.service';
import { WorkDistribution } from '@/types/kpi-dashboard';

describe('WorkDistributionService', () => {
  describe('analyzeWorkDistribution', () => {
    it('should correctly count different issue types', () => {
      const issues = [
        { issueType: 'Story' },
        { issueType: 'Story' },
        { issueType: 'Bug' },
        { issueType: 'Task' },
        { issueType: 'Epic' },
        { issueType: 'Subtask' },
      ];

      const result = workDistributionService.analyzeWorkDistribution(issues);

      expect(result.distribution).toEqual({
        stories: 2,
        bugs: 1,
        tasks: 1,
        epics: 1,
        subtasks: 1,
      });
      expect(result.total).toBe(6);
      expect(result.hasWork).toBe(true);
    });

    it('should handle empty issue list', () => {
      const result = workDistributionService.analyzeWorkDistribution([]);

      expect(result.distribution).toEqual({
        stories: 0,
        bugs: 0,
        tasks: 0,
        epics: 0,
        subtasks: 0,
      });
      expect(result.total).toBe(0);
      expect(result.hasWork).toBe(false);
      expect(result.workFocus.primary).toBe('No Work Items');
    });

    it('should normalize issue type variations', () => {
      const issues = [
        { issueType: 'Story' },
        { issueType: 'User Story' },
        { issueType: 'Bug' },
        { issueType: 'Defect' },
        { issueType: 'Sub-task' },
        { issueType: 'Subtask' },
      ];

      const result = workDistributionService.analyzeWorkDistribution(issues);

      expect(result.distribution.stories).toBe(2);
      expect(result.distribution.bugs).toBe(2);
      expect(result.distribution.subtasks).toBe(2);
    });

    it('should handle unknown issue types as tasks', () => {
      const issues = [
        { issueType: 'Unknown Type' },
        { issueType: 'Custom Issue' },
      ];

      const result = workDistributionService.analyzeWorkDistribution(issues);

      expect(result.distribution.tasks).toBe(2);
    });

    it('should determine work focus correctly', () => {
      const issues = [
        { issueType: 'Bug' },
        { issueType: 'Bug' },
        { issueType: 'Bug' },
        { issueType: 'Story' },
      ];

      const result = workDistributionService.analyzeWorkDistribution(issues);

      expect(result.workFocus.primary).toBe('Bugs');
      expect(result.workFocus.percentage).toBe(75);
      expect(result.workFocus.description).toContain('bug fixes');
    });
  });

  describe('calculatePercentages', () => {
    it('should calculate correct percentages', () => {
      const distribution: WorkDistribution = {
        stories: 5,
        bugs: 3,
        tasks: 2,
        epics: 0,
        subtasks: 0,
      };

      const percentages = workDistributionService.calculatePercentages(distribution, 10);

      expect(percentages.stories).toBe(50);
      expect(percentages.bugs).toBe(30);
      expect(percentages.tasks).toBe(20);
      expect(percentages.epics).toBe(0);
      expect(percentages.subtasks).toBe(0);
    });

    it('should handle zero total', () => {
      const distribution: WorkDistribution = {
        stories: 0,
        bugs: 0,
        tasks: 0,
        epics: 0,
        subtasks: 0,
      };

      const percentages = workDistributionService.calculatePercentages(distribution, 0);

      expect(percentages.stories).toBe(0);
      expect(percentages.bugs).toBe(0);
      expect(percentages.tasks).toBe(0);
    });

    it('should calculate percentages that sum to 100', () => {
      const distribution: WorkDistribution = {
        stories: 3,
        bugs: 3,
        tasks: 3,
        epics: 0,
        subtasks: 0,
      };

      const percentages = workDistributionService.calculatePercentages(distribution, 9);
      const sum = Object.values(percentages).reduce((acc, val) => acc + val, 0);

      expect(Math.round(sum)).toBe(100);
    });
  });

  describe('determineWorkFocus', () => {
    it('should identify stories as primary focus', () => {
      const distribution: WorkDistribution = {
        stories: 10,
        bugs: 2,
        tasks: 1,
        epics: 0,
        subtasks: 0,
      };

      const focus = workDistributionService.determineWorkFocus(distribution, 13);

      expect(focus.primary).toBe('Stories');
      expect(focus.percentage).toBeCloseTo(76.9, 1);
      expect(focus.description).toContain('user stories');
    });

    it('should identify bugs as primary focus', () => {
      const distribution: WorkDistribution = {
        stories: 1,
        bugs: 8,
        tasks: 1,
        epics: 0,
        subtasks: 0,
      };

      const focus = workDistributionService.determineWorkFocus(distribution, 10);

      expect(focus.primary).toBe('Bugs');
      expect(focus.percentage).toBe(80);
      expect(focus.description).toContain('bug fixes');
    });

    it('should identify tasks as primary focus', () => {
      const distribution: WorkDistribution = {
        stories: 1,
        bugs: 1,
        tasks: 6,
        epics: 0,
        subtasks: 0,
      };

      const focus = workDistributionService.determineWorkFocus(distribution, 8);

      expect(focus.primary).toBe('Tasks');
      expect(focus.percentage).toBe(75);
      expect(focus.description).toContain('general tasks');
    });

    it('should handle no work items', () => {
      const distribution: WorkDistribution = {
        stories: 0,
        bugs: 0,
        tasks: 0,
        epics: 0,
        subtasks: 0,
      };

      const focus = workDistributionService.determineWorkFocus(distribution, 0);

      expect(focus.primary).toBe('No Work Items');
      expect(focus.percentage).toBe(0);
    });
  });

  describe('generateBreakdown', () => {
    it('should generate breakdown sorted by count', () => {
      const distribution: WorkDistribution = {
        stories: 5,
        bugs: 10,
        tasks: 2,
        epics: 0,
        subtasks: 3,
      };

      const breakdown = workDistributionService.generateBreakdown(distribution, 20);

      expect(breakdown).toHaveLength(4); // Only non-zero items
      expect(breakdown[0].type).toBe('Bugs');
      expect(breakdown[0].count).toBe(10);
      expect(breakdown[0].percentage).toBe(50);
      expect(breakdown[1].type).toBe('Stories');
      expect(breakdown[1].count).toBe(5);
    });

    it('should exclude zero-count work types', () => {
      const distribution: WorkDistribution = {
        stories: 5,
        bugs: 0,
        tasks: 0,
        epics: 0,
        subtasks: 0,
      };

      const breakdown = workDistributionService.generateBreakdown(distribution, 5);

      expect(breakdown).toHaveLength(1);
      expect(breakdown[0].type).toBe('Stories');
    });

    it('should return empty array for no work items', () => {
      const distribution: WorkDistribution = {
        stories: 0,
        bugs: 0,
        tasks: 0,
        epics: 0,
        subtasks: 0,
      };

      const breakdown = workDistributionService.generateBreakdown(distribution, 0);

      expect(breakdown).toEqual([]);
    });

    it('should round percentages to 1 decimal place', () => {
      const distribution: WorkDistribution = {
        stories: 1,
        bugs: 2,
        tasks: 0,
        epics: 0,
        subtasks: 0,
      };

      const breakdown = workDistributionService.generateBreakdown(distribution, 3);

      expect(breakdown[0].percentage).toBe(66.7);
      expect(breakdown[1].percentage).toBe(33.3);
    });
  });

  describe('hasWorkType', () => {
    it('should return true when work type exists', () => {
      const distribution: WorkDistribution = {
        stories: 5,
        bugs: 0,
        tasks: 0,
        epics: 0,
        subtasks: 0,
      };

      expect(workDistributionService.hasWorkType(distribution, 'stories')).toBe(true);
    });

    it('should return false when work type does not exist', () => {
      const distribution: WorkDistribution = {
        stories: 5,
        bugs: 0,
        tasks: 0,
        epics: 0,
        subtasks: 0,
      };

      expect(workDistributionService.hasWorkType(distribution, 'bugs')).toBe(false);
    });
  });

  describe('getDominantWorkTypes', () => {
    it('should identify work types above threshold', () => {
      const distribution: WorkDistribution = {
        stories: 5,
        bugs: 3,
        tasks: 2,
        epics: 0,
        subtasks: 0,
      };

      const dominant = workDistributionService.getDominantWorkTypes(distribution, 10, 20);

      expect(dominant).toContain('Stories'); // 50%
      expect(dominant).toContain('Bugs'); // 30%
      expect(dominant).toContain('Tasks'); // 20%
      expect(dominant).toHaveLength(3);
    });

    it('should use default threshold of 20%', () => {
      const distribution: WorkDistribution = {
        stories: 8,
        bugs: 1,
        tasks: 1,
        epics: 0,
        subtasks: 0,
      };

      const dominant = workDistributionService.getDominantWorkTypes(distribution, 10);

      expect(dominant).toContain('Stories'); // 80%
      expect(dominant).not.toContain('Bugs'); // 10%
      expect(dominant).toHaveLength(1);
    });

    it('should return empty array for no work items', () => {
      const distribution: WorkDistribution = {
        stories: 0,
        bugs: 0,
        tasks: 0,
        epics: 0,
        subtasks: 0,
      };

      const dominant = workDistributionService.getDominantWorkTypes(distribution, 0);

      expect(dominant).toEqual([]);
    });

    it('should handle custom threshold', () => {
      const distribution: WorkDistribution = {
        stories: 6,
        bugs: 4,
        tasks: 0,
        epics: 0,
        subtasks: 0,
      };

      const dominant = workDistributionService.getDominantWorkTypes(distribution, 10, 50);

      expect(dominant).toContain('Stories'); // 60%
      expect(dominant).not.toContain('Bugs'); // 40%
      expect(dominant).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle single issue type', () => {
      const issues = [
        { issueType: 'Story' },
        { issueType: 'Story' },
        { issueType: 'Story' },
      ];

      const result = workDistributionService.analyzeWorkDistribution(issues);

      expect(result.distribution.stories).toBe(3);
      expect(result.total).toBe(3);
      expect(result.workFocus.primary).toBe('Stories');
      expect(result.workFocus.percentage).toBe(100);
    });

    it('should handle case-insensitive issue types', () => {
      const issues = [
        { issueType: 'STORY' },
        { issueType: 'story' },
        { issueType: 'Story' },
      ];

      const result = workDistributionService.analyzeWorkDistribution(issues);

      expect(result.distribution.stories).toBe(3);
    });

    it('should handle issue types with extra whitespace', () => {
      const issues = [
        { issueType: '  Story  ' },
        { issueType: 'Story' },
      ];

      const result = workDistributionService.analyzeWorkDistribution(issues);

      expect(result.distribution.stories).toBe(2);
    });
  });
});
