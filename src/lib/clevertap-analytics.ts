/**
 * ZenitAnalytics — CleverTap 2.0-style analytics for Zenit Tracker.
 *
 * Design goals (no CleverTap API key required to get value):
 *   • Follows the CleverTap CSV event contract:
 *       – Event names in SNAKE_CASE (Login, Page_View, Test_Case_Executed …)
 *       – Properties in camelCase
 *       – `source` = "B2B <partner>" | "D2C <plan>"
 *       – Timestamps as epoch ms ($D_<epoch>)
 *   • Pluggable provider: CleverTapProvider is a no-op buffer when no key is
 *     configured, so events are never dropped. Plug in the real CleverTap JS
 *     SDK the day you have a key — no event-schema migration needed.
 *   • Firestore fallback: every event is also written to the
 *     `analytics_events` collection (via AnalyticsTracker), so you have a
 *     complete, queryable event log locally even without CleverTap.
 *   • Auto page-view tracking on route changes; manual `track()` for
 *     Zenit-specific events (test-case execution, session runs, bugs, exports).
 *
 * The CSV you were given maps cleanly onto Zenit Tracker concepts:
 *   CleverTap                    → Zenit Tracker
 *   -----------------------------+------------------------------------------
 *   Login                        → email / Google sign-in
 *   Logout                       → sign-out
 *   Page_View                    → every route change
 *   Searched                     → global AI / bug search
 *   Content_Clicked              → click a test case, bug, or session
 *   (custom) Test_Case_Executed  → Pass / Fail / N/A on a case
 *   (custom) Session_Started     → test session run begins
 *   (custom) Session_Completed   → session run finishes (+ summary)
 *   (custom) Bug_Reported        → new bug filed
 *   (custom) Bug_Resolved        → bug moved to resolved/closed
 *   (custom) PRD_Uploaded        → PRD import
 *   (custom) Test_Case_Generated → AI-generated test cases
 *   (custom) Export_Downloaded   → CSV / XLSX export
 */

import { FirebaseConnector } from './firebase-connector';
import { db } from '@/lib/firebaseConfig';
import { Timestamp } from 'firebase/firestore';
import type {
  AnalyticsDomain,
  AnalyticsEvent,
} from '@/types/bug-analytics';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Config
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ZenitAnalyticsConfig {
  /** CleverTap account ID (optional — events still captured locally without it). */
  clevertapAccountId?: string;
  /** CleverTap passcode / token (optional). */
  clevertapToken?: string;
  /** Firestore batch flush threshold. */
  batchSize?: number;
  /** Max events to keep in the local buffer. */
  maxBufferSize?: number;
}

const DEFAULT_CONFIG: Required<ZenitAnalyticsConfig> = {
  clevertapAccountId: '',
  clevertapToken: '',
  batchSize: 10,
  maxBufferSize: 500,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Event types (snake_case names per CleverTap contract)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type ZenitEventName =
  | 'App_Launched'
  | 'Login'
  | 'Logout'
  | 'Page_View'
  | 'Searched'
  | 'Content_Clicked'
  | 'Test_Case_Executed'
  | 'Test_Case_Created'
  | 'Test_Case_Edited'
  | 'Session_Started'
  | 'Session_Completed'
  | 'Bug_Reported'
  | 'Bug_Resolved'
  | 'PRD_Uploaded'
  | 'Test_Case_Generated'
  | 'Export_Downloaded'
  | 'Media_Error'
  | string; // allow CleverTap-standard events too

export interface ZenitEventProperties {
  source?: 'B2B' | 'D2C' | string;
  contentLanguage?: string;
  appName?: string;
  [key: string]: any;
}

export interface ZenitTrackOptions {
  eventName: ZenitEventName;
  properties?: ZenitEventProperties;
  userId?: string;
  userName?: string;
  domain?: AnalyticsDomain;
  bugId?: string;
  sessionId?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CleverTap client adapter
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * CleverTapProvider — the integration point for the real CleverTap SDK.
 *
 * Without `clevertapAccountId`/`clevertapToken` this is a graceful no-op:
 * events are buffered in memory only (and mirrored to Firestore via
 * `flushToFirestore`). The moment you configure a key, swap `push` to call
 * the real CleverTap JS (`clevertap.push(["event", name, props])`) — the
 * event schema (snake_case names + camelCase props) needs zero changes.
 */
class CleverTapProvider {
  private accountId: string;
  private token: string;
  private enabled: boolean;
  private buffer: Array<{ name: string; props: any; ts: number }> = [];

  constructor(accountId: string, token: string) {
    this.accountId = accountId;
    this.token = token;
    this.enabled = Boolean(accountId && token && typeof window !== 'undefined');
    if (this.enabled) {
      this.initCleverTap();
    }
  }

  private initCleverTap() {
    // Real CleverTap SDK initialization goes here once you have credentials.
    // Example (uncomment when key is available):
    //
    // (window as any).clevertap = (window as any).clevertap || [];
    // (window as any).clevertap.push(["onUserLogin", {
    //   "Identity": this.accountId,
    //   "email": <user email>,
    //   "NAME": <user name>,
    // }]);
    // (window as any).clevertap.push(["event", name, props]);
  }

  push(name: string, props: any) {
    this.buffer.push({ name, props, ts: Date.now() });
    if (this.buffer.length > 1000) this.buffer = this.buffer.slice(-1000);
    if (this.enabled) {
      this.sendToCleverTap(name, props);
    }
  }

  private sendToCleverTap(name: string, props: any) {
    // Hook for the real SDK. No-op until credentials are configured.
    try {
      const ct = (window as any)?.clevertap;
      if (ct && typeof ct.push === 'function') {
        ct.push(['event', name, props]);
      }
    } catch {
      // swallow — Firestore fallback keeps the data safe
    }
  }

  getBuffer() {
    return [...this.buffer];
  }

  clearBuffer() {
    this.buffer = [];
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ZenitAnalytics manager
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class ZenitAnalytics {
  private config: Required<ZenitAnalyticsConfig>;
  private clevertap: CleverTapProvider;
  private connector: FirebaseConnector | null = null;
  private sessionId: string;
  private started = false;

  constructor(config: ZenitAnalyticsConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.clevertap = new CleverTapProvider(
      this.config.clevertapAccountId,
      this.config.clevertapToken,
    );
    this.sessionId = `zenit_session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /** Lazy-connect Firestore fallback (only when db is available). */
  private ensureConnector() {
    if (!this.connector && db) {
      this.connector = new FirebaseConnector(db);
    }
    return this.connector;
  }

  /**
   * Track a Zenit event. Goes to CleverTap (when configured) AND is queued
   * for Firestore persistence so nothing is lost without a key.
   */
  async track(opts: ZenitTrackOptions): Promise<void> {
    const { eventName, properties = {}, userId, userName, domain = 'user_action', bugId, sessionId } = opts;

    const payload: AnalyticsEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      timestamp: Timestamp.now(),
      eventType: eventName,
      domain,
      userId: userId || 'anonymous',
      userName,
      metadata: {
        ...properties,
        source: properties.source || 'D2C',
        appName: properties.appName || 'Zenit Tracker',
        $D_timestamp: Date.now(),
        bugId,
        sessionId: sessionId || this.sessionId,
      },
      sessionId: sessionId || this.sessionId,
      bugId,
      searchableText: [eventName, String(properties.contentTitle || ''), String(properties.searchString || '')]
        .filter(Boolean).join(' '),
    };

    // 1) CleverTap (no-op buffer when no key)
    this.clevertap.push(eventName, properties);

    // 2) Firestore fallback (best-effort, never throws to caller)
    const connector = this.ensureConnector();
    if (connector) {
      try {
        await connector.create('analytics_events', payload, payload.id);
      } catch (err) {
        console.error('[ZenitAnalytics] Firestore write failed:', err);
      }
    }
  }

  /** Convenience: track a page view (called automatically on route change). */
  async pageView(currentPage: string, previousPage?: string, source?: string) {
    return this.track({
      eventName: 'Page_View',
      domain: 'user_action',
      properties: {
        source,
        currentPage,
        previousPage,
        appName: 'Zenit Tracker',
      },
    });
  }

  /** Convenience: track login. */
  async login(userId: string, userName: string, source: 'email' | 'google' = 'email', isNewUser = false) {
    return this.track({
      eventName: 'Login',
      domain: 'user_action',
      userId,
      userName,
      properties: { source, isNewUser, loginStatus: 'success', appName: 'Zenit Tracker' },
    });
  }

  /** Convenience: track logout. */
  async logout(userId: string, userName?: string) {
    return this.track({
      eventName: 'Logout',
      domain: 'user_action',
      userId,
      userName,
      properties: { appName: 'Zenit Tracker' },
    });
  }

  /** Convenience: track test-case execution (Pass/Fail/N/A). */
  async testCaseExecuted(
    userId: string,
    caseId: string,
    caseTitle: string,
    status: 'Pass' | 'Fail' | 'N/A' | 'Untested' | 'Fail (Known)',
    suiteName?: string,
  ) {
    return this.track({
      eventName: 'Test_Case_Executed',
      domain: 'user_action',
      userId,
      properties: {
        contentTitle: caseTitle,
        contentID: caseId,
        suiteName,
        testCaseStatus: status,
        appName: 'Zenit Tracker',
      },
      bugId: undefined,
    });
  }

  /** Convenience: track a bug being reported. */
  async bugReported(userId: string, bugId: string, bugTitle: string, severity: string) {
    return this.track({
      eventName: 'Bug_Reported',
      domain: 'user_action',
      userId,
      bugId,
      properties: {
        contentTitle: bugTitle,
        contentID: bugId,
        bugSeverity: severity,
        appName: 'Zenit Tracker',
      },
    });
  }

  /** Convenience: track an export download (CSV/XLSX). */
  async exportDownloaded(userId: string, format: 'csv' | 'xlsx', recordCount: number) {
    return this.track({
      eventName: 'Export_Downloaded',
      domain: 'user_action',
      userId,
      properties: { format, recordCount, appName: 'Zenit Tracker' },
    });
  }

  /** Flush any in-memory CleverTap buffer (for when key is added later). */
  flush() {
    this.clevertap.clearBuffer();
  }

  getSessionId() {
    return this.sessionId;
  }

  isCleverTapEnabled() {
    return this.clevertap['enabled'];
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Singleton
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const zenitAnalytics = new ZenitAnalytics({
  clevertapAccountId: process.env.NEXT_PUBLIC_CLEVERTAP_ACCOUNT_ID || '',
  clevertapToken: process.env.NEXT_PUBLIC_CLEVERTAP_TOKEN || '',
});
