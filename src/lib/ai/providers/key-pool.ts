/**
 * AI Key Pool — Rotates through multiple API keys automatically.
 * 
 * When one key hits a rate limit (429), it's marked as exhausted and
 * the next key is tried. Keys reset at midnight PT (Gemini) or per their own schedule.
 * 
 * ENV FORMAT:
 *   GOOGLE_AI_API_KEYS=key1,key2,key3,key4,key5
 *   GROQ_API_KEYS=gsk_key1,gsk_key2
 * 
 * Falls back to single-key env vars (GOOGLE_AI_API_KEY, GROQ_API_KEY) if pool vars aren't set.
 */

interface KeyState {
  key: string;
  exhaustedAt: number | null; // timestamp when 429 was received
  requestCount: number;
}

const RESET_INTERVAL_MS = 60 * 60 * 1000; // Try exhausted keys again after 1 hour

class KeyPool {
  private geminiKeys: KeyState[] = [];
  private groqKeys: KeyState[] = [];
  private geminiIndex = 0;
  private groqIndex = 0;
  private initialized = false;

  private init() {
    if (this.initialized) return;
    this.initialized = true;

    // Load Gemini keys (pool or single)
    const geminiPool = process.env.GOOGLE_AI_API_KEYS;
    if (geminiPool) {
      this.geminiKeys = geminiPool.split(',').map(k => k.trim()).filter(Boolean)
        .map(key => ({ key, exhaustedAt: null, requestCount: 0 }));
    } else if (process.env.GOOGLE_AI_API_KEY) {
      this.geminiKeys = [{ key: process.env.GOOGLE_AI_API_KEY, exhaustedAt: null, requestCount: 0 }];
    }

    // Load Groq keys (pool or single)
    const groqPool = process.env.GROQ_API_KEYS;
    if (groqPool) {
      this.groqKeys = groqPool.split(',').map(k => k.trim()).filter(Boolean)
        .map(key => ({ key, exhaustedAt: null, requestCount: 0 }));
    } else if (process.env.GROQ_API_KEY) {
      this.groqKeys = [{ key: process.env.GROQ_API_KEY, exhaustedAt: null, requestCount: 0 }];
    }

    console.log(`[KeyPool] Initialized: ${this.geminiKeys.length} Gemini keys, ${this.groqKeys.length} Groq keys`);
  }

  /** Get the next available Gemini key. Returns null if all exhausted. */
  getGeminiKey(): string | null {
    this.init();
    if (this.geminiKeys.length === 0) return null;

    const now = Date.now();
    // Try all keys starting from current index
    for (let i = 0; i < this.geminiKeys.length; i++) {
      const idx = (this.geminiIndex + i) % this.geminiKeys.length;
      const state = this.geminiKeys[idx];

      // Check if key was exhausted but enough time has passed to retry
      if (state.exhaustedAt && (now - state.exhaustedAt) > RESET_INTERVAL_MS) {
        state.exhaustedAt = null;
        state.requestCount = 0;
      }

      if (!state.exhaustedAt) {
        this.geminiIndex = idx;
        state.requestCount++;
        return state.key;
      }
    }

    return null; // All exhausted
  }

  /** Get the next available Groq key. Returns null if all exhausted. */
  getGroqKey(): string | null {
    this.init();
    if (this.groqKeys.length === 0) return null;

    const now = Date.now();
    for (let i = 0; i < this.groqKeys.length; i++) {
      const idx = (this.groqIndex + i) % this.groqKeys.length;
      const state = this.groqKeys[idx];

      if (state.exhaustedAt && (now - state.exhaustedAt) > RESET_INTERVAL_MS) {
        state.exhaustedAt = null;
        state.requestCount = 0;
      }

      if (!state.exhaustedAt) {
        this.groqIndex = idx;
        state.requestCount++;
        return state.key;
      }
    }

    return null;
  }

  /** Mark the current Gemini key as exhausted (hit 429). Rotates to next. */
  markGeminiExhausted() {
    this.init();
    if (this.geminiKeys.length === 0) return;
    this.geminiKeys[this.geminiIndex].exhaustedAt = Date.now();
    this.geminiIndex = (this.geminiIndex + 1) % this.geminiKeys.length;
    console.log(`[KeyPool] Gemini key #${this.geminiIndex} exhausted. Rotating. ${this.getAvailableGeminiCount()} keys remaining.`);
  }

  /** Mark the current Groq key as exhausted. Rotates to next. */
  markGroqExhausted() {
    this.init();
    if (this.groqKeys.length === 0) return;
    this.groqKeys[this.groqIndex].exhaustedAt = Date.now();
    this.groqIndex = (this.groqIndex + 1) % this.groqKeys.length;
    console.log(`[KeyPool] Groq key #${this.groqIndex} exhausted. Rotating.`);
  }

  /** Count of available (non-exhausted) Gemini keys */
  getAvailableGeminiCount(): number {
    this.init();
    const now = Date.now();
    return this.geminiKeys.filter(k => !k.exhaustedAt || (now - k.exhaustedAt) > RESET_INTERVAL_MS).length;
  }

  /** Count of available (non-exhausted) Groq keys */
  getAvailableGroqCount(): number {
    this.init();
    const now = Date.now();
    return this.groqKeys.filter(k => !k.exhaustedAt || (now - k.exhaustedAt) > RESET_INTERVAL_MS).length;
  }

  /** Stats for debugging */
  getStats() {
    this.init();
    return {
      gemini: { total: this.geminiKeys.length, available: this.getAvailableGeminiCount(), currentIndex: this.geminiIndex },
      groq: { total: this.groqKeys.length, available: this.getAvailableGroqCount(), currentIndex: this.groqIndex },
    };
  }
}

// Singleton
export const keyPool = new KeyPool();
