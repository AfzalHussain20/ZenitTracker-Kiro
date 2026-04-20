/**
 * Property-Based Tests for Analytics Tracker
 * Feature: bug-analytics-categorization-system
 */

import fc from 'fast-check';
import { AnalyticsTracker } from '../analytics-tracker';
import { FirebaseConnector } from '../firebase-connector';
import { AnalyticsEvent, AnalyticsDomain } from '@/types/bug-analytics';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase Connector
const mockDb = {} as any;

describe('AnalyticsTracker - Property-Based Tests', () => {
  let connector: FirebaseConnector;
  let tracker: AnalyticsTracker;

  beforeEach(() => {
    connector = new FirebaseConnector(mockDb);
    tracker = new AnalyticsTracker(connector, {
      batchSize: 10,
      flushInterval: 5000,
      maxQueueSize: 100,
    });
  });

  afterEach(() => {
    tracker.destroy();
  });

  /**
   * Property 5: Analytics Event Structure
   * Validates: Requirements 2.1
   * 
   * Property: Every tracked event should have all required fields
   * (id, timestamp, eventType, domain, userId, metadata, sessionId).
   */
  test('Property 5: Analytics Event Structure - all events should have required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom<AnalyticsDomain>('user_action', 'system_event', 'performance_metric', 'error_event'),
        fc.dictionary(fc.string(), fc.anything()),
        fc.string({ minLength: 1, maxLength: 20 }),
        async (eventType, domain, metadata, userId) => {
          // Mock batchWrite to capture events
          const capturedEvents: any[] = [];
          jest.spyOn(connector, 'batchWrite').mockImplementation(async (operations) => {
            operations.forEach(op => {
              if (op.type === 'create') {
                capturedEvents.push(op.data);
              }
            });
          });

          await tracker.trackEvent(eventType, domain, metadata, userId);
          await tracker.flush();

          // Property: Event should have all required fields
          expect(capturedEvents.length).toBe(1);
          const event = capturedEvents[0];
          
          expect(event).toHaveProperty('id');
          expect(event).toHaveProperty('timestamp');
          expect(event).toHaveProperty('eventType');
          expect(event).toHaveProperty('domain');
          expect(event).toHaveProperty('userId');
          expect(event).toHaveProperty('metadata');
          expect(event).toHaveProperty('sessionId');
          
          expect(event.eventType).toBe(eventType);
          expect(event.domain).toBe(domain);
          expect(event.userId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Analytics Event Domain Categorization
   * Validates: Requirements 2.2
   * 
   * Property: Every event must be categorized into one of the valid domains.
   */
  test('Property 6: Event Domain Categorization - events must have valid domain', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom<AnalyticsDomain>('user_action', 'system_event', 'performance_metric', 'error_event'),
        async (eventType, domain) => {
          const capturedEvents: any[] = [];
          jest.spyOn(connector, 'batchWrite').mockImplementation(async (operations) => {
            operations.forEach(op => {
              if (op.type === 'create') {
                capturedEvents.push(op.data);
              }
            });
          });

          await tracker.trackEvent(eventType, domain);
          await tracker.flush();

          // Property: Domain must be one of the valid values
          const validDomains: AnalyticsDomain[] = ['user_action', 'system_event', 'performance_metric', 'error_event'];
          expect(validDomains).toContain(capturedEvents[0].domain);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Custom Event Metadata Preservation
   * Validates: Requirements 2.4
   * 
   * Property: Custom metadata attached to events should be preserved exactly.
   */
  test('Property 7: Metadata Preservation - custom metadata should be preserved', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s !== 'constructor'),
          fc.oneof(fc.string(), fc.integer(), fc.boolean())
        ),
        async (metadata) => {
          const capturedEvents: any[] = [];
          jest.spyOn(connector, 'batchWrite').mockImplementation(async (operations) => {
            operations.forEach(op => {
              if (op.type === 'create') {
                capturedEvents.push(op.data);
              }
            });
          });

          await tracker.trackEvent('test-event', 'user_action', metadata);
          await tracker.flush();

          // Property: Metadata should be preserved exactly
          expect(capturedEvents[0].metadata).toEqual(metadata);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: Event Aggregation Accuracy
   * Validates: Requirements 2.6
   * 
   * Property: When aggregating events, the sum of counts across all groups
   * should equal the total number of events.
   */
  test('Property 8: Aggregation Accuracy - aggregated counts should match total events', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            eventType: fc.constantFrom('click', 'view', 'submit', 'error'),
            domain: fc.constantFrom<AnalyticsDomain>('user_action', 'system_event'),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (events) => {
          // Mock query to return the events
          const mockEvents: AnalyticsEvent[] = events.map((e, idx) => ({
            id: `evt-${idx}`,
            timestamp: Timestamp.now(),
            eventType: e.eventType,
            domain: e.domain,
            userId: 'test-user',
            metadata: {},
            sessionId: 'test-session',
          }));

          jest.spyOn(connector, 'query').mockResolvedValue(mockEvents);

          const timeRange = {
            start: new Date(Date.now() - 86400000),
            end: new Date(),
          };

          const aggregated = await tracker.aggregateEvents(timeRange, 'eventType');

          // Property: Sum of all group counts should equal total events
          const totalCount = aggregated.reduce((sum, group) => sum + group.count, 0);
          expect(totalCount).toBe(mockEvents.length);

          // Property: Each event should appear in exactly one group
          const allGroupedEvents = aggregated.flatMap(group => group.events);
          expect(allGroupedEvents.length).toBe(mockEvents.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
