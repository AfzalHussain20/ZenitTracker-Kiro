/**
 * In-memory AI response cache + request throttle.
 * Reduces Gemini API calls by caching repeated requests
 * and spacing requests to stay safely under the 15 RPM limit.
 *
 * Cache entries expire after 10 minutes (PRD content doesn't change that fast).
 * Max 100 entries to prevent memory bloat on serverless.
 */

interface CacheEntry {
  response: string;
  createdAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ENTRIES = 100;
const MIN_REQUEST_INTERVAL_MS = 4200; // ~14 RPM (safely under 15 RPM limit)

// ─── Response Cache ──────────────────────────────────────────────────────────

const responseCache = new Map<string, CacheEntry>();

/**
 * Generates a cache key from the significant parts of a request.
 * Uses a simple hash of the content to keep keys short.
 */
function hashKey(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

export function getCacheKey(systemPrompt: string, question: string, historyLength: number): string {
  // Include history length to differentiate first question from follow-ups
  const raw = `${systemPrompt.substring(0, 200)}|${question}|${historyLength}`;
  return hashKey(raw);
}

export function getCachedResponse(key: string): string | null {
  const entry = responseCache.get(key);
  if (!entry) return null;

  // Check TTL
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }

  return entry.response;
}

export function setCachedResponse(key: string, response: string): void {
  // Evict oldest entries if cache is full
  if (responseCache.size >= MAX_ENTRIES) {
    const firstKey = responseCache.keys().next().value;
    if (firstKey) responseCache.delete(firstKey);
  }

  responseCache.set(key, { response, createdAt: Date.now() });
}

// ─── Confluence Page Content Cache ───────────────────────────────────────────

interface PageCache {
  plainText: string;
  title: string;
  fetchedAt: number;
}

const PAGE_CACHE_TTL_MS = 60 * 1000; // 1 minute — short enough to catch edits quickly
const pageContentCache = new Map<string, PageCache>();

export function getCachedPageContent(pageId: string): PageCache | null {
  const entry = pageContentCache.get(pageId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > PAGE_CACHE_TTL_MS) {
    pageContentCache.delete(pageId);
    return null;
  }
  return entry;
}

export function setCachedPageContent(pageId: string, plainText: string, title: string): void {
  if (pageContentCache.size >= 20) {
    const firstKey = pageContentCache.keys().next().value;
    if (firstKey) pageContentCache.delete(firstKey);
  }
  pageContentCache.set(pageId, { plainText, title, fetchedAt: Date.now() });
}

/**
 * Invalidate a specific page's cache (e.g., when user requests a refresh).
 */
export function invalidatePageCache(pageId?: string): void {
  if (pageId) {
    pageContentCache.delete(pageId);
  } else {
    pageContentCache.clear();
  }
}

// ─── Request Throttle ────────────────────────────────────────────────────────

let lastRequestTime = 0;

/**
 * Waits if needed to ensure minimum spacing between Gemini API calls.
 * This prevents hitting the 15 RPM limit even under heavy use.
 * Returns immediately if enough time has passed since the last request.
 */
export async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;

  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    const waitMs = MIN_REQUEST_INTERVAL_MS - elapsed;
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }

  lastRequestTime = Date.now();
}

// ─── Stats (for debugging) ───────────────────────────────────────────────────

export function getCacheStats() {
  return {
    responseEntries: responseCache.size,
    pageEntries: pageContentCache.size,
    lastRequestMs: lastRequestTime,
  };
}
