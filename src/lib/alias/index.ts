/**
 * Alias Management Module
 * 
 * This module provides comprehensive functionality for managing user aliases
 * in the Advanced KPI Dashboard System.
 * 
 * @module alias
 */

export {
  // Main functions
  validateAliasFormat,
  isAliasUnique,
  generateAliasFromName,
  updateUserAlias,
  migrateHistoricalData,
  
  // Utility functions
  getUserByAlias,
  getAvailableAlias,
  
  // Types
  type AliasValidationResult,
  type AliasUpdateAudit,
} from './alias-management.service';
