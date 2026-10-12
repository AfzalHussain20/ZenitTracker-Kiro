import type { AIProvider } from './types';
import { geminiProvider } from './gemini';
import { groqProvider } from './groq';
import { nvidiaProvider } from './nvidia';
import { keyPool } from './key-pool';

/**
 * Returns the active AI provider with key rotation + fallback.
 * Priority: NVIDIA (primary) → Gemini → Groq.
 *
 * Supports multiple keys via comma-separated pools:
 *   NVIDIA_API_KEYS=nvapi_key1,nvapi_key2
 *   GOOGLE_AI_API_KEYS=key1,key2,key3
 *   GROQ_API_KEYS=gsk_key1,gsk_key2
 * Also supports single-key vars: NVIDIA_API_KEY, GOOGLE_AI_API_KEY, GROQ_API_KEY.
 */
export function getAIProvider(): AIProvider {
  if (process.env.NVIDIA_API_KEY || process.env.NVIDIA_API_KEYS) return nvidiaWithFallback;
  if (process.env.GOOGLE_AI_API_KEYS || process.env.GOOGLE_AI_API_KEY) return geminiWithFallback;
  if (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY) return groqProvider;
  throw new Error('No AI provider configured. Set NVIDIA_API_KEY (primary), GOOGLE_AI_API_KEYS, or GROQ_API_KEYS in your environment.');
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
 * Routes that use NVIDIA NIM as the primary reasoning provider (with
 * Gemini → Groq fallback when NVIDIA is unavailable or exhausted).
 */
export type AIRoute = 'jira-insights' | 'investigate' | 'agent' | 'ask-global' | 'default';

/**
 * NVIDIA provider with Gemini and Groq fallback.
 * Flow: NVIDIA key 1 → ... → NVIDIA key N → Gemini key 1 → ... → Gemini key N → Groq → error
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

    // NVIDIA exhausted or unavailable — fall back to Gemini (which itself falls back to Groq)
    console.log('[AI] NVIDIA unavailable — falling back to Gemini');
    return geminiWithFallback.askAI(params);
  },
};

/**
 * Returns the AI provider for the given route. NVIDIA is the primary provider
 * for ALL routes when configured; otherwise Gemini → Groq. The route argument
 * is retained for API compatibility but no longer changes provider selection.
 */
export function getAIProviderFor(route: AIRoute = 'default'): AIProvider {
  void route;
  return getAIProvider();
}
