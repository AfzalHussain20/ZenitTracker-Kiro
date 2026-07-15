'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { InvestigationReport, RiskLevel, DuplicateCluster, SameDayCluster, Evidence } from '@/types/investigation';
import type { InvestigationReportV2 } from '@/lib/jira/investigation-engine-v2';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronRight, ExternalLink, Copy, Check,
  Download, Share2, BarChart3, Users, TrendingUp, Shield,
  Layers, Search, Filter, Calendar, Zap, AlertCircle,
  FileText, Star, Target, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';

// ─── Schema adapter — normalises v2 report to v1 display shape ────────────────
function adaptV2ToV1(r: InvestigationReportV2): InvestigationReport {
  const f = r.findings;
  const facts = r.facts;             // facts is TOP-LEVEL in v2, not inside findings
  const meta = r.metadata;
  const rc = f.reportingCharacteristics;
  const ra = f.reporterActivity;
  const vel = f.velocity;

  // Map v2 duplicate pairs to v1 DuplicateCluster[]
  const duplicateClusters: DuplicateCluster[] = f.duplicatePairs
    .filter(p => p.confidenceLabel !== 'INSUFFICIENT_EVIDENCE')
    .map(p => ({
      id: `${p.issueA}-${p.issueB}`,
      normalisedTitle: p.signals.find(s => s.name === 'titleSimilarity')?.explanation || `${p.issueA} ↔ ${p.issueB}`,
      count: 2,
      ticketIds: [p.issueA, p.issueB],
      platforms: p.signals.filter(s => s.name === 'samePlatform' && s.fired).map(() => 'Same platform'),
      dates: [],
      confidence: p.confidenceLabel === 'CONFIRMED' ? 'HIGH' : p.confidenceLabel === 'LIKELY' ? 'MEDIUM' : 'LOW',
      engineeringImpact: p.confidence >= 0.75 ? 'BLOCKER' : p.confidence >= 0.5 ? 'MAJOR' : 'MINOR',
    }));

  // Map v2 cross-platform clusters to v1 SameDayCluster[]
  const sameDayClusters: SameDayCluster[] = f.rootCauseClusters.map(c => ({
    date: '',
    titleSnippet: c.interpretation,
    platforms: c.platforms,
    tickets: c.tickets.map(t => ({ key: t, platform: '', summary: '' })),
    isCrossPlatform: c.platforms.length >= 2,
  }));

  // Map v2 evidence to v1 Evidence[]
  const evidence: Evidence[] = f.evidence.map(e => ({
    id: e.id,
    type: (e.type === 'VELOCITY_ANOMALY' ? 'SPIKE' : e.type === 'DUPLICATE_CLUSTER' ? 'DUPLICATE' : e.type === 'CROSS_PLATFORM_PATTERN' ? 'CROSS_PLATFORM' : 'RESOLUTION') as any,
    title: e.title,
    description: e.description,
    confidence: (e.confidence === 'CONFIRMED' || e.confidence === 'LIKELY') ? 'HIGH' : e.confidence === 'POSSIBLE' ? 'MEDIUM' : 'LOW',
    metrics: e.metrics,
    relatedTickets: e.relatedTickets,
    severity: e.engineeringImpact === 'HIGH' ? 'HIGH' : e.engineeringImpact === 'MEDIUM' ? 'MEDIUM' : 'LOW' as any,
  }));

  const filed = rc?.totalFiled || ra?.bugsReported || facts?.totalIssues || 0;
  const open = facts?.statusCounts
    ? Object.entries(facts.statusCounts).filter(([s]) => ['New','Open','To Do','Reopen'].includes(s)).reduce((a, [, v]) => a + v, 0)
    : 0;
  const resolved = facts?.resolutionCounts
    ? Object.entries(facts.resolutionCounts).filter(([s]) => s !== 'Unresolved').reduce((a, [, v]) => a + v, 0)
    : 0;

  return {
    metadata: {
      id: meta.id,
      reporterName: meta.scope,
      query: meta.query,
      generatedAt: meta.generatedAt,
      totalIssuesAnalyzed: meta.totalIssuesAnalyzed,
      jql: meta.jql,
      investigationScore: r.conclusions?.dimensionScores?.reportingCharacteristics?.value || 50,
      riskLevel: 'MEDIUM',
    },
    reporter: {
      name: meta.scope,
      totalFiled: filed,
      open,
      resolved,
      resolutionRate: filed > 0 ? Math.round((resolved / filed) * 100) : 0,
      activeDays: ra?.activeDays || 0,
      allTimeAvgPerDay: vel?.baseline?.mean || 0,
      last7DayAvgPerDay: 0,
      teamAvgPerReporter: 0,
      vsTeamAvg: 'at',
      platformCount: (ra?.platformsTested || []).length,
      platforms: f.platformCoverage || [],
      statusBreakdown: Object.entries(facts?.statusCounts || {}).sort((a, b) => b[1] - a[1]).map(([status, count]) => ({ status, count })),
      priorityBreakdown: Object.entries(facts?.priorityCounts || {}).sort((a, b) => b[1] - a[1]).map(([priority, count]) => ({ priority, count })),
      typeBreakdown: Object.entries(facts?.typeCounts || {}).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count })),
    },
    timeline: (vel?.dailyCounts || []).map(d => ({
      date: d.date,
      count: d.count,
      isSpikeDay: d.classification === 'UNUSUAL',
      isRecentWeek: d.isRecentWeek ?? false,
    })),
    velocity: {
      topSpikeDays: (vel?.unusualDays || []).slice(0, 10).map(d => ({ date: d.date, count: d.count, isSpike: true })),
      maxSingleDay: Math.max(...(vel?.dailyCounts || []).map(d => d.count), 0),
      medianDay: vel?.baseline?.median || 0,
      spikeRatio: vel?.baseline?.stdDev && vel.baseline.mean ? Math.round((Math.max(...(vel.dailyCounts || []).map(d => d.count), 0) / vel.baseline.mean) * 10) / 10 : 0,
      spikeWarning: (vel?.unusualDays || []).length > 0 ? `⚠ ${vel!.unusualDays[0].explanation}` : null,
    },
    duplicateClusters,
    sameDayClusters,
    platformClusters: (f.platformCoverage || []).map(p => ({ platform: p.platform, count: p.count, percentage: p.percentage, isSingleFocus: p.percentage > 60 })),
    evidence,
    aiFindings: {
      executiveSummary: 'Investigation completed using v2.1 evidence engine.',
      verdict: 'MEDIUM',
      verdictReason: `${duplicateClusters.length} duplicate pairs found. ${(vel?.unusualDays || []).length} unusual velocity days.`,
      nextSteps: (r.conclusions?.dimensionScores ? Object.values(r.conclusions.dimensionScores) : []).map(d => d.limitations?.[0]).filter(Boolean).slice(0, 3),
      generatedFrom: 'fallback',
    },
    teamComparison: {
      teamAvgBugsPerPerson: 0,
      teamAvgResolutionRate: 0,
      teamTopReporters: [],
      reporterRank: 1,
      totalReporters: 1,
    },
  } as InvestigationReport;
}

// ─── Risk badge ───────────────────────────────────────────────────────────────
const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; border: string; icon: typeof AlertTriangle }> = {
  CRITICAL: { label: 'Critical', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/30', icon: AlertTriangle },
  HIGH:     { label: 'High',     color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/30', icon: AlertCircle },
  MEDIUM:   { label: 'Medium',   color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/30', icon: Clock },
  LOW:      { label: 'Low',      color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/30', icon: CheckCircle2 },
};

function RiskBadge({ level, size = 'sm' }: { level: RiskLevel; size?: 'sm' | 'lg' }) {
  const c = RISK_CONFIG[level];
  const Icon = c.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border font-semibold',
      size === 'lg' ? 'px-4 py-2 text-sm' : 'px-2.5 py-1 text-xs',
      c.color, c.bg, c.border)}>
      <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} />
      {c.label}
    </span>
  );
}

// ─── Score gauge ──────────────────────────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const color = score >= 75 ? '#ef4444' : score >= 50 ? '#f97316' : score >= 25 ? '#f59e0b' : '#10b981';
  const pct = score;
  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${pct * 2.51327} ${251.327 - pct * 2.51327}`}
          strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-foreground">{score}</span>
        <span className="text-xs text-muted-foreground font-medium">/ 100</span>
      </div>
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
function SectionCard({ id, title, icon: Icon, children, defaultOpen = true }: {
  id: string; title: string; icon: typeof BarChart3; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} className="rounded-2xl border border-border bg-card overflow-hidden scroll-mt-20">
      <button onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground">{title}</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-6 pb-6 pt-2">{children}</div>}
    </div>
  );
}

// ─── Duplicate cluster card ───────────────────────────────────────────────────
function DuplicateCard({ cluster, jiraBase }: { cluster: DuplicateCluster; jiraBase: string }) {
  const [open, setOpen] = useState(false);
  const confColor = cluster.confidence === 'HIGH' ? 'text-red-600' : cluster.confidence === 'MEDIUM' ? 'text-amber-600' : 'text-blue-600';
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-4 px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left">
        <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', confColor,
          cluster.confidence === 'HIGH' ? 'bg-red-50 dark:bg-red-500/10' : cluster.confidence === 'MEDIUM' ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-blue-50 dark:bg-blue-500/10')}>
          {cluster.confidence}
        </span>
        <span className="flex-1 text-sm font-medium text-foreground min-w-0 truncate">
          [{cluster.count}×] "{cluster.normalisedTitle.substring(0, 60)}"
        </span>
        <span className="text-xs text-muted-foreground shrink-0">{cluster.platforms.join(', ')}</span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-4 py-3 space-y-2 border-t border-border">
          <div className="flex flex-wrap gap-1.5">
            {cluster.ticketIds.map(id => (
              <a key={id} href={`${jiraBase}/browse/${id}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-mono hover:underline border border-blue-200 dark:border-blue-500/20">
                {id} <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <p className="text-xs font-bold text-foreground">{cluster.count}</p>
              <p className="text-[10px] text-muted-foreground">Occurrences</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <p className="text-xs font-bold text-foreground">{cluster.platforms.length}</p>
              <p className="text-[10px] text-muted-foreground">Platforms</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <p className={cn('text-xs font-bold', cluster.engineeringImpact === 'BLOCKER' ? 'text-red-600' : cluster.engineeringImpact === 'MAJOR' ? 'text-orange-600' : 'text-amber-600')}>
                {cluster.engineeringImpact}
              </p>
              <p className="text-[10px] text-muted-foreground">Impact</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Evidence card ────────────────────────────────────────────────────────────
function EvidenceCard({ ev, jiraBase }: { ev: Evidence; jiraBase: string }) {
  const [open, setOpen] = useState(false);
  const sevColor: Record<RiskLevel, string> = {
    CRITICAL: 'border-red-200 bg-red-50 dark:bg-red-500/5 dark:border-red-500/20',
    HIGH:     'border-orange-200 bg-orange-50 dark:bg-orange-500/5 dark:border-orange-500/20',
    MEDIUM:   'border-amber-200 bg-amber-50 dark:bg-amber-500/5 dark:border-amber-500/20',
    LOW:      'border-emerald-200 bg-emerald-50 dark:bg-emerald-500/5 dark:border-emerald-500/20',
  };
  return (
    <div className={cn('rounded-xl border overflow-hidden', sevColor[ev.severity])}>
      <button onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 transition-colors">
        <RiskBadge level={ev.severity} />
        <span className="flex-1 text-sm font-medium text-foreground">{ev.title}</span>
        <span className="text-xs text-muted-foreground shrink-0">Confidence: {ev.confidence}</span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-black/5">
          <p className="text-sm text-muted-foreground leading-relaxed">{ev.description}</p>
          {ev.metrics.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ev.metrics.map((m, i) => (
                <div key={i} className="rounded-lg bg-background/60 border border-border/50 px-3 py-2">
                  <p className="text-xs font-bold text-foreground">{m.value}</p>
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>
          )}
          {ev.relatedTickets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ev.relatedTickets.map(t => (
                <a key={t} href={`${jiraBase}/browse/${t}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[11px] font-mono hover:underline">
                  {t} <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar nav ──────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'executive', label: 'Executive Summary', icon: Star },
  { id: 'reporter', label: 'Reporter Overview', icon: Users },
  { id: 'timeline', label: 'Filing Timeline', icon: Calendar },
  { id: 'velocity', label: 'Velocity Analysis', icon: Zap },
  { id: 'duplicates', label: 'Duplicate Investigation', icon: Layers },
  { id: 'platforms', label: 'Cross-Platform Analysis', icon: Activity },
  { id: 'evidence', label: 'Evidence', icon: Shield },
  { id: 'comparison', label: 'Team Comparison', icon: BarChart3 },
  { id: 'recommendations', label: 'AI Findings', icon: Target },
];

function SidebarNav({ activeSection }: { activeSection: string }) {
  return (
    <nav className="sticky top-20 w-52 shrink-0 hidden lg:block">
      <div className="rounded-2xl border border-border bg-card p-3 space-y-1">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 pb-1">Sections</p>
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <a key={item.id} href={`#${item.id}`}
              className={cn('flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all',
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function InvestigationReportPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [report, setReport] = useState<InvestigationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('executive');
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');

  const jiraBase = process.env.NEXT_PUBLIC_JIRA_BASE_URL || '';

  // Load from sessionStorage (passed from chat) or Firestore
  useEffect(() => {
    const stored = sessionStorage.getItem(`investigation_${id}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Handle v2 schema — adapt to v1 display shape
        const adapted = parsed?.schema === '2.1' ? adaptV2ToV1(parsed) : parsed;
        setReport(adapted);
        setLoading(false);
        return;
      } catch { /* fall through to API */ }
    }

    fetch(`/api/ai/investigate?id=${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.report) {
          const adapted = data.report?.schema === '2.1' ? adaptV2ToV1(data.report) : data.report;
          setReport(adapted);
        } else setError(data.error || 'Investigation not found');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Active section tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id); });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    NAV_ITEMS.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [report]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh] gap-3">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-muted-foreground">Loading investigation report…</span>
    </div>
  );

  if (error || !report) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <AlertCircle className="w-12 h-12 text-muted-foreground/30" />
      <p className="text-muted-foreground">{error || 'Investigation not found'}</p>
      <Link href="/investigations" className="text-primary hover:underline text-sm">← Back to History</Link>
    </div>
  );

  const { metadata, reporter, timeline, velocity, duplicateClusters, sameDayClusters, platformClusters, evidence, aiFindings, teamComparison } = report;
  const riskCfg = RISK_CONFIG[metadata.riskLevel];

  // Filter clusters
  const filteredDuplicates = duplicateClusters.filter(c => {
    if (searchTerm && !c.normalisedTitle.includes(searchTerm.toLowerCase())) return false;
    if (platformFilter !== 'all' && !c.platforms.includes(platformFilter)) return false;
    return true;
  });

  const availablePlatforms = [...new Set(duplicateClusters.flatMap(c => c.platforms))];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/investigations">
            <button className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-bold text-foreground">Investigation Report</h1>
              <RiskBadge level={metadata.riskLevel} />
            </div>
            <p className="text-sm text-muted-foreground">
              {metadata.reporterName} · {new Date(metadata.generatedAt).toLocaleString()} · {metadata.totalIssuesAnalyzed} issues
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-sm hover:bg-muted transition-colors">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
            {copied ? 'Copied' : 'Share'}
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-sm hover:bg-muted transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex gap-6 items-start">
        <SidebarNav activeSection={activeSection} />

        <div className="flex-1 min-w-0 space-y-4">

          {/* Executive Summary */}
          <SectionCard id="executive" title="Executive Summary" icon={Star}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col items-center gap-2">
                <ScoreGauge score={metadata.investigationScore} />
                <p className="text-sm font-semibold text-foreground">Investigation Score</p>
                <RiskBadge level={metadata.riskLevel} size="lg" />
              </div>
              <div className="md:col-span-2 space-y-4">
                <p className="text-sm text-foreground leading-relaxed">{aiFindings.executiveSummary}</p>
                <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Verdict</p>
                  <p className="text-sm font-medium text-foreground">{aiFindings.verdictReason}</p>
                </div>
                {aiFindings.nextSteps.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Next Steps</p>
                    {aiFindings.nextSteps.map((step, i) => (
                      <div key={i} className="flex gap-2.5 text-sm text-foreground">
                        <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Reporter Overview */}
          <SectionCard id="reporter" title="Reporter Overview" icon={Users}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Total Filed', value: reporter.totalFiled, sub: `Rank #${teamComparison.reporterRank} of ${teamComparison.totalReporters}`, color: 'text-blue-600' },
                { label: 'Open Bugs', value: reporter.open, sub: `${Math.round((reporter.open / Math.max(reporter.totalFiled, 1)) * 100)}% unresolved`, color: 'text-orange-600' },
                { label: 'Resolution Rate', value: `${reporter.resolutionRate}%`, sub: `Team avg: ${teamComparison.teamAvgResolutionRate}%`, color: reporter.resolutionRate < 30 ? 'text-red-600' : 'text-emerald-600' },
                { label: 'Avg / Day', value: reporter.allTimeAvgPerDay, sub: 'Active days only', color: 'text-purple-600' },
              ].map(stat => (
                <div key={stat.label} className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className={cn('text-2xl font-black', stat.color)}>{stat.value}</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{stat.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{stat.sub}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Status Breakdown</p>
                <div className="space-y-1.5">
                  {reporter.statusBreakdown.slice(0, 8).map(s => {
                    const pct = Math.round((s.count / reporter.totalFiled) * 100);
                    return (
                      <div key={s.status} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-28 truncate shrink-0">{s.status}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-mono text-foreground w-8 text-right">{s.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Priority Distribution</p>
                <div className="space-y-1.5">
                  {reporter.priorityBreakdown.map(p => {
                    const pct = Math.round((p.count / reporter.totalFiled) * 100);
                    const colors: Record<string, string> = { Highest: 'bg-red-500', High: 'bg-orange-500', Medium: 'bg-amber-400', Low: 'bg-blue-400', Lowest: 'bg-slate-400' };
                    return (
                      <div key={p.priority} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">{p.priority}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className={cn('h-full rounded-full', colors[p.priority] || 'bg-primary/60')} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-mono text-foreground w-8 text-right">{p.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Filing Timeline */}
          <SectionCard id="timeline" title="Filing Timeline" icon={Calendar}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false}
                    tickFormatter={d => d.substring(5)} interval={Math.floor(timeline.length / 8)} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2}
                    fill="url(#tGrad)" dot={false}
                    activeDot={{ r: 4, fill: 'hsl(var(--primary))' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-3 flex-wrap">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-3 rounded-full bg-primary/60" /> Normal day
              </span>
              <span className="flex items-center gap-1.5 text-xs text-amber-600">
                <span className="w-3 h-3 rounded-full bg-amber-500" /> Spike (≥8 bugs)
              </span>
            </div>
          </SectionCard>

          {/* Velocity Analysis */}
          <SectionCard id="velocity" title="Velocity Analysis" icon={Zap}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                {[
                  { label: 'Peak Single Day', value: velocity.maxSingleDay, flag: velocity.maxSingleDay >= 10 },
                  { label: 'Median Daily Rate', value: velocity.medianDay, flag: false },
                  { label: 'Spike Ratio', value: `${velocity.spikeRatio}x`, flag: velocity.spikeRatio >= 5 },
                  { label: 'Last 7-Day Avg', value: reporter.last7DayAvgPerDay, flag: reporter.last7DayAvgPerDay > 5 },
                ].map(s => (
                  <div key={s.label} className={cn('flex items-center justify-between px-4 py-3 rounded-xl border',
                    s.flag ? 'border-orange-200 bg-orange-50 dark:bg-orange-500/5 dark:border-orange-500/20' : 'border-border bg-muted/20')}>
                    <span className="text-sm text-muted-foreground">{s.label}</span>
                    <span className={cn('text-lg font-black', s.flag ? 'text-orange-600' : 'text-foreground')}>{s.value}</span>
                  </div>
                ))}
                {velocity.spikeWarning && (
                  <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/5 dark:border-red-500/20">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dark:text-red-400">{velocity.spikeWarning}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Top Filing Days</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={velocity.topSpikeDays.slice(0, 7)} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                      <XAxis dataKey="date" fontSize={9} tickLine={false} axisLine={false} tickFormatter={d => d.substring(5)} />
                      <YAxis fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {velocity.topSpikeDays.slice(0, 7).map((entry, i) => (
                          <Cell key={i} fill={entry.isSpike ? '#f97316' : 'hsl(var(--primary))'} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Duplicate Investigation */}
          <SectionCard id="duplicates" title={`Duplicate Investigation (${duplicateClusters.length} clusters)`} icon={Layers}>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input type="text" placeholder="Search duplicate titles…" value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full h-8 pl-9 pr-3 text-xs border border-border rounded-xl bg-background focus:outline-none focus:ring-1 focus:ring-primary/30" />
              </div>
              <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}
                className="h-8 px-3 text-xs border border-border rounded-xl bg-background">
                <option value="all">All Platforms</option>
                {availablePlatforms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {filteredDuplicates.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-6">No duplicate clusters found{searchTerm || platformFilter !== 'all' ? ' matching filters' : ''}.</p>
              : <div className="space-y-2">{filteredDuplicates.map(c => <DuplicateCard key={c.id} cluster={c} jiraBase={jiraBase} />)}</div>
            }
          </SectionCard>

          {/* Cross-Platform Analysis */}
          <SectionCard id="platforms" title="Cross-Platform Analysis" icon={Activity}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                {platformClusters.map(pc => (
                  <div key={pc.platform} className={cn('flex items-center gap-3 px-4 py-2.5 rounded-xl border',
                    pc.isSingleFocus ? 'border-orange-200 bg-orange-50 dark:bg-orange-500/5 dark:border-orange-500/20' : 'border-border bg-muted/20')}>
                    {pc.isSingleFocus && <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                    <span className="flex-1 text-sm text-foreground truncate">{pc.platform}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                        <div className={cn('h-full rounded-full', pc.isSingleFocus ? 'bg-orange-500' : 'bg-primary/60')} style={{ width: `${pc.percentage}%` }} />
                      </div>
                      <span className="text-xs font-mono text-foreground w-12 text-right">{pc.count} ({pc.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Same-Day Cross-Platform Incidents</p>
                {sameDayClusters.filter(c => c.isCrossPlatform).slice(0, 5).map((c, i) => (
                  <div key={i} className="mb-3 p-3 rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-500/5 dark:border-orange-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-muted-foreground">{c.date}</span>
                      <span className="text-xs text-orange-600 font-medium">{c.platforms.join(' · ')}</span>
                    </div>
                    <p className="text-xs text-foreground truncate">"{c.titleSnippet}"</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.tickets.map(t => (
                        <a key={t.key} href={jiraBase ? `${jiraBase}/browse/${t.key}` : '#'} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] font-mono px-1.5 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded hover:underline">
                          {t.key}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
                {sameDayClusters.filter(c => c.isCrossPlatform).length === 0 && (
                  <p className="text-sm text-muted-foreground">No same-day cross-platform incidents detected.</p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Evidence */}
          <SectionCard id="evidence" title={`Evidence (${evidence.length} findings)`} icon={Shield}>
            {evidence.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-6">No suspicious evidence flags generated.</p>
              : <div className="space-y-2">{evidence.map(ev => <EvidenceCard key={ev.id} ev={ev} jiraBase={jiraBase} />)}</div>
            }
          </SectionCard>

          {/* Team Comparison */}
          <SectionCard id="comparison" title="Team Comparison" icon={BarChart3}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                {[
                  { label: 'Bugs Filed', reporter: reporter.totalFiled, teamAvg: teamComparison.teamAvgBugsPerPerson },
                  { label: 'Resolution Rate', reporter: reporter.resolutionRate, teamAvg: teamComparison.teamAvgResolutionRate, suffix: '%' },
                  { label: 'Avg Bugs / Day', reporter: reporter.allTimeAvgPerDay, teamAvg: Math.round(teamComparison.teamAvgBugsPerPerson / Math.max(reporter.activeDays, 1) * 10) / 10 },
                ].map(c => {
                  const ratio = c.teamAvg > 0 ? c.reporter / c.teamAvg : 1;
                  const above = ratio > 1.2;
                  return (
                    <div key={c.label} className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{c.label}</span>
                        <span>{c.reporter}{c.suffix || ''} vs {c.teamAvg}{c.suffix || ''} avg</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden relative">
                          <div className="h-full rounded-full bg-muted-foreground/30" style={{ width: '100%' }} />
                          <div className={cn('absolute top-0 left-0 h-full rounded-full', above ? 'bg-orange-500' : 'bg-emerald-500')}
                            style={{ width: `${Math.min(100, Math.round(ratio * 50))}%` }} />
                        </div>
                        <span className={cn('text-xs font-bold w-12 text-right', above ? 'text-orange-600' : 'text-emerald-600')}>
                          {ratio >= 2 ? `${Math.round(ratio * 10) / 10}×` : `${Math.round(ratio * 100)}%`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Top Reporters vs This Person</p>
                <div className="space-y-1.5">
                  {teamComparison.teamTopReporters.slice(0, 8).map((r, i) => {
                    const isTarget = r.name.toLowerCase().includes(reporter.name.toLowerCase());
                    return (
                      <div key={r.name} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
                        isTarget ? 'bg-primary/10 border border-primary/20' : 'bg-muted/20')}>
                        <span className="w-5 text-center font-mono text-muted-foreground">#{i + 1}</span>
                        <span className={cn('flex-1 truncate', isTarget ? 'font-bold text-primary' : 'text-foreground')}>{r.name}</span>
                        <span className="font-mono text-foreground w-10 text-right">{r.count}</span>
                        <span className="text-muted-foreground w-10 text-right">{r.rate}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* AI Findings */}
          <SectionCard id="recommendations" title="AI Findings & Recommendations" icon={Target}>
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border bg-gradient-to-r from-primary/5 to-transparent">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Executive Summary</p>
                <p className="text-sm text-foreground leading-relaxed">{aiFindings.executiveSummary}</p>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/20">
                <RiskBadge level={aiFindings.verdict} size="lg" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{aiFindings.verdictReason}</p>
                  <p className="text-xs text-muted-foreground mt-1">Generated {aiFindings.generatedFrom === 'ai' ? 'by AI from real data' : 'from fallback — AI was unavailable'}</p>
                </div>
              </div>
              {aiFindings.nextSteps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recommended Actions</p>
                  {aiFindings.nextSteps.map((step, i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-xl border border-border bg-muted/10">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <p className="text-sm text-foreground">{step}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

        </div>{/* end flex-1 */}
      </div>{/* end body */}
    </div>
  );
}
