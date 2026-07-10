import type { AIProvider } from './types';
import { geminiProvider } from './gemini';
import { groqProvider } from './groq';

/**
 * Returns the active AI provider.
 * Priority: Gemini (free tier) > Groq (fallback).
 * Set GOOGLE_AI_API_KEY for Gemini (recommended — free tier available).
 * Set GROQ_API_KEY for Groq as fallback when Gemini quota is exhausted.
 */
export function getAIProvider(): AIProvider {
  if (process.env.GOOGLE_AI_API_KEY) return geminiWithFallback;
  if (process.env.GROQ_API_KEY) return groqProvider;
  throw new Error('No AI provider configured. Set GOOGLE_AI_API_KEY or GROQ_API_KEY in your environment.');
}

/**
 * Gemini provider with automatic Groq fallback on rate limit (429).
 * If Gemini returns a quota error, silently retries with Groq.
 * This makes the free tier feel unlimited from the user's perspective.
 */
const geminiWithFallback: AIProvider = {
  name: 'gemini',
  async askAI(params) {
    try {
      return await geminiProvider.askAI(params);
    } catch (err: any) {
      const msg = err?.message || '';
      // If Gemini quota exceeded and Groq is available, fall back silently
      if ((msg.includes('429') || msg.includes('quota') || msg.includes('Quota')) && process.env.GROQ_API_KEY) {
        console.log('[AI] Gemini quota hit — falling back to Groq');
        return await groqProvider.askAI(params);
      }
      throw err;
    }
  },
};

export type { AIProvider, AskAIParams, AskAIResult, ChatTurn } from './types';
