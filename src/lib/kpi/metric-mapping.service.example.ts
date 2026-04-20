/**
 * Example usage of MetricMappingService
 * 
 * This file demonstrates how to use the MetricMappingService
 * in your application code.
 */

import { metricMappingService } from './metric-mapping.service';
import { TeamType } from '@/types/kpi-dashboard';

// Example 1: Get relevant metrics for a team type
export function exampleGetRelevantMetrics() {
  const devMetrics = metricMappingService.getRelevantMetrics('dev');
  console.log('Dev team metrics:', devMetrics.map(m => m.label));
  
  const qaMetrics = metricMappingService.getRelevantMetrics('qa');
  console.log('QA team metrics:', qaMetrics.map(m => m.label));
}

// Example 2: Calculate metrics from Jira issues
export function exampleCalculateMetrics() {
  const jiraIssues = [
    { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
    { issueType: 'Story', statusCategory: 'Done', storyPoints: 3 },
    { issueType: 'Task', statusCategory: 'Done' },
    { issueType: 'Bug', statusCategory: 'Done' },
  ];
  
  // Calculate metrics for dev team (excludes zero values by default)
  const devMetrics = metricMappingService.calculateMetrics(jiraIssues, 'dev');
  console.log('Dev team calculated metrics:', devMetrics);
  
  // Calculate metrics including zero values
  const allMetrics = metricMappingService.calculateMetrics(jiraIssues, 'dev', false);
  console.log('All dev metrics (including zeros):', allMetrics);
}

// Example 3: Check if a metric is relevant for a team
export function exampleIsMetricRelevant() {
  const isRelevant = metricMappingService.isMetricRelevant('stories_completed', 'dev');
  console.log('Is stories_completed relevant for dev team?', isRelevant); // true
  
  const isNotRelevant = metricMappingService.isMetricRelevant('bugs_found', 'dev');
  console.log('Is bugs_found relevant for dev team?', isNotRelevant); // false
}

// Example 4: Get metric keys for a team type
export function exampleGetMetricKeys() {
  const devKeys = metricMappingService.getMetricKeys('dev');
  console.log('Dev team metric keys:', devKeys);
}

// Example 5: Calculate a single metric
export function exampleCalculateSingleMetric() {
  const jiraIssues = [
    { issueType: 'Story', statusCategory: 'Done', storyPoints: 5 },
    { issueType: 'Story', statusCategory: 'Done', storyPoints: 3 },
  ];
  
  const storyPoints = metricMappingService.calculateSingleMetric(
    'story_points',
    jiraIssues,
    'dev'
  );
  console.log('Total story points:', storyPoints); // 8
}

// Example 6: Use in a React component or API route
export async function exampleInApiRoute(teamId: string, teamType: TeamType) {
  // Fetch Jira issues for the team
  const response = await fetch('/api/jira/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jql: `team = "${teamId}"`,
    }),
  });
  
  const { issues } = await response.json();
  
  // Calculate relevant metrics (excluding zero values)
  const metrics = metricMappingService.calculateMetrics(issues, teamType);
  
  return {
    teamId,
    teamType,
    metrics,
  };
}

// Example 7: Filter metrics for display
export function exampleFilterMetricsForDisplay(
  issues: any[],
  teamType: TeamType
) {
  // Get only non-zero metrics
  const nonZeroMetrics = metricMappingService.calculateMetrics(
    issues,
    teamType,
    true // excludeZeroValues
  );
  
  // Sort by value (highest first)
  const sortedMetrics = nonZeroMetrics.sort((a, b) => b.value - a.value);
  
  // Take top 5 metrics
  const topMetrics = sortedMetrics.slice(0, 5);
  
  return topMetrics;
}
