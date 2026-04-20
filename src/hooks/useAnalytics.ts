/**
 * useAnalytics Hook - React hook for analytics event tracking
 * Validates: Requirements 2.1, 2.6
 */

import { useState, useCallback, useEffect } from 'react';
import { AnalyticsTracker } from '@/lib/analytics-tracker';
import { FirebaseConnector } from '@/lib/firebase-connector';
import { db } from '@/lib/firebaseConfig';
import { AnalyticsEvent, AnalyticsDomain } from '@/types/bug-analytics';

interface UseAnalyticsOptions {
  autoFlush?: boolean;
  flushInterval?: number;
}

interface UseAnalyticsReturn {
  trackEvent: (
    eventType: string,
    domain: AnalyticsDomain,
    metadata?: Record<string, any>
  ) => Promise<void>;
  getEvents: (query?: {
    domain?: AnalyticsDomain;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }) => Promise<AnalyticsEvent[]>;
  aggregateEvents: (
    timeWindow: 'hour' | 'day' | 'week' | 'month',
    groupBy: 'eventType' | 'domain' | 'userId'
  ) => Promise<Record<string, number>>;
  loading: boolean;
  error: Error | null;
}

export function useAnalytics(options: UseAnalyticsOptions = {}): UseAnalyticsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tracker, setTracker] = useState<AnalyticsTracker | null>(null);

  // Initialize tracker
  useEffect(() => {
    const connector = new FirebaseConnector(db);
    const analyticsTracker = new AnalyticsTracker(connector, {
      batchSize: 10,
      flushInterval: options.flushInterval || 30000,
      maxQueueSize: 100,
    });
    setTracker(analyticsTracker);

    // Auto-flush on unmount
    return () => {
      if (options.autoFlush !== false) {
        analyticsTracker.flush().catch(console.error);
      }
    };
  }, [options.autoFlush, options.flushInterval]);

  const trackEvent = useCallback(
    async (
      eventType: string,
      domain: AnalyticsDomain,
      metadata?: Record<string, any>
    ) => {
      if (!tracker) {
        setError(new Error('Analytics tracker not initialized'));
        return;
      }

      setLoading(true);
      setError(null);

      try {
        await tracker.trackEvent(eventType, domain, metadata);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to track event');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [tracker]
  );

  const getEvents = useCallback(
    async (query?: {
      domain?: AnalyticsDomain;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    }) => {
      if (!tracker) {
        throw new Error('Analytics tracker not initialized');
      }

      setLoading(true);
      setError(null);

      try {
        const connector = new FirebaseConnector(db);
        const whereConditions: any[] = [];

        if (query?.domain) {
          whereConditions.push({
            field: 'domain',
            operator: '==',
            value: query.domain,
          });
        }

        if (query?.userId) {
          whereConditions.push({
            field: 'userId',
            operator: '==',
            value: query.userId,
          });
        }

        const events = await connector.query<AnalyticsEvent>('analytics_events', {
          where: whereConditions,
          orderBy: { field: 'timestamp', direction: 'desc' },
        });

        // Filter by date range if provided
        let filteredEvents = events;
        if (query?.startDate || query?.endDate) {
          filteredEvents = events.filter(event => {
            const eventDate = event.timestamp.toDate();
            if (query.startDate && eventDate < query.startDate) return false;
            if (query.endDate && eventDate > query.endDate) return false;
            return true;
          });
        }

        return filteredEvents;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to get events');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [tracker]
  );

  const aggregateEvents = useCallback(
    async (
      timeWindow: 'hour' | 'day' | 'week' | 'month',
      groupBy: 'eventType' | 'domain' | 'userId'
    ) => {
      if (!tracker) {
        throw new Error('Analytics tracker not initialized');
      }

      setLoading(true);
      setError(null);

      try {
        const now = new Date();
        const start = new Date(now);
        if (timeWindow === 'hour') start.setHours(now.getHours() - 1);
        else if (timeWindow === 'day') start.setDate(now.getDate() - 1);
        else if (timeWindow === 'week') start.setDate(now.getDate() - 7);
        else start.setMonth(now.getMonth() - 1);
        return await tracker.aggregateEvents({ start, end: now }, groupBy);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to aggregate events');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [tracker]
  );

  return {
    trackEvent,
    getEvents,
    aggregateEvents,
    loading,
    error,
  };
}
