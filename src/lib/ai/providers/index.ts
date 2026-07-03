import type { AIProvider } from './types';
import { geminiProvider } from './gemini';
import { groqProvider } from './groq';

/**
 * Returns the active AI provider.
 * Priority: Gemini (free tier) > Groq (paid).
 * Set GOOGLE_AI_API_KEY for Gemini (recommended — free tier available).
 * Set GROQ_API_KEY for Groq as fallback.
 */
export function getAIProvider(): AIProvider {
  if (process.env.GOOGLE_AI_API_KEY) return geminiProvider;
  if (process.env.GROQ_API_KEY) return groqProvider;
  throw new Error('No AI provider configured. Set GOOGLE_AI_API_KEY or GROQ_API_KEY in your environment.');
}

export type { AIProvider, AskAIParams, AskAIResult, ChatTurn } from './types';
