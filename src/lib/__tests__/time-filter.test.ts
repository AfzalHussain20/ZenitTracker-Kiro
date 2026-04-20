/**
 * Unit tests for TimeFilter
 */

import { TimeFilter } from '../time-filter';
import { TimePreset } from '@/types/bug-analytics';

describe('TimeFilter', () => {
  let timeFilter: TimeFilter;
  let mockGetItem: jest.Mock;
  let mockSetItem: jest.Mock;
  let mockRemoveItem: jest.Mock;

  beforeEach(() => {
    timeFilter = new TimeFilter();
    
    // Create mock functions
    mockGetItem = jest.fn();
    mockSetItem = jest.fn();
    mockRemoveItem = jest.fn();
    
    // Mock localStorage
    global.localStorage = {
      getItem: mockGetItem,
      setItem: mockSetItem,
      removeItem: mockRemoveItem,
      clear: jest.fn(),
      length: 0,
      key: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPresetRange', () => {
    it('should return current month range', () => {
      const range = timeFilter.getPresetRange('current_month');
      
      expect(range.preset).toBe('current_month');
      expect(range.start.getDate()).toBe(1);
      expect(range.start.getHours()).toBe(0);
      expect(range.end.getHours()).toBe(23);
    });

    it('should return previous month range', () => {
      const range = timeFilter.getPresetRange('previous_month');
      const now = new Date();
      const expectedMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      
      expect(range.preset).toBe('previous_month');
      expect(range.start.getDate()).toBe(1);
      // Check that it's the previous month
      expect(range.start.getMonth()).toBe(expectedMonth);
    });

    it('should return last 7 days range', () => {
      const range = timeFilter.getPresetRange('last_7_days');
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24));
      
      expect(range.preset).toBe('last_7_days');
      expect(daysDiff).toBeGreaterThanOrEqual(6);
      expect(daysDiff).toBeLessThanOrEqual(7);
    });

    it('should return last 30 days range', () => {
      const range = timeFilter.getPresetRange('last_30_days');
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24));
      
      expect(range.preset).toBe('last_30_days');
      expect(daysDiff).toBeGreaterThanOrEqual(29);
      expect(daysDiff).toBeLessThanOrEqual(30);
    });

    it('should return all time range', () => {
      const range = timeFilter.getPresetRange('all_time');
      
      expect(range.preset).toBe('all_time');
      expect(range.start.getFullYear()).toBe(2000);
      expect(range.end.getFullYear()).toBeGreaterThan(new Date().getFullYear());
    });
  });

  describe('validateCustomRange', () => {
    it('should return true when end date is after start date', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      
      expect(timeFilter.validateCustomRange(start, end)).toBe(true);
    });

    it('should return true when end date equals start date', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-01');
      
      expect(timeFilter.validateCustomRange(start, end)).toBe(true);
    });

    it('should return false when end date is before start date', () => {
      const start = new Date('2024-01-31');
      const end = new Date('2024-01-01');
      
      expect(timeFilter.validateCustomRange(start, end)).toBe(false);
    });
  });

  describe('saveLastSelection and getLastSelection', () => {
    it('should handle localStorage operations gracefully', () => {
      const userId = 'user123';
      const timeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        preset: 'custom' as TimePreset,
      };

      // These should not throw errors
      expect(() => {
        timeFilter.saveLastSelection(userId, timeRange);
      }).not.toThrow();

      expect(() => {
        timeFilter.getLastSelection(userId);
      }).not.toThrow();
    });
  });

  describe('formatRangeLabel', () => {
    it('should format preset labels correctly', () => {
      const range = timeFilter.getPresetRange('current_month');
      const label = timeFilter.formatRangeLabel(range);
      
      expect(label).toBe('Current Month');
    });

    it('should format custom range with dates', () => {
      const range = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        preset: 'custom' as TimePreset,
      };
      
      const label = timeFilter.formatRangeLabel(range);
      
      expect(label).toContain('2024');
      expect(label).toContain('-');
    });
  });
});
