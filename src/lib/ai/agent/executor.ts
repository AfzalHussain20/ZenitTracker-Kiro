/**
 * Agent Executor — Implements the ReAct loop for a single agent.
 *
 * ReAct Pattern:
 *   1. OBSERVE: Read context and available information
 *   2. THINK: Decide what tool to use or how to respond
 *   3. ACT: Execute a tool call
 *   4. REFLECT: Evaluate the result, decide if more steps needed
 *   5. Repeat until goal achieved or max iterations reached
 *
 * This executor handles:
 * - Tool execution with retry and timeout
 * - Thought process logging for transparency
 * - Graceful degradation on errors
 * - Token budget management
 */

import type {
  AgentId, AgentContext, AgentResponse, ThoughtStep, ToolCall,
} from './types';
import { getAIProvider } from '@/lib/ai/providers';
import { withTokenTracking } from '@/lib/ai/token-tracker';
import { getAgentById } from './registry';
import { executeToolCall } from './tool-executor';

function genStepId(): string {
  return `step_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Builds the system prompt for the agent including tool descriptions.
 */
function buildAgentPrompt(agentId: AgentId, context: AgentContext): string {
  const agent = getAgentById(agentId);
  if (!agent) return '';

  const toolDescriptions = context.availableTools.map(t =>
    `- ${t.name}: ${t.description}\n  Parameters: ${t.parameters.map(p => `${p.name}${p.required ? '*' : ''} (${p.type})`).join(', ')}`
  ).join('\n');

  return `${agent.systemPrompt}

AVAILABLE TOOLS:
${toolDescriptions || '(No tools available — answer from knowledge only)'}

RESPONSE FORMAT:
If you need to use a tool to get data, respond with EXACTLY this JSON:
{"action": "tool", "tool": "tool_name", "params": {"key": "value"}}

If you already have enough data (from a previous tool result or general knowledge), respond with:
{"action": "answer", "content": "your answer here", "confidence": 0.9, "suggestions": ["follow-up 1"]}

CRITICAL RULES:
- Always respond with valid JSON only. No markdown fences. No explanation outside the JSON.
- When you receive tool results, ALWAYS produce an answer from them. Never say "I would need to call another tool" — just call it or answer with what you have.
- If a tool gives you data, analyze it and give a clear, direct answer. Do NOT describe what you plan to do — just do it.
- Prefer answering with available data over asking for clarification.
- Be concise and direct. Lead with the key finding.`;
}


/**
 * Parse the AI response to extract action, tool call, or answer.
 */
function parseAgentAction(response: string): {
  action: 'tool' | 'answer' | 'clarify' | 'error';
  tool?: string;
  params?: Record<string, unknown>;
  content?: string;
  confidence?: number;
  suggestions?: string[];
} {
  let cleaned = response.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.action === 'tool' && parsed.tool) {
      return { action: 'tool', tool: parsed.tool, params: parsed.params || {} };
    }
    if (parsed.action === 'answer') {
      return {
        action: 'answer',
        content: parsed.content || parsed.answer || '',
        confidence: parsed.confidence ?? 0.7,
        suggestions: parsed.suggestions || [],
      };
    }
    if (parsed.action === 'clarify') {
      return { action: 'clarify', content: parsed.content || '' };
    }
    // If it has content but no action, treat as answer
    if (parsed.content || parsed.answer) {
      return { action: 'answer', content: parsed.content || parsed.answer, confidence: 0.6 };
    }
    return { action: 'error', content: 'Could not parse agent response' };
  } catch {
    // If JSON parse fails, treat the raw text as a direct answer
    if (cleaned.length > 10) {
      return { action: 'answer', content: cleaned, confidence: 0.5 };
    }
    return { action: 'error', content: 'Agent returned unparseable response' };
  }
}

/**
 * Main ReAct execution loop for a single agent.
 */
export async function executeAgentLoop(
  agentId: AgentId,
  context: AgentContext,
  providerArg?: import('@/lib/ai/providers').AIProvider
): Promise<AgentResponse> {
  const startTime = Date.now();
  const thoughtProcess: ThoughtStep[] = [];
  const toolCalls: ToolCall[] = [];
  let totalTokens = { prompt: 0, completion: 0, total: 0 };

  const systemPrompt = buildAgentPrompt(agentId, context);
  const provider = providerArg ?? getAIProvider();

  // Build conversation history for the AI
  const history: { role: 'user' | 'assistant'; content: string }[] = [];

  // Add recent context from session
  for (const msg of context.history.slice(-6)) {
    if (msg.role === 'user') {
      history.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'agent') {
      history.push({ role: 'assistant', content: msg.content });
    }
  }

  let currentQuestion = context.query;
  let finalAnswer = '';
  let finalConfidence = 0;
  let suggestions: string[] = [];

  for (let iteration = 0; iteration < context.maxIterations; iteration++) {
    // Check timeout
    if (Date.now() - startTime > context.timeoutMs - 5000) {
      thoughtProcess.push({
        id: genStepId(), type: 'REFLECT',
        content: 'Approaching timeout — returning best available answer',
        timestamp: new Date().toISOString(), confidence: 0.4,
      });
      break;
    }

    // THINK: Ask the AI what to do
    thoughtProcess.push({
      id: genStepId(), type: 'THINK',
      content: `Iteration ${iteration + 1}: Processing query "${currentQuestion.substring(0, 80)}..."`,
      timestamp: new Date().toISOString(), confidence: 0.5,
    });

    let aiResult;
    try {
      aiResult = await withTokenTracking(
        'other',
        provider.name,
        'gemini-2.0-flash-lite',
        () => provider.askAI({
          systemPrompt,
          history,
          question: currentQuestion,
        }),
        { question: `[agent:${agentId}] ${currentQuestion.substring(0, 100)}` }
      );
      totalTokens.prompt += aiResult.usage.promptTokens;
      totalTokens.completion += aiResult.usage.completionTokens;
      totalTokens.total += aiResult.usage.totalTokens;
    } catch (err: any) {
      thoughtProcess.push({
        id: genStepId(), type: 'REFLECT',
        content: `AI call failed: ${err.message}`,
        timestamp: new Date().toISOString(), confidence: 0,
      });
      finalAnswer = `I encountered an error processing your request: ${err.message}. Try again or rephrase your query.`;
      break;
    }

    // Parse the AI's decision
    const action = parseAgentAction(aiResult.answer);

    if (action.action === 'answer') {
      finalAnswer = action.content || '';
      finalConfidence = action.confidence || 0.7;
      suggestions = action.suggestions || [];
      thoughtProcess.push({
        id: genStepId(), type: 'REFLECT',
        content: `Agent produced answer (confidence: ${finalConfidence})`,
        timestamp: new Date().toISOString(), confidence: finalConfidence,
      });
      break;
    }

    if (action.action === 'clarify') {
      finalAnswer = action.content || 'Could you provide more details?';
      finalConfidence = 0.3;
      break;
    }

    if (action.action === 'tool' && action.tool) {
      // ACT: Execute the tool
      const toolCall: ToolCall = {
        id: `tc_${Date.now().toString(36)}`,
        toolName: action.tool,
        parameters: action.params || {},
        calledAt: new Date().toISOString(),
        retryCount: 0,
      };

      thoughtProcess.push({
        id: genStepId(), type: 'ACT',
        content: `Calling tool: ${action.tool}(${JSON.stringify(action.params).substring(0, 100)})`,
        timestamp: new Date().toISOString(), confidence: 0.7, toolCall,
      });

      const toolResult = await executeToolCall(action.tool, action.params || {});
      toolCall.completedAt = new Date().toISOString();
      toolCall.durationMs = Date.now() - new Date(toolCall.calledAt).getTime();

      if (toolResult.success) {
        toolCall.result = toolResult.data;
        // Feed tool result back as context for next iteration
        const resultSummary = JSON.stringify(toolResult.data).substring(0, 4000);
        currentQuestion = `Tool "${action.tool}" returned:\n${resultSummary}\n\nBased on this data, answer the original query: "${context.query}"`;
        history.push({ role: 'assistant', content: `I called ${action.tool} and got results.` });
        history.push({ role: 'user', content: currentQuestion });
      } else {
        toolCall.error = toolResult.error;
        currentQuestion = `Tool "${action.tool}" failed with error: ${toolResult.error}. Try answering from available knowledge or suggest an alternative approach.`;
        history.push({ role: 'user', content: currentQuestion });
      }

      toolCalls.push(toolCall);
    } else {
      // Unknown action — break to avoid infinite loop
      finalAnswer = action.content || aiResult.answer;
      finalConfidence = 0.4;
      break;
    }
  }

  // If no answer was produced after all iterations
  if (!finalAnswer) {
    finalAnswer = 'I analyzed the data but could not produce a definitive answer. Try a more specific query.';
    finalConfidence = 0.2;
  }

  return {
    id: crypto.randomUUID(),
    agentId,
    status: finalConfidence >= 0.5 ? 'success' : 'partial',
    answer: finalAnswer,
    toolCalls,
    thoughtProcess,
    confidence: finalConfidence,
    durationMs: Date.now() - startTime,
    tokensUsed: totalTokens,
    suggestions,
  };
}
