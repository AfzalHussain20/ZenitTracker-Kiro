'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Clock, AlertTriangle, CheckCircle2, AlertCircle, TrendingUp, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RiskLevel } from '@/types/investigation';

interface InvestigationIndex {
  id: string;
  reporterName: string;
  query: string;
  generatedAt: string;
  totalIssuesAnalyzed: number;
  investigationScore: number;
  riskLevel: RiskLevel;
  executiveSummary: string;
  verdict: RiskLevel;
}

const RISK_ICONS: Record<RiskLevel, typeof AlertTriangle> = {
  CRITICAL: AlertTriangle, HIGH: AlertCircle, MEDIUM: Clock, LOW: CheckCircle2,
};
const RISK_COLORS: Record<RiskLevel, string> = {
  CRITICAL: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20',
  HIGH:     'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/20',
  MEDIUM:   'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20',
  LOW:      'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20',
};

export default function InvestigationsPage() {
  const [investigations, setInvestigations] = useState<InvestigationIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/ai/investigations?limit=30')
      .then(r => r.json())
      .then(d => setInvestigations(d.investigations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = investigations.filter(inv =>
    !search || inv.reporterName.toLowerCase().includes(search.toLowerCase()) || inv.query.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            Investigation History
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-12">All forensic investigations — click to reopen any report</p>
        </div>
        <Link href="/analytics/bugs" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New Investigation
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search by reporter name or query…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 text-sm border border-border rounded-2xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl border border-border bg-muted/20 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Shield className="w-12 h-12 text-muted-foreground/20" />
          <div className="text-center">
            <p className="font-medium text-foreground">No investigations yet</p>
            <p className="text-sm text-muted-foreground mt-1">Run an investigation from the Jira KPI dashboard</p>
          </div>
          <Link href="/analytics/bugs" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Start Investigation
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(inv => {
            const Icon = RISK_ICONS[inv.riskLevel];
            return (
              <Link key={inv.id} href={`/investigations/${inv.id}`}
                className="block rounded-2xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-md transition-all group">
                <div className="flex items-start gap-4">
                  <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center shrink-0', RISK_COLORS[inv.riskLevel])}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{inv.reporterName}</span>
                      <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border', RISK_COLORS[inv.riskLevel])}>
                        {inv.riskLevel} · {inv.investigationScore}/100
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{inv.executiveSummary}</p>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{inv.totalIssuesAnalyzed} issues</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(inv.generatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
