/**
 * Module Registry System
 * Handles runtime registration and management of modules
 */

import {
  ModuleRegistry,
  RegistrableModule,
  ModuleMetadata,
  ModuleStatus,
  ModuleType,
  ModuleContext,
  RegistrationEvent,
  RegistrationEventListener,
  ModuleLogger
} from '../types/registration.js';

export class DefaultModuleRegistry implements ModuleRegistry {
  private modules = new Map<string, ModuleMetadata>();
  private instances = new Map<string, RegistrableModule>();
  private eventListeners: RegistrationEventListener[] = [];
  private logger: ModuleLogger;

  constructor(logger?: ModuleLogger) {
    this.logger = logger || new ConsoleModuleLogger();
  }

  async register(module: RegistrableModule, metadata?: Partial<ModuleMetadata>): Promise<void> {
    try {
      const capabilities = module.getCapabilities();
      
      // Check if module is already registered
      if (this.modules.has(capabilities.name)) {
        throw new Error(`Module '${capabilities.name}' is already registered`);
      }

      // Create full metadata
      const fullMetadata: ModuleMetadata = {
        name: capabilities.name,
        version: capabilities.version,
        type: capabilities.type,
        path: metadata?.path || 'runtime',
        capabilities,
        status: ModuleStatus.DISCOVERED,
        registeredAt: new Date(),
        ...metadata
      };

      // Validate module
      const validation = await this.validateModule(module);
      if (!validation.valid) {
        throw new Error(`Module validation failed: ${validation.errors.join(', ')}`);
      }

      // Register the module
      this.modules.set(capabilities.name, fullMetadata);
      this.instances.set(capabilities.name, module);

      // Update status
      await this.updateModuleStatus(capabilities.name, ModuleStatus.REGISTERED);

      this.logger.info(`Module '${capabilities.name}' registered successfully`, {
        version: capabilities.version,
        type: capabilities.type
      });

      // Emit registration event
      this.emitEvent({
        type: 'register',
        module: capabilities.name,
        timestamp: new Date(),
        metadata: { version: capabilities.version, type: capabilities.type }
      });

    } catch (error) {
      this.logger.error(`Failed to register module`, error);
      throw error;
    }
  }

  async unregister(name: string): Promise<void> {
    try {
      const metadata = this.modules.get(name);
      const instance = this.instances.get(name);

      if (!metadata || !instance) {
        throw new Error(`Module '${name}' is not registered`);
      }

      // Shutdown the module if it's active
      if (metadata.status === ModuleStatus.ACTIVE || metadata.status === ModuleStatus.INITIALIZED) {
        try {
          await instance.shutdown();
          this.logger.info(`Module '${name}' shutdown completed`);
        } catch (error) {
          this.logger.warn(`Module '${name}' shutdown failed`, { error: error.message });
        }
      }

      // Remove from registry
      this.modules.delete(name);
      this.instances.delete(name);

      this.logger.info(`Module '${name}' unregistered successfully`);

      // Emit unregistration event
      this.emitEvent({
        type: 'unregister',
        module: name,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error(`Failed to unregister module '${name}'`, error);
      throw error;
    }
  }

  getModule<T extends RegistrableModule>(name: string): T | undefined {
    return this.instances.get(name) as T;
  }

  getModulesByType(type: ModuleType): ModuleMetadata[] {
    return Array.from(this.modules.values()).filter(m => m.capabilities.type === type);
  }

  getAllModules(): ModuleMetadata[] {
    return Array.from(this.modules.values());
  }

  async resolveDependencies(moduleName: string): Promise<string[]> {
    const metadata = this.modules.get(moduleName);
    if (!metadata) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    const resolved: string[] = [];
    const dependencies = metadata.capabilities.dependencies;

    for (const dep of dependencies) {
      if (this.modules.has(dep.name)) {
        resolved.push(dep.name);
        // Recursively resolve dependencies
        const subDeps = await this.resolveDependencies(dep.name);
        resolved.push(...subDeps);
      } else if (!dep.optional) {
        throw new Error(`Required dependency '${dep.name}' not found for module '${moduleName}'`);
      }
    }

    // Remove duplicates and return
    return [...new Set(resolved)];
  }

  isModuleRegistered(name: string): boolean {
    return this.modules.has(name);
  }

  getModuleStatus(name: string): ModuleStatus | undefined {
    return this.modules.get(name)?.status;
  }

  async initializeModule(name: string, context?: Partial<ModuleContext>): Promise<void> {
    const metadata = this.modules.get(name);
    const instance = this.instances.get(name);

    if (!metadata || !instance) {
      throw new Error(`Module '${name}' is not registered`);
    }

    if (metadata.status === ModuleStatus.INITIALIZED || metadata.status === ModuleStatus.ACTIVE) {
      this.logger.warn(`Module '${name}' is already initialized`);
      return;
    }

    try {
      // Create module context
      const moduleContext: ModuleContext = {
        moduleRegistry: this,
        configuration: {},
        logger: this.logger,
        ...context
      };

      // Initialize the module
      await instance.initialize(moduleContext);
      
      // Update status
      await this.updateModuleStatus(name, ModuleStatus.INITIALIZED);

      this.logger.info(`Module '${name}' initialized successfully`);

      // Emit initialization event
      this.emitEvent({
        type: 'initialize',
        module: name,
        timestamp: new Date()
      });

    } catch (error) {
      await this.updateModuleStatus(name, ModuleStatus.ERROR);
      
      this.logger.error(`Failed to initialize module '${name}'`, error);
      
      // Emit error event
      this.emitEvent({
        type: 'error',
        module: name,
        timestamp: new Date(),
        error: error.message
      });

      throw error;
    }
  }

  async initializeAllModules(context?: Partial<ModuleContext>): Promise<void> {
    const modules = this.getAllModules();
    const sortedModules = this.sortModulesByDependencies(modules);

    for (const module of sortedModules) {
      if (module.status === ModuleStatus.REGISTERED) {
        try {
          await this.initializeModule(module.name, context);
        } catch (error) {
          this.logger.error(`Failed to initialize module '${module.name}' during batch initialization`, error);
          // Continue with other modules
        }
      }
    }
  }

  async performHealthChecks(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [name, instance] of this.instances) {
      try {
        const healthy = await instance.healthCheck();
        results.set(name, healthy);
        
        const metadata = this.modules.get(name);
        if (metadata) {
          metadata.lastHealthCheck = new Date();
          
          // Update status based on health check
          if (!healthy && metadata.status === ModuleStatus.ACTIVE) {
            await this.updateModuleStatus(name, ModuleStatus.ERROR);
          } else if (healthy && metadata.status === ModuleStatus.ERROR) {
            await this.updateModuleStatus(name, ModuleStatus.ACTIVE);
          }
        }
      } catch (error) {
        results.set(name, false);
        this.logger.error(`Health check failed for module '${name}'`, error);
        await this.updateModuleStatus(name, ModuleStatus.ERROR);
      }
    }

    return results;
  }

  addEventListener(listener: RegistrationEventListener): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: RegistrationEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private async validateModule(module: RegistrableModule): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check required methods
    if (typeof module.getCapabilities !== 'function') {
      errors.push('Module must implement getCapabilities() method');
    }

    if (typeof module.initialize !== 'function') {
      errors.push('Module must implement initialize() method');
    }

    if (typeof module.shutdown !== 'function') {
      errors.push('Module must implement shutdown() method');
    }

    if (typeof module.healthCheck !== 'function') {
      errors.push('Module must implement healthCheck() method');
    }

    // Validate capabilities
    try {
      const capabilities = module.getCapabilities();
      if (!capabilities.name || typeof capabilities.name !== 'string') {
        errors.push('Module capabilities must include a valid name');
      }
      if (!capabilities.version || typeof capabilities.version !== 'string') {
        errors.push('Module capabilities must include a valid version');
      }
      if (!Object.values(ModuleType).includes(capabilities.type)) {
        errors.push(`Invalid module type: ${capabilities.type}`);
      }
    } catch (error) {
      errors.push(`Failed to get module capabilities: ${error.message}`);
    }

    return { valid: errors.length === 0, errors };
  }

  private async updateModuleStatus(name: string, status: ModuleStatus): Promise<void> {
    const metadata = this.modules.get(name);
    if (metadata) {
      metadata.status = status;
    }
  }

  private sortModulesByDependencies(modules: ModuleMetadata[]): ModuleMetadata[] {
    const sorted: ModuleMetadata[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (module: ModuleMetadata) => {
      if (visiting.has(module.name)) {
        throw new Error(`Circular dependency detected involving module: ${module.name}`);
      }
      
      if (visited.has(module.name)) {
        return;
      }

      visiting.add(module.name);

      // Visit dependencies first
      for (const dep of module.capabilities.dependencies) {
        const depModule = modules.find(m => m.name === dep.name);
        if (depModule) {
          visit(depModule);
        }
      }

      visiting.delete(module.name);
      visited.add(module.name);
      sorted.push(module);
    };

    for (const module of modules) {
      if (!visited.has(module.name)) {
        visit(module);
      }
    }

    return sorted;
  }

  private emitEvent(event: RegistrationEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener.onModuleEvent(event);
      } catch (error) {
        this.logger.error('Event listener failed', error);
      }
    }
  }
}

class ConsoleModuleLogger implements ModuleLogger {
  info(message: string, metadata?: Record<string, any>): void {
    console.log(`[INFO] ${message}`, metadata ? JSON.stringify(metadata) : '');
  }

  warn(message: string, metadata?: Record<string, any>): void {
    console.warn(`[WARN] ${message}`, metadata ? JSON.stringify(metadata) : '');
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    console.error(`[ERROR] ${message}`, error?.message || '', metadata ? JSON.stringify(metadata) : '');
  }

  debug(message: string, metadata?: Record<string, any>): void {
    console.debug(`[DEBUG] ${message}`, metadata ? JSON.stringify(metadata) : '');
  }
}