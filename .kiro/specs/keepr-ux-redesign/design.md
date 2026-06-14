# Keepr UX Redesign — Design Spec

## Overview
Simplify the Keepr device management page into a clear, guided, visually beautiful experience.

## Current Problems
- Too many stats/cards/buttons on first view
- Filter bar is overwhelming (search + dropdown + 7 buttons + toggles)
- Accessories and devices mixed in one grid
- No clear user guidance
- "Sync Fleet" is technical jargon

## New Layout Structure

### Header (compact)
- Back to Dashboard button
- "Keepr" title + subtitle "QA Device Fleet"
- Quick status pills (3 max): Available · In Use · Missing
- ⚙️ Admin menu (dropdown): Add Device | Sync Fleet | Export

### Alert Banner (conditional)
- Only shows if overdue 24h+ or missing items exist
- Red/amber with clear "X device overdue — Alert Team" button

### Search + Filter (single row, minimal)
- Search input (full width mobile, left on desktop)
- Location dropdown (replace type filter — locations are more intuitive)
- Status pills (clickable: All | Available | In Use | Maintenance | Missing)

### Main Content: Location-Grouped View (default)
Each location is a collapsible section:
```
📍 QA Team Device Rack (5 devices, 2 accessories)
  ├── Oppo A78           🟢 Available     [QR] [Take]
  ├── Moto g31           🟢 Available     [QR] [Take]
  ├── Galaxy M32 5G      🔵 Saranya 2h    [QR] [Return]
  ├── 🔌 Lightning Cable  ⚠️ 1/2 missing
  └── 🔌 Type-B Cable     🔴 Missing

📍 iOS Team (8 devices, 4 accessories)
  ├── iPhone 12          🟢 Available (QA)
  ├── iPhone XR          🔵 Prasanth       [QR]
  ...

📍 Android Team (7 devices, 4 accessories)
  ...
```

### Tabs (after content)
- Devices (default) | History | Accessories

### Card Design (compact)
- One line per device: [Type Icon] [Name] [Status badge] [Assigned to] [QR] [Action]
- Expandable on click for full details (OS, RAM, condition, notes)
- No huge cards wasting space

### First-Visit Welcome (localStorage flag)
Shows a dismissable card:
"Welcome to Keepr! 👋
- Click QR to generate a scannable code for any device
- Tap 'Take' to checkout — 'Return' to bring it back
- Use the History tab to see who had what and when"

### Mobile-Friendly
- On mobile, each device row becomes a card
- QR button is large and prominent
- Swipe actions for checkout/return
