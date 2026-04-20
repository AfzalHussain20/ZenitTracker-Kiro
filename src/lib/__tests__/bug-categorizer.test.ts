/**
 * Unit Tests for Bug Categorizer
 * Feature: bug-analytics-categorization-system
 */

import { BugCategorizer } from '../bug-categorizer';
import { EnhancedBug, BugCategories, TaxonomyField } from '@/types/bug-analytics';
import { Timestamp } from 'firebase/firestore';

describe('BugCategorizer - Unit Tests', () => {
  let categorizer: BugCategorizer;

  beforeEach(() => {
    categorizer = new BugCategorizer({
      requiredFields: ['type', 'severity', 'component'],
      customTaxonomy: [],
    });
  });

  describe('Validation', () => {
    /**
     * Test: Validation with missing required fields
     * Requirements: 1.5
     */
    test('should fail validation when type is missing', () => {
      const bug: Partial<EnhancedBug> = {
        categories: {
          severity: 'high',
          component: 'api',
          customFields: {},
        } as any,
      };

      const result = categorizer.validateCategories(bug);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Bug type is required');
    });

    test('should fail validation when severity is missing', () => {
      const bug: Partial<EnhancedBug> = {
        categories: {
          type: 'functional',
          component: 'api',
          customFields: {},
        } as any,
      };

      const result = categorizer.validateCategories(bug);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Bug severity is required');
    });

    test('should fail validation when component is missing', () => {
      const bug: Partial<EnhancedBug> = {
        categories: {
          type: 'functional',
          severity: 'high',
          customFields: {},
        } as any,
      };

      const result = categorizer.validateCategories(bug);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Bug component is required');
    });

    /**
     * Test: Validation with all required fields present
     * Requirements: 1.1, 1.2, 1.3
     */
    test('should pass validation when all required fields are present', () => {
      const bug: Partial<EnhancedBug> = {
        categories: {
          type: 'functional',
          severity: 'high',
          component: 'api',
          customFields: {},
        },
      };

      const result = categorizer.validateCategories(bug);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail validation with invalid type', () => {
      const bug: Partial<EnhancedBug> = {
        categories: {
          type: 'invalid-type' as any,
          severity: 'high',
          component: 'api',
          customFields: {},
        },
      };

      const result = categorizer.validateCategories(bug);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid bug type'))).toBe(true);
    });
  });

  describe('Custom Field Management', () => {
    /**
     * Test: Custom field addition
     * Requirements: 1.4
     */
    test('should add custom field successfully', () => {
      const customField: TaxonomyField = {
        id: 'priority-level',
        name: 'Priority Level',
        type: 'select',
        options: ['urgent', 'normal', 'low'],
        required: false,
      };

      categorizer.addCustomField(customField);

      const field = categorizer.getCustomField('priority-level');
      expect(field).toEqual(customField);
    });

    test('should throw error when adding duplicate custom field', () => {
      const customField: TaxonomyField = {
        id: 'priority-level',
        name: 'Priority Level',
        type: 'select',
        required: false,
      };

      categorizer.addCustomField(customField);

      expect(() => {
        categorizer.addCustomField(customField);
      }).toThrow("Custom field with ID 'priority-level' already exists");
    });

    /**
     * Test: Custom field removal
     * Requirements: 1.4
     */
    test('should remove custom field successfully', () => {
      const customField: TaxonomyField = {
        id: 'priority-level',
        name: 'Priority Level',
        type: 'select',
        required: false,
      };

      categorizer.addCustomField(customField);
      categorizer.removeCustomField('priority-level');

      const field = categorizer.getCustomField('priority-level');
      expect(field).toBeUndefined();
    });

    test('should throw error when removing non-existent custom field', () => {
      expect(() => {
        categorizer.removeCustomField('non-existent');
      }).toThrow("Custom field with ID 'non-existent' not found");
    });

    test('should validate required custom fields', () => {
      const customField: TaxonomyField = {
        id: 'impact-area',
        name: 'Impact Area',
        type: 'text',
        required: true,
      };

      categorizer.addCustomField(customField);

      const bug: Partial<EnhancedBug> = {
        categories: {
          type: 'functional',
          severity: 'high',
          component: 'api',
          customFields: {},
        },
      };

      const result = categorizer.validateCategories(bug);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Impact Area'))).toBe(true);
    });
  });

  describe('Tags Support', () => {
    /**
     * Test: Empty tags array
     * Requirements: 1.6
     */
    test('should handle empty tags array', () => {
      const categories: BugCategories = {
        type: 'functional',
        severity: 'high',
        component: 'api',
        customFields: {},
      };

      const bug: Partial<EnhancedBug> = {
        id: 'test-bug',
        title: 'Test Bug',
        description: 'Test',
        categories,
        tags: [],
        status: 'open',
        priority: 'P1',
        reportedByUid: 'user-1',
        reportedByName: 'Test User',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const result = categorizer.applyCategories(bug, categories);

      expect(result.tags).toEqual([]);
    });

    test('should preserve multiple tags', () => {
      const categories: BugCategories = {
        type: 'functional',
        severity: 'high',
        component: 'api',
        customFields: {},
      };

      const tags = ['frontend', 'critical', 'regression'];
      const bug: Partial<EnhancedBug> = {
        id: 'test-bug',
        title: 'Test Bug',
        description: 'Test',
        categories,
        tags,
        status: 'open',
        priority: 'P1',
        reportedByUid: 'user-1',
        reportedByName: 'Test User',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const result = categorizer.applyCategories(bug, categories);

      expect(result.tags).toEqual(tags);
    });

    test('should fail validation if tags is not an array', () => {
      const bug: Partial<EnhancedBug> = {
        categories: {
          type: 'functional',
          severity: 'high',
          component: 'api',
          customFields: {},
        },
        tags: 'not-an-array' as any,
      };

      const result = categorizer.validateCategories(bug);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Tags must be an array');
    });
  });

  describe('Apply Categories', () => {
    test('should throw error when applying invalid categories', () => {
      const categories: BugCategories = {
        type: 'invalid' as any,
        severity: 'high',
        component: 'api',
        customFields: {},
      };

      const bug: Partial<EnhancedBug> = {
        id: 'test-bug',
        title: 'Test Bug',
        description: 'Test',
        status: 'open',
        priority: 'P1',
        reportedByUid: 'user-1',
        reportedByName: 'Test User',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      expect(() => {
        categorizer.applyCategories(bug, categories);
      }).toThrow('Invalid categories');
    });
  });

  describe('Get Available Categories', () => {
    test('should return all available category definitions', () => {
      const definitions = categorizer.getAvailableCategories();

      expect(definitions.types).toContain('functional');
      expect(definitions.severities).toContain('high');
      expect(definitions.components).toContain('api');
      expect(definitions.customFields).toEqual([]);
    });

    test('should include custom fields in category definitions', () => {
      const customField: TaxonomyField = {
        id: 'test-field',
        name: 'Test Field',
        type: 'text',
        required: false,
      };

      categorizer.addCustomField(customField);
      const definitions = categorizer.getAvailableCategories();

      expect(definitions.customFields).toHaveLength(1);
      expect(definitions.customFields[0]).toEqual(customField);
    });
  });
});
