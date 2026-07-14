'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Activity, Copy, Check, Filter, ChevronDown, ChevronRight,
  Loader2, AlertCircle, Search, Download, Zap, Smartphone,
  Monitor, Tv, Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AnalyticsTestCase, AnalyticsPlatform, Priority } from '@/types/test-cases';

interface AnalyticsEventsPanelProps {
  pageId: string;
  pageTitle: string;
  onClose?: () => void;
}

const PLATFORM_ICONS: Record<string, typeof Monitor> = {
  'Android': Smartphone,
  'iOS': Smartphone,
  'Web': Globe,
  'Android TV': Tv,
  'Fire TV': Tv,
  'Apple TV': Tv,
  'Samsung TV': Tv,
  'LG TV': Tv,
  'Roku': Tv,
  'All': Activity,
};

const PLATFORM_COLORS: Record<string, string> = {
  'Android': 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
  'iOS': 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  'Web': 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
  'Android TV': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  'Fire TV': 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  'Apple TV': 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-400',
  'Samsung TV': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',
  'LG TV': 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  'Roku': 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  'All': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400',
};

const PRIORITY_COLORS: Record<Priority, string> = {
  P0: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  P1: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  P2: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
};

export default function AnalyticsEventsPanel({ pageId, pageTitle, onClose }: AnalyticsEventsPanelProps) {
  const [events, setEvents] = useState<AnalyticsTestCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<AnalyticsPlatform | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Generate analytics events
  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/generate-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, pass: 'analytics' }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Generation failed (${res.status})`);
      }

      setEvents(data.analyticsTestCases || []);
      setGenerated(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate analytics events');
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let filtered = events;

    if (platformFilter !== 'all') {
      filtered = filtered.filter(e => e.platform === platformFilter);
    }
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(e => e.priority === priorityFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.eventName.toLowerCase().includes(q) ||
        e.module.toLowerCase().includes(q) ||
        e.triggerAction.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [events, platformFilter, priorityFilter, searchQuery]);

  // Group by module
  const groupedByModule = useMemo(() => {
    const groups: Record<string, AnalyticsTestCase[]> = {};
    for (const event of filteredEvents) {
      const mod = event.module || 'General';
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(event);
    }
    return groups;
  }, [filteredEvents]);

  // Available platforms from generated data
  const availablePlatforms = useMemo(() => {
    return [...new Set(events.map(e => e.platform))].sort();
  }, [events]);

  // Toggle expand
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Copy to clipboard
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export as JSON
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-events-${pageTitle.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Not generated yet — show CTA ──────────────────────────────────────
  if (!generated && !loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 flex items-center justify-center">
          <Activity className="w-7 h-7 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-base font-semibold text-foreground">Analytics Event Validator</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Extract all analytics events from this PRD and generate validation test cases with
            platform-specific fields and ready-to-copy OpenSearch queries.
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          className="mt-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
        >
          <Zap className="h-4 w-4 mr-2" />
          Generate Analytics Events
        </Button>
      </div>
    );
  }

  // ─── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Extracting analytics events...</p>
          <p className="text-xs text-muted-foreground mt-1">Analyzing PRD for trackable events and fields</p>
        </div>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 p-6 flex flex-col items-center gap-3">
        <AlertCircle className="w-6 h-6 text-red-500" />
        <p className="text-sm text-red-700 dark:text-red-400 text-center">{error}</p>
        <Button size="sm" variant="outline" onClick={handleGenerate}>
          Try Again
        </Button>
      </div>
    );
  }

  // ─── Results ────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-amber-500/5 to-orange-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Analytics Events</h3>
              <p className="text-[10px] text-muted-foreground">
                {events.length} events across {availablePlatforms.length} platform{availablePlatforms.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleGenerate} className="text-xs h-7">
              Regenerate
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport} className="text-xs h-7">
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-7 pl-8 pr-3 text-xs border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/30"
            />
          </div>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as AnalyticsPlatform | 'all')}
            className="text-xs border border-border rounded-md px-2 h-7 bg-background text-foreground"
          >
            <option value="all">All Platforms</option>
            {availablePlatforms.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as Priority | 'all')}
            className="text-xs border border-border rounded-md px-2 h-7 bg-background text-foreground"
          >
            <option value="all">All Priorities</option>
            <option value="P0">P0 - Critical</option>
            <option value="P1">P1 - Major</option>
            <option value="P2">P2 - Minor</option>
          </select>
        </div>
      </div>

      {/* Event List grouped by module */}
      <div className="max-h-[600px] overflow-y-auto divide-y divide-border/50">
        {Object.entries(groupedByModule).map(([module, moduleEvents]) => (
          <div key={module}>
            {/* Module Header */}
            <div className="px-5 py-2 bg-muted/30 border-b border-border/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {module} ({moduleEvents.length})
              </p>
            </div>

            {/* Events in module */}
            {moduleEvents.map((event) => {
              const isExpanded = expandedIds.has(event.id);
              const PlatformIcon = PLATFORM_ICONS[event.platform] || Activity;

              return (
                <div key={event.id} className="px-5 py-3 hover:bg-muted/20 transition-colors">
                  {/* Event row */}
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleExpand(event.id)} className="shrink-0 text-muted-foreground hover:text-foreground">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    <code className="text-xs font-mono font-medium text-foreground flex-1 min-w-0 truncate">
                      {event.eventName}
                    </code>

                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium shrink-0', PLATFORM_COLORS[event.platform] || PLATFORM_COLORS['All'])}>
                      <PlatformIcon className="w-3 h-3 inline mr-1" />
                      {event.platform}
                    </span>

                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0', PRIORITY_COLORS[event.priority])}>
                      {event.priority}
                    </span>

                    <button
                      onClick={() => handleCopy(event.openSearchQuery, event.id)}
                      className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy OpenSearch query"
                    >
                      {copiedId === event.id
                        ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                        : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-3 ml-7 space-y-3">
                      {/* Trigger Action */}
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Trigger Action</p>
                        <p className="text-xs text-foreground">{event.triggerAction}</p>
                      </div>

                      {/* Required Fields */}
                      {event.fields.length > 0 && (
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Required Fields</p>
                          <div className="rounded-lg border border-border overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-muted/30">
                                  <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Field</th>
                                  <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Expected Value</th>
                                  <th className="text-center px-3 py-1.5 font-medium text-muted-foreground">Required</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/30">
                                {event.fields.map((field, fi) => (
                                  <tr key={fi}>
                                    <td className="px-3 py-1.5 font-mono text-[11px]">{field.name}</td>
                                    <td className="px-3 py-1.5 text-muted-foreground">{field.expectedValue || '—'}</td>
                                    <td className="px-3 py-1.5 text-center">
                                      {field.required
                                        ? <span className="text-emerald-600 font-medium">✓</span>
                                        : <span className="text-muted-foreground">○</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* OpenSearch Query */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">OpenSearch Query</p>
                          <button
                            onClick={() => handleCopy(event.openSearchQuery, `query-${event.id}`)}
                            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            {copiedId === `query-${event.id}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            {copiedId === `query-${event.id}` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <pre className="text-[11px] bg-muted/50 border border-border rounded-lg p-3 font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
                          {event.openSearchQuery}
                        </pre>
                      </div>

                      {/* Notes */}
                      {event.notes && (
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                          <p className="text-xs text-muted-foreground italic">{event.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {filteredEvents.length === 0 && events.length > 0 && (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">No events match the current filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
