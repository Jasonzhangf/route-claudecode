/**
 * Configuration Management System
 * Zero-hardcoding configuration management with explicit error handling
 */

// Export all configuration types and interfaces
export * from '../src/config/types.js';
export * from '../src/config/errors.js';

// Export configuration management classes
export { ConfigValidator } from '../src/config/validator.js';
export { ExternalConfigurationLoader } from '../src/config/loader.js';
export { 
  ZeroHardcodingConfigurationManager,
  createConfigurationManager,
  getGlobalConfigurationManager,
  setGlobalConfigurationManager
} from '../src/config/manager.js';

// Export environment-specific configurations
export { developmentConfig } from './development/index.js';
export { productionConfig } from './production/index.js';
export { testingConfig } from './testing/index.js';

// Re-export the main configuration manager as default
export { ZeroHardcodingConfigurationManager as default } from '../src/config/manager.js';