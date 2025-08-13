#!/bin/bash

# V3.0 Router Fix Test Script
# Tests the V3 router configuration and logic fixes
# Author: Jason Zhang

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 V3.0 Router Fix Test Suite${NC}"
echo "=================================="

# Step 1: Check if we have a recent build
echo -e "${BLUE}1️⃣ Checking project build status...${NC}"

if [ ! -d "dist" ] || [ ! -f "dist/v3/config/v3-to-router-config.js" ]; then
    echo -e "${YELLOW}⚠️ Build artifacts not found, building project...${NC}"
    npm run build
    echo -e "${GREEN}✅ Build completed${NC}"
else
    echo -e "${GREEN}✅ Build artifacts exist${NC}"
fi

# Step 2: Test config conversion
echo -e "${BLUE}2️⃣ Testing V3 config conversion...${NC}"

# Create a test config
TEST_CONFIG="/tmp/test-v3-config.json"
cat > "$TEST_CONFIG" << 'EOF'
{
    "name": "Test V3 Configuration",
    "version": "3.0.0",
    "server": {
        "port": 5506,
        "host": "127.0.0.1"
    },
    "providers": {
        "lmstudio-test": {
            "type": "openai",
            "name": "LM Studio Test",
            "endpoint": "http://localhost:1234",
            "authentication": {
                "type": "local-server",
                "credentials": {
                    "apiKey": "test-key"
                }
            },
            "models": ["test-model-20b"],
            "defaultModel": "test-model-20b"
        }
    },
    "routing": {
        "strategy": "category-driven",
        "defaultCategory": "default",
        "loadBalancing": {
            "strategy": "round-robin",
            "healthCheckEnabled": false
        },
        "categories": {
            "default": {
                "provider": "lmstudio-test",
                "model": "test-model-20b"
            },
            "background": {
                "provider": "lmstudio-test", 
                "model": "test-model-20b"
            }
        }
    },
    "debug": {
        "enabled": true,
        "logLevel": "debug",
        "logDir": "/tmp/test-logs"
    }
}
EOF

echo "📋 Created test V3 config at: $TEST_CONFIG"

# Step 3: Test the conversion directly using Node.js
echo -e "${BLUE}3️⃣ Testing config conversion with Node.js...${NC}"

cat > "/tmp/test-config-conversion.js" << 'EOF'
import { convertV3ToRouterConfig } from './dist/v3/config/v3-to-router-config.js';

const testConfigPath = '/tmp/test-v3-config.json';

try {
    console.log('🔄 Starting config conversion test...');
    
    const routerConfig = convertV3ToRouterConfig(testConfigPath);
    
    console.log('✅ Config conversion successful!');
    console.log('📊 Server port:', routerConfig.server.port);
    console.log('📊 Providers:', Object.keys(routerConfig.providers).length);
    console.log('📊 Routing structure check:');
    
    // Check routing structure
    if (routerConfig.routingConfig) {
        console.log('  ✅ routingConfig exists');
        
        if (routerConfig.routingConfig.categories) {
            console.log('  ✅ routingConfig.categories exists');
            console.log('  📋 Categories:', Object.keys(routerConfig.routingConfig.categories));
            
            // Check default category
            if (routerConfig.routingConfig.categories.default) {
                const defaultConfig = routerConfig.routingConfig.categories.default;
                console.log('  ✅ default category exists');
                console.log('  📋 Default provider:', defaultConfig.provider);
                console.log('  📋 Default model:', defaultConfig.model);
            } else {
                console.error('  ❌ default category missing!');
                process.exit(1);
            }
        } else {
            console.error('  ❌ routingConfig.categories missing!');
            process.exit(1);
        }
        
        if (routerConfig.routingConfig.defaultCategory) {
            console.log('  ✅ defaultCategory:', routerConfig.routingConfig.defaultCategory);
        } else {
            console.error('  ❌ defaultCategory missing!');
            process.exit(1);
        }
        
        if (routerConfig.routingConfig.loadBalancing) {
            console.log('  ✅ loadBalancing exists');
            console.log('  📋 Strategy:', routerConfig.routingConfig.loadBalancing.strategy);
        } else {
            console.error('  ❌ loadBalancing missing!');
            process.exit(1);
        }
    } else {
        console.error('❌ routingConfig missing from converted config!');
        process.exit(1);
    }
    
    console.log('🎉 Config conversion validation passed!');
    
} catch (error) {
    console.error('❌ Config conversion failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}
EOF

# Run the config conversion test
node "/tmp/test-config-conversion.js"

echo -e "${GREEN}✅ Config conversion test passed${NC}"

# Step 4: Test RouterLayer directly
echo -e "${BLUE}4️⃣ Testing RouterLayer functionality...${NC}"

cat > "/tmp/test-router-layer.js" << 'EOF'
import { RouterLayer } from './dist/v3/router/router-layer.js';
import { convertV3ToRouterConfig } from './dist/v3/config/v3-to-router-config.js';

const testConfigPath = '/tmp/test-v3-config.json';

try {
    console.log('🔄 Starting RouterLayer test...');
    
    // Convert config
    const routerConfig = convertV3ToRouterConfig(testConfigPath);
    console.log('✅ Config converted');
    
    // Create RouterLayer instance
    const routerLayer = new RouterLayer({ routingConfig: routerConfig.routingConfig });
    console.log('✅ RouterLayer created');
    
    // Initialize
    await routerLayer.initialize();
    console.log('✅ RouterLayer initialized');
    
    // Test health check
    const healthCheck = await routerLayer.healthCheck();
    if (healthCheck) {
        console.log('✅ RouterLayer health check passed');
    } else {
        console.error('❌ RouterLayer health check failed');
        process.exit(1);
    }
    
    // Test routing decision
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
    
    console.log('🎯 Testing routing decision...');
    const routedRequest = await routerLayer.process(testRequest, testContext);
    
    console.log('✅ Routing decision completed');
    console.log('📋 Original model:', testRequest.body.model);
    console.log('📋 Target provider:', routedRequest.targetProvider);
    console.log('📋 Target model:', routedRequest.targetModel);
    console.log('📋 Category:', routedRequest.category);
    console.log('📋 Model substitution:', routedRequest.body.model);
    
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
    
    console.log('🎉 RouterLayer functionality test passed!');
    
} catch (error) {
    console.error('❌ RouterLayer test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}
EOF

# Run the RouterLayer test
node "/tmp/test-router-layer.js"

echo -e "${GREEN}✅ RouterLayer functionality test passed${NC}"

# Step 5: Test category determination
echo -e "${BLUE}5️⃣ Testing category determination logic...${NC}"

cat > "/tmp/test-category-logic.js" << 'EOF'
import { RouterLayer } from './dist/v3/router/router-layer.js';
import { convertV3ToRouterConfig } from './dist/v3/config/v3-to-router-config.js';

const testConfigPath = '/tmp/test-v3-config.json';

try {
    console.log('🔄 Starting category determination test...');
    
    const routerConfig = convertV3ToRouterConfig(testConfigPath);
    const routerLayer = new RouterLayer({ routingConfig: routerConfig.routingConfig });
    await routerLayer.initialize();
    
    // Test 1: Default request
    let category = routerLayer.determineCategory({
        messages: [{ role: "user", content: "Hello!" }]
    }, { metadata: {} });
    console.log('✅ Default request category:', category);
    
    // Test 2: Tool usage request
    category = routerLayer.determineCategory({
        messages: [{ role: "user", content: "Use the search tool" }],
        tools: [{ name: "search", description: "Search tool" }]
    }, { metadata: { tools: [{ name: "search" }] } });
    console.log('✅ Tool request category:', category);
    
    // Test 3: Long context request
    category = routerLayer.determineCategory({
        messages: [{ 
            role: "user", 
            content: "A".repeat(60000) // 60k characters
        }]
    }, { metadata: {} });
    console.log('✅ Long context category:', category);
    
    console.log('🎉 Category determination test passed!');
    
} catch (error) {
    console.error('❌ Category determination test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}
EOF

# Run the category logic test
node "/tmp/test-category-logic.js"

echo -e "${GREEN}✅ Category determination test passed${NC}"

# Cleanup
echo -e "${BLUE}🧹 Cleaning up test files...${NC}"
rm -f "$TEST_CONFIG" "/tmp/test-config-conversion.js" "/tmp/test-router-layer.js" "/tmp/test-category-logic.js"

echo -e "${GREEN}🎉 All V3.0 Router Fix Tests PASSED!${NC}"
echo -e "${GREEN}🔧 Router is now working correctly with V3 configuration format${NC}"
echo ""
echo -e "${BLUE}📋 Test Summary:${NC}"
echo "  ✅ Config conversion logic"
echo "  ✅ RouterLayer initialization"
echo "  ✅ Routing decision making"
echo "  ✅ Health check functionality"
echo "  ✅ Category determination"
echo ""
echo -e "${BLUE}🚀 Ready to test with real V3 configuration!${NC}"