/**
 * Unit tests for useLeaderboard hook
 * Validates: Requirements 3.1
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useLeaderboard } from '../useLeaderboard';
import { LeaderboardService } from '@/lib/leaderboard-service';
import { LeaderboardEntry } from '@/types/bug-analytics';

// Mock dependencies
jest.mock('@/lib/leaderboard-service');
jest.mock('@/lib/firebase-connector');
jest.mock('@/lib/cache-layer');

describe('useLeaderboard', () => {
  let mockService: jest.Mocked<LeaderboardService>;

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

  it('should fetch leaderboard on mount', async () => {
    const { result } = renderHook(() => useLeaderboard());

    await waitFor(() => {
      expect(result.current.leaderboard).toEqual(mockLeaderboard);
    });

    expect(mockService.calculateLeaderboard).toHaveBeenCalledWith('current_month');
  });

  it('should get user rank', async () => {
    const { result } = renderHook(() => useLeaderboard());

    await waitFor(() => {
      expect(result.current.leaderboard).toEqual(mockLeaderboard);
    });

    const rank = result.current.getUserRank('user1');
    expect(rank).toBe(1);
  });

  it('should return null for non-existent user', async () => {
    const { result } = renderHook(() => useLeaderboard());

    await waitFor(() => {
      expect(result.current.leaderboard).toEqual(mockLeaderboard);
    });

    const rank = result.current.getUserRank('nonexistent');
    expect(rank).toBeNull();
  });

  it('should refetch leaderboard', async () => {
    const { result } = renderHook(() => useLeaderboard());

    await waitFor(() => {
      expect(result.current.leaderboard).toEqual(mockLeaderboard);
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockService.calculateLeaderboard).toHaveBeenCalledTimes(2);
  });

  it('should change time period', async () => {
    const { result } = renderHook(() => useLeaderboard());

    await waitFor(() => {
      expect(result.current.leaderboard).toEqual(mockLeaderboard);
    });

    act(() => {
      result.current.setTimePeriod('previous_month');
    });

    await waitFor(() => {
      expect(mockService.calculateLeaderboard).toHaveBeenCalledWith('previous_month');
    });
  });
});
