/**
 * Configuration Management System - Main Export
 * Zero-hardcoding configuration management with explicit error handling
 */

// Export all types and interfaces
export * from './types.js';
export * from './errors.js';

// Export core classes
export { ConfigValidator } from './validator.js';
export { ExternalConfigurationLoader } from './loader.js';
export { 
  ZeroHardcodingConfigurationManager,
  createConfigurationManager,
  getGlobalConfigurationManager,
  setGlobalConfigurationManager
} from './manager.js';

// Default export is the main configuration manager
export { ZeroHardcodingConfigurationManager as default } from './manager.js';