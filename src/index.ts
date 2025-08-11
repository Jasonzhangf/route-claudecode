/**
 * Main Application Entry Point with Dynamic Registration Support
 * Integrates the dynamic registration framework for module management
 */

import { MockupPipelineOrchestrator } from './pipeline/orchestrator.js';
import MockupServiceManager from './service/index.js';
import MockupConfigManager from '../config/index.js';
import { MockupDebugRecorder } from './debug/recorder.js';
import { RegistrationManager, ModuleType } from './registration/index.js';

export class Application {
  private orchestrator: MockupPipelineOrchestrator;
  private serviceManager: MockupServiceManager;
  private configManager: MockupConfigManager;
  private debugRecorder: MockupDebugRecorder;
  private registrationManager: RegistrationManager;
  private isInitialized: boolean = false;

  constructor() {
    console.log('🔧 Application initializing with dynamic registration support');
    
    this.configManager = new MockupConfigManager();
    this.serviceManager = new MockupServiceManager();
    this.debugRecorder = new MockupDebugRecorder();
    this.orchestrator = new MockupPipelineOrchestrator();
    
    // Initialize registration manager with auto-discovery
    this.registrationManager = new RegistrationManager({
      autoDiscovery: true,
      autoInitialization: true,
      healthCheckInterval: 30000 // 30 seconds
    });
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing application with dynamic registration framework');
    
    try {
      // Initialize registration manager first (discovers and registers modules)
      console.log('🔧 Initializing dynamic registration manager...');
      await this.registrationManager.initialize();
      console.log('🔧 Dynamic registration manager initialized');

      // Load configuration
      const config = await this.configManager.loadConfiguration();
      console.log('🔧 Configuration loaded');

      // Validate configuration
      const validation = await this.configManager.validateConfiguration(config);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }
      console.log('🔧 Configuration validated');

      // Initialize debug recorder
      await this.debugRecorder.loadFromDatabase();
      console.log('🔧 Debug recorder initialized');

      // Initialize pipeline orchestrator with registered modules
      await this.orchestrator.initialize(config);
      console.log('🔧 Pipeline orchestrator initialized');

      // Verify all critical modules are registered and healthy
      await this.verifyModuleHealth();

      this.isInitialized = true;
      console.log('🔧 Application initialization complete with dynamic registration');
    } catch (error) {
      console.error('🔧 Application initialization failed:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log('🔧 MOCKUP: Starting application services - placeholder implementation');
    
    const results = await this.serviceManager.startAllServices();
    const failedServices = results.filter(r => !r.success);
    
    if (failedServices.length > 0) {
      console.error('🔧 MOCKUP: Some services failed to start:', failedServices);
      throw new Error(`Failed to start services: ${failedServices.map(s => s.message).join(', ')}`);
    }

    console.log('🔧 MOCKUP: All services started successfully');
    console.log('🔧 MOCKUP: Application is ready to process requests');
  }

  async stop(): Promise<void> {
    console.log('🔧 Stopping application with dynamic registration cleanup');
    
    await this.serviceManager.stopAllServices();
    await this.debugRecorder.saveToDatabase();
    
    // Shutdown registration manager (unregisters all modules)
    await this.registrationManager.shutdown();
    
    console.log('🔧 Application stopped successfully');
  }

  async processRequest(request: any): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Application not initialized');
    }

    console.log('🔧 MOCKUP: Processing request through pipeline - placeholder implementation');
    
    return await this.orchestrator.processRequest(request);
  }

  async getHealthStatus(): Promise<any> {
    const serviceHealth = await this.serviceManager.healthCheck();
    const orchestratorHealth = await this.orchestrator.getHealthStatus();
    const moduleHealth = await this.registrationManager.performHealthChecks();
    
    // Convert module health to summary
    const moduleHealthSummary = {
      total: moduleHealth.size,
      healthy: Array.from(moduleHealth.values()).filter(h => h).length,
      unhealthy: Array.from(moduleHealth.values()).filter(h => !h).length,
      modules: Object.fromEntries(moduleHealth)
    };
    
    const overallHealthy = serviceHealth.overall === 'healthy' && 
                          orchestratorHealth.healthy && 
                          moduleHealthSummary.unhealthy === 0;
    
    return {
      overall: overallHealthy ? 'healthy' : 'unhealthy',
      services: serviceHealth.services,
      pipeline: orchestratorHealth,
      modules: moduleHealthSummary,
      registeredModules: this.getRegisteredModulesSummary(),
      timestamp: new Date()
    };
  }

  getVersion(): string {
    return '1.0.0';
  }

  // Dynamic registration specific methods
  getRegistrationManager(): RegistrationManager {
    return this.registrationManager;
  }

  getRegisteredModulesSummary(): any {
    const allModules = this.registrationManager.getAllModules();
    const modulesByType: Record<string, number> = {};
    
    for (const module of allModules) {
      const capabilities = module.getCapabilities();
      modulesByType[capabilities.type] = (modulesByType[capabilities.type] || 0) + 1;
    }
    
    return {
      total: allModules.length,
      byType: modulesByType,
      names: allModules.map(m => m.getCapabilities().name)
    };
  }

  private async verifyModuleHealth(): Promise<void> {
    console.log('🔧 Verifying module health...');
    
    const healthResults = await this.registrationManager.performHealthChecks();
    const unhealthyModules = Array.from(healthResults.entries())
      .filter(([_, healthy]) => !healthy)
      .map(([name, _]) => name);
    
    if (unhealthyModules.length > 0) {
      console.warn(`🔧 Warning: ${unhealthyModules.length} modules are unhealthy:`, unhealthyModules);
    } else {
      console.log('🔧 All registered modules are healthy');
    }
    
    // Log module summary
    const summary = this.getRegisteredModulesSummary();
    console.log(`🔧 Registered ${summary.total} modules:`, summary.byType);
  }
}

// Export main application instance
export const app = new Application();

// Export individual components for testing
export {
  MockupPipelineOrchestrator,
  MockupServiceManager,
  MockupConfigManager,
  MockupDebugRecorder
};

// Dynamic registration framework integrated
console.log('🔧 Main application module loaded with dynamic registration support');