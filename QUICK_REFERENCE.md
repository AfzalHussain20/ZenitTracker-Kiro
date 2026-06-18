# Quick Reference - KPI Dashboard Updates

## 🎯 What Changed?

### 1. Team Monthly Report (NEW)
**Location:** Analytics → Bugs → Teams → [Click Team]
**Shows:** Monthly breakdown for entire team

### 2. Member Monthly Report (UPDATED)
**Location:** Analytics → Bugs → Teams → [Click Team] → [Click Member] → Monthly Tab
**Changes:** 
- 4 columns → 6 columns
- Added Story Points with decimals
- Updated labels to: To-Do, Inprogress, Done

---

## 📊 New Column Layout

### Member & Team Monthly Reports (Both have same format):

| Column | Description | Example | Color |
|--------|-------------|---------|-------|
| **Reported** | Total bugs reported | 15 | Slate |
| **To-Do** | Open/not started | 2 | Red |
| **Inprogress** | Being worked on | 2 | Amber |
| **Done** | Completed/closed | 11 | Green |
| **Assigned** | Total assigned | 15 | Blue |
| **Story Points** | Effort (with decimals) | 12.5 | Violet |

---

## 🔍 Quick Access Paths

### Team Monthly Report
```
Analytics → Bugs → Teams → [Click any team] → Scroll down
```

### Member Monthly Report
```
Analytics → Bugs → Teams → [Click team] → [Click member] → Monthly tab
```

---

## 💡 Key Features

✅ **Exact Labels:** To-Do, Inprogress, Done (as requested)
✅ **Decimal Values:** Story points show 2.5, 3.0, 1.5
✅ **Team Aggregation:** Automatic calculation from all members
✅ **Color Coded:** Easy visual identification
✅ **Sorted:** Newest month first

---

## 📱 Works On

✅ Desktop
✅ Tablet
✅ Mobile

---

## 🧮 Calculations

### Inprogress
```
Inprogress = Assigned - To-Do - Done
```

### Close Rate
```
Close Rate = (Done / Reported) × 100%
```

### Story Points
- Shows decimal values (e.g., 2.5)
- Whole numbers show as "3" not "3.0"

---

## 🎨 Color Guide

| Status | Color | Meaning |
|--------|-------|---------|
| To-Do | 🔴 Red | Not started |
| Inprogress | 🟠 Amber | Active work |
| Done | 🟢 Green | Completed |
| Story Points | 🟣 Violet | Effort |

---

## ✅ Testing Checklist

- [ ] Team monthly report visible
- [ ] Member monthly report has 6 columns
- [ ] Labels: To-Do, Inprogress, Done
- [ ] Story points show decimals
- [ ] Colors are correct

---

## 📞 Need Help?

See full documentation:
- **USER_GUIDE_NEW_FEATURES.md** - User guide
- **IMPLEMENTATION_SUMMARY.md** - Technical details
- **FINAL_SUMMARY_FOR_PM.md** - PM summary

---

**Last Updated:** April 21, 2026
**Status:** Production Ready
