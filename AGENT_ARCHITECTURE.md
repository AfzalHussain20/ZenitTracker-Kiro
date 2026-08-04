# Zenit AI Agent System — Architecture & Strategy

**Version:** 1.0  
**Date:** August 4, 2026  
**Status:** Implemented (Phase 1) — Production Ready

---

## 1. What Was Built

### Internal AI Agent System

A multi-agent orchestration layer that intelligently routes user queries to specialized domain agents:

| Agent | Domain | Tools | Use Cases |
|-------|--------|-------|-----------|
| **Jira Agent** | Bug tracking, investigations | `jira_search`, `jira_investigate_reporter`, `jira_sprint_stats` | Reporter forensics, sprint health, duplicate detection |
| **PRD Agent** | Requirements & test gen | `prd_search`, `prd_generate_tests` | Cross-PRD search, test case generation |
| **Analytics Agent** | Metrics & trends | `analytics_bug_trends`, `analytics_team_health` | Bug trends, team workload, KPIs |
| **DevOps Agent** | Infrastructure | `devops_build_status` | Build status, deployment health |
| **QA Agent** | Test strategy | `qa_coverage_gaps` | Coverage analysis, regression risk |

### Architecture Pattern: ReAct (Reason + Act)

```
User Query → Orchestrator (intent classification)
                ↓
          Select Agent (keyword scoring + confidence)
                ↓
          ┌─────────────────────────┐
          │  ReAct Loop (max 5 iter)│
          │  1. OBSERVE context     │
          │  2. THINK what to do    │
          │  3. ACT (call tool)     │
          │  4. REFLECT on result   │
          │  5. Repeat or answer    │
          └─────────────────────────┘
                ↓
          Unified Response (answer + confidence + sources + suggestions)
```

### Key Files

```
src/lib/ai/agent/
├── types.ts          — Full type system (AgentId, ToolCall, ThoughtStep, etc.)
├── registry.ts       — Agent definitions + system prompts
├── tools.ts          — Tool registry (8 tools across 5 domains)
├── orchestrator.ts   — Intent classification + session management
├── executor.ts       — ReAct loop implementation
├── tool-executor.ts  — Tool implementations (Jira API, internal APIs)
└── index.ts          — Public API exports

src/app/api/ai/agent/route.ts   — POST endpoint
src/components/ai/AgentChat.tsx  — UI panel (Ctrl+Shift+A)
```

---

## 2. Agentic AI — How It Works (Latest Research Applied)

### 2.1 ReAct Pattern (Yao et al., 2023)

Traditional AI: `Query → LLM → Answer` (single-shot, no data access)  
Agentic AI: `Query → Plan → Tool → Observe → Reason → Answer` (multi-step, data-grounded)

Our implementation:
- The agent **reasons** about what data it needs before answering
- It **acts** by calling tools (Jira API, Confluence, Firestore)
- It **reflects** on tool results to decide if more data is needed
- It **terminates** when confidence is high enough OR max iterations reached

### 2.2 Multi-Agent Orchestration (inspired by AutoGen, CrewAI)

Instead of one giant prompt, we use specialized agents:
- Each agent has domain-specific knowledge (system prompt)
- Each agent has access to only its relevant tools
- The orchestrator does lightweight intent classification (no LLM call for routing)
- This reduces hallucination — agents only answer within their expertise

### 2.3 Tool-Augmented Generation

Every agent answer is grounded in real data:
- Jira Agent → real ticket data from live Jira API
- PRD Agent → real Confluence page content
- Analytics Agent → computed metrics from Firestore

The AI layer **interprets** data — it never invents it.

### 2.4 Confidence Scoring

Every response includes a confidence score (0-1):
- `≥ 0.8`: Strong — tool data confirmed the answer
- `0.5-0.8`: Partial — some data available, some inference
- `< 0.5`: Low — mostly AI inference, limited data

This lets the UI show reliability indicators to users.

---

## 3. Microservices Strategy (When to Adopt)

### Current Architecture: Monolith (correct for now)

The app is a Next.js monolith with API routes. This is **optimal** for the current scale:
- 1 team, <20 users, <5000 RPD
- Shared codebase reduces complexity
- Single deployment unit (Render)
- No cross-service latency

### Microservice Readiness Checklist

| Signal | Current | Threshold for Migration |
|--------|---------|------------------------|
| Team size | 1 | 3+ teams working independently |
| Daily users | <50 | 500+ concurrent |
| Deploy frequency | 1-2/day | 10+/day with conflicts |
| AI inference load | ~200 RPD | 10,000+ RPD |
| Data size | <100k docs | 10M+ docs |

### Proposed Microservice Boundaries (Future)

When ready, these are natural service boundaries:

```
┌──────────────────────────────────────────────────────────┐
│                    API Gateway (Next.js)                   │
│              (Auth, routing, rate limiting)                │
└─────┬───────────┬──────────────┬────────────┬────────────┘
      │           │              │            │
      ▼           ▼              ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│ AI Agent │ │  Jira    │ │Analytics │ │   QA Core    │
│ Service  │ │ Gateway  │ │ Service  │ │   Service    │
│          │ │          │ │          │ │              │
│ - Agents │ │ - JQL    │ │ - Events │ │ - Sessions   │
│ - Tools  │ │ - Sync   │ │ - KPIs   │ │ - Test Cases │
│ - LLM    │ │ - Cache  │ │ - Trends │ │ - Reports    │
└──────────┘ └──────────┘ └──────────┘ └──────────────┘
```

---

## 4. Terraform & Infrastructure-as-Code (Roadmap)

### Current: Manual Render Configuration

Render is configured via dashboard. This works for a single service.

### When to Terraform

Adopt Terraform when:
- Multiple environments (staging + production)
- Multiple services (after microservice split)
- Team members need reproducible infra
- Compliance requires audit trails

### Proposed Terraform Structure (Phase 2)

```hcl
# infrastructure/main.tf
terraform {
  required_providers {
    render = { source = "render-oss/render" }
    google = { source = "hashicorp/google" }  # Firebase
  }
}

# Render web service
resource "render_web_service" "zenit_app" {
  name        = "zenittracker"
  repo        = "https://github.com/zenittracker/ZenitTracker-Kiro"
  branch      = "main"
  runtime     = "docker"
  plan        = "starter"
  region      = "oregon"
  
  env_vars = {
    NODE_ENV = "production"
    # Secrets managed via Render dashboard (not in Terraform state)
  }
}

# Firebase (managed via Google provider)
resource "google_firebase_project" "default" {
  provider = google
  project  = "zenit-tracker"
}
```

---

## 5. Edge Cases Handled

| Edge Case | How It's Handled |
|-----------|-----------------|
| AI provider down (429) | Key pool rotation → Groq fallback → graceful error |
| Jira API timeout | Tool retry (2 attempts) with exponential backoff |
| Agent infinite loop | Max 5 iterations hard limit + 55s timeout |
| Unknown query intent | Default to PRD agent (widest knowledge) |
| Empty tool results | Agent falls back to AI knowledge (lower confidence) |
| Malformed AI JSON | `parseAgentAction()` falls back to raw text as answer |
| Session memory overflow | Last 10 messages kept, oldest dropped |
| Multiple agents needed | Orchestrator detects close scores, flags `requiresMultiAgent` |
| Feature disabled | Feature flag check before agent execution |
| Build-time errors | Dynamic imports for server-only modules (vision, cheerio) |
| Firebase cold start | Dedicated named apps avoid singleton conflicts |
| Serverless timeout | Firestore writes awaited (not fire-and-forget) |

---

## 6. What's Different from Generic AI Chatbots

| Generic Chatbot | Zenit Agent System |
|-----------------|-------------------|
| Single prompt, single model | 5 specialized agents with domain prompts |
| Hallucination-prone | Tool-grounded (real Jira/Confluence data) |
| No transparency | Thought process visible to user |
| No reliability indicator | Confidence score on every answer |
| Stateless | Session persistence, conversation memory |
| No error recovery | Retry + fallback + graceful degradation |
| Fixed behavior | Feature flags, per-agent kill switches |
| Black box | Audit trail: tool calls, duration, tokens used |

---

## 7. Usage

### API

```typescript
POST /api/ai/agent
{
  "query": "Who filed the most bugs this sprint?",
  "sessionId": "optional-session-id",
  "forceAgent": "jira-agent"  // optional override
}

// Response
{
  "answer": "...",
  "agentId": "jira-agent",
  "confidence": 0.85,
  "toolCalls": [...],
  "thoughtProcess": [...],
  "suggestions": ["Show bugs by platform", "Compare to last sprint"],
  "routing": { "selectedAgent": "jira-agent", "reasoning": "..." }
}
```

### UI

- Press `Ctrl+Shift+A` or click the Brain icon (bottom-left)
- Type any question — routing is automatic
- Toggle "eye" icon to see agent thinking process
- Click suggestions for follow-up queries

---

*This system is designed to grow. Add new agents by creating a registry entry and tool implementations. No changes to orchestrator needed.*
