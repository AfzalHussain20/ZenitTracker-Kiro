'use client';

import { useState } from 'react';
import { Brain, BarChart3, Shield, RefreshCw, Zap } from 'lucide-react';
import AIFlagsPanel from '@/components/ai/AIFlagsPanel';
import TokenQuotaBadge from '@/components/ai/TokenQuotaBadge';
import { cn } from '@/lib/utils';

type Tab = 'features' | 'quota';

export default function AISettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('features');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
              <Brain className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            AI Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-12">
            Control which AI features and providers are active. Disable to save your daily quota.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('features')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'features'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Shield className="w-4 h-4" />
          Features & Providers
        </button>
        <button
          onClick={() => setActiveTab('quota')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'quota'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Zap className="w-4 h-4" />
          Token Quota
        </button>
      </div>

      {/* Content */}
      {activeTab === 'features' && <AIFlagsPanel />}
      {activeTab === 'quota' && <QuotaTab />}
    </div>
  );
}

function QuotaTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/token-usage?days=7');
      const json = await res.json();
      setData(json);
      setLoaded(true);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  if (!loaded) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
        <Zap className="w-10 h-10 text-primary/30 mx-auto" />
        <div>
          <p className="font-medium text-foreground">Load Token Usage Data</p>
          <p className="text-sm text-muted-foreground mt-1">Fetches from Firestore — shows persistent data across server restarts</p>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          {loading ? 'Loading...' : 'Load Data'}
        </button>
      </div>
    );
  }

  const DAILY_LIMIT = 141600;
  const today = data?.dailyHistory?.[0];
  const todayCalls = today?.totalCalls || 0;
  const todayTokens = today?.totalTokens || 0;
  const callPct = Math.min(100, Math.round((todayCalls / DAILY_LIMIT) * 100));
  const fmt = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n);
  const barColor = callPct >= 90 ? 'bg-red-500' : callPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

  const FEATURE_LABELS: Record<string, string> = {
    'ask-prd': 'PRD Chat', 'ask-global': 'Global PRD Search', 'generate-tests': 'Test Case Generation',
    'jira-insights': 'Jira AI', 'categorize-prd': 'Auto-Tag PRDs', 'analytics-events': 'Analytics Events',
    'notes-ai': 'Notes AI', 'generate-stream': 'Stream Generation',
  };

  return (
    <div className="space-y-4">
      {/* Today's overview */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Today's Usage</h3>
          <button onClick={fetchData} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Calls progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">API Calls (RPD)</span>
            <span className="font-mono font-bold">
              <span className={callPct >= 90 ? 'text-red-600' : callPct >= 70 ? 'text-amber-600' : 'text-emerald-600'}>{fmt(todayCalls)}</span>
              <span className="text-muted-foreground"> / {fmt(DAILY_LIMIT)}</span>
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${callPct}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{callPct}% used</span>
            <span>{fmt(DAILY_LIMIT - todayCalls)} remaining</span>
          </div>
        </div>

        {/* Token counts */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Tokens', value: todayTokens },
            { label: 'Prompt Tokens', value: today?.totalPromptTokens || 0 },
            { label: 'Completion Tokens', value: today?.totalCompletionTokens || 0 },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl bg-muted/40 p-3 text-center">
              <p className="text-lg font-bold font-mono text-foreground">{fmt(stat.value)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* By feature */}
        {today?.byFeature && Object.keys(today.byFeature).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">By Feature (Today)</p>
            <div className="space-y-1.5">
              {Object.entries(today.byFeature as Record<string, any>)
                .sort((a, b) => b[1].totalTokens - a[1].totalTokens)
                .map(([feat, info]) => {
                  const pct = todayTokens > 0 ? Math.round((info.totalTokens / todayTokens) * 100) : 0;
                  return (
                    <div key={feat} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-36 shrink-0">{FEATURE_LABELS[feat] || feat}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-right shrink-0">
                        <span className="text-muted-foreground">{info.calls}×</span>
                        <span className="text-foreground font-semibold w-12">{fmt(info.totalTokens)}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* 7-day history */}
      {data?.dailyHistory?.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h3 className="font-semibold text-foreground">7-Day History</h3>
          <div className="space-y-2">
            {data.dailyHistory.map((day: any) => {
              const p = Math.min(100, Math.round((day.totalCalls / DAILY_LIMIT) * 100));
              return (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-20 shrink-0">{day.date}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full', p >= 90 ? 'bg-red-500' : p >= 50 ? 'bg-amber-500' : 'bg-emerald-500')}
                      style={{ width: `${Math.max(p, 2)}%` }} />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono shrink-0">
                    <span className="text-muted-foreground">{day.totalCalls} calls</span>
                    <span className="text-foreground font-semibold">{fmt(day.totalTokens || 0)} tokens</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data?.error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-500/5 dark:border-amber-500/20 p-4 text-sm text-amber-700 dark:text-amber-400">
          ⚠ {data.error}
        </div>
      )}
    </div>
  );
}
