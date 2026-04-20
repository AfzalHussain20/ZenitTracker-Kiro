/**
 * useTimeFilter Hook
 * Manages time-based filtering state
 */

import { useState, useCallback } from 'react';
import { TimeFilter } from '@/lib/time-filter';
import { TimeRange, TimePreset } from '@/types/bug-analytics';

interface UseTimeFilterReturn {
  timeRange: TimeRange;
  setPreset: (preset: TimePreset) => void;
  setCustomRange: (start: Date, end: Date) => void;
  formatLabel: () => string;
  isValid: boolean;
}

export function useTimeFilter(initialPreset: TimePreset = 'all_time'): UseTimeFilterReturn {
  const [timeFilter] = useState(() => new TimeFilter());
  const [timeRange, setTimeRange] = useState<TimeRange>(() =>
    timeFilter.getPresetRange(initialPreset)
  );
  const [isValid, setIsValid] = useState(true);

  const setPreset = useCallback(
    (preset: TimePreset) => {
      const range = timeFilter.getPresetRange(preset);
      setTimeRange(range);
      setIsValid(true);
      
      // Save to localStorage
      const userId = 'current-user'; // Replace with actual user ID
      timeFilter.saveLastSelection(userId, range);
    },
    [timeFilter]
  );

  const setCustomRange = useCallback(
    (start: Date, end: Date) => {
      const valid = timeFilter.validateCustomRange(start, end);
      setIsValid(valid);
      
      if (valid) {
        const range: TimeRange = { start, end, preset: 'custom' };
        setTimeRange(range);
        
        // Save to localStorage
        const userId = 'current-user'; // Replace with actual user ID
        timeFilter.saveLastSelection(userId, range);
      }
    },
    [timeFilter]
  );

  const formatLabel = useCallback(() => {
    return timeFilter.formatRangeLabel(timeRange);
  }, [timeFilter, timeRange]);

  return {
    timeRange,
    setPreset,
    setCustomRange,
    formatLabel,
    isValid,
  };
}
