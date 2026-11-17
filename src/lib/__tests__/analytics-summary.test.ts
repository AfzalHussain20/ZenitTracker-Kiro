import {
  summarizeEvents,
  eventMillis,
  toMillis,
  type AnalyticsEventLike,
} from '../analytics-summary';

const NOW = Date.parse('2026-11-17T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function events(): AnalyticsEventLike[] {
  return [
    {
      id: 'e1',
      eventType: 'Page_View',
      userId: 'u1',
      userName: 'Alice',
      domain: 'user_action',
      createdAt: NOW - 1 * HOUR,
    },
    {
      id: 'e2',
      eventType: 'Login',
      userId: 'u1',
      userName: 'Alice',
      domain: 'user_action',
      createdAt: NOW - 1 * DAY,
    },
    {
      id: 'e3',
      eventType: 'Old_Event',
      userId: 'u2',
      userName: 'Bob',
      domain: 'system',
      createdAt: NOW - 10 * DAY,
    },
    {
      id: 'e4',
      eventType: 'Ancient_Event',
      userId: 'u3',
      userName: 'Carol',
      domain: 'system',
      createdAt: NOW - 60 * DAY,
    },
    {
      id: 'e5',
      eventType: 'Page_View',
      domain: 'user_action',
      createdAt: NOW - 1 * HOUR,
    },
    {
      id: 'e6',
      eventType: 'Export_Downloaded',
      userId: 'u2',
      userName: 'Bob',
      domain: 'export',
      timestamp: new Date(NOW - 2 * HOUR).toISOString(),
    },
  ];
}

describe('toMillis / eventMillis', () => {
  it('parses ISO strings, milliseconds and seconds', () => {
    expect(toMillis('2026-11-17T12:00:00.000Z')).toBe(NOW);
    expect(toMillis(NOW)).toBe(NOW);
    expect(toMillis(1_700_000_000)).toBe(1_700_000_000_000);
    expect(toMillis(null)).toBeNull();
    expect(toMillis('not-a-date')).toBeNull();
  });

  it('falls back from createdAt to timestamp to metadata', () => {
    expect(eventMillis({ createdAt: NOW })).toBe(NOW);
    expect(eventMillis({ timestamp: new Date(NOW).toISOString() })).toBe(NOW);
    expect(eventMillis({ metadata: { $D_timestamp: NOW } })).toBe(NOW);
    expect(eventMillis({})).toBeNull();
  });
});

describe('summarizeEvents', () => {
  it('returns an empty, zero-filled summary for no events', () => {
    const summary = summarizeEvents([], { windowDays: 7, now: NOW });
    expect(summary.totalEvents).toBe(0);
    expect(summary.uniqueUsers).toBe(0);
    expect(summary.eventsToday).toBe(0);
    expect(summary.byDay).toHaveLength(7);
    expect(summary.byDay.every(d => d.count === 0)).toBe(true);
    expect(summary.recent).toEqual([]);
    expect(summary.truncated).toBe(false);
  });

  it('computes time-windowed counts correctly', () => {
    const summary = summarizeEvents(events(), { windowDays: 30, now: NOW });
    expect(summary.totalEvents).toBe(6);
    // anonymous is excluded from unique users
    expect(summary.uniqueUsers).toBe(3);
    expect(summary.eventsToday).toBe(3); // e1, e5, e6
    expect(summary.events7d).toBe(4); // e1, e2, e5, e6
    expect(summary.events30d).toBe(5); // all but the 60-day-old event
    expect(summary.activeUsers7d).toBe(2); // u1, u2
  });

  it('ranks top events and users within the window', () => {
    const summary = summarizeEvents(events(), { windowDays: 30, now: NOW });
    expect(summary.topEvents[0]).toMatchObject({ key: 'Page_View', count: 2 });
    const userLabels = summary.topUsers.map(u => u.label);
    expect(userLabels).toContain('Alice');
    expect(userLabels).toContain('Bob');
    // Carol's only event is outside the window
    expect(userLabels).not.toContain('Carol');
  });

  it('buckets events into the right UTC day and zero-fills gaps', () => {
    const summary = summarizeEvents(events(), { windowDays: 30, now: NOW });
    const byDate = Object.fromEntries(summary.byDay.map(d => [d.date, d]));
    expect(byDate['2026-11-17'].count).toBe(3);
    expect(byDate['2026-11-17'].users).toBe(2); // u1 + u2
    expect(byDate['2026-11-16'].count).toBe(1);
    expect(byDate['2026-11-01']).toBeDefined();
    expect(byDate['2026-11-01'].count).toBe(0);
  });

  it('sorts recent events newest-first and honours the limit', () => {
    const summary = summarizeEvents(events(), {
      windowDays: 30,
      now: NOW,
      recentLimit: 3,
    });
    expect(summary.recent).toHaveLength(3);
    expect(summary.recent[0].id).toBe('e1');
    expect(summary.recent[1].id).toBe('e5');
    expect(summary.recent[2].id).toBe('e6');
  });

  it('reports truncation when the caller hit its row cap', () => {
    const summary = summarizeEvents(events(), { now: NOW, truncated: true });
    expect(summary.truncated).toBe(true);
  });

  it('clamps the window to a sane range', () => {
    expect(summarizeEvents([], { windowDays: 0 }).windowDays).toBe(1);
    expect(summarizeEvents([], { windowDays: 9999 }).windowDays).toBe(365);
  });
});
