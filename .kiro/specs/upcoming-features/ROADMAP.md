# Zenit Feature Roadmap — Upcoming Phases

## Status: Phase 1 ✅ Complete | Phase 2-6 Planned

---

## Phase 2 — Global PRD AI Assistant (Cross-PRD Search)
**Priority:** HIGH  
**Effort:** 3-4 hours  
**Status:** 🔵 Next

### What it does:
A single AI chatbot that can answer questions across ALL Confluence PRDs — not just the one you're viewing. Ask "what's the subscription flow?" and it searches all PRDs to find the answer.

### Implementation:
1. New API route: `/api/ai/ask-global`
   - Fetches list of all Confluence pages
   - Uses semantic search to find relevant PRDs for the question
   - Aggregates context from top 3-5 matching PRDs
   - Sends to AI with multi-document context
2. New component: `GlobalAIChat.tsx`
   - Available on dashboard (not just Confluence page)
   - Shows which PRDs the answer came from
   - Clickable PRD links to jump to source
3. Firestore: `prd_index` collection
   - Caches page summaries + headings for fast search
   - Refreshes when pages are visited

### Files to create/modify:
- `src/app/api/ai/ask-global/route.ts` (NEW)
- `src/components/GlobalAIChat.tsx` (NEW)
- `src/app/(app)/layout.tsx` (add global chat)

---

## Phase 3 — Analytics Events Test Case Generator
**Priority:** HIGH  
**Effort:** 2-3 hours  
**Status:** 🟡 Planned

### What it does:
Generate platform-specific analytics event validation test cases from PRDs. Instead of generic functional test cases, these focus specifically on: "What events should fire? On which platform? With what fields?"

### Implementation:
1. New generation pass type: `analytics`
2. New system prompt that extracts:
   - Event names from PRD (fire_event, track_action patterns)
   - Required fields per platform
   - OpenSearch/DQL queries to validate each event
3. New tab in TestCaseReviewPanel: "Analytics Events"
4. Each test case includes:
   - Event name
   - Platform
   - Required fields with expected values
   - Ready-to-copy OpenSearch query

### Files to create/modify:
- `src/lib/ai/testCaseGenerator.ts` (add analytics pass)
- `src/app/api/ai/generate-tests/route.ts` (accept 'analytics' pass)
- `src/types/test-cases.ts` (add AnalyticsTestCase type)

---

## Phase 4 — AI-Powered Jira KPI Chat
**Priority:** MEDIUM  
**Effort:** 3-4 hours  
**Status:** 🟡 Planned

### What it does:
Natural language queries on Jira data. Ask "how many bugs were filed this sprint?" or "what's our resolution rate for P1 bugs?" and get instant AI-summarized answers with data.

### Implementation:
1. New API route: `/api/ai/jira-insights`
   - Fetches relevant Jira data based on question type
   - AI summarizes and presents findings
2. Integration with existing Jira KPI analytics page
3. Chat panel on the analytics page

### Files to create/modify:
- `src/app/api/ai/jira-insights/route.ts` (NEW)
- `src/app/(app)/analytics/bugs/page.tsx` (add chat panel)

---

## Phase 5 — PRD Categorization & Organization
**Priority:** MEDIUM  
**Effort:** 1-2 hours  
**Status:** 🟡 Planned

### What it does:
Auto-tag and categorize Confluence PRDs by feature area, platform, and module. Makes it easier to find relevant PRDs and see coverage.

### Implementation:
1. When a PRD is first opened, AI categorizes it
2. Categories stored in Firestore: `prd_metadata` collection
3. Filter PRDs by category on the Confluence page
4. Show category badges on PRD cards

---

## Phase 6 — CleverTap/In-House Enhancements
**Priority:** HIGH (waiting on PM input for OpenSearch access)  
**Effort:** Variable (2-6 hours depending on OpenSearch availability)  
**Status:** ⏳ Waiting for PM response

### Sub-features:
1. **AI-Generated OpenSearch Queries** — For each event, auto-generate the DQL query
2. **Session persistence to Firestore** — Save validation sessions server-side
3. **Event coverage matrix** — Grid: Events × Platforms (validated/pending/failed)
4. **Direct OpenSearch integration** (if API access available)
5. **Generate analytics test cases from Data Dictionary**

### Dependencies:
- OpenSearch REST API access (URL, credentials, index pattern)
- Confirmation from PM on network accessibility

---

## Phase 7 — Live Streaming Generation
**Priority:** LOW  
**Effort:** 2-3 hours  
**Status:** 🟡 Planned (nice-to-have)

### What it does:
Instead of waiting for the full AI response, show test cases appearing one by one as they stream in. Server-Sent Events (SSE) from the API.

### Why LOW priority:
With the key pool (141K calls/day) and single-shot generation, responses come back in 5-10 seconds. Streaming adds complexity for marginal UX improvement.

---

## Completed Phases

### Phase 1 ✅ — Core Fixes
- [x] Cancel generation button
- [x] Balanced category distribution (all 5 categories populated)
- [x] 17 API keys in rotation pool (141,600 RPD)
- [x] Fullscreen review panel
- [x] Button collision fix
- [x] AI Chat UI redesign
- [x] Clean response formatting
- [x] Groq auto-fallback on Gemini quota

---

## How to execute in next sessions:
1. Start a new chat session per phase
2. Reference this file: `.kiro/specs/upcoming-features/ROADMAP.md`
3. Say: "Build Phase X from the roadmap"
