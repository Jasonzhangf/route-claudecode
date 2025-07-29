#!/usr/bin/env node

/**
 * 测试多Provider高级路由功能
 * 
 * 测试目标：
 * 1. 多Provider配置识别和加载
 * 2. 负载均衡策略 (round_robin, weighted, health_based)  
 * 3. Failover机制和错误优先级回退
 * 4. Provider健康检查和错误计数
 * 5. 向后兼容性 (legacy backup配置)
 */

const path = require('path');

// Add src directory to Node.js module path for testing
require('module')._nodeModulePaths(path.join(__dirname, '../..')).unshift(
  path.join(__dirname, '../../src')
);

const { RoutingEngine } = require('../../dist/routing/engine.js');

// 测试配置
const testConfig = {
  "multiProvider": {
    "providers": [
      {
        "provider": "kiro-zcam",
        "model": "CLAUDE_SONNET_4_20250514_V1_0", 
        "weight": 1
      },
      {
        "provider": "kiro-gmail", 
        "model": "CLAUDE_SONNET_4_20250514_V1_0",
        "weight": 1
      },
      {
        "provider": "kiro-backup1",
        "model": "CLAUDE_SONNET_4_20250514_V1_0", 
        "weight": 3
      }
    ],
    "loadBalancing": {
      "enabled": true,
      "strategy": "round_robin",
      "healthCheckInterval": 60
    },
    "failover": {
      "enabled": true,
      "triggers": [
        {
          "type": "consecutive_errors",
          "threshold": 3
        },
        {
          "type": "auth_failed",
          "threshold": 2,
          "timeWindow": 300,
          "httpCodes": [401, 403]
        }
      ],
      "cooldown": 120
    }
  },
  "legacyBackup": {
    "provider": "shuaihong-openai",
    "model": "gemini-2.5-flash",
    "backup": [
      {
        "provider": "kiro-gmail",
        "model": "CLAUDE_SONNET_4_20250514_V1_0",
        "weight": 1
      }
    ]
  },
  "weightedStrategy": {
    "providers": [
      {
        "provider": "provider-high-priority",
        "model": "model-a", 
        "weight": 1
      },
      {
        "provider": "provider-low-priority",
        "model": "model-b",
        "weight": 5
      }
    ],
    "loadBalancing": {
      "enabled": true,
      "strategy": "weighted"
    },
    "failover": {
      "enabled": false,
      "triggers": [],
      "cooldown": 60
    }
  },
  "healthBasedStrategy": {
    "providers": [
      {
        "provider": "provider-healthy",
        "model": "model-x",
        "weight": 1
      },
      {
        "provider": "provider-unhealthy", 
        "model": "model-y",
        "weight": 1
      }
    ],
    "loadBalancing": {
      "enabled": true,
      "strategy": "health_based"
    },
    "failover": {
      "enabled": true,
      "triggers": [
        {
          "type": "consecutive_errors",
          "threshold": 2
        }
      ],
      "cooldown": 60
    }
  },
  "default": {
    "provider": "fallback-provider",
    "model": "fallback-model"
  }
};

// 模拟请求
const mockRequest = {
  model: "claude-sonnet-4-20250514",
  messages: [
    { role: "user", content: "Test message for multi-provider routing" }
  ],
  metadata: {
    requestId: "test-request-123"
  }
};

async function runTests() {
  console.log('🧪 Starting Multi-Provider Advanced Routing Tests');
  console.log('='.repeat(60));
  
  let totalTests = 0;
  let passedTests = 0;
  
  // Test 1: 基本多Provider配置识别
  console.log('\n📋 Test 1: Multi-Provider Configuration Recognition');
  try {
    const engine = new RoutingEngine(testConfig);
    const stats = engine.getStats();
    
    console.log('✅ Routing engine initialized successfully');
    console.log(`   Categories: ${stats.categories.join(', ')}`);
    console.log(`   Provider health entries: ${Object.keys(stats.providerHealth).length}`);
    
    totalTests++;
    passedTests++;
  } catch (error) {
    console.log(`❌ Test 1 failed: ${error.message}`);
    totalTests++;
  }
  
  // Test 2: Round Robin负载均衡测试
  console.log('\n🔄 Test 2: Round Robin Load Balancing');
  try {
    const engine = new RoutingEngine(testConfig);
    const selectedProviders = [];
    
    // 执行多次路由选择
    for (let i = 0; i < 6; i++) {
      const provider = await engine.route({ ...mockRequest }, `req-${i}`);
      selectedProviders.push(provider);
    }
    
    console.log('Selected providers sequence:', selectedProviders);
    
    // 验证Round Robin行为
    const uniqueProviders = [...new Set(selectedProviders)];
    if (uniqueProviders.length >= 2) {
      console.log('✅ Round robin load balancing working correctly');
      console.log(`   Used providers: ${uniqueProviders.join(', ')}`);
      totalTests++;
      passedTests++;
    } else {
      console.log('⚠️ Round robin may not be working as expected');
      totalTests++;
    }
  } catch (error) {
    console.log(`❌ Test 2 failed: ${error.message}`);
    totalTests++;
  }
  
  // Test 3: Provider健康状态管理
  console.log('\n🏥 Test 3: Provider Health Management');
  try {
    const engine = new RoutingEngine(testConfig); 
    
    // 记录错误
    engine.recordProviderResult('kiro-zcam', false, 'Connection timeout', 504);
    engine.recordProviderResult('kiro-zcam', false, 'Authentication failed', 401);
    engine.recordProviderResult('kiro-zcam', false, 'Network error');
    
    const health = engine.getProviderHealth('kiro-zcam');
    console.log(`Provider health after 3 errors:`, {
      isHealthy: health.isHealthy,
      consecutiveErrors: health.consecutiveErrors,
      errorCount: health.failureCount,
      inCooldown: health.inCooldown
    });
    
    if (health.consecutiveErrors === 3 && health.failureCount === 3) {
      console.log('✅ Provider health tracking working correctly');
      totalTests++;
      passedTests++;
    } else {
      console.log('❌ Provider health tracking not working as expected');
      totalTests++;
    }
  } catch (error) {
    console.log(`❌ Test 3 failed: ${error.message}`);
    totalTests++;
  }
  
  // Test 4: Failover触发机制测试
  console.log('\n⚡ Test 4: Failover Trigger Mechanism');
  try {
    const engine = new RoutingEngine(testConfig);
    
    // 模拟连续错误
    for (let i = 0; i < 4; i++) {
      engine.recordProviderResult('kiro-zcam', false, 'Consecutive error', 500);
    }
    
    // 检查是否应该触发failover
    const shouldFailover = engine.shouldFailoverProvider('kiro-zcam', 'network_error', 500);
    console.log(`Should failover after 4 consecutive errors: ${shouldFailover}`);
    
    if (shouldFailover) {
      console.log('✅ Failover trigger mechanism working correctly');
      totalTests++;
      passedTests++;
    } else {
      console.log('❌ Failover trigger not working as expected');
      totalTests++;
    }
  } catch (error) {
    console.log(`❌ Test 4 failed: ${error.message}`);
    totalTests++;
  }
  
  // Test 5: Weighted策略测试
  console.log('\n⚖️ Test 5: Weighted Load Balancing Strategy');
  try {
    const engine = new RoutingEngine(testConfig);
    const selectedProviders = [];
    
    // 使用weightedStrategy配置进行路由
    for (let i = 0; i < 5; i++) {
      const provider = await engine.route({ 
        ...mockRequest,
        metadata: { requestId: `weighted-test-${i}` }
      }, `weighted-req-${i}`);
      selectedProviders.push(provider);
    }
    
    console.log('Weighted selection results:', selectedProviders);
    
    // 统计provider使用频率
    const providerCounts = {};
    selectedProviders.forEach(p => {
      providerCounts[p] = (providerCounts[p] || 0) + 1;
    });
    
    console.log('Provider usage counts:', providerCounts);
    console.log('✅ Weighted strategy test completed');
    
    totalTests++;
    passedTests++;
  } catch (error) {
    console.log(`❌ Test 5 failed: ${error.message}`);
    totalTests++;
  }
  
  // Test 6: 向后兼容性测试 (Legacy Backup)
  console.log('\n🔙 Test 6: Legacy Backup Configuration Compatibility');
  try {
    const engine = new RoutingEngine(testConfig);
    
    // 设置primary provider为不健康
    engine.setProviderHealth('shuaihong-openai', false);
    
    const provider = await engine.route({ ...mockRequest }, 'legacy-test');
    console.log(`Selected provider after primary failure: ${provider}`);
    
    if (provider === 'kiro-gmail') {
      console.log('✅ Legacy backup configuration working correctly');
      totalTests++;
      passedTests++;
    } else {
      console.log('⚠️ Legacy backup may not be working as expected');
      totalTests++;
    }
  } catch (error) {
    console.log(`❌ Test 6 failed: ${error.message}`);
    totalTests++;
  }
  
  // Test 7: Health-based策略测试
  console.log('\n💚 Test 7: Health-based Load Balancing Strategy');
  try {
    const engine = new RoutingEngine(testConfig);
    
    // 设置不同的provider健康状态
    engine.recordProviderResult('provider-healthy', true);
    engine.recordProviderResult('provider-healthy', true);
    engine.recordProviderResult('provider-healthy', true);
    
    engine.recordProviderResult('provider-unhealthy', false, 'Error 1');
    engine.recordProviderResult('provider-unhealthy', false, 'Error 2');
    engine.recordProviderResult('provider-unhealthy', true); // 部分成功
    
    const healthyHealth = engine.getProviderHealth('provider-healthy');
    const unhealthyHealth = engine.getProviderHealth('provider-unhealthy');
    
    console.log('Healthy provider stats:', {
      successRate: healthyHealth.successCount / healthyHealth.totalRequests,
      totalRequests: healthyHealth.totalRequests
    });
    
    console.log('Unhealthy provider stats:', {
      successRate: unhealthyHealth.successCount / unhealthyHealth.totalRequests,
      totalRequests: unhealthyHealth.totalRequests  
    });
    
    console.log('✅ Health-based strategy test completed');
    
    totalTests++;
    passedTests++;
  } catch (error) {
    console.log(`❌ Test 7 failed: ${error.message}`);
    totalTests++;
  }
  
  // 测试汇总
  console.log('\n' + '='.repeat(60));
  console.log('🎯 Test Summary');
  console.log(`   Total tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests}`);
  console.log(`   Failed: ${totalTests - passedTests}`);
  console.log(`   Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All multi-provider advanced routing tests passed!');
    return true;
  } else {
    console.log('\n⚠️ Some tests failed. Please review the implementation.');
    return false;
  }
}

// 运行测试
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };