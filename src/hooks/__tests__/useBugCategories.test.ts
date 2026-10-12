/**
 * Unit tests for useBugCategories hook
 * Validates: Requirements 1.5
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useBugCategories } from '../useBugCategories';
import { BugCategorizer } from '@/lib/bug-categorizer';
import { FirebaseConnector } from '@/lib/firebase-connector';
import {
  CategoryDefinitions,
  EnhancedBug,
  TaxonomyField,
} from '@/types/bug-analytics';

// Mock dependencies
jest.mock('@/lib/bug-categorizer');
jest.mock('@/lib/firebase-connector');

const defaultDefinitions: CategoryDefinitions = {
  types: ['functional', 'ui', 'performance', 'security', 'crash', 'data'],
  severities: ['critical', 'high', 'medium', 'low', 'trivial'],
  components: ['authentication', 'dashboard', 'api', 'database', 'ui', 'network'],
  customFields: [],
};

describe('useBugCategories', () => {
  let mockCategorizer: {
    validateCategories: jest.Mock;
    applyCategories: jest.Mock;
    addCustomField: jest.Mock;
    removeCustomField: jest.Mock;
    getAvailableCategories: jest.Mock;
  };
  let mockConnector: { read: jest.Mock; update: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockCategorizer = {
      validateCategories: jest.fn(),
      applyCategories: jest.fn(),
      addCustomField: jest.fn(),
      removeCustomField: jest.fn(),
      getAvailableCategories: jest.fn().mockReturnValue(defaultDefinitions),
    };

    mockConnector = {
      read: jest.fn().mockResolvedValue({ fields: [] }),
      update: jest.fn().mockResolvedValue(undefined),
    };

    (BugCategorizer as jest.Mock).mockImplementation(() => mockCategorizer);
    (FirebaseConnector as jest.Mock).mockImplementation(() => mockConnector);
  });

  // Wait until the async categorizer initialization effect has completed.
  const renderReady = async () => {
    const hook = renderHook(() => useBugCategories());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook;
  };

  it('should provide available categories', async () => {
    const { result } = await renderReady();

    expect(result.current.categories.types).toContain('functional');
    expect(result.current.categories.severities).toContain('critical');
    expect(result.current.categories.components).toContain('authentication');
  });

  it('should initialize the categorizer with loaded custom fields', async () => {
    const customField: TaxonomyField = {
      id: 'environment',
      name: 'Environment',
      type: 'select',
      options: ['staging', 'production'],
      required: false,
    };
    mockConnector.read.mockResolvedValue({ fields: [customField] });

    await renderReady();

    expect(mockConnector.read).toHaveBeenCalledWith('taxonomy_config', 'custom_fields');
    expect(BugCategorizer).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredFields: ['type', 'severity', 'component'],
        customTaxonomy: [customField],
      })
    );
  });

  it('should validate bug with missing required fields', async () => {
    mockCategorizer.validateCategories.mockReturnValue({
      valid: false,
      errors: ['Missing required field: type'],
    });

    const { result } = await renderReady();

    const bug: Partial<EnhancedBug> = { title: 'Test Bug' };
    const validation = result.current.validateBug(bug);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Missing required field: type');
    expect(mockCategorizer.validateCategories).toHaveBeenCalledWith(bug);
  });

  it('should validate bug with all required fields', async () => {
    mockCategorizer.validateCategories.mockReturnValue({ valid: true, errors: [] });

    const { result } = await renderReady();

    const bug: Partial<EnhancedBug> = {
      title: 'Test Bug',
      categories: {
        type: 'functional',
        severity: 'high',
        component: 'authentication',
        customFields: {},
      },
    } as Partial<EnhancedBug>;

    const validation = result.current.validateBug(bug);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should apply categories to bug', async () => {
    const enhancedBug = {
      id: '1',
      title: 'Test Bug',
      categories: {
        type: 'functional',
        severity: 'high',
        component: 'authentication',
        customFields: {},
      },
    } as unknown as EnhancedBug;

    mockCategorizer.applyCategories.mockReturnValue(enhancedBug);

    const { result } = await renderReady();

    const bug: Partial<EnhancedBug> = { title: 'Test Bug' };
    const categories = {
      type: 'functional' as const,
      severity: 'high' as const,
      component: 'authentication' as const,
      customFields: {},
    };

    const categorized = result.current.applyCategories(bug, categories);

    expect(categorized).toEqual(enhancedBug);
    expect(mockCategorizer.applyCategories).toHaveBeenCalledWith(bug, categories);
  });

  it('should add custom field and persist it', async () => {
    const field: TaxonomyField = {
      id: 'browser',
      name: 'Browser',
      type: 'text',
      required: false,
    };

    mockCategorizer.getAvailableCategories.mockReturnValue({
      ...defaultDefinitions,
      customFields: [field],
    });

    const { result } = await renderReady();

    await act(async () => {
      await result.current.addCustomField(field);
    });

    expect(mockCategorizer.addCustomField).toHaveBeenCalledWith(field);
    expect(mockConnector.update).toHaveBeenCalledWith('taxonomy_config', 'custom_fields', {
      fields: [field],
    });
    expect(result.current.categories.customFields).toContain(field);
  });

  it('should surface an error if initialization fails', async () => {
    const failure = new Error('read failed');
    mockConnector.read.mockRejectedValue(failure);

    const { result } = await renderReady();

    expect(result.current.error).toBe(failure);
  });
});
