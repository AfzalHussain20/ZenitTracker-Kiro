import type { AIProvider } from './types';
import { geminiProvider } from './gemini';
import { groqProvider } from './groq';
import { nvidiaProvider } from './nvidia';
import { keyPool } from './key-pool';

/**
 * Returns the active AI provider with key rotation + fallback.
 * Supports multiple keys via:
 *   GOOGLE_AI_API_KEYS=key1,key2,key3 (comma-separated pool)
 *   GROQ_API_KEYS=gsk_key1,gsk_key2 (comma-separated pool)
 * Also supports single-key vars: GOOGLE_AI_API_KEY, GROQ_API_KEY
 */
export function getAIProvider(): AIProvider {
  if (process.env.GOOGLE_AI_API_KEYS || process.env.GOOGLE_AI_API_KEY) return geminiWithFallback;
  if (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY) return groqProvider;
  throw new Error('No AI provider configured. Set GOOGLE_AI_API_KEYS or GROQ_API_KEYS in your environment.');
}

/**
 * Gemini provider with automatic key rotation + Groq fallback on rate limit (429).
 * Flow: Gemini key 1 → key 2 → ... → key N → Groq key 1 → ... → Groq key N → error
 * This makes multiple free tier keys act as one unlimited pool.
 */
const geminiWithFallback: AIProvider = {
  name: 'gemini',
  async askAI(params) {
    // Try Gemini with key rotation (up to 3 attempts to handle pool rotation)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await geminiProvider.askAI(params);
        return result;
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('429') || msg.includes('quota') || msg.includes('Quota') || msg.includes('exhausted')) {
          // Key was marked exhausted, try next key in pool
          continue;
        }
        throw err; // Non-quota error, don't retry
      }
    }

    // All Gemini keys exhausted — try Groq
    if (keyPool.getGroqKey()) {
      console.log('[AI] All Gemini keys exhausted — falling back to Groq');
      try {
        return await groqProvider.askAI(params);
      } catch (groqErr: any) {
        throw new Error('429: All AI providers exhausted. Please try again later.');
      }
    }

    throw new Error('429: AI quota exhausted across all configured keys. Add more keys to GOOGLE_AI_API_KEYS or GROQ_API_KEYS.');
  },
};

export type { AIProvider, AskAIParams, AskAIResult, ChatTurn } from './types';

/**
 * Routes that benefit from NVIDIA NIM's complex reasoning capability.
 * When NVIDIA_API_KEY is configured, these routes use NVIDIA → Gemini → Groq.
 * Falls back to getAIProvider() if NVIDIA is not configured.
 */
export type AIRoute = 'jira-insights' | 'investigate' | 'agent' | 'ask-global' | 'default';

const NVIDIA_ROUTES: AIRoute[] = ['jira-insights', 'investigate', 'agent'];

/**
 * NVIDIA provider with Gemini and Groq fallback.
 * Flow: NVIDIA → Gemini key 1 → ... → Gemini key N → Groq key 1 → ... → error
 */
const nvidiaWithFallback: AIProvider = {
  name: 'nvidia',
  async askAI(params) {
    // Try NVIDIA first
    const nvidiaKey = keyPool.getNvidiaKey();
    if (nvidiaKey) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await nvidiaProvider.askAI(params);
        } catch (err: any) {
          const msg = err?.message || '';
          if (msg.includes('429') || msg.includes('exhausted')) {
            keyPool.markNvidiaExhausted();
            if (keyPool.getAvailableNvidiaCount() === 0) break;
            continue;
          }
          throw err;
        }
      }
    }

    // NVIDIA exhausted or unavailable — fall back to Gemini
    console.log('[AI] NVIDIA unavailable — falling back to Gemini');
    return geminiWithFallback.askAI(params);
  },
};

/**
 * Returns the AI provider most appropriate for the given route.
 * When NVIDIA_API_KEY or NVIDIA_API_KEYS is set AND the route benefits from
 * complex reasoning (jira-insights, investigate, agent), returns NVIDIA with fallback.
 * Otherwise returns the standard getAIProvider() result (unchanged behavior).
 */
export function getAIProviderFor(route: AIRoute): AIProvider {
  const hasNvidia = !!(process.env.NVIDIA_API_KEY || process.env.NVIDIA_API_KEYS);
  if (hasNvidia && NVIDIA_ROUTES.includes(route)) {
    return nvidiaWithFallback;
  }
  return getAIProvider();
}
