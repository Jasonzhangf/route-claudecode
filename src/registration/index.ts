/**
 * Dynamic Registration Framework
 * Main exports for the registration system
 */

// Core interfaces and types
export * from '../types/registration.js';

// Implementation classes
export { DefaultModuleRegistry } from './module-registry.js';
export { DefaultModuleDiscovery } from './module-discovery.js';
export { DefaultDependencyResolver } from './dependency-resolver.js';
export { RegistrationManager, type RegistrationManagerConfig } from './registration-manager.js';

// Convenience factory function
export function createRegistrationManager(config?: RegistrationManagerConfig): RegistrationManager {
  return new RegistrationManager(config);
}

// Global registration manager instance (singleton pattern)
let globalRegistrationManager: RegistrationManager | undefined;

export function getGlobalRegistrationManager(config?: RegistrationManagerConfig): RegistrationManager {
  if (!globalRegistrationManager) {
    globalRegistrationManager = new RegistrationManager(config);
  }
  return globalRegistrationManager;
}

export function setGlobalRegistrationManager(manager: RegistrationManager): void {
  globalRegistrationManager = manager;
}

export function resetGlobalRegistrationManager(): void {
  if (globalRegistrationManager) {
    globalRegistrationManager.shutdown().catch(console.error);
    globalRegistrationManager = undefined;
  }
}

// Re-export from types for convenience
export type {
  RegistrationManagerConfig
} from './registration-manager.js';