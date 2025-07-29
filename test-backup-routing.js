#!/usr/bin/env node

/**
 * 测试新的backup路由配置
 * 验证主备配置和负载均衡功能
 */

const { BackupRoutingEngine } = require('./src/routing/backup-engine');

async function testBackupRouting() {
  console.log('🎯 测试Backup路由配置');
  console.log('============================\n');

  // 加载配置
  const config = require('/Users/fanzhang/.route-claude-code/config.json');
  const backupConfig = config.routing;

  if (!backupConfig) {
    console.error('❌ 未找到routing配置');
    return false;
  }

  console.log('📋 配置概览:');
  for (const [category, categoryConfig] of Object.entries(backupConfig)) {
    console.log(`   ${category}:`);
    console.log(`     Primary: ${categoryConfig.provider} (${categoryConfig.model})`);
    if (categoryConfig.backup?.length) {
      console.log(`     Backup: ${categoryConfig.backup.map(b => b.provider).join(', ')}`);
    }
    console.log(`     负载均衡: ${categoryConfig.loadBalancing?.enabled ? '✅ 启用' : '❌ 禁用'}`);
    console.log(`     策略: ${categoryConfig.loadBalancing?.strategy || 'N/A'}`);
    console.log(`     Failover: ${categoryConfig.failover?.enabled ? '✅ 启用' : '❌ 禁用'}`);
    console.log('');
  }

  // 创建backup路由引擎
  const engine = new BackupRoutingEngine(backupConfig);

  console.log('🧪 执行路由测试:\n');

  const testCases = [
    { category: 'default', description: 'Default路由 - 支持负载均衡' },
    { category: 'background', description: 'Background路由 - Round-robin负载均衡' },
    { category: 'thinking', description: 'Thinking路由 - 仅failover' },
    { category: 'longcontext', description: 'Long context路由 - 跨供应商backup' },
    { category: 'search', description: 'Search路由 - 快速failover' }
  ];

  let successCount = 0;

  for (const testCase of testCases) {
    try {
      console.log(`🔍 测试 ${testCase.category} - ${testCase.description}`);
      
      // 测试正常路由选择
      const result = engine.selectProvider(testCase.category);
      
      console.log(`   选中Provider: ${result.provider}`);
      console.log(`   模型: ${result.model}`);
      console.log(`   是否Backup: ${result.isBackup ? '是' : '否'}`);

      // 如果启用了负载均衡，测试多次选择看分布
      const categoryConfig = backupConfig[testCase.category];
      if (categoryConfig.loadBalancing?.enabled) {
        console.log('   📊 负载均衡测试 (10次选择):');
        const providerCounts = {};
        
        for (let i = 0; i < 10; i++) {
          const lbResult = engine.selectProvider(testCase.category);
          providerCounts[lbResult.provider] = (providerCounts[lbResult.provider] || 0) + 1;
        }
        
        for (const [provider, count] of Object.entries(providerCounts)) {
          console.log(`     ${provider}: ${count}次 (${(count/10*100).toFixed(0)}%)`);
        }
      }

      console.log('   ✅ 测试通过\n');
      successCount++;

    } catch (error) {
      console.error(`   ❌ 测试失败: ${error.message}\n`);
    }
  }

  // 测试错误处理和failover
  console.log('🚨 测试Failover机制:\n');

  try {
    console.log('🔍 模拟连续错误触发failover');
    
    // 模拟default category的主provider连续错误
    const defaultProvider = backupConfig.default.provider;
    console.log(`   主Provider: ${defaultProvider}`);
    
    // 记录3次连续错误
    for (let i = 1; i <= 3; i++) {
      const error = new Error(`Simulated error ${i}`);
      engine.recordProviderError('default', defaultProvider, error, 'consecutive_errors');
      console.log(`   记录错误 ${i}/3: ${error.message}`);
    }

    // 检查是否触发failover
    const shouldFailover = engine.shouldTriggerFailover(
      'default', 
      defaultProvider, 
      new Error('Final error'), 
      'consecutive_errors'
    );

    if (shouldFailover) {
      console.log('   ✅ Failover正确触发');
      engine.activateFailover('default', 1800);
      
      // 测试failover后的路由选择
      const failoverResult = engine.selectProvider('default');
      console.log(`   Failover后选中: ${failoverResult.provider} (backup: ${failoverResult.isBackup})`);
      
      if (failoverResult.isBackup) {
        console.log('   ✅ 成功切换到backup provider');
        successCount++;
      } else {
        console.log('   ❌ 未能切换到backup provider');
      }
    } else {
      console.log('   ❌ Failover未触发');
    }

  } catch (error) {
    console.error(`   ❌ Failover测试失败: ${error.message}`);
  }

  console.log('\n📊 测试总结:');
  console.log('==================');
  console.log(`总测试数: ${testCases.length + 1}`);
  console.log(`成功: ${successCount}`);
  console.log(`失败: ${testCases.length + 1 - successCount}`);
  console.log(`成功率: ${(successCount / (testCases.length + 1) * 100).toFixed(1)}%`);

  if (successCount === testCases.length + 1) {
    console.log('\n🎉 所有测试通过！Backup路由配置正常工作');
    return true;
  } else {
    console.log('\n⚠️  部分测试失败，请检查配置');
    return false;
  }
}

// 获取健康状态报告
function displayHealthReport(engine) {
  console.log('\n🏥 Provider健康状态报告:');
  console.log('=============================');
  
  const healthReport = engine.getHealthReport();
  
  for (const [providerId, health] of Object.entries(healthReport)) {
    console.log(`📊 ${providerId}:`);
    console.log(`   健康状态: ${health.isHealthy ? '✅ 健康' : '❌ 异常'}`);
    console.log(`   连续错误: ${health.consecutiveErrors}`);
    console.log(`   成功率: ${health.successRate}`);
    console.log(`   总请求数: ${health.totalRequests}`);
    if (health.recentErrorTypes.length > 0) {
      console.log(`   最近错误类型: ${health.recentErrorTypes.join(', ')}`);
    }
    console.log('');
  }
}

async function main() {
  console.log('🚀 Backup路由系统测试');
  console.log('=======================\n');
  
  const success = await testBackupRouting();
  
  if (success) {
    console.log('✅ 配置验证完成，可以启动服务器进行实际测试');
    console.log('\n💡 下一步：');
    console.log('1. 启动服务器：./start-dev.sh');
    console.log('2. 观察日志中的负载均衡分配');
    console.log('3. 测试failover场景（故意断开某个provider）');
  } else {
    console.log('❌ 配置存在问题，请修复后再试');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testBackupRouting };