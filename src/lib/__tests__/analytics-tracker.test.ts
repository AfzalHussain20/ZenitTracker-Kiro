/**
 * Unit Tests for Analytics Tracker
 * Feature: bug-analytics-categorization-system
 */

import { AnalyticsTracker } from '../analytics-tracker';
import { FirebaseConnector } from '../firebase-connector';

// Mock Firebase Connector
const mockDb = {} as any;

describe('AnalyticsTracker - Unit Tests', () => {
  let connector: FirebaseConnector;
  let tracker: AnalyticsTracker;

  beforeEach(() => {
    connector = new FirebaseConnector(mockDb);
    tracker = new AnalyticsTracker(connector, {
      batchSize: 5,
      flushInterval: 1000,
      maxQueueSize: 20,
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    tracker.destroy();
  });

  describe('Event Batching', () => {
    /**
     * Test: Batch flushing when batchSize is reached
     * Requirements: 2.3
     */
    test('should flush events when batch size is reached', async () => {
      const batchWriteSpy = jest.spyOn(connector, 'batchWrite').mockResolvedValue();

      // Track 5 events (batch size)
      for (let i = 0; i < 5; i++) {
        await tracker.trackEvent(`event-${i}`, 'user_action');
      }

      // Should have flushed automatically
      expect(batchWriteSpy).toHaveBeenCalled();
      expect(tracker.getQueueSize()).toBe(0);
    });

    test('should not flush events before batch size is reached', async () => {
      const batchWriteSpy = jest.spyOn(connector, 'batchWrite').mockResolvedValue();

      // Track 3 events (less than batch size of 5)
      for (let i = 0; i < 3; i++) {
        await tracker.trackEvent(`event-${i}`, 'user_action');
      }

      // Should not have flushed yet
      expect(batchWriteSpy).not.toHaveBeenCalled();
      expect(tracker.getQueueSize()).toBe(3);
    });
  });

  describe('Automatic Flush', () => {
    /**
     * Test: Automatic flush on flushInterval
     * Requirements: 2.3
     */
    test('should automatically flush events after interval', async () => {
      const batchWriteSpy = jest.spyOn(connector, 'batchWrite').mockResolvedValue();

      // Track 2 events (less than batch size)
      await tracker.trackEvent('event-1', 'user_action');
      await tracker.trackEvent('event-2', 'user_action');

      expect(tracker.getQueueSize()).toBe(2);

      // Wait for flush interval (1000ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Should have flushed automatically
      expect(batchWriteSpy).toHaveBeenCalled();
      expect(tracker.getQueueSize()).toBe(0);
    });
  });

  describe('Offline Queue Behavior', () => {
    /**
     * Test: Offline queue behavior
     * Requirements: 2.5
     */
    test('should re-queue events on flush failure', async () => {
      const batchWriteSpy = jest.spyOn(connector, 'batchWrite')
        .mockRejectedValue(new Error('Network error'));

      // Track events
      await tracker.trackEvent('event-1', 'user_action');
      await tracker.trackEvent('event-2', 'user_action');

      const queueSizeBefore = tracker.getQueueSize();
      
      // Attempt to flush
      await tracker.flush();

      // Events should be re-queued on failure
      expect(tracker.getQueueSize()).toBe(queueSizeBefore);
    });

    test('should enforce max queue size', async () => {
      jest.spyOn(connector, 'batchWrite').mockResolvedValue();

      // Track more events than max queue size (20)
      for (let i = 0; i < 25; i++) {
        await tracker.trackEvent(`event-${i}`, 'user_action', {}, 'user-1');
      }

      // Queue should be capped at max size
      expect(tracker.getQueueSize()).toBeLessThanOrEqual(20);
    });
  });

  describe('Event Aggregation', () => {
    test('should aggregate events by eventType', async () => {
      const mockEvents = [
        {
          id: 'evt-1',
          timestamp: { seconds: Date.now() / 1000, nanoseconds: 0 },
          eventType: 'click',
          domain: 'user_action' as const,
          userId: 'user-1',
          metadata: {},
          sessionId: 'session-1',
        },
        {
          id: 'evt-2',
          timestamp: { seconds: Date.now() / 1000, nanoseconds: 0 },
          eventType: 'click',
          domain: 'user_action' as const,
          userId: 'user-2',
          metadata: {},
          sessionId: 'session-2',
        },
        {
          id: 'evt-3',
          timestamp: { seconds: Date.now() / 1000, nanoseconds: 0 },
          eventType: 'view',
          domain: 'user_action' as const,
          userId: 'user-1',
          metadata: {},
          sessionId: 'session-1',
        },
      ];

      jest.spyOn(connector, 'query').mockResolvedValue(mockEvents);

      const timeRange = {
        start: new Date(Date.now() - 86400000),
        end: new Date(),
      };

      const aggregated = await tracker.aggregateEvents(timeRange, 'eventType');

      expect(aggregated).toHaveLength(2); // 'click' and 'view'
      
      const clickGroup = aggregated.find(g => g.groupKey === 'click');
      const viewGroup = aggregated.find(g => g.groupKey === 'view');
      
      expect(clickGroup?.count).toBe(2);
      expect(viewGroup?.count).toBe(1);
    });

    test('should aggregate events by domain', async () => {
      const mockEvents = [
        {
          id: 'evt-1',
          timestamp: { seconds: Date.now() / 1000, nanoseconds: 0 },
          eventType: 'click',
          domain: 'user_action' as const,
          userId: 'user-1',
          metadata: {},
          sessionId: 'session-1',
        },
        {
          id: 'evt-2',
          timestamp: { seconds: Date.now() / 1000, nanoseconds: 0 },
          eventType: 'error',
          domain: 'error_event' as const,
          userId: 'user-1',
          metadata: {},
          sessionId: 'session-1',
        },
      ];

      jest.spyOn(connector, 'query').mockResolvedValue(mockEvents);

      const timeRange = {
        start: new Date(Date.now() - 86400000),
        end: new Date(),
      };

      const aggregated = await tracker.aggregateEvents(timeRange, 'domain');

      expect(aggregated).toHaveLength(2);
      
      const userActionGroup = aggregated.find(g => g.groupKey === 'user_action');
      const errorGroup = aggregated.find(g => g.groupKey === 'error_event');
      
      expect(userActionGroup?.count).toBe(1);
      expect(errorGroup?.count).toBe(1);
    });
  });

  describe('Queue Management', () => {
    test('should clear queue', async () => {
      await tracker.trackEvent('event-1', 'user_action');
      await tracker.trackEvent('event-2', 'user_action');

      expect(tracker.getQueueSize()).toBe(2);

      tracker.clearQueue();

      expect(tracker.getQueueSize()).toBe(0);
    });

    test('should get queue size', async () => {
      expect(tracker.getQueueSize()).toBe(0);

      await tracker.trackEvent('event-1', 'user_action');
      expect(tracker.getQueueSize()).toBe(1);

      await tracker.trackEvent('event-2', 'user_action');
      expect(tracker.getQueueSize()).toBe(2);
    });
  });
});
