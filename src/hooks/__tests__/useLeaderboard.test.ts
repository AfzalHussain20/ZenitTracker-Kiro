/**
 * Unit tests for useLeaderboard hook
 * Validates: Requirements 3.1
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useLeaderboard } from '../useLeaderboard';
import { LeaderboardService } from '@/lib/leaderboard-service';
import { LeaderboardEntry, LeaderboardQuery } from '@/types/bug-analytics';

// Mock dependencies
jest.mock('@/lib/leaderboard-service');
jest.mock('@/lib/firebase-connector');
jest.mock('@/lib/cache-layer');

describe('useLeaderboard', () => {
  let mockService: jest.Mocked<LeaderboardService>;

  const currentMonthQuery: LeaderboardQuery = { timePeriod: 'current_month' };

  const mockLeaderboard: LeaderboardEntry[] = [
    {
      userId: 'user1',
      userName: 'John Doe',
      bugCount: 10,
      severityDistribution: { critical: 2, high: 3, medium: 3, low: 2, trivial: 0 },
      qualityScore: 85,
      rank: 1,
    },
    {
      userId: 'user2',
      userName: 'Jane Smith',
      bugCount: 8,
      severityDistribution: { critical: 1, high: 2, medium: 3, low: 2, trivial: 0 },
      qualityScore: 80,
      rank: 2,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = {
      calculateLeaderboard: jest.fn().mockResolvedValue(mockLeaderboard),
    } as any;

    (LeaderboardService as jest.Mock).mockImplementation(() => mockService);
  });

  it('should fetch leaderboard on mount using the initial query', async () => {
    const { result } = renderHook(() => useLeaderboard(currentMonthQuery));

    await waitFor(() => {
      expect(result.current.leaderboard).toEqual(mockLeaderboard);
    });

    expect(mockService.calculateLeaderboard).toHaveBeenCalledWith(currentMonthQuery);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should get user rank', async () => {
    const { result } = renderHook(() => useLeaderboard(currentMonthQuery));

    await waitFor(() => {
      expect(result.current.leaderboard).toEqual(mockLeaderboard);
    });

    expect(result.current.getUserRank('user1')).toBe(1);
  });

  it('should return null for non-existent user', async () => {
    const { result } = renderHook(() => useLeaderboard(currentMonthQuery));

    await waitFor(() => {
      expect(result.current.leaderboard).toEqual(mockLeaderboard);
    });

    expect(result.current.getUserRank('nonexistent')).toBeNull();
  });

  it('should refetch leaderboard with a new query', async () => {
    const { result } = renderHook(() => useLeaderboard(currentMonthQuery));

    await waitFor(() => {
      expect(result.current.leaderboard).toEqual(mockLeaderboard);
    });

    await act(async () => {
      await result.current.refetch({ timePeriod: 'previous_month' });
    });

    expect(mockService.calculateLeaderboard).toHaveBeenCalledTimes(2);
    expect(mockService.calculateLeaderboard).toHaveBeenLastCalledWith({
      timePeriod: 'previous_month',
    });
  });

  it('should capture errors from the service', async () => {
    const failure = new Error('leaderboard failed');
    mockService.calculateLeaderboard.mockRejectedValueOnce(failure);

    const { result } = renderHook(() => useLeaderboard(currentMonthQuery));

    await waitFor(() => {
      expect(result.current.error).toBe(failure);
    });

    expect(result.current.leaderboard).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
