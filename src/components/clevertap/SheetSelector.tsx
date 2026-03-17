'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SheetData } from '@/lib/smartSheetAnalyzer';
import { Card, CardContent } from '@/components/ui/card';
import { FileSpreadsheet } from 'lucide-react';

interface SheetSelectorProps {
  sheets: SheetData[];
  selectedSheet: SheetData | null;
  onSelectSheet: (sheet: SheetData) => void;
}

export function SheetSelector({ sheets, selectedSheet, onSelectSheet }: SheetSelectorProps) {
  if (sheets.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Select Sheet
          </label>
          <Select 
            value={selectedSheet?.sheetName || ''} 
            onValueChange={(value) => {
              const sheet = sheets.find(s => s.sheetName === value);
              if (sheet) onSelectSheet(sheet);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a sheet from the data dictionary..." />
            </SelectTrigger>
            <SelectContent>
              {sheets.map(sheet => (
                <SelectItem key={sheet.sheetName} value={sheet.sheetName}>
                  {sheet.sheetName} ({sheet.titles.length} titles)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
