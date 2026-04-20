/**
 * useLeaderboard Hook
 * Manages leaderboard data and rankings
 */

import { useState, useEffect, useCallback } from 'react';
import { LeaderboardService } from '@/lib/leaderboard-service';
import { FirebaseConnector } from '@/lib/firebase-connector';
import { db } from '@/lib/firebaseConfig';
import { LeaderboardEntry, LeaderboardQuery } from '@/types/bug-analytics';

interface UseLeaderboardReturn {
  leaderboard: LeaderboardEntry[];
  loading: boolean;
  error: Error | null;
  refetch: (query: LeaderboardQuery) => Promise<void>;
  getUserRank: (userId: string) => number | null;
}

export function useLeaderboard(initialQuery: LeaderboardQuery): UseLeaderboardReturn {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [service] = useState(() => {
    const connector = new FirebaseConnector(db);
    return new LeaderboardService(connector);
  });

  const fetchLeaderboard = useCallback(
    async (query: LeaderboardQuery) => {
      setLoading(true);
      setError(null);
      try {
        const data = await service.calculateLeaderboard(query);
        setLeaderboard(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    },
    [service]
  );

  useEffect(() => {
    fetchLeaderboard(initialQuery);
  }, [initialQuery.timePeriod, initialQuery.startDate, initialQuery.endDate]);

  const getUserRank = useCallback(
    (userId: string): number | null => {
      const entry = leaderboard.find((e) => e.userId === userId);
      return entry ? entry.rank : null;
    },
    [leaderboard]
  );

  return {
    leaderboard,
    loading,
    error,
    refetch: fetchLeaderboard,
    getUserRank,
  };
}
