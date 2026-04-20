/**
 * Unit tests for useBugCategories hook
 * Validates: Requirements 1.5
 */

import { renderHook, act } from '@testing-library/react';
import { useBugCategories } from '../useBugCategories';
import { BugCategorizer } from '@/lib/bug-categorizer';
import { EnhancedBug } from '@/types/bug-analytics';

// Mock dependencies
jest.mock('@/lib/bug-categorizer');

describe('useBugCategories', () => {
  let mockCategorizer: jest.Mocked<BugCategorizer>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCategorizer = new BugCategorizer() as jest.Mocked<BugCategorizer>;
    (BugCategorizer as jest.Mock).mockImplementation(() => mockCategorizer);
  });

  it('should provide available categories', () => {
    const { result } = renderHook(() => useBugCategories());

    expect(result.current.categories.types).toContain('functional');
    expect(result.current.categories.severities).toContain('critical');
    expect(result.current.categories.components).toContain('authentication');
  });

  it('should validate bug with missing required fields', () => {
    mockCategorizer.validateCategories = jest.fn().mockReturnValue({
      isValid: false,
      errors: ['Missing required field: type'],
    });

    const { result } = renderHook(() => useBugCategories());

    const bug: Partial<EnhancedBug> = {
      title: 'Test Bug',
    };

    const validation = result.current.validateBug(bug);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Missing required field: type');
  });

  it('should validate bug with all required fields', () => {
    mockCategorizer.validateCategories = jest.fn().mockReturnValue({
      isValid: true,
      errors: [],
    });

    const { result } = renderHook(() => useBugCategories());

    const bug: Partial<EnhancedBug> = {
      title: 'Test Bug',
      type: 'functional',
      severity: 'high',
      component: 'authentication',
    };

    const validation = result.current.validateBug(bug);

    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should apply categories to bug', () => {
    const enhancedBug: EnhancedBug = {
      id: '1',
      title: 'Test Bug',
      type: 'functional',
      severity: 'high',
      component: 'authentication',
      tags: [],
      customFields: {},
    } as EnhancedBug;

    mockCategorizer.applyCategories = jest.fn().mockReturnValue(enhancedBug);

    const { result } = renderHook(() => useBugCategories());

    const bug: Partial<EnhancedBug> = {
      title: 'Test Bug',
      type: 'functional',
    };

    const categorized = result.current.applyCategories(bug);

    expect(categorized).toEqual(enhancedBug);
    expect(mockCategorizer.applyCategories).toHaveBeenCalledWith(bug);
  });

  it('should add custom field', () => {
    mockCategorizer.addCustomField = jest.fn();

    const { result } = renderHook(() => useBugCategories());

    act(() => {
      result.current.addCustomField('customField1');
    });

    expect(mockCategorizer.addCustomField).toHaveBeenCalledWith('customField1');
    expect(result.current.categories.customFields).toContain('customField1');
  });

  it('should remove custom field', () => {
    mockCategorizer.addCustomField = jest.fn();
    mockCategorizer.removeCustomField = jest.fn();

    const { result } = renderHook(() => useBugCategories());

    act(() => {
      result.current.addCustomField('customField1');
    });

    act(() => {
      result.current.removeCustomField('customField1');
    });

    expect(mockCategorizer.removeCustomField).toHaveBeenCalledWith('customField1');
    expect(result.current.categories.customFields).not.toContain('customField1');
  });
});
