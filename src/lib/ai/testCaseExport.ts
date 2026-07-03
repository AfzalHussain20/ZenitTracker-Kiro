// src/lib/ai/testCaseExport.ts
// Export service for AI Test Case Generator
// Handles Excel (.xlsx) and CSV export of test cases

import * as XLSX from 'xlsx';
import { StoredTestCase, TestCaseCategory } from '@/types/test-cases';

/**
 * Categories in display order for Excel sheets
 */
const CATEGORY_ORDER: TestCaseCategory[] = [
  'Functional',
  'Negative',
  'Exploratory',
  'Sanity',
  'Edge Case',
];

/**
 * Column headers used in both Excel sheets and CSV
 */
const EXPORT_COLUMNS = [
  'Testcase ID',
  'Module',
  'Priority',
  'Test Scenario',
  'Test Steps',
  'Expected Result',
];

/**
 * Filters out rejected test cases from the export set.
 * Only test cases with reviewStatus !== 'rejected' are included.
 */
export function filterForExport(testCases: StoredTestCase[]): StoredTestCase[] {
  return testCases.filter((tc) => tc.reviewStatus !== 'rejected');
}

/**
 * Formats an array of test steps into a numbered list string.
 * Each step gets a 1-based index prefix, separated by newlines.
 * e.g. ["Login", "Click button"] → "1. Login\n2. Click button"
 */
export function formatTestStepsForExport(steps: string[]): string {
  return steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
}

/**
 * Generates an export filename by sanitizing the PRD title.
 * Special characters are replaced with underscores.
 * Pattern: {sanitized_title}_test_cases.{extension}
 */
export function generateExportFilename(prdTitle: string, extension: string): string {
  const sanitized = prdTitle.replace(/[^a-zA-Z0-9\s]/g, '_').replace(/\s+/g, '_');
  return `${sanitized}_test_cases.${extension}`;
}

/**
 * Converts a single test case into a row array for export.
 */
function testCaseToRow(tc: StoredTestCase): string[] {
  return [
    tc.testcaseId,
    tc.editedFields?.module ?? tc.module,
    tc.editedFields?.priority ?? tc.priority,
    tc.editedFields?.testScenario ?? tc.testScenario,
    formatTestStepsForExport(tc.editedFields?.testSteps ?? tc.testSteps),
    tc.editedFields?.expectedResult ?? tc.expectedResult,
  ];
}

/**
 * Generates an Excel workbook with separate sheets per category.
 * Only categories that have test cases get a sheet.
 * Each sheet has columns: Testcase ID, Module, Priority, Test Scenario, Test Steps, Expected Result
 */
export function generateExcelExport(
  testCases: StoredTestCase[],
  prdTitle: string
): Blob {
  const exportable = filterForExport(testCases);
  const workbook = XLSX.utils.book_new();

  for (const category of CATEGORY_ORDER) {
    const categoryTestCases = exportable.filter((tc) => tc.category === category);
    if (categoryTestCases.length === 0) continue;

    const rows = categoryTestCases.map(testCaseToRow);
    const sheetData = [EXPORT_COLUMNS, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Set column widths for readability
    worksheet['!cols'] = [
      { wch: 15 },  // Testcase ID
      { wch: 25 },  // Module
      { wch: 8 },   // Priority
      { wch: 50 },  // Test Scenario
      { wch: 60 },  // Test Steps
      { wch: 50 },  // Expected Result
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, category);
  }

  const wbOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbOut], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generates a CSV string with all non-rejected test cases.
 * Includes an additional Category column to identify test type.
 * Fields containing commas, newlines, or quotes are properly escaped.
 */
export function generateCsvExport(
  testCases: StoredTestCase[],
  prdTitle: string
): string {
  const exportable = filterForExport(testCases);
  const csvColumns = [...EXPORT_COLUMNS, 'Category'];

  const escapeCsvField = (field: string): string => {
    if (field.includes(',') || field.includes('\n') || field.includes('"')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  const headerRow = csvColumns.map(escapeCsvField).join(',');

  const dataRows = exportable.map((tc) => {
    const row = [...testCaseToRow(tc), tc.category];
    return row.map(escapeCsvField).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Triggers a browser download for the given blob with the specified filename.
 * Creates a temporary anchor element, clicks it, then cleans up.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
