/**
 * Analytics Tracker - Captures and manages analytics events
 * Provides batching, offline queue, and event aggregation
 */

import { FirebaseConnector } from './firebase-connector';
import {
  AnalyticsEvent,
  AnalyticsDomain,
  AggregatedEvents,
  TimeRange,
} from '@/types/bug-analytics';
import { Timestamp } from 'firebase/firestore';

export interface AnalyticsTrackerConfig {
  batchSize: number;
  flushInterval: number; // milliseconds
  maxQueueSize: number;
}

export class AnalyticsTracker {
  private config: AnalyticsTrackerConfig;
  private connector: FirebaseConnector;
  private eventQueue: AnalyticsEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private sessionId: string;

  constructor(connector: FirebaseConnector, config: AnalyticsTrackerConfig) {
    this.connector = connector;
    this.config = config;
    this.sessionId = this.generateSessionId();
    
    // Start automatic flush timer
    this.startFlushTimer();
  }

  /**
   * Track an analytics event
   */
  async trackEvent(
    eventType: string,
    domain: AnalyticsDomain,
    metadata?: Record<string, any>,
    userId?: string
  ): Promise<void> {
    const event: AnalyticsEvent = {
      id: this.generateEventId(),
      timestamp: Timestamp.now(),
      eventType,
      domain,
      userId: userId || 'anonymous',
      metadata: metadata || {},
      sessionId: this.sessionId,
    };

    // Add to queue
    this.eventQueue.push(event);

    // Check if we need to flush based on batch size
    if (this.eventQueue.length >= this.config.batchSize) {
      await this.flush();
    }

    // Check max queue size
    if (this.eventQueue.length > this.config.maxQueueSize) {
      console.warn('Analytics queue exceeded max size, dropping oldest events');
      this.eventQueue = this.eventQueue.slice(-this.config.maxQueueSize);
    }
  }

  /**
   * Flush queued events to Firestore
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Use batch write for efficiency
      const operations = eventsToFlush.map(event => ({
        type: 'create' as const,
        collection: 'analytics_events',
        docId: event.id,
        data: event,
      }));

      await this.connector.batchWrite(operations);
    } catch (error) {
      console.error('Failed to flush analytics events:', error);
      // Re-queue events on failure
      this.eventQueue.unshift(...eventsToFlush);
    }
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.eventQueue.length;
  }

  /**
   * Clear the event queue
   */
  clearQueue(): void {
    this.eventQueue = [];
  }

  /**
   * Aggregate events by a grouping key within a time range
   */
  async aggregateEvents(
    timeRange: TimeRange,
    groupBy: string
  ): Promise<AggregatedEvents[]> {
    try {
      // Query events within time range
      const events = await this.connector.query<AnalyticsEvent>('analytics_events', {
        where: [
          {
            field: 'timestamp',
            operator: '>=',
            value: Timestamp.fromDate(timeRange.start),
          },
          {
            field: 'timestamp',
            operator: '<=',
            value: Timestamp.fromDate(timeRange.end),
          },
        ],
        orderBy: { field: 'timestamp', direction: 'desc' },
      });

      // Group events by the specified key
      const grouped = new Map<string, AnalyticsEvent[]>();

      for (const event of events) {
        let groupKey: string;

        // Determine group key based on groupBy parameter
        if (groupBy === 'eventType') {
          groupKey = event.eventType;
        } else if (groupBy === 'domain') {
          groupKey = event.domain;
        } else if (groupBy === 'userId') {
          groupKey = event.userId;
        } else if (groupBy.startsWith('metadata.')) {
          const metadataKey = groupBy.substring(9);
          groupKey = event.metadata[metadataKey]?.toString() || 'unknown';
        } else {
          groupKey = 'all';
        }

        if (!grouped.has(groupKey)) {
          grouped.set(groupKey, []);
        }
        grouped.get(groupKey)!.push(event);
      }

      // Convert to AggregatedEvents array
      return Array.from(grouped.entries()).map(([groupKey, events]) => ({
        groupKey,
        count: events.length,
        events,
        timeRange,
      }));
    } catch (error) {
      console.error('Failed to aggregate events:', error);
      throw error;
    }
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        console.error('Auto-flush failed:', error);
      });
    }, this.config.flushInterval);
  }

  /**
   * Stop automatic flush timer
   */
  stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate a session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopFlushTimer();
    this.clearQueue();
  }
}
