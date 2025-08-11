/**
 * Registration Manager
 * Main orchestrator for the dynamic registration framework
 */

import { join } from 'path';
import {
  ModuleRegistry,
  ModuleDiscovery,
  DependencyResolver,
  RegistrableModule,
  ModuleContext,
  RegistrationEventListener,
  RegistrationEvent,
  ModuleLogger,
  ModuleStatus,
  ModuleType
} from '../types/registration.js';
import { DefaultModuleRegistry } from './module-registry.js';
import { DefaultModuleDiscovery } from './module-discovery.js';
import { DefaultDependencyResolver } from './dependency-resolver.js';

export interface RegistrationManagerConfig {
  searchPaths?: string[];
  autoDiscovery?: boolean;
  autoInitialization?: boolean;
  healthCheckInterval?: number;
  logger?: ModuleLogger;
}

export class RegistrationManager implements RegistrationEventListener {
  private registry: ModuleRegistry;
  private discovery: ModuleDiscovery;
  private resolver: DependencyResolver;
  private config: Required<RegistrationManagerConfig>;
  private healthCheckTimer?: NodeJS.Timeout;
  private logger: ModuleLogger;

  constructor(config: RegistrationManagerConfig = {}) {
    this.logger = config.logger || new DefaultLogger();
    
    this.config = {
      searchPaths: config.searchPaths || this.getDefaultSearchPaths(),
      autoDiscovery: config.autoDiscovery ?? true,
      autoInitialization: config.autoInitialization ?? true,
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      logger: this.logger
    };

    this.registry = new DefaultModuleRegistry(this.logger);
    this.discovery = new DefaultModuleDiscovery();
    this.resolver = new DefaultDependencyResolver();

    // Listen to registry events
    this.registry.addEventListener(this);

    this.logger.info('Registration Manager initialized', {
      searchPaths: this.config.searchPaths,
      autoDiscovery: this.config.autoDiscovery,
      autoInitialization: this.config.autoInitialization
    });
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Starting registration manager initialization');

      if (this.config.autoDiscovery) {
        await this.discoverAndRegisterModules();
      }

      if (this.config.autoInitialization) {
        await this.initializeAllModules();
      }

      // Start health check timer
      this.startHealthChecks();

      this.logger.info('Registration manager initialization completed');
    } catch (error) {
      this.logger.error('Registration manager initialization failed', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down registration manager');

      // Stop health checks
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = undefined;
      }

      // Shutdown all modules
      const modules = this.registry.getAllModules();
      for (const module of modules.reverse()) { // Reverse order for shutdown
        try {
          await this.registry.unregister(module.name);
        } catch (error) {
          this.logger.warn(`Failed to unregister module '${module.name}' during shutdown`, { error: error.message });
        }
      }

      this.logger.info('Registration manager shutdown completed');
    } catch (error) {
      this.logger.error('Registration manager shutdown failed', error);
      throw error;
    }
  }

  async discoverAndRegisterModules(): Promise<void> {
    try {
      this.logger.info('Starting module discovery', { searchPaths: this.config.searchPaths });

      const discovered = await this.discovery.discoverModules(this.config.searchPaths);
      
      this.logger.info(`Discovered ${discovered.length} modules`, {
        valid: discovered.filter(m => m.valid).length,
        invalid: discovered.filter(m => !m.valid).length
      });

      // Register valid modules
      for (const moduleInfo of discovered) {
        if (moduleInfo.valid) {
          try {
            const module = await this.discovery.loadModule(moduleInfo.path);
            await this.registry.register(module, {
              path: moduleInfo.path,
              type: moduleInfo.type
            });
          } catch (error) {
            this.logger.error(`Failed to register discovered module '${moduleInfo.name}'`, error);
          }
        } else {
          this.logger.warn(`Skipping invalid module '${moduleInfo.name}'`, { 
            path: moduleInfo.path, 
            error: moduleInfo.error 
          });
        }
      }

      // Validate dependencies
      const allModules = this.registry.getAllModules();
      const dependencyValidation = await this.resolver.validateDependencies(allModules);
      
      if (!dependencyValidation.valid) {
        this.logger.warn('Dependency validation issues found', {
          errors: dependencyValidation.errors,
          warnings: dependencyValidation.warnings
        });
      }

    } catch (error) {
      this.logger.error('Module discovery and registration failed', error);
      throw error;
    }
  }

  async initializeAllModules(): Promise<void> {
    try {
      this.logger.info('Starting module initialization');

      const context: Partial<ModuleContext> = {
        moduleRegistry: this.registry,
        configuration: {},
        logger: this.logger
      };

      await this.registry.initializeAllModules(context);

      this.logger.info('Module initialization completed');
    } catch (error) {
      this.logger.error('Module initialization failed', error);
      throw error;
    }
  }

  async registerModule(module: RegistrableModule, path?: string): Promise<void> {
    try {
      await this.registry.register(module, { path });
      
      if (this.config.autoInitialization) {
        const capabilities = module.getCapabilities();
        await this.registry.initializeModule(capabilities.name);
      }
    } catch (error) {
      this.logger.error('Manual module registration failed', error);
      throw error;
    }
  }

  async unregisterModule(name: string): Promise<void> {
    try {
      await this.registry.unregister(name);
    } catch (error) {
      this.logger.error(`Failed to unregister module '${name}'`, error);
      throw error;
    }
  }

  getModule<T extends RegistrableModule>(name: string): T | undefined {
    return this.registry.getModule<T>(name);
  }

  getModulesByType(type: ModuleType): RegistrableModule[] {
    const metadata = this.registry.getModulesByType(type);
    return metadata
      .map(m => this.registry.getModule(m.name))
      .filter((m): m is RegistrableModule => m !== undefined);
  }

  getAllModules(): RegistrableModule[] {
    const metadata = this.registry.getAllModules();
    return metadata
      .map(m => this.registry.getModule(m.name))
      .filter((m): m is RegistrableModule => m !== undefined);
  }

  getModuleStatus(name: string): ModuleStatus | undefined {
    return this.registry.getModuleStatus(name);
  }

  async performHealthChecks(): Promise<Map<string, boolean>> {
    return await this.registry.performHealthChecks();
  }

  onModuleEvent(event: RegistrationEvent): void {
    this.logger.info(`Module event: ${event.type}`, {
      module: event.module,
      timestamp: event.timestamp,
      metadata: event.metadata,
      error: event.error
    });

    // Handle specific events
    switch (event.type) {
      case 'error':
        this.handleModuleError(event);
        break;
      case 'register':
        this.handleModuleRegistration(event);
        break;
      case 'unregister':
        this.handleModuleUnregistration(event);
        break;
    }
  }

  private getDefaultSearchPaths(): string[] {
    const basePath = process.cwd();
    return [
      join(basePath, 'src', 'client'),
      join(basePath, 'src', 'router'),
      join(basePath, 'src', 'post-processor'),
      join(basePath, 'src', 'transformer'),
      join(basePath, 'src', 'provider'),
      join(basePath, 'src', 'preprocessor'),
      join(basePath, 'src', 'server'),
      join(basePath, 'src', 'service'),
      join(basePath, 'tools')
    ];
  }

  private startHealthChecks(): void {
    if (this.config.healthCheckInterval > 0) {
      this.healthCheckTimer = setInterval(async () => {
        try {
          await this.performHealthChecks();
        } catch (error) {
          this.logger.error('Health check cycle failed', error);
        }
      }, this.config.healthCheckInterval);

      this.logger.info('Health check timer started', { 
        interval: this.config.healthCheckInterval 
      });
    }
  }

  private handleModuleError(event: RegistrationEvent): void {
    this.logger.error(`Module '${event.module}' encountered an error`, new Error(event.error));
    
    // Could implement recovery strategies here
    // For example, attempt to restart the module
  }

  private handleModuleRegistration(event: RegistrationEvent): void {
    this.logger.info(`Module '${event.module}' registered successfully`);
  }

  private handleModuleUnregistration(event: RegistrationEvent): void {
    this.logger.info(`Module '${event.module}' unregistered successfully`);
  }
}

class DefaultLogger implements ModuleLogger {
  info(message: string, metadata?: Record<string, any>): void {
    console.log(`[REGISTRATION-INFO] ${message}`, metadata ? JSON.stringify(metadata, null, 2) : '');
  }

  warn(message: string, metadata?: Record<string, any>): void {
    console.warn(`[REGISTRATION-WARN] ${message}`, metadata ? JSON.stringify(metadata, null, 2) : '');
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    console.error(`[REGISTRATION-ERROR] ${message}`, error?.message || '', metadata ? JSON.stringify(metadata, null, 2) : '');
    if (error?.stack) {
      console.error(error.stack);
    }
  }

  debug(message: string, metadata?: Record<string, any>): void {
    console.debug(`[REGISTRATION-DEBUG] ${message}`, metadata ? JSON.stringify(metadata, null, 2) : '');
  }
}