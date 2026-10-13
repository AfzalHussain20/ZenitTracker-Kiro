"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Download, Printer, FileText, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadCsv, fmtHours, formatDate, getAvatarBg, type MemberStats } from './shared';

interface Props {
  memberStats: MemberStats[];
  totals: { sessions: number; cases: number; passed: number; failed: number; bugs: number; passRate: number };
  periodDays: number;
  hoursByName: Map<string, number>;
}

const norm = (s: string) => s.toLowerCase().trim();

export function TestReportTab({ memberStats, totals, periodDays, hoursByName }: Props) {
  const [member, setMember] = useState('all');

  const rows = useMemo(() => {
    const sorted = [...memberStats].sort((a, b) => b.totalCases - a.totalCases);
    return member === 'all' ? sorted : sorted.filter(m => m.uid === member);
  }, [memberStats, member]);

  const sum = useMemo(() => rows.reduce((acc, m) => ({
    sessions: acc.sessions + m.sessions,
    completed: acc.completed + m.completedSessions,
    cases: acc.cases + m.totalCases,
    passed: acc.passed + m.passed,
    failed: acc.failed + m.failed,
    na: acc.na + m.na,
    bugs: acc.bugs + m.bugsLogged,
    hours: acc.hours + (hoursByName.get(norm(m.name)) || 0),
  }), { sessions: 0, completed: 0, cases: 0, passed: 0, failed: 0, na: 0, bugs: 0, hours: 0 }),
    [rows, hoursByName]);

  const sumPassRate = sum.cases > 0 ? Math.round((sum.passed / sum.cases) * 100) : 0;
  const generated = formatDate(new Date(), 'MMM dd, yyyy HH:mm');
  const periodLabel = `Last ${periodDays} days`;

  const exportCsv = () => {
    const csv: (string | number)[][] = [
      ['Zenit Leads Portal — Test Report'],
      ['Period', periodLabel, 'Generated', generated],
      [],
      ['Member', 'Sessions', 'Completed', 'Test Cases', 'Passed', 'Failed', 'N/A', 'Pass %', 'Bugs Filed', 'Hours Logged', 'Avg Cases/Session', 'Last Active'],
      ...rows.map(m => [
        m.name, m.sessions, m.completedSessions, m.totalCases, m.passed, m.failed, m.na,
        `${m.passRate}%`, m.bugsLogged, Math.round((hoursByName.get(norm(m.name)) || 0) * 10) / 10,
        m.avgCasesPerSession, m.lastActive ? formatDate(m.lastActive) : '—',
      ]),
      ['TOTAL', sum.sessions, sum.completed, sum.cases, sum.passed, sum.failed, sum.na, `${sumPassRate}%`, sum.bugs, Math.round(sum.hours * 10) / 10, '', ''],
    ];
    downloadCsv(`Zenit_Test_Report_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="w-4 h-4 text-primary" /> Test Report
        </div>
        <Select value={member} onValueChange={setMember}>
          <SelectTrigger className={cn('w-48 h-9 text-xs ml-auto', member !== 'all' && 'border-primary font-medium')}>
            <SelectValue placeholder="All members" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            {[...memberStats].sort((a, b) => a.name.localeCompare(b.name)).map(m => (
              <SelectItem key={m.uid} value={m.uid}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
        <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={() => window.print()} disabled={rows.length === 0}>
          <Printer className="w-3.5 h-3.5" /> Print
        </Button>
      </div>

      <Card id="leads-test-report">
        <CardContent className="p-5">
          {/* Report header */}
          <div className="flex items-start justify-between gap-3 border-b border-border pb-3 mb-4">
            <div>
              <h2 className="text-lg font-bold">QA Test Report</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {periodLabel} · {rows.length} member{rows.length === 1 ? '' : 's'} · {sum.sessions} sessions
              </p>
            </div>
            <div className="text-right text-[11px] text-muted-foreground">
              <div>Generated</div>
              <div className="font-semibold text-foreground">{generated}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Member</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Sess.</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Cases</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase text-emerald-600">Pass</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase text-red-600">Fail</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">N/A</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Pass %</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Bugs</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Hours</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase hidden md:table-cell">Avg/Sess</th>
                  <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase hidden lg:table-cell">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-10 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No test activity in the last {periodDays} days
                  </td></tr>
                ) : rows.map(m => {
                  const hours = Math.round((hoursByName.get(norm(m.name)) || 0) * 10) / 10;
                  return (
                    <tr key={m.uid} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0', getAvatarBg(m.name))}>
                            {m.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-sm font-medium">{m.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center text-sm tabular-nums">{m.sessions}</td>
                      <td className="px-2 py-2.5 text-center text-sm tabular-nums font-medium">{m.totalCases}</td>
                      <td className="px-2 py-2.5 text-center text-sm tabular-nums text-emerald-600 font-semibold">{m.passed}</td>
                      <td className="px-2 py-2.5 text-center text-sm tabular-nums text-red-600 font-semibold">{m.failed}</td>
                      <td className="px-2 py-2.5 text-center text-sm tabular-nums text-muted-foreground">{m.na}</td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={cn('text-sm font-bold tabular-nums', m.passRate >= 80 ? 'text-emerald-600' : m.passRate >= 50 ? 'text-amber-600' : 'text-red-600')}>
                          {m.passRate}%
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center text-sm tabular-nums text-amber-600 font-medium">{m.bugsLogged || '—'}</td>
                      <td className="px-2 py-2.5 text-center text-sm tabular-nums">{hours > 0 ? fmtHours(hours) : '—'}</td>
                      <td className="px-2 py-2.5 text-center text-xs text-muted-foreground hidden md:table-cell">{m.avgCasesPerSession}</td>
                      <td className="px-2 py-2.5 text-center text-xs text-muted-foreground hidden lg:table-cell">
                        {m.lastActive ? formatDate(m.lastActive, 'MMM d') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40 font-bold">
                    <td className="px-3 py-2.5 text-sm">TOTAL</td>
                    <td className="px-2 py-2.5 text-center text-sm tabular-nums">{sum.sessions}</td>
                    <td className="px-2 py-2.5 text-center text-sm tabular-nums">{sum.cases}</td>
                    <td className="px-2 py-2.5 text-center text-sm tabular-nums text-emerald-600">{sum.passed}</td>
                    <td className="px-2 py-2.5 text-center text-sm tabular-nums text-red-600">{sum.failed}</td>
                    <td className="px-2 py-2.5 text-center text-sm tabular-nums">{sum.na}</td>
                    <td className="px-2 py-2.5 text-center text-sm tabular-nums">{sumPassRate}%</td>
                    <td className="px-2 py-2.5 text-center text-sm tabular-nums text-amber-600">{sum.bugs}</td>
                    <td className="px-2 py-2.5 text-center text-sm tabular-nums">{fmtHours(sum.hours)}</td>
                    <td className="px-2 py-2.5 hidden md:table-cell" />
                    <td className="px-2 py-2.5 hidden lg:table-cell" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <p className="text-[10px] text-muted-foreground mt-3">
            Baseline: {totals.sessions} sessions · {totals.cases} cases · {totals.passRate}% overall pass rate in the selected period.
            Hours sourced from Jira worklogs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
