# Visual Filter Guide - What to Expect

## Filter Highlighting Examples

### Time Period Buttons

**Before (Not Selected):**
```
[ Overall ] [ Current Month ] [ Previous Month ] [ Last 7 Days ] [ Last 30 Days ]
  ↑ White background, gray border
```

**After (Selected):**
```
[ Overall ] [ Current Month ] [ Previous Month ] [ Last 7 Days ] [ Last 30 Days ]
  ↑ Blue background, white text, shadow + ring effect
```

### Dropdown Filters

**Before (All/Default):**
```
┌─────────────────┐
│ All Reporters ▼ │  ← Gray border, white background
└─────────────────┘
```

**After (Filter Selected):**
```
┌─────────────────┐
│ Arun Kumar    ▼ │  ← Primary blue border, light blue background, bold text
└─────────────────┘
```

## How It Works

### 1. Time Period Filter
- Click any time period button (Overall, Current Month, etc.)
- Selected button will:
  - Change to blue background
  - Show white text
  - Display shadow effect
  - Show ring around the button
- Only ONE time period can be selected at a time

### 2. Dropdown Filters (Reporter, Type, Status, Priority)
- When you select anything other than "All"
- The dropdown will:
  - Show primary blue border (instead of gray)
  - Display light blue background tint
  - Text becomes bold/medium weight
- Multiple dropdowns can be active at the same time

### 3. Clear Filters Button
- Appears automatically when ANY filter is active
- Click to reset all filters to "All"
- Button disappears when no filters are active

## Visual States

### No Filters Active
```
Time Period: [ Overall* ] [ Current Month ] [ Previous Month ] ...
Filters: [All Reporters▼] [All Types▼] [All Status▼] [All Priority▼]
         ↑ All gray borders, white backgrounds
```

### Multiple Filters Active
```
Time Period: [ Overall ] [ Current Month* ] [ Previous Month ] ...
                          ↑ Blue background, shadow
Filters: [Arun Kumar▼] [Bug▼] [All Status▼] [High▼] [Clear Filters]
         ↑ Blue border  ↑ Blue  ↑ Gray       ↑ Blue  ↑ Appears when
           Blue bg      border    border      border    filters active
                        Blue bg               Blue bg
```

## Color Coding

- **Selected Time Period:** Blue (#primary color)
- **Active Dropdown Filter:** Blue border + light blue background
- **Inactive/Default:** Gray border + white background
- **Clear Filters Button:** Ghost variant (transparent)

## Accessibility

- Clear visual distinction between active and inactive states
- Color + shape changes (not just color)
- Shadow and ring effects for additional visual cues
- Bold text for active filters
