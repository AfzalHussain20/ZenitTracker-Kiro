"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users, Layers, Target, CheckCircle2, Bug, Clock, AlertTriangle,
  ShieldCheck, ArrowRight, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtHours, getAvatarBg, type MemberStats, type MissingLogger } from './shared';

export interface LeadsOverviewProps {
  memberStats: MemberStats[];
  totals: { sessions: number; cases: number; passed: number; failed: number; bugs: number; passRate: number };
  hoursLogged: number;
  compliancePct: number;
  missingLoggers: MissingLogger[];
  openTasks: number;
  overdueTasks: number;
  periodDays: number;
  onViewWorklog: () => void;
  onLogWork: (name: string) => void;
}

export function LeadsOverviewTab({
  memberStats, totals, hoursLogged, compliancePct, missingLoggers,
  openTasks, overdueTasks, periodDays, onViewWorklog, onLogWork,
}: LeadsOverviewProps) {
  const kpis = [
    { label: 'Team Members', value: memberStats.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-500/10' },
    { label: 'Sessions', value: totals.sessions, icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-500/10' },
    { label: 'Test Cases', value: totals.cases, icon: Target, color: 'text-purple-600', bg: 'bg-purple-500/10' },
    { label: 'Pass Rate', value: `${totals.passRate}%`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    { label: 'Bugs Filed', value: totals.bugs, icon: Bug, color: 'text-amber-600', bg: 'bg-amber-500/10' },
    { label: 'Hours Logged', value: fmtHours(hoursLogged), icon: Clock, color: 'text-cyan-600', bg: 'bg-cyan-500/10' },
    { label: 'Worklog Compliance', value: `${compliancePct}%`, icon: ShieldCheck, color: 'text-teal-600', bg: 'bg-teal-500/10' },
    { label: 'Open Tasks', value: openTasks, icon: ClipboardList, color: 'text-rose-600', bg: 'bg-rose-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className="p-4 h-full">
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', kpi.bg)}>
                  <kpi.icon className={cn('w-4 h-4', kpi.color)} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground truncate">{kpi.label}</p>
                  <p className="text-xl font-bold tabular-nums truncate">{kpi.value}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Missing worklogs */}
        <Card className={cn('h-full', missingLoggers.length > 0 ? 'border-amber-500/40 bg-amber-500/5' : '')}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className={cn('w-4 h-4', missingLoggers.length > 0 ? 'text-amber-600' : 'text-emerald-600')} />
                <span className="text-sm font-semibold">Missing Worklogs</span>
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={onViewWorklog}>
                Manage <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            {missingLoggers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Everyone on the roster logged work in the last {periodDays} days.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  {missingLoggers.length} member{missingLoggers.length === 1 ? '' : 's'} logged no work in the last {periodDays} days.
                </p>
                <div className="flex flex-wrap gap-2">
                  {missingLoggers.slice(0, 12).map(m => (
                    <span key={m.person.userId} className="inline-flex items-center gap-1 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 pl-2 pr-1 py-1 rounded-full">
                      <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white', getAvatarBg(m.person.name))}>
                        {m.person.name.charAt(0)}
                      </span>
                      {m.person.name}
                      <button onClick={() => onLogWork(m.person.name)} title={`Log work for ${m.person.name}`}
                        className="inline-flex items-center gap-0.5 bg-amber-500/20 hover:bg-amber-500/40 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded-full transition-colors cursor-pointer">
                        <Clock className="w-2.5 h-2.5" />Log
                      </button>
                    </span>
                  ))}
                  {missingLoggers.length > 12 && (
                    <span className="text-xs text-muted-foreground self-center">+{missingLoggers.length - 12} more</span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Task health */}
        <Card className={cn('h-full', overdueTasks > 0 ? 'border-red-500/40 bg-red-500/5' : '')}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className={cn('w-4 h-4', overdueTasks > 0 ? 'text-red-600' : 'text-primary')} />
                <span className="text-sm font-semibold">Task Health</span>
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" asChild>
                <Link href="/tasks">Open board <ArrowRight className="w-3 h-3" /></Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-[11px] text-muted-foreground">Open tasks</p>
                <p className="text-2xl font-bold tabular-nums">{openTasks}</p>
              </div>
              <div className={cn('rounded-xl border p-3', overdueTasks > 0 ? 'border-red-500/30 bg-red-500/10' : 'border-border bg-card')}>
                <p className="text-[11px] text-muted-foreground">Overdue</p>
                <p className={cn('text-2xl font-bold tabular-nums', overdueTasks > 0 && 'text-red-600')}>{overdueTasks}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {overdueTasks > 0
                ? 'Some assigned tasks are past their due date — nudge the owners.'
                : 'No overdue tasks. The board is on schedule.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
