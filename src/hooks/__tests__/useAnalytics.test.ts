/**
 * Unit tests for useAnalytics hook
 * Validates: Requirements 2.1
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAnalytics } from '../useAnalytics';
import { AnalyticsTracker } from '@/lib/analytics-tracker';
import { FirebaseConnector } from '@/lib/firebase-connector';
import { AggregatedEvents } from '@/types/bug-analytics';

// Mock dependencies
jest.mock('@/lib/analytics-tracker');
jest.mock('@/lib/firebase-connector');

describe('useAnalytics', () => {
  let mockTracker: jest.Mocked<AnalyticsTracker>;
  let mockConnector: jest.Mocked<FirebaseConnector>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConnector = new FirebaseConnector({} as any) as jest.Mocked<FirebaseConnector>;
    mockTracker = new AnalyticsTracker(mockConnector, {} as any) as jest.Mocked<AnalyticsTracker>;

    // The hook flushes on unmount by default; auto-mocked flush would return
    // undefined and crash the effect cleanup with `undefined.catch(...)`.
    mockTracker.flush = jest.fn().mockResolvedValue(undefined);

    (AnalyticsTracker as jest.Mock).mockImplementation(() => mockTracker);
    (FirebaseConnector as jest.Mock).mockImplementation(() => mockConnector);
  });

  it('should initialize tracker on mount', () => {
    renderHook(() => useAnalytics());

    expect(AnalyticsTracker).toHaveBeenCalledWith(
      expect.any(FirebaseConnector),
      expect.objectContaining({
        batchSize: 10,
        flushInterval: 30000,
      })
    );
  });

  it('should track event successfully', async () => {
    mockTracker.trackEvent = jest.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useAnalytics());

    await act(async () => {
      await result.current.trackEvent('button_click', 'user_action', { buttonId: 'submit' });
    });

    await waitFor(() => {
      expect(mockTracker.trackEvent).toHaveBeenCalledWith(
        'button_click',
        'user_action',
        { buttonId: 'submit' }
      );
    });
  });

  it('should handle tracking errors', async () => {
    const error = new Error('Tracking failed');
    mockTracker.trackEvent = jest.fn().mockRejectedValue(error);

    const { result } = renderHook(() => useAnalytics());

    await act(async () => {
      try {
        await result.current.trackEvent('button_click', 'user_action');
      } catch (err) {
        expect(err).toBe(error);
      }
    });

    expect(result.current.error).toBe(error);
  });

  it('should aggregate events', async () => {
    const mockAggregation: AggregatedEvents[] = [
      { groupKey: 'button_click', count: 10, events: [], timeRange: { start: new Date(), end: new Date() } },
      { groupKey: 'page_view', count: 5, events: [], timeRange: { start: new Date(), end: new Date() } },
    ];
    mockTracker.aggregateEvents = jest.fn().mockResolvedValue(mockAggregation);

    const { result } = renderHook(() => useAnalytics());

    let aggregation: AggregatedEvents[] = [];
    await act(async () => {
      aggregation = await result.current.aggregateEvents('day', 'eventType');
    });

    expect(aggregation).toEqual(mockAggregation);
    expect(mockTracker.aggregateEvents).toHaveBeenCalledWith(
      {
        start: expect.any(Date),
        end: expect.any(Date),
      },
      'eventType'
    );
  });

  it('should flush on unmount when autoFlush is enabled', () => {
    mockTracker.flush = jest.fn().mockResolvedValue(undefined);

    const { unmount } = renderHook(() => useAnalytics({ autoFlush: true }));

    unmount();

    expect(mockTracker.flush).toHaveBeenCalled();
  });

  it('should not flush on unmount when autoFlush is disabled', () => {
    mockTracker.flush = jest.fn().mockResolvedValue(undefined);

    const { unmount } = renderHook(() => useAnalytics({ autoFlush: false }));

    unmount();

    expect(mockTracker.flush).not.toHaveBeenCalled();
  });
});
