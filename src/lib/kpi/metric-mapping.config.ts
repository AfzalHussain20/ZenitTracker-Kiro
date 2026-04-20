/**
 * Metric Mapping Configuration
 * 
 * Defines which metrics are relevant for each team type and how to calculate them.
 */

import { MetricDefinition, TeamType } from '@/types/kpi-dashboard';

/**
 * Metric definitions for all team types
 */
export const METRIC_DEFINITIONS: Record<TeamType, MetricDefinition[]> = {
  dev: [
    {
      key: 'stories_completed',
      label: 'Stories Completed',
      description: 'Number of Story-type issues completed',
      applicableTeamTypes: ['dev'],
      calculation: (issues) =>
        issues.filter(
          (i) => i.issueType === 'Story' && i.statusCategory === 'Done'
        ).length,
    },
    {
      key: 'tasks_done',
      label: 'Tasks Done',
      description: 'Number of Task-type issues completed',
      applicableTeamTypes: ['dev'],
      calculation: (issues) =>
        issues.filter(
          (i) => i.issueType === 'Task' && i.statusCategory === 'Done'
        ).length,
    },
    {
      key: 'story_points',
      label: 'Story Points Delivered',
      description: 'Total story points completed',
      applicableTeamTypes: ['dev'],
      calculation: (issues) =>
        issues
          .filter((i) => i.issueType === 'Story' && i.statusCategory === 'Done')
          .reduce((sum, i) => sum + (i.storyPoints || 0), 0),
    },
    {
      key: 'commits',
      label: 'Commits',
      description: 'Number of code commits (placeholder)',
      applicableTeamTypes: ['dev'],
      calculation: () => 0, // Placeholder - requires Git integration
    },
    {
      key: 'pull_requests',
      label: 'Pull Requests',
      description: 'Number of pull requests (placeholder)',
      applicableTeamTypes: ['dev'],
      calculation: () => 0, // Placeholder - requires Git integration
    },
    {
      key: 'code_reviews',
      label: 'Code Reviews',
      description: 'Number of code reviews completed (placeholder)',
      applicableTeamTypes: ['dev'],
      calculation: () => 0, // Placeholder - requires Git integration
    },
  ],

  qa: [
    {
      key: 'bugs_found',
      label: 'Bugs Found',
      description: 'Number of Bug-type issues reported',
      applicableTeamTypes: ['qa'],
      calculation: (issues) =>
        issues.filter((i) => i.issueType === 'Bug').length,
    },
    {
      key: 'bugs_resolved',
      label: 'Bugs Resolved',
      description: 'Number of Bug-type issues resolved',
      applicableTeamTypes: ['qa'],
      calculation: (issues) =>
        issues.filter(
          (i) => i.issueType === 'Bug' && i.statusCategory === 'Done'
        ).length,
    },
    {
      key: 'test_cases_executed',
      label: 'Test Cases Executed',
      description: 'Number of test execution tasks completed',
      applicableTeamTypes: ['qa'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('test') || false)
        ).length,
    },
    {
      key: 'defects_logged',
      label: 'Defects Logged',
      description: 'Total defects logged by QA team',
      applicableTeamTypes: ['qa'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Bug' &&
            (i.priority === 'High' || i.priority === 'Critical')
        ).length,
    },
    {
      key: 'test_coverage',
      label: 'Test Coverage',
      description: 'Test coverage percentage (placeholder)',
      applicableTeamTypes: ['qa'],
      calculation: () => 0, // Placeholder - requires test framework integration
    },
    {
      key: 'regression_tests',
      label: 'Regression Tests',
      description: 'Number of regression test cycles completed',
      applicableTeamTypes: ['qa'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('regression') || false)
        ).length,
    },
  ],

  ui_ux: [
    {
      key: 'design_tasks',
      label: 'Design Tasks',
      description: 'Number of design tasks completed',
      applicableTeamTypes: ['ui_ux'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('design') ||
              i.labels?.some((l) => l.toLowerCase().includes('design')) ||
              false)
        ).length,
    },
    {
      key: 'mockups_created',
      label: 'Mockups Created',
      description: 'Number of mockup creation tasks completed',
      applicableTeamTypes: ['ui_ux'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('mockup') || false)
        ).length,
    },
    {
      key: 'prototypes_delivered',
      label: 'Prototypes Delivered',
      description: 'Number of prototype delivery tasks completed',
      applicableTeamTypes: ['ui_ux'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('prototype') || false)
        ).length,
    },
    {
      key: 'design_reviews',
      label: 'Design Reviews',
      description: 'Number of design review sessions completed',
      applicableTeamTypes: ['ui_ux'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('review') || false)
        ).length,
    },
    {
      key: 'user_research',
      label: 'User Research Sessions',
      description: 'Number of user research sessions conducted',
      applicableTeamTypes: ['ui_ux'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('research') ||
              i.summary?.toLowerCase().includes('user study') ||
              false)
        ).length,
    },
  ],

  database: [
    {
      key: 'schema_changes',
      label: 'Schema Changes',
      description: 'Number of database schema change tasks completed',
      applicableTeamTypes: ['database'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('schema') ||
              i.summary?.toLowerCase().includes('migration') ||
              false)
        ).length,
    },
    {
      key: 'query_optimizations',
      label: 'Query Optimizations',
      description: 'Number of query optimization tasks completed',
      applicableTeamTypes: ['database'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('optimize') ||
              i.summary?.toLowerCase().includes('performance') ||
              false)
        ).length,
    },
    {
      key: 'migrations_completed',
      label: 'Migrations Completed',
      description: 'Number of database migration tasks completed',
      applicableTeamTypes: ['database'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('migration') || false)
        ).length,
    },
    {
      key: 'db_performance_improvements',
      label: 'DB Performance Improvements',
      description: 'Number of database performance improvement tasks',
      applicableTeamTypes: ['database'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('performance') ||
              i.summary?.toLowerCase().includes('index') ||
              false)
        ).length,
    },
  ],

  api: [
    {
      key: 'endpoints_created',
      label: 'Endpoints Created',
      description: 'Number of API endpoint creation tasks completed',
      applicableTeamTypes: ['api'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            (i.issueType === 'Story' || i.issueType === 'Task') &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('endpoint') ||
              i.summary?.toLowerCase().includes('api') ||
              false)
        ).length,
    },
    {
      key: 'api_documentation',
      label: 'API Documentation Updates',
      description: 'Number of API documentation tasks completed',
      applicableTeamTypes: ['api'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('documentation') ||
              i.summary?.toLowerCase().includes('swagger') ||
              false)
        ).length,
    },
    {
      key: 'integration_tests',
      label: 'Integration Tests',
      description: 'Number of API integration test tasks completed',
      applicableTeamTypes: ['api'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('integration test') || false)
        ).length,
    },
    {
      key: 'api_performance',
      label: 'API Performance Metrics',
      description: 'Number of API performance optimization tasks',
      applicableTeamTypes: ['api'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('performance') ||
              i.summary?.toLowerCase().includes('latency') ||
              false)
        ).length,
    },
  ],

  sms: [
    {
      key: 'message_templates',
      label: 'Message Templates Created',
      description: 'Number of SMS template creation tasks completed',
      applicableTeamTypes: ['sms'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('template') ||
              i.summary?.toLowerCase().includes('message') ||
              false)
        ).length,
    },
    {
      key: 'delivery_rates',
      label: 'Delivery Rate Improvements',
      description: 'Number of delivery rate optimization tasks',
      applicableTeamTypes: ['sms'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('delivery') || false)
        ).length,
    },
    {
      key: 'campaign_metrics',
      label: 'Campaign Metrics',
      description: 'Number of SMS campaign tasks completed',
      applicableTeamTypes: ['sms'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('campaign') || false)
        ).length,
    },
    {
      key: 'sms_integrations',
      label: 'SMS Integrations',
      description: 'Number of SMS integration tasks completed',
      applicableTeamTypes: ['sms'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('integration') || false)
        ).length,
    },
  ],

  analytics: [
    {
      key: 'reports_created',
      label: 'Reports Created',
      description: 'Number of report creation tasks completed',
      applicableTeamTypes: ['analytics'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('report') || false)
        ).length,
    },
    {
      key: 'dashboards_built',
      label: 'Dashboards Built',
      description: 'Number of dashboard creation tasks completed',
      applicableTeamTypes: ['analytics'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('dashboard') || false)
        ).length,
    },
    {
      key: 'data_analysis',
      label: 'Data Analysis Tasks',
      description: 'Number of data analysis tasks completed',
      applicableTeamTypes: ['analytics'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('analysis') ||
              i.summary?.toLowerCase().includes('analyze') ||
              false)
        ).length,
    },
    {
      key: 'insights_delivered',
      label: 'Insights Delivered',
      description: 'Number of insight delivery tasks completed',
      applicableTeamTypes: ['analytics'],
      calculation: (issues) =>
        issues.filter(
          (i) =>
            i.issueType === 'Task' &&
            i.statusCategory === 'Done' &&
            (i.summary?.toLowerCase().includes('insight') || false)
        ).length,
    },
  ],

  generic: [
    {
      key: 'total_issues',
      label: 'Total Issues',
      description: 'Total number of issues completed',
      applicableTeamTypes: ['generic'],
      calculation: (issues) =>
        issues.filter((i) => i.statusCategory === 'Done').length,
    },
    {
      key: 'stories',
      label: 'Stories',
      description: 'Number of stories completed',
      applicableTeamTypes: ['generic'],
      calculation: (issues) =>
        issues.filter(
          (i) => i.issueType === 'Story' && i.statusCategory === 'Done'
        ).length,
    },
    {
      key: 'tasks',
      label: 'Tasks',
      description: 'Number of tasks completed',
      applicableTeamTypes: ['generic'],
      calculation: (issues) =>
        issues.filter(
          (i) => i.issueType === 'Task' && i.statusCategory === 'Done'
        ).length,
    },
    {
      key: 'bugs',
      label: 'Bugs',
      description: 'Number of bugs resolved',
      applicableTeamTypes: ['generic'],
      calculation: (issues) =>
        issues.filter(
          (i) => i.issueType === 'Bug' && i.statusCategory === 'Done'
        ).length,
    },
  ],
};

/**
 * Get metric definitions for a specific team type
 */
export function getMetricsForTeamType(teamType: TeamType): MetricDefinition[] {
  return METRIC_DEFINITIONS[teamType] || METRIC_DEFINITIONS.generic;
}

/**
 * Check if a metric is relevant for a team type
 */
export function isMetricRelevant(metricKey: string, teamType: TeamType): boolean {
  const metrics = getMetricsForTeamType(teamType);
  return metrics.some((m) => m.key === metricKey);
}

/**
 * Get all available metric keys for a team type
 */
export function getMetricKeys(teamType: TeamType): string[] {
  return getMetricsForTeamType(teamType).map((m) => m.key);
}
