# Test Session Execution Page - Complete Rebuild Guide

## Overview
Rebuild `src/app/(app)/dashboard/session/[sessionId]/page.tsx` from scratch with a modern, single-panel focused layout. Remove the 3-column design and create a card-based test execution flow.

## Key Design Decisions

### Layout
- **Single-panel focused layout** — NO 3-column split
- Card-based flow: one test case visible at a time as a full-width card
- Verdict buttons at the bottom of the card (not a separate panel)
- Sidebar is a collapsible overlay drawer (not always visible)
- Clean, spacious, premium feel (think Linear/Notion quality)

### Statuses (Simplified)
- **Pass** — test passed
- **Fail** — test failed (requires bug ID)
- **N/A** — not applicable (requires reason)
- ~~Fail (Known)~~ — REMOVED entirely

### Features to Include
1. **Single focused card per test case** — large, readable, scrollable
2. **Verdict buttons at card bottom** — Pass (green), Fail (red), N/A (gray)
3. **Keyboard shortcuts** — P=Pass, F=Fail, N=N/A, Left/Right arrows to navigate
4. **Timer per test case** — starts when test case appears, shows elapsed time
5. **On Fail: Bug ID input with auto-fetch** — when user types a Jira bug ID (e.g., SN-1234), auto-fetch the bug title from Jira API and display it
6. **Test bed grouping** — group test cases by testBed in the sidebar drawer
7. **Compact progress bar** at the top (horizontal strip)
8. **Session stats** — Pass/Fail/N/A/Remaining counts in a minimal header
9. **Auto-advance** — after marking a verdict, auto-advance to next untested case
10. **Swipe gestures** for mobile (swipe right = next, swipe left = previous)

### Results/Report Page Enhancement
File: `src/app/(app)/dashboard/session/[sessionId]/results/page.tsx`
- For failed test cases, show the **Bug ID as a clickable hyperlink** to Jira
- Format: `[SN-1234] Bug Title` linking to `https://{jira-domain}/browse/SN-1234`
- Fetch bug titles from Jira API when loading results

### Jira Integration on Fail
- When user types a Bug ID (e.g., "SN-1234"):
  1. Auto-fetch bug title from Jira API: `GET /api/jira/issue/{issueKey}`
  2. Display: "SN-1234 — Subscription popup not showing on TV"
  3. Store both `bugId` and `bugTitle` on the test case
- Alternatively, user can click "Create Bug" to push a new Jira issue (existing feature, keep it)

### Data Model Changes
In `src/types/index.ts`, update `TestCase`:
- Remove `"Fail (Known)"` from `TestCaseStatus` type
- Add optional `bugTitle?: string` field

### UI Design Spec

#### Header (slim, 48px)
```
[← Back] [Platform: Android TV] [████████ 65%] [P:12 F:3 N:2 Left:8] [Finish]
```

#### Main Card (centered, max-width 720px)
```
┌─────────────────────────────────────────────┐
│ TC-001  · High · Module: [Web] Subscription │
│                                    ⏱ 0:32   │
├─────────────────────────────────────────────┤
│                                             │
│  Test Scenario                              │
│  "Verify logged-in user sees subscription   │
│   popup when clicking paid content"         │
│                                             │
│  ─── Steps ───                              │
│  1. Log in with valid credentials           │
│  2. Navigate to a paid content page         │
│  3. Click "Play"                            │
│  4. Verify popup appears                    │
│                                             │
│  ─── Expected Result ───                    │
│  Subscription-required popup is displayed   │
│  with SMS/Email trigger                     │
│                                             │
│  ─── Actual Result (editable) ───           │
│  [textarea]                                 │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  [  ✓ Pass  ]  [  ✗ Fail  ]  [  — N/A  ]  │
│     (P)            (F)           (N)        │
│                                             │
└─────────────────────────────────────────────┘
     [← Prev]                      [Next →]
```

#### Fail Dialog
```
┌──────────────────────────────────┐
│  Log Bug                         │
│                                  │
│  Bug ID: [SN-1234          ]     │
│  ↳ "Subscription popup missing"  │ ← auto-fetched title
│                                  │
│  Description (optional):         │
│  [textarea                    ]  │
│                                  │
│  [Create in Jira]  [Confirm Fail]│
└──────────────────────────────────┘
```

### File Structure
- `src/app/(app)/dashboard/session/[sessionId]/page.tsx` — REWRITE completely
- `src/app/(app)/dashboard/session/[sessionId]/results/page.tsx` — UPDATE for Jira links
- `src/types/index.ts` — UPDATE TestCaseStatus type
- `src/app/api/jira/issue/[key]/route.ts` — NEW: fetch single issue details

### Technical Notes
- Use `framer-motion` for card transitions (already a dependency)
- Use `lucide-react` for icons (already imported)
- Keep Firestore sync logic (already working)
- Keep the existing session loading from both `sessions` and `testSessions` collections
- The entrance animation is nice — keep a simpler version

### Priority Order
1. Core execution flow (single card, verdict buttons, auto-advance)
2. Timer + keyboard shortcuts
3. Jira bug ID auto-fetch on Fail
4. Results page with Jira links
5. Sidebar drawer with test bed grouping
6. Mobile swipe gestures
