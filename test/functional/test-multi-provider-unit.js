#!/usr/bin/env node

/**
 * 单元测试：多Provider高级路由功能
 * 
 * 测试目标：
 * 1. 测试CategoryRouting接口扩展
 * 2. 测试配置结构验证
 * 3. 测试类型定义完整性
 */

const fs = require('fs');
const path = require('path');

function testConfigurationStructures() {
  console.log('🧪 Testing Multi-Provider Configuration Structures');
  console.log('='.repeat(60));
  
  let totalTests = 0;
  let passedTests = 0;
  
  // Test 1: 读取示例配置文件
  console.log('\n📋 Test 1: Example Configuration File Structure');
  try {
    const configPath = path.join(__dirname, '../../config-multi-provider-example.json');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    console.log('✅ Multi-provider example configuration loaded successfully');
    console.log(`   Categories: ${Object.keys(config.routing).length}`);
    console.log(`   Providers: ${Object.keys(config.providers).length}`);
    
    // 验证多Provider配置
    const defaultConfig = config.routing.default;
    if (defaultConfig.providers && Array.isArray(defaultConfig.providers)) {
      console.log(`   Default category has ${defaultConfig.providers.length} providers`);
      console.log(`   Load balancing enabled: ${defaultConfig.loadBalancing?.enabled}`);
      console.log(`   Failover enabled: ${defaultConfig.failover?.enabled}`);
      passedTests++;
    }
    
    totalTests++;
  } catch (error) {
    console.log(`❌ Test 1 failed: ${error.message}`);
    totalTests++;
  }
  
  // Test 2: 类型定义文件检查
  console.log('\n📝 Test 2: TypeScript Type Definitions');
  try {
    const typesPath = path.join(__dirname, '../../src/types/index.ts');
    const typesContent = fs.readFileSync(typesPath, 'utf8');
    
    // 检查必要接口是否存在
    const requiredInterfaces = [
      'ProviderEntry',
      'LoadBalancingConfig', 
      'FailoverConfig',
      'ProviderHealth',
      'FailoverTrigger'
    ];
    
    let foundInterfaces = 0;
    requiredInterfaces.forEach(interfaceName => {
      if (typesContent.includes(`interface ${interfaceName}`)) {
        foundInterfaces++;
        console.log(`   ✅ Found interface: ${interfaceName}`);
      } else {
        console.log(`   ❌ Missing interface: ${interfaceName}`);
      }
    });
    
    if (foundInterfaces === requiredInterfaces.length) {
      console.log('✅ All required TypeScript interfaces found');
      passedTests++;
    } else {
      console.log(`❌ Missing ${requiredInterfaces.length - foundInterfaces} interfaces`);
    }
    
    totalTests++;
  } catch (error) {
    console.log(`❌ Test 2 failed: ${error.message}`);
    totalTests++;
  }
  
  // Test 3: 路由引擎文件检查
  console.log('\n🔧 Test 3: Routing Engine Implementation');
  try {
    const enginePath = path.join(__dirname, '../../src/routing/engine.ts');
    const engineContent = fs.readFileSync(enginePath, 'utf8');
    
    // 检查关键方法是否存在
    const requiredMethods = [
      'selectFromMultiProvider',
      'applyLoadBalancingStrategy',
      'applyFailoverFiltering', 
      'shouldTriggerFailover',
      'recordProviderResult',
      'getProviderHealth'
    ];
    
    let foundMethods = 0;
    requiredMethods.forEach(methodName => {
      if (engineContent.includes(methodName)) {
        foundMethods++;
        console.log(`   ✅ Found method: ${methodName}`);
      } else {
        console.log(`   ❌ Missing method: ${methodName}`);
      }
    });
    
    if (foundMethods === requiredMethods.length) {
      console.log('✅ All required routing engine methods found');
      passedTests++;
    } else {
      console.log(`❌ Missing ${requiredMethods.length - foundMethods} methods`);
    }
    
    totalTests++;
  } catch (error) {
    console.log(`❌ Test 3 failed: ${error.message}`);
    totalTests++;
  }
  
  // Test 4: 负载均衡策略枚举检查
  console.log('\n⚖️ Test 4: Load Balancing Strategy Support');
  try {
    const typesPath = path.join(__dirname, '../../src/types/index.ts');
    const typesContent = fs.readFileSync(typesPath, 'utf8');
    
    const strategies = ['round_robin', 'weighted', 'health_based'];
    let foundStrategies = 0;
    
    strategies.forEach(strategy => {
      if (typesContent.includes(`'${strategy}'`)) {
        foundStrategies++;
        console.log(`   ✅ Found strategy: ${strategy}`);
      } else {
        console.log(`   ❌ Missing strategy: ${strategy}`);
      }
    });
    
    if (foundStrategies === strategies.length) {
      console.log('✅ All load balancing strategies defined');
      passedTests++;
    } else {
      console.log(`❌ Missing ${strategies.length - foundStrategies} strategies`);
    }
    
    totalTests++;
  } catch (error) {
    console.log(`❌ Test 4 failed: ${error.message}`);
    totalTests++;
  }
  
  // Test 5: Failover触发器类型检查
  console.log('\n⚡ Test 5: Failover Trigger Types');
  try {
    const typesPath = path.join(__dirname, '../../src/types/index.ts');
    const typesContent = fs.readFileSync(typesPath, 'utf8');
    
    const triggerTypes = ['consecutive_errors', 'http_error', 'network_timeout', 'auth_failed'];
    let foundTriggers = 0;
    
    triggerTypes.forEach(trigger => {
      if (typesContent.includes(`'${trigger}'`)) {
        foundTriggers++;
        console.log(`   ✅ Found trigger type: ${trigger}`);
      } else {
        console.log(`   ❌ Missing trigger type: ${trigger}`);
      }
    });
    
    if (foundTriggers === triggerTypes.length) {
      console.log('✅ All failover trigger types defined');
      passedTests++;
    } else {
      console.log(`❌ Missing ${triggerTypes.length - foundTriggers} trigger types`);
    }
    
    totalTests++;
  } catch (error) {
    console.log(`❌ Test 5 failed: ${error.message}`);
    totalTests++;
  }
  
  // Test 6: 构建产物检查
  console.log('\n🏗️ Test 6: Build Artifacts Verification');
  try {
    const distEnginerPath = path.join(__dirname, '../../dist/routing/engine.js');
    
    if (fs.existsSync(distEnginerPath)) {
      const distContent = fs.readFileSync(distEnginerPath, 'utf8');
      
      // 检查关键函数是否在构建产物中
      if (distContent.includes('selectFromMultiProvider') && 
          distContent.includes('applyLoadBalancingStrategy')) {
        console.log('✅ Multi-provider functions found in build artifacts');
        passedTests++;
      } else {
        console.log('❌ Multi-provider functions missing in build artifacts');
      }
    } else {
      console.log('❌ Build artifacts not found - run npm run build first');
    }
    
    totalTests++;
  } catch (error) {
    console.log(`❌ Test 6 failed: ${error.message}`);
    totalTests++;
  }
  
  // 测试汇总
  console.log('\n' + '='.repeat(60));
  console.log('🎯 Unit Test Summary');
  console.log(`   Total tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests}`);
  console.log(`   Failed: ${totalTests - passedTests}`);
  console.log(`   Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All multi-provider unit tests passed!');
    return true;
  } else {
    console.log('\n⚠️ Some tests failed. Please review the implementation.');
    return false;
  }
}

// 运行测试
if (require.main === module) {
  const success = testConfigurationStructures();
  process.exit(success ? 0 : 1);
}

module.exports = { testConfigurationStructures };