/**
 * CleverTap User Properties catalog + diff engine
 * ────────────────────────────────────────────────────────────────────────────
 * Source of truth: the **User Properties** sheet in `Clevertap Events.xlsx`
 * (27 rows) supplied by the analytics team. The events validator lives in
 * `event-catalog.ts`; this module is deliberately separate because user
 * properties are compared against a *profile*, not against an event payload.
 *
 * Everything runs in the browser. Nothing is uploaded and no CleverTap API key
 * is required.
 *
 * Paste shapes we understand:
 *   • CleverTap profile push JSON / JS object
 *       { type: "profile", profileData: { Site: { Email, Name, … } } }
 *       clevertap.profile.push({ Site: { … } })
 *   • A bare property object          { Email: "…", profileType: "Profile" }
 *   • An array of profile objects     [{ … }, { … }]
 *   • Tooltip HTML copied from the CleverTap dashboard (data-t="tooltip")
 *   • A table / definition list from the profile page
 *   • CSV rows, `key: value`, `key=value`, or one property name per line
 */

// ─── Catalog ──────────────────────────────────────────────────────────────────

export type UserPropertySource = 'Client' | 'Backend' | 'Analytics team';

export interface UserPropertyDef {
  /** Exact name expected in CleverTap (camelCase, case-sensitive in the CSV). */
  name: string;
  /** When the property should be written. */
  whenUpdated: string;
  /** Example values from the CSV. */
  sampleValues: string;
  /** Which team owns the write. */
  source: UserPropertySource;
  /** Extra guidance that was present in the sheet. */
  note?: string;
}

export const USER_PROPERTY_CATALOG: UserPropertyDef[] = [
  {
    name: 'profileType',
    whenUpdated: 'Every app launch & on profile change',
    sampleValues: 'Profile (primary) · Family · Kids · Others (newly created profile)',
    source: 'Client',
  },
  {
    name: 'parentalControl',
    whenUpdated: 'On registration & profile update',
    sampleValues: 'U · U/A 7+ · U/A 13+ · U/A 16+ · A',
    source: 'Backend',
  },
  {
    name: 'userStatusD2C',
    whenUpdated: 'On status change',
    sampleValues: 'Churned Quarterly · Churned Annual · Subscribed Annual · Resubscribed Gold',
    source: 'Backend',
    note: 'Prefix the app name, e.g. “Sun NXT Churned Quarterly” or “Sun NXT Shorts Churned Quarterly”.',
  },
  {
    name: 'userStatusB2B',
    whenUpdated: 'On status change',
    sampleValues: 'Churned Quarterly · Churned Annual · Subscribed Annual · Resubscribed Gold',
    source: 'Backend',
  },
  {
    name: 'countryCode',
    whenUpdated: 'Every app launch',
    sampleValues: 'IN · US · UK · AU',
    source: 'Client',
  },
  {
    name: 'city',
    whenUpdated: 'Every app launch',
    sampleValues: 'Hyderabad · Chennai',
    source: 'Client',
  },
  {
    name: 'currentLanguage',
    whenUpdated: 'Every app launch & on language switch',
    sampleValues: 'Telugu · Tamil',
    source: 'Client',
  },
  {
    name: 'previousLanguage',
    whenUpdated: 'Every app launch & on language switch',
    sampleValues: 'Tamil · Telugu',
    source: 'Client',
  },
  {
    name: 'platform',
    whenUpdated: 'Every app launch',
    sampleValues: 'Mobile · Web · TV',
    source: 'Client',
  },
  {
    name: 'loginMethod',
    whenUpdated: 'Every app launch',
    sampleValues: 'Mobile Number · Email Address · Facebook · Google · iOS',
    source: 'Client',
  },
  {
    name: 'Email',
    whenUpdated: 'On registration & profile update',
    sampleValues: 'santhosh@gmail.com',
    source: 'Backend',
  },
  {
    name: 'Phone',
    whenUpdated: 'On registration & profile update',
    sampleValues: '"+918127643176" — format: “+” + country mobile code + mobile number',
    source: 'Backend',
  },
  {
    name: 'accountID',
    whenUpdated: 'On registration',
    sampleValues: '2111020644218234129',
    source: 'Backend',
  },
  {
    name: 'subscriptionStatusD2C',
    whenUpdated: 'On subscription & on churn',
    sampleValues: 'True · False',
    source: 'Backend',
  },
  {
    name: 'startDateofSubscription',
    whenUpdated: 'On successful subscription',
    sampleValues: '$D_1647484118 — “$D_” + epoch timestamp',
    source: 'Backend',
  },
  {
    name: 'endDateofSubscription',
    whenUpdated: 'On successful subscription',
    sampleValues: '$D_1647484118 — “$D_” + epoch timestamp',
    source: 'Backend',
  },
  {
    name: 'registrationDate',
    whenUpdated: 'On successful registration',
    sampleValues: '$D_1647484118 — “$D_” + epoch timestamp',
    source: 'Backend',
  },
  {
    name: 'isEVThread',
    whenUpdated: 'On every successful API response',
    sampleValues: 'True · False',
    source: 'Backend',
  },
  {
    name: 'MSG-whatsapp',
    whenUpdated: 'On successful registration & profile update (when a mobile number is available)',
    sampleValues: 'True · False',
    source: 'Backend',
  },
  {
    name: 'Name',
    whenUpdated: 'On update',
    sampleValues: 'Dilip Kumar',
    source: 'Backend',
  },
  {
    name: 'Gender',
    whenUpdated: 'On update',
    sampleValues: 'Male · Female · Others',
    source: 'Backend',
  },
  {
    name: 'DOB',
    whenUpdated: 'On update',
    sampleValues: '$D_1647484118 — “$D_” + epoch timestamp',
    source: 'Backend',
  },
  {
    name: 'audioLanguage',
    whenUpdated: 'After every session',
    sampleValues: 'Kannada (one value only — the most-watched audio language)',
    source: 'Backend',
  },
  {
    name: 'currentLanguageShorts',
    whenUpdated: 'Every app launch & on language switch',
    sampleValues: 'Telugu · Tamil',
    source: 'Client',
  },
  {
    name: 'previousLanguageShorts',
    whenUpdated: 'Every app launch & on language switch',
    sampleValues: 'Tamil · Telugu',
    source: 'Client',
  },
  {
    name: 'languagePreferred',
    whenUpdated: 'Most watched language',
    sampleValues: 'Tamil · Telugu · Marathi',
    source: 'Analytics team',
  },
  {
    name: 'languagePreferredShorts',
    whenUpdated: 'Most watched language',
    sampleValues: 'Tamil · Telugu · Marathi',
    source: 'Analytics team',
  },
];

export const USER_PROPERTY_NAMES: ReadonlySet<string> = new Set(
  USER_PROPERTY_CATALOG.map((p) => p.name),
);

// ─── Key normalisation ────────────────────────────────────────────────────────

/** Wrappers that hold the real profile object rather than being properties. */
const WRAPPER_KEYS = new Set([
  'profiledata',
  'profile',
  'site',
  'userproperties',
  'user_properties',
  'attributes',
  'attrs',
  'props',
  'properties',
]);

/** Metadata keys that are never user properties. */
const STRUCTURAL_KEYS = new Set([
  'type',
  'evt',
  'events',
  'event',
  'eventname',
  'evtname',
  'evtdata',
  'ts',
  'ep',
  'guid',
  'objectid',
  'identity',
]);

/** Remove quoting and known object prefixes from a pasted key. */
function stripKey(key: string): string {
  let k = String(key ?? '').trim();
  k = k.replace(/^["'`]+|["'`]+$/g, '').trim();

  const prefixes = [
    'profiledata.',
    'profile.',
    'site.',
    'userproperties.',
    'user_properties.',
    'properties.',
    'attributes.',
    'attrs.',
  ];

  let changed = true;
  while (changed) {
    changed = false;
    const lower = k.toLowerCase();
    for (const prefix of prefixes) {
      if (lower.startsWith(prefix)) {
        k = k.slice(prefix.length).trim();
        changed = true;
        break;
      }
    }
  }
  return k;
}

/** Case-insensitive key used for exact CSV matching. */
export function normalizeUserPropertyKey(key: string): string {
  return stripKey(key).toLowerCase();
}

/** Punctuation-insensitive key used to spot snake_case / kebab-case variants. */
export function looseUserPropertyKey(key: string): string {
  return stripKey(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

const CATALOG_BY_EXACT = new Map<string, UserPropertyDef>(
  USER_PROPERTY_CATALOG.map((p) => [p.name.toLowerCase(), p]),
);

const CATALOG_BY_LOOSE = new Map<string, UserPropertyDef>(
  USER_PROPERTY_CATALOG.map((p) => [looseUserPropertyKey(p.name), p]),
);

/**
 * Resolve a pasted key to its CSV definition. Exact (case-insensitive) matches
 * win; a punctuation-insensitive match is returned as a fallback so the UI can
 * tell the analyst to rename `start_date_of_subscription` → `startDateofSubscription`.
 */
export function lookupUserProperty(key: string): UserPropertyDef | null {
  return (
    CATALOG_BY_EXACT.get(normalizeUserPropertyKey(key)) ??
    CATALOG_BY_LOOSE.get(looseUserPropertyKey(key)) ??
    null
  );
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

export type UserPropertyFormat =
  | 'json'
  | 'js-object'
  | 'html'
  | 'csv'
  | 'lines'
  | 'empty';

export interface ParsedUserProperties {
  /** Pasted key → distinct values (empty array when the paste carried names only). */
  properties: Record<string, string[]>;
  format: UserPropertyFormat;
  errors: string[];
  /** Structural / SDK keys that were deliberately skipped. */
  ignored: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function addProperty(
  map: Record<string, string[]>,
  key: string,
  value: unknown,
): void {
  const clean = stripKey(key);
  if (!clean) return;
  if (!map[clean]) map[clean] = [];
  const text = stringifyValue(value).trim();
  if (text && !map[clean].includes(text)) map[clean].push(text);
}

function tryJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Extract the first balanced `{…}` block from a JS snippet. */
function extractFirstObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Best-effort parse of a JS object literal (single quotes, bare keys, comments). */
function lenientJson(text: string): unknown | null {
  let s = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  // Single-quoted strings → JSON strings.
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, inner: string) =>
    JSON.stringify(inner.replace(/\\'/g, "'")),
  );

  // Bare keys → quoted keys.
  s = s.replace(
    /([{,]\s*)([A-Za-z_$][A-Za-z0-9_$.\-]*)\s*:/g,
    '$1"$2":',
  );

  // Trailing commas.
  s = s.replace(/,\s*([}\]])/g, '$1');

  return tryJson(s);
}

/** Recursively collect profile properties from a parsed JSON value. */
function collectProperties(
  value: unknown,
  out: Record<string, string[]>,
  ignored: string[],
  depth = 0,
): void {
  if (depth > 10) return;

  if (Array.isArray(value)) {
    for (const item of value) collectProperties(item, out, ignored, depth + 1);
    return;
  }
  if (!isPlainObject(value)) return;

  const keys = Object.keys(value);
  const lower = new Set(keys.map((k) => k.toLowerCase()));

  // An event payload is not a profile — skip it instead of reporting every
  // event attribute as an "extra" user property.
  if (
    lower.has('evtname') ||
    (typeof value.type === 'string' && value.type.toLowerCase() === 'event')
  ) {
    ignored.push(...keys);
    return;
  }

  // Prefer the nested profile wrapper when one is present.
  const wrappers = keys.filter(
    (k) =>
      WRAPPER_KEYS.has(k.toLowerCase()) &&
      (isPlainObject(value[k]) || Array.isArray(value[k])),
  );
  if (wrappers.length > 0) {
    for (const wrapper of wrappers) {
      collectProperties(value[wrapper], out, ignored, depth + 1);
    }
    return;
  }

  for (const key of keys) {
    const lowerKey = key.toLowerCase();
    if (STRUCTURAL_KEYS.has(lowerKey) || lowerKey.startsWith('wzrk')) {
      ignored.push(key);
      continue;
    }
    addProperty(out, key, value[key]);
  }
}

// ─── HTML parsing ─────────────────────────────────────────────────────────────

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function htmlText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function looksLikeHtml(text: string): boolean {
  return (
    /<[a-z][\s\S]*>/i.test(text) &&
    /data-t\s*=\s*["']tooltip["']|title\s*=|data-key\s*=|data-property\s*=|data-name\s*=|<tr[\s>]|<dt[\s>]|<table[\s>]/i.test(text)
  );
}

/** Read `<tr><td>key</td><td>value</td></tr>` pairs. */
function parseHtmlTable(html: string, out: Record<string, string[]>): void {
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(html)) !== null) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      htmlText(m[1]),
    );
    if (cells.length < 2) continue;
    const key = cells[0];
    if (isHeaderKey(key)) continue;
    if (!key) continue;
    addProperty(out, key, cells.slice(1).join(' · '));
  }
}

/** Read `<dt>key</dt><dd>value</dd>` pairs. */
function parseHtmlDefinitionList(html: string, out: Record<string, string[]>): void {
  const re = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const key = htmlText(match[1]);
    if (!key || isHeaderKey(key)) continue;
    addProperty(out, key, htmlText(match[2]));
  }
}

/** Read elements whose title / data-key / data-property is the property name. */
function parseHtmlAttributed(html: string, out: Record<string, string[]>): void {
  const re =
    /<([a-z0-9]+)\b[^>]*\b(?:title|data-key|data-property|data-name|aria-label)\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const key = decodeEntities(match[2]).trim();
    if (!key || isHeaderKey(key)) continue;
    // A generic tooltip title such as "Copy" is not a property name.
    if (!/^[A-Za-z][A-Za-z0-9_.\- ]*$/.test(key)) continue;
    addProperty(out, key, htmlText(match[3]));
  }
}

function parseHtmlProperties(text: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};

  // CleverTap dashboard property pills (best signal).
  for (const entry of parseTooltipEntries(text)) {
    addProperty(out, entry.key, entry.value);
  }
  if (Object.keys(out).length > 0) return out;

  parseHtmlTable(text, out);
  parseHtmlDefinitionList(text, out);
  parseHtmlAttributed(text, out);
  return out;
}

interface TooltipEntry {
  key: string;
  value: string;
}

/**
 * Minimal local copy of the tooltip reader so this module has no dependency on
 * the event catalog. Reads `<span data-t="tooltip" title="key">value</span>`.
 */
function parseTooltipEntries(html: string): TooltipEntry[] {
  const out: TooltipEntry[] = [];
  const re = /<span[^>]*data-t\s*=\s*["']tooltip["'][^>]*title\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/span>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    out.push({
      key: decodeEntities(match[1]).trim(),
      value: htmlText(match[2]),
    });
  }
  return out;
}

// ─── Line / CSV parsing ───────────────────────────────────────────────────────

const HEADER_KEYS = new Set([
  'user property',
  'user properties',
  'property',
  'properties',
  'attribute',
  'attributes',
  'key',
  'field',
]);

function isHeaderKey(key: string): boolean {
  return HEADER_KEYS.has(key.trim().toLowerCase());
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parsePropertyLines(text: string): {
  properties: Record<string, string[]>;
  format: UserPropertyFormat;
} {
  const properties: Record<string, string[]> = {};
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let commaRows = 0;

  for (let line of lines) {
    if (!line) continue;
    if (/^[{}\[\]();,]+$/.test(line)) continue;
    if (/^(clevertap|window\.|console\.|copy\()/i.test(line)) continue;
    if (line.startsWith('//') || line.startsWith('#')) continue;

    line = line.replace(/[;,]+$/, '').trim();

    let key = '';
    let value = '';

    if (line.includes(',')) {
      const cells = splitCsvLine(line);
      commaRows++;
      // The source sheet has four columns — the first is the property name.
      if (cells.length >= 4) {
        key = cells[0];
      } else {
        key = cells[0];
        value = cells.slice(1).join(', ');
      }
    } else if (line.includes('=')) {
      const index = line.indexOf('=');
      key = line.slice(0, index);
      value = line.slice(index + 1);
    } else if (line.includes(':')) {
      const index = line.indexOf(':');
      key = line.slice(0, index);
      value = line.slice(index + 1);
    } else if (line.includes('\t')) {
      const index = line.indexOf('\t');
      key = line.slice(0, index);
      value = line.slice(index + 1);
    } else {
      key = line;
    }

    key = key.trim().replace(/^["'`]+|["'`]+$/g, '').trim();
    value = value.trim().replace(/^["'`]+|["'`]+$/g, '').trim();

    if (!key || isHeaderKey(key)) continue;
    if (!/^[A-Za-z][A-Za-z0-9_.\- ]*$/.test(key)) continue;
    if (value === '-' || value === '—' || value === 'n/a' || value === 'NA') value = '';

    addProperty(properties, key, value);
  }

  return {
    properties,
    format: commaRows > 0 && commaRows >= lines.length / 2 ? 'csv' : 'lines',
  };
}

// ─── Public parse API ─────────────────────────────────────────────────────────

/**
 * DevTools often shows a CleverTap request body as `d=%7B…%7D` or
 * `d={"type":"profile",…}`. Decode that before looking for JSON.
 */
function decodePayloadText(text: string): string {
  const trimmed = text.trim();

  if (/^[A-Za-z0-9_.-]+=/.test(trimmed) && !trimmed.includes('\n')) {
    try {
      const params = new URLSearchParams(trimmed);
      for (const key of ['d', 'evt', 'event', 'data', 'payload', 'body']) {
        const value = params.get(key);
        if (value) return value;
      }
    } catch {
      /* not form-encoded */
    }
  }

  if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
    try {
      const decoded = decodeURIComponent(trimmed);
      if (decoded !== trimmed) return decoded;
    } catch {
      /* bad escape */
    }
  }

  return trimmed;
}

export function parseUserProperties(input: string): ParsedUserProperties {
  const text = decodePayloadText(input || '');
  if (!text) {
    return {
      properties: {},
      format: 'empty',
      errors: ['Paste a profile payload, tooltip HTML, or a key/value list first.'],
      ignored: [],
    };
  }

  // 1 — HTML copied from the dashboard / profile page.
  if (looksLikeHtml(text)) {
    const properties = parseHtmlProperties(text);
    const errors =
      Object.keys(properties).length > 0
        ? []
        : [
            'HTML detected, but no property names were found. Copy the profile block with its tooltip spans or table rows.',
          ];
    return { properties, format: 'html', errors, ignored: [] };
  }

  // 2 — JSON or a JS object literal.
  let value: unknown = tryJson(text);
  let format: UserPropertyFormat = 'json';

  if (value === null) {
    const objectText = extractFirstObject(text);
    if (objectText) {
      value = lenientJson(objectText);
      if (value !== null) format = 'js-object';
    }
  }

  if (value !== null) {
    const properties: Record<string, string[]> = {};
    const ignored: string[] = [];
    collectProperties(value, properties, ignored);
    const errors =
      Object.keys(properties).length > 0
        ? []
        : [
            'JSON parsed, but no user properties were found. Paste the profile object (for example profileData.Site), not an event payload.',
          ];
    return { properties, format, errors, ignored };
  }

  // 3 — CSV, `key: value`, `key=value`, or one name per line.
  const lineResult = parsePropertyLines(text);
  const errors =
    Object.keys(lineResult.properties).length > 0
      ? []
      : [
          'No properties could be read. Paste JSON, tooltip HTML, CSV rows, or one “key: value” per line.',
        ];
  return {
    properties: lineResult.properties,
    format: lineResult.format,
    errors,
    ignored: [],
  };
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

export type UserPropertyStatus = 'present' | 'renamed' | 'missing' | 'extra';

export interface UserPropertyRow {
  /** Key exactly as it appeared in the paste (canonical name for missing rows). */
  key: string;
  /** CSV name when the key is known. */
  canonical?: string;
  /** Joined display value. */
  value: string;
  values: string[];
  status: UserPropertyStatus;
  def?: UserPropertyDef;
  message: string;
}

export interface UserPropertySummary {
  catalogTotal: number;
  pastedTotal: number;
  matched: number;
  renamed: number;
  missing: number;
  extra: number;
  ignored: number;
  /** Strict coverage — exact CSV names only. */
  coverage: number;
}

export interface UserPropertyAnalysis {
  format: UserPropertyFormat;
  errors: string[];
  present: UserPropertyRow[];
  renamed: UserPropertyRow[];
  missing: UserPropertyRow[];
  extra: UserPropertyRow[];
  ignored: string[];
  summary: UserPropertySummary;
}

const CATALOG_ORDER = new Map(
  USER_PROPERTY_CATALOG.map((property, index) => [property.name, index]),
);

function byCatalogOrder(a: UserPropertyRow, b: UserPropertyRow): number {
  return (
    (CATALOG_ORDER.get(a.canonical ?? '') ?? Number.MAX_SAFE_INTEGER) -
    (CATALOG_ORDER.get(b.canonical ?? '') ?? Number.MAX_SAFE_INTEGER)
  );
}

export function analyzeUserProperties(input: string): UserPropertyAnalysis {
  const parsed = parseUserProperties(input);

  const present: UserPropertyRow[] = [];
  const renamed: UserPropertyRow[] = [];
  const extra: UserPropertyRow[] = [];
  const seen = new Set<string>();

  for (const [key, values] of Object.entries(parsed.properties)) {
    const value = values.join(' | ');
    const exact = CATALOG_BY_EXACT.get(normalizeUserPropertyKey(key));

    if (exact) {
      seen.add(exact.name);
      present.push({
        key,
        canonical: exact.name,
        value,
        values,
        status: 'present',
        def: exact,
        message: 'Matched CSV property',
      });
      continue;
    }

    const loose = CATALOG_BY_LOOSE.get(looseUserPropertyKey(key));
    if (loose) {
      seen.add(loose.name);
      renamed.push({
        key,
        canonical: loose.name,
        value,
        values,
        status: 'renamed',
        def: loose,
        message: `Rename to “${loose.name}” — the CSV uses camelCase`,
      });
      continue;
    }

    extra.push({
      key,
      value,
      values,
      status: 'extra',
      message: 'Not in the CSV — remove it',
    });
  }

  present.sort(byCatalogOrder);
  renamed.sort(byCatalogOrder);
  extra.sort((a, b) => a.key.localeCompare(b.key));

  const missing: UserPropertyRow[] = USER_PROPERTY_CATALOG.filter(
    (def) => !seen.has(def.name),
  ).map((def) => ({
    key: def.name,
    canonical: def.name,
    value: '',
    values: [],
    status: 'missing',
    def,
    message: 'Required by the CSV but absent from the paste',
  }));

  return {
    format: parsed.format,
    errors: parsed.errors,
    present,
    renamed,
    missing,
    extra,
    ignored: parsed.ignored,
    summary: {
      catalogTotal: USER_PROPERTY_CATALOG.length,
      pastedTotal: present.length + renamed.length + extra.length,
      matched: present.length,
      renamed: renamed.length,
      missing: missing.length,
      extra: extra.length,
      ignored: parsed.ignored.length,
      coverage: Math.round((present.length / USER_PROPERTY_CATALOG.length) * 100),
    },
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

function csvCell(value: string | number): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildUserPropertiesCsv(result: UserPropertyAnalysis): string {
  const header = [
    'Property',
    'Status',
    'Canonical name',
    'Value in paste',
    'When it should be updated',
    'Source',
    'Action',
  ];

  // Actionable rows first: missing → rename → extra → matched.
  const rows = [
    ...result.missing,
    ...result.renamed,
    ...result.extra,
    ...result.present,
  ].map((row) => [
    row.key,
    row.status,
    row.canonical ?? '',
    row.value,
    row.def?.whenUpdated ?? '',
    row.def?.source ?? '',
    row.message,
  ]);

  return [header, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\n');
}

/** Property names to add, one per line — ready to hand to the dev team. */
export function buildMissingList(result: UserPropertyAnalysis): string {
  return result.missing.map((row) => row.key).join('\n');
}

/** Pasted keys that are not in the CSV, one per line. */
export function buildExtraList(result: UserPropertyAnalysis): string {
  return result.extra.map((row) => row.key).join('\n');
}

// ─── Sample ───────────────────────────────────────────────────────────────────

/**
 * Realistic profile push with 18 CSV properties, one extra property
 * (`deviceModel`) and nine missing properties so every bucket is visible.
 */
export const SAMPLE_USER_PROPERTIES = `{
  "type": "profile",
  "profileData": {
    "Site": {
      "profileType": "Profile",
      "parentalControl": "U/A 13+",
      "countryCode": "IN",
      "city": "Hyderabad",
      "currentLanguage": "Telugu",
      "previousLanguage": "Tamil",
      "platform": "Web",
      "loginMethod": "Email Address",
      "Email": "santhosh@gmail.com",
      "Phone": "+918127643176",
      "accountID": "2111020644218234129",
      "subscriptionStatusD2C": "True",
      "isEVThread": "False",
      "MSG-whatsapp": "True",
      "Name": "Dilip Kumar",
      "Gender": "Male",
      "currentLanguageShorts": "Telugu",
      "previousLanguageShorts": "Tamil",
      "deviceModel": "SM-G991B"
    }
  }
}`;
