/**
 * Unit Tests for Dynamic Registration Framework
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RegistrationManager,
  DefaultModuleRegistry,
  DefaultModuleDiscovery,
  DefaultDependencyResolver,
  ModuleType,
  ModuleStatus,
  RegistrableModule,
  ModuleCapabilities,
  ModuleContext,
  ModuleDependency
} from '../../src/registration/index.js';

// Mock module for testing
class TestModule implements RegistrableModule {
  private _initialized = false;
  private _healthy = true;

  constructor(
    private name: string,
    private version: string = '1.0.0',
    private type: ModuleType = ModuleType.UTILITY,
    private dependencies: ModuleDependency[] = []
  ) {}

  getCapabilities(): ModuleCapabilities {
    return {
      name: this.name,
      version: this.version,
      type: this.type,
      supportedFormats: ['json'],
      features: ['test-feature'],
      dependencies: this.dependencies,
      interfaces: ['RegistrableModule']
    };
  }

  async initialize(context: ModuleContext): Promise<void> {
    this._initialized = true;
  }

  async shutdown(): Promise<void> {
    this._initialized = false;
  }

  async healthCheck(): Promise<boolean> {
    return this._healthy;
  }

  setHealthy(healthy: boolean): void {
    this._healthy = healthy;
  }

  isInitialized(): boolean {
    return this._initialized;
  }
}

describe('Dynamic Registration Framework', () => {
  describe('ModuleRegistry', () => {
    let registry: DefaultModuleRegistry;

    beforeEach(() => {
      registry = new DefaultModuleRegistry();
    });

    afterEach(async () => {
      // Clean up registered modules
      const modules = registry.getAllModules();
      for (const module of modules) {
        try {
          await registry.unregister(module.name);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    it('should register a module successfully', async () => {
      const testModule = new TestModule('test-module');
      
      await registry.register(testModule);
      
      expect(registry.isModuleRegistered('test-module')).toBe(true);
      expect(registry.getModuleStatus('test-module')).toBe(ModuleStatus.REGISTERED);
    });

    it('should prevent duplicate module registration', async () => {
      const testModule1 = new TestModule('test-module');
      const testModule2 = new TestModule('test-module');
      
      await registry.register(testModule1);
      
      await expect(registry.register(testModule2)).rejects.toThrow(
        "Module 'test-module' is already registered"
      );
    });

    it('should unregister a module successfully', async () => {
      const testModule = new TestModule('test-module');
      
      await registry.register(testModule);
      await registry.unregister('test-module');
      
      expect(registry.isModuleRegistered('test-module')).toBe(false);
      expect(registry.getModule('test-module')).toBeUndefined();
    });

    it('should initialize a registered module', async () => {
      const testModule = new TestModule('test-module');
      
      await registry.register(testModule);
      await registry.initializeModule('test-module');
      
      expect(registry.getModuleStatus('test-module')).toBe(ModuleStatus.INITIALIZED);
      expect(testModule.isInitialized()).toBe(true);
    });

    it('should get modules by type', async () => {
      const clientModule = new TestModule('client-module', '1.0.0', ModuleType.CLIENT);
      const providerModule = new TestModule('provider-module', '1.0.0', ModuleType.PROVIDER);
      
      await registry.register(clientModule);
      await registry.register(providerModule);
      
      const clientModules = registry.getModulesByType(ModuleType.CLIENT);
      const providerModules = registry.getModulesByType(ModuleType.PROVIDER);
      
      expect(clientModules).toHaveLength(1);
      expect(clientModules[0].name).toBe('client-module');
      expect(providerModules).toHaveLength(1);
      expect(providerModules[0].name).toBe('provider-module');
    });

    it('should resolve dependencies', async () => {
      const dependency = new TestModule('dependency-module');
      const mainModule = new TestModule('main-module', '1.0.0', ModuleType.UTILITY, [
        { name: 'dependency-module', type: ModuleType.UTILITY, optional: false }
      ]);
      
      await registry.register(dependency);
      await registry.register(mainModule);
      
      const resolved = await registry.resolveDependencies('main-module');
      expect(resolved).toContain('dependency-module');
    });

    it('should perform health checks', async () => {
      const healthyModule = new TestModule('healthy-module');
      const unhealthyModule = new TestModule('unhealthy-module');
      unhealthyModule.setHealthy(false);
      
      await registry.register(healthyModule);
      await registry.register(unhealthyModule);
      
      const results = await registry.performHealthChecks();
      
      expect(results.get('healthy-module')).toBe(true);
      expect(results.get('unhealthy-module')).toBe(false);
    });
  });

  describe('ModuleDiscovery', () => {
    let discovery: DefaultModuleDiscovery;

    beforeEach(() => {
      discovery = new DefaultModuleDiscovery();
    });

    it('should validate a valid module', async () => {
      const testModule = new TestModule('test-module');
      
      const result = await discovery.validateModule(testModule);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid module missing required methods', async () => {
      const invalidModule = {} as RegistrableModule;
      
      const result = await discovery.validateModule(invalidModule);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Module must implement getCapabilities() method');
      expect(result.errors).toContain('Module must implement initialize() method');
      expect(result.errors).toContain('Module must implement shutdown() method');
      expect(result.errors).toContain('Module must implement healthCheck() method');
    });
  });

  describe('DependencyResolver', () => {
    let resolver: DefaultDependencyResolver;

    beforeEach(() => {
      resolver = new DefaultDependencyResolver();
    });

    it('should resolve dependencies successfully', async () => {
      const capabilities: ModuleCapabilities = {
        name: 'test-module',
        version: '1.0.0',
        type: ModuleType.UTILITY,
        supportedFormats: ['json'],
        features: ['test'],
        dependencies: [
          { name: 'dep1', type: ModuleType.UTILITY, optional: false },
          { name: 'dep2', type: ModuleType.UTILITY, optional: true }
        ],
        interfaces: ['RegistrableModule']
      };
      
      const result = await resolver.resolveDependencies(capabilities);
      
      expect(result).toHaveProperty('resolved');
      expect(result).toHaveProperty('missing');
      expect(result).toHaveProperty('conflicts');
    });

    it('should determine correct load order', () => {
      const modules = [
        {
          name: 'module-a',
          version: '1.0.0',
          type: ModuleType.CLIENT,
          path: '/test',
          capabilities: {
            name: 'module-a',
            version: '1.0.0',
            type: ModuleType.CLIENT,
            supportedFormats: ['json'],
            features: [],
            dependencies: [{ name: 'module-b', type: ModuleType.UTILITY, optional: false }],
            interfaces: []
          },
          status: ModuleStatus.REGISTERED,
          registeredAt: new Date()
        },
        {
          name: 'module-b',
          version: '1.0.0',
          type: ModuleType.UTILITY,
          path: '/test',
          capabilities: {
            name: 'module-b',
            version: '1.0.0',
            type: ModuleType.UTILITY,
            supportedFormats: ['json'],
            features: [],
            dependencies: [],
            interfaces: []
          },
          status: ModuleStatus.REGISTERED,
          registeredAt: new Date()
        }
      ];
      
      const loadOrder = resolver.getLoadOrder(modules);
      
      expect(loadOrder.indexOf('module-b')).toBeLessThan(loadOrder.indexOf('module-a'));
    });
  });

  describe('RegistrationManager', () => {
    let manager: RegistrationManager;

    beforeEach(() => {
      manager = new RegistrationManager({
        autoDiscovery: false,
        autoInitialization: false,
        healthCheckInterval: 0 // Disable for tests
      });
    });

    afterEach(async () => {
      await manager.shutdown();
    });

    it('should initialize successfully', async () => {
      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should register and initialize a module', async () => {
      const testModule = new TestModule('test-module');
      
      await manager.initialize();
      await manager.registerModule(testModule);
      
      expect(manager.getModuleStatus('test-module')).toBe(ModuleStatus.REGISTERED);
      
      const retrievedModule = manager.getModule('test-module');
      expect(retrievedModule).toBe(testModule);
    });

    it('should unregister a module', async () => {
      const testModule = new TestModule('test-module');
      
      await manager.initialize();
      await manager.registerModule(testModule);
      await manager.unregisterModule('test-module');
      
      expect(manager.getModule('test-module')).toBeUndefined();
    });

    it('should get modules by type', async () => {
      const clientModule = new TestModule('client-module', '1.0.0', ModuleType.CLIENT);
      const providerModule = new TestModule('provider-module', '1.0.0', ModuleType.PROVIDER);
      
      await manager.initialize();
      await manager.registerModule(clientModule);
      await manager.registerModule(providerModule);
      
      const clientModules = manager.getModulesByType(ModuleType.CLIENT);
      const providerModules = manager.getModulesByType(ModuleType.PROVIDER);
      
      expect(clientModules).toHaveLength(1);
      expect(providerModules).toHaveLength(1);
    });

    it('should perform health checks', async () => {
      const testModule = new TestModule('test-module');
      
      await manager.initialize();
      await manager.registerModule(testModule);
      
      const results = await manager.performHealthChecks();
      expect(results.has('test-module')).toBe(true);
    });

    it('should shutdown gracefully', async () => {
      const testModule = new TestModule('test-module');
      
      await manager.initialize();
      await manager.registerModule(testModule);
      
      await expect(manager.shutdown()).resolves.not.toThrow();
      expect(manager.getModule('test-module')).toBeUndefined();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete module lifecycle', async () => {
      const manager = new RegistrationManager({
        autoDiscovery: false,
        autoInitialization: true,
        healthCheckInterval: 0
      });

      try {
        await manager.initialize();

        // Register modules with dependencies
        const utilityModule = new TestModule('utility', '1.0.0', ModuleType.UTILITY);
        const clientModule = new TestModule('client', '1.0.0', ModuleType.CLIENT, [
          { name: 'utility', type: ModuleType.UTILITY, optional: false }
        ]);

        await manager.registerModule(utilityModule);
        await manager.registerModule(clientModule);

        // Verify both modules are registered and initialized
        expect(manager.getModuleStatus('utility')).toBe(ModuleStatus.INITIALIZED);
        expect(manager.getModuleStatus('client')).toBe(ModuleStatus.INITIALIZED);

        // Perform health checks
        const healthResults = await manager.performHealthChecks();
        expect(healthResults.get('utility')).toBe(true);
        expect(healthResults.get('client')).toBe(true);

        // Unregister client module
        await manager.unregisterModule('client');
        expect(manager.getModule('client')).toBeUndefined();
        expect(manager.getModule('utility')).toBeDefined();

      } finally {
        await manager.shutdown();
      }
    });
  });
});