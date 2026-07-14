# Zenit Feature Roadmap — Upcoming Phases

## Status: Phases 1-7 ✅ Complete (Phase 6 OpenSearch integration pending PM input)

---

## Phase 2 — Global PRD AI Assistant (Cross-PRD Search)
**Priority:** HIGH  
**Effort:** 3-4 hours  
**Status:** ✅ Complete

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
**Status:** ✅ Complete

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
**Status:** ✅ Complete

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
**Status:** ✅ Complete

### What it does:
Auto-tag and categorize Confluence PRDs by feature area, platform, and module. Makes it easier to find relevant PRDs and see coverage.

### Implementation:
1. When a PRD is first opened, AI categorizes it
2. Categories stored in Firestore: `prd_metadata` collection
3. Filter PRDs by category on the Confluence page
4. Show category badges on PRD cards

---

## Phase 6 — CleverTap/In-House Enhancements
**Priority:** HIGH  
**Effort:** Variable  
**Status:** ✅ Complete (non-OpenSearch features shipped; direct integration waiting on PM)

### Sub-features:
1. ✅ **AI-Generated OpenSearch Queries** — shipped in Phase 3 (AnalyticsEventsPanel)
2. ✅ **Session persistence to Firestore** — `/api/clevertap/sessions` POST/GET; auto-saves on Phase 1 export
3. ✅ **Event coverage matrix** — `EventCoverageMatrix` component; accessible from In-House modal → Coverage Matrix
4. ⏳ **Direct OpenSearch integration** — waiting on PM for API access (URL, credentials, index pattern)
5. ✅ **Generate analytics test cases from Data Dictionary** — `/api/ai/generate-from-dictionary`

---

## Phase 7 — Live Streaming Generation
**Priority:** LOW  
**Effort:** 2-3 hours  
**Status:** ✅ Complete

### What it does:
Instead of waiting for the full AI response, show test cases appearing one by one as they stream in. Server-Sent Events (SSE) from the API.

### Why LOW priority:
With the key pool (141K calls/day) and single-shot generation, responses come back in 5-10 seconds. Streaming adds complexity for marginal UX improvement.

---

## Completed Phases

### Phase 7 ✅ — Live Streaming Generation
- [x] SSE API route: `/api/ai/generate-tests-stream` streams test case batches as they generate
- [x] `useStreamingGeneration` hook — consumes SSE, accumulates batches, exposes progress/error/complete state
- [x] "Stream Live" button on Confluence PRD view (alongside standard "Generate Test Cases")
- [x] Live progress bar showing current pass + running total
- [x] Batch arrival cards showing how many cases arrived per pass in real time
- [x] Auto-merges completed stream into the review panel and saves to Firestore
- [x] Cancel stream button mid-generation

### Phase 6 ✅ — CleverTap/In-House Enhancements
- [x] API route: `/api/clevertap/sessions` — POST saves validation sessions to Firestore `clevertap_sessions`; GET fetches history
- [x] Auto-save on Phase 1 Excel export — session persisted with event results and coverage
- [x] `EventCoverageMatrix` component — Events × Platforms grid (validated/pending/failed) with progress bar and CSV export
- [x] Coverage Matrix phase in In-House modal — builds matrix from Phase 1 & Phase 2 results; manual save to Firestore
- [x] API route: `/api/ai/generate-from-dictionary` — generates analytics test cases from structured Data Dictionary events
- [x] AI-enhanced generation for ≤15 events; structured generation for larger dictionaries
- [x] OpenSearch query generation already shipped in Phase 3 (AnalyticsEventsPanel)
- ⏳ Direct OpenSearch integration — waiting on PM for API access

### Phase 5 ✅ — PRD Categorization & Organization
- [x] API route: `/api/ai/categorize-prd` — auto-categorizes PRDs by feature area, platform, module
- [x] Firestore `prd_metadata` collection for persistent category storage
- [x] Auto-categorization triggered when a PRD is first opened
- [x] Category badges on PRD cards (feature area + platform pills)
- [x] Category filter dropdown on the Confluence browse page
- [x] GET endpoint to bulk-fetch all metadata for browse view
- [x] Graceful fallback if AI categorization fails

### Phase 4 ✅ — AI-Powered Jira KPI Chat
- [x] API route: `/api/ai/jira-insights` — NL queries on Jira data
- [x] Smart JQL builder from natural language questions
- [x] Fetches real-time Jira data (up to 500 issues per query)
- [x] Summarizes data for AI context (status, priority, assignee, reporter breakdown)
- [x] JiraInsightsChat floating component on the KPI dashboard
- [x] Quick suggestion buttons for common queries
- [x] Shows issue count per response
- [x] Conversation history for follow-up questions

### Phase 3 ✅ — Analytics Events Test Case Generator
- [x] New `analytics` pass type in GenerationPass union
- [x] AnalyticsTestCase type with eventName, platform, fields, openSearchQuery
- [x] Analytics-specific system prompt extracting all trackable events from PRDs
- [x] parseAnalyticsResponse() parser with validation
- [x] generateAnalyticsTestCases() orchestrator function
- [x] API route accepts 'analytics' pass with separate response shape
- [x] AnalyticsEventsPanel component with expandable event cards
- [x] Ready-to-copy OpenSearch/DQL queries per event
- [x] Platform filter, priority filter, search
- [x] JSON export
- [x] New "Analytics Events" tab in Confluence page view

### Phase 2 ✅ — Global PRD AI Assistant
- [x] API route: `/api/ai/ask-global` — cross-PRD search with multi-document context
- [x] Semantic search via keyword scoring against PRD index
- [x] Firestore `prd_index` collection for cached page summaries
- [x] GlobalAIChat floating component on dashboard
- [x] Source PRD attribution with clickable links
- [x] Auto-indexes Confluence pages on first query
- [x] Keyboard shortcut: Ctrl+Shift+G

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
