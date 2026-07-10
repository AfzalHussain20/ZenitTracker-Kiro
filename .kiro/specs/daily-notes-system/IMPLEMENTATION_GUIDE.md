# Implementation Guide — Next Session

## What to build (priority order)

### 1. Global Notes Widget (floating icon on every page)
- A small 📝 icon fixed at bottom-right corner of every page
- Click → expands into a quick-note panel (not full page)
- Full notes page at `/notes` for browsing all notes
- Add to the app layout (`src/app/(app)/layout.tsx`) so it appears everywhere

### 2. Notes Page (`/notes`)
- Timeline view with date groups
- Create/edit/delete notes
- Rich markdown editor with:
  - Table insertion (button or /table command)
  - Code blocks with auto-indent + syntax highlighting
  - Checkboxes
  - Auto-save
- AI title generation (Gemini API key: AIzaSyCo3zdevDyNmxk_2boEynXB90JMwdpc-HA)
- Search by keyword
- Filter by date, category, tags

### 3. Bug Creation from Test Session
- In `src/app/(app)/dashboard/session/[sessionId]/page.tsx`
- When user marks FAIL, show "Report Bug" button
- Bug creation form already exists (`showJiraForm` state)
- ADD: After bug is created OR if linking existing bug:
  - Show "Map Bug to Test Case" dialog
  - Search existing bugs by key (SUN-XXXX) or keyword
  - Select one or multiple bugs
  - Confirm button saves the mapping
  - Display mapped bugs on the test case card

### 4. Multi-Bug Mapping on Fail
- Current: user enters one `bugId` in the fail dialog
- NEW: Change to a list — user can add multiple bug IDs
- Each bug shows fetched title from Jira
- All mapped bugs saved to `testCase.linkedBugs: string[]`
- In results page, show all linked bugs per test case

### 5. Navigation — Add "Notes" to sidebar/nav
- Add `/notes` to the app navigation
- Show note count badge if there are today's notes

## Files to modify:
- `src/app/(app)/layout.tsx` — add floating notes widget
- `src/app/(app)/notes/page.tsx` — NEW: full notes page
- `src/app/api/notes/route.ts` — NEW: notes CRUD API
- `src/app/api/notes/[id]/route.ts` — NEW: single note API
- `src/app/(app)/dashboard/session/[sessionId]/page.tsx` — bug mapping enhancement
- `src/types/index.ts` — add Note type, update TestCase with linkedBugs

## Firebase Collections:
- `zenit_notes` — all notes
- Update `testCases[].linkedBugs` field in session documents

## User's Gemini API Key:
AIzaSyCo3zdevDyNmxk_2boEynXB90JMwdpc-HA

## User Instructions for next session:
"Build the Daily Notes feature. The spec is at `.kiro/specs/daily-notes-system/design.md` and the implementation guide is at `.kiro/specs/daily-notes-system/IMPLEMENTATION_GUIDE.md`. Start with the floating notes widget in the layout, then build the full notes page with rich editor, then the API. After that, enhance the test session page with multi-bug mapping."
