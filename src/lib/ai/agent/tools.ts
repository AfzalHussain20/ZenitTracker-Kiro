/**
 * Tool Registry — Defines all tools available to AI agents.
 * Each tool maps to a concrete function that fetches data or performs actions.
 */

import type { ToolDefinition, ToolResult, ToolCall } from './types';

// ─── Tool Registry ───────────────────────────────────────────────────────────

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    name: 'jira_search',
    description: 'Search Jira issues using JQL or natural language query',
    agent: 'jira-agent',
    parameters: [
      { name: 'jql', type: 'string', required: false, description: 'Raw JQL query' },
      { name: 'query', type: 'string', required: false, description: 'Natural language query to convert to JQL' },
      { name: 'maxResults', type: 'number', required: false, description: 'Max results (default 50)', default: 50 },
    ],
    returnType: 'JiraIssue[]',
    maxDurationMs: 30000,
    retryable: true,
    requiresAuth: false,
  },
  {
    name: 'jira_investigate_reporter',
    description: 'Run full forensic investigation on a Jira reporter',
    agent: 'jira-agent',
    parameters: [
      { name: 'reporterName', type: 'string', required: true, description: 'Display name of the reporter' },
    ],
    returnType: 'InvestigationReportV2',
    maxDurationMs: 60000,
    retryable: true,
    requiresAuth: false,
  },
  {
    name: 'jira_sprint_stats',
    description: 'Get current sprint statistics — velocity, burndown, bug counts',
    agent: 'jira-agent',
    parameters: [
      { name: 'sprintType', type: 'string', required: false, description: 'open or closed', enum: ['open', 'closed'] },
    ],
    returnType: 'SprintStats',
    maxDurationMs: 20000,
    retryable: true,
    requiresAuth: false,
  },
  {
    name: 'prd_search',
    description: 'Search across all PRDs for specific information',
    agent: 'prd-agent',
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Search query across PRD content' },
      { name: 'limit', type: 'number', required: false, description: 'Max PRDs to search', default: 10 },
    ],
    returnType: 'PRDSearchResult[]',
    maxDurationMs: 15000,
    retryable: true,
    requiresAuth: false,
  },
  {
    name: 'prd_generate_tests',
    description: 'Generate test cases from a PRD page',
    agent: 'prd-agent',
    parameters: [
      { name: 'pageId', type: 'string', required: true, description: 'Confluence page ID' },
      { name: 'platform', type: 'string', required: false, description: 'Platform focus', enum: ['web', 'tv', 'mobile', 'all'] },
    ],
    returnType: 'GeneratedTestCase[]',
    maxDurationMs: 45000,
    retryable: true,
    requiresAuth: false,
  },
  {
    name: 'analytics_bug_trends',
    description: 'Get bug filing trends, resolution rates, and category breakdown',
    agent: 'analytics-agent',
    parameters: [
      { name: 'period', type: 'string', required: false, description: 'Time period', enum: ['7d', '30d', '90d', 'sprint'] },
      { name: 'groupBy', type: 'string', required: false, description: 'Group dimension', enum: ['reporter', 'platform', 'priority', 'component'] },
    ],
    returnType: 'BugTrendData',
    maxDurationMs: 20000,
    retryable: true,
    requiresAuth: false,
  },
  {
    name: 'analytics_team_health',
    description: 'Get team health metrics — workload distribution, velocity, burnout risk',
    agent: 'analytics-agent',
    parameters: [
      { name: 'teamId', type: 'string', required: false, description: 'Team ID (or all teams if omitted)' },
    ],
    returnType: 'TeamHealthData',
    maxDurationMs: 15000,
    retryable: true,
    requiresAuth: false,
  },
  {
    name: 'devops_build_status',
    description: 'Get current build and deployment status from CI/CD',
    agent: 'devops-agent',
    parameters: [
      { name: 'environment', type: 'string', required: false, description: 'Target environment', enum: ['production', 'staging', 'development'] },
    ],
    returnType: 'BuildStatus',
    maxDurationMs: 10000,
    retryable: true,
    requiresAuth: false,
  },
  {
    name: 'qa_coverage_gaps',
    description: 'Identify untested or under-tested areas based on test sessions and PRD coverage',
    agent: 'qa-agent',
    parameters: [
      { name: 'module', type: 'string', required: false, description: 'Specific module to check' },
      { name: 'platform', type: 'string', required: false, description: 'Platform filter' },
    ],
    returnType: 'CoverageGap[]',
    maxDurationMs: 20000,
    retryable: true,
    requiresAuth: false,
  },
];

// ─── Tool Executor ───────────────────────────────────────────────────────────

export function getToolByName(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY.find(t => t.name === name);
}

export function getToolsForAgent(agentId: string): ToolDefinition[] {
  return TOOL_REGISTRY.filter(t => t.agent === agentId);
}
