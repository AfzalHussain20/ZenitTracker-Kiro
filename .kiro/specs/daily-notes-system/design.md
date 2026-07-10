# Zenit Daily Notes — Complete Feature Spec

## The Problem
PM notes things daily — meeting decisions, to-dos, observations, ideas, quick references — then forgets where he wrote them. Scattered across Notepad, Teams messages, random files. Needs a single searchable place inside Zenit that's always accessible.

## Core Requirements
1. Save notes with date automatically
2. Auto-generate title from content context (AI-powered)
3. Searchable by keywords, date, context
4. Accessible anywhere (web, mobile responsive)
5. Rich text support (tables, code blocks, formatting)
6. Quick capture — zero friction to start writing

---

## Feature Design

### Note Structure (Firestore schema)
```
zenit_notes/{noteId}
  id:          "note_1720000000000"
  title:       "Sprint Planning Decisions — Android Release" (AI-generated)
  content:     "..." (rich text / markdown)
  plainText:   "..." (searchable plain text version)
  tags:        ["sprint", "android", "release"]  (AI-suggested)
  createdAt:   "2026-07-10T10:30:00Z"
  updatedAt:   "2026-07-10T14:22:00Z"
  userId:      "afzal.hussain"
  userName:    "Afzal Hussain"
  pinned:      false
  archived:    false
  category:    "meeting" | "todo" | "idea" | "reference" | "bug" | "general"
  linkedBugs:  ["SUN-1234", "SUN-5678"]  (optional Jira links)
  linkedSession: "session_abc"  (optional test session link)
```

### AI Features (using Gemini API you already have)
1. **Auto-title generation** — when note has 50+ chars and no manual title, call Gemini:
   "Generate a short 5-8 word title for this note: {content}"
2. **Smart tags** — extract keywords: "Extract 3-5 tags from: {content}"
3. **Smart search** — when user searches "that thing about android release date", 
   Gemini finds the note even if exact keywords don't match
4. **Daily summary** — end of day, generate "Today you noted 3 things: ..."
5. **Category detection** — auto-classify: is this a to-do, a meeting note, a bug, an idea?

### Rich Editor Features
- **Markdown support** with live preview
- **Table creation** — `/table 3x4` or a button to insert table grid
- **Code blocks** with syntax highlighting + auto-indentation
- **Checkbox lists** — `[ ] Buy milk` becomes interactive checkboxes
- **Date stamps** — auto-insert current date/time with shortcut
- **Slash commands** — `/table`, `/code`, `/todo`, `/bug`, `/link`
- **Image paste** — paste screenshots directly into notes
- **@mentions** — tag team members for reference

### Search System
- **Full-text search** on plainText field
- **Date range filter** — "notes from last week"
- **Tag filter** — click any tag to see related notes
- **Category filter** — show only "todo" or only "meeting" notes
- **AI semantic search** — "find the note about deployment issues" matches even if you wrote "production bug fix"

### Views
1. **Timeline view** (default) — today's notes at top, scrollable feed by date
2. **Calendar view** — monthly calendar, dots on days with notes, click to expand
3. **Board view** — kanban-style: To-Do | In Progress | Done (for task notes)
4. **All Notes** — searchable, sortable list

### Quick Capture Modes
- **Floating button** on every Zenit page — click to pop open a quick note input
- **Keyboard shortcut** — `Ctrl+Shift+N` opens quick capture
- **Voice note** (future) — record and auto-transcribe

### Edge Cases Handled
- Note with no content → don't save (ignore empty)
- Very long note (5000+ words) → paginate/collapse in list view
- Duplicate detection → if content is 90% same as existing note within 5 min, warn
- Offline support → save to localStorage, sync when online
- Concurrent edits → last-write-wins with conflict notification
- Note deletion → soft delete (archive first, permanent delete after 30 days)
- Title generation fails → use first 50 chars as title fallback
- Search returns 0 results → suggest "Did you mean?" with fuzzy matches

---

## UI Layout

### Notes Page (`/notes`)
```
┌─────────────────────────────────────────────────┐
│ 📝 Daily Notes          [+ New Note] [🔍 Search] │
│─────────────────────────────────────────────────│
│ [Timeline] [Calendar] [Board] [All]              │
│─────────────────────────────────────────────────│
│ 📅 Today — July 10, 2026                         │
│ ┌──────────────────────────────────────────────┐│
│ │ Sprint Planning Decisions — Android Release   ││
│ │ #sprint #android #release    10:30 AM         ││
│ │ "Decided to push release to next week..."     ││
│ └──────────────────────────────────────────────┘│
│ ┌──────────────────────────────────────────────┐│
│ │ Bug triage notes                              ││
│ │ #bugs #triage    2:15 PM                      ││
│ │ "SUN-4521 is critical, assign to Prasanth..." ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ 📅 Yesterday — July 9, 2026                      │
│ ┌──────────────────────────────────────────────┐│
│ │ Device allocation meeting                     ││
│ │ ...                                           ││
│ └──────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### Note Editor (full page or modal)
```
┌─────────────────────────────────────────────────┐
│ [← Back]     Auto-saved ✓     [🏷️ Tags] [📌 Pin]│
│─────────────────────────────────────────────────│
│ Title: Sprint Planning Decisions (auto/manual)   │
│─────────────────────────────────────────────────│
│ [B] [I] [U] [H1] [H2] [📋] [</>] [📊] [☑]      │
│─────────────────────────────────────────────────│
│                                                  │
│ Notes content here...                            │
│                                                  │
│ | Column 1 | Column 2 | Column 3 |              │
│ |----------|----------|----------|              │
│ | Data     | Data     | Data     |              │
│                                                  │
│ ```javascript                                    │
│ const x = await fetch('/api/...');               │
│ ```                                              │
│                                                  │
│ - [x] Review PR #234                             │
│ - [ ] Deploy to staging                          │
│ - [ ] Update test cases                          │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## Technical Implementation Plan

### Phase 1 — Core (MVP)
- Firestore collection `zenit_notes`
- API routes: `/api/notes` (GET list, POST create)
- API routes: `/api/notes/[id]` (GET, PATCH, DELETE)
- Notes page with timeline view
- Basic markdown editor (use `@uiw/react-md-editor` or `tiptap`)
- Search by title/content
- Auto-save (debounced 2s)
- Date grouping

### Phase 2 — AI + Rich Features
- Gemini API integration for title generation
- Tag extraction
- Category detection
- Semantic search
- Table insertion UI
- Code block with syntax highlighting

### Phase 3 — Advanced
- Calendar view
- Board/Kanban view
- Floating quick-capture button
- Linked bugs from Jira
- Export to PDF/Markdown
- Share note with team member

---

## Integration with Test Sessions
- When creating a bug in a test session, option to "Add to today's notes"
- Test session summary auto-creates a note: "Tested X — 3 pass, 2 fail, 1 bug created"
- Notes can reference test sessions: "See session from July 8"

## Editor Features — Detailed

### Table Support
- Button to insert table (specify rows × cols)
- Tab key moves between cells
- Add/remove rows and columns
- Auto-width columns
- Markdown table syntax rendered visually

### Code Blocks
- Triple backtick (```) auto-creates code block
- Language selector dropdown (JS, Python, Java, SQL, etc.)
- Auto-indentation on Enter
- Tab inserts 2/4 spaces
- Syntax highlighting in preview
- Copy button on hover

### Slash Commands
Type `/` anywhere to get:
- `/table` → Insert table
- `/code` → Insert code block
- `/todo` → Insert checkbox list
- `/date` → Insert current date/time
- `/bug SUN-1234` → Link to Jira bug
- `/divider` → Horizontal rule
- `/heading` → H1/H2/H3
- `/quote` → Blockquote
