'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  X,
  Check,
  Pencil,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  Filter,
  ExternalLink,
} from 'lucide-react';
import type {
  StoredTestCase,
  TestCaseCategory,
  Priority,
  ReviewStatus,
  TestCaseReviewUpdate,
} from '@/types/test-cases';
import { updateTestCaseReview } from '@/lib/ai/testCaseStore';
import {
  generateExcelExport,
  generateCsvExport,
  downloadBlob,
  generateExportFilename,
} from '@/lib/ai/testCaseExport';
import {
  filterTestCases,
  sortTestCases,
  computeReviewSummary,
  type SortColumn,
  type SortDirection,
} from '@/lib/ai/testCaseUtils';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface TestCaseReviewPanelProps {
  pageId: string;
  pageTitle: string;
  testCases: StoredTestCase[];
  onClose: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES: TestCaseCategory[] = [
  'Functional',
  'Negative',
  'Exploratory',
  'Sanity',
  'Edge Case',
];

const PRIORITIES: Priority[] = ['P0', 'P1', 'P2'];
const STATUSES: ReviewStatus[] = ['pending', 'accepted', 'edited', 'rejected'];

// ─── Component ──────────────────────────────────────────────────────────────────

export default function TestCaseReviewPanel({
  pageId,
  pageTitle,
  testCases: initialTestCases,
  onClose,
}: TestCaseReviewPanelProps) {
  // ─── State ───────────────────────────────────────────────────────────────────
  const [testCases, setTestCases] = useState<StoredTestCase[]>(initialTestCases);
  const [activeTab, setActiveTab] = useState<TestCaseCategory>('Functional');
  const [sortColumn, setSortColumn] = useState<SortColumn>('testcaseId');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    module: string;
    priority: Priority;
    testScenario: string;
    testSteps: string;
    expectedResult: string;
  } | null>(null);

  // ─── Derived Data ────────────────────────────────────────────────────────────

  const categoryCounts = useMemo(() => {
    const counts: Record<TestCaseCategory, number> = {
      Functional: 0,
      Negative: 0,
      Exploratory: 0,
      Sanity: 0,
      'Edge Case': 0,
    };
    for (const tc of testCases) {
      counts[tc.category]++;
    }
    return counts;
  }, [testCases]);

  const summary = useMemo(() => computeReviewSummary(testCases), [testCases]);

  const displayedTestCases = useMemo(() => {
    const categoryFiltered = testCases.filter((tc) => tc.category === activeTab);
    const filtered = filterTestCases(categoryFiltered, priorityFilter, statusFilter);
    return sortTestCases(filtered, sortColumn, sortDirection);
  }, [testCases, activeTab, priorityFilter, statusFilter, sortColumn, sortDirection]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleSort = useCallback(
    (column: SortColumn) => {
      if (sortColumn === column) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortColumn(column);
        setSortDirection('asc');
      }
    },
    [sortColumn]
  );

  const handleReviewAction = useCallback(
    async (testcaseId: string, status: ReviewStatus) => {
      const update: TestCaseReviewUpdate = { reviewStatus: status };
      try {
        await updateTestCaseReview(pageId, testcaseId, update);
        setTestCases((prev) =>
          prev.map((tc) =>
            tc.testcaseId === testcaseId ? { ...tc, reviewStatus: status, updatedAt: new Date() } : tc
          )
        );
      } catch (error) {
        console.error('Failed to update review status:', error);
      }
    },
    [pageId]
  );

  const handleEditStart = useCallback((tc: StoredTestCase) => {
    setEditingId(tc.testcaseId);
    setEditForm({
      module: tc.editedFields?.module ?? tc.module,
      priority: tc.editedFields?.priority ?? tc.priority,
      testScenario: tc.editedFields?.testScenario ?? tc.testScenario,
      testSteps: (tc.editedFields?.testSteps ?? tc.testSteps).join('\n'),
      expectedResult: tc.editedFields?.expectedResult ?? tc.expectedResult,
    });
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingId || !editForm) return;

    const editedFields = {
      module: editForm.module,
      priority: editForm.priority,
      testScenario: editForm.testScenario,
      testSteps: editForm.testSteps.split('\n').filter((s) => s.trim() !== ''),
      expectedResult: editForm.expectedResult,
    };

    const update: TestCaseReviewUpdate = {
      reviewStatus: 'edited',
      editedFields,
    };

    try {
      await updateTestCaseReview(pageId, editingId, update);
      setTestCases((prev) =>
        prev.map((tc) =>
          tc.testcaseId === editingId
            ? { ...tc, reviewStatus: 'edited', editedFields, updatedAt: new Date() }
            : tc
        )
      );
      setEditingId(null);
      setEditForm(null);
    } catch (error) {
      console.error('Failed to save edit:', error);
    }
  }, [pageId, editingId, editForm]);

  const handleEditCancel = useCallback(() => {
    setEditingId(null);
    setEditForm(null);
  }, []);

  const handleModuleClick = useCallback((module: string) => {
    // Dispatch a custom event for scrolling to the PRD heading
    const event = new CustomEvent('scroll-to-prd-heading', { detail: { heading: module } });
    window.dispatchEvent(event);
  }, []);

  const handleExportExcel = useCallback(() => {
    const blob = generateExcelExport(testCases, pageTitle);
    const filename = generateExportFilename(pageTitle, 'xlsx');
    downloadBlob(blob, filename);
  }, [testCases, pageTitle]);

  const handleExportCsv = useCallback(() => {
    const csvContent = generateCsvExport(testCases, pageTitle);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = generateExportFilename(pageTitle, 'csv');
    downloadBlob(blob, filename);
  }, [testCases, pageTitle]);

  // ─── Sort Icon Helper ────────────────────────────────────────────────────────

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background border border-border rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-card">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">Test Case Review</h2>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
            {testCases.length} total
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Export buttons */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted/50 transition-colors"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
            Excel
          </button>
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted/50 transition-colors"
            title="Export to CSV"
          >
            <FileText className="h-3.5 w-3.5 text-blue-600" />
            CSV
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
            title="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex items-center gap-4 px-5 py-2.5 border-b border-border/30 bg-muted/20 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Accepted: <strong>{summary.accepted}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          Edited: <strong>{summary.edited}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Rejected: <strong>{summary.rejected}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-gray-400" />
          Pending: <strong>{summary.pending}</strong>
        </span>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 px-5 pt-3 pb-2 overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === cat
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {cat} ({categoryCounts[cat]})
          </button>
        ))}
      </div>

      {/* Filter Controls */}
      <div className="flex items-center gap-3 px-5 py-2 border-b border-border/30">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          value={priorityFilter ?? ''}
          onChange={(e) => setPriorityFilter((e.target.value as Priority) || null)}
          className="text-xs border border-border rounded-md px-2 py-1 bg-background text-foreground"
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={statusFilter ?? ''}
          onChange={(e) => setStatusFilter((e.target.value as ReviewStatus) || null)}
          className="text-xs border border-border rounded-md px-2 py-1 bg-background text-foreground"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        {(priorityFilter || statusFilter) && (
          <button
            onClick={() => {
              setPriorityFilter(null);
              setStatusFilter(null);
            }}
            className="text-xs text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {displayedTestCases.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            No test cases match the current filters.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card border-b border-border/50">
              <tr>
                <SortableHeader column="testcaseId" label="ID" onSort={handleSort} icon={<SortIcon column="testcaseId" />} />
                <SortableHeader column="module" label="Module" onSort={handleSort} icon={<SortIcon column="module" />} />
                <SortableHeader column="priority" label="Priority" onSort={handleSort} icon={<SortIcon column="priority" />} />
                <SortableHeader column="testScenario" label="Test Scenario" onSort={handleSort} icon={<SortIcon column="testScenario" />} />
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Test Steps</th>
                <SortableHeader column="expectedResult" label="Expected Result" onSort={handleSort} icon={<SortIcon column="expectedResult" />} />
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {displayedTestCases.map((tc) => (
                <TestCaseRow
                  key={tc.testcaseId}
                  testCase={tc}
                  isEditing={editingId === tc.testcaseId}
                  editForm={editingId === tc.testcaseId ? editForm : null}
                  onEditStart={handleEditStart}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                  onEditChange={setEditForm}
                  onReviewAction={handleReviewAction}
                  onModuleClick={handleModuleClick}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


// ─── Sub-Components ─────────────────────────────────────────────────────────────

function SortableHeader({
  column,
  label,
  onSort,
  icon,
}: {
  column: SortColumn;
  label: string;
  onSort: (col: SortColumn) => void;
  icon: React.ReactNode;
}) {
  return (
    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
      <button
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        {icon}
      </button>
    </th>
  );
}

function TestCaseRow({
  testCase,
  isEditing,
  editForm,
  onEditStart,
  onEditSave,
  onEditCancel,
  onEditChange,
  onReviewAction,
  onModuleClick,
}: {
  testCase: StoredTestCase;
  isEditing: boolean;
  editForm: {
    module: string;
    priority: Priority;
    testScenario: string;
    testSteps: string;
    expectedResult: string;
  } | null;
  onEditStart: (tc: StoredTestCase) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onEditChange: (form: {
    module: string;
    priority: Priority;
    testScenario: string;
    testSteps: string;
    expectedResult: string;
  } | null) => void;
  onReviewAction: (testcaseId: string, status: ReviewStatus) => void;
  onModuleClick: (module: string) => void;
}) {
  if (isEditing && editForm) {
    return (
      <tr className="bg-blue-50/50 dark:bg-blue-950/20">
        <td className="px-3 py-2 text-muted-foreground font-mono">{testCase.testcaseId}</td>
        <td className="px-3 py-2">
          <input
            type="text"
            value={editForm.module}
            onChange={(e) => onEditChange({ ...editForm, module: e.target.value })}
            className="w-full text-xs border border-border rounded px-2 py-1 bg-background"
          />
        </td>
        <td className="px-3 py-2">
          <select
            value={editForm.priority}
            onChange={(e) => onEditChange({ ...editForm, priority: e.target.value as Priority })}
            className="text-xs border border-border rounded px-2 py-1 bg-background"
          >
            <option value="P0">P0</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
          </select>
        </td>
        <td className="px-3 py-2">
          <textarea
            value={editForm.testScenario}
            onChange={(e) => onEditChange({ ...editForm, testScenario: e.target.value })}
            rows={2}
            className="w-full text-xs border border-border rounded px-2 py-1 bg-background resize-y"
          />
        </td>
        <td className="px-3 py-2">
          <textarea
            value={editForm.testSteps}
            onChange={(e) => onEditChange({ ...editForm, testSteps: e.target.value })}
            rows={3}
            placeholder="One step per line"
            className="w-full text-xs border border-border rounded px-2 py-1 bg-background resize-y font-mono"
          />
        </td>
        <td className="px-3 py-2">
          <textarea
            value={editForm.expectedResult}
            onChange={(e) => onEditChange({ ...editForm, expectedResult: e.target.value })}
            rows={2}
            className="w-full text-xs border border-border rounded px-2 py-1 bg-background resize-y"
          />
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            <button
              onClick={onEditSave}
              className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 transition-colors"
              title="Save"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onEditCancel}
              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  const statusBadgeClass =
    testCase.reviewStatus === 'accepted'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : testCase.reviewStatus === 'edited'
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        : testCase.reviewStatus === 'rejected'
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';

  const displayModule = testCase.editedFields?.module ?? testCase.module;
  const displayPriority = testCase.editedFields?.priority ?? testCase.priority;
  const displayScenario = testCase.editedFields?.testScenario ?? testCase.testScenario;
  const displaySteps = testCase.editedFields?.testSteps ?? testCase.testSteps;
  const displayExpected = testCase.editedFields?.expectedResult ?? testCase.expectedResult;

  return (
    <tr className="hover:bg-muted/20 transition-colors">
      <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
        {testCase.testcaseId}
      </td>
      <td className="px-3 py-2">
        <button
          onClick={() => onModuleClick(displayModule)}
          className="text-left text-primary hover:underline inline-flex items-center gap-1"
        >
          {displayModule}
          {!testCase.sourceVerified && (
            <span title="Source unverified">
              <AlertTriangle className="h-3 w-3 text-yellow-500" />
            </span>
          )}
        </button>
        <button
          onClick={() => {
            const event = new CustomEvent('open-mockup-preview', { detail: { module: displayModule } });
            window.dispatchEvent(event);
          }}
          className="ml-1 text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
          title="Preview mockup"
        >
          <ExternalLink className="h-2.5 w-2.5" />
        </button>
      </td>
      <td className="px-3 py-2">
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
            displayPriority === 'P0'
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : displayPriority === 'P1'
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          {displayPriority}
        </span>
      </td>
      <td className="px-3 py-2 max-w-[200px]">
        <span className="line-clamp-2">{displayScenario}</span>
      </td>
      <td className="px-3 py-2 max-w-[250px]">
        <ol className="list-decimal list-inside space-y-0.5">
          {displaySteps.slice(0, 3).map((step, i) => (
            <li key={i} className="truncate">
              {step}
            </li>
          ))}
          {displaySteps.length > 3 && (
            <li className="text-muted-foreground italic">+{displaySteps.length - 3} more</li>
          )}
        </ol>
      </td>
      <td className="px-3 py-2 max-w-[200px]">
        <span className="line-clamp-2">{displayExpected}</span>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          {/* Status badge */}
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium mr-1 ${statusBadgeClass}`}>
            {testCase.reviewStatus}
          </span>
          {/* Action buttons */}
          <button
            onClick={() => onReviewAction(testCase.testcaseId, 'accepted')}
            className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 transition-colors"
            title="Accept"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onEditStart(testCase)}
            className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 transition-colors"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onReviewAction(testCase.testcaseId, 'rejected')}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
            title="Reject"
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
