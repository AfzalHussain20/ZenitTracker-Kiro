/**
 * Intelligent Metric Filter Service
 * 
 * Integrates work distribution analysis with metric calculation to provide
 * intelligent filtering of metrics based on actual work performed by teams.
 * 
 * This service ensures that only relevant metrics are displayed - for example,
 * if a team has no bugs, bug-related metrics won't be shown even if they're
 * a QA team.
 */

import { MetricValue, TeamType, WorkDistribution } from '@/types/kpi-dashboard';
import { workDistributionService, WorkDistributionAnalysis } from './work-distribution.service';
import { metricMappingService } from './metric-mapping.service';

export interface IntelligentMetricResult {
  metrics: MetricValue[];
  workDistribution: WorkDistribution;
  workFocus: {
    primary: string;
    percentage: number;
    description: string;
  };
  filteredCount: number;
  totalAvailableMetrics: number;
}

class IntelligentMetricFilterService {
  /**
   * Calculate and filter metrics based on actual work performed
   * 
   * This is the main integration point that combines work distribution analysis
   * with metric calculation to provide intelligent filtering.
   * 
   * @param issues - Array of Jira issues to analyze
   * @param teamType - The type of team (used for base metric selection)
   * @returns Filtered metrics with work distribution analysis
   */
  getIntelligentMetrics(issues: any[], teamType: TeamType): IntelligentMetricResult {
    // Step 1: Analyze work distribution to understand what the team actually does
    const workAnalysis = workDistributionService.analyzeWorkDistribution(issues);

    // Step 2: Calculate all potential metrics for the team type
    const allMetrics = metricMappingService.calculateMetrics(issues, teamType, false);

    // Step 3: Filter metrics based on actual work performed
    const filteredMetrics = this.filterMetricsByWorkDistribution(
      allMetrics,
      workAnalysis.distribution
    );

    return {
      metrics: filteredMetrics,
      workDistribution: workAnalysis.distribution,
      workFocus: workAnalysis.workFocus,
      filteredCount: allMetrics.length - filteredMetrics.length,
      totalAvailableMetrics: allMetrics.length,
    };
  }

  /**
   * Filter metrics based on work distribution
   * 
   * Excludes metrics for work types that don't exist in the team's actual work.
   * For example, if a team has no bugs, exclude bug-related metrics.
   * 
   * @param metrics - All calculated metrics
   * @param distribution - Work distribution analysis
   * @returns Filtered metrics array
   */
  private filterMetricsByWorkDistribution(
    metrics: MetricValue[],
    distribution: WorkDistribution
  ): MetricValue[] {
    return metrics.filter((metric) => {
      // Always include zero-value metrics if they're not work-type specific
      if (!this.isWorkTypeSpecificMetric(metric.key)) {
        return metric.value > 0; // Only exclude if zero
      }

      // For work-type specific metrics, check if that work type exists
      const workType = this.getWorkTypeForMetric(metric.key);
      if (!workType) {
        return metric.value > 0; // Unknown metric type, use default filtering
      }

      // Check if the team has this type of work
      const hasWorkType = distribution[workType] > 0;
      
      // Include metric only if:
      // 1. The team has this work type, AND
      // 2. The metric has a non-zero value
      return hasWorkType && metric.value > 0;
    });
  }

  /**
   * Check if a metric is specific to a work type
   * 
   * @param metricKey - The metric key to check
   * @returns True if the metric is work-type specific
   */
  private isWorkTypeSpecificMetric(metricKey: string): boolean {
    const workTypeSpecificMetrics = [
      // Story-related metrics
      'stories_completed',
      'story_points',
      
      // Bug-related metrics
      'bugs_found',
      'bugs_resolved',
      'defects_logged',
      
      // Task-related metrics
      'tasks_done',
      'test_cases_executed',
      'design_tasks',
      
      // Epic-related metrics
      'epics_completed',
      
      // Subtask-related metrics
      'subtasks_completed',
    ];

    return workTypeSpecificMetrics.includes(metricKey);
  }

  /**
   * Get the work type associated with a metric
   * 
   * @param metricKey - The metric key
   * @returns The work type key or null if not work-type specific
   */
  private getWorkTypeForMetric(metricKey: string): keyof WorkDistribution | null {
    const metricToWorkTypeMap: Record<string, keyof WorkDistribution> = {
      // Story metrics
      'stories_completed': 'stories',
      'story_points': 'stories',
      
      // Bug metrics
      'bugs_found': 'bugs',
      'bugs_resolved': 'bugs',
      'defects_logged': 'bugs',
      
      // Task metrics
      'tasks_done': 'tasks',
      'test_cases_executed': 'tasks',
      'design_tasks': 'tasks',
      'schema_changes': 'tasks',
      'query_optimizations': 'tasks',
      'migrations_completed': 'tasks',
      'db_performance_improvements': 'tasks',
      'endpoints_created': 'tasks',
      'api_documentation': 'tasks',
      'integration_tests': 'tasks',
      'api_performance': 'tasks',
      'message_templates': 'tasks',
      'delivery_rates': 'tasks',
      'campaign_metrics': 'tasks',
      'sms_integrations': 'tasks',
      'reports_created': 'tasks',
      'dashboards_built': 'tasks',
      'data_analysis': 'tasks',
      'insights_delivered': 'tasks',
      'mockups_created': 'tasks',
      'prototypes_delivered': 'tasks',
      'design_reviews': 'tasks',
      'user_research': 'tasks',
      'regression_tests': 'tasks',
      
      // Epic metrics
      'epics_completed': 'epics',
      
      // Subtask metrics
      'subtasks_completed': 'subtasks',
    };

    return metricToWorkTypeMap[metricKey] || null;
  }

  /**
   * Get work focus indicator for display
   * 
   * @param issues - Array of Jira issues
   * @returns Work focus information
   */
  getWorkFocusIndicator(issues: any[]): {
    primary: string;
    percentage: number;
    description: string;
  } {
    const analysis = workDistributionService.analyzeWorkDistribution(issues);
    return analysis.workFocus;
  }

  /**
   * Check if a team should display a specific metric based on their work
   * 
   * @param metricKey - The metric key to check
   * @param issues - Array of Jira issues
   * @returns True if the metric should be displayed
   */
  shouldDisplayMetric(metricKey: string, issues: any[]): boolean {
    const analysis = workDistributionService.analyzeWorkDistribution(issues);
    
    // If not work-type specific, always display if non-zero
    if (!this.isWorkTypeSpecificMetric(metricKey)) {
      return true;
    }

    // Check if the team has the relevant work type
    const workType = this.getWorkTypeForMetric(metricKey);
    if (!workType) {
      return true;
    }

    return analysis.distribution[workType] > 0;
  }

  /**
   * Get metrics with work distribution context
   * 
   * Provides additional context about why metrics are included/excluded
   * 
   * @param issues - Array of Jira issues
   * @param teamType - The type of team
   * @returns Metrics with context information
   */
  getMetricsWithContext(issues: any[], teamType: TeamType): {
    displayedMetrics: MetricValue[];
    excludedMetrics: Array<{
      metric: MetricValue;
      reason: string;
    }>;
    workDistribution: WorkDistribution;
    workFocus: {
      primary: string;
      percentage: number;
      description: string;
    };
  } {
    const workAnalysis = workDistributionService.analyzeWorkDistribution(issues);
    const allMetrics = metricMappingService.calculateMetrics(issues, teamType, false);

    const displayedMetrics: MetricValue[] = [];
    const excludedMetrics: Array<{ metric: MetricValue; reason: string }> = [];

    for (const metric of allMetrics) {
      const workType = this.getWorkTypeForMetric(metric.key);
      
      if (workType && workAnalysis.distribution[workType] === 0) {
        excludedMetrics.push({
          metric,
          reason: `Team has no ${workType} work items`,
        });
      } else if (metric.value === 0) {
        excludedMetrics.push({
          metric,
          reason: 'Metric value is zero',
        });
      } else {
        displayedMetrics.push(metric);
      }
    }

    return {
      displayedMetrics,
      excludedMetrics,
      workDistribution: workAnalysis.distribution,
      workFocus: workAnalysis.workFocus,
    };
  }

  /**
   * Generate a summary of metric filtering decisions
   * 
   * Useful for debugging and understanding why certain metrics are shown/hidden
   * 
   * @param issues - Array of Jira issues
   * @param teamType - The type of team
   * @returns Summary of filtering decisions
   */
  getFilteringSummary(issues: any[], teamType: TeamType): {
    totalMetrics: number;
    displayedMetrics: number;
    filteredByWorkType: number;
    filteredByZeroValue: number;
    workDistribution: WorkDistribution;
  } {
    const context = this.getMetricsWithContext(issues, teamType);
    
    const filteredByWorkType = context.excludedMetrics.filter(
      (e) => e.reason.includes('no') && e.reason.includes('work items')
    ).length;
    
    const filteredByZeroValue = context.excludedMetrics.filter(
      (e) => e.reason.includes('zero')
    ).length;

    return {
      totalMetrics: context.displayedMetrics.length + context.excludedMetrics.length,
      displayedMetrics: context.displayedMetrics.length,
      filteredByWorkType,
      filteredByZeroValue,
      workDistribution: context.workDistribution,
    };
  }
}

// Export singleton instance
export const intelligentMetricFilterService = new IntelligentMetricFilterService();
