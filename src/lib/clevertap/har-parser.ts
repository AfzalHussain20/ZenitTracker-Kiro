/**
 * HAR → CleverTap event extractor
 * ────────────────────────────────────────────────────────────────────────────
 * Parses a browser HAR file **entirely in memory** and keeps only:
 *   • CleverTap request entries (wzrkt.com / api.clevertap.com / *clevertap*)
 *   • Event names + property NAMES
 *
 * It deliberately discards every sensitive thing a HAR can contain:
 * headers, cookies, auth tokens, URLs with query strings, request/response
 * values, and user identity. The result is safe to display, export, or paste.
 *
 * Why property names only? The gap analyser compares the CSV's expected
 * properties against what was captured. Values are irrelevant for that check,
 * so there is no reason to retain them.
 */

import { normalizeName, type CapturedEvent, type ParseResult } from './event-catalog';

// ─── HAR shape (only the fields we read) ─────────────────────────────────────

interface HarNameValue {
  name?: string;
  value?: string;
}

interface HarEntry {
  request?: {
    method?: string;
    url?: string;
    queryString?: HarNameValue[];
    postData?: {
      mimeType?: string;
      text?: string;
      params?: HarNameValue[];
    };
  };
}

interface HarFile {
  log?: {
    entries?: HarEntry[];
  };
}

// ─── Result ──────────────────────────────────────────────────────────────────

export interface HarExtractStats {
  entriesScanned: number;
  cleverTapEntries: number;
  payloadsDecoded: number;
  eventsFound: number;
  /** Host + path only — query strings (which can carry tokens) are stripped. */
  sources: string[];
}

export interface HarExtractResult extends ParseResult {
  stats: HarExtractStats;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** URL matcher for CleverTap ingestion endpoints (region subdomains included). */
const CLEVERTAP_URL = /(?:^|\.)clevertap\.com|wzrkt\.com|clevertap/i;

/** Query/body parameter names that carry the event payload. */
const PAYLOAD_KEYS = new Set(['d', 'evt', 'event', 'events', 'data', 'payload', 'body']);

const STRONG_NAME_KEYS = ['evtName', 'eventName', 'EventName', 'event', 'Event'];
const WEAK_NAME_KEYS = ['name', 'Name'];
const PROP_KEYS = ['evtData', 'properties', 'props', 'Properties', 'attributes', 'params', 'data'];
const IGNORED_PROP_KEYS = new Set(['ts', 'type', 'evt', 'profile', 'ep', 'guid']);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function looksLikeEventName(v: string): boolean {
  const t = v.trim();
  return t.length > 0 && t.length <= 80 && /^[A-Za-z][A-Za-z0-9 _./:-]*$/.test(t);
}

function hostPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return 'unknown';
  }
}

function addEvent(out: CapturedEvent[], name: string, props: string[]): void {
  if (!looksLikeEventName(name)) return;
  out.push({
    name: name.trim(),
    properties: [...new Set(props.map((p) => p.trim()).filter(Boolean))],
    count: 1,
  });
}

function propsFrom(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (isObject(value)) return Object.keys(value);
  return [];
}

/**
 * Recursively find event-shaped objects in a decoded CleverTap payload.
 * Handles the common shapes:
 *   { evt: [ { evtName, evtData }, … ] }
 *   { evtName, evtData }
 *   { "Login": { … } }
 */
function walkForEvents(value: unknown, out: CapturedEvent[], depth = 0): void {
  if (depth > 8) return;

  if (Array.isArray(value)) {
    for (const item of value) walkForEvents(item, out, depth + 1);
    return;
  }
  if (!isObject(value)) return;

  // Batched form: { evt: [...] } / { events: [...] }
  const batch = value.evt ?? value.events;
  if (Array.isArray(batch)) {
    for (const item of batch) walkForEvents(item, out, depth + 1);
    return;
  }

  // Strong event signal
  const strong = STRONG_NAME_KEYS.find((k) => typeof value[k] === 'string' && (value[k] as string).trim());
  const weak = WEAK_NAME_KEYS.find((k) => typeof value[k] === 'string' && (value[k] as string).trim());
  const hasProps = PROP_KEYS.some((k) => value[k] !== undefined);

  if (strong || (weak && hasProps)) {
    const name = String(value[strong ?? weak!]).trim();
    let props: string[] = [];
    for (const k of PROP_KEYS) {
      if (value[k] !== undefined) {
        props = propsFrom(value[k]);
        if (props.length) break;
      }
    }
    if (props.length === 0) {
      // Flat form: every non-metadata key is a property.
      props = Object.keys(value).filter(
        (k) =>
          !STRONG_NAME_KEYS.includes(k) &&
          !WEAK_NAME_KEYS.includes(k) &&
          !IGNORED_PROP_KEYS.has(k) &&
          !k.startsWith('wzrk'),
      );
    }
    addEvent(out, name, props);
    return;
  }

  // Map form: { "Login": { source: "D2C" }, … }
  const keys = Object.keys(value);
  if (keys.length > 0 && keys.every((k) => looksLikeEventName(k)) && !keys.some((k) => IGNORED_PROP_KEYS.has(k))) {
    const before = out.length;
    for (const [k, v] of Object.entries(value)) {
      if (isObject(v) || Array.isArray(v)) addEvent(out, k, propsFrom(v));
    }
    if (out.length > before) return;
  }

  // Otherwise keep looking deeper (profile, meta wrappers, …)
  for (const v of Object.values(value)) {
    if (isObject(v) || Array.isArray(v)) walkForEvents(v, out, depth + 1);
  }
}

function tryJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function tryBase64(text: string): string | null {
  const compact = text.replace(/\s+/g, '');
  if (compact.length < 16 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null;
  try {
    // atob exists in browsers and jsdom; Buffer is not used so this file stays
    // client-only and dependency-free.
    const decoded = atob(compact);
    // Re-encode as UTF-8-safe text when possible.
    try {
      return decodeURIComponent(escape(decoded));
    } catch {
      return decoded;
    }
  } catch {
    return null;
  }
}

/**
 * Turn a raw request body / query value into decoded JSON.
 * Tries, in order: plain JSON → `k=v&…` params → URL-decoding → base64.
 */
function decodePayload(raw: string, depth = 0): unknown | null {
  if (depth > 4) return null;
  const text = raw.trim();
  if (!text) return null;

  const direct = tryJson(text);
  if (direct !== null) return direct;

  // `d=%7B…%7D` or `a=1&d=…`
  if (text.includes('=')) {
    try {
      const params = new URLSearchParams(text);
      // Prioritise known payload keys, then fall back to every value.
      const ordered = [...params.entries()].sort(([a], [b]) => {
        const aHit = PAYLOAD_KEYS.has(a.toLowerCase()) ? 0 : 1;
        const bHit = PAYLOAD_KEYS.has(b.toLowerCase()) ? 0 : 1;
        return aHit - bHit;
      });
      for (const [, value] of ordered) {
        const decoded = decodePayload(value, depth + 1);
        if (decoded !== null) return decoded;
      }
    } catch {
      /* not form-encoded */
    }
  }

  // Percent-encoded JSON
  if (/%[0-9A-Fa-f]{2}/.test(text)) {
    try {
      const decoded = decodePayload(decodeURIComponent(text), depth + 1);
      if (decoded !== null) return decoded;
    } catch {
      /* bad escape */
    }
  }

  // Base64-encoded JSON
  const b64 = tryBase64(text);
  if (b64) {
    const decoded = tryJson(b64) ?? decodePayload(b64, depth + 1);
    if (decoded !== null) return decoded;
  }

  return null;
}

/** Pull every candidate payload string out of one CleverTap HAR entry. */
function payloadStrings(entry: HarEntry): string[] {
  const out: string[] = [];
  const post = entry.request?.postData;

  if (post?.text) out.push(post.text);
  for (const p of post?.params ?? []) {
    if (p.value) out.push(p.value);
  }
  for (const q of entry.request?.queryString ?? []) {
    if (q.value && (!q.name || PAYLOAD_KEYS.has(q.name.toLowerCase()))) out.push(q.value);
  }
  return out;
}

function mergeEvents(events: CapturedEvent[]): CapturedEvent[] {
  const map = new Map<string, CapturedEvent>();
  for (const e of events) {
    const key = normalizeName(e.name);
    const existing = map.get(key);
    if (existing) {
      existing.count += e.count;
      existing.properties = [...new Set([...existing.properties, ...e.properties])];
    } else {
      map.set(key, { ...e, properties: [...e.properties] });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Extract CleverTap events from a parsed HAR object.
 * The caller is responsible for reading the file locally — this function never
 * performs I/O and never retains headers, cookies, values, or identity.
 */
export function extractCleverTapEventsFromHar(har: unknown): HarExtractResult {
  const events: CapturedEvent[] = [];
  const errors: string[] = [];
  const sources = new Set<string>();
  const stats: HarExtractStats = {
    entriesScanned: 0,
    cleverTapEntries: 0,
    payloadsDecoded: 0,
    eventsFound: 0,
    sources: [],
  };

  const entries = (har as HarFile)?.log?.entries;
  if (!Array.isArray(entries)) {
    return {
      events: [],
      format: 'har',
      errors: ['Not a HAR file: expected log.entries[] in the JSON.'],
      ignoredLines: 0,
      stats,
    };
  }

  stats.entriesScanned = entries.length;

  for (const entry of entries) {
    const url = entry.request?.url ?? '';
    if (!url || !CLEVERTAP_URL.test(url)) continue;

    stats.cleverTapEntries++;
    sources.add(hostPath(url));

    const candidates = payloadStrings(entry);
    if (candidates.length === 0) continue;

    let decodedAny = false;
    for (const candidate of candidates) {
      const decoded = decodePayload(candidate);
      if (decoded === null) continue;
      decodedAny = true;
      stats.payloadsDecoded++;
      walkForEvents(decoded, events);
    }

    if (!decodedAny) {
      errors.push(`CleverTap request could not be decoded: ${hostPath(url)}`);
    }
  }

  const merged = mergeEvents(events);
  stats.eventsFound = merged.length;
  stats.sources = [...sources].sort();

  if (stats.cleverTapEntries === 0) {
    errors.push(
      'No CleverTap requests found in this HAR. Record the session with the Network tab filtered to “clevertap”, then export again.',
    );
  }

  return {
    events: merged,
    format: 'har',
    errors,
    ignoredLines: Math.max(0, stats.entriesScanned - stats.cleverTapEntries),
    stats,
  };
}

/**
 * Sanitised export: event names + property names only.
 * Safe to share — contains no values, headers, cookies, URLs, or identity.
 */
export function sanitizeHarEvents(events: CapturedEvent[]): string {
  return JSON.stringify(
    events.map((e) => ({ event: e.name, properties: e.properties })),
    null,
    2,
  );
}

/** Console snippet that captures clevertap.push() calls without a HAR. */
export const CONSOLE_CAPTURE_SNIPPET = `// 1) Paste this in the browser console BEFORE using the app
window.__ct = [];
window.__ctOrig = window.__ctOrig || (window.clevertap && window.clevertap.push);
if (window.clevertap && !window.clevertap.__zenitHooked) {
  const orig = window.clevertap.push.bind(window.clevertap);
  window.clevertap.push = function (args) {
    window.__ct.push(args);
    return orig(args);
  };
  window.clevertap.__zenitHooked = true;
}

// 2) Use the app (login, home, search, content click, playback…)

// 3) Then run this and paste the copied JSON into Catalog & Gaps
copy(JSON.stringify(window.__ct, null, 2));`;
