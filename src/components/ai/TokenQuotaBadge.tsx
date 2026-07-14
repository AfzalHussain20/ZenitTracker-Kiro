'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, X, RefreshCw, ChevronDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface DailyUsage {
  date: string;
  totalCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  byFeature?: Record<string, { calls: number; totalTokens: number }>;
}

interface TokenStats {
  windowTotals: { calls: number; promptTokens: number; completionTokens: number; totalTokens: number };
  dailyHistory: DailyUsage[];
  instanceTotals: { calls: number; promptTokens: number; completionTokens: number; totalTokens: number };
  generatedAt: string;
  error?: string;
}

// 17 keys × free tier limit
const DAILY_CALL_LIMIT = 141600;

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

/** Global event name — fire this anywhere after an AI call to trigger badge refresh */
export const AI_CALL_COMPLETED_EVENT = 'zenit:ai-call-completed';

export default function TokenQuotaBadge() {
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const fetchRef = useRef(false);

  const fetchStats = useCallback(async (silent = false) => {
    if (fetchRef.current && silent) return; // prevent concurrent fetches
    fetchRef.current = true;
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/ai/token-usage?days=1');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: TokenStats = await res.json();
      setStats(data);
    } catch {
      // silently fail — badge just shows stale data
    } finally {
      setLoading(false);
      fetchRef.current = false;
    }
  }, []);

  // Initial load
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => fetchStats(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Listen for AI call completion events to refresh immediately
  useEffect(() => {
    const handler = () => {
      // Small delay to allow Firestore write to complete
      setTimeout(() => fetchStats(true), 2000);
    };
    window.addEventListener(AI_CALL_COMPLETED_EVENT, handler);
    return () => window.removeEventListener(AI_CALL_COMPLETED_EVENT, handler);
  }, [fetchStats]);

  // Prefer today's Firestore data, fall back to instance totals
  const today = stats?.dailyHistory?.[0];
  const todayCalls = (today?.totalCalls || 0) + (stats?.instanceTotals?.calls || 0);
  const todayTokens = (today?.totalTokens || 0) + (stats?.instanceTotals?.totalTokens || 0);
  // Deduplicate if today's date matches — prefer Firestore
  const displayCalls = today?.totalCalls || stats?.instanceTotals?.calls || 0;
  const displayTokens = today?.totalTokens || stats?.instanceTotals?.totalTokens || 0;

  const callPct = Math.min(100, Math.round((displayCalls / DAILY_CALL_LIMIT) * 100));
  const statusColor =
    callPct >= 90 ? 'text-red-500' :
    callPct >= 70 ? 'text-amber-500' :
    callPct >= 30 ? 'text-emerald-500' :
    'text-muted-foreground';

  const barColor =
    callPct >= 90 ? 'bg-red-500' :
    callPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(p => !p); if (!stats) fetchStats(); }}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs transition-all',
          open
            ? 'bg-background border-border shadow-sm text-foreground'
            : 'bg-muted/50 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border'
        )}
        title={`AI Quota: ${fmtNum(displayCalls)} / ${fmtNum(DAILY_CALL_LIMIT)} calls today`}
      >
        <Zap className={cn('w-3.5 h-3.5 shrink-0', statusColor)} />
        <span className={cn('font-mono font-semibold tabular-nums', statusColor)}>
          {loading && !stats ? '…' : fmtNum(displayCalls)}
        </span>
        <span className="text-muted-foreground/50 hidden md:inline">/ {fmtNum(DAILY_CALL_LIMIT)}</span>
        <ChevronDown className={cn('w-3 h-3 text-muted-foreground/40 transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[110]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-[111] w-72 rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-foreground">AI Quota</span>
                {stats?.error && <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-full">Firestore offline</span>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => fetchStats()}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Refresh">
                  <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                </button>
                <button onClick={() => setOpen(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Calls progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Calls today</span>
                  <span className="font-mono font-bold">
                    <span className={statusColor}>{fmtNum(displayCalls)}</span>
                    <span className="text-muted-foreground"> / {fmtNum(DAILY_CALL_LIMIT)}</span>
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-700', barColor)}
                    style={{ width: `${Math.max(callPct, 1)}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{callPct}% used</span>
                  <span>{fmtNum(Math.max(0, DAILY_CALL_LIMIT - displayCalls))} left</span>
                </div>
              </div>

              {/* Token summary */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Total', value: displayTokens },
                  { label: 'Prompt', value: today?.totalPromptTokens || stats?.instanceTotals?.promptTokens || 0 },
                  { label: 'Output', value: today?.totalCompletionTokens || stats?.instanceTotals?.completionTokens || 0 },
                ].map(s => (
                  <div key={s.label} className="rounded-xl bg-muted/40 p-2.5">
                    <p className="text-sm font-bold font-mono text-foreground">{fmtNum(s.value)}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* By feature */}
              {today?.byFeature && Object.keys(today.byFeature).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">By Feature</p>
                  {Object.entries(today.byFeature)
                    .sort((a, b) => b[1].totalTokens - a[1].totalTokens)
                    .slice(0, 5)
                    .map(([feat, info]) => {
                      const LABELS: Record<string, string> = {
                        'ask-prd': 'PRD Chat', 'ask-global': 'Global PRD', 'generate-tests': 'Test Gen',
                        'jira-insights': 'Jira AI', 'categorize-prd': 'Auto-Tag', 'analytics-events': 'Analytics',
                      };
                      return (
                        <div key={feat} className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">{LABELS[feat] || feat}</span>
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="text-muted-foreground/60">{info.calls}×</span>
                            <span className="text-foreground font-medium">{fmtNum(info.totalTokens)}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* No data fallback */}
              {!today && !stats?.instanceTotals?.calls && (
                <p className="text-xs text-muted-foreground text-center py-1">
                  No AI calls recorded yet today. Data appears after the first AI request.
                </p>
              )}

              {/* Link to full settings */}
              <Link href="/ai-settings?tab=quota"
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setOpen(false)}>
                <span>View full quota report</span>
                <TrendingUp className="w-3.5 h-3.5" />
              </Link>

              {stats?.generatedAt && (
                <p className="text-[10px] text-muted-foreground/40 text-right">
                  {new Date(stats.generatedAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
