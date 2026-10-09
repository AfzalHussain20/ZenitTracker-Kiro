# NVIDIA NIM Integration Plan — Zenit In-House

**Generated:** Investigation run (read-only)  
**NVIDIA Model:** `nvidia/nemotron-3.5-lightning-30b-a3b`  
**NVIDIA Base URL:** `https://integrate.api.nvidia.com/v1` (OpenAI-compatible)  
**Key:** Already present in `.env.local` as `NVIDIA_API_KEY`

---

## 1. Executive Summary

The NVIDIA NIM API is OpenAI-compatible (same `/v1/chat/completions` endpoint and message format that Groq already uses). Adding NVIDIA as a provider requires:

1. **One new file** — `src/lib/ai/providers/nvidia.ts` (mirrors `groq.ts` exactly, ~35 lines)
2. **One edit** — `src/lib/ai/providers/index.ts` — add NVIDIA to the key-pool and priority chain
3. **One edit** — `src/lib/ai/providers/key-pool.ts` — add NVIDIA key slot to `KeyPool`
4. **No npm packages needed** — all providers use native `fetch`; no `openai` SDK is installed and none is required

The `AIProvider` interface (`askAI(params): Promise<AskAIResult>`) is the only contract. The NVIDIA provider just implements it the same way Groq does, pointing at the NVIDIA NIM endpoint instead of `api.groq.com`.

---

## 2. Current Provider Architecture

### Provider Files

| File | Role |
|------|------|
| `src/lib/ai/providers/types.ts` | `AIProvider`, `AskAIParams`, `AskAIResult`, `ChatTurn` interfaces |
| `src/lib/ai/providers/key-pool.ts` | `KeyPool` singleton — rotates Gemini + Groq keys, marks exhausted on 429 |
| `src/lib/ai/providers/gemini.ts` | Gemini REST client — uses `generativelanguage.googleapis.com` |
| `src/lib/ai/providers/groq.ts` | Groq client — uses OpenAI-compatible `api.groq.com/openai/v1/chat/completions` |
| `src/lib/ai/providers/index.ts` | `getAIProvider()` factory — Gemini-with-fallback → Groq chain |

### Priority Chain (current)

```
GOOGLE_AI_API_KEYS / GOOGLE_AI_API_KEY → geminiWithFallback (3 retries across key pool)
  → on 429: all Gemini keys exhausted → Groq (if GROQ_API_KEYS / GROQ_API_KEY)
    → on failure: throw "All AI providers exhausted"
```

### Key Pool (current)

```
KeyPool {
  geminiKeys: KeyState[]   // loaded from GOOGLE_AI_API_KEYS (8 keys in .env.local)
  groqKeys:   KeyState[]   // loaded from GROQ_API_KEYS (9 keys in .env.local)
  // Exhausted key re-tried after RESET_INTERVAL_MS = 1 hour
}
```

The `.env.local` already has:
- `GOOGLE_AI_API_KEYS` — 8 Gemini keys → 12,000 RPD combined
- `GROQ_API_KEYS` — 9 Groq keys → 129,600 RPD combined
- `NVIDIA_API_KEY` — 1 key (newly added, currently unused)
- `NVIDIA_BASE_URL` = `https://integrate.api.nvidia.com/v1`
- `NVIDIA_MODEL` = `nvidia/nemotron-3.5-lightning-30b-a3b`

### No OpenAI SDK installed

`package.json` has no `openai` or `@openai` dependencies. Every provider uses native `fetch`. The NVIDIA provider must do the same — no new npm package is required.

---

## 3. All AI API Routes and Their Use

| Route | File | AI Use | Token Budget | Best NVIDIA Fit? |
|-------|------|--------|-------------|-----------------|
| `POST /api/ai/ask` | `ask/route.ts` | PRD Q&A chat, multi-turn | 12k chars context | Low — Gemini handles well |
| `POST /api/ai/ask-global` | `ask-global/route.ts` | Multi-PRD search, up to 40k chars | ~10k tokens | **YES** — large context synthesis |
| `POST /api/ai/generate-tests` | `generate-tests/route.ts` | Structured JSON test case generation | 8k chars + JSON output | Low — depends on strict JSON |
| `POST /api/ai/generate-tests-stream` | `generate-tests-stream/route.ts` | Same as above, streamed via SSE | 8k chars | Low — same concern |
| `POST /api/ai/investigate` | `investigate/route.ts` | Jira forensic verdict (compact AI step) | ~6k tokens prompt | **YES** — complex reasoning |
| `POST /api/ai/jira-insights` | `jira-insights/route.ts` | Jira postmortem + statistical analysis | ~6k tokens | **YES** — complex reasoning |
| `POST /api/ai/agent` | `agent/route.ts` | Multi-agent orchestrator (tool use + ReAct loop) | varies | **YES** — reasoning + tool planning |
| `POST /api/ai/categorize-prd` | `categorize-prd/route.ts` | PRD category classification | small | Low |
| `POST /api/ai/generate-from-dictionary` | `generate-from-dictionary/route.ts` | Test cases from a dictionary | medium | Low |
| `POST /api/notes/generate-title` | `notes/generate-title/route.ts` | Title + tags generation | tiny | No — too simple |

All routes call `getAIProvider()` from `src/lib/ai/providers/index.ts` and pass params through the `AIProvider.askAI()` abstraction. The only exception is the notes route, which has a direct Gemini call (legacy) — but that is irrelevant for NVIDIA integration.

---

## 4. Where NVIDIA Nemotron Fits Best

`nvidia/nemotron-3.5-lightning-30b-a3b` is a 30B MoE model optimized for reasoning and instruction-following. The best routes to route to it are:

### Tier 1: Strongest fit

**`/api/ai/investigate`** and **`/api/ai/jira-insights`**  
These routes send dense forensic analysis data (~4–6k tokens) and ask the model for precise verdict reasoning, executive summaries, and specific next steps with ticket IDs. This is exactly what a strong 30B reasoning model excels at — structured analysis requiring factual precision, not creative generation. Gemini-Flash-Lite sometimes fabricates ticket IDs; a more capable model would reduce that.

**`/api/ai/agent`** (orchestrator)  
The ReAct loop in `orchestrator.ts` + `executor.ts` uses the AI provider for both intent routing and tool-use planning. A 30B model with stronger instruction-following improves tool selection accuracy and multi-step reasoning quality.

### Tier 2: Good fit

**`/api/ai/ask-global`**  
Multi-PRD synthesis with up to 40k chars of context. NVIDIA's longer-context handling would improve cross-document answer quality.

### Tier 3: Not recommended to change

**`/api/ai/generate-tests`** and **`/api/ai/generate-tests-stream`**  
These depend on perfectly structured JSON output and work well with Gemini-Flash-Lite's strong JSON generation. Switching would risk JSON parse failures unless prompt engineering is adjusted.

---

## 5. Required Code Changes

### 5.1 Add NVIDIA to `KeyPool` — `src/lib/ai/providers/key-pool.ts`

The `KeyPool` class needs a third slot for NVIDIA keys. Pattern is identical to Groq:

```typescript
// Add to KeyPool class:
private nvidiaKeys: KeyState[] = [];
private nvidiaIndex = 0;

// In init():
const nvidiaPool = process.env.NVIDIA_API_KEYS;
if (nvidiaPool) {
  this.nvidiaKeys = nvidiaPool.split(',').map(k => k.trim()).filter(Boolean)
    .map(key => ({ key, exhaustedAt: null, requestCount: 0 }));
} else if (process.env.NVIDIA_API_KEY) {
  this.nvidiaKeys = [{ key: process.env.NVIDIA_API_KEY, exhaustedAt: null, requestCount: 0 }];
}

// New methods matching existing Gemini/Groq pattern:
getNvidiaKey(): string | null { /* same rotation logic */ }
markNvidiaExhausted(): void { /* same mark logic */ }
getAvailableNvidiaCount(): number { /* same count logic */ }
```

No logic changes — copy-paste the Groq pattern, rename variables.

### 5.2 Create `src/lib/ai/providers/nvidia.ts`

This file is virtually identical to `groq.ts` — only the endpoint URL, model name, and token limits change. NVIDIA NIM uses the exact same OpenAI chat completions wire format that Groq uses.

```typescript
import type { AIProvider, AskAIParams, AskAIResult } from './types';
import { keyPool } from './key-pool';

const MODEL = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b';
const BASE_URL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';

export const nvidiaProvider: AIProvider = {
  name: 'nvidia',

  async askAI({ systemPrompt, history, question }: AskAIParams): Promise<AskAIResult> {
    const apiKey = keyPool.getNvidiaKey();
    if (!apiKey) throw new Error('All NVIDIA API keys exhausted');

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: question },
    ];

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: parseInt(process.env.NVIDIA_MAX_TOKENS || '4096', 10),
        temperature: parseFloat(process.env.NVIDIA_TEMPERATURE || '0.3'),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        keyPool.markNvidiaExhausted();
      }
      throw new Error(`NVIDIA API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate an answer.";

    const usage = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
        }
      : undefined;

    return { answer, usage };
  },
};
```

### 5.3 Update `src/lib/ai/providers/index.ts`

Add NVIDIA as a primary provider that takes precedence over Gemini when configured. The new priority chain:

```
NVIDIA_API_KEY (if set) → first
GOOGLE_AI_API_KEYS → second (with Groq fallback as today)
GROQ_API_KEYS → third
```

Or alternatively — add NVIDIA as an additional fallback after Groq exhaustion. The recommended approach is **NVIDIA as a parallel high-quality option for specific routes**, not a replacement. However the cleanest implementation that doesn't require per-route selection is:

**Option A: Route-level selection** — create `getAIProviderFor(route: string)` that returns NVIDIA for the 3 best-fit routes and Gemini for everything else. This is the right call.

**Option B: Global priority** — NVIDIA first if key is set. Simpler but wastes NVIDIA credits on trivial tasks like notes title generation.

**Recommendation: Option A.** Add `getAIProviderFor()` alongside `getAIProvider()`:

```typescript
// src/lib/ai/providers/index.ts

export type AIRoute =
  | 'jira-insights'
  | 'investigate'
  | 'agent'
  | 'ask-global'
  | 'default';

/**
 * Returns the best provider for a given route.
 * NVIDIA Nemotron is preferred for complex reasoning routes.
 * Gemini remains the default for structured JSON generation.
 */
export function getAIProviderFor(route: AIRoute): AIProvider {
  const hasNvidia = !!(process.env.NVIDIA_API_KEY || process.env.NVIDIA_API_KEYS);
  const reasoningRoutes: AIRoute[] = ['jira-insights', 'investigate', 'agent'];

  if (hasNvidia && reasoningRoutes.includes(route)) {
    return nvidiaWithFallback; // NVIDIA → Gemini fallback
  }

  return getAIProvider(); // existing Gemini → Groq chain
}
```

Routes that call NVIDIA: `investigate/route.ts`, `jira-insights/route.ts`, `agent/route.ts`.

### 5.4 Update 3 Routes to Call `getAIProviderFor()`

```typescript
// investigate/route.ts, jira-insights/route.ts, agent/route.ts
// Change this:
import { getAIProvider } from '@/lib/ai/providers';
const provider = getAIProvider();

// To this:
import { getAIProviderFor } from '@/lib/ai/providers';
const provider = getAIProviderFor('jira-insights'); // or 'investigate' / 'agent'
```

No other changes needed in those files.

### 5.5 Token Tracker — No Changes Needed

`withTokenTracking()` already accepts `provider: string` (which will be `'nvidia'`) and `model: string`. The Firestore writes will automatically include NVIDIA events. The `TokenEvent.provider` field will contain `'nvidia'` when the NVIDIA provider is used.

---

## 6. Environment Variable Summary

Variables **already in `.env.local`** (no user action needed locally):
```
NVIDIA_API_KEY=nvapi-JTQ-...          # single key
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
```

Optional additions (not needed for basic integration):
```
NVIDIA_API_KEYS=key1,key2,...          # pool format (like GOOGLE_AI_API_KEYS)
NVIDIA_MAX_TOKENS=4096                  # default is 4096
NVIDIA_TEMPERATURE=0.3                  # default is 0.3
```

For Cloudflare deployment, these must also be added to the Cloudflare Pages environment variables dashboard under Settings → Environment Variables.

---

## 7. File Change Summary

| File | Change Type | Effort |
|------|-------------|--------|
| `src/lib/ai/providers/nvidia.ts` | **NEW** — 50 lines | 15 min |
| `src/lib/ai/providers/key-pool.ts` | **EDIT** — add 3rd key slot (+30 lines) | 10 min |
| `src/lib/ai/providers/index.ts` | **EDIT** — add `nvidiaProvider`, `getAIProviderFor()`, `nvidiaWithFallback` (+40 lines) | 15 min |
| `src/app/api/ai/investigate/route.ts` | **EDIT** — change `getAIProvider()` → `getAIProviderFor('investigate')` (1 line) | 2 min |
| `src/app/api/ai/jira-insights/route.ts` | **EDIT** — change `getAIProvider()` → `getAIProviderFor('jira-insights')` (2 lines) | 2 min |
| `src/app/api/ai/agent/route.ts` | **EDIT** — change `getAIProvider()` → `getAIProviderFor('agent')` (1 line) | 2 min |

**Total: 1 new file + 5 edits. No new npm packages. No schema changes. Estimated effort: 45 minutes.**

---

## 8. Key Observations and Risks

### Observation 1: Groq provider is the structural template
The NVIDIA NIM provider is almost byte-for-byte identical to `groq.ts` (lines 1–55). Both use `Bearer {apiKey}` auth, the same OpenAI message array format, and return the same `data.choices[0].message.content` path. This makes NVIDIA the lowest-effort addition possible.

### Observation 2: `withTokenTracking` passes model name as a string
Currently all routes hardcode `'gemini-2.0-flash-lite'` as the model string in `withTokenTracking` calls (e.g., `investigate/route.ts` line 119). These should be updated to `provider.name === 'nvidia' ? MODEL : 'gemini-2.0-flash-lite'` — or better, have providers expose a `modelName` property. This is a minor accuracy fix for the token usage dashboard, not a functional blocker.

### Observation 3: JSON parsing risk for test generation
The `generate-tests` route depends on Gemini's excellent JSON output. **Do not route test generation to NVIDIA** without extensive testing of the structured JSON output. The current integration plan deliberately excludes this route from NVIDIA routing.

### Observation 4: Rate limits unknown for NVIDIA NIM free tier
NVIDIA NIM API limits for the free tier are not documented in the codebase. The key-pool's 1-hour exhaustion reset window was designed for Gemini's daily quota. NVIDIA's limits may be per-minute, per-day, or concurrent-request based. The initial integration should use NVIDIA as primary with Gemini fallback (not the other way around), so if NVIDIA is rate-limited, requests transparently fall back.

### Observation 5: No `openai` npm package needed
The NVIDIA NIM API is OpenAI-compatible but the project intentionally uses native `fetch` everywhere. The `groq.ts` provider proves this works perfectly — same OpenAI wire format, no SDK dependency. Adding an `openai` npm package would be unnecessary and would break the Cloudflare Pages deployment (the project targets both Node.js and Edge-compatible code).

---

## 9. Implementation Order (dependency-safe)

1. **`key-pool.ts`** — adds NVIDIA key methods (no dependencies)
2. **`nvidia.ts`** — new provider file, imports from `key-pool.ts` and `types.ts`
3. **`providers/index.ts`** — adds NVIDIA imports, `nvidiaWithFallback`, `getAIProviderFor()` function
4. **`investigate/route.ts`**, **`jira-insights/route.ts`**, **`agent/route.ts`** — change import + one-liner call updates

Each step leaves the codebase in a working state. If NVIDIA_API_KEY is absent, `getAIProviderFor()` falls back to `getAIProvider()` (existing behavior), so the change is non-breaking even if the env var is not present in some environments.

---

## 10. Verification

After implementation:

```bash
# 1. Build must pass (TypeScript types check)
npm run build

# 2. Dev server smoke test — trigger an investigation query
# POST /api/ai/investigate with a valid Jira reporter name
# Check server logs for: "[KeyPool] Initialized: ... 1 NVIDIA keys"
# and: provider.name === 'nvidia' in the response JSON

# 3. Token tracker dashboard
# GET /api/ai/token-usage
# Should show 'nvidia' provider entries after investigation calls
```

---

*Investigation complete. No files were modified during this analysis.*
