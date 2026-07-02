import type { AIProvider } from './types';
import { geminiProvider } from './gemini';
import { groqProvider } from './groq';

export function getAIProvider(): AIProvider {
  if (process.env.GROQ_API_KEY) return groqProvider;
  if (process.env.GOOGLE_AI_API_KEY) return geminiProvider;
  throw new Error('No AI provider configured. Set GROQ_API_KEY or GOOGLE_AI_API_KEY in your environment.');
}

export type { AIProvider, AskAIParams, AskAIResult, ChatTurn } from './types';
