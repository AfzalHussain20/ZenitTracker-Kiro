/**
 * Time Filter - Manages time range filtering with presets and custom ranges
 */

import { TimePreset, TimeRange } from '@/types/bug-analytics';
import { query, where, Timestamp } from 'firebase/firestore';

export class TimeFilter {
  /**
   * Get time range for a preset
   */
  getPresetRange(preset: TimePreset): TimeRange {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (preset) {
      case 'current_month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;

      case 'previous_month':
        start.setMonth(start.getMonth() - 1, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        break;

      case 'last_7_days':
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;

      case 'last_30_days':
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;

      case 'last_quarter':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        start.setMonth((currentQuarter - 1) * 3, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(currentQuarter * 3, 0);
        end.setHours(23, 59, 59, 999);
        break;

      case 'last_year':
        start.setFullYear(start.getFullYear() - 1, 0, 1);
        start.setHours(0, 0, 0, 0);
        end.setFullYear(end.getFullYear() - 1, 11, 31);
        end.setHours(23, 59, 59, 999);
        break;

      case 'all_time':
        start.setFullYear(2000, 0, 1);
        start.setHours(0, 0, 0, 0);
        end.setFullYear(end.getFullYear() + 10);
        end.setHours(23, 59, 59, 999);
        break;

      case 'custom':
        // For custom, return current date as placeholder
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { start, end, preset };
  }

  /**
   * Validate custom date range
   */
  validateCustomRange(start: Date, end: Date): boolean {
    // End date must be after or equal to start date
    return end >= start;
  }

  /**
   * Create Firestore query with time range filter
   */
  createFirestoreQuery(collectionRef: any, timeRange: TimeRange, dateField: string = 'createdAt'): any {
    const startTimestamp = Timestamp.fromDate(timeRange.start);
    const endTimestamp = Timestamp.fromDate(timeRange.end);

    return query(
      collectionRef,
      where(dateField, '>=', startTimestamp),
      where(dateField, '<=', endTimestamp)
    );
  }

  /**
   * Save user's last time filter selection to localStorage
   */
  saveLastSelection(userId: string, timeRange: TimeRange): void {
    if (typeof window === 'undefined') return;

    const key = `timeFilter_${userId}`;
    const data = {
      start: timeRange.start.toISOString(),
      end: timeRange.end.toISOString(),
      preset: timeRange.preset,
    };

    localStorage.setItem(key, JSON.stringify(data));
  }

  /**
   * Get user's last time filter selection from localStorage
   */
  getLastSelection(userId: string): TimeRange | null {
    if (typeof window === 'undefined') return null;

    const key = `timeFilter_${userId}`;
    const stored = localStorage.getItem(key);

    if (!stored) return null;

    try {
      const data = JSON.parse(stored);
      return {
        start: new Date(data.start),
        end: new Date(data.end),
        preset: data.preset,
      };
    } catch (error) {
      console.error('Failed to parse stored time filter:', error);
      return null;
    }
  }

  /**
   * Format time range as human-readable label
   */
  formatRangeLabel(timeRange: TimeRange): string {
    if (timeRange.preset && timeRange.preset !== 'custom') {
      return this.formatPresetLabel(timeRange.preset);
    }

    const startStr = timeRange.start.toLocaleDateString();
    const endStr = timeRange.end.toLocaleDateString();
    return `${startStr} - ${endStr}`;
  }

  /**
   * Format preset as human-readable label
   */
  private formatPresetLabel(preset: TimePreset): string {
    const labels: Record<TimePreset, string> = {
      current_month: 'Current Month',
      previous_month: 'Previous Month',
      last_7_days: 'Last 7 Days',
      last_30_days: 'Last 30 Days',
      last_quarter: 'Last Quarter',
      last_year: 'Last Year',
      all_time: 'All Time',
      custom: 'Custom Range',
    };

    return labels[preset] || preset;
  }
}
