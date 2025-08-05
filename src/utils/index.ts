/**
 * Utility modules exports
 */

export { calculateTokenCount, calculateDetailedTokenCount } from './tokenizer';
export { getConfigPaths, needsMigration, getLegacyConfigPaths, getNewConfigPaths } from './config-paths';
export { migrateConfiguration, removeLegacyConfiguration, backupLegacyConfiguration } from './migration';
export { resolvePath } from './path-resolver';

// Dynamic Model Configuration System
export {
  DynamicModelDiscovery,
  createDynamicModelDiscovery,
  type ModelInfo,
  type ModelAvailabilityResult,
  type ModelDiscoveryConfig,
  type DiscoveryResult
} from './dynamic-model-discovery';

export {
  DynamicModelConfigManager,
  createDynamicModelConfigManager,
  type ModelConfig,
  type ProviderModelConfig,
  type ModelConfigManagerConfig,
  type ModelUpdateEvent,
  DEFAULT_MODEL_CONFIG_MANAGER_CONFIG
} from './dynamic-model-config-manager';