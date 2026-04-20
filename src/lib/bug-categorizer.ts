/**
 * Bug Categorizer - Manages bug categorization and taxonomy
 * Provides validation, categorization, and custom field management
 */

import {
  EnhancedBug,
  BugCategories,
  TaxonomyField,
  CategoryDefinitions,
  ValidationResult,
  BugType,
  BugSeverity,
  BugComponent,
} from '@/types/bug-analytics';

export interface BugCategorizerConfig {
  requiredFields: string[];
  customTaxonomy: TaxonomyField[];
}

export class BugCategorizer {
  private config: BugCategorizerConfig;
  private customFields: Map<string, TaxonomyField>;

  constructor(config: BugCategorizerConfig) {
    this.config = config;
    this.customFields = new Map();
    
    // Initialize custom fields
    config.customTaxonomy.forEach(field => {
      this.customFields.set(field.id, field);
    });
  }

  /**
   * Validate bug categories against required fields and custom taxonomy
   */
  validateCategories(bug: Partial<EnhancedBug>): ValidationResult {
    const errors: string[] = [];

    // Check required standard fields
    if (!bug.categories) {
      errors.push('Categories object is required');
      return { valid: false, errors };
    }

    const { categories } = bug;

    // Validate type
    if (!categories.type) {
      errors.push('Bug type is required');
    } else if (!this.isValidBugType(categories.type)) {
      errors.push(`Invalid bug type: ${categories.type}`);
    }

    // Validate severity
    if (!categories.severity) {
      errors.push('Bug severity is required');
    } else if (!this.isValidSeverity(categories.severity)) {
      errors.push(`Invalid severity: ${categories.severity}`);
    }

    // Validate component
    if (!categories.component) {
      errors.push('Bug component is required');
    } else if (!this.isValidComponent(categories.component)) {
      errors.push(`Invalid component: ${categories.component}`);
    }

    // Validate custom fields
    if (categories.customFields) {
      for (const [fieldId, value] of Object.entries(categories.customFields)) {
        const field = this.customFields.get(fieldId);
        
        if (!field) {
          errors.push(`Unknown custom field: ${fieldId}`);
          continue;
        }

        // Check required fields
        if (field.required && (value === undefined || value === null || value === '')) {
          errors.push(`Custom field '${field.name}' is required`);
        }

        // Run custom validation if provided
        if (field.validation && value !== undefined && value !== null) {
          if (!field.validation(value)) {
            errors.push(`Custom field '${field.name}' failed validation`);
          }
        }

        // Validate select/multi-select options
        if (field.type === 'select' && field.options) {
          if (!field.options.includes(value)) {
            errors.push(`Invalid value for '${field.name}': ${value}`);
          }
        }

        if (field.type === 'multi-select' && field.options) {
          if (!Array.isArray(value)) {
            errors.push(`'${field.name}' must be an array`);
          } else {
            const invalidValues = value.filter(v => !field.options!.includes(v));
            if (invalidValues.length > 0) {
              errors.push(`Invalid values for '${field.name}': ${invalidValues.join(', ')}`);
            }
          }
        }
      }
    }

    // Check for required custom fields
    for (const field of this.customFields.values()) {
      if (field.required) {
        const value = categories.customFields?.[field.id];
        if (value === undefined || value === null || value === '') {
          errors.push(`Required custom field '${field.name}' is missing`);
        }
      }
    }

    // Validate tags if present
    if (bug.tags !== undefined && !Array.isArray(bug.tags)) {
      errors.push('Tags must be an array');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Apply categories to a bug
   */
  applyCategories(bug: Partial<EnhancedBug>, categories: BugCategories): EnhancedBug {
    const validation = this.validateCategories({ ...bug, categories });
    
    if (!validation.valid) {
      throw new Error(`Invalid categories: ${validation.errors.join(', ')}`);
    }

    return {
      ...bug,
      categories,
      tags: bug.tags || [],
    } as EnhancedBug;
  }

  /**
   * Get available category definitions
   */
  getAvailableCategories(): CategoryDefinitions {
    return {
      types: ['functional', 'ui', 'performance', 'security', 'crash', 'data'],
      severities: ['critical', 'high', 'medium', 'low', 'trivial'],
      components: ['authentication', 'dashboard', 'api', 'database', 'ui', 'network'],
      customFields: Array.from(this.customFields.values()),
    };
  }

  /**
   * Add a custom taxonomy field
   */
  addCustomField(field: TaxonomyField): void {
    if (this.customFields.has(field.id)) {
      throw new Error(`Custom field with ID '${field.id}' already exists`);
    }

    this.customFields.set(field.id, field);
    this.config.customTaxonomy.push(field);
  }

  /**
   * Remove a custom taxonomy field
   */
  removeCustomField(fieldId: string): void {
    if (!this.customFields.has(fieldId)) {
      throw new Error(`Custom field with ID '${fieldId}' not found`);
    }

    this.customFields.delete(fieldId);
    this.config.customTaxonomy = this.config.customTaxonomy.filter(f => f.id !== fieldId);
  }

  /**
   * Get a custom field by ID
   */
  getCustomField(fieldId: string): TaxonomyField | undefined {
    return this.customFields.get(fieldId);
  }

  /**
   * Get all custom fields
   */
  getAllCustomFields(): TaxonomyField[] {
    return Array.from(this.customFields.values());
  }

  // Private validation helpers
  private isValidBugType(type: string): type is BugType {
    const validTypes: BugType[] = ['functional', 'ui', 'performance', 'security', 'crash', 'data'];
    return validTypes.includes(type as BugType);
  }

  private isValidSeverity(severity: string): severity is BugSeverity {
    const validSeverities: BugSeverity[] = ['critical', 'high', 'medium', 'low', 'trivial'];
    return validSeverities.includes(severity as BugSeverity);
  }

  private isValidComponent(component: string): component is BugComponent {
    const validComponents: BugComponent[] = ['authentication', 'dashboard', 'api', 'database', 'ui', 'network'];
    return validComponents.includes(component as BugComponent);
  }
}
