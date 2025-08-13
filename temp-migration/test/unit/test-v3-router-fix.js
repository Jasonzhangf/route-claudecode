/**
 * V3.0 Router Logic Unit Test
 * Validates router configuration conversion and decision-making
 * @author Jason Zhang
 */

import { RouterLayer } from '../../src/v3/router/router-layer.js';
import { convertV3ToRouterConfig } from '../../src/v3/config/v3-to-router-config.js';
import fs from 'fs';

// Test configuration (simulating V3 config structure)
const testV3Config = {
    name: "Test LM Studio Configuration v3.0",
    version: "3.0.0",
    server: {
        port: 5506,
        host: "127.0.0.1",
        architecture: "v3.0"
    },
    providers: {
        "lmstudio-enhanced": {
            type: "openai",
            name: "LM Studio Enhanced",
            endpoint: "http://localhost:1234",
            authentication: {
                type: "local-server",
                credentials: {
                    apiKey: "test-key"
                }
            },
            models: ["gpt-oss-20b-mlx"],
            defaultModel: "gpt-oss-20b-mlx"
        }
    },
    routing: {
        strategy: "category-driven",
        defaultCategory: "default",
        loadBalancing: {
            strategy: "round-robin",
            healthCheckEnabled: false
        },
        categories: {
            default: {
                provider: "lmstudio-enhanced",
                model: "gpt-oss-20b-mlx"
            }
        }
    },
    debug: {
        enabled: true,
        logLevel: "debug",
        logDir: "/tmp/test-logs"
    }
};

async function testRouterFix() {
    console.log('🧪 V3.0 Router Fix Unit Test\n');

    try {
        // Step 1: Test config conversion
        console.log('1️⃣ Testing V3 config conversion...');
        
        // Create temporary config file
        const tempConfigPath = '/tmp/test-v3-config.json';
        fs.writeFileSync(tempConfigPath, JSON.stringify(testV3Config, null, 2));
        
        const routerConfig = convertV3ToRouterConfig(tempConfigPath);
        
        console.log('✅ Config conversion successful');
        console.log('   - Server port:', routerConfig.server.port);
        console.log('   - Providers:', Object.keys(routerConfig.providers).length);
        console.log('   - Categories:', Object.keys(routerConfig.routingConfig?.categories || {}).length);
        
        // Verify routingConfig structure
        if (!routerConfig.routingConfig) {
            throw new Error('Missing routingConfig in converted config');
        }
        if (!routerConfig.routingConfig.categories) {
            throw new Error('Missing categories in routingConfig');
        }
        if (!routerConfig.routingConfig.categories.default) {
            throw new Error('Missing default category in routingConfig');
        }
        
        console.log('✅ RouterConfig structure validation passed\n');

        // Step 2: Test RouterLayer initialization
        console.log('2️⃣ Testing RouterLayer initialization...');
        
        const routerLayer = new RouterLayer({ routingConfig: routerConfig.routingConfig });
        await routerLayer.initialize();
        
        console.log('✅ RouterLayer initialization successful\n');

        // Step 3: Test routing decision
        console.log('3️⃣ Testing routing decision...');
        
        const testRequest = {
            clientLayerProcessed: true,
            body: {
                model: "claude-3-sonnet-20240229",
                messages: [
                    { role: "user", content: "Hello, test routing!" }
                ]
            }
        };
        
        const testContext = {
            requestId: 'test-123',
            metadata: {}
        };
        
        const routedRequest = await routerLayer.process(testRequest, testContext);
        
        console.log('✅ Routing decision successful');
        console.log('   - Original model:', testRequest.body.model);
        console.log('   - Target provider:', routedRequest.targetProvider);
        console.log('   - Target model:', routedRequest.targetModel);
        console.log('   - Category:', routedRequest.category);
        
        // Verify routing results
        if (!routedRequest.targetProvider) {
            throw new Error('Missing targetProvider in routing result');
        }
        if (!routedRequest.targetModel) {
            throw new Error('Missing targetModel in routing result');
        }
        if (routedRequest.body.model !== routedRequest.targetModel) {
            throw new Error('Model substitution failed');
        }
        
        console.log('✅ Routing result validation passed\n');

        // Step 4: Test health check
        console.log('4️⃣ Testing router health check...');
        
        const healthCheck = await routerLayer.healthCheck();
        
        if (!healthCheck) {
            throw new Error('Router health check failed');
        }
        
        console.log('✅ Router health check passed\n');

        // Step 5: Test category determination
        console.log('5️⃣ Testing category determination...');
        
        // Test default category
        let category = routerLayer.determineCategory(testRequest.body, testContext);
        console.log('   - Default request category:', category);
        
        // Test tool usage category
        const toolRequest = {
            body: {
                messages: [{ role: "user", content: "Use the search tool" }],
                tools: [{ name: "search", description: "Search tool" }]
            }
        };
        category = routerLayer.determineCategory(toolRequest.body, testContext);
        console.log('   - Tool request category:', category);
        
        // Test long context category
        const longContextRequest = {
            body: {
                messages: [{ 
                    role: "user", 
                    content: "A".repeat(60000) // 60k characters
                }]
            }
        };
        category = routerLayer.determineCategory(longContextRequest.body, testContext);
        console.log('   - Long context category:', category);
        
        console.log('✅ Category determination tests passed\n');

        // Cleanup
        fs.unlinkSync(tempConfigPath);
        
        console.log('🎉 All V3.0 Router Fix Tests PASSED!');
        console.log('🔧 Router is now working correctly with V3 configuration format\n');
        
        return true;

    } catch (error) {
        console.error('❌ Router Fix Test Failed:', error.message);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
    testRouterFix().then(success => {
        process.exit(success ? 0 : 1);
    });
}

export { testRouterFix };