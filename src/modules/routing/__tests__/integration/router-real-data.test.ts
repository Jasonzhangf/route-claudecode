import { describe, it, expect, beforeEach } from '@jest/globals';
import { MockCoreRouter } from '../mock-core-router';
import { RoutingRequest, RoutingDecision, RoutingRules } from '../../../../interfaces/routing/routing-interfaces';
import { ZeroFallbackErrorType } from '../../../../interfaces/core/zero-fallback-errors';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 真实数据路由器集成测试
 * 使用debug-logs中的真实请求数据验证路由器架构改造
 *
 * 测试目标：
 * 1. 验证路由器只做路由决策，不做协议转换
 * 2. 检查路由输出数据格式和内容
 * 3. 确保零Fallback策略正确执行
 * 4. 验证路由决策的准确性
 */
describe('CoreRouter - Real Data Integration Tests', () => {
  let router: MockCoreRouter;

  // 真实请求数据结构
  interface RealRequestData {
    timestamp: string;
    requestId: string;
    data: {
      headers: Record<string, string>;
      body: {
        model: string;
        max_tokens: number;
        messages: Array<{
          role: string;
          content: string;
        }>;
        system?: any;
        temperature?: number;
        metadata?: any;
        stream?: boolean;
      };
      url: string;
      method: string;
    };
  }

  // 测试用路由规则配置
  const testRoutingRules: RoutingRules = {
    rules: [
      {
        id: 'claude-model-rule',
        name: 'Claude模型路由规则',
        conditions: {
          model: {
            patterns: ['claude-*'],
            operator: 'matches',
          },
        },
        targets: [
          {
            provider: 'lmstudio-local',
            weight: 0.6,
            fallback: false,
          },
          {
            provider: 'lmstudio-compatibility',
            weight: 0.4,
            fallback: false,
          },
        ],
        priority: 1,
      },
      {
        id: 'default-rule',
        name: '默认路由规则',
        conditions: {},
        targets: [
          {
            provider: 'lmstudio-local',
            weight: 1.0,
            fallback: false,
          },
        ],
        priority: 999,
      },
    ],
    version: '1.0.0',
  };

  beforeEach(() => {
    router = new MockCoreRouter();
    router.updateRoutingRules(testRoutingRules);
  });

  /**
   * 从debug-logs目录加载真实请求数据
   */
  async function loadRealRequestData(): Promise<RealRequestData[]> {
    const debugLogsDir = path.resolve(__dirname, '../../../../../debug-logs');
    const files = await fs.readdir(debugLogsDir);
    const requestFiles = files.filter(file => file.includes('_request.json'));

    const requestData: RealRequestData[] = [];

    for (const file of requestFiles) {
      try {
        const filePath = path.join(debugLogsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content) as RealRequestData;
        requestData.push(data);
      } catch (error) {
        console.warn(`Failed to load request file ${file}:`, error);
      }
    }

    return requestData;
  }

  describe('真实请求数据路由测试', () => {
    it('应该正确路由Claude模型请求', async () => {
      const realRequests = await loadRealRequestData();
      const claudeRequests = realRequests.filter(req => req.data.body.model.startsWith('claude-'));

      expect(claudeRequests.length).toBeGreaterThan(0);

      for (const realRequest of claudeRequests) {
        // 构造路由请求
        const routingRequest: RoutingRequest = {
          requestId: realRequest.requestId,
          timestamp: new Date(realRequest.timestamp),
          protocol: 'anthropic',
          model: realRequest.data.body.model,
          endpoint: realRequest.data.url,
          method: realRequest.data.method as 'GET' | 'POST' | 'PUT' | 'DELETE',
          headers: realRequest.data.headers,
          body: realRequest.data.body,
          metadata: {
            source: 'real-debug-log',
            originalTimestamp: realRequest.timestamp,
            stream: realRequest.data.body.stream || false,
          },
        };

        // 执行路由决策
        const decision: RoutingDecision = await router.route(routingRequest);

        // 验证路由决策输出格式
        expect(decision).toHaveProperty('targetProvider');
        expect(decision).toHaveProperty('targetEndpoint');
        expect(decision).toHaveProperty('routingMetadata');
        expect(decision).toHaveProperty('headers');
        expect(decision).toHaveProperty('timestamp');

        // 验证路由器只做路由决策，不做协议转换
        expect(decision.originalRequest).toEqual(routingRequest);
        expect(decision.protocolTransformed).toBeUndefined(); // 路由器不应该有协议转换数据

        // 验证路由到正确的提供商
        expect(['lmstudio-local', 'lmstudio-compatibility']).toContain(decision.targetProvider);

        // 验证路由决策元数据
        expect(decision.routingMetadata).toHaveProperty('ruleId', 'claude-model-rule');
        expect(decision.routingMetadata).toHaveProperty('matchedConditions');
        expect(decision.routingMetadata.matchedConditions.model).toBe(true);

        // 验证路由器添加的headers
        expect(decision.headers).toHaveProperty('X-RCC-Router-Version');
        expect(decision.headers).toHaveProperty('X-RCC-Route-Decision-Time');
        expect(decision.headers).toHaveProperty('X-RCC-Target-Provider', decision.targetProvider);

        console.log(`✅ 成功路由真实请求 ${realRequest.requestId}:`, {
          model: routingRequest.model,
          targetProvider: decision.targetProvider,
          ruleMatched: decision.routingMetadata.ruleId,
        });
      }
    });

    it('应该为无效模型请求抛出零Fallback错误', async () => {
      // 构造一个无效的请求（不匹配任何路由规则）
      const invalidRequest: RoutingRequest = {
        requestId: 'test-invalid-model',
        timestamp: new Date(),
        protocol: 'openai',
        model: 'nonexistent-model-12345',
        endpoint: '/v1/chat/completions',
        method: 'POST',
        headers: {},
        body: {
          model: 'nonexistent-model-12345',
          messages: [{ role: 'user', content: 'test' }],
        },
        metadata: {},
      };

      // 修改路由规则，移除默认规则以测试零Fallback
      const strictRules: RoutingRules = {
        rules: [
          {
            id: 'claude-only-rule',
            name: 'Claude模型专用规则',
            conditions: {
              model: {
                patterns: ['claude-*'],
                operator: 'matches',
              },
            },
            targets: [
              {
                provider: 'lmstudio-local',
                weight: 1.0,
                fallback: false,
              },
            ],
            priority: 1,
          },
        ],
        version: '1.0.0',
      };

      router.updateRoutingRules(strictRules);

      // 验证抛出正确的零Fallback错误
      await expect(router.route(invalidRequest)).rejects.toMatchObject({
        type: ZeroFallbackErrorType.ROUTING_RULE_NOT_FOUND,
        message: expect.stringContaining('No routing rule found'),
        context: expect.objectContaining({
          model: 'nonexistent-model-12345',
          requestId: 'test-invalid-model',
        }),
      });
    });

    it('应该生成正确的路由输出数据格式', async () => {
      const realRequests = await loadRealRequestData();

      if (realRequests.length === 0) {
        console.warn('No real request data found, skipping format validation test');
        return;
      }

      const sampleRequest = realRequests[0];
      const routingRequest: RoutingRequest = {
        requestId: sampleRequest.requestId,
        timestamp: new Date(sampleRequest.timestamp),
        protocol: 'anthropic',
        model: sampleRequest.data.body.model,
        endpoint: sampleRequest.data.url,
        method: sampleRequest.data.method as 'POST',
        headers: sampleRequest.data.headers,
        body: sampleRequest.data.body,
        metadata: {},
      };

      const decision = await router.route(routingRequest);

      // 详细验证路由输出数据格式
      expect(typeof decision.targetProvider).toBe('string');
      expect(typeof decision.targetEndpoint).toBe('string');
      expect(typeof decision.timestamp).toBe('object');
      expect(decision.timestamp instanceof Date).toBe(true);

      // 验证路由元数据结构
      expect(decision.routingMetadata).toMatchObject({
        ruleId: expect.any(String),
        ruleName: expect.any(String),
        matchedConditions: expect.any(Object),
        selectionMethod: expect.any(String),
        processingTime: expect.any(Number),
      });

      // 验证headers包含必要的路由信息
      const requiredHeaders = ['X-RCC-Router-Version', 'X-RCC-Route-Decision-Time', 'X-RCC-Target-Provider'];

      for (const header of requiredHeaders) {
        expect(decision.headers).toHaveProperty(header);
        expect(typeof decision.headers[header]).toBe('string');
      }

      // 验证原始请求保持不变
      expect(decision.originalRequest).toEqual(routingRequest);

      console.log('✅ 路由输出数据格式验证通过:', {
        targetProvider: decision.targetProvider,
        targetEndpoint: decision.targetEndpoint,
        metadataKeys: Object.keys(decision.routingMetadata),
        headerKeys: Object.keys(decision.headers).filter(k => k.startsWith('X-RCC-')),
      });
    });

    it('应该正确处理流式请求的路由', async () => {
      const realRequests = await loadRealRequestData();
      const streamRequests = realRequests.filter(req => req.data.body.stream === true);

      if (streamRequests.length === 0) {
        console.warn('No streaming requests found in debug logs');
        return;
      }

      for (const streamRequest of streamRequests) {
        const routingRequest: RoutingRequest = {
          requestId: streamRequest.requestId,
          timestamp: new Date(streamRequest.timestamp),
          protocol: 'anthropic',
          model: streamRequest.data.body.model,
          endpoint: streamRequest.data.url,
          method: 'POST',
          headers: streamRequest.data.headers,
          body: streamRequest.data.body,
          metadata: {
            streaming: true,
          },
        };

        const decision = await router.route(routingRequest);

        // 验证流式请求的特殊处理
        expect(decision.routingMetadata.requestType).toBe('streaming');
        expect(decision.headers).toHaveProperty('X-RCC-Stream-Support', 'true');

        console.log(`✅ 成功路由流式请求 ${streamRequest.requestId}`);
      }
    });
  });

  describe('路由性能测试', () => {
    it('路由决策延迟应该小于10ms', async () => {
      const realRequests = await loadRealRequestData();

      if (realRequests.length === 0) {
        console.warn('No real requests for performance testing');
        return;
      }

      const sampleRequest = realRequests[0];
      const routingRequest: RoutingRequest = {
        requestId: sampleRequest.requestId,
        timestamp: new Date(),
        protocol: 'anthropic',
        model: sampleRequest.data.body.model,
        endpoint: sampleRequest.data.url,
        method: 'POST',
        headers: sampleRequest.data.headers,
        body: sampleRequest.data.body,
        metadata: {},
      };

      const startTime = process.hrtime.bigint();
      const decision = await router.route(routingRequest);
      const endTime = process.hrtime.bigint();

      const latencyMs = Number(endTime - startTime) / 1_000_000; // 转换为毫秒

      expect(latencyMs).toBeLessThan(10); // 路由决策应该在10ms内完成
      expect(decision.routingMetadata.processingTime).toBeLessThan(10);

      console.log(`✅ 路由性能测试通过: ${latencyMs.toFixed(3)}ms`);
    });
  });
});
