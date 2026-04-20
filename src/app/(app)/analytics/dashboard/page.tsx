/**
 * Analytics Dashboard Page
 * Validates: Requirements 8.1, 8.2, 8.3, 8.7, 11.1, 12.7
 */

'use client';

import React, { useState, useEffect } from 'react';
import { DataVisualizer, ChartData } from '@/components/analytics/DataVisualizer';
import { MetricCard } from '@/components/analytics/MetricCard';
import { FilterPanel, FilterState } from '@/components/analytics/FilterPanel';
import { FirebaseConnector } from '@/lib/firebase-connector';
import { TimeFilter } from '@/lib/time-filter';
import { EnhancedBug } from '@/types/bug-analytics';
import { Bug, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebaseConfig';

export default function AnalyticsDashboardPage() {
  const [filters, setFilters] = useState<FilterState>({
    timePreset: 'current_month',
  });
  const [bugs, setBugs] = useState<EnhancedBug[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalBugs: 0,
    openBugs: 0,
    resolutionRate: 0,
    avgTimeToResolve: 0,
  });

  const connector = new FirebaseConnector(db);
  const timeFilter = new TimeFilter();

  useEffect(() => {
    loadDashboardData();
  }, [filters]);

  const loadDashboardData = async () => {
    setLoading(true);

    try {
      // Get time range
      const timeRange = filters.customDateRange
        ? { start: filters.customDateRange.start, end: filters.customDateRange.end, preset: 'custom' as const }
        : timeFilter.getPresetRange(filters.timePreset || 'current_month');

      // Fetch bugs
      const allBugs = await connector.query<EnhancedBug>('bugs', {
        orderBy: { field: 'createdAt', direction: 'desc' },
      });

      // Filter bugs by time range and other filters
      const filteredBugs = allBugs.filter(bug => {
        const bugDate = bug.createdAt?.toDate();
        if (!bugDate) return false;

        // Time filter
        if (bugDate < timeRange.start || bugDate > timeRange.end) return false;

        // Category filter
        if (filters.categories?.length && !filters.categories.some(c => Object.values(bug.categories || {}).includes(c as any))) return false;

        // Severity filter (mapped to priority in EnhancedBug)
        if (filters.severities?.length && !filters.severities.includes(bug.priority as any)) return false;

        // Status filter
        if (filters.statuses?.length && !filters.statuses.includes(bug.status)) return false;

        return true;
      });

      setBugs(filteredBugs);

      // Calculate metrics
      const totalBugs = filteredBugs.length;
      const openBugs = filteredBugs.filter(b => b.status === 'open' || b.status === 'in_progress').length;
      const resolvedBugs = filteredBugs.filter(b => b.status === 'resolved' || b.status === 'closed').length;
      const resolutionRate = totalBugs > 0 ? (resolvedBugs / totalBugs) * 100 : 0;

      // Calculate average time to resolve
      const resolvedWithTime = filteredBugs.filter(
        b => (b.status === 'resolved' || b.status === 'closed') && b.resolvedAt && b.createdAt
      );
      const avgTime = resolvedWithTime.length > 0
        ? resolvedWithTime.reduce((sum, bug) => {
            const created = bug.createdAt!.toDate().getTime();
            const resolved = bug.resolvedAt!.toDate().getTime();
            return sum + (resolved - created);
          }, 0) / resolvedWithTime.length
        : 0;
      const avgDays = avgTime / (1000 * 60 * 60 * 24);

      setMetrics({
        totalBugs,
        openBugs,
        resolutionRate: Math.round(resolutionRate),
        avgTimeToResolve: Math.round(avgDays * 10) / 10,
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data — EnhancedBug uses BugPriority: P0-P4
  const severityData: ChartData[] = [
    { name: 'P0 (Critical)', value: bugs.filter(b => b.priority === 'P0').length },
    { name: 'P1 (High)', value: bugs.filter(b => b.priority === 'P1').length },
    { name: 'P2 (Medium)', value: bugs.filter(b => b.priority === 'P2').length },
    { name: 'P3 (Low)', value: bugs.filter(b => b.priority === 'P3').length },
    { name: 'P4 (Trivial)', value: bugs.filter(b => b.priority === 'P4').length },
  ].filter(d => d.value > 0);

  const categoryData: ChartData[] = [
    { name: 'Functional', value: bugs.filter(b => b.categories?.type === 'functional').length },
    { name: 'UI', value: bugs.filter(b => b.categories?.type === 'ui').length },
    { name: 'Performance', value: bugs.filter(b => b.categories?.type === 'performance').length },
    { name: 'Security', value: bugs.filter(b => b.categories?.type === 'security').length },
    { name: 'Crash', value: bugs.filter(b => b.categories?.type === 'crash').length },
    { name: 'Data', value: bugs.filter(b => b.categories?.type === 'data').length },
  ].filter(d => d.value > 0);

  // Trend data (group by day)
  const trendData: ChartData[] = (() => {
    const grouped: Record<string, number> = {};
    bugs.forEach(bug => {
      if (bug.createdAt) {
        const date = bug.createdAt.toDate().toISOString().split('T')[0];
        grouped[date] = (grouped[date] || 0) + 1;
      }
    });
    return Object.entries(grouped)
      .map(([date, count]) => ({ name: date, value: count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Analytics Dashboard</h1>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Bugs"
          value={metrics.totalBugs}
          description="All bugs in selected period"
          icon={Bug}
        />
        <MetricCard
          title="Open Bugs"
          value={metrics.openBugs}
          description="Currently open or in progress"
          icon={TrendingUp}
        />
        <MetricCard
          title="Resolution Rate"
          value={`${metrics.resolutionRate}%`}
          description="Percentage of resolved bugs"
          icon={CheckCircle}
        />
        <MetricCard
          title="Avg Time to Resolve"
          value={`${metrics.avgTimeToResolve}d`}
          description="Average days to resolution"
          icon={Clock}
        />
      </div>

      {/* Charts and Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <DataVisualizer
            title="Bug Distribution by Severity"
            data={severityData}
            chartType="pie"
            colors={['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#6b7280']}
          />

          <DataVisualizer
            title="Bug Trends Over Time"
            data={trendData}
            chartType="line"
            xAxisKey="name"
            dataKey="value"
            height={250}
          />

          <DataVisualizer
            title="Bugs by Category"
            data={categoryData}
            chartType="bar"
            xAxisKey="name"
            dataKey="value"
            height={250}
          />
        </div>

        <div>
          <FilterPanel filters={filters} onFiltersChange={setFilters} />
        </div>
      </div>
    </div>
  );
}
