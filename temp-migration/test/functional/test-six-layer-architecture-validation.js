#!/usr/bin/env node

/**
 * Six-Layer Architecture Validation Test
 * Validates the complete six-layer architecture implementation
 * @author Jason Zhang
 * @version v3.0-refactor
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SixLayerArchitectureValidationTest {
  constructor() {
    this.testResults = {
      sessionId: `six-layer-validation-${Date.now()}`,
      timestamp: new Date().toISOString(),
      testType: 'six-layer-architecture-validation',
      results: [],
      summary: {}
    };
  }

  /**
   * Main test execution
   */
  async runValidation() {
    console.log('🏗️  Six-Layer Architecture Validation Test');
    console.log('============================================');
    console.log(`Session ID: ${this.testResults.sessionId}\n`);

    try {
      // Test 1: Validate directory structure
      await this.validateDirectoryStructure();

      // Test 2: Validate layer interfaces
      await this.validateLayerInterfaces();

      // Test 3: Validate layer implementations
      await this.validateLayerImplementations();

      // Test 4: Validate dynamic registration system
      await this.validateDynamicRegistration();

      // Test 5: Validate processing pipeline
      await this.validateProcessingPipeline();

      // Generate summary
      this.generateSummary();

      // Save results
      await this.saveResults();

      console.log('\n✅ Six-Layer Architecture Validation Completed Successfully!');
      console.log(`📊 Results: ${this.testResults.summary.passed}/${this.testResults.summary.total} tests passed`);

      if (this.testResults.summary.failed > 0) {
        process.exit(1);
      }

    } catch (error) {
      console.error('\n❌ Validation failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test 1: Validate directory structure
   */
  async validateDirectoryStructure() {
    console.log('📁 Test 1: Validating directory structure...');

    const requiredDirectories = [
      'src/v3/client',
      'src/v3/router',
      'src/v3/post-processor',
      'src/v3/transformer',
      'src/v3/provider-protocol',
      'src/v3/preprocessor',
      'src/v3/server',
      'src/v3/shared'
    ];

    const projectRoot = path.resolve(__dirname, '../..');
    let allExists = true;
    const missingDirs = [];

    for (const dir of requiredDirectories) {
      const fullPath = path.join(projectRoot, dir);
      try {
        await fs.access(fullPath);
        console.log(`   ✅ ${dir} - exists`);
      } catch (error) {
        console.log(`   ❌ ${dir} - missing`);
        allExists = false;
        missingDirs.push(dir);
      }
    }

    this.testResults.results.push({
      test: 'directory-structure',
      status: allExists ? 'passed' : 'failed',
      details: {
        requiredDirectories: requiredDirectories.length,
        existingDirectories: requiredDirectories.length - missingDirs.length,
        missingDirectories: missingDirs
      }
    });

    if (!allExists) {
      throw new Error(`Missing required directories: ${missingDirs.join(', ')}`);
    }
  }

  /**
   * Test 2: Validate layer interfaces
   */
  async validateLayerInterfaces() {
    console.log('\n🔌 Test 2: Validating layer interfaces...');

    const requiredFiles = [
      'src/v3/shared/layer-interface.ts',
      'src/v3/shared/six-layer-architecture.ts',
      'src/v3/client/client-layer.ts',
      'src/v3/router/router-layer.ts',
      'src/v3/post-processor/post-processor-layer.ts',
      'src/v3/transformer/transformer-layer.ts',
      'src/v3/provider-protocol/provider-protocol-layer.ts',
      'src/v3/preprocessor/preprocessor-layer.ts',
      'src/v3/server/server-layer.ts'
    ];

    const projectRoot = path.resolve(__dirname, '../..');
    let allExists = true;
    const missingFiles = [];

    for (const file of requiredFiles) {
      const fullPath = path.join(projectRoot, file);
      try {
        await fs.access(fullPath);
        
        // Check file content for key interfaces
        const content = await fs.readFile(fullPath, 'utf-8');
        
        if (file.includes('layer-interface.ts')) {
          if (!content.includes('LayerInterface') || !content.includes('LayerRegistry')) {
            throw new Error(`${file} missing required interfaces`);
          }
        }
        
        if (file.includes('-layer.ts') && !file.includes('layer-interface.ts')) {
          if (!content.includes('BaseLayer') && !content.includes('LayerInterface')) {
            throw new Error(`${file} missing layer implementation`);
          }
        }
        
        console.log(`   ✅ ${file} - valid`);
      } catch (error) {
        console.log(`   ❌ ${file} - ${error.message}`);
        allExists = false;
        missingFiles.push(file);
      }
    }

    this.testResults.results.push({
      test: 'layer-interfaces',
      status: allExists ? 'passed' : 'failed',
      details: {
        requiredFiles: requiredFiles.length,
        validFiles: requiredFiles.length - missingFiles.length,
        invalidFiles: missingFiles
      }
    });

    if (!allExists) {
      throw new Error(`Invalid layer interface files: ${missingFiles.join(', ')}`);
    }
  }

  /**
   * Test 3: Validate layer implementations
   */
  async validateLayerImplementations() {
    console.log('\n⚙️  Test 3: Validating layer implementations...');

    try {
      // Try to import the main architecture file
      const architectureModule = await import('../../src/v3/shared/six-layer-architecture.js');
      
      const requiredExports = [
        'LayerInterface',
        'LayerRegistry',
        'globalLayerRegistry',
        'BaseLayer',
        'ClientLayer',
        'RouterLayer',
        'PostProcessorLayer',
        'TransformerLayer',
        'ProviderProtocolLayer',
        'PreprocessorLayer',
        'ServerLayer',
        'SixLayerArchitecture'
      ];

      let allExported = true;
      const missingExports = [];

      for (const exportName of requiredExports) {
        if (architectureModule[exportName]) {
          console.log(`   ✅ ${exportName} - exported`);
        } else {
          console.log(`   ❌ ${exportName} - missing`);
          allExported = false;
          missingExports.push(exportName);
        }
      }

      this.testResults.results.push({
        test: 'layer-implementations',
        status: allExported ? 'passed' : 'failed',
        details: {
          requiredExports: requiredExports.length,
          availableExports: requiredExports.length - missingExports.length,
          missingExports
        }
      });

      if (!allExported) {
        throw new Error(`Missing exports: ${missingExports.join(', ')}`);
      }

    } catch (error) {
      this.testResults.results.push({
        test: 'layer-implementations',
        status: 'failed',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Test 4: Validate dynamic registration system
   */
  async validateDynamicRegistration() {
    console.log('\n🔄 Test 4: Validating dynamic registration system...');

    try {
      const { LayerRegistry, ClientLayer } = await import('../../src/v3/shared/six-layer-architecture.js');
      
      // Create registry
      const registry = new LayerRegistry();
      
      // Create and register a layer
      const clientLayer = new ClientLayer();
      await registry.registerLayer(clientLayer);
      
      // Verify registration
      const registeredLayer = registry.getLayer('client-layer');
      if (!registeredLayer) {
        throw new Error('Layer registration failed');
      }
      
      // Verify layer type indexing
      const clientLayers = registry.getLayersByType('client');
      if (clientLayers.length !== 1) {
        throw new Error('Layer type indexing failed');
      }
      
      // Verify processing order
      const processingOrder = registry.getProcessingOrder();
      if (!Array.isArray(processingOrder)) {
        throw new Error('Processing order generation failed');
      }
      
      // Cleanup
      await registry.unregisterLayer('client-layer');
      
      console.log('   ✅ Layer registration - working');
      console.log('   ✅ Layer retrieval - working');
      console.log('   ✅ Type indexing - working');
      console.log('   ✅ Processing order - working');
      console.log('   ✅ Layer cleanup - working');

      this.testResults.results.push({
        test: 'dynamic-registration',
        status: 'passed',
        details: {
          registrationTest: 'passed',
          retrievalTest: 'passed',
          indexingTest: 'passed',
          processingOrderTest: 'passed',
          cleanupTest: 'passed'
        }
      });

    } catch (error) {
      this.testResults.results.push({
        test: 'dynamic-registration',
        status: 'failed',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Test 5: Validate processing pipeline
   */
  async validateProcessingPipeline() {
    console.log('\n🔄 Test 5: Validating processing pipeline...');

    try {
      const { SixLayerArchitecture } = await import('../../src/v3/shared/six-layer-architecture.js');
      
      // Create architecture
      const architecture = new SixLayerArchitecture();
      
      // Initialize with minimal config
      await architecture.initializeArchitecture({
        client: { authenticationEnabled: false },
        router: {
          routingConfig: {
            categories: {
              default: {
                providers: ['test-provider'],
                models: ['test-model'],
                priority: 1
              }
            },
            defaultCategory: 'default',
            loadBalancing: {
              strategy: 'round-robin',
              healthCheckEnabled: false,
              fallbackEnabled: false
            }
          }
        }
      });
      
      // Get status
      const status = architecture.getArchitectureStatus();
      if (status.layersRegistered !== 7) {
        throw new Error(`Expected 7 layers, got ${status.layersRegistered}`);
      }
      
      // Perform health check
      const healthCheck = await architecture.performHealthCheck();
      if (!healthCheck.healthy) {
        throw new Error('Architecture health check failed');
      }
      
      // Process test request
      const testRequest = {
        method: 'POST',
        path: '/test',
        headers: {},
        body: { test: 'data' }
      };
      
      const result = await architecture.processRequest(testRequest);
      
      // Verify all layers processed the request
      const requiredProcessingFlags = [
        'clientLayerProcessed',
        'routerLayerProcessed',
        'postProcessorLayerProcessed',
        'transformerLayerProcessed',
        'providerProtocolLayerProcessed',
        'preprocessorLayerProcessed',
        'serverLayerProcessed'
      ];
      
      for (const flag of requiredProcessingFlags) {
        if (!result[flag]) {
          throw new Error(`Missing processing flag: ${flag}`);
        }
      }
      
      console.log('   ✅ Architecture initialization - working');
      console.log('   ✅ Layer registration (7 layers) - working');
      console.log('   ✅ Health check - working');
      console.log('   ✅ Request processing pipeline - working');
      console.log('   ✅ All layer processing flags - working');

      this.testResults.results.push({
        test: 'processing-pipeline',
        status: 'passed',
        details: {
          layersRegistered: status.layersRegistered,
          healthCheck: healthCheck.healthy,
          processingFlags: requiredProcessingFlags.length,
          pipelineComplete: true
        }
      });

    } catch (error) {
      this.testResults.results.push({
        test: 'processing-pipeline',
        status: 'failed',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate test summary
   */
  generateSummary() {
    const total = this.testResults.results.length;
    const passed = this.testResults.results.filter(r => r.status === 'passed').length;
    const failed = total - passed;

    this.testResults.summary = {
      total,
      passed,
      failed,
      successRate: total > 0 ? Math.round((passed / total) * 100) : 0
    };
  }

  /**
   * Save test results
   */
  async saveResults() {
    const outputDir = path.join(__dirname, '../output/functional');
    await fs.mkdir(outputDir, { recursive: true });
    
    const outputFile = path.join(outputDir, `${this.testResults.sessionId}.json`);
    await fs.writeFile(outputFile, JSON.stringify(this.testResults, null, 2));
    
    console.log(`\n📄 Results saved: ${outputFile}`);
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new SixLayerArchitectureValidationTest();
  test.runValidation().catch(console.error);
}

export { SixLayerArchitectureValidationTest };