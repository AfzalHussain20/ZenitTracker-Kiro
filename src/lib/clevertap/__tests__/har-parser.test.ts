/**
 * Tests for the HAR → CleverTap extractor.
 * Uses synthetic fixtures only — no real traffic, tokens, or PII.
 */

import {
  extractCleverTapEventsFromHar,
  sanitizeHarEvents,
  CONSOLE_CAPTURE_SNIPPET,
} from '@/lib/clevertap/har-parser';

function b64(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

const EVT_BATCH = {
  evt: [
    { evtName: 'Login', evtData: { source: 'D2C', isNewUser: false, loginStatus: 'success' } },
    { evtName: 'Page_View', evtData: { previousPage: '/login', currentPage: '/home', source: 'D2C' } },
  ],
};

function har(entries: any[]) {
  return { log: { version: '1.2', creator: { name: 'test' }, entries } };
}

const FIXTURE = har([
  // 1) Batched, URL-encoded `d=` body
  {
    request: {
      method: 'POST',
      url: 'https://wzrkt.com/a?t=SECRET_TOKEN',
      postData: { mimeType: 'application/x-www-form-urlencoded', text: `d=${encodeURIComponent(JSON.stringify(EVT_BATCH))}` },
    },
  },
  // 2) Plain JSON body
  {
    request: {
      method: 'POST',
      url: 'https://api.clevertap.com/1/upload',
      postData: {
        mimeType: 'application/json',
        text: JSON.stringify({ evtName: 'Searched', evtData: { searchString: 'secret query', isFound: true } }),
      },
    },
  },
  // 3) Base64 body
  {
    request: {
      method: 'POST',
      url: 'https://in1.api.clevertap.com/1/upload',
      postData: { mimeType: 'text/plain', text: b64({ evtName: 'Watched', evtData: { contentID: 'secret-id' } }) },
    },
  },
  // 4) Unrelated request — must be ignored
  {
    request: {
      method: 'POST',
      url: 'https://example.com/analytics',
      postData: { mimeType: 'application/json', text: '{"evtName":"ShouldNotAppear"}' },
    },
  },
]);

describe('extractCleverTapEventsFromHar', () => {
  it('extracts batched, plain-JSON and base64 payloads', () => {
    const r = extractCleverTapEventsFromHar(FIXTURE);
    const names = r.events.map((e) => e.name);
    expect(names).toContain('Login');
    expect(names).toContain('Page_View');
    expect(names).toContain('Searched');
    expect(names).toContain('Watched');
    expect(names).not.toContain('ShouldNotAppear');
  });

  it('reports accurate stats', () => {
    const r = extractCleverTapEventsFromHar(FIXTURE);
    expect(r.stats.entriesScanned).toBe(4);
    expect(r.stats.cleverTapEntries).toBe(3);
    expect(r.stats.payloadsDecoded).toBe(3);
    expect(r.stats.eventsFound).toBe(r.events.length);
    expect(r.format).toBe('har');
  });

  it('keeps property names and drops every value', () => {
    const r = extractCleverTapEventsFromHar(FIXTURE);
    const login = r.events.find((e) => e.name === 'Login')!;
    expect(login.properties.sort()).toEqual(['isNewUser', 'loginStatus', 'source']);

    const serialized = JSON.stringify(r.events) + sanitizeHarEvents(r.events);
    // No captured values, tokens, or identity may survive.
    expect(serialized).not.toContain('D2C');
    expect(serialized).not.toContain('success');
    expect(serialized).not.toContain('secret query');
    expect(serialized).not.toContain('secret-id');
    expect(serialized).not.toContain('SECRET_TOKEN');
  });

  it('strips query strings from reported sources', () => {
    const r = extractCleverTapEventsFromHar(FIXTURE);
    expect(r.stats.sources).toContain('wzrkt.com/a');
    expect(r.stats.sources.join(' ')).not.toContain('SECRET_TOKEN');
  });

  it('reads payloads from queryString', () => {
    const r = extractCleverTapEventsFromHar(
      har([
        {
          request: {
            method: 'GET',
            url: 'https://wzrkt.com/a',
            queryString: [{ name: 'd', value: encodeURIComponent(JSON.stringify({ evtName: 'Logout' })) }],
          },
        },
      ]),
    );
    expect(r.events.map((e) => e.name)).toContain('Logout');
  });

  it('merges duplicate event names and unions properties', () => {
    const r = extractCleverTapEventsFromHar(
      har([
        {
          request: {
            method: 'POST',
            url: 'https://wzrkt.com/a',
            postData: { text: JSON.stringify({ evt: [{ evtName: 'Login', evtData: { source: 'x' } }] }) },
          },
        },
        {
          request: {
            method: 'POST',
            url: 'https://wzrkt.com/a',
            postData: { text: JSON.stringify({ evt: [{ evtName: 'Login', evtData: { isNewUser: true } }] }) },
          },
        },
      ]),
    );
    const login = r.events.filter((e) => e.name === 'Login');
    expect(login).toHaveLength(1);
    expect(login[0].count).toBe(2);
    expect(login[0].properties.sort()).toEqual(['isNewUser', 'source']);
  });

  it('rejects malformed HAR input', () => {
    const r = extractCleverTapEventsFromHar({ nope: true });
    expect(r.events).toHaveLength(0);
    expect(r.errors[0]).toMatch(/not a har/i);
  });

  it('explains when no CleverTap entries exist', () => {
    const r = extractCleverTapEventsFromHar(
      har([{ request: { url: 'https://example.com/x', postData: { text: '{}' } } }]),
    );
    expect(r.events).toHaveLength(0);
    expect(r.errors.join(' ')).toMatch(/no clevertap requests/i);
  });

  it('feeds the analyzer without leaking values', () => {
    // Import here to keep the HAR test independent of catalog internals.
    const { analyzeGaps } = require('@/lib/clevertap/event-catalog');
    const result = analyzeGaps(extractCleverTapEventsFromHar(FIXTURE));
    expect(result.summary.capturedTotal).toBeGreaterThan(0);
    const login = result.rows.find((r: any) => r.name === 'Login')!;
    expect(login.status).toBe('captured');
    expect(login.missingProps).toContain('otpCalls');
    expect(login.missingProps).toContain('contentLanguage');
  });
});

describe('sanitizeHarEvents', () => {
  it('outputs only event + properties', () => {
    const r = extractCleverTapEventsFromHar(FIXTURE);
    const parsed = JSON.parse(sanitizeHarEvents(r.events));
    expect(parsed[0]).toHaveProperty('event');
    expect(parsed[0]).toHaveProperty('properties');
    expect(parsed[0]).not.toHaveProperty('count');
  });
});

describe('CONSOLE_CAPTURE_SNIPPET', () => {
  it('hooks clevertap.push and exports JSON', () => {
    expect(CONSOLE_CAPTURE_SNIPPET).toContain('clevertap.push');
    expect(CONSOLE_CAPTURE_SNIPPET).toContain('JSON.stringify');
  });
});
