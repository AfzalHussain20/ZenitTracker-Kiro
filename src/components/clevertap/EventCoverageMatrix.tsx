'use client';

import { useState, useMemo } from 'react';
import {
  CheckCircle2, XCircle, Clock, Minus, Download, Filter,
  Tv, Smartphone, Monitor, Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type CoverageStatus = 'validated' | 'pending' | 'failed' | 'not_applicable';

interface CoverageEntry {
  eventName: string;
  platforms: Record<string, CoverageStatus>;
}

interface EventCoverageMatrixProps {
  events: CoverageEntry[];
  onCellClick?: (eventName: string, platform: string) => void;
  className?: string;
}

const ALL_PLATFORMS = [
  'Android TV', 'Fire TV', 'Apple TV', 'Samsung TV', 'LG TV', 'Roku',
  'Android', 'iOS', 'Web',
];

const PLATFORM_ICONS: Record<string, typeof Monitor> = {
  'Android TV': Tv,
  'Fire TV': Tv,
  'Apple TV': Tv,
  'Samsung TV': Tv,
  'LG TV': Tv,
  'Roku': Tv,
  'Android': Smartphone,
  'iOS': Smartphone,
  'Web': Globe,
};

const STATUS_CONFIG: Record<CoverageStatus, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  validated: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', label: 'Validated' },
  pending: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10', label: 'Pending' },
  failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-500/10', label: 'Failed' },
  not_applicable: { icon: Minus, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-500/5', label: 'N/A' },
};

export default function EventCoverageMatrix({ events, onCellClick, className }: EventCoverageMatrixProps) {
  const [filterStatus, setFilterStatus] = useState<CoverageStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Determine which platforms are actually in use
  const activePlatforms = useMemo(() => {
    const platformSet = new Set<string>();
    for (const event of events) {
      for (const p of Object.keys(event.platforms)) {
        if (event.platforms[p] !== 'not_applicable') {
          platformSet.add(p);
        }
      }
    }
    // Return in standard order, filtering to only those present
    return ALL_PLATFORMS.filter(p => platformSet.has(p));
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let filtered = events;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e => e.eventName.toLowerCase().includes(q));
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(e =>
        Object.values(e.platforms).some(s => s === filterStatus)
      );
    }

    return filtered;
  }, [events, searchQuery, filterStatus]);

  // Summary stats
  const stats = useMemo(() => {
    let validated = 0, pending = 0, failed = 0, total = 0;
    for (const event of events) {
      for (const status of Object.values(event.platforms)) {
        if (status === 'not_applicable') continue;
        total++;
        if (status === 'validated') validated++;
        else if (status === 'pending') pending++;
        else if (status === 'failed') failed++;
      }
    }
    const coverage = total > 0 ? Math.round((validated / total) * 100) : 0;
    return { validated, pending, failed, total, coverage };
  }, [events]);

  // Export as CSV
  const handleExport = () => {
    const headers = ['Event Name', ...activePlatforms].join(',');
    const rows = events.map(e =>
      [e.eventName, ...activePlatforms.map(p => e.platforms[p] || 'not_applicable')].join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'event-coverage-matrix.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (events.length === 0) {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-8 text-center", className)}>
        <p className="text-sm text-muted-foreground">No events to display. Generate analytics events from a PRD first.</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {/* Header with stats */}
      <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-pink-500/5 to-purple-500/5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Event Coverage Matrix</h3>
            <p className="text-[10px] text-muted-foreground">
              {events.length} events × {activePlatforms.length} platforms
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleExport} className="text-xs h-7">
            <Download className="h-3 w-3 mr-1" /> Export CSV
          </Button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">{stats.validated} validated</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-xs text-muted-foreground">{stats.pending} pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-muted-foreground">{stats.failed} failed</span>
          </div>
          <div className="ml-auto text-xs font-bold text-foreground">
            {stats.coverage}% coverage
          </div>
        </div>

        {/* Coverage progress bar */}
        <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden flex">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(stats.validated / Math.max(stats.total, 1)) * 100}%` }} />
          <div className="h-full bg-red-500 transition-all" style={{ width: `${(stats.failed / Math.max(stats.total, 1)) * 100}%` }} />
          <div className="h-full bg-amber-500 transition-all" style={{ width: `${(stats.pending / Math.max(stats.total, 1)) * 100}%` }} />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mt-3">
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 h-7 px-3 text-xs border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as CoverageStatus | 'all')}
            className="text-xs border border-border rounded-md px-2 h-7 bg-background text-foreground"
          >
            <option value="all">All Statuses</option>
            <option value="validated">Validated</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Matrix grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground sticky left-0 bg-muted/30 z-10 min-w-[200px]">
                Event Name
              </th>
              {activePlatforms.map(platform => {
                const PlatformIcon = PLATFORM_ICONS[platform] || Monitor;
                return (
                  <th key={platform} className="text-center px-2 py-2.5 font-medium text-muted-foreground min-w-[80px]">
                    <div className="flex flex-col items-center gap-0.5">
                      <PlatformIcon className="w-3.5 h-3.5" />
                      <span className="text-[9px] leading-tight">{platform}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filteredEvents.map((event) => (
              <tr key={event.eventName} className="hover:bg-muted/10 transition-colors">
                <td className="px-4 py-2 font-mono text-[11px] text-foreground sticky left-0 bg-card z-10">
                  {event.eventName}
                </td>
                {activePlatforms.map(platform => {
                  const status = event.platforms[platform] || 'not_applicable';
                  const config = STATUS_CONFIG[status];
                  const Icon = config.icon;

                  return (
                    <td key={platform} className="text-center px-2 py-2">
                      <button
                        onClick={() => onCellClick?.(event.eventName, platform)}
                        className={cn(
                          'inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all',
                          config.bg,
                          onCellClick && 'hover:scale-110 hover:shadow-sm cursor-pointer'
                        )}
                        title={`${event.eventName} on ${platform}: ${config.label}`}
                      >
                        <Icon className={cn('w-3.5 h-3.5', config.color)} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredEvents.length === 0 && events.length > 0 && (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">No events match the current filters</p>
        </div>
      )}
    </div>
  );
}
