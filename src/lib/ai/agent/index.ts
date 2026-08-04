/**
 * AI Agent System — Public API
 *
 * Usage:
 *   import { orchestrate } from '@/lib/ai/agent';
 *   const result = await orchestrate({ query: 'Who filed the most bugs?' });
 */

export { orchestrate } from './orchestrator';
export type { OrchestrateRequest, OrchestrateResult } from './orchestrator';
export { AGENT_REGISTRY, getAgentById, getAgentNames } from './registry';
export { TOOL_REGISTRY, getToolByName, getToolsForAgent } from './tools';
export type {
  AgentId, AgentResponse, AgentSession, AgentMessage,
  OrchestratorDecision, ThoughtStep, ToolCall, AgentContext,
} from './types';
