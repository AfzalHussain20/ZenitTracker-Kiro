import type { AIProvider } from './types';
import { geminiProvider } from './gemini';

/**
 * Returns the configured AI provider.
 * Currently Gemini only. To add Anthropic/OpenAI later, import them here
 * and check for their respective API keys.
 */
export function getAIProvider(): AIProvider {
  if (process.env.GOOGLE_AI_API_KEY) return geminiProvider;
  throw new Error('No AI provider configured. Set GOOGLE_AI_API_KEY in your environment.');
}

export type { AIProvider, AskAIParams, AskAIResult, ChatTurn } from './types';
