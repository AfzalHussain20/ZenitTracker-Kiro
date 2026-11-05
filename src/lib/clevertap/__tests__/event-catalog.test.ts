/**
 * Tests for the CleverTap event catalog + gap-analysis engine.
 * Pure functions — no DOM, no network, no CleverTap key required.
 */

import {
  CLEVERTAP_CATALOG,
  ZENIT_EXTRA_EVENTS,
  CATEGORIES,
  analyzeGaps,
  parseCapturedEvents,
  parseHtmlTooltipProperties,
  parseActivityHtmlEvents,
  isCleverTapSystemEvent,
  isCleverTapSystemProperty,
  buildGapCsv,
  buildCatalogCsv,
  normalizeName,
  normalizeProperty,
  SAMPLE_CAPTURE,
} from '@/lib/clevertap/event-catalog';

describe('CleverTap event catalog', () => {
  it('embeds all 39 events from the CSV', () => {
    expect(CLEVERTAP_CATALOG).toHaveLength(39);
  });

  it('has unique, normalised event names', () => {
    const names = CLEVERTAP_CATALOG.map((e) => normalizeName(e.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it('assigns every event a known category and a trigger', () => {
    for (const e of CLEVERTAP_CATALOG) {
      expect(CATEGORIES).toContain(e.category);
      expect(typeof e.trigger).toBe('string');
      expect(e.trigger.length).toBeGreaterThan(0);
    }
  });

  it('keeps the CSV core events present', () => {
    const names = CLEVERTAP_CATALOG.map((e) => e.name);
    for (const expected of ['Login', 'Logout', 'Page_View', 'Searched', 'Content_Clicked', 'Media_Error']) {
      expect(names).toContain(expected);
    }
  });

  it('covers every property the CSV lists for these events', () => {
    // Regression guard for the CSV reconciliation: these properties were
    // previously missing from the catalog even though the CSV declares them.
    const byName = new Map(CLEVERTAP_CATALOG.map((e) => [e.name, new Set(e.properties)]));
    const expected: Record<string, string[]> = {
      Subscription_Initiated: ['contentLanguageShorts'],
      Watched: ['vodType', 'contentLanguageShorts'],
      View_Plans: ['contentLanguageShorts'],
      Login: ['contentLanguageShorts'],
      Searched: ['contentLanguageShorts'],
      Added_to_Watchlist: ['vodType', 'contentLanguageShorts'],
      Removed_From_Watchlist: ['episodeName', 'source', 'vodType', 'contentLanguageShorts'],
      Media_Error: ['contentLanguageShorts', 'appName'],
      Shared: ['contentLanguageShorts'],
      Subscription: ['source', 'contentTitle', 'contentGenre', 'contentID'],
      Page_View: ['contentLanguageShorts'],
      Content_Clicked: ['vodType', 'contentLanguageShorts'],
      Payment_Initiated: ['vodType', 'contentTitle', 'contentGenre', 'contentID'],
      Parental_Control: ['appName'],
      Change_App_Settings: ['appName'],
      Referral: ['appName'],
      Skip_Intro: ['vodType'],
      Ad_Break_Start: ['vodType'],
      Ad_Start: ['vodType'],
      Ad_Break_Complete: ['vodType'],
      Ad_End: ['vodType'],
      Retention_Prompt_Clicked: ['appName'],
    };

    for (const [event, props] of Object.entries(expected)) {
      const actual = byName.get(event);
      expect(actual).toBeDefined();
      for (const prop of props) {
        expect(actual!.has(prop)).toBe(true);
      }
    }

    // The CSV does not declare contentType for See_All_Clicked.
    expect(byName.get('See_All_Clicked')!.has('contentType')).toBe(false);
  });

  it('lists 11 Zenit-specific events that are not in the CSV', () => {
    expect(ZENIT_EXTRA_EVENTS).toHaveLength(11);
    const csv = new Set(CLEVERTAP_CATALOG.map((e) => normalizeName(e.name)));
    for (const e of ZENIT_EXTRA_EVENTS) {
      expect(csv.has(normalizeName(e.name))).toBe(false);
      expect(e.category).toBe('Zenit Specific');
    }
  });
});

describe('parseCapturedEvents', () => {
  it('parses a JSON array with event + properties', () => {
    const r = parseCapturedEvents('[{"event":"Login","properties":{"source":"D2C"}},{"event":"Logout"}]');
    expect(r.format).toBe('json-array');
    expect(r.events.map((e) => e.name).sort()).toEqual(['Login', 'Logout']);
    expect(r.events.find((e) => e.name === 'Login')!.properties).toEqual(['source']);
  });

  it('parses a JSON map of event name → props', () => {
    const r = parseCapturedEvents('{"Login":{"source":"D2C","isNewUser":true},"Page_View":["currentPage"]}');
    expect(r.format).toBe('json-object');
    expect(r.events).toHaveLength(2);
    expect(r.events.find((e) => e.name === 'Page_View')!.properties).toEqual(['currentPage']);
  });

  it('parses NDJSON', () => {
    const r = parseCapturedEvents('{"event":"Login"}\n{"event":"Searched","properties":{"searchString":"x"}}');
    expect(r.format).toBe('ndjson');
    expect(r.events.map((e) => e.name).sort()).toEqual(['Login', 'Searched']);
  });

  it('parses CSV rows and skips header rows', () => {
    const r = parseCapturedEvents('Event Name,properties\nLogin,source,isNewUser\nPage_View,currentPage');
    expect(r.format).toBe('csv');
    expect(r.events.map((e) => e.name).sort()).toEqual(['Login', 'Page_View']);
    expect(r.events.find((e) => e.name === 'Login')!.properties).toEqual(['source', 'isNewUser']);
  });

  it('parses plain event-name lists', () => {
    const r = parseCapturedEvents('Login\nLogout\nPage_View');
    expect(r.format).toBe('names');
    expect(r.events).toHaveLength(3);
  });

  it('rolls up duplicates and unions their properties', () => {
    const r = parseCapturedEvents('[{"event":"Login","properties":{"a":1}},{"event":"Login","properties":{"b":2}}]');
    expect(r.events).toHaveLength(1);
    expect(r.events[0].count).toBe(2);
    expect(r.events[0].properties.sort()).toEqual(['a', 'b']);
  });

  it('returns empty for blank input', () => {
    const r = parseCapturedEvents('   \n  ');
    expect(r.format).toBe('empty');
    expect(r.events).toHaveLength(0);
  });

  describe('CleverTap tooltip HTML', () => {
    // Exact shape copied from the CleverTap dashboard event detail.
    const HTML =
      '<span class="label-gray ">' +
      '<span data-t="tooltip" title="previousPage">Profile Page</span><b class="dvr">|</b>' +
      '<span data-t="tooltip" title="" data-original-title="appName">SunNXT</span><b class="dvr">|</b>' +
      '<span data-t="tooltip" title="contentLanguage">Tamil</span><b class="dvr">|</b>' +
      '<span data-t="tooltip" title="source">B2B free</span><b class="dvr">|</b>' +
      '<span data-t="tooltip" title="currentPage">Home Page</span><b class="dvr">|</b>' +
      '<span data-t="tooltip" title="contentLanguageShorts">tamil,telugu,malayalam,kannada</span><b class="dvr">|</b>' +
      '<span data-t="tooltip" title="CT App Version">4.2.57</span><b class="dvr">|</b>' +
      '<span data-t="tooltip" title="CT Source">Mobile</span><b class="dvr">|</b>' +
      '</span>';

    it('extracts properties, including data-original-title and comma values', () => {
      const props = parseHtmlTooltipProperties(HTML);
      expect(props).toEqual([
        'previousPage', 'appName', 'contentLanguage', 'source', 'currentPage',
        'contentLanguageShorts', 'CT App Version', 'CT Source',
      ]);
      // The comma inside "tamil,telugu,…" must NOT create extra events.
      expect(props).toContain('contentLanguageShorts');
    });

    it('parses HTML when an event name is supplied', () => {
      const r = parseCapturedEvents(HTML, { htmlEventName: 'Page_View' });
      expect(r.format).toBe('html-tooltip');
      expect(r.events).toHaveLength(1);
      expect(r.events[0].name).toBe('Page_View');
      expect(r.events[0].properties).toContain('contentLanguage');
      expect(r.events[0].properties).toContain('appName');
    });

    it('asks for an event name when HTML is pasted alone', () => {
      const r = parseCapturedEvents(HTML);
      expect(r.format).toBe('html-tooltip');
      expect(r.events).toHaveLength(0);
      expect(r.errors[0]).toMatch(/event name/i);
    });

    it('accepts an event name on the first line', () => {
      const r = parseCapturedEvents(`Page_View\n${HTML}`);
      expect(r.events).toHaveLength(1);
      expect(r.events[0].name).toBe('Page_View');
    });

    it('marks contentLanguage as captured for a Page_View HTML paste', () => {
      const result = analyzeGaps(parseCapturedEvents(HTML, { htmlEventName: 'Page_View' }));
      const row = result.rows.find((r) => r.name === 'Page_View')!;
      expect(row.status).toBe('captured');
      expect(row.missingProps).not.toContain('contentLanguage');
      expect(row.missingProps).not.toContain('previousPage');
      expect(row.missingProps).not.toContain('currentPage');
      // contentLanguageShorts is part of the CSV catalog now, so it is not an extra.
      expect(row.missingProps).not.toContain('contentLanguageShorts');
      expect(row.extraProps).not.toContain('contentLanguageShorts');
      // CleverTap SDK properties are filtered out of gap analysis.
      expect(row.capturedProps).not.toContain('CT App Version');
      expect(row.capturedProps).not.toContain('CT Source');
      expect(row.extraProps).not.toContain('CT App Version');
      expect(row.extraProps).not.toContain('CT Source');
    });
  });

  describe('CleverTap "User activity details" page', () => {
    // Representative slice of the real page: repeated events, data-original-title,
    // comma-separated values, and CleverTap-generated system events.
    const ACTIVITY_HTML = `
      <div class="grid-content">
        <table data-user-iid="21813" class="ev_37"><tbody><tr>
          <td>11:34:39 am</td>
          <td><span style="font-weight:400">Page_View</span><br>
            <span class="label-gray">
              <span data-t="tooltip" title="previousPage">Search</span><b class="dvr">|</b>
              <span data-t="tooltip" title="" data-original-title="appName">SunNXT</span><b class="dvr">|</b>
              <span data-t="tooltip" title="contentLanguage">bengali,english,hindi</span>
            </span>
          </td>
        </tr></tbody></table>
        <table data-user-iid="21813" class="ev_58"><tbody><tr>
          <td>11:34:05 am</td>
          <td><span style="font-weight:400">Searched</span><br>
            <span class="label-gray">
              <span data-t="tooltip" title="searchString">singam</span><b class="dvr">|</b>
              <span data-t="tooltip" title="isFound">yes</span>
            </span>
          </td>
        </tr></tbody></table>
        <table data-user-iid="21813" class="ev_2"><tbody><tr>
          <td>11:22:31 am</td>
          <td><span style="font-weight:400">App Launched</span><br>
            <span class="label-gray">
              <span data-t="tooltip" title="CT SDK Version">70701</span>
            </span>
          </td>
        </tr></tbody></table>
        <table data-user-iid="21813" class="ev_37"><tbody><tr>
          <td>11:33:52 am</td>
          <td><span style="font-weight:400">Page_View</span><br>
            <span class="label-gray">
              <span data-t="tooltip" title="currentPage">More</span>
            </span>
          </td>
        </tr></tbody></table>
      </div>`;

    it('detects the activity page before the single-tooltip parser', () => {
      const r = parseCapturedEvents(ACTIVITY_HTML);
      expect(r.format).toBe('activity-html');
      expect(r.events.map((e) => e.name).sort()).toEqual(['App Launched', 'Page_View', 'Searched']);
    });

    it('rolls up repeated events and unions their properties', () => {
      const r = parseCapturedEvents(ACTIVITY_HTML);
      const pageView = r.events.find((e) => e.name === 'Page_View')!;
      expect(pageView.count).toBe(2);
      expect(pageView.properties).toEqual(
        expect.arrayContaining(['previousPage', 'appName', 'contentLanguage', 'currentPage']),
      );
      // The comma inside a value must not create extra properties.
      expect(pageView.properties).not.toContain('english');
    });

    it('reads data-original-title when title is empty', () => {
      const r = parseCapturedEvents(ACTIVITY_HTML);
      expect(r.events.find((e) => e.name === 'Page_View')!.properties).toContain('appName');
    });

    it('exposes parseActivityHtmlEvents directly', () => {
      const events = parseActivityHtmlEvents(ACTIVITY_HTML);
      expect(events).toHaveLength(4); // raw rows, before roll-up
      expect(events.filter((e) => e.name === 'Page_View')).toHaveLength(2);
    });

    it('flags CleverTap system events instead of treating them as custom', () => {
      expect(isCleverTapSystemEvent('App Launched')).toBe(true);
      expect(isCleverTapSystemEvent('Identity Set')).toBe(true);
      expect(isCleverTapSystemEvent('Page_View')).toBe(false);

      const result = analyzeGaps(parseCapturedEvents(ACTIVITY_HTML));
      const appLaunched = result.rows.find((r) => r.name === 'App Launched')!;
      expect(appLaunched.status).toBe('extra');
      expect(appLaunched.isSystem).toBe(true);

      const pageView = result.rows.find((r) => r.name === 'Page_View')!;
      expect(pageView.status).toBe('captured');
      expect(pageView.isSystem).toBeUndefined();
      expect(pageView.records).toBe(2);
    });

    it('keeps event names containing "&" (T&C_Clicked)', () => {
      const html =
        '<table class="ev_91"><tr><td>11:00:00 am</td>' +
        '<td><span style="font-weight:400">T&amp;C_Clicked</span><br>' +
        '<span class="label-gray"><span data-t="tooltip" title="source">Footer</span></span>' +
        '</td></tr></table>';
      const r = parseCapturedEvents(html);
      expect(r.format).toBe('activity-html');
      expect(r.events.map((e) => e.name)).toContain('T&C_Clicked');
    });

    it('keeps events that have no properties at all (Logout)', () => {
      const html =
        '<table class="ev_12"><tr><td>11:05:00 am</td>' +
        '<td><span style="font-weight:400">Logout</span></td></tr></table>';
      const r = parseCapturedEvents(html);
      expect(r.format).toBe('activity-html');
      const logout = r.events.find((e) => e.name === 'Logout')!;
      expect(logout).toBeDefined();
      expect(logout.properties).toEqual([]);

      const row = analyzeGaps(r).rows.find((x) => x.name === 'Logout')!;
      expect(row.status).toBe('captured');
    });

    it('counts multiple occurrences grouped in one event table', () => {
      const html =
        '<table class="ev_37">' +
        '<tr><td>11:34:39 am</td><td><span style="font-weight:400">Page_View</span><br>' +
        '<span class="label-gray"><span data-t="tooltip" title="previousPage">Search</span></span></td></tr>' +
        '<tr><td>11:33:52 am</td><td><span style="font-weight:400">Page_View</span><br>' +
        '<span class="label-gray"><span data-t="tooltip" title="currentPage">More</span></span></td></tr>' +
        '</table>';
      const raw = parseActivityHtmlEvents(html);
      expect(raw).toHaveLength(2);

      const rolled = parseCapturedEvents(html);
      expect(rolled.events).toHaveLength(1);
      expect(rolled.events[0].count).toBe(2);
      expect(rolled.events[0].properties.sort()).toEqual(['currentPage', 'previousPage']);
    });

    it('reads a plain name list containing "&"', () => {
      const r = parseCapturedEvents('Login\nT&C_Clicked\nShared');
      expect(r.events.map((e) => e.name).sort()).toEqual(['Login', 'Shared', 'T&C_Clicked']);
    });
  });
});

describe('analyzeGaps', () => {
  it('reports zero missing when the whole catalog is captured', () => {
    const payload = CLEVERTAP_CATALOG.map((e) => ({
      event: e.name,
      properties: Object.fromEntries(e.properties.map((p) => [p, 'x'])),
    }));
    const result = analyzeGaps(parseCapturedEvents(JSON.stringify(payload)));
    expect(result.summary.matched).toBe(39);
    expect(result.summary.missing).toBe(0);
    expect(result.summary.propertyCoverage).toBe(100);
  });

  it('reports the correct number of missing events for a partial paste', () => {
    const result = analyzeGaps(parseCapturedEvents('[{"event":"Login","properties":{"source":"D2C"}}]'));
    expect(result.summary.capturedTotal).toBe(1);
    expect(result.summary.matched).toBe(1);
    expect(result.summary.missing).toBe(38);
  });

  it('flags captured events that are not in the CSV as extra', () => {
    const result = analyzeGaps(
      parseCapturedEvents('[{"event":"Login"},{"event":"Some_New_Event","properties":{"foo":1}}]'),
    );
    expect(result.summary.extra).toBe(1);
    const extra = result.rows.find((r) => r.name === 'Some_New_Event')!;
    expect(extra.status).toBe('extra');
    expect(extra.extraProps).toEqual(['foo']);
  });

  it('computes per-event property coverage', () => {
    const result = analyzeGaps(
      parseCapturedEvents('[{"event":"Login","properties":{"source":"D2C","loginStatus":"success"}}]'),
    );
    const login = result.rows.find((r) => r.name === 'Login')!;
    // Login expects 6 props, we supplied 2
    expect(login.propertyCoverage).toBe(33);
    expect(login.missingProps).toEqual([
      'isNewUser', 'otpCalls', 'contentLanguage', 'contentLanguageShorts',
    ]);
  });

  it('matches spaced display labels against camelCase CSV property names (Watched)', () => {
    expect(normalizeProperty('content genre')).toBe(normalizeProperty('contentGenre'));
    expect(normalizeProperty('content duration')).toBe(normalizeProperty('contentDuration'));
    expect(normalizeProperty('content type')).toBe(normalizeProperty('contentType'));
    expect(normalizeProperty('watchStatus (Values -> Yes, No)')).toBe(normalizeProperty('watchStatus'));

    const result = analyzeGaps(
      parseCapturedEvents(
        JSON.stringify([
          {
            event: 'Watched',
            properties: {
              'content genre': 'Action',
              'content duration': 120,
              'content type': 'Movie',
              'CT App Version': '4.2.57',
              'CT Source': 'Mobile',
            },
          },
        ]),
      ),
    );
    const watched = result.rows.find((r) => r.name === 'Watched')!;
    expect(watched.missingProps).not.toContain('contentGenre');
    expect(watched.missingProps).not.toContain('contentDuration');
    expect(watched.missingProps).not.toContain('contentType');
    expect(watched.extraProps).toEqual([]);
  });

  it('excludes CleverTap SDK system properties from capturedProps and extraProps', () => {
    expect(isCleverTapSystemProperty('CT App Version')).toBe(true);
    expect(isCleverTapSystemProperty('ct_app_version')).toBe(true);
    expect(isCleverTapSystemProperty('CT Source')).toBe(true);
    expect(isCleverTapSystemProperty('Clevertap ID')).toBe(true);
    expect(isCleverTapSystemProperty('source')).toBe(false);
  });

  it('works on the built-in sample payload', () => {
    const result = analyzeGaps(parseCapturedEvents(SAMPLE_CAPTURE));
    expect(result.summary.capturedTotal).toBeGreaterThan(0);
    expect(result.summary.extra).toBeGreaterThan(0); // Test_Case_Executed is Zenit-specific
  });
});

describe('exports', () => {
  it('builds a gap CSV with a header and one row per event', () => {
    const result = analyzeGaps(parseCapturedEvents('[{"event":"Login"}]'));
    const csv = buildGapCsv(result);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Event Name');
    expect(lines[0]).toContain('Missing Properties');
    expect(lines.length).toBe(result.rows.length + 1);
  });

  it('builds an event-only gap CSV when includeProperties is false', () => {
    const result = analyzeGaps(parseCapturedEvents('[{"event":"Login"}]'));
    const csv = buildGapCsv(result, { includeProperties: false });
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Event Name,In Paste,Category,Zenit,Records Captured,Trigger');
    expect(lines[0]).not.toContain('Missing Properties');
    expect(lines.length).toBe(result.rows.length + 1);
  });

  it('builds a catalog CSV covering CSV + Zenit events', () => {
    const lines = buildCatalogCsv().split('\n');
    expect(lines.length).toBe(CLEVERTAP_CATALOG.length + ZENIT_EXTRA_EVENTS.length + 1);
  });

  it('escapes commas in CSV cells', () => {
    const result = analyzeGaps(parseCapturedEvents('[{"event":"Login"}]'));
    const csv = buildGapCsv(result);
    // The "Watched" trigger contains commas and must be quoted.
    expect(csv).toContain('"Triggers when a stream starts, and at 25% / 50% / 80% / 100% completion"');
  });
});
