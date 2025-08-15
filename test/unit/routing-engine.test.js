/**
 * 路由引擎单元测试
 * 测试路由分类、模型映射、longcontext检测等核心功能
 * 
 * @author Jason Zhang
 * @version v3.1.0
 */

// 使用自定义测试运行器，无需@jest/globals
import { RoutingEngine } from '../../dist/v3/router/routing-engine.js';

describe('RoutingEngine 单元测试', () => {
  let routingEngine;
  let realConfig;

  beforeEach(() => {
    // 使用真实配置格式 - 基于实际RoutingEngine的需求
    realConfig = {
      default: {
        provider: 'shuaihong-openai',
        model: 'claude-4-sonnet'
      },
      longcontext: {
        provider: 'shuaihong-openai',
        model: 'gemini-2-pro'
      },
      background: {
        provider: 'lmstudio-local',
        model: 'qwen3-30b'
      },
      thinking: {
        provider: 'shuaihong-openai',
        model: 'claude-4-sonnet'
      }
    };

    routingEngine = new RoutingEngine(realConfig);
  });

  describe('路由分类检测 (determineCategory)', () => {
    it('应该检测到longcontext类别 - 50k字符阈值', async () => {
      const longMessage = 'x'.repeat(60000); // 60k字符
      const request = {
        messages: [
          { role: 'user', content: longMessage }
        ]
      };

      // 使用真实的route方法测试
      const selectedProvider = await routingEngine.route(request, 'test-id');
      
      // 验证选择了longcontext路由的provider
      expect(selectedProvider).toBe('shuaihong-openai');
      expect(request.metadata.routingCategory).toBe('longcontext');
      expect(request.metadata.targetModel).toBe('gemini-2-pro');
    });

    it('应该检测到default类别 - 普通消息', async () => {
      const request = {
        messages: [
          { role: 'user', content: 'Hello, how are you?' }
        ]
      };

      const selectedProvider = await routingEngine.route(request, 'test-id');
      
      expect(selectedProvider).toBe('shuaihong-openai');
      expect(request.metadata.routingCategory).toBe('default');
      expect(request.metadata.targetModel).toBe('claude-4-sonnet');
    });

    it('应该检测到background类别 - 元数据指定', async () => {
      const request = {
        messages: [
          { role: 'user', content: 'Simple task' }
        ],
        metadata: {
          category: 'background'
        }
      };

      const selectedProvider = await routingEngine.route(request, 'test-id');
      
      expect(selectedProvider).toBe('lmstudio-local');
      expect(request.metadata.routingCategory).toBe('background');
      expect(request.metadata.targetModel).toBe('qwen3-30b');
    });

    it('应该检测到thinking类别 - 元数据指定', async () => {
      const request = {
        messages: [
          { role: 'user', content: 'Let me think step by step to solve this complex problem...' }
        ],
        metadata: {
          thinking: true
        }
      };

      const selectedProvider = await routingEngine.route(request, 'test-id');
      
      expect(selectedProvider).toBe('shuaihong-openai');
      expect(request.metadata.routingCategory).toBe('thinking');
      expect(request.metadata.targetModel).toBe('claude-4-sonnet');
    });
  });

  describe('模型映射和Provider选择', () => {
    it('应该正确映射primary模型', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Test message' }]
      };

      const selectedProvider = await routingEngine.route(request, 'test-id');
      
      expect(typeof selectedProvider).toBe('string');
      expect(selectedProvider).toBe('shuaihong-openai');
      expect(request.metadata).toHaveProperty('routingCategory');
      expect(request.metadata).toHaveProperty('targetModel');
    });

    it('应该包含完整的路由信息', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Test message' }]
      };

      const selectedProvider = await routingEngine.route(request, 'test-id');
      
      expect(request.metadata).toHaveProperty('routingCategory');
      expect(request.metadata).toHaveProperty('targetModel');
      expect(request.metadata.routingCategory).toBe('default');
      expect(request.metadata.targetModel).toBe('claude-4-sonnet');
      expect(selectedProvider).toBe('shuaihong-openai');
    });

    it('应该处理provider禁用逻辑', async () => {
      // 测试provider临时禁用功能
      routingEngine.temporarilyDisableProvider('shuaihong-openai');
      
      const request = {
        messages: [{ role: 'user', content: 'Test message' }]
      };

      try {
        await routingEngine.route(request, 'test-id');
        // 应该抛出错误，因为没有可用的provider
      } catch (error) {
        expect(error.message).toBe('No available providers for category: default (all temporarily disabled)');
      }
      
      // 重新启用provider
      routingEngine.temporarilyEnableProvider('shuaihong-openai');
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该处理空消息数组', async () => {
      const request = {
        messages: []
      };

      const selectedProvider = await routingEngine.route(request, 'test-id');
      
      // 应该返回默认路由
      expect(request.metadata.routingCategory).toBe('default');
      expect(selectedProvider).toBe('shuaihong-openai');
    });

    it('应该处理无效的请求格式', async () => {
      const request = {};

      const selectedProvider = await routingEngine.route(request, 'test-id');
      
      // 应该返回默认路由
      expect(request.metadata.routingCategory).toBe('default');
      expect(selectedProvider).toBe('shuaihong-openai');
    });

    it('应该处理未知类别', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Test' }],
        metadata: {
          category: 'unknown_category'
        }
      };

      try {
        await routingEngine.route(request, 'test-id');
      } catch (error) {
        expect(error.message).toBe('No routing configuration found for category: unknown_category');
      }
    });

    it('应该处理超大消息', async () => {
      const hugeMesage = 'x'.repeat(1000000); // 1M字符
      const request = {
        messages: [
          { role: 'user', content: hugeMesage }
        ]
      };

      const selectedProvider = await routingEngine.route(request, 'test-id');
      
      // 应该选择longcontext路由
      expect(request.metadata.routingCategory).toBe('longcontext');
      expect(selectedProvider).toBe('shuaihong-openai');
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成路由选择', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Performance test message' }]
      };

      const startTime = Date.now();
      const selectedProvider = await routingEngine.route(request, 'test-id');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内完成
      expect(selectedProvider).toBeDefined();
      expect(selectedProvider).toBe('shuaihong-openai');
    });

    it('应该处理大量并发路由请求', async () => {
      const requests = Array.from({ length: 100 }, (_, i) => ({
        messages: [{ role: 'user', content: `Test message ${i}` }]
      }));

      const startTime = Date.now();
      const routes = await Promise.all(requests.map(req => routingEngine.route(req, `test-id-${Math.random()}`)));
      const endTime = Date.now();

      expect(routes).toHaveLength(100);
      expect(routes.every(provider => typeof provider === 'string')).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });
  });

  describe('配置验证', () => {
    it('应该验证有效的配置', () => {
      expect(() => {
        new RoutingEngine(realConfig);
      }).not.toThrow();
    });

    it('应该处理空配置', async () => {
      const emptyConfig = {};
      const emptyConfigEngine = new RoutingEngine(emptyConfig);
      
      const request = {
        messages: [{ role: 'user', content: 'Test' }]
      };

      try {
        await emptyConfigEngine.route(request, 'test-id');
      } catch (error) {
        expect(error.message).toBe('No routing configuration found for category: default');
      }
    });

    it('应该处理统计功能', () => {
      const stats = routingEngine.getStats();
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('providerHealth');
      
      const statsSummary = routingEngine.getStatsSummary();
      expect(statsSummary).toHaveProperty('totalRequests');
      expect(statsSummary).toHaveProperty('successfulRequests');
      expect(statsSummary).toHaveProperty('failedRequests');
    });
  });
});

// 集成测试辅助函数
export function createTestRequest(content, options = {}) {
  return {
    messages: [
      { role: 'user', content }
    ],
    ...options
  };
}

export function createLongContextRequest(charCount = 60000) {
  return createTestRequest('x'.repeat(charCount));
}

export function createThinkingRequest() {
  return createTestRequest('Let me think step by step about this complex problem and reason through it carefully...');
}

export function createBackgroundRequest() {
  return createTestRequest('Simple task', {
    metadata: { category: 'background' }
  });
}