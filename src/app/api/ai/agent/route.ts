/**
 * POST /api/ai/agent
 *
 * Unified AI Agent endpoint — routes queries to the appropriate specialized agent.
 * Supports multi-turn conversations, tool execution, and thought-process transparency.
 *
 * Request body:
 *   { query: string, sessionId?: string, forceAgent?: AgentId, history?: [] }
 *
 * Response:
 *   { answer, agentId, confidence, toolCalls, thoughtProcess, suggestions, ... }
 */

import { NextRequest, NextResponse } from 'next/server';
import { orchestrate } from '@/lib/ai/agent';
import { isAIEnabled } from '@/lib/ai/feature-flags';
import { getAIProviderFor } from '@/lib/ai/providers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, sessionId, userId, forceAgent, history, maxIterations } = body;

    if (!query?.trim()) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    // Check if AI is enabled
    if (!await isAIEnabled('jira-ai')) {
      return NextResponse.json({
        error: 'AI Agent is currently disabled. Enable it in AI Settings.',
      }, { status: 403 });
    }

    // Ensure NVIDIA is selected for agent route when configured
    const _provider = getAIProviderFor('agent');

    const result = await orchestrate({
      query: query.trim(),
      sessionId,
      userId,
      forceAgent,
      history,
      maxIterations: maxIterations || 5,
      timeoutMs: 55000,
    });

    return NextResponse.json({
      answer: result.response.answer,
      agentId: result.response.agentId,
      agentName: result.decision.selectedAgent,
      confidence: result.response.confidence,
      status: result.response.status,
      toolCalls: result.response.toolCalls,
      thoughtProcess: result.response.thoughtProcess,
      suggestions: result.response.suggestions,
      warnings: result.response.warnings,
      durationMs: result.response.durationMs,
      tokensUsed: result.response.tokensUsed,
      sessionId: result.session.id,
      routing: {
        selectedAgent: result.decision.selectedAgent,
        reasoning: result.decision.reasoning,
        confidence: result.decision.confidence,
        alternatives: result.decision.alternativeAgents,
      },
    });
  } catch (err: any) {
    console.error('[agent]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
