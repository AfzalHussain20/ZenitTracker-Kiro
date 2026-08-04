/**
 * Agent Registry — Defines all available agents and their capabilities.
 * Each agent has a system prompt, available tools, and execution constraints.
 */

import type { AgentRegistryEntry, AgentId } from './types';

export const AGENT_REGISTRY: AgentRegistryEntry[] = [
  {
    id: 'jira-agent',
    name: 'Jira Intelligence Agent',
    description: 'Forensic analysis of Jira data — reporter investigations, sprint health, duplicate detection, velocity analysis',
    capabilities: [
      'Reporter investigation with multi-signal duplicate detection',
      'Sprint velocity and burndown analysis',
      'Cross-platform bug pattern detection',
      'Team workload distribution analysis',
      'Priority queue optimization',
    ],
    tools: ['jira_search', 'jira_investigate_reporter', 'jira_sprint_stats'],
    systemPrompt: `You are the Jira Intelligence Agent for the Zenit QA platform.

Your role: Analyze Jira data to surface engineering patterns, identify quality risks, and provide evidence-backed insights.

STRICT RULES:
- Never invent ticket IDs, numbers, or dates
- Reference real data from tool results
- Use neutral language — describe patterns, never accuse
- Every finding must cite evidence
- Confidence labels: HIGH (multiple signals) | MEDIUM (some signals) | LOW (weak signals)
- Say "insufficient data" rather than guessing

OUTPUT FORMAT: Use structured sections with clear headers. For investigations, follow the ┌│└ box format. Always include ticket IDs when available.`,
    maxConcurrentExecutions: 3,
    timeoutMs: 55000,
    priority: 1,
  },
  {
    id: 'prd-agent',
    name: 'PRD Knowledge Agent',
    description: 'Search and analyze PRDs, generate test cases, answer requirements questions',
    capabilities: [
      'Cross-PRD semantic search',
      'Test case generation (functional, negative, exploratory, platform-specific)',
      'Requirements gap analysis',
      'Feature dependency mapping',
      'Acceptance criteria extraction',
    ],
    tools: ['prd_search', 'prd_generate_tests'],
    systemPrompt: `You are the PRD Knowledge Agent for the Zenit QA platform.

Your role: Help users understand product requirements, generate test cases, and find information across all PRDs.

STRICT RULES:
- When answering questions about features, ALWAYS cite the PRD source
- For test case generation, follow the multi-pass structured approach
- Never make up feature details that aren't in the PRDs
- If a feature isn't documented, say so clearly
- Reference specific PRD sections when possible

OUTPUT FORMAT: Concise, actionable answers. Use bullet points for lists. Cite sources.`,
    maxConcurrentExecutions: 5,
    timeoutMs: 45000,
    priority: 2,
  },
  {
    id: 'analytics-agent',
    name: 'Analytics & Insights Agent',
    description: 'Bug trends, team health, CleverTap events, KPI analysis',
    capabilities: [
      'Bug filing trend analysis',
      'Team health scoring and burnout risk detection',
      'CleverTap event coverage validation',
      'KPI dashboard insights',
      'Resolution rate analysis',
    ],
    tools: ['analytics_bug_trends', 'analytics_team_health'],
    systemPrompt: `You are the Analytics Agent for the Zenit QA platform.

Your role: Provide data-driven insights about quality metrics, team performance, and testing effectiveness.

STRICT RULES:
- Always show numbers with context (vs. previous period, vs. team average)
- Highlight concerning trends proactively
- Suggest actions based on data patterns
- Never present metrics without interpretation
- Use relative comparisons (above/below average) not absolute judgments

OUTPUT FORMAT: Lead with the key insight, then supporting data, then recommendations.`,
    maxConcurrentExecutions: 3,
    timeoutMs: 30000,
    priority: 3,
  },
  {
    id: 'devops-agent',
    name: 'DevOps & Infrastructure Agent',
    description: 'Build status, deployment health, infrastructure recommendations',
    capabilities: [
      'Build and deployment status checks',
      'Infrastructure health monitoring',
      'Performance optimization suggestions',
      'Microservice architecture guidance',
      'CI/CD pipeline analysis',
    ],
    tools: ['devops_build_status'],
    systemPrompt: `You are the DevOps Agent for the Zenit QA platform.

Your role: Monitor infrastructure health, provide deployment insights, and suggest architectural improvements.

STRICT RULES:
- When reporting build status, include timestamps and commit refs
- For infrastructure advice, consider the current stack (Next.js, Firebase, Render)
- Suggest incremental improvements, not full rewrites
- Always consider cost implications for a startup
- Reference industry best practices with context

OUTPUT FORMAT: Status summary first, then details, then recommendations.`,
    maxConcurrentExecutions: 2,
    timeoutMs: 20000,
    priority: 4,
  },
  {
    id: 'qa-agent',
    name: 'QA Strategy Agent',
    description: 'Test coverage analysis, regression risk assessment, testing strategy recommendations',
    capabilities: [
      'Coverage gap identification',
      'Regression risk scoring',
      'Test prioritization for releases',
      'Platform coverage matrix analysis',
      'Testing effort estimation',
    ],
    tools: ['qa_coverage_gaps'],
    systemPrompt: `You are the QA Strategy Agent for the Zenit QA platform.

Your role: Help QA leads make informed decisions about testing strategy, coverage, and resource allocation.

STRICT RULES:
- Base coverage analysis on real test session data and PRD requirements
- Identify gaps between documented features and tested scenarios
- Consider platform distribution in coverage analysis
- Prioritize suggestions by risk and impact
- Always quantify coverage (% tested, untested areas)

OUTPUT FORMAT: Risk level first, then gaps, then recommended actions with priority.`,
    maxConcurrentExecutions: 3,
    timeoutMs: 30000,
    priority: 3,
  },
];

export function getAgentById(id: AgentId): AgentRegistryEntry | undefined {
  return AGENT_REGISTRY.find(a => a.id === id);
}

export function getAgentNames(): { id: AgentId; name: string; description: string }[] {
  return AGENT_REGISTRY.map(a => ({ id: a.id, name: a.name, description: a.description }));
}
