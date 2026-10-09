/**
 * AI Feature Flags
 *
 * Controls which AI features and providers are active.
 * Stored in Firestore `ai_feature_flags` collection (single doc: "config").
 * Also cached in-memory on the server for fast checks without a Firestore read per request.
 *
 * Features:
 *   ask-prd          → PRD Chat (single-page ChatPanel)
 *   ask-global       → Global PRD Search chat
 *   generate-tests   → Test Case Generation
 *   generate-stream  → Streaming test case generation
 *   jira-insights    → Jira KPI AI chat
 *   categorize-prd   → PRD auto-categorization
 *   analytics-events → Analytics event extraction
 *   notes-ai         → Daily notes AI title generation
 *   jira-ai          → Jira AI features
 *
 * Providers: gemini | groq | huggingface
 */

import { getCompatDb } from '@/lib/firebase-compat';

export type AIFeatureKey =
  | 'ask-prd'
  | 'ask-global'
  | 'generate-tests'
  | 'generate-stream'
  | 'jira-insights'
  | 'categorize-prd'
  | 'analytics-events'
  | 'notes-ai'
  | 'jira-ai';

export type AIProviderKey = 'gemini' | 'groq' | 'huggingface';

export interface AIFeatureFlags {
  // Master switch per feature
  features: Record<AIFeatureKey, boolean>;
  // Per-provider kill switches (affects ALL features using that provider)
  providers: Record<AIProviderKey, boolean>;
  updatedAt: number;
  updatedBy?: string;
}

export const DEFAULT_FLAGS: AIFeatureFlags = {
  features: {
    'ask-prd': true,
    'ask-global': true,
    'generate-tests': true,
    'generate-stream': true,
    'jira-insights': true,
    'categorize-prd': true,
    'analytics-events': true,
    'notes-ai': true,
    'jira-ai': true,
  },
  providers: {
    gemini: true,
    groq: true,
    huggingface: true,
  },
  updatedAt: Date.now(),
};

export const FEATURE_LABELS: Record<AIFeatureKey, { label: string; description: string; icon: string }> = {
  'ask-prd': { label: 'PRD Chat', description: 'Ask questions about a single PRD (ChatPanel)', icon: '💬' },
  'ask-global': { label: 'Global PRD Search', description: 'Cross-PRD AI search across all Confluence pages', icon: '🌐' },
  'generate-tests': { label: 'Test Case Generation', description: 'Generate test cases from PRDs (single-shot)', icon: '🧪' },
  'generate-stream': { label: 'Streaming Generation', description: 'Stream test cases live as they generate (SSE)', icon: '⚡' },
  'jira-insights': { label: 'Jira KPI Chat', description: 'Natural language queries on Jira data', icon: '📊' },
  'categorize-prd': { label: 'PRD Auto-Categorization', description: 'Auto-tag PRDs when opened (background)', icon: '🏷️' },
  'analytics-events': { label: 'Analytics Event Extractor', description: 'Extract analytics events from PRDs', icon: '📡' },
  'notes-ai': { label: 'Notes AI Title', description: 'Auto-generate titles for quick notes', icon: '📝' },
  'jira-ai': { label: 'Jira AI Insights', description: 'AI-powered Jira analytics features', icon: '🔍' },
};

export const PROVIDER_LABELS: Record<AIProviderKey, { label: string; description: string; color: string }> = {
  gemini: { label: 'Google Gemini', description: 'gemini-2.0-flash-lite (free tier, 1M RPD per key)', color: '#4285F4' },
  groq: { label: 'Groq / LLaMA', description: 'llama-3.3-70b-versatile (fallback provider)', color: '#F55036' },
  huggingface: { label: 'HuggingFace', description: 'Optional HuggingFace inference endpoints', color: '#FFD21E' },
};

// ─── Server-side in-memory cache ─────────────────────────────────────────────
let cachedFlags: AIFeatureFlags | null = null;
let cacheTs = 0;
const CACHE_TTL = 60_000; // 1 minute — flags rarely change

const FLAGS_COLLECTION = 'ai_feature_flags';
const FLAGS_DOC = 'config';

/**
 * Reads feature flags. Returns cached copy if fresh, otherwise fetches from Firestore.
 * Falls back to DEFAULT_FLAGS if Firestore is unavailable.
 */
export async function getFeatureFlags(): Promise<AIFeatureFlags> {
  const now = Date.now();
  if (cachedFlags && now - cacheTs < CACHE_TTL) return cachedFlags;

  try {
    const db = getCompatDb();
    const doc = await db.collection(FLAGS_COLLECTION).doc(FLAGS_DOC).get();
    if (doc.exists) {
      const data = doc.data() as AIFeatureFlags;
      // Merge with defaults to handle new feature keys added after last save
      cachedFlags = {
        features: { ...DEFAULT_FLAGS.features, ...data.features },
        providers: { ...DEFAULT_FLAGS.providers, ...data.providers },
        updatedAt: data.updatedAt || now,
        updatedBy: data.updatedBy,
      };
    } else {
      // First time — seed with defaults
      await db.collection(FLAGS_COLLECTION).doc(FLAGS_DOC).set(DEFAULT_FLAGS);
      cachedFlags = { ...DEFAULT_FLAGS };
    }
    cacheTs = now;
    return cachedFlags;
  } catch {
    // If Firestore fails, default to all enabled (fail open)
    return DEFAULT_FLAGS;
  }
}

/**
 * Saves updated flags to Firestore and invalidates the in-memory cache.
 */
export async function saveFeatureFlags(flags: Partial<AIFeatureFlags>, updatedBy?: string): Promise<void> {
  const db = getCompatDb();
  const current = await getFeatureFlags();
  const updated: AIFeatureFlags = {
    features: { ...current.features, ...flags.features },
    providers: { ...current.providers, ...flags.providers },
    updatedAt: Date.now(),
    updatedBy: updatedBy || current.updatedBy,
  };
  await db.collection(FLAGS_COLLECTION).doc(FLAGS_DOC).set(updated);
  cachedFlags = updated;
  cacheTs = Date.now();
}

/**
 * Checks if a specific feature + provider combination is currently enabled.
 * Returns false if either the feature OR the provider is disabled.
 */
export async function isAIEnabled(feature: AIFeatureKey, provider: AIProviderKey = 'gemini'): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.features[feature] !== false && flags.providers[provider] !== false;
}

/**
 * Synchronous version — checks the in-memory cache only.
 * Use after a prior getFeatureFlags() call to avoid await in hot paths.
 */
export function isAIEnabledSync(feature: AIFeatureKey, provider: AIProviderKey = 'gemini'): boolean {
  if (!cachedFlags) return true; // not loaded yet → default allow
  return cachedFlags.features[feature] !== false && cachedFlags.providers[provider] !== false;
}

/** Invalidates the in-memory cache (call after a POST update). */
export function invalidateFlagsCache(): void {
  cachedFlags = null;
  cacheTs = 0;
}
