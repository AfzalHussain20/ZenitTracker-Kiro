/**
 * Work Distribution Analyzer Service
 * 
 * Analyzes Jira issues to determine what type of work a team actually performs
 * (Stories, Bugs, Tasks, Epics, Subtasks). This is used to intelligently display
 * only relevant metrics based on actual work patterns.
 */

import { WorkDistribution } from '@/types/kpi-dashboard';

export interface WorkFocus {
  primary: string;
  percentage: number;
  description: string;
}

export interface WorkDistributionAnalysis {
  distribution: WorkDistribution;
  total: number;
  workFocus: WorkFocus;
  hasWork: boolean;
}

class WorkDistributionService {
  /**
   * Analyze Jira issues to determine work distribution
   * 
   * @param issues - Array of Jira issues to analyze
   * @returns Work distribution analysis with percentages and focus
   */
  analyzeWorkDistribution(issues: any[]): WorkDistributionAnalysis {
    // Initialize counters
    const distribution: WorkDistribution = {
      stories: 0,
      bugs: 0,
      tasks: 0,
      epics: 0,
      subtasks: 0,
    };

    // Count each issue type
    for (const issue of issues) {
      const issueType = this.normalizeIssueType(issue.issueType);
      
      if (issueType in distribution) {
        distribution[issueType as keyof WorkDistribution]++;
      }
    }

    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    const hasWork = total > 0;

    // Determine work focus
    const workFocus = this.determineWorkFocus(distribution, total);

    return {
      distribution,
      total,
      workFocus,
      hasWork,
    };
  }

  /**
   * Calculate work distribution percentages
   * 
   * @param distribution - Work distribution counts
   * @param total - Total number of work items
   * @returns Object with percentage for each work type
   */
  calculatePercentages(distribution: WorkDistribution, total: number): Record<string, number> {
    if (total === 0) {
      return {
        stories: 0,
        bugs: 0,
        tasks: 0,
        epics: 0,
        subtasks: 0,
      };
    }

    return {
      stories: (distribution.stories / total) * 100,
      bugs: (distribution.bugs / total) * 100,
      tasks: (distribution.tasks / total) * 100,
      epics: (distribution.epics / total) * 100,
      subtasks: (distribution.subtasks / total) * 100,
    };
  }

  /**
   * Determine the team's primary work focus based on issue distribution
   * 
   * @param distribution - Work distribution counts
   * @param total - Total number of work items
   * @returns Work focus information
   */
  determineWorkFocus(distribution: WorkDistribution, total: number): WorkFocus {
    if (total === 0) {
      return {
        primary: 'No Work Items',
        percentage: 0,
        description: 'No work items found for this team',
      };
    }

    // Find the work type with highest count
    const workTypes = Object.entries(distribution) as [keyof WorkDistribution, number][];
    const sorted = workTypes.sort((a, b) => b[1] - a[1]);
    const [primaryType, primaryCount] = sorted[0];
    const percentage = (primaryCount / total) * 100;

    // Generate description based on primary work type
    const descriptions: Record<keyof WorkDistribution, string> = {
      stories: 'Team primarily works on user stories and feature development',
      bugs: 'Team primarily focuses on bug fixes and quality issues',
      tasks: 'Team primarily handles general tasks and maintenance work',
      epics: 'Team primarily manages large initiatives and epics',
      subtasks: 'Team primarily works on subtasks and detailed work items',
    };

    return {
      primary: this.formatWorkType(primaryType),
      percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
      description: descriptions[primaryType],
    };
  }

  /**
   * Generate work distribution breakdown for display
   * 
   * @param distribution - Work distribution counts
   * @param total - Total number of work items
   * @returns Array of work type breakdown items
   */
  generateBreakdown(distribution: WorkDistribution, total: number): Array<{
    type: string;
    count: number;
    percentage: number;
  }> {
    if (total === 0) {
      return [];
    }

    const percentages = this.calculatePercentages(distribution, total);
    const breakdown: Array<{ type: string; count: number; percentage: number }> = [];

    for (const [key, count] of Object.entries(distribution)) {
      if (count > 0) {
        breakdown.push({
          type: this.formatWorkType(key as keyof WorkDistribution),
          count,
          percentage: Math.round(percentages[key] * 10) / 10,
        });
      }
    }

    // Sort by count descending
    return breakdown.sort((a, b) => b.count - a.count);
  }

  /**
   * Check if a team has specific work types
   * 
   * @param distribution - Work distribution counts
   * @param workType - Work type to check
   * @returns True if team has this work type
   */
  hasWorkType(distribution: WorkDistribution, workType: keyof WorkDistribution): boolean {
    return distribution[workType] > 0;
  }

  /**
   * Get dominant work types (those above a threshold percentage)
   * 
   * @param distribution - Work distribution counts
   * @param total - Total number of work items
   * @param threshold - Minimum percentage to be considered dominant (default: 20%)
   * @returns Array of dominant work types
   */
  getDominantWorkTypes(
    distribution: WorkDistribution,
    total: number,
    threshold: number = 20
  ): string[] {
    if (total === 0) {
      return [];
    }

    const percentages = this.calculatePercentages(distribution, total);
    const dominant: string[] = [];

    for (const [key, percentage] of Object.entries(percentages)) {
      if (percentage >= threshold) {
        dominant.push(this.formatWorkType(key as keyof WorkDistribution));
      }
    }

    return dominant;
  }

  /**
   * Normalize issue type string to standard format
   * 
   * @param issueType - Raw issue type from Jira
   * @returns Normalized issue type
   */
  private normalizeIssueType(issueType: string): string {
    const normalized = issueType.toLowerCase().trim();

    // Map variations to standard types
    const typeMap: Record<string, string> = {
      story: 'stories',
      'user story': 'stories',
      bug: 'bugs',
      defect: 'bugs',
      task: 'tasks',
      epic: 'epics',
      subtask: 'subtasks',
      'sub-task': 'subtasks',
    };

    return typeMap[normalized] || 'tasks'; // Default to tasks for unknown types
  }

  /**
   * Format work type for display
   * 
   * @param workType - Work type key
   * @returns Formatted display name
   */
  private formatWorkType(workType: keyof WorkDistribution): string {
    const formatMap: Record<keyof WorkDistribution, string> = {
      stories: 'Stories',
      bugs: 'Bugs',
      tasks: 'Tasks',
      epics: 'Epics',
      subtasks: 'Subtasks',
    };

    return formatMap[workType] || workType;
  }
}

// Export singleton instance
export const workDistributionService = new WorkDistributionService();
