/**
 * Dynamic Registration Framework Demo
 * Demonstrates how to use the registration system
 */

import { RegistrationManager, ModuleType } from './index.js';
import { ProviderLayer } from '../provider/index.js';
import { BaseLayer } from '../types/base-layer.js';
import { ProcessingContext } from '../types/interfaces.js';

// Example custom module
class CustomUtilityModule extends BaseLayer {
  constructor() {
    super('custom-utility', '1.0.0', [], ModuleType.UTILITY);
  }

  protected getSupportedFormats(): string[] {
    return ['json', 'xml', 'yaml'];
  }

  protected getFeatures(): string[] {
    return ['data-transformation', 'validation', 'caching'];
  }

  async process(input: any, context: ProcessingContext): Promise<any> {
    console.log('🔧 CustomUtilityModule: Processing data');
    return {
      ...input,
      processedBy: 'custom-utility',
      timestamp: new Date().toISOString()
    };
  }

  protected async performHealthCheck(): Promise<boolean> {
    console.log('🔧 CustomUtilityModule: Health check passed');
    return true;
  }
}

async function demonstrateRegistrationFramework() {
  console.log('\n🚀 Starting Dynamic Registration Framework Demo\n');

  // Create registration manager
  const manager = new RegistrationManager({
    autoDiscovery: false, // Disable for demo
    autoInitialization: true,
    healthCheckInterval: 5000 // 5 seconds
  });

  try {
    // Initialize the registration manager
    console.log('📋 Initializing Registration Manager...');
    await manager.initialize();

    // Register modules manually
    console.log('\n📦 Registering modules...');
    
    const utilityModule = new CustomUtilityModule();
    const providerLayer = new ProviderLayer();

    await manager.registerModule(utilityModule);
    console.log('✅ Custom utility module registered');

    await manager.registerModule(providerLayer);
    console.log('✅ Provider layer registered');

    // Check module status
    console.log('\n📊 Module Status:');
    console.log(`- Custom Utility: ${manager.getModuleStatus('custom-utility')}`);
    console.log(`- Provider Layer: ${manager.getModuleStatus('provider')}`);

    // Get modules by type
    console.log('\n🔍 Modules by Type:');
    const utilityModules = manager.getModulesByType(ModuleType.UTILITY);
    const providerModules = manager.getModulesByType(ModuleType.PROVIDER);
    
    console.log(`- Utility modules: ${utilityModules.length}`);
    console.log(`- Provider modules: ${providerModules.length}`);

    // Perform health checks
    console.log('\n🏥 Performing Health Checks...');
    const healthResults = await manager.performHealthChecks();
    
    for (const [moduleName, healthy] of healthResults) {
      console.log(`- ${moduleName}: ${healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    }

    // Test module functionality
    console.log('\n🧪 Testing Module Functionality...');
    
    const testContext: ProcessingContext = {
      requestId: 'demo-request-123',
      timestamp: new Date(),
      metadata: { demo: true },
      debugEnabled: true
    };

    const testInput = {
      message: 'Hello from dynamic registration demo',
      data: { test: true }
    };

    // Test utility module
    const utilityResult = await utilityModule.process(testInput, testContext);
    console.log('🔧 Utility module result:', JSON.stringify(utilityResult, null, 2));

    // Test provider layer
    const providerResult = await providerLayer.process(testInput, testContext);
    console.log('🔧 Provider layer result:', JSON.stringify(providerResult, null, 2));

    // Demonstrate module discovery (if we had real modules to discover)
    console.log('\n🔍 Module Discovery Demo:');
    console.log('In a real scenario, the framework would:');
    console.log('- Scan configured directories for modules');
    console.log('- Validate module interfaces');
    console.log('- Resolve dependencies automatically');
    console.log('- Register and initialize modules in correct order');

    // Wait a bit to see health checks in action
    console.log('\n⏳ Waiting 10 seconds to demonstrate health monitoring...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n✅ Demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    // Clean shutdown
    console.log('\n🛑 Shutting down Registration Manager...');
    await manager.shutdown();
    console.log('✅ Shutdown completed');
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateRegistrationFramework().catch(console.error);
}

export { demonstrateRegistrationFramework };