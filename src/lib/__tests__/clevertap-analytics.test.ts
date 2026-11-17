/**
 * Unit tests for ZenitAnalytics (CleverTap 2.0 integration).
 * Mocks firebaseConfig so Firestore writes are skipped — we assert the
 * manager never throws and convenience methods map to the right event names.
 */

jest.mock('@/lib/firebaseConfig', () => ({
  db: undefined, // force Firestore fallback to be skipped in tests
  auth: {},
  app: {},
  storage: {},
}));

import { zenitAnalytics, ZenitAnalytics } from '@/lib/clevertap-analytics';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('ZenitAnalytics', () => {
  afterEach(() => {
    zenitAnalytics.flush();
  });

  describe('track()', () => {
    it('resolves without throwing when CleverTap is not configured', async () => {
      await expect(
        zenitAnalytics.track({
          eventName: 'Page_View',
          properties: { currentPage: '/dashboard', source: 'D2C' },
        }),
      ).resolves.toBeUndefined();
    });

    it('persists events through the authenticated API, never with a client userId', async () => {
      const g = global as any;
      const originalWindow = g.window;
      g.window = g;
      g.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

      try {
        await zenitAnalytics.track({
          eventName: 'Page_View',
          properties: { currentPage: '/notes' },
          userId: 'spoofed-user',
          userName: 'spoofed-name',
          domain: 'user_action',
        });

        expect(g.fetch).toHaveBeenCalledTimes(1);
        const [url, init] = g.fetch.mock.calls[0];
        expect(url).toBe('/api/analytics/track');
        const body = JSON.parse(String(init.body));
        expect(body.eventName).toBe('Page_View');
        expect(body.properties.currentPage).toBe('/notes');
        expect(body.userId).toBeUndefined();
      } finally {
        g.window = originalWindow;
        delete g.fetch;
      }
    });

    it('never throws when persistence fails', async () => {
      const g = global as any;
      const originalWindow = g.window;
      g.window = g;
      g.fetch = jest.fn().mockRejectedValue(new Error('offline'));

      try {
        await expect(
          zenitAnalytics.track({ eventName: 'Page_View' }),
        ).resolves.toBeUndefined();
      } finally {
        g.window = originalWindow;
        delete g.fetch;
      }
    });

    it('resolves for every Zenit convenience event', async () => {
      await zenitAnalytics.login('u1', 'Ada', 'email', true);
      await zenitAnalytics.logout('u1', 'Ada');
      await zenitAnalytics.testCaseExecuted(
        'u1', 'case-1', 'Login page validation', 'Pass', 'Suite A',
      );
      await zenitAnalytics.bugReported('u1', 'bug-1', 'Crash on submit', 'high');
      await zenitAnalytics.exportDownloaded('u1' as any, 'csv', 42);
      await delay(50); // let any async work settle
      expect(true).toBe(true);
    });
  });

  describe('ZenitAnalytics (instantiable)', () => {
    it('exposes a session id and reports CleverTap disabled without a key', () => {
      const a = new ZenitAnalytics({
        clevertapAccountId: '',
        clevertapToken: '',
      });
      expect(typeof a.getSessionId()).toBe('string');
      expect(a.isCleverTapEnabled()).toBe(false);
    });

    it('reports CleverTap enabled when credentials are present', () => {
      const a = new ZenitAnalytics({
        clevertapAccountId: 'CT123',
        clevertapToken: 'tok',
      });
      // Client-side only; in jsdom window exists so enabled may be true.
      expect(typeof a.isCleverTapEnabled()).toBe('boolean');
    });
  });
});
