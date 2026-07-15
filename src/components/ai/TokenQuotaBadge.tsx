'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, X, RefreshCw, ChevronDown, TrendingUp, Circle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface QuotaData {
  providers: {
    gemini: { totalKeys: number; availableKeys: number; dailyLimit: number };
    groq: { totalKeys: number; availableKeys: number; dailyLimit: number };
  };
  totalDailyLimit: number;
  session: { calls: number; totalTokens: number; promptTokens: number; completionTokens: number };
  features: { feature: string; calls: number; totalTokens: number; avgPromptTokens: number; avgCompletionTokens: number }[];
  generatedAt: string;
  error?: string;
}

interface DailyData {
  dailyHistory: { date: string; totalCalls: number; totalTokens: number; totalPromptTokens: number; totalCompletionTokens: number; byFeature?: Record<string, any> }[];
  error?: string;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

const FEATURE_LABELS: Record<string, string> = {
  'ask-prd': 'PRD Chat', 'ask-global': 'Global PRD', 'generate-tests': 'Test Gen',
  'generate-stream': 'Stream', 'jira-insights': 'Jira AI', 'categorize-prd': 'Auto-Tag',
  'analytics-events': 'Analytics', 'notes-ai': 'Notes',
};

export const AI_CALL_COMPLETED_EVENT = 'zenit:ai-call-completed';

export default function TokenQuotaBadge() {
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const fetchRef = useRef(false);

  const fetchQuota = useCallback(async (silent = false) => {
    if (fetchRef.current) return;
    fetchRef.current = true;
    if (!silent) setLoading(true);
    try {
      // Primary: check-quota is always available (key pool + in-memory)
      const res = await fetch('/api/ai/check-quota');
      if (res.ok) {
        const data: QuotaData = await res.json();
        setQuota(data);
      }
    } catch { /* silent */ }
    finally {
      setLoading(false);
      fetchRef.current = false;
    }
  }, []);

  const fetchDaily = useCallback(async () => {
    try {
      // Secondary: Firestore daily history (may show zeros if Firestore isn't configured)
      const res = await fetch('/api/ai/token-usage?days=1');
      if (res.ok) {
        const data: DailyData = await res.json();
        setDaily(data);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchQuota(); }, [fetchQuota]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => fetchQuota(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchQuota]);

  // Refresh after every AI call (2s delay for Firestore write to land)
  useEffect(() => {
    const handler = () => {
      setTimeout(() => fetchQuota(true), 2000);
    };
    window.addEventListener(AI_CALL_COMPLETED_EVENT, handler);
    return () => window.removeEventListener(AI_CALL_COMPLETED_EVENT, handler);
  }, [fetchQuota]);

  // Load daily Firestore data when dropdown opens
  useEffect(() => {
    if (open && !daily) fetchDaily();
  }, [open, daily, fetchDaily]);

  const sessionCalls = quota?.session?.calls ?? 0;
  const sessionTokens = quota?.session?.totalTokens ?? 0;
  const totalLimit = quota?.totalDailyLimit ?? 141600;
  const geminiAvail = quota?.providers?.gemini?.availableKeys ?? 0;
  const geminiTotal = quota?.providers?.gemini?.totalKeys ?? 0;
  const groqAvail = quota?.providers?.groq?.availableKeys ?? 0;
  const groqTotal = quota?.providers?.groq?.totalKeys ?? 0;

  // Use session calls as primary counter (always accurate)
  const callPct = totalLimit > 0 ? Math.min(100, Math.round((sessionCalls / totalLimit) * 100)) : 0;
  const statusColor = callPct >= 90 ? 'text-red-500' : callPct >= 70 ? 'text-amber-500' : geminiAvail === 0 ? 'text-red-500' : 'text-emerald-500';
  const barColor = callPct >= 90 ? 'bg-red-500' : callPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const dotColor = geminiAvail === 0 ? 'bg-red-500' : geminiAvail < geminiTotal ? 'bg-amber-500' : 'bg-emerald-500';

  // Today's Firestore data (persistent across restarts)
  const today = daily?.dailyHistory?.[0];
  const todayCalls = today?.totalCalls ?? 0;
  const todayTokens = today?.totalTokens ?? 0;

  // Show whichever is higher — session (current) or daily Firestore (historical)
  const displayCalls = Math.max(sessionCalls, todayCalls);
  const displayTokens = Math.max(sessionTokens, todayTokens);

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(p => !p); }}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs transition-all',
          open
            ? 'bg-background border-border shadow-sm text-foreground'
            : 'bg-muted/50 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border'
        )}
        title={`AI Quota — ${fmtNum(displayCalls)} calls this session | ${geminiAvail}/${geminiTotal} Gemini keys active`}
      >
        {/* Live status dot */}
        <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor, geminiAvail > 0 && 'animate-pulse')} />
        <Zap className={cn('w-3.5 h-3.5 shrink-0', statusColor)} />
        <span className={cn('font-mono font-semibold tabular-nums', statusColor)}>
          {loading && !quota ? '…' : fmtNum(displayCalls)}
        </span>
        <span className="text-muted-foreground/50 hidden md:inline">/ {fmtNum(totalLimit)}</span>
        <ChevronDown className={cn('w-3 h-3 text-muted-foreground/40 transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[110]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-[111] w-76 rounded-2xl border border-border bg-card shadow-xl overflow-hidden" style={{ width: '304px' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-foreground">AI Quota</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { fetchQuota(); fetchDaily(); }}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                </button>
                <button onClick={() => setOpen(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Provider status */}
              <div className="grid grid-cols-2 gap-2">
                <div className={cn('rounded-xl border p-3 space-y-1', geminiAvail === 0 ? 'border-red-200 bg-red-50 dark:bg-red-500/5 dark:border-red-500/20' : 'border-border bg-muted/30')}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Gemini</span>
                    <span className={cn('w-2 h-2 rounded-full', geminiAvail === 0 ? 'bg-red-500' : geminiAvail < geminiTotal ? 'bg-amber-500' : 'bg-emerald-500')} />
                  </div>
                  <p className="text-sm font-bold text-foreground">{geminiAvail}<span className="text-muted-foreground font-normal">/{geminiTotal}</span></p>
                  <p className="text-[10px] text-muted-foreground">keys active</p>
                </div>
                <div className={cn('rounded-xl border p-3 space-y-1', groqAvail === 0 && groqTotal > 0 ? 'border-red-200 bg-red-50 dark:bg-red-500/5 dark:border-red-500/20' : 'border-border bg-muted/30')}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Groq</span>
                    <span className={cn('w-2 h-2 rounded-full', groqTotal === 0 ? 'bg-muted' : groqAvail === 0 ? 'bg-red-500' : 'bg-emerald-500')} />
                  </div>
                  <p className="text-sm font-bold text-foreground">{groqAvail}<span className="text-muted-foreground font-normal">/{groqTotal}</span></p>
                  <p className="text-[10px] text-muted-foreground">keys active</p>
                </div>
              </div>

              {/* Call usage bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Calls (session)</span>
                  <span className="font-mono font-bold">
                    <span className={statusColor}>{fmtNum(displayCalls)}</span>
                    <span className="text-muted-foreground"> / {fmtNum(totalLimit)}</span>
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-700', barColor)}
                    style={{ width: `${Math.max(callPct, sessionCalls > 0 ? 2 : 0)}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {sessionCalls === 0
                    ? 'No AI calls in this session yet'
                    : `${callPct}% used · ${fmtNum(Math.max(0, totalLimit - displayCalls))} remaining`}
                </p>
              </div>

              {/* Token counts */}
              <div className="grid grid-cols-3 gap-1.5 text-center">
                {[
                  { label: 'Total', value: displayTokens },
                  { label: 'In', value: Math.max(quota?.session?.promptTokens ?? 0, today?.totalPromptTokens ?? 0) },
                  { label: 'Out', value: Math.max(quota?.session?.completionTokens ?? 0, today?.totalCompletionTokens ?? 0) },
                ].map(s => (
                  <div key={s.label} className="rounded-xl bg-muted/40 py-2 px-1">
                    <p className="text-xs font-bold font-mono text-foreground">{fmtNum(s.value)}</p>
                    <p className="text-[9px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Per-feature breakdown — from session (most reliable) */}
              {quota?.features && quota.features.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">This Session</p>
                  {quota.features
                    .sort((a, b) => b.totalTokens - a.totalTokens)
                    .slice(0, 6)
                    .map(f => (
                      <div key={f.feature} className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{FEATURE_LABELS[f.feature] || f.feature}</span>
                        <div className="flex items-center gap-2 font-mono text-right">
                          <span className="text-muted-foreground/60">{f.calls}×</span>
                          <span className="text-foreground font-medium w-10 text-right">{fmtNum(f.totalTokens)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Empty state */}
              {sessionCalls === 0 && todayCalls === 0 && (
                <p className="text-xs text-muted-foreground text-center py-1 italic">
                  Use any AI feature and counts will appear here
                </p>
              )}

              {/* Firestore data note */}
              {todayCalls > 0 && (
                <p className="text-[10px] text-muted-foreground/50">
                  Persistent today: {fmtNum(todayCalls)} calls · {fmtNum(todayTokens)} tokens
                </p>
              )}

              <Link href="/ai-settings?tab=quota"
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setOpen(false)}>
                <span>Full quota report & history</span>
                <TrendingUp className="w-3.5 h-3.5" />
              </Link>

              {quota?.generatedAt && (
                <p className="text-[10px] text-muted-foreground/40 text-right">
                  {new Date(quota.generatedAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
