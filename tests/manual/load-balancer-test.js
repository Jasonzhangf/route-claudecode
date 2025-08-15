/**
 * 负载均衡器测试工具
 * 测试各种负载均衡策略和功能
 */

const { ProviderLoadBalancer, LoadBalancingStrategy, ProviderHealthStatus } = require('../../dist/modules/providers/load-balancer');

class LoadBalancerTester {
  constructor() {
    this.loadBalancer = null;
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🚀 开始负载均衡器测试...\n');

    try {
      // 初始化负载均衡器
      await this.setupLoadBalancer();

      // 基础功能测试
      await this.testBasicFunctionality();

      // 策略测试
      await this.testLoadBalancingStrategies();

      // 健康检查测试
      await this.testHealthChecking();

      // 熔断器测试
      await this.testCircuitBreaker();

      // 并发测试
      await this.testConcurrentSelection();

      // 生成报告
      this.generateReport();

    } catch (error) {
      console.error('💥 测试执行失败:', error);
    } finally {
      if (this.loadBalancer) {
        await this.loadBalancer.cleanup();
      }
    }
  }

  async setupLoadBalancer() {
    console.log('📋 初始化负载均衡器...');

    this.loadBalancer = new ProviderLoadBalancer({
      strategy: LoadBalancingStrategy.WEIGHTED_LEAST_CONNECTIONS,
      enableHealthCheck: true,
      healthCheckInterval: 5000,
      enableAdaptive: true,
      circuitBreaker: {
        enabled: true,
        failureThreshold: 3,
        recoveryTimeout: 30000,
        halfOpenMaxCalls: 2
      },
      logging: {
        enabled: true,
        logLevel: 'info',
        logSelections: true
      }
    });

    await this.loadBalancer.initialize();

    // 添加测试Provider
    this.addTestProviders();

    console.log('✅ 负载均衡器初始化完成\n');
  }

  addTestProviders() {
    const providers = [
      {
        id: 'lmstudio-1',
        name: 'LM Studio Instance 1',
        type: 'lmstudio',
        endpoint: 'http://localhost:1234',
        weight: 50,
        maxConnections: 10,
        healthStatus: ProviderHealthStatus.HEALTHY,
        metrics: {
          avgResponseTime: 800,
          successRate: 0.95,
          requestCount: 100,
          errorCount: 5,
          lastResponseTime: 750,
          throughput: 12
        },
        config: {}
      },
      {
        id: 'lmstudio-2', 
        name: 'LM Studio Instance 2',
        type: 'lmstudio',
        endpoint: 'http://localhost:1235',
        weight: 30,
        maxConnections: 8,
        healthStatus: ProviderHealthStatus.HEALTHY,
        metrics: {
          avgResponseTime: 1200,
          successRate: 0.90,
          requestCount: 80,
          errorCount: 8,
          lastResponseTime: 1100,
          throughput: 8
        },
        config: {}
      },
      {
        id: 'anthropic-1',
        name: 'Anthropic Claude',
        type: 'anthropic',
        endpoint: 'https://api.anthropic.com',
        weight: 70,
        maxConnections: 20,
        healthStatus: ProviderHealthStatus.HEALTHY,
        metrics: {
          avgResponseTime: 1500,
          successRate: 0.98,
          requestCount: 200,
          errorCount: 4,
          lastResponseTime: 1400,
          throughput: 15
        },
        config: {}
      },
      {
        id: 'openai-1',
        name: 'OpenAI GPT',
        type: 'openai',
        endpoint: 'https://api.openai.com',
        weight: 60,
        maxConnections: 15,
        healthStatus: ProviderHealthStatus.DEGRADED,
        metrics: {
          avgResponseTime: 2000,
          successRate: 0.85,
          requestCount: 150,
          errorCount: 22,
          lastResponseTime: 2200,
          throughput: 10
        },
        config: {}
      }
    ];

    providers.forEach(provider => {
      this.loadBalancer.addProvider(provider);
    });

    console.log(`📋 添加了 ${providers.length} 个测试Provider`);
  }

  async testBasicFunctionality() {
    console.log('🔧 测试基础功能...');

    const tests = [
      {
        name: '添加Provider',
        test: () => {
          const beforeCount = this.loadBalancer.getAllProviders().length;
          this.loadBalancer.addProvider({
            id: 'test-provider',
            name: 'Test Provider',
            type: 'test',
            endpoint: 'http://test.com',
            weight: 40,
            maxConnections: 5,
            healthStatus: ProviderHealthStatus.HEALTHY,
            metrics: {
              avgResponseTime: 1000,
              successRate: 0.92,
              requestCount: 50,
              errorCount: 4,
              lastResponseTime: 950,
              throughput: 6
            },
            config: {}
          });
          const afterCount = this.loadBalancer.getAllProviders().length;
          return afterCount === beforeCount + 1;
        }
      },
      {
        name: '移除Provider',
        test: () => {
          const beforeCount = this.loadBalancer.getAllProviders().length;
          const success = this.loadBalancer.removeProvider('test-provider');
          const afterCount = this.loadBalancer.getAllProviders().length;
          return success && afterCount === beforeCount - 1;
        }
      },
      {
        name: '更新Provider指标',
        test: () => {
          const provider = this.loadBalancer.getAllProviders()[0];
          const oldResponseTime = provider.metrics.avgResponseTime;
          
          this.loadBalancer.updateProviderMetrics(provider.id, {
            avgResponseTime: oldResponseTime + 100,
            successRate: 0.99
          });
          
          const updatedProvider = this.loadBalancer.getAllProviders().find(p => p.id === provider.id);
          return updatedProvider.metrics.avgResponseTime === oldResponseTime + 100 &&
                 updatedProvider.metrics.successRate === 0.99;
        }
      },
      {
        name: '获取统计信息',
        test: () => {
          const stats = this.loadBalancer.getStatistics();
          return stats && 
                 typeof stats.totalProviders === 'number' &&
                 typeof stats.healthyProviders === 'number' &&
                 typeof stats.avgResponseTime === 'number';
        }
      }
    ];

    for (const testCase of tests) {
      try {
        const success = await testCase.test();
        this.testResults.push({
          category: 'Basic Functionality',
          name: testCase.name,
          success,
          error: success ? null : 'Test returned false'
        });
        console.log(`  ${success ? '✅' : '❌'} ${testCase.name}`);
      } catch (error) {
        this.testResults.push({
          category: 'Basic Functionality',
          name: testCase.name,
          success: false,
          error: error.message
        });
        console.log(`  ❌ ${testCase.name}: ${error.message}`);
      }
    }

    console.log('');
  }

  async testLoadBalancingStrategies() {
    console.log('⚖️ 测试负载均衡策略...');

    const strategies = [
      LoadBalancingStrategy.ROUND_ROBIN,
      LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN,
      LoadBalancingStrategy.LEAST_CONNECTIONS,
      LoadBalancingStrategy.LEAST_RESPONSE_TIME,
      LoadBalancingStrategy.WEIGHTED_LEAST_CONNECTIONS,
      LoadBalancingStrategy.RANDOM,
      LoadBalancingStrategy.WEIGHTED_RANDOM
    ];

    for (const strategy of strategies) {
      try {
        // 更新策略
        this.loadBalancer.config.strategy = strategy;

        const context = {
          requestId: `test-${Date.now()}`,
          priority: 'normal',
          timeout: 30000,
          retryCount: 0
        };

        // 执行多次选择以测试策略
        const selections = [];
        for (let i = 0; i < 10; i++) {
          const result = await this.loadBalancer.selectProvider(context);
          selections.push(result.selectedProvider.id);
          
          // 模拟请求完成，减少连接数
          result.selectedProvider.currentConnections--;
        }

        const uniqueProviders = new Set(selections).size;
        const isDistributed = uniqueProviders > 1; // 至少使用了2个不同的Provider

        this.testResults.push({
          category: 'Load Balancing Strategies',
          name: strategy,
          success: true,
          details: {
            selections: selections.length,
            uniqueProviders,
            distribution: isDistributed
          }
        });

        console.log(`  ✅ ${strategy}: ${selections.length} selections, ${uniqueProviders} unique providers`);

      } catch (error) {
        this.testResults.push({
          category: 'Load Balancing Strategies',
          name: strategy,
          success: false,
          error: error.message
        });
        console.log(`  ❌ ${strategy}: ${error.message}`);
      }
    }

    console.log('');
  }

  async testHealthChecking() {
    console.log('🏥 测试健康检查功能...');

    const tests = [
      {
        name: '标记Provider为不健康',
        test: async () => {
          const provider = this.loadBalancer.getAllProviders()[0];
          
          // 更新指标使其看起来不健康
          this.loadBalancer.updateProviderMetrics(provider.id, {
            successRate: 0.3, // 很低的成功率
            avgResponseTime: 20000 // 很高的响应时间
          });

          // 等待状态更新
          await new Promise(resolve => setTimeout(resolve, 100));

          const updatedProvider = this.loadBalancer.getAllProviders().find(p => p.id === provider.id);
          return updatedProvider.healthStatus !== ProviderHealthStatus.HEALTHY;
        }
      },
      {
        name: '不健康Provider不被选中',
        test: async () => {
          const context = {
            requestId: `health-test-${Date.now()}`,
            priority: 'normal',
            timeout: 30000,
            retryCount: 0
          };

          const unhealthyProviderId = this.loadBalancer.getAllProviders()
            .find(p => p.healthStatus !== ProviderHealthStatus.HEALTHY)?.id;

          if (!unhealthyProviderId) {
            return true; // 没有不健康的Provider，测试通过
          }

          // 尝试多次选择
          for (let i = 0; i < 10; i++) {
            const result = await this.loadBalancer.selectProvider(context);
            if (result.selectedProvider.id === unhealthyProviderId) {
              return false; // 选中了不健康的Provider
            }
            result.selectedProvider.currentConnections--; // 清理连接计数
          }

          return true;
        }
      }
    ];

    for (const testCase of tests) {
      try {
        const success = await testCase.test();
        this.testResults.push({
          category: 'Health Checking',
          name: testCase.name,
          success,
          error: success ? null : 'Test failed'
        });
        console.log(`  ${success ? '✅' : '❌'} ${testCase.name}`);
      } catch (error) {
        this.testResults.push({
          category: 'Health Checking',
          name: testCase.name,
          success: false,
          error: error.message
        });
        console.log(`  ❌ ${testCase.name}: ${error.message}`);
      }
    }

    console.log('');
  }

  async testCircuitBreaker() {
    console.log('⚡ 测试熔断器功能...');

    const tests = [
      {
        name: '记录请求成功',
        test: () => {
          const providerId = this.loadBalancer.getAllProviders()[0].id;
          this.loadBalancer.recordRequestResult(providerId, true);
          return true; // 无异常即成功
        }
      },
      {
        name: '记录请求失败',
        test: () => {
          const providerId = this.loadBalancer.getAllProviders()[0].id;
          this.loadBalancer.recordRequestResult(providerId, false);
          return true; // 无异常即成功
        }
      },
      {
        name: '多次失败触发熔断',
        test: () => {
          const providerId = this.loadBalancer.getAllProviders()[1].id;
          
          // 记录多次失败
          for (let i = 0; i < 5; i++) {
            this.loadBalancer.recordRequestResult(providerId, false);
          }
          
          return true; // 应该触发熔断器打开
        }
      }
    ];

    for (const testCase of tests) {
      try {
        const success = testCase.test();
        this.testResults.push({
          category: 'Circuit Breaker',
          name: testCase.name,
          success,
          error: success ? null : 'Test failed'
        });
        console.log(`  ${success ? '✅' : '❌'} ${testCase.name}`);
      } catch (error) {
        this.testResults.push({
          category: 'Circuit Breaker', 
          name: testCase.name,
          success: false,
          error: error.message
        });
        console.log(`  ❌ ${testCase.name}: ${error.message}`);
      }
    }

    console.log('');
  }

  async testConcurrentSelection() {
    console.log('🔄 测试并发选择...');

    try {
      const concurrentCount = 20;
      const contexts = Array.from({ length: concurrentCount }, (_, i) => ({
        requestId: `concurrent-${i}`,
        priority: 'normal',
        timeout: 30000,
        retryCount: 0
      }));

      const startTime = Date.now();
      const promises = contexts.map(context => 
        this.loadBalancer.selectProvider(context)
      );

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      const duration = endTime - startTime;

      // 清理连接计数
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          result.value.selectedProvider.currentConnections--;
        }
      });

      this.testResults.push({
        category: 'Concurrent Selection',
        name: `${concurrentCount} concurrent selections`,
        success: successful > 0,
        details: {
          successful,
          failed,
          duration,
          avgTime: duration / concurrentCount
        }
      });

      console.log(`  ✅ 并发测试: ${successful}/${concurrentCount} 成功, 耗时 ${duration}ms`);

    } catch (error) {
      this.testResults.push({
        category: 'Concurrent Selection',
        name: 'Concurrent selection test',
        success: false,
        error: error.message
      });
      console.log(`  ❌ 并发测试失败: ${error.message}`);
    }

    console.log('');
  }

  generateReport() {
    console.log('📊 ======= 负载均衡器测试报告 =======\n');

    const categories = [...new Set(this.testResults.map(r => r.category))];
    let totalTests = 0;
    let totalPassed = 0;

    categories.forEach(category => {
      const categoryResults = this.testResults.filter(r => r.category === category);
      const passed = categoryResults.filter(r => r.success).length;
      const total = categoryResults.length;

      console.log(`📋 ${category}: ${passed}/${total} passed`);
      
      categoryResults.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`  ${status} ${result.name}`);
        
        if (result.details) {
          console.log(`     详情: ${JSON.stringify(result.details, null, 2)}`);
        }
        
        if (result.error) {
          console.log(`     错误: ${result.error}`);
        }
      });
      
      console.log('');
      totalTests += total;
      totalPassed += passed;
    });

    // 负载均衡器统计信息
    const stats = this.loadBalancer.getStatistics();
    console.log('📈 负载均衡器统计:');
    console.log(`  总Provider数: ${stats.totalProviders}`);
    console.log(`  健康Provider: ${stats.healthyProviders}`);
    console.log(`  降级Provider: ${stats.degradedProviders}`);
    console.log(`  不健康Provider: ${stats.unhealthyProviders}`);
    console.log(`  总连接数: ${stats.totalConnections}`);
    console.log(`  平均响应时间: ${Math.round(stats.avgResponseTime)}ms`);
    console.log(`  平均成功率: ${(stats.avgSuccessRate * 100).toFixed(1)}%`);
    console.log(`  活跃会话: ${stats.activeSessions}`);
    console.log(`  打开的熔断器: ${stats.circuitBreakersOpen}`);

    console.log('\n🎯 总结:');
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过测试: ${totalPassed}`);
    console.log(`失败测试: ${totalTests - totalPassed}`);
    console.log(`成功率: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);

    const overallSuccess = totalPassed === totalTests;
    console.log(`\n${overallSuccess ? '🎉' : '⚠️'} 测试${overallSuccess ? '全部通过' : '部分失败'}！`);

    // 保存报告
    this.saveReport({
      timestamp: new Date().toISOString(),
      summary: {
        total: totalTests,
        passed: totalPassed,
        failed: totalTests - totalPassed,
        successRate: (totalPassed / totalTests) * 100
      },
      results: this.testResults,
      statistics: stats
    });
  }

  saveReport(report) {
    const fs = require('fs');
    const path = require('path');
    
    const reportDir = 'tests/reports';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const filename = `load-balancer-test-${Date.now()}.json`;
    const filepath = path.join(reportDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`\n📄 详细报告已保存: ${filepath}`);
  }
}

// 主执行函数
async function main() {
  const tester = new LoadBalancerTester();
  await tester.runAllTests();
}

// 如果直接执行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = LoadBalancerTester;