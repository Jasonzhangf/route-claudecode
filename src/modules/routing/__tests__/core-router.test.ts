/**
 * 核心路由器单元测试
 *
 * 测试核心路由器的所有功能，确保遵循单一职责原则和零Fallback策略
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CoreRouter } from '../core-router';
import {
  RouterConfig,
  RoutingRequest,
  RouteInfo,
  RequestPriority,
} from '../../../interfaces/router/core-router-interfaces';
import {
  ProviderUnavailableError,
  ModelUnavailableError,
  RoutingRuleNotFoundError,
} from '../../../interfaces/core/zero-fallback-errors';

describe('CoreRouter', () => {
  let router: CoreRouter;
  let mockConfig: RouterConfig;
  let mockRoutes: RouteInfo[];

  beforeEach(() => {
    // 模拟配置
    mockConfig = {
      id: 'test-router',
      name: 'Test Router',
      routingRules: {
        version: '1.0.0',
        defaultRule: {
          id: 'default',
          name: 'Default Rule',
          description: 'Default routing rule',
          enabled: true,
          priority: 1,
          conditions: [],
          targetProviders: ['lmstudio'],
          weights: { lmstudio: 1 },
          constraints: {},
          fallbackEnabled: false,
          tags: ['default'],
        },
        categoryRules: {
          coding: {
            id: 'coding',
            name: 'Coding Rule',
            description: 'For coding tasks',
            enabled: true,
            priority: 2,
            conditions: [
              {
                field: 'category',
                operator: 'equals',
                value: 'coding',
                description: 'Category is coding',
              },
            ],
            targetProviders: ['lmstudio'],
            weights: { lmstudio: 1 },
            constraints: {},
            fallbackEnabled: false,
            tags: ['coding'],
          },
        },
        modelRules: {
          'claude-3-5-sonnet': {
            id: 'claude-model',
            name: 'Claude Model Rule',
            description: 'For Claude models',
            enabled: true,
            priority: 3,
            conditions: [
              {
                field: 'model',
                operator: 'equals',
                value: 'claude-3-5-sonnet',
                description: 'Model is claude-3-5-sonnet',
              },
            ],
            targetProviders: ['lmstudio'],
            weights: { lmstudio: 1 },
            constraints: {},
            fallbackEnabled: false,
            tags: ['claude'],
          },
        },
        customRules: [],
        rulePriority: ['model', 'category', 'default'],
      },
      defaults: {
        provider: 'lmstudio',
        model: 'llama-3.1-8b',
        timeout: 30000,
        maxRetries: 2,
      },
      performance: {
        maxConcurrentDecisions: 100,
        decisionTimeoutMs: 5000,
        historyRetention: 1000,
      },
      zeroFallbackPolicy: {
        enabled: true,
        strictMode: true,
        errorOnFailure: true,
        maxRetries: 2,
      },
    };

    // 模拟路由信息
    mockRoutes = [
      {
        id: 'lmstudio-route',
        providerId: 'lmstudio',
        providerType: 'openai',
        supportedModels: ['claude-3-5-sonnet', 'llama-3.1-8b', 'gpt-4'],
        weight: 1.0,
        available: true,
        healthStatus: 'healthy',
        tags: ['local', 'fast'],
        metadata: {
          endpoint: 'http://localhost:1234/v1',
          version: '0.2.28',
        },
      },
      {
        id: 'anthropic-route',
        providerId: 'anthropic',
        providerType: 'anthropic',
        supportedModels: ['claude-3-5-sonnet-20241022'],
        weight: 0.8,
        available: true,
        healthStatus: 'healthy',
        tags: ['cloud', 'official'],
        metadata: {
          endpoint: 'https://api.anthropic.com',
          version: '2023-06-01',
        },
      },
      {
        id: 'unavailable-route',
        providerId: 'unavailable',
        providerType: 'openai',
        supportedModels: ['*'],
        weight: 1.0,
        available: false,
        healthStatus: 'unhealthy',
        tags: ['test'],
        metadata: {},
      },
    ];

    router = new CoreRouter(mockConfig);
    router.updateAvailableRoutes(mockRoutes);
  });

  describe('构造函数和配置验证', () => {
    it('应该成功创建路由器实例', () => {
      expect(router).toBeInstanceOf(CoreRouter);
    });

    it('应该要求零Fallback策略必须启用', () => {
      const invalidConfig = {
        ...mockConfig,
        zeroFallbackPolicy: { ...mockConfig.zeroFallbackPolicy, enabled: false },
      };

      expect(() => new CoreRouter(invalidConfig)).toThrow(
        '零Fallback策略必须启用，zeroFallbackPolicy.enabled必须为true'
      );
    });

    it('应该验证配置格式', () => {
      const invalidConfig = {
        ...mockConfig,
        id: null, // 无效的ID
      };

      expect(() => new CoreRouter(invalidConfig as any)).toThrow('路由器配置验证失败');
    });
  });

  describe('路由决策功能', () => {
    it('应该为有效请求做出路由决策', async () => {
      const request: RoutingRequest = {
        id: 'test-req-1',
        model: 'claude-3-5-sonnet',
        category: 'coding',
        priority: 'normal',
        metadata: {
          userId: 'user123',
          sessionId: 'session456',
          customAttributes: {},
        },
        constraints: {},
        timestamp: new Date(),
      };

      const decision = await router.route(request);

      expect(decision).toBeDefined();
      expect(decision.requestId).toBe('test-req-1');
      expect(decision.selectedProvider).toBe('lmstudio');
      expect(decision.selectedModel).toBe('claude-3-5-sonnet');
      expect(decision.confidence).toBeGreaterThan(0);
      expect(decision.estimatedLatency).toBeGreaterThan(0);
      expect(decision.processingTime).toBeGreaterThan(0);
      expect(decision.reasoning).toContain('lmstudio');
    });

    it('应该选择优先级最高的规则', async () => {
      const request: RoutingRequest = {
        id: 'test-req-2',
        model: 'claude-3-5-sonnet', // 匹配模型规则（优先级最高）
        category: 'coding', // 也匹配分类规则
        priority: 'high',
        metadata: {
          originalFormat: 'anthropic',
          targetFormat: 'openai',
          customAttributes: {},
        },
        constraints: {},
        timestamp: new Date(),
      };

      const decision = await router.route(request);

      // 应该选择模型规则而不是分类规则
      expect(decision.reasoning).toContain('Claude Model Rule');
    });

    it('应该在没有匹配规则时使用默认规则', async () => {
      const request: RoutingRequest = {
        id: 'test-req-3',
        model: 'unknown-model',
        priority: 'low',
        metadata: {
          originalFormat: 'anthropic',
          targetFormat: 'openai',
          customAttributes: {},
        },
        constraints: {},
        timestamp: new Date(),
      };

      const decision = await router.route(request);

      expect(decision.reasoning).toContain('Default Rule');
      expect(decision.selectedProvider).toBe('lmstudio');
    });

    it('应该在没有可用Provider时抛出ProviderUnavailableError', async () => {
      // 移除所有路由
      router.updateAvailableRoutes([]);

      const request: RoutingRequest = {
        id: 'test-req-4',
        model: 'claude-3-5-sonnet',
        priority: 'normal',
        metadata: {
          originalFormat: 'anthropic',
          targetFormat: 'openai',
          customAttributes: {},
        },
        constraints: {},
        timestamp: new Date(),
      };

      await expect(router.route(request)).rejects.toThrow(ProviderUnavailableError);
    });

    it('应该在模型不支持时抛出ModelUnavailableError', async () => {
      const restrictedRoutes: RouteInfo[] = [
        {
          id: 'restricted-route',
          providerId: 'restricted',
          providerType: 'openai',
          supportedModels: ['gpt-3.5'], // 不支持claude模型
          weight: 1.0,
          available: true,
          healthStatus: 'healthy',
          tags: [],
          metadata: {},
        },
      ];

      const restrictedConfig = {
        ...mockConfig,
        routingRules: {
          ...mockConfig.routingRules,
          defaultRule: {
            ...mockConfig.routingRules.defaultRule,
            targetProviders: ['restricted'],
          },
        },
      };

      const restrictedRouter = new CoreRouter(restrictedConfig);
      restrictedRouter.updateAvailableRoutes(restrictedRoutes);

      const request: RoutingRequest = {
        id: 'test-req-5',
        model: 'claude-3-5-sonnet',
        priority: 'normal',
        metadata: {
          originalFormat: 'anthropic',
          targetFormat: 'openai',
          customAttributes: {},
        },
        constraints: {},
        timestamp: new Date(),
      };

      await expect(restrictedRouter.route(request)).rejects.toThrow(ModelUnavailableError);
    });
  });

  describe('路由规则管理', () => {
    it('应该成功更新路由规则', () => {
      const newRules = {
        ...mockConfig.routingRules,
        version: '2.0.0',
        customRules: [
          {
            id: 'custom-rule',
            name: 'Custom Rule',
            description: 'Custom routing rule',
            enabled: true,
            priority: 1,
            conditions: [
              {
                field: 'priority',
                operator: 'equals',
                value: 'urgent',
                description: 'Priority is urgent',
              },
            ],
            targetProviders: ['anthropic'],
            weights: { anthropic: 1 },
            constraints: {},
            fallbackEnabled: false,
            tags: ['custom'],
          },
        ],
      };

      expect(() => router.updateRoutingRules(newRules)).not.toThrow();

      const status = router.getRouterStatus();
      expect(status.rulesVersion).toBe('2.0.0');
    });
  });

  describe('路由信息管理', () => {
    it('应该返回可用的路由', () => {
      const availableRoutes = router.getAvailableRoutes();
      expect(availableRoutes).toHaveLength(2); // 两个可用的路由
      expect(availableRoutes.every(route => route.available)).toBe(true);
    });

    it('应该成功更新路由信息', () => {
      const newRoute: RouteInfo = {
        id: 'new-route',
        providerId: 'new-provider',
        providerType: 'openai',
        supportedModels: ['*'],
        weight: 1.0,
        available: true,
        healthStatus: 'healthy',
        tags: ['new'],
        metadata: {},
      };

      router.updateAvailableRoutes([...mockRoutes, newRoute]);

      const status = router.getRouterStatus();
      expect(status.availableRoutes).toBe(4);
    });
  });

  describe('配置验证', () => {
    it('应该验证有效配置', () => {
      const validation = router.validateConfig(mockConfig);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('应该检测零Fallback策略禁用', () => {
      const invalidConfig = {
        ...mockConfig,
        zeroFallbackPolicy: { ...mockConfig.zeroFallbackPolicy, enabled: false },
      };

      const validation = router.validateConfig(invalidConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.code === 'ZERO_FALLBACK_DISABLED')).toBe(true);
    });

    it('应该检测缺少默认规则', () => {
      const invalidConfig = {
        ...mockConfig,
        routingRules: {
          ...mockConfig.routingRules,
          defaultRule: null as any,
        },
      };

      const validation = router.validateConfig(invalidConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.code === 'MISSING_DEFAULT_RULE')).toBe(true);
    });
  });

  describe('状态查询', () => {
    it('应该返回路由器状态', () => {
      const status = router.getRouterStatus();

      expect(status.routerId).toBe('test-router');
      expect(status.rulesVersion).toBe('1.0.0');
      expect(status.availableRoutes).toBe(3);
      expect(status.healthyRoutes).toBe(2);
      expect(status.decisionHistory).toBe(0);
      expect(status.zeroFallbackEnabled).toBe(true);
    });

    it('应该在做出决策后更新状态', async () => {
      const request: RoutingRequest = {
        id: 'test-status-req',
        model: 'claude-3-5-sonnet',
        priority: 'normal',
        metadata: {
          originalFormat: 'anthropic',
          targetFormat: 'openai',
          customAttributes: {},
        },
        constraints: {},
        timestamp: new Date(),
      };

      await router.route(request);

      const status = router.getRouterStatus();
      expect(status.decisionHistory).toBe(1);
      expect(status.lastDecision).toBeDefined();
    });
  });

  describe('错误处理和零Fallback策略', () => {
    it('应该在输入验证失败时抛出错误', async () => {
      const invalidRequest = {
        id: '', // 空ID
        model: 'test-model',
        priority: 'normal',
        metadata: {},
        timestamp: new Date(),
      } as any;

      await expect(router.route(invalidRequest)).rejects.toThrow();
    });

    it('应该立即失败而不是降级', async () => {
      // 创建一个没有可用Provider的情况
      const emptyRouter = new CoreRouter(mockConfig);
      emptyRouter.updateAvailableRoutes([]);

      const request: RoutingRequest = {
        id: 'fail-fast-test',
        model: 'claude-3-5-sonnet',
        priority: 'normal',
        metadata: {
          originalFormat: 'anthropic',
          targetFormat: 'openai',
          customAttributes: {},
        },
        constraints: {},
        timestamp: new Date(),
      };

      const startTime = Date.now();

      try {
        await emptyRouter.route(request);
        fail('应该抛出错误');
      } catch (error) {
        const endTime = Date.now();
        expect(error).toBeInstanceOf(ProviderUnavailableError);
        // 应该快速失败，不应该有长时间的重试
        expect(endTime - startTime).toBeLessThan(1000);
      }
    });

    it('应该记录错误但不隐藏错误', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const request: RoutingRequest = {
        id: 'error-logging-test',
        model: 'unsupported-model',
        priority: 'normal',
        metadata: {
          originalFormat: 'anthropic',
          targetFormat: 'openai',
          customAttributes: {},
        },
        constraints: {},
        timestamp: new Date(),
      };

      // 设置一个不支持任何模型的路由
      const unsupportedRoute: RouteInfo = {
        id: 'unsupported',
        providerId: 'unsupported',
        providerType: 'openai',
        supportedModels: [], // 不支持任何模型
        weight: 1.0,
        available: true,
        healthStatus: 'healthy',
        tags: [],
        metadata: {},
      };

      const restrictedConfig = {
        ...mockConfig,
        routingRules: {
          ...mockConfig.routingRules,
          defaultRule: {
            ...mockConfig.routingRules.defaultRule,
            targetProviders: ['unsupported'],
          },
        },
      };

      const testRouter = new CoreRouter(restrictedConfig);
      testRouter.updateAvailableRoutes([unsupportedRoute]);

      await expect(testRouter.route(request)).rejects.toThrow(ModelUnavailableError);

      consoleSpy.mockRestore();
    });
  });

  describe('性能测试', () => {
    it('应该在规定时间内完成路由决策', async () => {
      const request: RoutingRequest = {
        id: 'perf-test',
        model: 'claude-3-5-sonnet',
        priority: 'high',
        metadata: {
          originalFormat: 'anthropic',
          targetFormat: 'openai',
          customAttributes: {},
        },
        constraints: {},
        timestamp: new Date(),
      };

      const startTime = Date.now();
      const decision = await router.route(request);
      const endTime = Date.now();

      expect(decision.processingTime).toBeLessThan(100); // 应该在100ms内完成
      expect(endTime - startTime).toBeLessThan(1000); // 总时间应该在1秒内
    });

    it('应该能处理并发请求', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        id: `concurrent-test-${i}`,
        model: 'claude-3-5-sonnet',
        priority: 'normal' as RequestPriority,
        metadata: {
          originalFormat: 'anthropic',
          targetFormat: 'openai',
          customAttributes: {},
        },
        constraints: {},
        timestamp: new Date(),
      }));

      const startTime = Date.now();
      const decisions = await Promise.all(requests.map(request => router.route(request)));
      const endTime = Date.now();

      expect(decisions).toHaveLength(10);
      expect(decisions.every(d => d.selectedProvider === 'lmstudio')).toBe(true);
      expect(endTime - startTime).toBeLessThan(2000); // 并发处理应该很快
    });
  });
});
