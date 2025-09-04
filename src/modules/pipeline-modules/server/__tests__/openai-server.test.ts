/**
 * OpenAI Server Module Unit Tests
 */

import { OpenAIServerModule, OpenAIServerConfig } from '../openai-server';
import { ModuleType } from '../../../../interfaces/module/base-module';

describe('OpenAIServerModule', () => {
  let serverModule: OpenAIServerModule;
  let config: OpenAIServerConfig;

  beforeEach(() => {
    config = {
      baseURL: 'http://test-server/v1',
      apiKey: 'test-key',
      timeout: 5000,
      maxRetries: 2,
      retryDelay: 100,
    };

    serverModule = new OpenAIServerModule(config);
  });

  describe('Module Creation', () => {
    test('should create module with correct properties', () => {
      expect(serverModule.getId()).toBe('openai-server-module');
      expect(serverModule.getName()).toBe('OpenAI Server Module');
      expect(serverModule.getType()).toBe(ModuleType.SERVER);
      expect(serverModule.getVersion()).toBe('1.0.0');
    });

    test('should validate configuration', () => {
      const invalidConfig: any = { ...config };
      delete invalidConfig.apiKey;
      
      expect(() => {
        new OpenAIServerModule(invalidConfig);
      }).toThrow();
    });
  });

  describe('Module Lifecycle', () => {
    test('should start and stop module correctly', async () => {
      expect(serverModule.getStatus().status).toBe('running');
      expect(serverModule.getStatus().health).toBe('healthy');

      await serverModule.stop();
      expect(serverModule.getStatus().health).toBe('unhealthy');

      await serverModule.start();
      expect(serverModule.getStatus().status).toBe('running');
    });

    test('should handle duplicate lifecycle calls', async () => {
      await serverModule.start();
      await serverModule.start();
      expect(serverModule.getStatus().status).toBe('running');

      await serverModule.stop();
      await serverModule.stop();
      expect(serverModule.getStatus().health).toBe('unhealthy');
    });
  });

  describe('Health Check', () => {
    test('should perform health check', async () => {
      const health = await serverModule.healthCheck();
      expect(health).toBeDefined();
      expect(typeof health.healthy).toBe('boolean');
      expect(health.details).toBeDefined();
    });
  });

  describe('Module Methods', () => {
    test('should return metrics', () => {
      const metrics = serverModule.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.requestsProcessed).toBe('number');
      expect(typeof metrics.averageProcessingTime).toBe('number');
      expect(typeof metrics.errorRate).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
      expect(typeof metrics.cpuUsage).toBe('number');
    });

    test('should handle configuration', async () => {
      await expect(serverModule.configure({})).resolves.toBeUndefined();
    });

    test('should handle reset', async () => {
      await expect(serverModule.reset()).resolves.toBeUndefined();
    });

    test('should handle cleanup', async () => {
      await expect(serverModule.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('Model Limits', () => {
    test('should return correct limits for known models', () => {
      const limits1 = (serverModule as any).getModelLimits('model-1');
      const limits2 = (serverModule as any).getModelLimits('model-2');
      expect(limits1).toBeDefined();
      expect(limits2).toBeDefined();
    });

    test('should return default limits for unknown models', () => {
      const limits = (serverModule as any).getModelLimits('unknown-model');
      expect(limits).toBeDefined();
    });
  });

  describe('Token Estimation', () => {
    test('should estimate tokens correctly', () => {
      const tokenCount = (serverModule as any).estimateTokens('hello world test');
      expect(tokenCount).toBeGreaterThan(0);
    });
  });
});