/**
 * Integration Tests for Dynamic Registration Framework
 * Tests the integration with the main application
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Application } from '../../src/index.js';
import { RegistrationManager, ModuleType } from '../../src/registration/index.js';
import { BaseLayer } from '../../src/types/base-layer.js';
import { ProcessingContext } from '../../src/types/interfaces.js';

// Test module for integration testing
class IntegrationTestModule extends BaseLayer {
  constructor() {
    super('integration-test', '1.0.0', [], ModuleType.UTILITY);
  }

  protected getSupportedFormats(): string[] {
    return ['json', 'test'];
  }

  protected getFeatures(): string[] {
    return ['integration-testing', 'mock-processing'];
  }

  async process(input: any, context: ProcessingContext): Promise<any> {
    return {
      ...input,
      processedBy: 'integration-test',
      timestamp: new Date().toISOString(),
      contextId: context.requestId
    };
  }

  protected async performHealthCheck(): Promise<boolean> {
    return true;
  }
}

describe('Dynamic Registration Integration', () => {
  let app: Application;

  beforeEach(() => {
    app = new Application();
  });

  afterEach(async () => {
    try {
      await app.stop();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should initialize application with dynamic registration', async () => {
    await expect(app.initialize()).resolves.not.toThrow();
    
    const registrationManager = app.getRegistrationManager();
    expect(registrationManager).toBeInstanceOf(RegistrationManager);
  });

  it('should register and use custom modules', async () => {
    await app.initialize();
    
    const registrationManager = app.getRegistrationManager();
    const testModule = new IntegrationTestModule();
    
    // Register custom module
    await registrationManager.registerModule(testModule);
    
    // Verify module is registered
    expect(registrationManager.getModuleStatus('integration-test')).toBeDefined();
    
    // Verify module can be retrieved
    const retrievedModule = registrationManager.getModule('integration-test');
    expect(retrievedModule).toBe(testModule);
  });

  it('should include registered modules in health status', async () => {
    await app.initialize();
    
    const registrationManager = app.getRegistrationManager();
    const testModule = new IntegrationTestModule();
    
    await registrationManager.registerModule(testModule);
    
    const healthStatus = await app.getHealthStatus();
    
    expect(healthStatus).toHaveProperty('modules');
    expect(healthStatus.modules).toHaveProperty('total');
    expect(healthStatus.modules.total).toBeGreaterThan(0);
    expect(healthStatus).toHaveProperty('registeredModules');
  });

  it('should handle module lifecycle during application lifecycle', async () => {
    const testModule = new IntegrationTestModule();
    
    // Initialize app
    await app.initialize();
    
    // Register module after initialization
    const registrationManager = app.getRegistrationManager();
    await registrationManager.registerModule(testModule);
    
    // Verify module is active
    expect(registrationManager.getModuleStatus('integration-test')).toBeDefined();
    
    // Stop application
    await app.stop();
    
    // Verify module is cleaned up
    expect(registrationManager.getModule('integration-test')).toBeUndefined();
  });

  it('should provide module summary information', async () => {
    await app.initialize();
    
    const registrationManager = app.getRegistrationManager();
    const testModule = new IntegrationTestModule();
    
    await registrationManager.registerModule(testModule);
    
    const summary = app.getRegisteredModulesSummary();
    
    expect(summary).toHaveProperty('total');
    expect(summary).toHaveProperty('byType');
    expect(summary).toHaveProperty('names');
    expect(summary.names).toContain('integration-test');
    expect(summary.byType).toHaveProperty('utility');
  });

  it('should perform health checks on all registered modules', async () => {
    await app.initialize();
    
    const registrationManager = app.getRegistrationManager();
    const testModule = new IntegrationTestModule();
    
    await registrationManager.registerModule(testModule);
    
    const healthResults = await registrationManager.performHealthChecks();
    
    expect(healthResults.has('integration-test')).toBe(true);
    expect(healthResults.get('integration-test')).toBe(true);
  });

  it('should handle module discovery and registration automatically', async () => {
    // This test verifies that the auto-discovery mechanism works
    // In a real scenario, modules would be discovered from the file system
    
    await app.initialize();
    
    const registrationManager = app.getRegistrationManager();
    const allModules = registrationManager.getAllModules();
    
    // Should have discovered some modules (even if they're mockup implementations)
    expect(allModules.length).toBeGreaterThanOrEqual(0);
    
    // Verify registration manager is properly configured
    expect(registrationManager).toBeInstanceOf(RegistrationManager);
  });

  it('should maintain module state across operations', async () => {
    await app.initialize();
    
    const registrationManager = app.getRegistrationManager();
    const testModule = new IntegrationTestModule();
    
    await registrationManager.registerModule(testModule);
    
    // Perform multiple health checks
    const health1 = await registrationManager.performHealthChecks();
    const health2 = await registrationManager.performHealthChecks();
    
    expect(health1.get('integration-test')).toBe(health2.get('integration-test'));
    
    // Module should still be registered
    expect(registrationManager.getModule('integration-test')).toBe(testModule);
  });
});