/**
 * Metric Mapping Service
 * 
 * Provides methods for getting relevant metrics for team types,
 * calculating metric values from Jira issues, and filtering out
 * zero-value metrics.
 */

import { 
  MetricDefinition, 
  MetricValue, 
  TeamType 
} from '@/types/kpi-dashboard';
import { METRIC_DEFINITIONS } from './metric-mapping.config';

class MetricMappingService {
  /**
   * Get relevant metrics for a specific team type
   * 
   * @param teamType - The type of team to get metrics for
   * @returns Array of metric definitions applicable to the team type
   */
  getRelevantMetrics(teamType: TeamType): MetricDefinition[] {
    return METRIC_DEFINITIONS[teamType] || METRIC_DEFINITIONS.generic;
  }

  /**
   * Calculate metric values from Jira issues for a specific team type
   * 
   * @param issues - Array of Jira issues to calculate metrics from
   * @param teamType - The type of team to calculate metrics for
   * @param excludeZeroValues - Whether to exclude metrics with zero values (default: true)
   * @returns Array of calculated metric values
   */
  calculateMetrics(
    issues: any[], 
    teamType: TeamType,
    excludeZeroValues: boolean = true
  ): MetricValue[] {
    const relevantMetrics = this.getRelevantMetrics(teamType);
    const calculatedMetrics: MetricValue[] = [];

    for (const metric of relevantMetrics) {
      const value = metric.calculation(issues);

      // Filter out zero values if requested
      if (excludeZeroValues && value === 0) {
        continue;
      }

      calculatedMetrics.push({
        key: metric.key,
        label: metric.label,
        value,
        description: metric.description,
      });
    }

    return calculatedMetrics;
  }

  /**
   * Check if a metric is relevant for a specific team type
   * 
   * @param metricKey - The key of the metric to check
   * @param teamType - The type of team to check against
   * @returns True if the metric is relevant for the team type
   */
  isMetricRelevant(metricKey: string, teamType: TeamType): boolean {
    const metrics = this.getRelevantMetrics(teamType);
    return metrics.some((m) => m.key === metricKey);
  }

  /**
   * Get all available metric keys for a team type
   * 
   * @param teamType - The type of team to get metric keys for
   * @returns Array of metric keys
   */
  getMetricKeys(teamType: TeamType): string[] {
    return this.getRelevantMetrics(teamType).map((m) => m.key);
  }

  /**
   * Get a specific metric definition by key and team type
   * 
   * @param metricKey - The key of the metric to retrieve
   * @param teamType - The type of team
   * @returns The metric definition or undefined if not found
   */
  getMetricDefinition(metricKey: string, teamType: TeamType): MetricDefinition | undefined {
    const metrics = this.getRelevantMetrics(teamType);
    return metrics.find((m) => m.key === metricKey);
  }

  /**
   * Calculate a single metric value
   * 
   * @param metricKey - The key of the metric to calculate
   * @param issues - Array of Jira issues
   * @param teamType - The type of team
   * @returns The calculated metric value or null if metric not found
   */
  calculateSingleMetric(
    metricKey: string,
    issues: any[],
    teamType: TeamType
  ): number | null {
    const metric = this.getMetricDefinition(metricKey, teamType);
    
    if (!metric) {
      return null;
    }

    return metric.calculation(issues);
  }

  /**
   * Get all supported team types
   * 
   * @returns Array of all team types
   */
  getSupportedTeamTypes(): TeamType[] {
    return Object.keys(METRIC_DEFINITIONS) as TeamType[];
  }
}

// Export singleton instance
export const metricMappingService = new MetricMappingService();
