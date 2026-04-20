/**
 * Property-Based Tests for Bug Categorizer
 * Feature: bug-analytics-categorization-system
 */

import fc from 'fast-check';
import { BugCategorizer } from '../bug-categorizer';
import { EnhancedBug, BugCategories, TaxonomyField } from '@/types/bug-analytics';
import { Timestamp } from 'firebase/firestore';

describe('BugCategorizer - Property-Based Tests', () => {
  /**
   * Property 1: Bug Categorization Completeness
   * Validates: Requirements 1.1, 1.2, 1.3, 1.7
   * 
   * Property: Every bug with all required fields (type, severity, component)
   * should pass validation.
   */
  test('Property 1: Bug Categorization Completeness - bugs with all required fields should validate', () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.constantFrom('functional', 'ui', 'performance', 'security', 'crash', 'data'),
          severity: fc.constantFrom('critical', 'high', 'medium', 'low', 'trivial'),
          component: fc.constantFrom('authentication', 'dashboard', 'api', 'database', 'ui', 'network'),
          customFields: fc.constant({}), // Empty custom fields for basic validation
        }),
        (categories) => {
          const categorizer = new BugCategorizer({
            requiredFields: ['type', 'severity', 'component'],
            customTaxonomy: [],
          });

          const bug: Partial<EnhancedBug> = {
            id: 'test-bug',
            title: 'Test Bug',
            description: 'Test description',
            categories: categories as BugCategories,
            tags: [],
            status: 'open',
            priority: 'P1',
            reportedByUid: 'user-1',
            reportedByName: 'Test User',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };

          const result = categorizer.validateCategories(bug);
          
          // Property: All bugs with required fields should be valid
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Custom Taxonomy Field Support
   * Validates: Requirements 1.4
   * 
   * Property: Custom fields can be added and removed without affecting
   * the core categorization system.
   */
  test('Property 2: Custom Taxonomy Field Support - custom fields should be manageable', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s !== 'constructor'),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('select', 'multi-select', 'text', 'number'),
            required: fc.boolean(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (customFields) => {
          // Ensure unique IDs
          const uniqueFields = customFields.map((field, idx) => ({
            ...field,
            id: `${field.id}-${idx}`,
          })) as TaxonomyField[];

          const categorizer = new BugCategorizer({
            requiredFields: ['type', 'severity', 'component'],
            customTaxonomy: [],
          });

          // Property: All custom fields can be added
          uniqueFields.forEach(field => {
            categorizer.addCustomField(field);
          });

          const allFields = categorizer.getAllCustomFields();
          expect(allFields).toHaveLength(uniqueFields.length);

          // Property: All custom fields can be removed
          uniqueFields.forEach(field => {
            categorizer.removeCustomField(field.id);
          });

          const remainingFields = categorizer.getAllCustomFields();
          expect(remainingFields).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Required Field Validation
   * Validates: Requirements 1.5
   * 
   * Property: Bugs missing any required field should fail validation.
   */
  test('Property 3: Required Field Validation - bugs missing required fields should fail', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('type', 'severity', 'component'),
        (missingField) => {
          const categorizer = new BugCategorizer({
            requiredFields: ['type', 'severity', 'component'],
            customTaxonomy: [],
          });

          const categories: any = {
            type: 'functional',
            severity: 'high',
            component: 'api',
            customFields: {},
          };

          // Remove the required field
          delete categories[missingField];

          const bug: Partial<EnhancedBug> = {
            id: 'test-bug',
            title: 'Test Bug',
            description: 'Test description',
            categories: categories as BugCategories,
            tags: [],
            status: 'open',
            priority: 'P1',
            reportedByUid: 'user-1',
            reportedByName: 'Test User',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };

          const result = categorizer.validateCategories(bug);
          
          // Property: Missing required field should cause validation failure
          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.some(e => e.toLowerCase().includes(missingField))).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Multiple Tags Support
   * Validates: Requirements 1.6
   * 
   * Property: Bugs can have any number of tags (including zero),
   * and tags should be preserved during categorization.
   */
  test('Property 4: Multiple Tags Support - bugs should support any number of tags', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 20 }),
        (tags) => {
          const categorizer = new BugCategorizer({
            requiredFields: ['type', 'severity', 'component'],
            customTaxonomy: [],
          });

          const categories: BugCategories = {
            type: 'functional',
            severity: 'high',
            component: 'api',
            customFields: {},
          };

          const bug: Partial<EnhancedBug> = {
            id: 'test-bug',
            title: 'Test Bug',
            description: 'Test description',
            categories,
            tags,
            status: 'open',
            priority: 'P1',
            reportedByUid: 'user-1',
            reportedByName: 'Test User',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };

          const result = categorizer.validateCategories(bug);
          
          // Property: Tags should not affect validation
          expect(result.valid).toBe(true);

          // Property: Tags should be preserved
          const categorizedBug = categorizer.applyCategories(bug, categories);
          expect(categorizedBug.tags).toEqual(tags);
        }
      ),
      { numRuns: 100 }
    );
  });
});
