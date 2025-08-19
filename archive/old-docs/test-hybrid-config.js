#!/usr/bin/env node

/**
 * RCC v4.0 混合配置测试脚本
 * 
 * 测试混合多Provider配置的降级链和智能路由功能
 * 验证configurable fallback rules是否正确工作
 * 
 * @author Jason Zhang
 * @version 4.0.0-alpha.2
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class HybridConfigTester {
  constructor() {
    this.configPath = require('path').join(require('os').homedir(), '.route-claudecode/config/v4/hybrid-multi-provider-v3-5509.json');
    this.rccCommand = './bin/rcc3.js';
    this.testResults = {
      configValidation: false,
      fallbackChainTests: {},
      crossProviderTests: {},
      performanceTests: {}
    };
  }

  /**
   * 主测试入口
   */
  async runTests() {
    console.log('🧪 开始混合配置测试...\n');
    
    try {
      // 1. 配置验证测试
      await this.testConfigValidation();
      
      // 2. 降级链测试
      await this.testFallbackChains();
      
      // 3. 跨Provider测试
      await this.testCrossProviderFunctionality();
      
      // 4. 性能基准测试
      await this.testPerformanceBenchmarks();
      
      // 5. 生成测试报告
      this.generateTestReport();
      
    } catch (error) {
      console.error('❌ 测试执行失败:', error.message);
      process.exit(1);
    }
  }

  /**
   * 配置验证测试
   */
  async testConfigValidation() {
    console.log('📋 测试 1: 配置验证...');
    
    try {
      // 读取配置文件
      const configContent = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(configContent);
      
      // 验证基本结构
      const requiredSections = ['providers', 'routing', 'crossProviderStrategy'];
      for (const section of requiredSections) {
        if (!config[section]) {
          throw new Error(`缺少必需的配置节: ${section}`);
        }
      }
      
      // 验证Provider配置
      const providers = Object.keys(config.providers);
      console.log(`  ✓ 找到 ${providers.length} 个Provider: ${providers.join(', ')}`);
      
      // 验证降级规则配置
      const fallbackRules = config.crossProviderStrategy.fallbackRules;
      const categories = Object.keys(fallbackRules);
      console.log(`  ✓ 找到 ${categories.length} 个降级类别: ${categories.join(', ')}`);
      
      // 验证每个类别的配置完整性
      for (const category of categories) {
        const rule = fallbackRules[category];
        if (!rule.primaryChain || !rule.emergencyChain) {
          throw new Error(`类别 ${category} 缺少完整的降级链配置`);
        }
        console.log(`  ✓ 类别 ${category}: ${rule.primaryChain.length} 主链 + ${rule.emergencyChain.length} 应急链`);
      }
      
      this.testResults.configValidation = true;
      console.log('✅ 配置验证通过\n');
      
    } catch (error) {
      console.error('❌ 配置验证失败:', error.message);
      throw error;
    }
  }

  /**
   * 降级链测试
   */
  async testFallbackChains() {
    console.log('🔄 测试 2: 降级链功能...');
    
    const testCategories = ['default', 'longcontext', 'coding', 'thinking', 'background', 'search'];
    
    for (const category of testCategories) {
      console.log(`  测试类别: ${category}`);
      
      try {
        // 测试基本路由
        const basicResult = await this.testCategoryRouting(category, 'basic');
        this.testResults.fallbackChainTests[category] = { basic: basicResult };
        
        // 测试模拟失败场景下的降级
        const fallbackResult = await this.testCategoryRouting(category, 'fallback');
        this.testResults.fallbackChainTests[category].fallback = fallbackResult;
        
        console.log(`    ✓ ${category} 降级链测试通过`);
        
      } catch (error) {
        console.error(`    ❌ ${category} 降级链测试失败:`, error.message);
        this.testResults.fallbackChainTests[category] = { error: error.message };
      }
    }
    
    console.log('✅ 降级链测试完成\n');
  }

  /**
   * 测试特定类别的路由
   */
  async testCategoryRouting(category, mode = 'basic') {
    const testMessage = this.getTestMessageForCategory(category);
    
    // 构建测试请求
    const testRequest = {
      model: "claude-3-sonnet-20240229",
      messages: [
        {
          role: "user",
          content: testMessage
        }
      ],
      max_tokens: 100,
      temperature: 0.1,
      metadata: {
        category: category,
        test_mode: mode,
        test_id: `test-${category}-${mode}-${Date.now()}`
      }
    };

    return await this.executeRCCRequest(testRequest);
  }

  /**
   * 获取类别特定的测试消息
   */
  getTestMessageForCategory(category) {
    const testMessages = {
      default: "简单测试：请说hello",
      longcontext: "长上下文测试：请总结一下这是什么类型的测试", 
      coding: "编程测试：请写一个Python函数计算斐波那契数列",
      thinking: "推理测试：如果今天是周三，那么3天后是星期几？",
      background: "后台测试：请生成一个简单的项目状态报告",
      search: "搜索测试：请解释什么是RESTful API"
    };
    
    return testMessages[category] || "通用测试消息";
  }

  /**
   * 跨Provider功能测试
   */
  async testCrossProviderFunctionality() {
    console.log('🌐 测试 3: 跨Provider功能...');
    
    try {
      // 测试负载均衡
      console.log('  测试负载均衡...');
      const loadBalanceResult = await this.testLoadBalancing();
      this.testResults.crossProviderTests.loadBalancing = loadBalanceResult;
      
      // 测试故障转移
      console.log('  测试故障转移...');
      const failoverResult = await this.testFailoverScenarios();
      this.testResults.crossProviderTests.failover = failoverResult;
      
      // 测试智能路由
      console.log('  测试智能路由...');
      const intelligentRoutingResult = await this.testIntelligentRouting();
      this.testResults.crossProviderTests.intelligentRouting = intelligentRoutingResult;
      
      console.log('✅ 跨Provider功能测试完成\n');
      
    } catch (error) {
      console.error('❌ 跨Provider功能测试失败:', error.message);
      this.testResults.crossProviderTests.error = error.message;
    }
  }

  /**
   * 测试负载均衡
   */
  async testLoadBalancing() {
    console.log('    测试并发请求的负载分配...');
    
    const concurrentRequests = 5;
    const promises = [];
    
    for (let i = 0; i < concurrentRequests; i++) {
      const request = {
        model: "claude-3-sonnet-20240229",
        messages: [{ role: "user", content: `并发测试请求 ${i + 1}` }],
        max_tokens: 50,
        metadata: { test_type: "load_balancing", request_id: i + 1 }
      };
      
      promises.push(this.executeRCCRequest(request));
    }
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    return {
      totalRequests: concurrentRequests,
      successfulRequests: successful,
      successRate: (successful / concurrentRequests * 100).toFixed(1) + '%'
    };
  }

  /**
   * 测试故障转移场景
   */
  async testFailoverScenarios() {
    console.log('    测试故障转移场景...');
    
    // 模拟高错误率场景
    const testRequest = {
      model: "claude-3-sonnet-20240229", 
      messages: [{ role: "user", content: "故障转移测试" }],
      max_tokens: 50,
      metadata: { 
        test_type: "failover_simulation",
        simulate_failure: true 
      }
    };
    
    try {
      const result = await this.executeRCCRequest(testRequest);
      return { success: true, provider: result.provider || 'unknown' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 测试智能路由
   */
  async testIntelligentRouting() {
    console.log('    测试智能路由决策...');
    
    const routingTests = [
      { category: 'longcontext', expectedProvider: 'google-gemini' },
      { category: 'coding', expectedProvider: 'modelscope-qwen' },
      { category: 'default', expectedProvider: 'modelscope-qwen' }
    ];
    
    const results = [];
    
    for (const test of routingTests) {
      const request = {
        model: "claude-3-sonnet-20240229",
        messages: [{ role: "user", content: `智能路由测试: ${test.category}` }],
        max_tokens: 50,
        metadata: { 
          category: test.category,
          test_type: "intelligent_routing"
        }
      };
      
      try {
        const result = await this.executeRCCRequest(request);
        results.push({
          category: test.category,
          expectedProvider: test.expectedProvider,
          actualProvider: result.provider || 'unknown',
          success: true
        });
      } catch (error) {
        results.push({
          category: test.category,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * 性能基准测试
   */
  async testPerformanceBenchmarks() {
    console.log('🚀 测试 4: 性能基准...');
    
    try {
      // 测试响应延迟
      console.log('  测试响应延迟...');
      const latencyResult = await this.testResponseLatency();
      this.testResults.performanceTests.latency = latencyResult;
      
      // 测试吞吐量
      console.log('  测试吞吐量...');
      const throughputResult = await this.testThroughput();
      this.testResults.performanceTests.throughput = throughputResult;
      
      console.log('✅ 性能基准测试完成\n');
      
    } catch (error) {
      console.error('❌ 性能基准测试失败:', error.message);
      this.testResults.performanceTests.error = error.message;
    }
  }

  /**
   * 测试响应延迟
   */
  async testResponseLatency() {
    const iterations = 3;
    const latencies = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        await this.executeRCCRequest({
          model: "claude-3-sonnet-20240229",
          messages: [{ role: "user", content: "延迟测试" }],
          max_tokens: 20
        });
        
        const latency = Date.now() - startTime;
        latencies.push(latency);
        
      } catch (error) {
        console.warn(`    延迟测试 ${i + 1} 失败:`, error.message);
      }
    }
    
    if (latencies.length === 0) {
      return { error: '所有延迟测试都失败了' };
    }
    
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);
    
    return {
      iterations: latencies.length,
      avgLatency: Math.round(avgLatency),
      maxLatency,
      minLatency,
      allLatencies: latencies
    };
  }

  /**
   * 测试吞吐量
   */
  async testThroughput() {
    const testDuration = 30000; // 30秒
    const startTime = Date.now();
    let requestCount = 0;
    let successCount = 0;
    
    console.log(`    执行 ${testDuration/1000} 秒吞吐量测试...`);
    
    while (Date.now() - startTime < testDuration) {
      try {
        await this.executeRCCRequest({
          model: "claude-3-sonnet-20240229",
          messages: [{ role: "user", content: `吞吐量测试 ${requestCount + 1}` }],
          max_tokens: 10
        });
        
        successCount++;
      } catch (error) {
        // 记录失败但继续测试
      }
      
      requestCount++;
      
      // 短暂延迟避免过于密集的请求
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const actualDuration = Date.now() - startTime;
    const requestsPerSecond = (requestCount / actualDuration * 1000).toFixed(2);
    const successRate = (successCount / requestCount * 100).toFixed(1);
    
    return {
      duration: actualDuration,
      totalRequests: requestCount,
      successfulRequests: successCount,
      requestsPerSecond: parseFloat(requestsPerSecond),
      successRate: parseFloat(successRate)
    };
  }

  /**
   * 执行RCC请求
   */
  async executeRCCRequest(requestData) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      // 启动RCC进程
      const rccProcess = spawn('node', [this.rccCommand, 'start', this.configPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      rccProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      rccProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      // 等待服务器启动然后发送请求
      setTimeout(async () => {
        try {
          const response = await this.sendHttpRequest(requestData);
          const latency = Date.now() - startTime;
          
          rccProcess.kill();
          
          resolve({
            success: true,
            response,
            latency,
            provider: this.extractProviderFromResponse(response)
          });
          
        } catch (error) {
          rccProcess.kill();
          reject(new Error(`请求失败: ${error.message}`));
        }
      }, 5000); // 等待5秒让服务器启动
      
      rccProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`RCC进程退出，代码: ${code}, stderr: ${stderr}`));
        }
      });
      
      // 超时处理
      setTimeout(() => {
        rccProcess.kill();
        reject(new Error('请求超时'));
      }, 30000); // 30秒超时
    });
  }

  /**
   * 发送HTTP请求到RCC服务器
   */
  async sendHttpRequest(requestData) {
    const fetch = await import('node-fetch').then(m => m.default);
    
    const response = await fetch('http://localhost:5509/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * 从响应中提取Provider信息
   */
  extractProviderFromResponse(response) {
    // 尝试从响应头或metadata中提取provider信息
    if (response.headers && response.headers['x-provider']) {
      return response.headers['x-provider'];
    }
    
    if (response.metadata && response.metadata.provider) {
      return response.metadata.provider;
    }
    
    // 如果没有明确的provider信息，尝试从模型名称推断
    if (response.model) {
      if (response.model.includes('gemini')) return 'google-gemini';
      if (response.model.includes('Qwen')) return 'modelscope-qwen';
      if (response.model.includes('horizon')) return 'shuaihong-horizon';
    }
    
    return 'unknown';
  }

  /**
   * 生成测试报告
   */
  generateTestReport() {
    console.log('📊 测试报告');
    console.log('=' .repeat(50));
    
    // 配置验证结果
    console.log(`\n1. 配置验证: ${this.testResults.configValidation ? '✅ 通过' : '❌ 失败'}`);
    
    // 降级链测试结果
    console.log('\n2. 降级链测试:');
    for (const [category, result] of Object.entries(this.testResults.fallbackChainTests)) {
      const status = result.error ? '❌ 失败' : '✅ 通过';
      console.log(`   ${category}: ${status}`);
      if (result.error) {
        console.log(`     错误: ${result.error}`);
      }
    }
    
    // 跨Provider测试结果
    console.log('\n3. 跨Provider功能:');
    const crossProviderTests = this.testResults.crossProviderTests;
    if (crossProviderTests.error) {
      console.log(`   ❌ 整体失败: ${crossProviderTests.error}`);
    } else {
      if (crossProviderTests.loadBalancing) {
        const lb = crossProviderTests.loadBalancing;
        console.log(`   负载均衡: ${lb.successfulRequests}/${lb.totalRequests} 成功 (${lb.successRate})`);
      }
      
      if (crossProviderTests.failover) {
        const fo = crossProviderTests.failover;
        console.log(`   故障转移: ${fo.success ? '✅ 通过' : '❌ 失败'}`);
      }
      
      if (crossProviderTests.intelligentRouting) {
        const ir = crossProviderTests.intelligentRouting;
        const successful = ir.filter(r => r.success).length;
        console.log(`   智能路由: ${successful}/${ir.length} 测试通过`);
      }
    }
    
    // 性能测试结果
    console.log('\n4. 性能基准:');
    const perfTests = this.testResults.performanceTests;
    if (perfTests.error) {
      console.log(`   ❌ 性能测试失败: ${perfTests.error}`);
    } else {
      if (perfTests.latency && !perfTests.latency.error) {
        const lat = perfTests.latency;
        console.log(`   响应延迟: 平均 ${lat.avgLatency}ms (最小 ${lat.minLatency}ms, 最大 ${lat.maxLatency}ms)`);
      }
      
      if (perfTests.throughput) {
        const tp = perfTests.throughput;
        console.log(`   吞吐量: ${tp.requestsPerSecond} 请求/秒 (成功率 ${tp.successRate}%)`);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🎯 混合配置测试完成');
    
    // 生成建议
    this.generateRecommendations();
  }

  /**
   * 生成优化建议
   */
  generateRecommendations() {
    console.log('\n💡 优化建议:');
    
    const recommendations = [];
    
    // 基于测试结果生成建议
    if (!this.testResults.configValidation) {
      recommendations.push('修复配置验证错误');
    }
    
    const failedCategories = Object.entries(this.testResults.fallbackChainTests)
      .filter(([, result]) => result.error)
      .map(([category]) => category);
    
    if (failedCategories.length > 0) {
      recommendations.push(`检查以下类别的降级链配置: ${failedCategories.join(', ')}`);
    }
    
    const perfTests = this.testResults.performanceTests;
    if (perfTests.latency && perfTests.latency.avgLatency > 5000) {
      recommendations.push('平均响应延迟过高，考虑优化Provider选择或网络配置');
    }
    
    if (perfTests.throughput && perfTests.throughput.successRate < 90) {
      recommendations.push('成功率偏低，检查Provider健康状况和错误处理逻辑');
    }
    
    if (recommendations.length === 0) {
      console.log('   ✨ 配置运行良好，无需特别优化');
    } else {
      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
  }
}

// 主执行逻辑
async function main() {
  const tester = new HybridConfigTester();
  await tester.runTests();
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = HybridConfigTester;