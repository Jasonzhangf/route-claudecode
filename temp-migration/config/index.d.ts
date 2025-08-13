/**
 * Configuration Management System
 * Zero-hardcoding configuration management with explicit error handling
 */
export * from '../src/config/types.js';
export * from '../src/config/errors.js';
export { ConfigValidator } from '../src/config/validator.js';
export { ExternalConfigurationLoader } from '../src/config/loader.js';
export { ZeroHardcodingConfigurationManager, createConfigurationManager, getGlobalConfigurationManager, setGlobalConfigurationManager } from '../src/config/manager.js';
export { developmentConfig } from './development/index.js';
export { productionConfig } from './production/index.js';
export { testingConfig } from './testing/index.js';
export { ZeroHardcodingConfigurationManager as default } from '../src/config/manager.js';
//# sourceMappingURL=index.d.ts.map