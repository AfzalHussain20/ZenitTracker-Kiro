/**
 * Zenit AI Agent System — Type Definitions
 *
 * Implements a multi-agent orchestration pattern inspired by:
 * - ReAct (Reason + Act) loop
 * - Tool-augmented LLM agents
 * - Microservice-compatible message passing
 *
 * Architecture:
 *   AgentOrchestrator → selects Agent → Agent executes Tools → returns Result
 *   Each agent has a specific domain (Jira, PRD, Analytics, DevOps)
 *   Tools are composable, retriable, and audited
 */

// ─── Agent Identity ──────────────────────────────────────────────────────────

export type AgentId =
  | 'orchestrator'     // Routes queries to the right agent
  | 'jira-agent'       // Jira investigation, sprint analysis, reporter forensics
  | 'prd-agent'        // PRD search, test case generation, requirements analysis
  | 'analytics-agent'  // CleverTap events, bug analytics, KPI insights
  | 'devops-agent'     // Build health, deployment status, infrastructure
  | 'qa-agent';        // Test session analysis, coverage gaps, regression detection

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'error' | 'complete';

// ─── Tool System ─────────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  agent: AgentId;
  parameters: ToolParameter[];
  returnType: string;
  maxDurationMs: number;
  retryable: boolean;
  requiresAuth: boolean;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  enum?: string[];
  default?: unknown;
}

export interface ToolCall {
  id: string;
  toolName: string;
  parameters: Record<string, unknown>;
  calledAt: string;
  completedAt?: string;
  durationMs?: number;
  result?: unknown;
  error?: string;
  retryCount: number;
}

export interface ToolResult {
  success: boolean;
  data: unknown;
  error?: string;
  metadata?: {
    source: string;
    cached: boolean;
    durationMs: number;
    tokensUsed?: number;
  };
}

// ─── Agent Thought Process (ReAct Loop) ─────────────────────────────────────

export interface ThoughtStep {
  id: string;
  type: 'OBSERVE' | 'THINK' | 'ACT' | 'REFLECT';
  content: string;
  timestamp: string;
  toolCall?: ToolCall;
  confidence: number; // 0-1
}

export interface AgentPlan {
  goal: string;
  steps: PlanStep[];
  estimatedDurationMs: number;
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  requiresMultiAgent: boolean;
  delegations?: { agentId: AgentId; subGoal: string }[];
}

export interface PlanStep {
  id: string;
  description: string;
  toolName?: string;
  dependsOn?: string[]; // step IDs that must complete first
  status: 'pending' | 'running' | 'complete' | 'failed' | 'skipped';
  result?: unknown;
}

// ─── Agent Execution Context ─────────────────────────────────────────────────

export interface AgentContext {
  sessionId: string;
  userId?: string;
  query: string;
  history: AgentMessage[];
  availableTools: ToolDefinition[];
  maxIterations: number;
  timeoutMs: number;
  featureFlags: Record<string, boolean>;
  metadata: Record<string, unknown>;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent' | 'system' | 'tool';
  agentId?: AgentId;
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  thoughtProcess?: ThoughtStep[];
  metadata?: Record<string, unknown>;
}

// ─── Agent Response ──────────────────────────────────────────────────────────

export interface AgentResponse {
  id: string;
  agentId: AgentId;
  status: 'success' | 'partial' | 'error' | 'timeout';
  answer: string;
  structuredData?: Record<string, unknown>;
  toolCalls: ToolCall[];
  thoughtProcess: ThoughtStep[];
  plan?: AgentPlan;
  confidence: number;
  durationMs: number;
  tokensUsed: { prompt: number; completion: number; total: number };
  suggestions?: string[]; // Follow-up suggestions
  sources?: { type: string; id: string; title: string; url?: string }[];
  warnings?: string[];
}

// ─── Multi-Agent Orchestration ───────────────────────────────────────────────

export interface OrchestratorDecision {
  selectedAgent: AgentId;
  reasoning: string;
  confidence: number;
  alternativeAgents: { agent: AgentId; reason: string }[];
  requiresMultiAgent: boolean;
  plan?: AgentPlan;
}

export interface AgentSession {
  id: string;
  userId?: string;
  startedAt: string;
  lastActivity: string;
  status: AgentStatus;
  messages: AgentMessage[];
  activeAgent?: AgentId;
  totalTokensUsed: number;
  totalToolCalls: number;
  metadata: Record<string, unknown>;
}

// ─── Agent Registry ──────────────────────────────────────────────────────────

export interface AgentRegistryEntry {
  id: AgentId;
  name: string;
  description: string;
  capabilities: string[];
  tools: string[]; // tool names this agent can use
  systemPrompt: string;
  maxConcurrentExecutions: number;
  timeoutMs: number;
  priority: number; // lower = higher priority for routing
}

// ─── Error Handling ──────────────────────────────────────────────────────────

export type AgentErrorCode =
  | 'TOOL_EXECUTION_FAILED'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'INVALID_QUERY'
  | 'NO_AGENT_MATCHED'
  | 'MAX_ITERATIONS_REACHED'
  | 'PROVIDER_ERROR'
  | 'FIRESTORE_ERROR'
  | 'JIRA_API_ERROR'
  | 'CONFLUENCE_API_ERROR';

export interface AgentError {
  code: AgentErrorCode;
  message: string;
  agentId?: AgentId;
  toolName?: string;
  retryable: boolean;
  suggestion?: string;
}

// ─── Observability ───────────────────────────────────────────────────────────

export interface AgentTrace {
  traceId: string;
  sessionId: string;
  agentId: AgentId;
  query: string;
  startedAt: string;
  completedAt?: string;
  status: AgentStatus;
  steps: ThoughtStep[];
  toolCalls: ToolCall[];
  tokensUsed: number;
  error?: AgentError;
}
