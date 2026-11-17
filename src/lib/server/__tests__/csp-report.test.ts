import { parseCspReport } from '../csp-report';

describe('parseCspReport', () => {
  it('parses the legacy csp-report shape', () => {
    const [v] = parseCspReport({
      'csp-report': {
        'violated-directive': 'script-src',
        'blocked-uri': 'https://evil.example/x.js',
        'document-uri': 'https://app.example/dashboard?token=secret',
        'source-file': 'https://app.example/_next/static/app.js?v=1',
        'line-number': 42,
      },
    });
    expect(v.directive).toBe('script-src');
    expect(v.blocked).toBe('https://evil.example/x.js');
    // Query strings are stripped so logs do not retain user-specific data.
    expect(v.documentUri).toBe('https://app.example/dashboard');
    expect(v.sourceFile).toBe('https://app.example/_next/static/app.js');
    expect(v.line).toBe(42);
  });

  it('parses the Reporting API array shape', () => {
    const violations = parseCspReport([
      {
        type: 'csp-violation',
        body: {
          effectiveDirective: 'img-src',
          blockedURL: 'https://cdn.example/a.png',
          documentURL: 'https://app.example/notes',
        },
      },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0].directive).toBe('img-src');
    expect(violations[0].blocked).toBe('https://cdn.example/a.png');
    expect(violations[0].line).toBeNull();
  });

  it('caps the number of violations returned', () => {
    const payload = Array.from({ length: 25 }, () => ({
      type: 'csp-violation',
      body: { 'effective-directive': 'script-src' },
    }));
    expect(parseCspReport(payload, 3)).toHaveLength(3);
    expect(parseCspReport(payload)).toHaveLength(10);
  });

  it('ignores malformed or unrelated payloads', () => {
    expect(parseCspReport(null)).toEqual([]);
    expect(parseCspReport('nope')).toEqual([]);
    expect(parseCspReport({})).toEqual([]);
    expect(parseCspReport([{ type: 'deprecation' }])).toEqual([]);
  });

  it('falls back to a placeholder directive and truncates long fields', () => {
    const [v] = parseCspReport({
      'csp-report': { 'blocked-uri': 'x'.repeat(500) },
    });
    expect(v.directive).toBe('unknown');
    expect(v.blocked).toHaveLength(200);
    expect(v.documentUri).toBe('');
  });
});
