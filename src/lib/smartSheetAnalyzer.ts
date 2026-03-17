/**
 * Smart Sheet Analyzer for CleverTap In-House Validation
 * 
 * This module implements intelligent Excel parsing with Yes/No logic:
 * - "Yes" in column → Expect actual values (not NA/null/blank)
 * - "No" in column → Expect only "NA" as valid value
 * 
 * Excel Path: D:\Zenit Antigravity\In-House\public\SunNxt Data Dictionary.xlsx
 */

import * as XLSX from 'xlsx';

export interface SheetColumn {
  name: string;
  index: number;
  hasYesNoLogic: boolean;
  yesNoColumnIndex?: number;
}

export interface ValidationRule {
  attribute: string;
  expectActualValue: boolean; // true if "Yes", false if "No"
  sheet: string;
  title: string;
}

export interface ValidationResult {
  attribute: string;
  expected: 'actual-value' | 'na-only';
  actual: string;
  status: 'pass' | 'fail';
  message: string;
}

export interface SheetData {
  sheetName: string;
  titles: TitleData[];
  columns: SheetColumn[];
}

export interface TitleData {
  id: string;
  name: string;
  events: EventData[];
}

export interface EventData {
  eventName: string;
  attributes: AttributeData[];
}

export interface AttributeData {
  name: string;
  expectActualValue: boolean;
  expectedValue?: string;
}

/**
 * Load and parse the SunNxt Data Dictionary Excel file
 */
export async function loadDataDictionary(filePath: string): Promise<SheetData[]> {
  try {
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const sheets: SheetData[] = [];

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length === 0) continue;

      // Identify columns
      const headerRow = jsonData[0];
      const columns = identifyColumns(headerRow);

      // Parse sheet data
      const sheetData: SheetData = {
        sheetName,
        titles: parseSheetTitles(jsonData, columns),
        columns
      };

      sheets.push(sheetData);
    }

    return sheets;
  } catch (error) {
    console.error('Error loading data dictionary:', error);
    throw new Error(`Failed to load data dictionary: ${error}`);
  }
}

/**
 * Identify columns and detect Yes/No logic columns
 */
function identifyColumns(headerRow: any[]): SheetColumn[] {
  const columns: SheetColumn[] = [];
  
  headerRow.forEach((header, index) => {
    const headerStr = String(header || '').toLowerCase();
    
    // Check if this is a Yes/No indicator column
    const hasYesNoLogic = headerStr.includes('yes') || 
                          headerStr.includes('no') || 
                          headerStr.includes('applicable') ||
                          headerStr.includes('required');

    columns.push({
      name: String(header || `Column_${index}`),
      index,
      hasYesNoLogic
    });
  });

  // Link attribute columns to their Yes/No columns
  columns.forEach((col, i) => {
    if (!col.hasYesNoLogic) {
      // Look for Yes/No column to the right
      for (let j = i + 1; j < Math.min(i + 3, columns.length); j++) {
        if (columns[j].hasYesNoLogic) {
          col.yesNoColumnIndex = j;
          break;
        }
      }
    }
  });

  return columns;
}

/**
 * Parse sheet data into structured titles and events
 */
function parseSheetTitles(data: any[][], columns: SheetColumn[]): TitleData[] {
  const titles: TitleData[] = [];
  let currentTitle: TitleData | null = null;
  let currentEvent: EventData | null = null;

  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // Detect title row (usually first column has value, others might be empty)
    if (row[0] && !row[1]) {
      if (currentTitle) {
        titles.push(currentTitle);
      }
      currentTitle = {
        id: `title_${i}`,
        name: String(row[0]),
        events: []
      };
      currentEvent = null;
      continue;
    }

    // Detect event row
    if (row[0] && row[1] && currentTitle) {
      if (currentEvent) {
        currentTitle.events.push(currentEvent);
      }
      currentEvent = {
        eventName: String(row[1]),
        attributes: []
      };
      continue;
    }

    // Parse attribute rows
    if (currentEvent && row[2]) {
      const attributeName = String(row[2]);
      const yesNoColumn = columns[2].yesNoColumnIndex;
      
      let expectActualValue = true; // default
      if (yesNoColumn !== undefined) {
        const yesNoValue = String(row[yesNoColumn] || '').toLowerCase();
        expectActualValue = yesNoValue === 'yes' || yesNoValue === 'y' || yesNoValue === 'true';
      }

      currentEvent.attributes.push({
        name: attributeName,
        expectActualValue,
        expectedValue: row[3] ? String(row[3]) : undefined
      });
    }
  }

  // Push last title and event
  if (currentEvent && currentTitle) {
    currentTitle.events.push(currentEvent);
  }
  if (currentTitle) {
    titles.push(currentTitle);
  }

  return titles;
}

/**
 * Validate captured event against expected attributes
 */
export function validateEvent(
  expectedAttributes: AttributeData[],
  actualParams: Record<string, string>
): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const attr of expectedAttributes) {
    const actualValue = actualParams[attr.name];
    const result: ValidationResult = {
      attribute: attr.name,
      expected: attr.expectActualValue ? 'actual-value' : 'na-only',
      actual: actualValue || 'missing',
      status: 'pass',
      message: ''
    };

    if (attr.expectActualValue) {
      // Expect actual value (not NA/null/blank)
      if (!actualValue || 
          actualValue.toLowerCase() === 'na' || 
          actualValue.toLowerCase() === 'null' ||
          actualValue.trim() === '') {
        result.status = 'fail';
        result.message = `Expected actual value but got "${actualValue || 'blank'}"`;
      } else {
        result.message = 'Valid actual value present';
      }
    } else {
      // Expect only "NA"
      if (actualValue && actualValue.toLowerCase() !== 'na') {
        result.status = 'fail';
        result.message = `Expected "NA" but got "${actualValue}"`;
      } else if (!actualValue) {
        result.status = 'fail';
        result.message = 'Expected "NA" but attribute is missing';
      } else {
        result.message = 'Correctly marked as NA';
      }
    }

    results.push(result);
  }

  // Check for extra attributes not in expected list
  const expectedNames = new Set(expectedAttributes.map(a => a.name));
  for (const [key, value] of Object.entries(actualParams)) {
    if (!expectedNames.has(key)) {
      results.push({
        attribute: key,
        expected: 'na-only',
        actual: value,
        status: 'fail',
        message: 'Extra attribute not in data dictionary'
      });
    }
  }

  return results;
}

/**
 * Calculate validation score as percentage
 */
export function calculateValidationScore(results: ValidationResult[]): number {
  if (results.length === 0) return 0;
  const passCount = results.filter(r => r.status === 'pass').length;
  return Math.round((passCount / results.length) * 100);
}

/**
 * Generate validation report
 */
export function generateValidationReport(
  title: string,
  eventName: string,
  results: ValidationResult[]
): string {
  const score = calculateValidationScore(results);
  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;

  let report = `# Validation Report\n\n`;
  report += `**Title**: ${title}\n`;
  report += `**Event**: ${eventName}\n`;
  report += `**Score**: ${score}% (${passCount}/${results.length} passed)\n\n`;

  if (failCount > 0) {
    report += `## ❌ Failed Validations (${failCount})\n\n`;
    results.filter(r => r.status === 'fail').forEach(r => {
      report += `- **${r.attribute}**: ${r.message}\n`;
      report += `  - Expected: ${r.expected}\n`;
      report += `  - Actual: ${r.actual}\n\n`;
    });
  }

  report += `## ✅ Passed Validations (${passCount})\n\n`;
  results.filter(r => r.status === 'pass').forEach(r => {
    report += `- **${r.attribute}**: ${r.message}\n`;
  });

  return report;
}

/**
 * Export validation results to Excel
 */
export function exportValidationToExcel(
  results: ValidationResult[],
  title: string,
  eventName: string
): XLSX.WorkBook {
  const data = results.map(r => ({
    'Attribute': r.attribute,
    'Expected': r.expected,
    'Actual': r.actual,
    'Status': r.status.toUpperCase(),
    'Message': r.message
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Validation Results');

  // Add summary sheet
  const score = calculateValidationScore(results);
  const summary = [{
    'Title': title,
    'Event': eventName,
    'Total Attributes': results.length,
    'Passed': results.filter(r => r.status === 'pass').length,
    'Failed': results.filter(r => r.status === 'fail').length,
    'Score': `${score}%`
  }];
  const summarySheet = XLSX.utils.json_to_sheet(summary);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  return workbook;
}
