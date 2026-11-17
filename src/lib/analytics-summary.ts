/**
 * Pure aggregation for the usage dashboard.
 *
 * Kept free of Firestore/Next imports so it can be unit-tested and reused.
 * Events are the documents stored in `analytics_events`; `timestamp` and
 * `createdAt` arrive in mixed shapes depending on which writer produced them
 * (ISO string from the track API, Firestore timestamp from the client SDK), so
 * `eventMillis` normalises all of them.
 */

export interface AnalyticsEventLike {
  id?: string;
  eventType?: string;
  domain?: string;
  userId?: string;
  userName?: string;
  timestamp?: unknown;
  createdAt?: unknown;
  metadata?: Record<string, any>;
  sessionId?: string;
}

export interface AnalyticsSummaryOptions {
  /** How many days of daily buckets to return. */
  windowDays?: number;
  /** Injectable clock for deterministic tests. */
  now?: number;
  /**
   * Timezone used for "today" and daily buckets, in minutes east of UTC.
   * Defaults to IST (330) because that is how the team reads dates; a UTC
   * boundary would roll "today" over at 05:30 local time.
   */
  timezoneOffsetMinutes?: number;
  recentLimit?: number;
  topLimit?: number;
  /** True when the source query hit its row cap and the totals are partial. */
  truncated?: boolean;
}

export interface AnalyticsCount {
  key: string;
  label: string;
  count: number;
}

export interface AnalyticsDay {
  date: string;
  count: number;
  users: number;
}

export interface AnalyticsRecentEvent {
  id: string;
  eventType: string;
  domain: string;
  userId: string;
  userName: string;
  timestamp: string;
  source: string;
  appName: string;
}

export interface AnalyticsSummary {
  generatedAt: string;
  windowDays: number;
  /** Events inside the selected window. */
  totalEvents: number;
  /** Rows pulled from Firestore, including those outside the window. */
  rowsRead: number;
  uniqueUsers: number;
  eventsToday: number;
  events7d: number;
  events30d: number;
  activeUsers7d: number;
  topEvents: AnalyticsCount[];
  topUsers: AnalyticsCount[];
  byDomain: AnalyticsCount[];
  byDay: AnalyticsDay[];
  recent: AnalyticsRecentEvent[];
  truncated: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ANONYMOUS = 'anonymous';

/** Normalise a timestamp-ish value to epoch milliseconds, or null. */
export function toMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Accept seconds as well as milliseconds.
    return value < 1e12 ? Math.round(value * 1000) : value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === 'object') {
    const obj = value as any;
    if (typeof obj.toMillis === 'function') {
      try {
        return obj.toMillis();
      } catch {
        /* fall through */
      }
    }
    if (typeof obj.toDate === 'function') {
      try {
        return obj.toDate().getTime();
      } catch {
        /* fall through */
      }
    }
    if (typeof obj.seconds === 'number') {
      return obj.seconds * 1000 + Math.round((obj.nanoseconds || 0) / 1e6);
    }
  }
  return null;
}

/** The best timestamp we can derive for an event. */
export function eventMillis(event: AnalyticsEventLike): number | null {
  return (
    toMillis(event.createdAt) ??
    toMillis(event.timestamp) ??
    toMillis(event.metadata?.$D_timestamp)
  );
}

function isoDay(ms: number, offsetMs: number): string {
  return new Date(ms + offsetMs).toISOString().slice(0, 10);
}

/** Epoch millis of local midnight for the day containing `ms`. */
function startOfDay(ms: number, offsetMs: number): number {
  const d = new Date(ms + offsetMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - offsetMs;
}

function bump(map: Map<string, { label: string; count: number }>, key: string, label: string) {
  const existing = map.get(key);
  if (existing) existing.count += 1;
  else map.set(key, { label, count: 1 });
}

function toCounts(
  map: Map<string, { label: string; count: number }>,
  limit: number,
): AnalyticsCount[] {
  return [...map.entries()]
    .map(([key, value]) => ({ key, label: value.label, count: value.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export function summarizeEvents(
  events: AnalyticsEventLike[],
  options: AnalyticsSummaryOptions = {},
): AnalyticsSummary {
  const now = options.now ?? Date.now();
  const windowDays = Math.min(Math.max(Math.round(options.windowDays ?? 30), 1), 365);
  const recentLimit = options.recentLimit ?? 20;
  const topLimit = options.topLimit ?? 10;
  const offsetMs = (options.timezoneOffsetMinutes ?? 330) * 60_000;

  const todayStart = startOfDay(now, offsetMs);
  const weekStart = now - 7 * DAY_MS;
  const monthStart = now - 30 * DAY_MS;
  const windowStart = todayStart - (windowDays - 1) * DAY_MS;

  const uniqueUsers = new Set<string>();
  const activeUsers7d = new Set<string>();
  const topEvents = new Map<string, { label: string; count: number }>();
  const topUsers = new Map<string, { label: string; count: number }>();
  const byDomain = new Map<string, { label: string; count: number }>();

  const days = new Map<string, { count: number; users: Set<string> }>();
  for (let i = 0; i < windowDays; i++) {
    days.set(isoDay(windowStart + i * DAY_MS, offsetMs), { count: 0, users: new Set() });
  }

  let eventsToday = 0;
  let events7d = 0;
  let events30d = 0;
  // Totals are scoped to the selected window so the KPI labels ("last N days")
  // are truthful. `totalEvents` is the number of rows read, which is exposed
  // separately as `rowsRead`.
  let windowEvents = 0;

  const recent: Array<{ ms: number | null; event: AnalyticsEventLike }> = [];

  for (const event of events) {
    const userId = event.userId || ANONYMOUS;

    const ms = eventMillis(event);
    const inWindow = ms == null || ms >= windowStart;

    if (ms != null) {
      if (ms >= todayStart) eventsToday += 1;
      if (ms >= weekStart) {
        events7d += 1;
        if (userId !== ANONYMOUS) activeUsers7d.add(userId);
      }
      if (ms >= monthStart) events30d += 1;

      const dayKey = isoDay(ms, offsetMs);
      const bucket = days.get(dayKey);
      if (bucket) {
        bucket.count += 1;
        // Anonymous events count toward volume but not distinct users.
        if (userId !== ANONYMOUS) bucket.users.add(userId);
      }
    }

    if (inWindow) {
      windowEvents += 1;
      if (userId !== ANONYMOUS) uniqueUsers.add(userId);
      bump(topEvents, event.eventType || 'unknown', event.eventType || 'Unknown');
      bump(topUsers, userId, event.userName || userId);
      bump(byDomain, event.domain || 'unknown', event.domain || 'Unknown');
      recent.push({ ms, event });
    }
  }

  recent.sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0));

  return {
    generatedAt: new Date(now).toISOString(),
    windowDays,
    totalEvents: windowEvents,
    rowsRead: events.length,
    uniqueUsers: uniqueUsers.size,
    eventsToday,
    events7d,
    events30d,
    activeUsers7d: activeUsers7d.size,
    topEvents: toCounts(topEvents, topLimit),
    topUsers: toCounts(topUsers, topLimit),
    byDomain: toCounts(byDomain, topLimit),
    byDay: [...days.entries()].map(([date, value]) => ({
      date,
      count: value.count,
      users: value.users.size,
    })),
    recent: recent.slice(0, recentLimit).map(({ ms, event }) => ({
      id: event.id || '',
      eventType: event.eventType || 'unknown',
      domain: event.domain || 'unknown',
      userId: event.userId || ANONYMOUS,
      userName: event.userName || event.userId || ANONYMOUS,
      timestamp: ms != null ? new Date(ms).toISOString() : '',
      source: String(event.metadata?.source || ''),
      appName: String(event.metadata?.appName || ''),
    })),
    truncated: Boolean(options.truncated),
  };
}
