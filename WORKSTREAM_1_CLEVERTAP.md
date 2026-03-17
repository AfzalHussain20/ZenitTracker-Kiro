# Workstream 1: CleverTap Enhancements - Quick Start

## 🎯 Your Mission
Implement the most advanced CleverTap validation system with smart sheet analysis and direct analytics integration.

---

## ✅ What's Already Done
- ✅ `src/lib/smartSheetAnalyzer.ts` - Complete smart sheet analysis engine
- ✅ Excel file verified at: `D:\Zenit Antigravity\In-House\public\SunNxt Data Dictionary.xlsx`
- ✅ Yes/No logic validation algorithm implemented

---

## 🚀 Step-by-Step Implementation

### Step 1: Integrate Smart Sheet Analyzer into UI (2-3 hours)

**File**: `src/app/(app)/dashboard/clevertap-tracker/page.tsx`

Add these features to the existing CleverTap page:

```typescript
import { loadDataDictionary, validateEvent, calculateValidationScore } from '@/lib/smartSheetAnalyzer';

// Add state for data dictionary
const [dataDictionary, setDataDictionary] = useState<SheetData[]>([]);
const [selectedSheet, setSelectedSheet] = useState<SheetData | null>(null);
const [selectedTitle, setSelectedTitle] = useState<TitleData | null>(null);
const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);

// Add load function
const handleLoadDataDictionary = async () => {
  try {
    const filePath = 'D:\\Zenit Antigravity\\In-House\\public\\SunNxt Data Dictionary.xlsx';
    const sheets = await loadDataDictionary(filePath);
    setDataDictionary(sheets);
    toast({ title: 'Success', description: `Loaded ${sheets.length} sheets` });
  } catch (error) {
    toast({ title: 'Error', description: error.message, variant: 'destructive' });
  }
};
```

### Step 2: Create Sheet Selector Component (1 hour)

**File**: `src/components/clevertap/SheetSelector.tsx`

```typescript
'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SheetData } from '@/lib/smartSheetAnalyzer';

interface SheetSelectorProps {
  sheets: SheetData[];
  onSelectSheet: (sheet: SheetData) => void;
}

export function SheetSelector({ sheets, onSelectSheet }: SheetSelectorProps) {
  return (
    <Select onValueChange={(value) => {
      const sheet = sheets.find(s => s.sheetName === value);
      if (sheet) onSelectSheet(sheet);
    }}>
      <SelectTrigger>
        <SelectValue placeholder="Select sheet..." />
      </SelectTrigger>
      <SelectContent>
        {sheets.map(sheet => (
          <SelectItem key={sheet.sheetName} value={sheet.sheetName}>
            {sheet.sheetName} ({sheet.titles.length} titles)
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### Step 3: Create Validation Results Component (2 hours)

**File**: `src/components/clevertap/ValidationResults.tsx`

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ValidationResult, calculateValidationScore } from '@/lib/smartSheetAnalyzer';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface ValidationResultsProps {
  results: ValidationResult[];
  title: string;
  eventName: string;
}

export function ValidationResults({ results, title, eventName }: ValidationResultsProps) {
  const score = calculateValidationScore(results);
  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Validation Results</span>
          <Badge className={score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'}>
            {score}% Score
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {title} - {eventName}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{results.length}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{passCount}</div>
              <div className="text-xs text-muted-foreground">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{failCount}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </div>

          {/* Failed Results */}
          {failCount > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                Failed Validations
              </h4>
              {results.filter(r => r.status === 'fail').map((result, i) => (
                <div key={i} className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200">
                  <div className="font-medium text-sm">{result.attribute}</div>
                  <div className="text-xs text-muted-foreground mt-1">{result.message}</div>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span>Expected: <strong>{result.expected}</strong></span>
                    <span>Actual: <strong>{result.actual}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Passed Results */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Passed Validations
            </h4>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {results.filter(r => r.status === 'pass').map((result, i) => (
                <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  {result.attribute}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Step 4: Update CleverTap Main Page (1 hour)

Add the new components to the In-House Validation modal:

```typescript
// In the In-House Analytics Modal
<Dialog open={isInHouseModalOpen} onOpenChange={setIsInHouseModalOpen}>
  <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>In-House Analytics Validator</DialogTitle>
      <DialogDescription>Smart validation with Yes/No logic</DialogDescription>
    </DialogHeader>
    <div className="space-y-4 py-4">
      {/* Load Data Dictionary Button */}
      <Button onClick={handleLoadDataDictionary} className="w-full">
        <FileJson className="w-4 h-4 mr-2" />
        Load SunNxt Data Dictionary
      </Button>

      {/* Sheet Selector */}
      {dataDictionary.length > 0 && (
        <SheetSelector 
          sheets={dataDictionary} 
          onSelectSheet={setSelectedSheet} 
        />
      )}

      {/* Title Selector */}
      {selectedSheet && (
        <Select onValueChange={(value) => {
          const title = selectedSheet.titles.find(t => t.id === value);
          if (title) setSelectedTitle(title);
        }}>
          <SelectTrigger>
            <SelectValue placeholder="Select title..." />
          </SelectTrigger>
          <SelectContent>
            {selectedSheet.titles.map(title => (
              <SelectItem key={title.id} value={title.id}>
                {title.name} ({title.events.length} events)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Validation Results */}
      {validationResults.length > 0 && (
        <ValidationResults 
          results={validationResults}
          title={selectedTitle?.name || ''}
          eventName={selectedTitle?.events[0]?.eventName || ''}
        />
      )}
    </div>
  </DialogContent>
</Dialog>
```

---

## 🧪 Testing Checklist

- [ ] Load Excel file successfully
- [ ] Display all sheets
- [ ] Select sheet and see titles
- [ ] Select title and see events
- [ ] Capture event and validate
- [ ] See pass/fail results
- [ ] Yes/No logic works correctly
- [ ] Export validation report

---

## 🎯 Success Criteria

✅ Excel file loads without errors  
✅ All sheets parsed correctly  
✅ Yes/No logic validation accurate  
✅ Validation score calculated  
✅ Results display clearly  
✅ Export functionality works  

---

## 📝 Next Steps

After completing this:
1. Move to **Task 7.2**: Direct Analytics Integration
2. Build Chrome extension for event capture
3. Implement live event feed

---

## 🆘 Need Help?

- Check `src/lib/smartSheetAnalyzer.ts` for all available functions
- Review `.kiro/specs/zenit-apps-complete-restoration/requirements.md` for Requirements 28-30
- Test with actual Excel file at the specified path

**You've got this! 🚀**
