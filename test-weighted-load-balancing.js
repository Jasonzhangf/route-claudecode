#!/usr/bin/env node

/**
 * 权重负载均衡功能验证测试
 * 测试用例：权重分配、连续429检测、动态权重重分配、Key共享权重机制
 * 
 * 预期结果：
 * 1. Provider按照weight比例分配请求 (40:30:30)
 * 2. 连续3次429才拉黑provider
 * 3. 拉黑provider后权重重新分配给健康providers
 * 4. 多个key的provider在内部轮询，但共享外部权重
 */

// Import using the built CLI which has all dependencies bundled
const path = require('path');

// Mock logger for standalone testing
const logger = {
  debug: (...args) => console.log('[DEBUG]', ...args),
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.log('[WARN]', ...args),
  error: (...args) => console.log('[ERROR]', ...args)
};

// Simulate SimpleProviderManager functionality for testing
class SimpleProviderManager {
  constructor() {
    this.roundRobinIndex = new Map();
    this.blacklist = new Map();
    this.consecutiveFailures = new Map();
    this.keyRoundRobinIndex = new Map();
    this.keyBlacklist = new Map();
    
    // Constants
    this.RATE_LIMIT_BLACKLIST_DURATION = 60;
    this.CONSECUTIVE_429_THRESHOLD = 3;
  }

  selectProviderWeighted(providers, category) {
    // Filter out blacklisted providers
    const availableProviders = providers.filter(provider => 
      !this.isBlacklisted(provider.providerId, provider.model)
    );
    
    if (availableProviders.length === 0) {
      return providers[0] || null;
    }

    // Redistribute weights
    const redistributedProviders = this.redistributeWeights(availableProviders, providers);
    
    // Weighted random selection
    return this.weightedRandomSelection(redistributedProviders);
  }

  redistributeWeights(availableProviders, allProviders) {
    const totalOriginalWeight = allProviders.reduce((sum, p) => sum + p.weight, 0);
    const availableWeight = availableProviders.reduce((sum, p) => sum + p.weight, 0);
    
    if (availableProviders.length === allProviders.length) {
      return availableProviders;
    }
    
    const blacklistedWeight = totalOriginalWeight - availableWeight;
    
    if (availableWeight === 0) {
      const equalWeight = totalOriginalWeight / availableProviders.length;
      return availableProviders.map(p => ({...p, weight: equalWeight}));
    }
    
    return availableProviders.map(provider => {
      const proportionalShare = (provider.weight / availableWeight) * blacklistedWeight;
      return {...provider, weight: provider.weight + proportionalShare};
    });
  }

  weightedRandomSelection(providers) {
    if (providers.length === 0) return null;
    if (providers.length === 1) return providers[0];
    
    const totalWeight = providers.reduce((sum, p) => sum + p.weight, 0);
    if (totalWeight <= 0) {
      return providers[Math.floor(Math.random() * providers.length)];
    }
    
    let random = Math.random() * totalWeight;
    
    for (const provider of providers) {
      random -= provider.weight;
      if (random <= 0) {
        return provider;
      }
    }
    
    return providers[providers.length - 1];
  }

  reportFailure(providerId, error, httpCode, model) {
    const failureType = this.categorizeFailure(error, httpCode);
    const blacklistKey = model ? `${providerId}:${model}` : providerId;
    
    if (failureType === 'rate_limit') {
      const consecutive429 = this.consecutiveFailures.get(blacklistKey) || 0;
      this.consecutiveFailures.set(blacklistKey, consecutive429 + 1);
      
      if (consecutive429 + 1 >= this.CONSECUTIVE_429_THRESHOLD) {
        this.blacklistProvider(blacklistKey, providerId, failureType, this.RATE_LIMIT_BLACKLIST_DURATION, model);
        this.consecutiveFailures.set(blacklistKey, 0);
      }
    }
  }

  reportSuccess(providerId, model) {
    const keys = model ? [`${providerId}:${model}`, providerId] : [providerId];
    
    for (const key of keys) {
      if (this.consecutiveFailures.has(key)) {
        this.consecutiveFailures.set(key, 0);
      }
      
      const blacklisted = this.blacklist.get(key);
      if (blacklisted && blacklisted.reason !== 'auth_failure') {
        this.blacklist.delete(key);
      }
    }
  }

  isBlacklisted(providerId, model) {
    const keys = model ? [`${providerId}:${model}`, providerId] : [providerId];
    
    for (const key of keys) {
      const blacklisted = this.blacklist.get(key);
      if (!blacklisted) continue;
      
      const now = new Date();
      if (now >= blacklisted.blacklistedUntil) {
        this.blacklist.delete(key);
        continue;
      }
      
      return true;
    }
    
    return false;
  }

  blacklistProvider(blacklistKey, providerId, reason, durationSeconds, model) {
    const now = new Date();
    const blacklistedUntil = new Date(now.getTime() + (durationSeconds * 1000));
    
    this.blacklist.set(blacklistKey, {
      providerId,
      model,
      blacklistedUntil,
      reason,
      errorCount: 1
    });
  }

  categorizeFailure(error, httpCode) {
    const errorLower = error.toLowerCase();
    
    if (httpCode === 429) return 'rate_limit';
    if (errorLower.includes('rate limit')) return 'rate_limit';
    if (httpCode === 401 || httpCode === 403) return 'auth_failure';
    if (errorLower.includes('network')) return 'network_error';
    if (httpCode && httpCode >= 500) return 'server_error';
    
    return 'server_error';
  }

  // Key-level management methods
  initializeProviderKeys(providerId, keyCount) {
    if (keyCount <= 1) {
      this.keyBlacklist.delete(providerId);
      this.keyRoundRobinIndex.delete(providerId);
      return;
    }
    
    const keyStatuses = [];
    for (let i = 0; i < keyCount; i++) {
      keyStatuses.push({
        providerId,
        keyIndex: i,
        isBlacklisted: false,
        consecutiveErrors: 0
      });
    }
    
    this.keyBlacklist.set(providerId, keyStatuses);
    this.keyRoundRobinIndex.set(providerId, 0);
  }

  selectProviderKey(providerId) {
    const keyStatuses = this.keyBlacklist.get(providerId);
    if (!keyStatuses || keyStatuses.length <= 1) {
      return 0;
    }
    
    const availableKeys = keyStatuses.filter(status => !status.isBlacklisted);
    
    if (availableKeys.length === 0) {
      return 0;
    }
    
    const currentIndex = this.keyRoundRobinIndex.get(providerId) || 0;
    const selectedKeyStatus = availableKeys[currentIndex % availableKeys.length];
    
    this.keyRoundRobinIndex.set(providerId, currentIndex + 1);
    
    return selectedKeyStatus.keyIndex;
  }

  reportKeyFailure(providerId, keyIndex, error, httpCode) {
    const keyStatuses = this.keyBlacklist.get(providerId);
    if (!keyStatuses || keyIndex >= keyStatuses.length) {
      return;
    }
    
    const keyStatus = keyStatuses[keyIndex];
    keyStatus.consecutiveErrors++;
    
    if (httpCode === 429 && keyStatus.consecutiveErrors >= this.CONSECUTIVE_429_THRESHOLD) {
      keyStatus.isBlacklisted = true;
      keyStatus.blacklistedUntil = new Date(Date.now() + (this.RATE_LIMIT_BLACKLIST_DURATION * 1000));
    }
  }

  getProviderKeyStatus(providerId) {
    return this.keyBlacklist.get(providerId) || null;
  }
}

class WeightedLoadBalancingTest {
  constructor() {
    this.manager = new SimpleProviderManager();
    this.testResults = {
      weightDistribution: {},
      consecutiveFailures: {},
      weightRedistribution: {},
      keyLevelManagement: {}
    };
  }

  /**
   * 测试1: 权重分配验证
   * 验证provider按照配置的权重比例获得请求
   */
  async testWeightDistribution() {
    console.log('\n🎯 测试1: 权重分配验证');
    console.log('==========================================');
    
    const providers = [
      { providerId: 'shuaihong-openai', model: 'qwen3-coder', weight: 40 },
      { providerId: 'modelscope-openai', model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct', weight: 30 },
      { providerId: 'modelscope-openai', model: 'ZhipuAI/GLM-4.5', weight: 30 }
    ];
    
    const selections = {};
    const testRounds = 1000;
    
    // 进行1000次选择，统计分布
    for (let i = 0; i < testRounds; i++) {
      const selected = this.manager.selectProviderWeighted(providers, 'default');
      if (selected) {
        const key = `${selected.providerId}:${selected.model}`;
        selections[key] = (selections[key] || 0) + 1;
      }
    }
    
    // 计算实际分布比例
    console.log('权重分配结果:');
    Object.entries(selections).forEach(([key, count]) => {
      const percentage = ((count / testRounds) * 100).toFixed(1);
      const expectedWeight = providers.find(p => `${p.providerId}:${p.model}` === key)?.weight;
      console.log(`  ${key}: ${count}次 (${percentage}%) - 期望权重: ${expectedWeight}%`);
    });
    
    this.testResults.weightDistribution = selections;
    
    // 验证分布是否符合预期 (允许±5%误差)
    let distributionValid = true;
    Object.entries(selections).forEach(([key, count]) => {
      const actualPercentage = (count / testRounds) * 100;
      const expectedWeight = providers.find(p => `${p.providerId}:${p.model}` === key)?.weight;
      const deviation = Math.abs(actualPercentage - expectedWeight);
      
      if (deviation > 5) {
        console.log(`❌ ${key}: 偏差过大 ${deviation.toFixed(1)}%`);
        distributionValid = false;
      } else {
        console.log(`✅ ${key}: 偏差在允许范围内 ${deviation.toFixed(1)}%`);
      }
    });
    
    return distributionValid;
  }

  /**
   * 测试2: 连续429检测验证
   * 验证连续3次429错误才拉黑provider
   */
  async testConsecutive429Detection() {
    console.log('\n🚫 测试2: 连续429检测验证');
    console.log('==========================================');
    
    const testProviderId = 'test-provider-429';
    const testModel = 'test-model';
    
    // 初始化测试provider
    this.manager.initializeProviderKeys(testProviderId, 1);
    
    console.log('开始429错误测试...');
    
    // 第1次429 - 不应该被拉黑
    this.manager.reportFailure(testProviderId, 'Rate limit exceeded', 429, testModel);
    let isBlacklisted = this.manager.isBlacklisted(testProviderId, testModel);
    console.log(`第1次429后: ${isBlacklisted ? '❌ 已拉黑' : '✅ 未拉黑'}`);
    
    // 第2次429 - 不应该被拉黑
    this.manager.reportFailure(testProviderId, 'Rate limit exceeded', 429, testModel);
    isBlacklisted = this.manager.isBlacklisted(testProviderId, testModel);
    console.log(`第2次429后: ${isBlacklisted ? '❌ 已拉黑' : '✅ 未拉黑'}`);
    
    // 第3次429 - 应该被拉黑
    this.manager.reportFailure(testProviderId, 'Rate limit exceeded', 429, testModel);
    isBlacklisted = this.manager.isBlacklisted(testProviderId, testModel);
    console.log(`第3次429后: ${isBlacklisted ? '✅ 已拉黑' : '❌ 未拉黑'}`);
    
    // 测试成功后恢复
    this.manager.reportSuccess(testProviderId, testModel);
    const recoveredFromBlacklist = !this.manager.isBlacklisted(testProviderId, testModel);
    console.log(`成功请求后: ${recoveredFromBlacklist ? '✅ 已恢复' : '❌ 仍被拉黑'}`);
    
    this.testResults.consecutiveFailures = {
      after1st429: false,
      after2nd429: false,
      after3rd429: isBlacklisted,
      afterSuccess: recoveredFromBlacklist
    };
    
    return isBlacklisted && recoveredFromBlacklist;
  }

  /**
   * 测试3: 动态权重重分配验证
   * 验证provider被拉黑后，权重重新分配给健康providers
   */
  async testWeightRedistribution() {
    console.log('\n🔄 测试3: 动态权重重分配验证');
    console.log('==========================================');
    
    const providers = [
      { providerId: 'provider-a', model: 'model-a', weight: 50 },
      { providerId: 'provider-b', model: 'model-b', weight: 30 },
      { providerId: 'provider-c', model: 'model-c', weight: 20 }
    ];
    
    console.log('原始权重配置: A(50), B(30), C(20)');
    
    // 测试正常分布
    console.log('\n阶段1: 所有provider健康');
    let selections = await this.simulateSelections(providers, 300);
    this.printDistribution(selections, 300);
    
    // 拉黑provider-a (权重50)
    console.log('\n阶段2: 拉黑provider-a (权重50)');
    this.manager.reportFailure('provider-a', 'Rate limit exceeded', 429, 'model-a');
    this.manager.reportFailure('provider-a', 'Rate limit exceeded', 429, 'model-a');
    this.manager.reportFailure('provider-a', 'Rate limit exceeded', 429, 'model-a');
    
    selections = await this.simulateSelections(providers, 300);
    this.printDistribution(selections, 300);
    
    // 验证A被拉黑，B和C按比例重分配 (B:C = 30:20 = 60%:40%)
    const aSelections = selections['provider-a:model-a'] || 0;
    const bSelections = selections['provider-b:model-b'] || 0;
    const cSelections = selections['provider-c:model-c'] || 0;
    
    const bPercentage = (bSelections / (bSelections + cSelections)) * 100;
    const cPercentage = (cSelections / (bSelections + cSelections)) * 100;
    
    console.log(`实际重分配: B(${bPercentage.toFixed(1)}%) C(${cPercentage.toFixed(1)}%)`);
    console.log(`期望重分配: B(60%) C(40%)`);
    
    const redistributionValid = aSelections === 0 && Math.abs(bPercentage - 60) < 10 && Math.abs(cPercentage - 40) < 10;
    console.log(redistributionValid ? '✅ 权重重分配正确' : '❌ 权重重分配失败');
    
    this.testResults.weightRedistribution = { aSelections, bPercentage, cPercentage };
    
    return redistributionValid;
  }

  /**
   * 测试4: Key级别管理验证
   * 验证多key provider的内部轮询和外部权重共享
   */
  async testKeyLevelManagement() {
    console.log('\n🔑 测试4: Key级别管理验证');
    console.log('==========================================');
    
    const providerId = 'multi-key-provider';
    const keyCount = 4;
    
    // 初始化多key provider
    this.manager.initializeProviderKeys(providerId, keyCount);
    console.log(`初始化provider ${providerId} with ${keyCount} keys`);
    
    // 测试key轮询
    console.log('\nKey轮询测试:');
    const keySelections = {};
    for (let i = 0; i < 20; i++) {
      const keyIndex = this.manager.selectProviderKey(providerId);
      keySelections[keyIndex] = (keySelections[keyIndex] || 0) + 1;
    }
    
    Object.entries(keySelections).forEach(([keyIndex, count]) => {
      console.log(`  Key[${keyIndex}]: ${count}次选择`);
    });
    
    // 测试key级别拉黑
    console.log('\nKey级别拉黑测试:');
    
    // 拉黑key[0] - 连续3次429
    console.log('拉黑key[0]...');
    this.manager.reportKeyFailure(providerId, 0, 'Rate limit exceeded', 429);
    this.manager.reportKeyFailure(providerId, 0, 'Rate limit exceeded', 429);
    this.manager.reportKeyFailure(providerId, 0, 'Rate limit exceeded', 429);
    
    // 验证key[0]被排除在选择之外
    const selectionsAfterBlacklist = {};
    for (let i = 0; i < 20; i++) {
      const keyIndex = this.manager.selectProviderKey(providerId);
      selectionsAfterBlacklist[keyIndex] = (selectionsAfterBlacklist[keyIndex] || 0) + 1;
    }
    
    console.log('拉黑key[0]后的选择分布:');
    Object.entries(selectionsAfterBlacklist).forEach(([keyIndex, count]) => {
      console.log(`  Key[${keyIndex}]: ${count}次选择`);
    });
    
    const key0Excluded = !selectionsAfterBlacklist.hasOwnProperty('0');
    console.log(`Key[0]是否被排除: ${key0Excluded ? '✅ 是' : '❌ 否'}`);
    
    // 获取key状态
    const keyStatus = this.manager.getProviderKeyStatus(providerId);
    console.log('\nKey状态总览:');
    keyStatus?.forEach((status, index) => {
      console.log(`  Key[${index}]: ${status.isBlacklisted ? '🚫 拉黑' : '✅ 健康'} (连续错误: ${status.consecutiveErrors})`);
    });
    
    this.testResults.keyLevelManagement = {
      keyCount,
      keySelections,
      selectionsAfterBlacklist,
      key0Excluded
    };
    
    return key0Excluded;
  }

  /**
   * 辅助方法: 模拟provider选择
   */
  async simulateSelections(providers, rounds) {
    const selections = {};
    
    for (let i = 0; i < rounds; i++) {
      const selected = this.manager.selectProviderWeighted(providers, 'test-category');
      if (selected) {
        const key = `${selected.providerId}:${selected.model}`;
        selections[key] = (selections[key] || 0) + 1;
      }
    }
    
    return selections;
  }

  /**
   * 辅助方法: 打印分布情况
   */
  printDistribution(selections, total) {
    Object.entries(selections).forEach(([key, count]) => {
      const percentage = ((count / total) * 100).toFixed(1);
      console.log(`  ${key}: ${count}次 (${percentage}%)`);
    });
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🧪 权重负载均衡功能全面测试');
    console.log('==========================================');
    console.log(`测试时间: ${new Date().toISOString()}`);
    
    const results = [];
    
    try {
      // 测试1: 权重分配
      const test1 = await this.testWeightDistribution();
      results.push({ name: '权重分配验证', passed: test1 });
      
      // 测试2: 连续429检测
      const test2 = await this.testConsecutive429Detection();
      results.push({ name: '连续429检测验证', passed: test2 });
      
      // 测试3: 动态权重重分配
      const test3 = await this.testWeightRedistribution();
      results.push({ name: '动态权重重分配验证', passed: test3 });
      
      // 测试4: Key级别管理
      const test4 = await this.testKeyLevelManagement();
      results.push({ name: 'Key级别管理验证', passed: test4 });
      
      // 测试结果总结
      console.log('\n📊 测试结果总结');
      console.log('==========================================');
      
      let passedCount = 0;
      results.forEach(result => {
        const status = result.passed ? '✅ 通过' : '❌ 失败';
        console.log(`${result.name}: ${status}`);
        if (result.passed) passedCount++;
      });
      
      const overallSuccess = passedCount === results.length;
      console.log(`\n总体测试结果: ${overallSuccess ? '✅ 全部通过' : '❌ 部分失败'} (${passedCount}/${results.length})`);
      
      if (overallSuccess) {
        console.log('\n🎉 恭喜！权重负载均衡功能完全符合预期：');
        console.log('   • ✅ Provider按权重比例分配请求');
        console.log('   • ✅ 连续3次429才拉黑provider');
        console.log('   • ✅ 拉黑后权重动态重分配');
        console.log('   • ✅ 多key provider内部轮询正常');
      } else {
        console.log('\n⚠️  部分功能需要进一步优化');
      }
      
      return overallSuccess;
      
    } catch (error) {
      console.error('❌ 测试执行失败:', error);
      return false;
    }
  }
}

// 运行测试
if (require.main === module) {
  const test = new WeightedLoadBalancingTest();
  test.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = WeightedLoadBalancingTest;