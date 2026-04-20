/**
 * useBugCategories Hook
 * Manages bug categorization state and operations
 */

import { useState, useCallback, useEffect } from 'react';
import { BugCategorizer } from '@/lib/bug-categorizer';
import { FirebaseConnector } from '@/lib/firebase-connector';
import { db } from '@/lib/firebaseConfig';
import {
  CategoryDefinitions,
  ValidationResult,
  EnhancedBug,
  BugCategories,
  TaxonomyField,
} from '@/types/bug-analytics';

interface UseBugCategoriesReturn {
  categories: CategoryDefinitions;
  validateBug: (bug: Partial<EnhancedBug>) => ValidationResult;
  applyCategories: (bug: Partial<EnhancedBug>, categories: BugCategories) => EnhancedBug;
  addCustomField: (field: TaxonomyField) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

export function useBugCategories(): UseBugCategoriesReturn {
  const [categorizer, setCategorizer] = useState<BugCategorizer | null>(null);
  const [categories, setCategories] = useState<CategoryDefinitions>({
    types: ['functional', 'ui', 'performance', 'security', 'crash', 'data'],
    severities: ['critical', 'high', 'medium', 'low', 'trivial'],
    components: ['authentication', 'dashboard', 'api', 'database', 'ui', 'network'],
    customFields: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initCategorizer = async () => {
      try {
        const connector = new FirebaseConnector(db);
        
        // Load custom fields from Firestore
        const customFieldsDoc = await connector.read<{ fields: TaxonomyField[] }>(
          'taxonomy_config',
          'custom_fields'
        );
        
        const customFields = customFieldsDoc?.fields || [];
        
        const cat = new BugCategorizer({
          requiredFields: ['type', 'severity', 'component'],
          customTaxonomy: customFields,
        });
        
        setCategorizer(cat);
        setCategories(cat.getAvailableCategories());
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    initCategorizer();
  }, []);

  const validateBug = useCallback(
    (bug: Partial<EnhancedBug>): ValidationResult => {
      if (!categorizer) {
        return { valid: false, errors: ['Categorizer not initialized'] };
      }
      return categorizer.validateCategories(bug);
    },
    [categorizer]
  );

  const applyCategories = useCallback(
    (bug: Partial<EnhancedBug>, bugCategories: BugCategories): EnhancedBug => {
      if (!categorizer) {
        throw new Error('Categorizer not initialized');
      }
      return categorizer.applyCategories(bug, bugCategories);
    },
    [categorizer]
  );

  const addCustomField = useCallback(
    async (field: TaxonomyField) => {
      if (!categorizer) {
        throw new Error('Categorizer not initialized');
      }
      
      categorizer.addCustomField(field);
      setCategories(categorizer.getAvailableCategories());
      
      // Persist to Firestore
      const connector = new FirebaseConnector(db);
      await connector.update('taxonomy_config', 'custom_fields', {
        fields: categorizer.getAvailableCategories().customFields,
      });
    },
    [categorizer]
  );

  return {
    categories,
    validateBug,
    applyCategories,
    addCustomField,
    loading,
    error,
  };
}
