'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Users,
  CalendarDays,
  UserCheck,
  RefreshCw,
  AlertCircle,
  Clock,
  Globe,
  Loader2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { AnalyticsCount, AnalyticsSummary } from '@/lib/analytics-summary';

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

function fmt(n: number): string {
  return n.toLocaleString();
}

function shortDay(date: string): string {
  return date.slice(5).replace('-', '/');
}

function timeAgo(iso: string): string {
  if (!iso) return '—';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  hint: string;
  icon: typeof Activity;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-5`} />
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1.5 tabular-nums">{value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
          </div>
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${accent}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RankList({
  items,
  empty,
}: {
  items: AnalyticsCount[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{empty}</p>;
  }
  const max = items[0]?.count || 1;
  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.key} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium" title={item.label}>
              {item.label}
            </span>
            <span className="tabular-nums text-muted-foreground shrink-0">
              {fmt(item.count)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500"
              style={{ width: `${Math.max((item.count / max) * 100, 3)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>(30);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (days: Range) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/summary?days=${days}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      setData(json as AnalyticsSummary);
    } catch (err: any) {
      setError(err?.message || 'Failed to load usage analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const hasData = Boolean(data && data.totalEvents > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium mb-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            First-party usage
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Usage Analytics</h1>
          <p className="text-muted-foreground mt-1">
            What people actually do in Zenit, recorded server-side in
            {' '}<code className="text-xs px-1 py-0.5 rounded bg-muted">analytics_events</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  range === r
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r}d
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(range)}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                Could not load usage analytics
              </p>
              <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => load(range)}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-[104px]" />
            ))}
          </div>
          <Skeleton className="h-72" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        </div>
      )}

      {/* Empty */}
      {!loading && data && !hasData && (
        <Card>
          <CardContent className="p-10 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20 flex items-center justify-center">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">No usage events yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Events are recorded as people use the app. Once activity comes in, this
                dashboard shows the most-used features, active users and daily trends.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => load(range)}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Check again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Data */}
      {data && hasData && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Total events"
              value={fmt(data.totalEvents)}
              hint={data.truncated ? 'Partial — read cap reached' : `Last ${data.windowDays} days`}
              icon={Activity}
              accent="from-blue-500 to-cyan-600"
            />
            <KpiCard
              title="Unique users"
              value={fmt(data.uniqueUsers)}
              hint="Distinct signed-in users"
              icon={Users}
              accent="from-purple-500 to-indigo-600"
            />
            <KpiCard
              title="Events today"
              value={fmt(data.eventsToday)}
              hint={`${fmt(data.activeUsers7d)} active in 7d`}
              icon={CalendarDays}
              accent="from-green-500 to-emerald-600"
            />
            <KpiCard
              title="Last 7 days"
              value={fmt(data.events7d)}
              hint={`${fmt(data.events30d)} in 30d`}
              icon={UserCheck}
              accent="from-amber-500 to-orange-600"
            />
          </div>

          {/* Daily trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                Daily activity
              </CardTitle>
              <CardDescription>Events and distinct users per day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.byDay} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="evtFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="usrFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDay}
                      tick={{ fontSize: 11 }}
                      minTickGap={24}
                      className="text-muted-foreground"
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <Tooltip
                      labelFormatter={(label) => String(label)}
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--card))',
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Events"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#evtFill)"
                    />
                    <Area
                      type="monotone"
                      dataKey="users"
                      name="Users"
                      stroke="#a855f7"
                      strokeWidth={2}
                      fill="url(#usrFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top events */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Most-used features</CardTitle>
                <CardDescription>Top events by volume in the selected window</CardDescription>
              </CardHeader>
              <CardContent>
                <RankList items={data.topEvents} empty="No events in this window" />
              </CardContent>
            </Card>

            {/* Top users */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Most active users</CardTitle>
                <CardDescription>Top users by recorded events</CardDescription>
              </CardHeader>
              <CardContent>
                <RankList items={data.topUsers} empty="No user activity in this window" />
              </CardContent>
            </Card>
          </div>

          {/* Domains */}
          {data.byDomain.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="h-4 w-4 text-primary" />
                  By domain
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {data.byDomain.map(d => (
                  <Badge key={d.key} variant="secondary" className="text-xs">
                    {d.label}
                    <span className="ml-1.5 tabular-nums opacity-70">{fmt(d.count)}</span>
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent events */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" />
                Recent events
              </CardTitle>
              <CardDescription>The latest recorded activity</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-border bg-muted/30 text-left">
                      <th className="px-4 py-2 font-medium text-muted-foreground">When</th>
                      <th className="px-4 py-2 font-medium text-muted-foreground">Event</th>
                      <th className="px-4 py-2 font-medium text-muted-foreground">User</th>
                      <th className="px-4 py-2 font-medium text-muted-foreground">Domain</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {data.recent.map((event, i) => (
                      <tr key={`${event.id}-${i}`} className="hover:bg-muted/20">
                        <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                          {timeAgo(event.timestamp)}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{event.eventType}</td>
                        <td className="px-4 py-2 truncate max-w-[180px]">{event.userName}</td>
                        <td className="px-4 py-2 text-muted-foreground">{event.domain}</td>
                      </tr>
                    ))}
                    {data.recent.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                          No recent events
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {data.truncated && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3" />
              Showing the most recent 5,000 events; older activity is not included in these totals.
            </p>
          )}
        </>
      )}
    </div>
  );
}
