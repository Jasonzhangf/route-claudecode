/**
 * 负载均衡器集成演示
 * 展示负载均衡器如何与Provider系统集成工作
 */

const { ProviderLoadBalancer, LoadBalancingStrategy, ProviderHealthStatus } = require('../../dist/modules/providers/load-balancer');

class LoadBalancerIntegrationDemo {
  constructor() {
    this.loadBalancer = null;
    this.requestCounter = 0;
  }

  async runDemo() {
    console.log('🎯 负载均衡器集成演示\n');

    try {
      await this.setupSystem();
      await this.demonstrateFeatures();
    } catch (error) {
      console.error('💥 演示执行失败:', error);
    } finally {
      if (this.loadBalancer) {
        await this.loadBalancer.cleanup();
      }
    }
  }

  async setupSystem() {
    console.log('🔧 设置负载均衡系统...');

    // 创建负载均衡器
    this.loadBalancer = new ProviderLoadBalancer({
      strategy: LoadBalancingStrategy.WEIGHTED_LEAST_CONNECTIONS,
      enableHealthCheck: true,
      healthCheckInterval: 10000,
      enableAdaptive: true,
      stickySessions: true,
      sessionTtl: 300000,
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

    // 添加真实的Provider配置
    this.addRealProviders();

    // 设置事件监听
    this.setupEventListeners();

    console.log('✅ 系统设置完成\n');
  }

  addRealProviders() {
    const providers = [
      {
        id: 'lmstudio-local',
        name: 'LM Studio Local',
        type: 'lmstudio',
        endpoint: 'http://localhost:1234',
        region: 'local',
        weight: 80, // 本地优先
        maxConnections: 10,
        healthStatus: ProviderHealthStatus.HEALTHY,
        metrics: {
          avgResponseTime: 800,
          successRate: 0.95,
          requestCount: 0,
          errorCount: 0,
          lastResponseTime: 800,
          throughput: 0
        },
        config: {
          timeout: 30000,
          retries: 3
        }
      },
      {
        id: 'anthropic-claude',
        name: 'Anthropic Claude',
        type: 'anthropic',
        endpoint: 'https://api.anthropic.com/v1/messages',
        region: 'us-west',
        weight: 70,
        maxConnections: 20,
        healthStatus: ProviderHealthStatus.HEALTHY,
        metrics: {
          avgResponseTime: 1500,
          successRate: 0.98,
          requestCount: 0,
          errorCount: 0,
          lastResponseTime: 1500,
          throughput: 0
        },
        config: {
          timeout: 60000,
          retries: 2
        }
      },
      {
        id: 'openai-gpt4',
        name: 'OpenAI GPT-4',
        type: 'openai', 
        endpoint: 'https://api.openai.com/v1/chat/completions',
        region: 'us-east',
        weight: 60,
        maxConnections: 15,
        healthStatus: ProviderHealthStatus.HEALTHY,
        metrics: {
          avgResponseTime: 2000,
          successRate: 0.92,
          requestCount: 0,
          errorCount: 0,
          lastResponseTime: 2000,
          throughput: 0
        },
        config: {
          timeout: 45000,
          retries: 3
        }
      }
    ];

    providers.forEach(provider => {
      this.loadBalancer.addProvider(provider);
      console.log(`📋 添加Provider: ${provider.name} (权重: ${provider.weight})`);
    });
  }

  setupEventListeners() {
    this.loadBalancer.on('providerSelected', (result) => {
      console.log(`🎯 选择Provider: ${result.selectedProvider.name} (策略: ${result.strategy})`);
    });

    this.loadBalancer.on('providerHealthChanged', ({ providerId, oldStatus, newStatus }) => {
      console.log(`🏥 Provider健康状态变化: ${providerId} ${oldStatus} -> ${newStatus}`);
    });

    this.loadBalancer.on('circuitBreakerOpened', ({ providerId }) => {
      console.log(`⚡ 熔断器打开: ${providerId}`);
    });
  }

  async demonstrateFeatures() {
    console.log('🚀 开始功能演示...\n');

    // 演示1: 基础负载均衡
    await this.demo1_BasicLoadBalancing();

    // 演示2: 不同策略比较
    await this.demo2_StrategyComparison();

    // 演示3: 健康检查和故障处理
    await this.demo3_HealthCheckAndFailover();

    // 演示4: 粘性会话
    await this.demo4_StickySessions();

    // 演示5: 自适应负载均衡
    await this.demo5_AdaptiveLoadBalancing();

    // 演示6: 性能监控
    await this.demo6_PerformanceMonitoring();
  }

  async demo1_BasicLoadBalancing() {
    console.log('📊 演示1: 基础负载均衡');
    console.log('========================================');

    const requests = 10;
    const selections = new Map();

    for (let i = 0; i < requests; i++) {
      const context = this.createRequestContext(`basic-${i}`);
      const result = await this.loadBalancer.selectProvider(context);
      
      // 统计选择
      const providerId = result.selectedProvider.id;
      selections.set(providerId, (selections.get(providerId) || 0) + 1);

      // 模拟请求完成
      await this.simulateRequestCompletion(result.selectedProvider, true, 800 + Math.random() * 400);
    }

    console.log('\n📈 选择分布:');
    for (const [providerId, count] of selections) {
      const provider = this.loadBalancer.getAllProviders().find(p => p.id === providerId);
      console.log(`  ${provider.name}: ${count} 次 (${((count/requests)*100).toFixed(1)}%)`);
    }
    console.log('');
  }

  async demo2_StrategyComparison() {
    console.log('⚖️ 演示2: 不同策略比较');
    console.log('========================================');

    const strategies = [
      LoadBalancingStrategy.ROUND_ROBIN,
      LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN,
      LoadBalancingStrategy.LEAST_CONNECTIONS,
      LoadBalancingStrategy.LEAST_RESPONSE_TIME
    ];

    for (const strategy of strategies) {
      console.log(`\n🔄 测试策略: ${strategy}`);
      this.loadBalancer.config.strategy = strategy;

      const selections = new Map();
      const requestCount = 6;

      for (let i = 0; i < requestCount; i++) {
        const context = this.createRequestContext(`strategy-${strategy}-${i}`);
        const result = await this.loadBalancer.selectProvider(context);
        
        const providerId = result.selectedProvider.id;
        selections.set(providerId, (selections.get(providerId) || 0) + 1);

        // 模拟请求完成
        await this.simulateRequestCompletion(result.selectedProvider, true, 
          result.selectedProvider.metrics.avgResponseTime * (0.8 + Math.random() * 0.4));
      }

      console.log('  选择分布:');
      for (const [providerId, count] of selections) {
        const provider = this.loadBalancer.getAllProviders().find(p => p.id === providerId);
        console.log(`    ${provider.name}: ${count} 次`);
      }
    }
    console.log('');
  }

  async demo3_HealthCheckAndFailover() {
    console.log('🏥 演示3: 健康检查和故障转移');
    console.log('========================================');

    // 模拟一个Provider出现问题
    const problemProvider = this.loadBalancer.getAllProviders()[0];
    console.log(`🔧 模拟 ${problemProvider.name} 出现问题...`);

    // 更新指标使其看起来不健康
    this.loadBalancer.updateProviderMetrics(problemProvider.id, {
      avgResponseTime: 10000, // 10秒响应时间
      successRate: 0.3, // 30%成功率
      errorCount: problemProvider.metrics.errorCount + 20
    });

    console.log(`⚠️ ${problemProvider.name} 现在状态: ${problemProvider.healthStatus}`);

    // 测试故障转移
    console.log('\n🔄 测试故障转移...');
    const selections = new Map();

    for (let i = 0; i < 8; i++) {
      const context = this.createRequestContext(`failover-${i}`);
      const result = await this.loadBalancer.selectProvider(context);
      
      const providerId = result.selectedProvider.id;
      selections.set(providerId, (selections.get(providerId) || 0) + 1);

      await this.simulateRequestCompletion(result.selectedProvider, true, 
        result.selectedProvider.metrics.avgResponseTime);
    }

    console.log('\n📊 故障转移后的选择分布:');
    for (const [providerId, count] of selections) {
      const provider = this.loadBalancer.getAllProviders().find(p => p.id === providerId);
      console.log(`  ${provider.name}: ${count} 次 (健康状态: ${provider.healthStatus})`);
    }

    // 恢复Provider健康状态
    console.log(`\n🔧 恢复 ${problemProvider.name} 健康状态...`);
    this.loadBalancer.updateProviderMetrics(problemProvider.id, {
      avgResponseTime: 800,
      successRate: 0.95,
      errorCount: 0
    });
    console.log('');
  }

  async demo4_StickySessions() {
    console.log('🔒 演示4: 粘性会话');
    console.log('========================================');

    const sessionId = 'user-session-123';
    console.log(`👤 模拟用户会话: ${sessionId}`);

    const selections = [];

    // 同一会话的多个请求
    for (let i = 0; i < 5; i++) {
      const context = this.createRequestContext(`sticky-${i}`, sessionId);
      const result = await this.loadBalancer.selectProvider(context);
      
      selections.push({
        request: i + 1,
        provider: result.selectedProvider.name,
        reason: result.selectionReason
      });

      await this.simulateRequestCompletion(result.selectedProvider, true, 
        result.selectedProvider.metrics.avgResponseTime);
    }

    console.log('\n📋 会话请求分布:');
    selections.forEach(selection => {
      console.log(`  请求 ${selection.request}: ${selection.provider} (${selection.reason})`);
    });

    const uniqueProviders = new Set(selections.map(s => s.provider)).size;
    console.log(`\n🎯 使用了 ${uniqueProviders} 个不同的Provider (期望: 1个用于粘性会话)`);
    console.log('');
  }

  async demo5_AdaptiveLoadBalancing() {
    console.log('🧠 演示5: 自适应负载均衡');
    console.log('========================================');

    console.log('🔧 启用自适应模式...');
    this.loadBalancer.config.enableAdaptive = true;

    // 模拟高负载场景
    console.log('⚡ 模拟高负载场景...');
    const providers = this.loadBalancer.getAllProviders();
    providers.forEach(provider => {
      provider.currentConnections = Math.floor(provider.maxConnections * 0.9); // 90%负载
      this.loadBalancer.updateProviderMetrics(provider.id, {
        avgResponseTime: provider.metrics.avgResponseTime * 1.5 // 响应时间增加50%
      });
    });

    const selections = new Map();

    for (let i = 0; i < 10; i++) {
      const context = this.createRequestContext(`adaptive-${i}`);
      context.priority = i < 5 ? 'high' : 'normal';
      
      const result = await this.loadBalancer.selectProvider(context);
      
      const key = `${result.selectedProvider.name} (${result.strategy})`;
      selections.set(key, (selections.get(key) || 0) + 1);

      await this.simulateRequestCompletion(result.selectedProvider, true, 
        result.selectedProvider.metrics.avgResponseTime);
    }

    console.log('\n📊 自适应选择分布:');
    for (const [key, count] of selections) {
      console.log(`  ${key}: ${count} 次`);
    }

    // 恢复正常负载
    providers.forEach(provider => {
      provider.currentConnections = 0;
    });
    console.log('');
  }

  async demo6_PerformanceMonitoring() {
    console.log('📈 演示6: 性能监控');
    console.log('========================================');

    // 执行一些请求来生成性能数据
    console.log('📊 生成性能数据...');
    
    for (let i = 0; i < 20; i++) {
      const context = this.createRequestContext(`perf-${i}`);
      const result = await this.loadBalancer.selectProvider(context);
      
      // 模拟不同的响应时间和成功率
      const success = Math.random() > 0.1; // 90%成功率
      const responseTime = success ? 
        result.selectedProvider.metrics.avgResponseTime * (0.5 + Math.random()) :
        result.selectedProvider.metrics.avgResponseTime * 3;

      await this.simulateRequestCompletion(result.selectedProvider, success, responseTime);
    }

    // 显示性能统计
    const stats = this.loadBalancer.getStatistics();
    console.log('\n📊 系统性能统计:');
    console.log(`  总Provider数: ${stats.totalProviders}`);
    console.log(`  健康Provider: ${stats.healthyProviders}`);
    console.log(`  降级Provider: ${stats.degradedProviders}`);
    console.log(`  不健康Provider: ${stats.unhealthyProviders}`);
    console.log(`  平均响应时间: ${Math.round(stats.avgResponseTime)}ms`);
    console.log(`  平均成功率: ${(stats.avgSuccessRate * 100).toFixed(1)}%`);
    console.log(`  活跃会话: ${stats.activeSessions}`);

    console.log('\n📋 各Provider详细性能:');
    const providers = this.loadBalancer.getAllProviders();
    providers.forEach(provider => {
      console.log(`  ${provider.name}:`);
      console.log(`    响应时间: ${Math.round(provider.metrics.avgResponseTime)}ms`);
      console.log(`    成功率: ${(provider.metrics.successRate * 100).toFixed(1)}%`);
      console.log(`    请求总数: ${provider.metrics.requestCount}`);
      console.log(`    错误总数: ${provider.metrics.errorCount}`);
      console.log(`    健康状态: ${provider.healthStatus}`);
      console.log(`    当前连接: ${provider.currentConnections}/${provider.maxConnections}`);
      console.log('');
    });
  }

  createRequestContext(requestId, sessionId = null) {
    this.requestCounter++;
    
    return {
      requestId,
      clientIp: `192.168.1.${100 + (this.requestCounter % 50)}`,
      userAgent: 'RCC-LoadBalancer-Demo/1.0',
      sessionId,
      priority: 'normal',
      timeout: 30000,
      retryCount: 0,
      metadata: {
        timestamp: Date.now(),
        sequence: this.requestCounter
      }
    };
  }

  async simulateRequestCompletion(provider, success, responseTime) {
    // 模拟请求处理时间
    await new Promise(resolve => setTimeout(resolve, 50));

    // 更新Provider指标
    const metrics = provider.metrics;
    const newRequestCount = metrics.requestCount + 1;
    const newErrorCount = success ? metrics.errorCount : metrics.errorCount + 1;
    const newSuccessRate = (newRequestCount - newErrorCount) / newRequestCount;
    const newAvgResponseTime = (metrics.avgResponseTime * metrics.requestCount + responseTime) / newRequestCount;

    this.loadBalancer.updateProviderMetrics(provider.id, {
      requestCount: newRequestCount,
      errorCount: newErrorCount,
      successRate: newSuccessRate,
      avgResponseTime: newAvgResponseTime,
      lastResponseTime: responseTime,
      throughput: metrics.throughput + 1
    });

    // 记录熔断器结果
    this.loadBalancer.recordRequestResult(provider.id, success);

    // 释放连接
    if (provider.currentConnections > 0) {
      provider.currentConnections--;
    }
  }
}

// 主执行函数
async function main() {
  const demo = new LoadBalancerIntegrationDemo();
  await demo.runDemo();
  
  console.log('🎉 负载均衡器集成演示完成！');
}

// 如果直接执行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = LoadBalancerIntegrationDemo;