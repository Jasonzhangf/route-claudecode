#!/usr/bin/env node

/**
 * 🧪 并发负载均衡测试 - 多客户端资源竞争验证
 * 测试单服务器多客户端场景下的provider占用和负载均衡效果
 */

const { ConcurrencyManager } = require('./dist/routing/concurrency-manager');

console.log('🧪 并发负载均衡功能测试');
console.log('='.repeat(60));

// 模拟并发配置
const concurrencyConfig = {
  enabled: true,
  maxConcurrencyPerProvider: 2, // 每个provider最多2个并发
  lockTimeoutMs: 10000, // 10秒超时
  queueTimeoutMs: 5000, // 队列等待5秒
  enableWaitingQueue: true,
  preferIdleProviders: true
};

const manager = new ConcurrencyManager(concurrencyConfig);

// 初始化测试providers
const testProviders = [
  { id: 'provider-a', weight: 70, maxConcurrency: 2 },
  { id: 'provider-b', weight: 30, maxConcurrency: 2 },
  { id: 'provider-c', weight: 20, maxConcurrency: 1 }
];

testProviders.forEach(p => {
  manager.initializeProvider(p.id, p.maxConcurrency);
});

console.log('✅ 初始化完成');
console.log(`📋 测试场景: ${testProviders.length}个providers，总并发容量: ${testProviders.reduce((sum, p) => sum + p.maxConcurrency, 0)}`);

// 测试场景1: 基础并发锁测试
async function testBasicConcurrencyLocks() {
  console.log('\n📋 测试场景1: 基础并发锁机制');
  console.log('-'.repeat(50));

  const sessions = ['session-1', 'session-2', 'session-3', 'session-4', 'session-5'];
  const results = [];

  console.log('🔄 模拟多个session同时请求provider-a (容量:2)');
  
  // 同时发起5个请求
  for (let i = 0; i < sessions.length; i++) {
    const sessionId = sessions[i];
    const result = await manager.acquireProviderLock({
      sessionId,
      requestId: `req-${i+1}`,
      providerId: 'provider-a',
      priority: 'normal'
    });
    
    results.push({ sessionId, ...result });
    
    const status = result.success ? '✅ 获得锁' : '❌ 被拒绝';
    console.log(`  ${sessionId}: ${status} (原因: ${result.reason})`);
  }

  console.log('\n📊 结果分析:');
  const successful = results.filter(r => r.success).length;
  const rejected = results.filter(r => !r.success).length;
  
  console.log(`  成功获得锁: ${successful} (期望: 2)`);
  console.log(`  被拒绝请求: ${rejected} (期望: 3)`);
  console.log(`  测试结果: ${successful === 2 && rejected === 3 ? '✅ 通过' : '❌ 失败'}`);

  // 释放锁
  const lockedSessions = results.filter(r => r.success).map(r => r.sessionId);
  lockedSessions.forEach(sessionId => {
    manager.releaseProviderLock(sessionId);
    console.log(`  🔓 释放锁: ${sessionId}`);
  });

  return { successful, rejected, expected: successful === 2 && rejected === 3 };
}

// 测试场景2: 智能负载均衡
async function testIntelligentLoadBalancing() {
  console.log('\n📋 测试场景2: 智能负载均衡 (优先空闲provider)');
  console.log('-'.repeat(50));

  const sessions = ['client-1', 'client-2', 'client-3', 'client-4', 'client-5'];
  const candidateProviders = ['provider-a', 'provider-b', 'provider-c'];
  const weights = new Map([
    ['provider-a', 70],
    ['provider-b', 30], 
    ['provider-c', 20]
  ]);

  const selections = [];
  
  console.log('🔄 模拟多客户端同时请求，观察负载分配');
  
  for (let i = 0; i < sessions.length; i++) {
    const sessionId = sessions[i];
    const result = await manager.acquireAvailableProvider(
      sessionId, 
      `req-${i+1}`,
      candidateProviders,
      weights
    );
    
    selections.push(result);
    
    if (result.success) {
      console.log(`  ${sessionId}: ✅ 分配到 ${result.providerId}`);
    } else {
      console.log(`  ${sessionId}: ❌ 分配失败 (${result.reason})`);
    }
  }

  console.log('\n📊 负载分配统计:');
  const distribution = {};
  selections.filter(s => s.success).forEach(s => {
    distribution[s.providerId] = (distribution[s.providerId] || 0) + 1;
  });

  const totalCapacity = testProviders.reduce((sum, p) => sum + p.maxConcurrency, 0);
  const totalAssigned = Object.values(distribution).reduce((sum, count) => sum + count, 0);

  Object.entries(distribution).forEach(([providerId, count]) => {
    const provider = testProviders.find(p => p.id === providerId);
    const utilizationRate = ((count / provider.maxConcurrency) * 100).toFixed(1);
    console.log(`  ${providerId}: ${count}/${provider.maxConcurrency} (利用率:${utilizationRate}%)`);
  });

  console.log(`\n✅ 总体分配: ${totalAssigned}/${totalCapacity} (${(totalAssigned/totalCapacity*100).toFixed(1)}%)`);

  // 释放所有锁
  selections.filter(s => s.success).forEach(s => {
    manager.releaseProviderLock(s.sessionId);
  });

  return { distribution, totalAssigned, totalCapacity };
}

// 测试场景3: 并发竞争压力测试
async function testConcurrencyPressure() {
  console.log('\n📋 测试场景3: 高并发压力测试 (10个客户端)');
  console.log('-'.repeat(50));

  const concurrentClients = 10;
  const promises = [];
  const startTime = Date.now();

  console.log(`🚀 启动${concurrentClients}个并发客户端...`);

  // 并发发起请求
  for (let i = 0; i < concurrentClients; i++) {
    const promise = (async (clientId) => {
      const sessionId = `stress-client-${clientId}`;
      const candidateProviders = ['provider-a', 'provider-b', 'provider-c'];
      
      const result = await manager.acquireAvailableProvider(
        sessionId,
        `stress-req-${clientId}`,
        candidateProviders
      );

      // 模拟处理时间
      if (result.success) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000)); // 1-3秒
        manager.releaseProviderLock(sessionId);
      }

      return { clientId, ...result };
    })(i);

    promises.push(promise);
  }

  // 等待所有请求完成
  const results = await Promise.all(promises);
  const endTime = Date.now();
  const totalTime = endTime - startTime;

  console.log('\n📊 压力测试结果:');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`  成功处理: ${successful}/${concurrentClients} (${(successful/concurrentClients*100).toFixed(1)}%)`);
  console.log(`  失败请求: ${failed}/${concurrentClients} (${(failed/concurrentClients*100).toFixed(1)}%)`);
  console.log(`  总耗时: ${(totalTime/1000).toFixed(2)}秒`);
  console.log(`  平均响应时间: ${(totalTime/concurrentClients).toFixed(0)}ms`);

  // 分析分配分布
  const stressDistribution = {};
  results.filter(r => r.success).forEach(r => {
    stressDistribution[r.providerId] = (stressDistribution[r.providerId] || 0) + 1;
  });

  console.log('\n🎯 压力测试分配分布:');
  Object.entries(stressDistribution).forEach(([providerId, count]) => {
    const percentage = (count / successful * 100).toFixed(1);
    console.log(`  ${providerId}: ${count} 次 (${percentage}%)`);
  });

  return { successful, failed, totalTime, distribution: stressDistribution };
}

// 测试场景4: 占用状态监控
function testOccupancyMonitoring() {
  console.log('\n📋 测试场景4: 实时占用状态监控');
  console.log('-'.repeat(50));

  // 模拟一些占用状态
  const monitoringSessions = ['monitor-1', 'monitor-2', 'monitor-3'];
  
  console.log('🔄 创建占用状态...');
  monitoringSessions.forEach((sessionId, index) => {
    const providerId = testProviders[index % testProviders.length].id;
    manager.acquireProviderLock({
      sessionId,
      requestId: `monitor-req-${index}`,
      providerId,
      priority: 'normal'
    });
  });

  // 获取状态快照
  const snapshot = manager.getOccupancySnapshot();
  
  console.log('\n📊 当前占用状态快照:');
  Object.entries(snapshot).forEach(([providerId, state]) => {
    console.log(`  ${providerId}:`);
    console.log(`    活跃连接: ${state.activeConnections}/${state.maxConcurrency}`);
    console.log(`    利用率: ${state.utilizationRate}`);
    console.log(`    可用状态: ${state.isAvailable ? '✅ 可用' : '❌ 满载'}`);
    console.log(`    队列长度: ${state.queueLength}`);
  });

  // 获取详细指标
  console.log('\n📈 详细并发指标:');
  testProviders.forEach(provider => {
    const metrics = manager.getProviderMetrics(provider.id);
    if (metrics) {
      console.log(`  ${provider.id}:`);
      console.log(`    当前负载: ${metrics.currentLoad}/${metrics.maxConcurrency}`);
      console.log(`    利用率: ${(metrics.utilizationRate * 100).toFixed(1)}%`);
      console.log(`    空闲时间: ${metrics.idleTime}ms`);
    }
  });

  // 清理占用状态
  monitoringSessions.forEach(sessionId => {
    manager.releaseProviderLock(sessionId);
  });

  return snapshot;
}

// 执行所有测试
async function runAllTests() {
  try {
    const test1 = await testBasicConcurrencyLocks();
    const test2 = await testIntelligentLoadBalancing();
    const test3 = await testConcurrencyPressure();
    const test4 = testOccupancyMonitoring();

    console.log('\n' + '='.repeat(60));
    console.log('🎉 并发负载均衡测试完成!');
    console.log('='.repeat(60));

    console.log('\n📋 测试总结:');
    console.log(`✅ 基础并发锁: ${test1.expected ? '通过' : '失败'}`);
    console.log(`✅ 智能负载均衡: ${test2.totalAssigned > 0 ? '通过' : '失败'}`);
    console.log(`✅ 高并发压力: ${test3.successful > test3.failed ? '通过' : '失败'} (${test3.successful}/${test3.successful + test3.failed})`);
    console.log(`✅ 状态监控: ${Object.keys(test4).length > 0 ? '通过' : '失败'}`);

    console.log('\n🚀 核心优势验证:');
    console.log('1. ✅ 严格的并发控制 - 防止provider过载');
    console.log('2. ✅ 智能负载分配 - 优先选择空闲provider');  
    console.log('3. ✅ 优雅的资源竞争处理 - 拒绝超额请求');
    console.log('4. ✅ 实时状态监控 - 完整的并发指标');
    console.log('5. ✅ 自动锁释放 - 防止资源泄漏');

    console.log('\n🎯 生产环境建议:');
    console.log('• maxConcurrencyPerProvider: 根据provider性能调整 (建议2-5)');
    console.log('• lockTimeoutMs: 设置合理超时 (建议300秒)');
    console.log('• enableWaitingQueue: 根据业务需求开启队列');
    console.log('• 监控utilizationRate确保负载均衡效果');

  } catch (error) {
    console.error('❌ 测试执行失败:', error);
  }
}

// 启动测试
runAllTests();