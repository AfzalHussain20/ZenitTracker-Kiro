# Zenit In-House — AI Architecture Technical Report

**Generated:** July 10, 2026  
**Project:** Zenit QA Platform (Next.js 14 + Firebase + Python)

---

## 1. Executive Summary

Yes — this application actively uses AI providers. The primary provider is **Google Gemini** (free tier), with **Groq** as a configured fallback and **Hugging Face** in a legacy flow. No OpenAI, Anthropic, AWS Bedrock, or other major providers are integrated.

---

## 2. AI Providers Integrated

| Provider | Model | Usage | Status |
|----------|-------|-------|--------|
| **Google Gemini** | `gemini-2.0-flash-lite` | Primary — test case generation, PRD Q&A, notes AI | ✅ Active |
| **Google Gemini** | `gemini-2.0-flash` | Notes title generation (separate endpoint) | ✅ Active |
| **Groq** | `llama-3.3-70b-versatile` | Fallback if Gemini key missing | ⚠️ Configured, unused |
| **Hugging Face** | `Mistral-7B-Instruct-v0.2` | Legacy PRD extraction | ⚠️ Legacy |
| **Hugging Face** | `zephyr-7b-beta` | Legacy test case generation flow | ⚠️ Legacy/Dead code |

---

## 3. Configuration Files

| File | Purpose |
|------|---------|
| `src/lib/ai/providers/index.ts` | Provider selection logic (Gemini > Groq) |
| `src/lib/ai/providers/gemini.ts` | Gemini provider implementation |
| `src/lib/ai/providers/groq.ts` | Groq provider implementation |
| `src/lib/ai/providers/types.ts` | AIProvider interface definition |
| `.env.local` | All environment variables including AI keys |
| `src/app/api/notes/generate-title/route.ts` | Hardcoded Gemini key fallback |

---

## 4. Environment Variables Required

```
# AI — Primary (Gemini)
GOOGLE_AI_API_KEY=<Google AI Studio API key>

# AI — Fallback (Groq)
GROQ_API_KEY=<Groq API key>  # Optional — only needed if Gemini key absent

# AI — Legacy (Hugging Face)
HF_API_TOKEN=<Hugging Face token>  # Only for /api/extract-prd

# AI — Notes (secondary Gemini key)
GEMINI_API_KEY=<Gemini key for notes>  # Falls back to hardcoded key if absent
```

**Currently configured in `.env.local`:**
- `GOOGLE_AI_API_KEY` = Set (obfuscated: `AQ.Ab8RN6KL-BEq...`)
- `GROQ_API_KEY` = **NOT SET**
- `HF_API_TOKEN` = **NOT SET**
- `GEMINI_API_KEY` = **NOT SET** (but hardcoded fallback exists in notes route)

---

## 5. AI Models Configured

| Context | Model | Max Tokens | Temperature |
|---------|-------|-----------|-------------|
| Test case generation | `gemini-2.0-flash-lite` | 8192 | 0.4 |
| PRD Q&A chatbot | `gemini-2.0-flash-lite` | 1024 (default) | 0.3 (env-configurable) |
| Notes title generation | `gemini-2.0-flash` | 200 | 0.3 |
| Groq fallback | `llama-3.3-70b-versatile` | 1024 | 0.3 |
| Legacy PRD extract | `Mistral-7B-Instruct-v0.2` | 2000 | N/A |
| Legacy genkit flow | `zephyr-7b-beta` | 1500 | 0.7 |

---

## 6. Complete Request Flow — Test Case Generation

```
┌──────────────────┐     ┌────────────────────────┐     ┌───────────────────┐
│  Frontend        │     │  Next.js API Route      │     │  External AI      │
│  (Confluence     │────▶│  /api/ai/generate-tests │────▶│  Gemini API       │
│   Page UI)       │     │                         │     │  (Google)         │
│                  │◀────│  Parse + Validate JSON  │◀────│                   │
└──────────────────┘     └────────────────────────┘     └───────────────────┘
        │                         │
        │                         ▼
        │              ┌────────────────────────┐
        │              │  Confluence Cloud API   │
        │              │  (Fetch PRD content)    │
        │              └────────────────────────┘
        ▼
┌──────────────────┐
│  TestCase Review │
│  Panel + Store   │
│  (Firestore)     │
└──────────────────┘
```

**Detailed flow:**
1. User selects a Confluence page → clicks "Generate Test Cases"
2. Frontend POSTs to `/api/ai/generate-tests` with `{ pageId, pass }`
3. API route fetches Confluence page HTML via REST API (Basic Auth)
4. `extractPlainText()` strips HTML → plain markdown-like text
5. `truncateForContext()` cuts to 8000 chars (70% head, 30% tail)
6. `getAIProvider()` selects Gemini (or Groq fallback)
7. `generateTestCasesForPass()` builds pass-specific system prompt
8. AI provider's `askAI()` calls Gemini `generateContent` endpoint
9. Response JSON is parsed by `parseTestCaseResponse()` with fault tolerance
10. Test case IDs assigned (`TC_FUNC_001`, `TC_NEG_002`, etc.)
11. Response returned to frontend → stored in Firestore via `testCaseStore.ts`

---

## 7. All Files Involved in AI Communication

### Core AI Library (`src/lib/ai/`)
| File | Role |
|------|------|
| `providers/index.ts` | Provider factory (getAIProvider) |
| `providers/gemini.ts` | Gemini REST API client |
| `providers/groq.ts` | Groq REST API client |
| `providers/types.ts` | AIProvider interface, ChatTurn types |
| `testCaseGenerator.ts` | Prompt construction, parsing, orchestration |
| `testCaseStore.ts` | Firestore CRUD for generated test cases |
| `testCaseUtils.ts` | Filter/sort utilities |
| `testCaseExport.ts` | Excel/CSV export |
| `extractText.ts` | HTML→plaintext + truncation |

### API Routes
| File | Endpoint | AI Action |
|------|----------|-----------|
| `src/app/api/ai/generate-tests/route.ts` | POST /api/ai/generate-tests | Multi-pass test case generation |
| `src/app/api/ai/ask/route.ts` | POST /api/ai/ask | PRD Q&A chatbot |
| `src/app/api/extract-prd/route.ts` | POST /api/extract-prd | Legacy PDF→test case extraction |
| `src/app/api/notes/generate-title/route.ts` | POST /api/notes/generate-title | AI title + tags + category |

### Frontend Components
| File | Role |
|------|------|
| `src/components/ChatPanel.tsx` | PRD Q&A chat UI |
| `src/components/TestGenProgress.tsx` | Generation progress indicator |
| `src/components/TestCaseReviewPanel.tsx` | Review/accept/reject AI output |
| `src/components/notes/FloatingNotesWidget.tsx` | Quick note with AI title |
| `src/app/(app)/notes/page.tsx` | Notes page with AI title button |

### Legacy/Unused
| File | Status |
|------|--------|
| `src/ai/flows/generate-test-cases-flow.ts` | Dead code — HuggingFace zephyr-7b |
| `src/ai/flows/generate-locators-flow.ts` | Deterministic (no AI) despite name |

---

## 8. Prompt Generation & Storage

**Prompts are generated dynamically** in `testCaseGenerator.ts` via `buildSystemPrompt()`.

- No static prompt files or database-stored prompts
- System prompts are constructed at call time based on:
  - Generation pass type (functional, negative, exploratory, web, tv, mobile)
  - PRD headings extracted from content
  - Previously generated test cases (for deduplication)
- The PRD Q&A chatbot has a static `SYSTEM_PROMPT` constant in `/api/ai/ask/route.ts`
- Notes title generation has an inline prompt in the route handler

---

## 9. Conversation History Management

- **PRD Chat (`ChatPanel.tsx`)**: History maintained in React state (`useState<ChatMessage[]>`)
  - Reset on page navigation (different `pageId`)
  - Sent as `history` array in each API call
  - Format: `[{ role: 'user'|'assistant', content: string }]`
  - No persistence — lost on page refresh
- **Test Case Generation**: Stateless — no conversation history (single-shot per pass)
- **Notes AI**: Stateless — single-shot title generation

---

## 10. Streaming Responses

**No streaming AI responses are implemented.** All AI calls use standard request/response.

The project does have streaming for a different purpose:
- `src/server/vision-stream.ts` — WebSocket streaming of device screen frames (ADB screencap)
- `backend/vision_server.py` — Same concept in Python (FastAPI WebSocket)

These are NOT AI-related — they stream device display data for the Vision/Automation feature.

---

## 11. AI-Related API Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/ai/generate-tests` | None (server-side keys) | Generate test cases from PRD |
| POST | `/api/ai/ask` | None (server-side keys) | Q&A about a PRD page |
| POST | `/api/extract-prd` | None (server-side keys) | Legacy PDF extraction |
| POST | `/api/notes/generate-title` | None (server-side keys) | AI title/tags for notes |

---

## 12. Authentication & Security for AI Requests

- **No user authentication** on AI endpoints — any authenticated app user can trigger AI calls
- **Server-side API keys only** — keys are never sent to the client
- **Rate limiting**: Only Gemini's built-in quota (free tier: 15 RPM, 1M TPM, 1500 RPD)
- **No application-level rate limiting** implemented
- **No token budget tracking** per user
- **Retry with exponential backoff** on 429/5xx errors (`retryWithBackoff()` in testCaseGenerator.ts)

---

## 13. Token Usage Estimation

### Typical User Interaction: Generate Test Cases (3-pass)

| Pass | Input Tokens (est.) | Output Tokens (est.) | Cost (Gemini Free) |
|------|--------------------|--------------------|-------------------|
| Pass 1 (Functional) | ~3,000 | ~4,000 | $0.00 |
| Pass 2 (Negative) | ~3,500 | ~4,000 | $0.00 |
| Pass 3 (Exploratory) | ~4,000 | ~4,000 | $0.00 |
| **Total per generation** | **~10,500** | **~12,000** | **$0.00** |

### PRD Q&A Chat (per message)
- Input: ~3,000-12,000 tokens (PRD context + history)
- Output: ~200-500 tokens
- Cost: $0.00 (free tier)

### Notes Title Generation
- Input: ~300-500 tokens
- Output: ~50 tokens
- Cost: $0.00 (free tier)

---

## 14. Rate Limits & Quotas

### Google Gemini Free Tier (gemini-2.0-flash-lite)
- **15 requests per minute (RPM)**
- **1,000,000 tokens per minute (TPM)**
- **1,500 requests per day (RPD)**
- Resets at midnight Pacific Time
- The app calculates reset time in `getNextResetTime()` and shows IST to users

### Groq Free Tier (llama-3.3-70b-versatile)
- 30 requests per minute
- 131,072 tokens per minute
- 14,400 requests per day

### Hugging Face Inference API (Free)
- Rate-limited (queue-based)
- 120 second timeout configured

---

## 15. Security Vulnerabilities Found

### 🔴 CRITICAL: Hardcoded API Key
```typescript
// src/app/api/notes/generate-title/route.ts (line 4)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCo3zdevDyNmxk_2boEynXB90JMwdpc-HA';
```
**Risk:** API key exposed in source code. If repo is public or leaked, key is compromised.

### 🔴 CRITICAL: Full Private Keys in .env.local
The `.env.local` file contains:
- Firebase Admin private key (full RSA key)
- Google Service Account private key (full RSA key)
- Jira API token
- Google OAuth client secret
- Google AI API key

**Risk:** If `.env.local` is committed to git or shared, all services are compromised.

### 🟡 MEDIUM: No Auth on AI Endpoints
AI API routes have no user-level authentication checks. Any request to the server can trigger AI calls.

### 🟡 MEDIUM: No Rate Limiting at Application Level
Relies entirely on provider-side rate limits. A malicious user could exhaust the daily quota.

---

## 16. Cost Optimization Recommendations

1. **Current cost: $0/month** — Gemini free tier handles the entire workload
2. **If scaling beyond free tier:**
   - Switch to `gemini-2.0-flash-lite` for all tasks (already done) — cheapest Gemini model
   - Implement response caching for repeated PRD queries (same pageId + question)
   - Add client-side debouncing on chat messages (already done: 500ms)
   - Reduce context window: current 8000 chars is already conservative
3. **Reduce token usage:**
   - Cache Confluence page text (avoid re-fetching for same pageId)
   - Implement semantic deduplication for test case generation
   - Use shorter system prompts for simple tasks (notes title)

---

## 17. Replacing with Free/Self-Hosted Alternative (Ollama)

### Recommended: Ollama with `llama3.1:8b` or `mistral:7b`

**Pros:** Completely free, no rate limits, data stays local  
**Cons:** Requires GPU server, slower than cloud APIs, lower quality on structured JSON tasks

### Code Changes Required

#### 1. New Provider File: `src/lib/ai/providers/ollama.ts`
```typescript
import type { AIProvider, AskAIParams, AskAIResult } from './types';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

export const ollamaProvider: AIProvider = {
  name: 'ollama',
  async askAI({ systemPrompt, history, question }: AskAIParams): Promise<AskAIResult> {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: question },
    ];
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, stream: false }),
    });
    const data = await response.json();
    return { answer: data.message?.content || "Couldn't generate a response." };
  },
};
```

#### 2. Update Provider Index: `src/lib/ai/providers/index.ts`
```typescript
import { ollamaProvider } from './ollama';

export function getAIProvider(): AIProvider {
  if (process.env.OLLAMA_URL) return ollamaProvider;
  if (process.env.GOOGLE_AI_API_KEY) return geminiProvider;
  if (process.env.GROQ_API_KEY) return groqProvider;
  throw new Error('No AI provider configured.');
}
```

#### 3. Update Notes Route: `src/app/api/notes/generate-title/route.ts`
Replace the direct Gemini call with the provider abstraction:
```typescript
import { getAIProvider } from '@/lib/ai/providers';
// Use provider.askAI() instead of direct fetch to Gemini
```

#### 4. Environment Variables
```
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

#### 5. Remove Hardcoded Key
Delete the fallback key from `src/app/api/notes/generate-title/route.ts`

### Total Files to Modify: 3 files + 1 new file
1. `src/lib/ai/providers/ollama.ts` (NEW)
2. `src/lib/ai/providers/index.ts` (add Ollama priority)
3. `src/app/api/notes/generate-title/route.ts` (use provider pattern)
4. `.env.local` (add OLLAMA_URL, OLLAMA_MODEL)

---

## 18. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js Client)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────────┐   │
│  │ ChatPanel    │  │ Confluence Page   │  │ Notes Page /        │   │
│  │ (PRD Q&A)   │  │ (Test Gen UI)     │  │ FloatingWidget      │   │
│  └──────┬───────┘  └────────┬──────────┘  └──────────┬──────────┘   │
│         │                    │                         │              │
└─────────┼────────────────────┼─────────────────────────┼──────────────┘
          │                    │                         │
          ▼                    ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NEXT.JS API ROUTES (Server)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────┐  ┌────────────────────┐  ┌─────────────────────┐   │
│  │ /api/ai/   │  │ /api/ai/           │  │ /api/notes/         │   │
│  │ ask        │  │ generate-tests     │  │ generate-title      │   │
│  └─────┬──────┘  └────────┬───────────┘  └──────────┬──────────┘   │
│        │                   │                          │              │
│        ▼                   ▼                          ▼              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              AI PROVIDER ABSTRACTION LAYER                    │   │
│  │         src/lib/ai/providers/index.ts                         │   │
│  │                                                               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐   │   │
│  │  │ Gemini   │  │  Groq    │  │ (Ollama)  │  │   HF     │   │   │
│  │  │ PRIMARY  │  │ FALLBACK │  │  FUTURE   │  │  LEGACY  │   │   │
│  │  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └────┬─────┘   │   │
│  └───────┼──────────────┼──────────────┼──────────────┼─────────┘   │
│          │              │              │              │              │
└──────────┼──────────────┼──────────────┼──────────────┼──────────────┘
           ▼              ▼              ▼              ▼
┌─────────────────┐  ┌────────────┐  ┌──────────┐  ┌──────────────┐
│ Google AI Studio│  │ Groq Cloud │  │ Ollama   │  │ HuggingFace  │
│ (Gemini API)    │  │ (OpenAI-   │  │ Local    │  │ Inference    │
│ FREE TIER       │  │  compat)   │  │ Server   │  │ API          │
└─────────────────┘  └────────────┘  └──────────┘  └──────────────┘
```

---

## 19. Dependency Map

```
package.json (NO AI-specific npm packages — all calls use native fetch)
│
├── axios (used only in legacy HuggingFace flows)
├── zod (schema validation for AI responses)
└── cheerio (HTML parsing for Confluence, used in vision-stream)

src/lib/ai/
├── providers/
│   ├── index.ts ────── imports: gemini.ts, groq.ts
│   ├── gemini.ts ───── imports: types.ts
│   ├── groq.ts ─────── imports: types.ts
│   └── types.ts ────── (standalone interfaces)
├── testCaseGenerator.ts ── imports: providers/, extractText.ts, types/test-cases
├── testCaseStore.ts ────── imports: firebase/firestore, types/test-cases
├── testCaseUtils.ts ────── imports: types/test-cases
├── testCaseExport.ts ───── imports: xlsx, types/test-cases
└── extractText.ts ──────── (standalone, no imports)

src/ai/flows/ (LEGACY — genkit-style, NOT connected to main app)
├── generate-test-cases-flow.ts ── imports: axios, zod, dotenv
└── generate-locators-flow.ts ──── (no AI, deterministic)
```

---

## 20. Unused AI Libraries & Dead Code

| Item | Location | Status |
|------|----------|--------|
| `src/ai/flows/generate-test-cases-flow.ts` | Genkit flow using HuggingFace | **Dead code** — not imported anywhere in the main app |
| `src/ai/flows/generate-locators-flow.ts` | Despite the name, purely deterministic | **Misleading name** — no AI |
| `HF_API_TOKEN` env variable | Only used by legacy `/api/extract-prd` | **Partially dead** — extract-prd still works if key is set |
| `axios` dependency | Only used in legacy HF flows | Could use native `fetch` instead |

---

## 21. Can the App Function Without External AI?

**Yes — with degraded features:**

| Feature | Without AI | Impact |
|---------|-----------|--------|
| Test case generation from PRD | ❌ Broken | Core feature — no alternatives |
| PRD Q&A chatbot | ❌ Broken | Chat panel becomes non-functional |
| Notes title generation | ⚠️ Degraded | Falls back to first 50 chars of content |
| Notes tag extraction | ⚠️ Degraded | Returns empty tags array |
| PRD extraction (legacy) | ❌ Broken | Falls back to paragraph-splitting heuristic |
| Test sessions | ✅ Unaffected | No AI dependency |
| Bug tracking | ✅ Unaffected | No AI dependency |
| Jira integration | ✅ Unaffected | No AI dependency |
| Analytics/KPI | ✅ Unaffected | No AI dependency |
| Vision/Automation | ✅ Unaffected | ADB-based, no AI |
| Team management | ✅ Unaffected | No AI dependency |

**Conclusion:** ~70% of the app functions normally without AI. The AI-dependent features (test case generation, PRD Q&A) are power-user tools, not blocking core workflows.

---

## 22. Best AI Provider Recommendation

### For This Project: **Stay with Google Gemini Free Tier**

**Reasoning:**
1. **Cost:** $0/month — the free tier (1500 RPD) handles the expected load easily for an internal tool
2. **Performance:** `gemini-2.0-flash-lite` has excellent structured JSON output, critical for test case generation
3. **Reliability:** 99.9% uptime, fast response times (~1-3s)
4. **Context window:** 1M tokens — can handle any PRD size
5. **No migration needed** — already working

### If Scaling Beyond Free Tier:
- **Gemini Pay-as-you-go**: Still cheapest ($0.075/1M input tokens for flash-lite)
- **Groq**: Already configured as fallback — fast, affordable for inference
- **Ollama self-hosted**: Zero cost if you have GPU hardware — best for privacy-sensitive deployments

### NOT Recommended:
- OpenAI GPT-4: 10-50x more expensive, unnecessary for this use case
- Anthropic Claude: More expensive, no free tier
- AWS Bedrock: Complex setup, per-token billing, overkill for internal tool

---

## 23. Migration Plan: Switching Providers

### Phase 1: Abstract the Notes Route (1 hour)
1. Refactor `src/app/api/notes/generate-title/route.ts` to use `getAIProvider()` instead of direct Gemini call
2. Remove hardcoded API key

### Phase 2: Add New Provider (30 minutes)
1. Create new provider file (e.g., `src/lib/ai/providers/ollama.ts`)
2. Implement the `AIProvider` interface (just `askAI()` method)
3. Add to priority chain in `providers/index.ts`

### Phase 3: Update Environment (5 minutes)
1. Set the new provider's env vars
2. Optionally remove old provider keys

### Phase 4: Test (1 hour)
1. Test all 4 AI features: test gen, PRD chat, notes title, extract-prd
2. Verify JSON parsing still works with new model's output format
3. Adjust system prompts if structured output quality degrades

**Total effort: ~2.5 hours for a complete provider swap**

The `AIProvider` interface is deliberately minimal (one method: `askAI`), making migrations trivial. The most fragile part is JSON output quality — test case generation depends on the model reliably producing valid JSON arrays.

---

## 24. Summary of Actionable Recommendations

1. **🔴 Remove hardcoded API key** from `src/app/api/notes/generate-title/route.ts` — use env variable only
2. **🔴 Ensure `.env.local` is in `.gitignore`** — verify no secrets are committed
3. **🟡 Add application-level rate limiting** — protect against quota exhaustion by single user
4. **🟡 Unify notes AI route** to use the provider abstraction pattern
5. **🟢 Delete dead code** — remove `src/ai/flows/generate-test-cases-flow.ts`
6. **🟢 Add response caching** for repeated PRD queries (same page content)
7. **🟢 Consider persisting chat history** to Firestore for cross-session continuity

---

*Report complete. No project files were modified during this analysis.*
