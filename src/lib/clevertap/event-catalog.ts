/**
 * CleverTap Event Catalog + Gap Analysis
 * ────────────────────────────────────────────────────────────────────────────
 * Source of truth: `Clevertap Events.csv` (39 custom events) supplied by the
 * analytics team. This module embeds that catalog so Zenit can compare it
 * against events actually captured from CleverTap / DevTools — with **no API
 * key required**. The analyst pastes whatever they have (event-name list,
 * NDJSON, a JSON array, or the DevTools payload) and we diff it here.
 *
 * Event-name convention (per the CSV header note):
 *   • Event names  → SNAKE_CASE with `_` separators
 *   • Properties   → camelCase
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type CatalogCategory =
  | 'Lifecycle'
  | 'Discovery'
  | 'Playback'
  | 'Ads'
  | 'Subscription'
  | 'Profile & Account'
  | 'Library'
  | 'Zenit Specific';

/**
 * How far a CSV event has travelled inside Zenit Tracker.
 *  • wired         – tracked automatically / called from app code today
 *  • available     – helper exists in `clevertap-analytics.ts`, not yet called
 *  • schema-only   – defined in `analytics-schema.json`, no code path yet
 *  • not-implemented – video/streaming event with no Zenit equivalent
 */
export type ZenitStatus = 'wired' | 'available' | 'schema-only' | 'not-implemented';

export interface CatalogEvent {
  name: string;
  category: CatalogCategory;
  trigger: string;
  properties: string[];
  zenitStatus: ZenitStatus;
  /** Closest Zenit Tracker concept, when one exists. */
  zenitEquivalent?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// The 39 events from `Clevertap Events.csv`
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const CLEVERTAP_CATALOG: CatalogEvent[] = [
  // ── Lifecycle ──────────────────────────────────────────────────────────────
  {
    name: 'Login',
    category: 'Lifecycle',
    trigger: 'When the user clicks sign-in and again when the user successfully logs in',
    properties: ['source', 'isNewUser', 'otpCalls', 'loginStatus', 'contentLanguage'],
    zenitStatus: 'available',
    zenitEquivalent: 'Email / Google sign-in',
  },
  {
    name: 'Logout',
    category: 'Lifecycle',
    trigger: 'When the user is logged out of the platform',
    properties: [],
    zenitStatus: 'available',
    zenitEquivalent: 'Sign-out',
  },
  {
    name: 'Page_View',
    category: 'Lifecycle',
    trigger: 'Triggered on every page opened',
    properties: ['previousPage', 'currentPage', 'contentLanguage', 'source', 'appName'],
    zenitStatus: 'wired',
    zenitEquivalent: 'Route change (auto-tracked)',
  },
  {
    name: 'Language_Update',
    category: 'Lifecycle',
    trigger: 'When a new user launches the app for the first time and navigates through onboarding',
    properties: ['contentLanguageSunNXT', 'appName', 'contentLanguageShorts'],
    zenitStatus: 'not-implemented',
  },

  // ── Discovery ──────────────────────────────────────────────────────────────
  {
    name: 'Searched',
    category: 'Discovery',
    trigger: 'When a keyword is entered and searched',
    properties: ['searchString', 'isFound', 'contentLanguage', 'appName'],
    zenitStatus: 'schema-only',
    zenitEquivalent: 'Global AI / bug search',
  },
  {
    name: 'Content_Clicked',
    category: 'Discovery',
    trigger: 'When the user clicks on content from any tray',
    properties: [
      'source', 'contentTitle', 'contentGenre', 'actorName', 'contentDuration',
      'showName', 'seasonNumber', 'trayName', 'positionInTray', 'directorName',
      'episodeNumber', 'contentID', 'trayType', 'appName', 'contentType',
      'isFree', 'contentLanguage',
    ],
    zenitStatus: 'schema-only',
    zenitEquivalent: 'Click a test case / bug / session',
  },
  {
    name: 'See_All_Clicked',
    category: 'Discovery',
    trigger: 'When the user clicks "See All" on a tray',
    properties: ['source', 'trayName', 'trayType', 'contentLanguage', 'appName', 'contentType'],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'View_Plans',
    category: 'Discovery',
    trigger: 'When a user lands on the View Plans page',
    properties: ['source', 'contentLanguage', 'appName'],
    zenitStatus: 'not-implemented',
    zenitEquivalent: 'Pricing / plan page view',
  },
  {
    name: 'Retention_Prompt_Clicked',
    category: 'Discovery',
    trigger: 'When the user clicks the retention prompt shown on the home page',
    properties: ['contentLanguage', 'userType'],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Banner_Ad_Click',
    category: 'Discovery',
    trigger: 'When a user clicks a banner ad (GAM or in-house banner)',
    properties: ['adType', 'currentPage', 'userType', 'redirectionURL', 'appName'],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Help_Clicked',
    category: 'Discovery',
    trigger: 'When a user clicks Help under settings',
    properties: ['contentLanguage', 'source'],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'T&C_Clicked',
    category: 'Discovery',
    trigger: 'When a user clicks Terms & Conditions under settings',
    properties: ['contentLanguage', 'source'],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Referral',
    category: 'Discovery',
    trigger: 'When a user attempts to send a referral link',
    properties: ['invitationSent', 'mediumOfReferral'],
    zenitStatus: 'not-implemented',
  },

  // ── Playback ───────────────────────────────────────────────────────────────
  {
    name: 'Watched',
    category: 'Playback',
    trigger: 'Triggers when a stream starts, and at 25% / 50% / 80% / 100% completion',
    properties: [
      'source', 'contentTitle', 'contentGenre', 'actorName', 'contentDuration',
      'showName', 'seasonNumber', 'episodeNumber', 'appName', 'networkType',
      'bitrate', 'timeToFirstByte', 'watchedTime', 'directorName', 'bufferTime',
      'bufferCount', 'ccEnabled', 'contentID', 'contentType', 'isFree',
      'playbackType', 'seekStartTime', 'seekEndTime', 'streamPercentage',
      'contentLanguage', 'contentLanguageShorts', 'playbackMode',
    ],
    zenitStatus: 'not-implemented',
    zenitEquivalent: 'Test-case execution progress (25/50/80/100%)',
  },
  {
    name: 'Media_Error',
    category: 'Playback',
    trigger: 'Captured when an error appears while playing a video, along with the error message',
    properties: ['playErrorEventData', 'errorMessage', 'contentTitle', 'isFree', 'contentLanguage', 'source', 'contentType'],
    zenitStatus: 'schema-only',
    zenitEquivalent: 'Client / playback error capture',
  },
  {
    name: 'Skip_Intro',
    category: 'Playback',
    trigger: 'When a user clicks Skip Intro',
    properties: ['contentID', 'contentTitle', 'showName', 'networkType', 'bitrate', 'contentLanguage', 'source', 'appName'],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Cast',
    category: 'Playback',
    trigger: 'When a user attempts to cast',
    properties: ['isCasting', 'source', 'contentTitle', 'contentLanguage', 'appName'],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Download',
    category: 'Playback',
    trigger: 'When a user attempts to download',
    properties: [
      'contentID', 'contentTitle', 'contentGenre', 'actorName', 'directorName',
      'showName', 'resolution', 'contentLanguage', 'appName', 'episodeNumber',
      'contentType', 'isFree', 'seasonNumber', 'contentDuration', 'source',
      'downloadStatus',
    ],
    zenitStatus: 'not-implemented',
  },

  // ── Ads ────────────────────────────────────────────────────────────────────
  {
    name: 'Ad_Break_Start',
    category: 'Ads',
    trigger: 'When the player reaches the ad cue point / ad slot',
    properties: [
      'adType', 'contentTitle', 'contentGenre', 'source', 'contentDuration',
      'showName', 'seasonNumber', 'adClickURL', 'adskipOffset', 'directorName',
      'episodeNumber', 'contentID', 'trayType', 'adDuration', 'isFree',
      'contentLanguage', 'appName', 'playbackMode',
    ],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Ad_Start',
    category: 'Ads',
    trigger: 'When ad playback starts',
    properties: [
      'adType', 'contentTitle', 'contentGenre', 'source', 'contentDuration',
      'showName', 'seasonNumber', 'adClickURL', 'adskipOffset', 'directorName',
      'episodeNumber', 'contentID', 'trayType', 'adDuration', 'isFree',
      'contentLanguage', 'appName', 'playbackMode',
    ],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Ad_Break_Complete',
    category: 'Ads',
    trigger: 'When the player reaches the end of the ad cue point / ad slot',
    properties: [
      'adType', 'contentTitle', 'contentGenre', 'source', 'contentDuration',
      'showName', 'seasonNumber', 'adClickURL', 'adskipOffset', 'directorName',
      'episodeNumber', 'contentID', 'trayType', 'adDuration', 'isFree',
      'contentLanguage', 'appName', 'playbackMode',
    ],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Ad_End',
    category: 'Ads',
    trigger: 'When ad playback ends',
    properties: [
      'adType', 'contentTitle', 'contentGenre', 'source', 'contentDuration',
      'showName', 'seasonNumber', 'adClickURL', 'adskipOffset', 'directorName',
      'episodeNumber', 'contentID', 'trayType', 'adDuration', 'isFree',
      'contentLanguage', 'appName', 'playbackMode', 'contentType',
    ],
    zenitStatus: 'not-implemented',
  },

  // ── Subscription ───────────────────────────────────────────────────────────
  {
    name: 'Subscription_Initiated',
    category: 'Subscription',
    trigger: 'When a user initiates a subscription (clicks subscribe on the View Plans page)',
    properties: [
      'offerCodeSelected', 'paymentPlan', 'planID', 'currency', 'actualPrice',
      'discountedPrice', 'isConfirmed', 'contentLanguage', 'source', 'appName',
    ],
    zenitStatus: 'not-implemented',
    zenitEquivalent: 'Plan upgrade / checkout start',
  },
  {
    name: 'Payment_Initiated',
    category: 'Subscription',
    trigger: 'When a user initiates payment (clicks Pay on the payment page)',
    properties: [
      'offerApplied', 'paymentPlan', 'planID', 'currency', 'actualPrice',
      'discountedPrice', 'transactionAmount', 'appName', 'trnasactionAmount',
      'paymentMode', 'paymentSubMode', 'paymentSubModeOffer',
    ],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Subscription',
    category: 'Subscription',
    trigger: 'When a user successfully subscribes, or a subscription fails',
    properties: [
      'offerApplied', 'paymentPlan', 'planID', 'currency', 'actualPrice',
      'discountedPrice', 'transactionAmount', 'deviceName', 'deviceModel',
      'appName', 'paymentMode', 'paymentProvider', 'paymentProviderOffer',
      'isAutoRenewal', 'planStartDate', 'planEndDate', 'transactionId',
      'deviceGroup', 'isReferred', 'orderId', 'isAutoRenewalReSubscription',
      'failureReason', 'subscriptionStatus', 'isUpgrade', 'deviceManufacturer',
      'upgradeType',
    ],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Subscription_Cancel',
    category: 'Subscription',
    trigger: 'When a user attempts to cancel a subscription',
    properties: ['cancelStatus'],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Subscription_Upgrade',
    category: 'Subscription',
    trigger: 'When a user attempts to upgrade a subscription',
    properties: ['upgradeStatus'],
    zenitStatus: 'not-implemented',
  },

  // ── Profile & Account ──────────────────────────────────────────────────────
  {
    name: 'Create_Profile',
    category: 'Profile & Account',
    trigger: 'When a user attempts to create a new profile',
    properties: ['contentLanguage', 'displayLanguage', 'profileName', 'appName'],
    zenitStatus: 'not-implemented',
    zenitEquivalent: 'Create a new test workspace / org',
  },
  {
    name: 'Edit_Profile',
    category: 'Profile & Account',
    trigger: 'When a user attempts to edit a profile or its viewing restrictions',
    properties: [
      'contentLanguage', 'displayLanguage', 'profileName', 'profileType',
      'viewingRestrcition', 'isPinSet', 'source', 'appName',
    ],
    zenitStatus: 'not-implemented',
    zenitEquivalent: 'Edit account / org settings',
  },
  {
    name: 'Remove_Profile',
    category: 'Profile & Account',
    trigger: 'When a user attempts to remove a profile',
    properties: ['contentLanguage', 'displayLanguage', 'profileName', 'profileType', 'source', 'appName'],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Edit_Account_Details',
    category: 'Profile & Account',
    trigger: 'When a user attempts to edit account details (personal information) from settings',
    properties: [],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Parental_Control',
    category: 'Profile & Account',
    trigger: 'When a user attempts to enable parental control from account settings',
    properties: ['isEnabled', 'viewingRestriction', 'isPinSet'],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Change_App_Settings',
    category: 'Profile & Account',
    trigger: 'When a user attempts to change app settings',
    properties: ['downloadSettings', 'autoplaySettings'],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Linked_MobileNumber',
    category: 'Profile & Account',
    trigger: 'After a user successfully links their mobile number to their account',
    properties: ['source', 'loginMethod'],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Link_Device',
    category: 'Profile & Account',
    trigger: 'When the user tries to activate a TV device',
    properties: ['isQRCode', 'isManualCode', 'isSuccessful', 'contentLanguage', 'source'],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Delete_Device',
    category: 'Profile & Account',
    trigger: 'When a user attempts to delete a device via Device Management in settings',
    properties: ['isActive'],
    zenitStatus: 'not-implemented',
  },

  // ── Library ────────────────────────────────────────────────────────────────
  {
    name: 'Added_to_Watchlist',
    category: 'Library',
    trigger: 'When a user adds a video to their watchlist (all video metadata is captured)',
    properties: [
      'contentID', 'contentTitle', 'contentGenre', 'actorName', 'directorName',
      'showName', 'contentLanguage', 'source', 'appName', 'episodeNumber',
      'contentType', 'isFree', 'seasonNumber', 'contentDuration', 'trayName',
      'trayType', 'positionInTray',
    ],
    zenitStatus: 'not-implemented',
    zenitEquivalent: 'Save / pin a test case or suite',
  },
  {
    name: 'Removed_From_Watchlist',
    category: 'Library',
    trigger: 'When a user removes a video from their watchlist',
    properties: [
      'contentID', 'contentTitle', 'contentGenre', 'actorName', 'directorName',
      'showName', 'contentLanguage', 'appName', 'episodeNumber', 'contentType',
      'isFree', 'seasonNumber', 'contentDuration', 'itemPosition', 'removeAll',
      'contentLanguageShorts',
    ],
    zenitStatus: 'not-implemented',
  },
  {
    name: 'Shared',
    category: 'Library',
    trigger: 'When a user clicks the share icon',
    properties: [
      'contentID', 'contentTitle', 'contentGenre', 'actorName', 'directorName',
      'showName', 'contentLanguage', 'appName', 'episodeNumber', 'contentType',
      'isFree', 'seasonNumber', 'contentDuration', 'source',
    ],
    zenitStatus: 'not-implemented',
    zenitEquivalent: 'Share a report / test run',
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Zenit-specific events that are NOT in the CSV
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ZENIT_EXTRA_EVENTS: CatalogEvent[] = [
  {
    name: 'App_Launched',
    category: 'Zenit Specific',
    trigger: 'When the app loads / first paint',
    properties: ['platform', 'app_version', 'user_id', 'session_id', 'environment', 'referrer'],
    zenitStatus: 'schema-only',
  },
  {
    name: 'Test_Case_Executed',
    category: 'Zenit Specific',
    trigger: 'When a tester marks a case Pass / Fail / N/A / Untested / Fail (Known)',
    properties: ['contentID', 'contentTitle', 'testCaseStatus', 'suiteName', 'executedBy', 'appName'],
    zenitStatus: 'available',
  },
  {
    name: 'Test_Case_Created',
    category: 'Zenit Specific',
    trigger: 'When a new test case is authored',
    properties: ['contentID', 'contentTitle', 'testBed', 'priority', 'appName'],
    zenitStatus: 'schema-only',
  },
  {
    name: 'Test_Case_Edited',
    category: 'Zenit Specific',
    trigger: 'When an existing test case is modified',
    properties: ['contentID', 'contentTitle', 'fieldsChanged', 'appName'],
    zenitStatus: 'schema-only',
  },
  {
    name: 'Test_Case_Generated',
    category: 'Zenit Specific',
    trigger: 'When AI generates test cases from a PRD',
    properties: ['contentID', 'contentTitle', 'casesGenerated', 'model', 'appName'],
    zenitStatus: 'schema-only',
  },
  {
    name: 'Session_Started',
    category: 'Zenit Specific',
    trigger: 'When a test session / run begins',
    properties: ['sessionId', 'suiteName', 'totalCases', 'appName'],
    zenitStatus: 'schema-only',
  },
  {
    name: 'Session_Completed',
    category: 'Zenit Specific',
    trigger: 'When a test session / run finishes',
    properties: ['sessionId', 'passed', 'failed', 'untested', 'passRate', 'durationMs', 'appName'],
    zenitStatus: 'schema-only',
  },
  {
    name: 'Bug_Reported',
    category: 'Zenit Specific',
    trigger: 'When a new bug is filed',
    properties: ['contentID', 'contentTitle', 'bugSeverity', 'bugType', 'reportedBy', 'appName'],
    zenitStatus: 'available',
  },
  {
    name: 'Bug_Resolved',
    category: 'Zenit Specific',
    trigger: 'When a bug is resolved / closed',
    properties: ['contentID', 'contentTitle', 'resolutionStatus', 'resolvedBy', 'resolutionTimeHours', 'appName'],
    zenitStatus: 'schema-only',
  },
  {
    name: 'PRD_Uploaded',
    category: 'Zenit Specific',
    trigger: 'When a PRD document is imported',
    properties: ['contentID', 'contentTitle', 'fileName', 'casesExtracted', 'appName'],
    zenitStatus: 'schema-only',
  },
  {
    name: 'Export_Downloaded',
    category: 'Zenit Specific',
    trigger: 'When a CSV / XLSX export is downloaded',
    properties: ['format', 'recordCount', 'exportedBy', 'appName'],
    zenitStatus: 'available',
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Lookups
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const CATALOG_BY_NAME = new Map<string, CatalogEvent>(
  [...CLEVERTAP_CATALOG, ...ZENIT_EXTRA_EVENTS].map((e) => [normalizeName(e.name), e]),
);

export const CATALOG_NAMES = new Set(CLEVERTAP_CATALOG.map((e) => normalizeName(e.name)));

export const CATEGORIES: CatalogCategory[] = [
  'Lifecycle',
  'Discovery',
  'Playback',
  'Ads',
  'Subscription',
  'Profile & Account',
  'Library',
  'Zenit Specific',
];

/**
 * Events CleverTap generates itself (not defined in the CSV).
 * They appear in the user-activity page, so we keep them out of the
 * "unexpected custom event" bucket by flagging them as system events.
 */
export const CLEVERTAP_SYSTEM_EVENTS = new Set(
  [
    'App Launched',
    'App Installed',
    'App Uninstalled',
    'App Updated',
    'UTM Visited',
    'Identity Set',
    'Identity Copied',
    'Reachable By',
    'Channel Subscribed',
    'Channel Unsubscribed',
    'Notification Viewed',
    'Notification Clicked',
    'Notification Sent',
    'Push Impressions',
    'Web Session',
    'Geocluster Entered',
    'Geocluster Exited',
    'Profile Updated',
    'Device Registered',
  ].map(normalizeName),
);

export function isCleverTapSystemEvent(name: string): boolean {
  return CLEVERTAP_SYSTEM_EVENTS.has(normalizeName(name));
}

/** Normalise for comparison: trim, collapse spaces, case-insensitive. */
export function normalizeName(name: string): string {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Captured-input parser
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CapturedEvent {
  name: string;
  properties: string[];
  /** How many raw records rolled up into this event name. */
  count: number;
}

export type CaptureFormat =
  | 'json-array'
  | 'json-object'
  | 'ndjson'
  | 'csv'
  | 'names'
  | 'html-tooltip'
  | 'activity-html'
  | 'har'
  | 'empty';

export interface ParseOptions {
  /**
   * Event name to attach when the paste is a CleverTap tooltip HTML snippet
   * (the `<span data-t="tooltip" title="...">` block from the dashboard).
   * That format carries properties only, not the event name.
   */
  htmlEventName?: string;
}

export interface ParseResult {
  events: CapturedEvent[];
  format: CaptureFormat;
  errors: string[];
  ignoredLines: number;
}

const PROP_KEYS = ['properties', 'props', 'Properties', 'evtData', 'data', 'params', 'attributes'];
const NAME_KEYS = ['event', 'eventName', 'EventName', 'Event', 'name', 'Name', 'evtName'];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function looksLikeEventName(v: string): boolean {
  const t = v.trim();
  return t.length > 0 && t.length <= 80 && /^[A-Za-z][A-Za-z0-9 _./:-]*$/.test(t);
}

function pickName(obj: Record<string, unknown>): string | null {
  for (const k of NAME_KEYS) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function pickProperties(obj: Record<string, unknown>, name: string | null): string[] {
  for (const k of PROP_KEYS) {
    const v = obj[k];
    if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
    if (isPlainObject(v)) return Object.keys(v);
  }
  // Flat object: everything that isn't the event name is a property.
  return Object.keys(obj).filter((k) => !NAME_KEYS.includes(k) && k !== name);
}

function fromJsonValue(value: unknown, out: CapturedEvent[], errors: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) fromJsonValue(item, out, errors);
    return;
  }
  if (typeof value === 'string') {
    if (looksLikeEventName(value)) out.push({ name: value.trim(), properties: [], count: 1 });
    else errors.push(`Ignored non-event string: ${value.slice(0, 40)}`);
    return;
  }
  if (isPlainObject(value)) {
    // Wrapper like { events: [...] }
    const wrapper = value.events ?? value.Events ?? value.data;
    if (Array.isArray(wrapper)) {
      for (const item of wrapper) fromJsonValue(item, out, errors);
      return;
    }
    const name = pickName(value);
    if (name) {
      out.push({ name, properties: pickProperties(value, name), count: 1 });
      return;
    }
    // Map form: { "Event_Name": { props } | [props] | true }
    for (const [k, v] of Object.entries(value)) {
      if (!looksLikeEventName(k)) continue;
      if (Array.isArray(v)) out.push({ name: k, properties: v.map(String).map((s) => s.trim()).filter(Boolean), count: 1 });
      else if (isPlainObject(v)) out.push({ name: k, properties: pickProperties(v, k), count: 1 });
      else out.push({ name: k, properties: [], count: 1 });
    }
    return;
  }
  errors.push(`Ignored unsupported JSON value (${typeof value})`);
}

function parseLines(input: string, out: CapturedEvent[], errors: string[]): { format: CaptureFormat; ignored: number } {
  let ignored = 0;
  let sawCsv = false;

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    // `Event_Name: prop1, prop2`
    const colon = line.match(/^([A-Za-z][A-Za-z0-9 _./-]*)\s*:\s*(.*)$/);
    if (colon && looksLikeEventName(colon[1]) && !line.includes('{')) {
      const props = colon[2].split(/[,\t;|]/).map((s) => s.trim()).filter(Boolean);
      out.push({ name: colon[1].trim(), properties: props, count: 1 });
      if (props.length) sawCsv = true;
      continue;
    }

    // `Event_Name, prop1, prop2` (header rows are skipped)
    const cells = line.split(/[,\t;|]/).map((s) => s.trim());
    if (cells.length > 1) {
      sawCsv = true;
      if (/^(event\s*name|event|properties|props)$/i.test(cells[0])) {
        ignored++;
        continue;
      }
      if (looksLikeEventName(cells[0])) {
        out.push({
          name: cells[0],
          properties: cells.slice(1).filter((c) => c && !/^(yes|no|true|false)$/i.test(c)),
          count: 1,
        });
        continue;
      }
      ignored++;
      continue;
    }

    if (looksLikeEventName(line)) {
      out.push({ name: line, properties: [], count: 1 });
    } else {
      ignored++;
    }
  }

  return { format: sawCsv ? 'csv' : 'names', ignored };
}

// ── CleverTap tooltip HTML ────────────────────────────────────────────────────

const HTML_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1]?.toLowerCase() === 'x'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return HTML_ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Read an attribute value from an HTML tag string (handles "…" and '…'). */
function readAttr(tag: string, name: string): string | null {
  // `(?:^|\s)` prevents `title` from matching `data-original-title`.
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const m = re.exec(tag);
  if (!m) return null;
  return decodeHtmlEntities(m[1] ?? m[2] ?? '');
}

function looksLikeHtmlTooltip(text: string): boolean {
  return /data-t\s*=\s*["']tooltip["']/i.test(text)
    || /<span\b[^>]*data-original-title\s*=/i.test(text);
}

/**
 * Extract property names from the tooltip HTML CleverTap renders for an event.
 * Handles both `title="…"` and `data-original-title="…"` (CleverTap uses the
 * latter for the appName pill, where `title` is left empty).
 */
export function parseHtmlTooltipProperties(html: string): string[] {
  const props: string[] = [];
  const spanRe = /<span\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = spanRe.exec(html))) {
    const tag = match[0];
    if (!/data-t\s*=\s*(?:"tooltip"|'tooltip')/i.test(tag)) continue;
    const key = (readAttr(tag, 'title') || readAttr(tag, 'data-original-title') || '').trim();
    if (key && !props.includes(key)) props.push(key);
  }
  return props;
}

/** If the paste starts with a bare event name, treat it as the event label. */
function extractLeadingEventName(text: string): { name: string | null; rest: string } {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (!/[<>]/.test(line) && looksLikeEventName(line)) {
      return { name: line, rest: lines.slice(i + 1).join('\n') };
    }
    break;
  }
  return { name: null, rest: text };
}

// ── CleverTap "User activity details" page ───────────────────────────────────

/**
 * The CleverTap dashboard's user-activity page is a long HTML table where each
 * row is one recorded event: a timestamp, the event name, then the same
 * tooltip property pills. Unlike the single tooltip snippet, this format
 * carries **many events with their names** — so one paste can answer the whole
 * gap question.
 */
function looksLikeActivityHtml(text: string): boolean {
  if (!/<table\b/i.test(text)) return false;
  // Strongest signal: CleverTap tags each event table with `class="ev_37"`.
  if (/\bclass\s*=\s*["'][^"']*\bev_\d+\b/i.test(text)) return true;
  // Fallback for copied/re-rendered markup: several weighted event-name spans.
  const nameSpans = text.match(/font-weight\s*:\s*400/gi) ?? [];
  return nameSpans.length >= 2 && looksLikeHtmlTooltip(text);
}

/** Pull the event name out of one activity-table row. */
function extractActivityEventName(chunk: string): string | null {
  const weighted = /<span[^>]*font-weight\s*:\s*400[^>]*>\s*([^<]+?)\s*<\/span>/i.exec(chunk);
  if (weighted) return decodeHtmlEntities(weighted[1]).trim();

  // Fallback: first non-tooltip span before the <br> separator.
  const cell = /<td[^>]*>([\s\S]*?)<br\s*\/?>/i.exec(chunk);
  if (!cell) return null;
  const span = /<span\b(?![^>]*data-t\s*=\s*["']tooltip["'])[^>]*>\s*([^<]+?)\s*<\/span>/i.exec(cell[1]);
  return span ? decodeHtmlEntities(span[1]).trim() : null;
}

/** Parse every event row from a CleverTap "User activity details" HTML paste. */
export function parseActivityHtmlEvents(html: string): CapturedEvent[] {
  const events: CapturedEvent[] = [];
  const tableRe = /<table\b[^>]*>[\s\S]*?<\/table>/gi;
  let match: RegExpExecArray | null;

  while ((match = tableRe.exec(html))) {
    const chunk = match[0];
    if (!looksLikeHtmlTooltip(chunk)) continue;
    const name = extractActivityEventName(chunk);
    if (!name || !looksLikeEventName(name)) continue;
    events.push({
      name,
      properties: parseHtmlTooltipProperties(chunk),
      count: 1,
    });
  }

  return events;
}

/**
 * Parse whatever the analyst pastes. Accepted shapes:
 *   1. JSON array:      [{"event":"Login","properties":{...}}, ...]
 *   2. JSON object map: {"Login":{...}, "Logout":{}}
 *   3. NDJSON:          one JSON object per line
 *   4. CSV/TSV:         `Event_Name,prop1,prop2`
 *   5. Plain names:     one event name per line
 *   6. Tooltip HTML:    `<span data-t="tooltip" title="source">B2B</span>…`
 *                       (properties only — supply the event name via options
 *                        or put it on the first line)
 *   7. Activity HTML:   the CleverTap "User activity details" table
 *                       (many events, each with its name + properties)
 */
export function parseCapturedEvents(input: string, options: ParseOptions = {}): ParseResult {
  const text = (input || '').trim();
  const events: CapturedEvent[] = [];
  const errors: string[] = [];

  if (!text) {
    return { events: [], format: 'empty', errors, ignoredLines: 0 };
  }

  // 0a — CleverTap "User activity details" page (many events, with names)
  if (looksLikeActivityHtml(text)) {
    const activityEvents = parseActivityHtmlEvents(text);
    if (activityEvents.length === 0) {
      return {
        events: [],
        format: 'activity-html',
        errors: ['This looks like a CleverTap activity page, but no event rows could be read from it.'],
        ignoredLines: 0,
      };
    }
    return {
      events: rollUp(activityEvents),
      format: 'activity-html',
      errors,
      ignoredLines: 0,
    };
  }

  // 0b — CleverTap tooltip HTML (the dashboard's property pill block)
  if (looksLikeHtmlTooltip(text)) {
    const leading = extractLeadingEventName(text);
    const eventName = (options.htmlEventName || '').trim() || leading.name;
    const props = parseHtmlTooltipProperties(text);

    if (!eventName) {
      return {
        events: [],
        format: 'html-tooltip',
        errors: [
          'This is a CleverTap tooltip snippet — it contains properties but no event name. ' +
          'Type the event name (e.g. Page_View) in the box above, or put it on the first line.',
        ],
        ignoredLines: 0,
      };
    }
    if (props.length === 0) {
      return {
        events: [],
        format: 'html-tooltip',
        errors: ['HTML detected, but no data-t="tooltip" properties were found.'],
        ignoredLines: 0,
      };
    }
    return {
      events: rollUp([{ name: eventName, properties: props, count: 1 }]),
      format: 'html-tooltip',
      errors,
      ignoredLines: 0,
    };
  }

  // 1 & 2 — whole-document JSON
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      fromJsonValue(JSON.parse(text), events, errors);
      return {
        events: rollUp(events),
        format: text.startsWith('[') ? 'json-array' : 'json-object',
        errors,
        ignoredLines: 0,
      };
    } catch {
      // fall through to NDJSON
    }
  }

  // 3 — NDJSON: every non-empty line parses as JSON
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const jsonLines = lines.filter((l) => l.startsWith('{') || l.startsWith('['));
  if (jsonLines.length > 0 && jsonLines.length >= lines.length / 2) {
    let parsedCount = 0;
    for (const line of jsonLines) {
      try {
        fromJsonValue(JSON.parse(line), events, errors);
        parsedCount++;
      } catch {
        errors.push(`Bad JSON line: ${line.slice(0, 50)}`);
      }
    }
    if (parsedCount > 0) {
      return { events: rollUp(events), format: 'ndjson', errors, ignoredLines: lines.length - jsonLines.length };
    }
  }

  // 4 & 5 — line / CSV
  const lineResult = parseLines(text, events, errors);
  return {
    events: rollUp(events),
    format: lineResult.format,
    errors,
    ignoredLines: lineResult.ignored,
  };
}

/** Merge duplicate event names, unioning their property sets. */
function rollUp(events: CapturedEvent[]): CapturedEvent[] {
  const map = new Map<string, CapturedEvent>();
  for (const e of events) {
    const key = normalizeName(e.name);
    const existing = map.get(key);
    if (existing) {
      existing.count += e.count;
      existing.properties = [...new Set([...existing.properties, ...e.properties])];
    } else {
      map.set(key, { name: e.name, properties: [...new Set(e.properties)], count: e.count });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Gap analysis
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type GapStatus = 'captured' | 'missing' | 'extra';

export interface GapRow {
  name: string;
  status: GapStatus;
  category: CatalogCategory | 'Uncategorized';
  trigger: string;
  zenitStatus: ZenitStatus | 'unknown';
  zenitEquivalent?: string;
  /** True for CleverTap-generated events (App Launched, Identity Set, …). */
  isSystem?: boolean;
  expectedProps: string[];
  capturedProps: string[];
  missingProps: string[];
  extraProps: string[];
  propertyCoverage: number; // 0–100
  records: number;
}

export interface GapSummary {
  catalogTotal: number;
  capturedTotal: number;
  matched: number;
  missing: number;
  extra: number;
  /** % of expected properties found across all matched events. */
  propertyCoverage: number;
  /** Count of catalog events already wired/available in Zenit. */
  zenitCovered: number;
}

export interface GapAnalysisResult {
  rows: GapRow[];
  summary: GapSummary;
  parse: ParseResult;
}

export function analyzeGaps(parse: ParseResult): GapAnalysisResult {
  const capturedByName = new Map(parse.events.map((e) => [normalizeName(e.name), e]));
  const rows: GapRow[] = [];

  // Catalog events: captured or missing
  for (const ev of CLEVERTAP_CATALOG) {
    const key = normalizeName(ev.name);
    const captured = capturedByName.get(key);
    const capturedProps = captured?.properties ?? [];
    const capturedNorm = new Set(capturedProps.map(normalizeName));
    const missingProps = ev.properties.filter((p) => !capturedNorm.has(normalizeName(p)));
    const expectedNorm = new Set(ev.properties.map(normalizeName));
    const extraProps = capturedProps.filter((p) => !expectedNorm.has(normalizeName(p)));
    const found = ev.properties.length === 0
      ? (captured ? 100 : 0)
      : Math.round(((ev.properties.length - missingProps.length) / ev.properties.length) * 100);

    rows.push({
      name: ev.name,
      status: captured ? 'captured' : 'missing',
      category: ev.category,
      trigger: ev.trigger,
      zenitStatus: ev.zenitStatus,
      zenitEquivalent: ev.zenitEquivalent,
      expectedProps: ev.properties,
      capturedProps,
      missingProps,
      extraProps,
      propertyCoverage: captured ? found : 0,
      records: captured?.count ?? 0,
    });
  }

  // Captured events that aren't in the CSV → extra
  for (const ev of parse.events) {
    if (CATALOG_NAMES.has(normalizeName(ev.name))) continue;
    const known = CATALOG_BY_NAME.get(normalizeName(ev.name));
    rows.push({
      name: ev.name,
      status: 'extra',
      category: known?.category ?? 'Uncategorized',
      trigger: known?.trigger ?? 'Captured event not present in the CleverTap CSV',
      zenitStatus: known?.zenitStatus ?? 'unknown',
      zenitEquivalent: known?.zenitEquivalent,
      isSystem: isCleverTapSystemEvent(ev.name),
      expectedProps: known?.properties ?? [],
      capturedProps: ev.properties,
      missingProps: [],
      extraProps: known
        ? ev.properties.filter((p) => !known.properties.map(normalizeName).includes(normalizeName(p)))
        : ev.properties,
      propertyCoverage: 100,
      records: ev.count,
    });
  }

  const matched = rows.filter((r) => r.status === 'captured');
  const expectedPropTotal = matched.reduce((sum, r) => sum + r.expectedProps.length, 0);
  const foundPropTotal = matched.reduce(
    (sum, r) => sum + (r.expectedProps.length - r.missingProps.length),
    0,
  );

  const summary: GapSummary = {
    catalogTotal: CLEVERTAP_CATALOG.length,
    capturedTotal: parse.events.length,
    matched: matched.length,
    missing: rows.filter((r) => r.status === 'missing').length,
    extra: rows.filter((r) => r.status === 'extra').length,
    propertyCoverage: expectedPropTotal === 0 ? 0 : Math.round((foundPropTotal / expectedPropTotal) * 100),
    zenitCovered: CLEVERTAP_CATALOG.filter((e) => e.zenitStatus === 'wired' || e.zenitStatus === 'available').length,
  };

  return { rows, summary, parse };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Export helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function csvCell(v: string | number): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV report of the gap analysis — opens cleanly in Excel / Sheets. */
export function buildGapCsv(result: GapAnalysisResult): string {
  const header = [
    'Event Name', 'Status', 'Category', 'Zenit Status', 'Records Captured',
    'Property Coverage %', 'Expected Properties', 'Captured Properties',
    'Missing Properties', 'Extra Properties', 'Trigger',
  ];
  const lines = [header.join(',')];
  for (const r of result.rows) {
    lines.push([
      r.name, r.status, r.category, r.zenitStatus, r.records, r.propertyCoverage,
      r.expectedProps.join('|'), r.capturedProps.join('|'),
      r.missingProps.join('|'), r.extraProps.join('|'), r.trigger,
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV of the full catalog (for sharing / auditing). */
export function buildCatalogCsv(): string {
  const header = ['Event Name', 'Category', 'Zenit Status', 'Property Count', 'Properties', 'Trigger'];
  const lines = [header.join(',')];
  for (const e of [...CLEVERTAP_CATALOG, ...ZENIT_EXTRA_EVENTS]) {
    lines.push([
      e.name, e.category, e.zenitStatus, e.properties.length, e.properties.join('|'), e.trigger,
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** A small realistic sample so the UI can demo itself without real data. */
export const SAMPLE_CAPTURE = JSON.stringify(
  [
    { event: 'Page_View', properties: { previousPage: '/dashboard', currentPage: '/session/42', source: 'D2C', appName: 'Zenit Tracker' } },
    { event: 'Login', properties: { source: 'D2C', isNewUser: false, loginStatus: 'success' } },
    { event: 'Searched', properties: { searchString: 'login flow', isFound: true } },
    { event: 'Content_Clicked', properties: { source: 'D2C', contentTitle: 'Login validation', contentID: 'case-42' } },
    { event: 'Test_Case_Executed', properties: { contentID: 'case-42', contentTitle: 'Login validation', testCaseStatus: 'Pass' } },
    { event: 'Media_Error', properties: { errorMessage: 'HLS 404', source: 'D2C' } },
  ],
  null,
  2,
);
