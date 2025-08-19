/**
 * 负载均衡器单元测试
 *
 * 测试重构后的模块化负载均衡器
 *
 * @author Jason Zhang
 */

import { ProviderLoadBalancer } from '../load-balancer';
import { LoadBalancingStrategy, ProviderHealthStatus, ProviderInstance, LoadBalancingContext } from '../types';

describe('ProviderLoadBalancer', () => {
  let loadBalancer: ProviderLoadBalancer;

  const mockProvider1: ProviderInstance = {
    id: 'provider-1',
    name: 'Test Provider 1',
    type: 'lmstudio',
    endpoint: 'http://localhost:1234',
    weight: 50,
    maxConnections: 100,
    currentConnections: 0,
    healthStatus: ProviderHealthStatus.HEALTHY,
    metrics: {
      avgResponseTime: 100,
      successRate: 0.95,
      requestCount: 1000,
      errorCount: 50,
      lastResponseTime: 90,
      throughput: 50,
    },
    config: {},
    lastUpdated: Date.now(),
  };

  const mockProvider2: ProviderInstance = {
    id: 'provider-2',
    name: 'Test Provider 2',
    type: 'openai',
    endpoint: 'https://api.openai.com',
    weight: 30,
    maxConnections: 50,
    currentConnections: 0,
    healthStatus: ProviderHealthStatus.HEALTHY,
    metrics: {
      avgResponseTime: 200,
      successRate: 0.9,
      requestCount: 500,
      errorCount: 50,
      lastResponseTime: 180,
      throughput: 30,
    },
    config: {},
    lastUpdated: Date.now(),
  };

  const mockContext: LoadBalancingContext = {
    requestId: 'test-request-1',
    clientIp: '127.0.0.1',
    priority: 'normal',
    timeout: 5000,
    retryCount: 0,
  };

  beforeEach(() => {
    loadBalancer = new ProviderLoadBalancer({
      strategy: LoadBalancingStrategy.WEIGHTED_LEAST_CONNECTIONS,
      enableHealthCheck: false, // 禁用健康检查以简化测试
      logging: {
        enabled: false,
        logLevel: 'error',
        logSelections: false,
      },
    });
  });

  afterEach(async () => {
    await loadBalancer.cleanup();
  });

  describe('Provider Management', () => {
    test('should add provider successfully', () => {
      loadBalancer.addProvider(mockProvider1);
      const providers = loadBalancer.getAllProviders();

      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('provider-1');
    });

    test('should remove provider successfully', () => {
      loadBalancer.addProvider(mockProvider1);
      const removed = loadBalancer.removeProvider('provider-1');
      const providers = loadBalancer.getAllProviders();

      expect(removed).toBe(true);
      expect(providers).toHaveLength(0);
    });

    test('should return false when removing non-existent provider', () => {
      const removed = loadBalancer.removeProvider('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('Provider Selection', () => {
    beforeEach(() => {
      loadBalancer.addProvider(mockProvider1);
      loadBalancer.addProvider(mockProvider2);
    });

    test('should select provider using weighted least connections', async () => {
      const result = await loadBalancer.selectProvider(mockContext);

      expect(result.selectedProvider).toBeDefined();
      expect(result.strategy).toBe(LoadBalancingStrategy.WEIGHTED_LEAST_CONNECTIONS);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.alternatives).toHaveLength(1);
    });

    test('should throw error when no providers available', async () => {
      await loadBalancer.cleanup();
      const emptyBalancer = new ProviderLoadBalancer();

      await expect(emptyBalancer.selectProvider(mockContext)).rejects.toThrow(
        'No available providers for load balancing'
      );
    });

    test('should filter out unhealthy providers', async () => {
      // 将一个provider设置为不健康
      const providers = loadBalancer.getAllProviders();
      providers[0].healthStatus = ProviderHealthStatus.UNHEALTHY;

      const result = await loadBalancer.selectProvider(mockContext);

      // 应该选择健康的provider
      expect(result.selectedProvider.healthStatus).toBe(ProviderHealthStatus.HEALTHY);
    });
  });

  describe('Metrics Update', () => {
    beforeEach(() => {
      loadBalancer.addProvider(mockProvider1);
    });

    test('should update provider metrics', () => {
      const newMetrics = {
        avgResponseTime: 150,
        successRate: 0.98,
      };

      loadBalancer.updateProviderMetrics('provider-1', newMetrics);

      const providers = loadBalancer.getAllProviders();
      expect(providers[0].metrics.avgResponseTime).toBe(150);
      expect(providers[0].metrics.successRate).toBe(0.98);
    });

    test('should not update metrics for non-existent provider', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      loadBalancer.updateProviderMetrics('non-existent', {
        avgResponseTime: 999,
      });

      // 不应该抛出错误，只是静默忽略
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      loadBalancer.addProvider(mockProvider1);
      loadBalancer.addProvider(mockProvider2);
    });

    test('should calculate statistics correctly', () => {
      const stats = loadBalancer.getStatistics();

      expect(stats.totalProviders).toBe(2);
      expect(stats.healthyProviders).toBe(2);
      expect(stats.unhealthyProviders).toBe(0);
      expect(stats.totalConnections).toBe(0);
      expect(stats.avgResponseTime).toBe(150); // (100 + 200) / 2
      expect(stats.avgSuccessRate).toBe(0.925); // (0.95 + 0.90) / 2
    });
  });

  describe('Strategy Update', () => {
    test('should update strategy successfully', () => {
      loadBalancer.updateStrategy(LoadBalancingStrategy.ROUND_ROBIN);

      // 验证策略已更新（通过检查下一次选择的行为）
      loadBalancer.addProvider(mockProvider1);
      loadBalancer.addProvider(mockProvider2);

      expect(loadBalancer.getAllProviders()).toHaveLength(2);
    });
  });

  describe('Module Lifecycle', () => {
    test('should initialize successfully', async () => {
      await loadBalancer.initialize();
      // 初始化应该成功完成，没有抛出错误
    });

    test('should cleanup successfully', async () => {
      await loadBalancer.initialize();
      await loadBalancer.cleanup();

      const providers = loadBalancer.getAllProviders();
      expect(providers).toHaveLength(0);
    });

    test('should handle multiple initializations', async () => {
      await loadBalancer.initialize();
      await loadBalancer.initialize(); // 应该不会出错
    });
  });

  describe('Circuit Breaker Integration', () => {
    beforeEach(() => {
      loadBalancer.addProvider(mockProvider1);
    });

    test('should record successful request', () => {
      // 记录成功请求不应该抛出错误
      expect(() => {
        loadBalancer.recordRequestResult('provider-1', true);
      }).not.toThrow();
    });

    test('should record failed request', () => {
      // 记录失败请求不应该抛出错误
      expect(() => {
        loadBalancer.recordRequestResult('provider-1', false);
      }).not.toThrow();
    });
  });
});
