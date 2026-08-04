/**
 * Agent Orchestrator — Routes user queries to the right specialized agent.
 *
 * Pattern: ReAct (Reason + Act) with multi-agent delegation.
 * The orchestrator uses a lightweight intent classifier to decide which
 * agent handles the query. For complex queries that span multiple domains,
 * it coordinates multiple agents in sequence.
 *
 * Flow:
 *   1. Classify intent → select agent(s)
 *   2. Build execution plan
 *   3. Execute agent with tool access
 *   4. Aggregate results if multi-agent
 *   5. Return unified response
 */

import type {
  AgentId, AgentContext, AgentResponse, AgentMessage,
  OrchestratorDecision, ThoughtStep, ToolCall, AgentSession,
} from './types';
import { getAIProvider } from '@/lib/ai/providers';
import { withTokenTracking } from '@/lib/ai/token-tracker';
import { TOOL_REGISTRY, getToolsForAgent } from './tools';
import { executeAgentLoop } from './executor';
import { AGENT_REGISTRY } from './registry';

// ─── Intent Classification ───────────────────────────────────────────────────

interface IntentSignal {
  agent: AgentId;
  score: number;
  keywords: string[];
}

const INTENT_PATTERNS: { agent: AgentId; patterns: RegExp[]; weight: number }[] = [
  {
    agent: 'jira-agent',
    patterns: [
      /\bjira\b/i, /\bbug(s)?\b/i, /\bsprint\b/i, /\bticket\b/i, /\bSUN-\d+/i,
      /\binvestigat/i, /\bpostmortem\b/i, /\breporter\b/i, /\bassignee\b/i,
      /\bduplicate/i, /\bvelocity\b/i, /\bfiled\b/i, /\bresolution\b/i,
      /\bbacklog\b/i, /\bunresolved\b/i, /\bpriority\b/i,
    ],
    weight: 1.0,
  },
  {
    agent: 'prd-agent',
    patterns: [
      /\bprd\b/i, /\brequirement/i, /\bfeature\b/i, /\bconfluence\b/i,
      /\btest case/i, /\bgenerate test/i, /\bsubscription\b/i, /\bauth flow\b/i,
      /\bpayment\b/i, /\buser story\b/i, /\bacceptance criteria/i,
    ],
    weight: 0.9,
  },
  {
    agent: 'analytics-agent',
    patterns: [
      /\banalytics\b/i, /\btrend/i, /\bmetric/i, /\bkpi\b/i, /\bdashboard\b/i,
      /\bclevertap\b/i, /\bevent(s)?\b/i, /\bconversion\b/i, /\bfunnel\b/i,
      /\bretention\b/i, /\bchurn\b/i, /\bteam health\b/i,
    ],
    weight: 0.85,
  },
  {
    agent: 'devops-agent',
    patterns: [
      /\bbuild\b/i, /\bdeploy/i, /\bpipeline\b/i, /\bCI\/CD\b/i,
      /\brender\b/i, /\binfrastructure\b/i, /\bterraform\b/i,
      /\bdocker\b/i, /\bkubernetes\b/i, /\bmicroservice/i,
    ],
    weight: 0.8,
  },
  {
    agent: 'qa-agent',
    patterns: [
      /\bcoverage\b/i, /\btest session/i, /\bregression\b/i, /\bsmoke test/i,
      /\btest plan\b/i, /\btest run\b/i, /\buntested\b/i, /\bgap(s)?\b/i,
      /\bsanity\b/i, /\bexplorator/i,
    ],
    weight: 0.85,
  },
];

/**
 * Classifies user intent using keyword matching + scoring.
 * Returns the best-matched agent and alternatives.
 */
function classifyIntent(query: string): OrchestratorDecision {
  const scores: Map<AgentId, number> = new Map();
  const matchedKeywords: Map<AgentId, string[]> = new Map();

  for (const { agent, patterns, weight } of INTENT_PATTERNS) {
    let score = 0;
    const matched: string[] = [];
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        score += weight;
        matched.push(pattern.source);
      }
    }
    if (score > 0) {
      scores.set(agent, (scores.get(agent) || 0) + score);
      matchedKeywords.set(agent, matched);
    }
  }

  // Sort by score descending
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    // Default to prd-agent for general queries
    return {
      selectedAgent: 'prd-agent',
      reasoning: 'No strong intent signal detected — defaulting to PRD knowledge base',
      confidence: 0.3,
      alternativeAgents: [],
      requiresMultiAgent: false,
    };
  }

  const [topAgent, topScore] = sorted[0];
  const maxPossible = INTENT_PATTERNS.find(p => p.agent === topAgent)!.patterns.length;
  const confidence = Math.min(1, topScore / Math.max(maxPossible * 0.3, 1));

  const alternatives = sorted.slice(1, 3).map(([agent, score]) => ({
    agent,
    reason: `Matched ${matchedKeywords.get(agent)?.length || 0} keywords (score: ${score.toFixed(1)})`,
  }));

  // Multi-agent if top two scores are very close
  const requiresMultiAgent = sorted.length >= 2 && sorted[1][1] >= topScore * 0.8;

  return {
    selectedAgent: topAgent,
    reasoning: `Matched ${matchedKeywords.get(topAgent)?.length || 0} intent signals for ${topAgent} (score: ${topScore.toFixed(1)})`,
    confidence,
    alternativeAgents: alternatives,
    requiresMultiAgent,
  };
}

// ─── Session Management ──────────────────────────────────────────────────────

const sessions = new Map<string, AgentSession>();

function getOrCreateSession(sessionId: string, userId?: string): AgentSession {
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      id: sessionId,
      userId,
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      status: 'idle',
      messages: [],
      totalTokensUsed: 0,
      totalToolCalls: 0,
      metadata: {},
    };
    sessions.set(sessionId, session);
  }
  return session;
}

// ─── Main Orchestrator Entry Point ───────────────────────────────────────────

export interface OrchestrateRequest {
  query: string;
  sessionId?: string;
  userId?: string;
  history?: AgentMessage[];
  forceAgent?: AgentId;
  maxIterations?: number;
  timeoutMs?: number;
}

export interface OrchestrateResult {
  response: AgentResponse;
  decision: OrchestratorDecision;
  session: AgentSession;
}

/**
 * Main entry point for the AI Agent system.
 * Routes the query, executes the agent, returns unified response.
 */
export async function orchestrate(request: OrchestrateRequest): Promise<OrchestrateResult> {
  const {
    query,
    sessionId = crypto.randomUUID(),
    userId,
    history = [],
    forceAgent,
    maxIterations = 5,
    timeoutMs = 55000, // Under Render's 60s limit
  } = request;

  const session = getOrCreateSession(sessionId, userId);
  session.status = 'thinking';
  session.lastActivity = new Date().toISOString();

  // Add user message to session
  const userMessage: AgentMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: query,
    timestamp: new Date().toISOString(),
  };
  session.messages.push(userMessage);

  // Classify intent (or use forced agent)
  const decision: OrchestratorDecision = forceAgent
    ? { selectedAgent: forceAgent, reasoning: 'Agent forced by caller', confidence: 1, alternativeAgents: [], requiresMultiAgent: false }
    : classifyIntent(query);

  session.activeAgent = decision.selectedAgent;

  // Build context for the selected agent
  const agentEntry = AGENT_REGISTRY.find(a => a.id === decision.selectedAgent);
  if (!agentEntry) {
    session.status = 'error';
    return {
      response: {
        id: crypto.randomUUID(),
        agentId: decision.selectedAgent,
        status: 'error',
        answer: `Agent "${decision.selectedAgent}" not found in registry.`,
        toolCalls: [],
        thoughtProcess: [],
        confidence: 0,
        durationMs: 0,
        tokensUsed: { prompt: 0, completion: 0, total: 0 },
      },
      decision,
      session,
    };
  }

  const context: AgentContext = {
    sessionId,
    userId,
    query,
    history: [...history, ...session.messages.slice(-10)],
    availableTools: getToolsForAgent(decision.selectedAgent),
    maxIterations,
    timeoutMs,
    featureFlags: {},
    metadata: { orchestratorDecision: decision },
  };

  // Execute agent with timeout
  const startTime = Date.now();
  let response: AgentResponse;

  try {
    response = await Promise.race([
      executeAgentLoop(decision.selectedAgent, context),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Agent execution timeout')), timeoutMs)
      ),
    ]);
  } catch (err: any) {
    response = {
      id: crypto.randomUUID(),
      agentId: decision.selectedAgent,
      status: err.message?.includes('timeout') ? 'timeout' : 'error',
      answer: err.message?.includes('timeout')
        ? 'The query took too long to process. Try a more specific question.'
        : `Agent error: ${err.message}`,
      toolCalls: [],
      thoughtProcess: [],
      confidence: 0,
      durationMs: Date.now() - startTime,
      tokensUsed: { prompt: 0, completion: 0, total: 0 },
      warnings: [err.message],
    };
  }

  // Update session
  session.status = 'complete';
  session.totalTokensUsed += response.tokensUsed.total;
  session.totalToolCalls += response.toolCalls.length;

  const agentMessage: AgentMessage = {
    id: response.id,
    role: 'agent',
    agentId: decision.selectedAgent,
    content: response.answer,
    timestamp: new Date().toISOString(),
    toolCalls: response.toolCalls,
    thoughtProcess: response.thoughtProcess,
  };
  session.messages.push(agentMessage);

  return { response, decision, session };
}

export { classifyIntent, getOrCreateSession };
