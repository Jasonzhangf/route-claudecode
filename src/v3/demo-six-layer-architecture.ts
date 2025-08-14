#!/usr/bin/env node

/**
 * Six-Layer Architecture Demo
 * Demonstrates the complete six-layer processing pipeline
 * @author Jason Zhang
 * @version v3.0-refactor
 */

import { SixLayerArchitecture } from './shared/six-layer-architecture.js';

async function runSixLayerDemo() {
  console.log('🎯 Six-Layer Architecture Demo Starting...\n');

  try {
    // Initialize the architecture
    const architecture = new SixLayerArchitecture();
    
    await architecture.initializeArchitecture({
      client: {
        authenticationEnabled: true,
        rateLimitEnabled: true,
        corsEnabled: true
      },
      router: {
        routingConfig: {
          categories: {
            default: {
              // 注意：这些是DEMO示例值，生产环境必须从外部配置加载
              providers: ['demo-provider-1', 'demo-provider-2'],
              models: ['demo-model-1', 'demo-model-2'],
              priority: 1
            }
          },
          defaultCategory: 'default',
          loadBalancing: {
            strategy: 'round-robin',
            healthCheckEnabled: true
          }
        }
      }
    });

    console.log('\n📊 Architecture Status:', architecture.getArchitectureStatus());

    // Perform health check
    console.log('\n🏥 Performing health check...');
    const healthCheck = await architecture.performHealthCheck();
    console.log('Health Check Result:', healthCheck);

    // Demo request
    const demoRequest = {
      method: 'POST',
      path: '/v1/chat/completions',
      headers: {
        'authorization': 'Bearer sk-test-token-12345',
        'content-type': 'application/json'
      },
      body: {
        model: 'claude-3-sonnet-20240229',
        messages: [
          { role: 'user', content: 'Hello, this is a test of the six-layer architecture!' }
        ],
        max_tokens: 1000
      }
    };

    console.log('\n🔄 Processing demo request...');
    const result = await architecture.processRequest(demoRequest);

    console.log('\n✅ Final Result Structure:');
    console.log(JSON.stringify({
      clientLayerProcessed: result.clientLayerProcessed,
      routerLayerProcessed: result.routerLayerProcessed,
      postProcessorLayerProcessed: result.postProcessorLayerProcessed,
      transformerLayerProcessed: result.transformerLayerProcessed,
      providerProtocolLayerProcessed: result.providerProtocolLayerProcessed,
      preprocessorLayerProcessed: result.preprocessorLayerProcessed,
      serverLayerProcessed: result.serverLayerProcessed,
      finalResponse: result.finalResponse,
      routingDecision: result.routingDecision
    }, null, 2));

    console.log('\n🎉 Six-Layer Architecture Demo Completed Successfully!');

  } catch (error) {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSixLayerDemo().catch(console.error);
}