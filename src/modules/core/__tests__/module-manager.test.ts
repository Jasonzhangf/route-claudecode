/**
 * Module Manager Test Suite
 *
 * 模块管理器的完整单元测试
 *
 * @author Claude Code Assistant
 * @version 1.0.0
 */

import { ModuleManagerImpl, ModuleManagerConfig } from '../module-manager';
import { ModuleType } from '../../../interfaces/module/base-module';
import { SecureAnthropicToOpenAITransformer } from '../../transformers/secure-anthropic-openai-transformer';

describe('ModuleManagerImpl', () => {
  let moduleManager: ModuleManagerImpl;
  let config: ModuleManagerConfig;

  beforeEach(() => {
    config = {
      autoStartModules: false,
      enableHealthMonitoring: false,
      healthCheckInterval: 1000,
    };

    moduleManager = new ModuleManagerImpl(config);
  });

  afterEach(async () => {
    await moduleManager.cleanupAll();
  });

  describe('Module Registration', () => {
    test('should register module successfully', async () => {
      const transformer = new SecureAnthropicToOpenAITransformer({
        preserveToolCalls: true,
        mapSystemMessage: true,
        defaultMaxTokens: 4096,
      });
      
      await moduleManager.registerModule(transformer);
      
      const retrievedModule = moduleManager.getModule(transformer.getId());
      expect(retrievedModule).toBe(transformer);
    });

    test('should throw error when registering duplicate module', async () => {
      const transformer1 = new SecureAnthropicToOpenAITransformer({
        preserveToolCalls: true,
        mapSystemMessage: true,
        defaultMaxTokens: 4096,
      });
      
      const transformer2 = new SecureAnthropicToOpenAITransformer({
        preserveToolCalls: false,
        mapSystemMessage: false,
        defaultMaxTokens: 2048,
      });
      
      // 手动设置相同的ID来测试重复注册
      Object.defineProperty(transformer2, 'id', { value: transformer1.getId() });
      
      await moduleManager.registerModule(transformer1);
      
      await expect(moduleManager.registerModule(transformer2)).rejects.toThrow(`Module with ID ${transformer1.getId()} is already registered`);
    });
  });

  describe('Module Lifecycle Management', () => {
    test('should start and stop modules', async () => {
      const transformer = new SecureAnthropicToOpenAITransformer({
        preserveToolCalls: true,
        mapSystemMessage: true,
        defaultMaxTokens: 4096,
      });
      
      await moduleManager.registerModule(transformer);
      
      // 启动所有模块
      await moduleManager.startAll();
      expect(transformer.getStatus().status).toBe('running');
      
      // 停止所有模块
      await moduleManager.stopAll();
      expect(transformer.getStatus().status).toBe('stopped');
    });

    test('should handle module lifecycle events', async () => {
      const transformer = new SecureAnthropicToOpenAITransformer({
        preserveToolCalls: true,
        mapSystemMessage: true,
        defaultMaxTokens: 4096,
      });
      
      const startedHandler = jest.fn();
      const stoppedHandler = jest.fn();
      
      transformer.on('started', startedHandler);
      transformer.on('stopped', stoppedHandler);
      
      await moduleManager.registerModule(transformer);
      await moduleManager.startAll();
      
      expect(startedHandler).toHaveBeenCalled();
      
      await moduleManager.stopAll();
      expect(stoppedHandler).toHaveBeenCalled();
    });
  });

  describe('Module Execution', () => {
    test('should execute single module', async () => {
      const transformer = new SecureAnthropicToOpenAITransformer({
        preserveToolCalls: true,
        mapSystemMessage: true,
        defaultMaxTokens: 4096,
      });
      
      await moduleManager.registerModule(transformer);
      await transformer.start();
      
      const input = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1000,
      };
      
      const result = await moduleManager.executeModule(transformer.getId(), input);
      
      expect(result).toBeDefined();
      expect(result.model).toBe('test-model');
      expect(result.messages).toHaveLength(1);
    });

    test('should execute pipeline of modules', async () => {
      const transformer1 = new SecureAnthropicToOpenAITransformer({
        preserveToolCalls: true,
        mapSystemMessage: true,
        defaultMaxTokens: 4096,
      });
      
      const transformer2 = new SecureAnthropicToOpenAITransformer({
        preserveToolCalls: false,
        mapSystemMessage: false,
        defaultMaxTokens: 2048,
      });
      
      await moduleManager.registerModule(transformer1);
      await moduleManager.registerModule(transformer2);
      
      await transformer1.start();
      await transformer2.start();
      
      const input = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1000,
      };
      
      const result = await moduleManager.executePipeline([
        transformer1.getId(),
        transformer2.getId()
      ], input);
      
      expect(result).toBeDefined();
      expect(result.model).toBe('test-model');
    });
  });

  describe('Module Retrieval and Status', () => {
    test('should get modules by type', async () => {
      const transformer = new SecureAnthropicToOpenAITransformer({
        preserveToolCalls: true,
        mapSystemMessage: true,
        defaultMaxTokens: 4096,
      });
      
      await moduleManager.registerModule(transformer);
      
      const transformers = moduleManager.getModulesByType(ModuleType.TRANSFORMER);
      expect(transformers).toHaveLength(1);
      expect(transformers[0]).toBe(transformer);
    });

    test('should get module status', async () => {
      const transformer = new SecureAnthropicToOpenAITransformer({
        preserveToolCalls: true,
        mapSystemMessage: true,
        defaultMaxTokens: 4096,
      });
      
      await moduleManager.registerModule(transformer);
      
      const status = moduleManager.getModuleStatus(transformer.getId());
      expect(status).toBeDefined();
      expect(status?.id).toBe(transformer.getId());
      expect(status?.type).toBe(ModuleType.TRANSFORMER);
    });
  });

  describe('Health Check', () => {
    test('should perform health check', async () => {
      const transformer = new SecureAnthropicToOpenAITransformer({
        preserveToolCalls: true,
        mapSystemMessage: true,
        defaultMaxTokens: 4096,
      });
      
      await moduleManager.registerModule(transformer);
      await transformer.start();
      
      const health = await moduleManager.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.modules[transformer.getId()]).toBeDefined();
      expect(health.modules[transformer.getId()].healthy).toBe(true);
    });
  });

  describe('Module Reset and Cleanup', () => {
    test('should reset all modules', async () => {
      const transformer = new SecureAnthropicToOpenAITransformer({
        preserveToolCalls: true,
        mapSystemMessage: true,
        defaultMaxTokens: 4096,
      });
      
      await moduleManager.registerModule(transformer);
      await transformer.start();
      
      // 执行一些操作来填充指标
      const input = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1000,
      };
      
      await moduleManager.executeModule(transformer.getId(), input);
      
      const metricsBefore = transformer.getMetrics();
      expect(metricsBefore.requestsProcessed).toBe(1);
      
      await moduleManager.resetAll();
      
      const metricsAfter = transformer.getMetrics();
      expect(metricsAfter.requestsProcessed).toBe(0);
    });

    test('should cleanup all modules', async () => {
      const transformer = new SecureAnthropicToOpenAITransformer({
        preserveToolCalls: true,
        mapSystemMessage: true,
        defaultMaxTokens: 4096,
      });
      
      await moduleManager.registerModule(transformer);
      
      expect(moduleManager.getAllModules()).toHaveLength(1);
      
      await moduleManager.cleanupAll();
      
      expect(moduleManager.getAllModules()).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle execution errors', async () => {
      const transformer = new SecureAnthropicToOpenAITransformer({
        preserveToolCalls: true,
        mapSystemMessage: true,
        defaultMaxTokens: 4096,
      });
      
      await moduleManager.registerModule(transformer);
      // 注意：不启动模块，应该抛出错误
      
      const input = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1000,
      };
      
      await expect(moduleManager.executeModule(transformer.getId(), input)).rejects.toThrow('Module is not running');
    });

    test('should handle pipeline errors', async () => {
      const transformer1 = new SecureAnthropicToOpenAITransformer({
        preserveToolCalls: true,
        mapSystemMessage: true,
        defaultMaxTokens: 4096,
      });
      
      const transformer2 = new SecureAnthropicToOpenAITransformer({
        preserveToolCalls: false,
        mapSystemMessage: false,
        defaultMaxTokens: 2048,
      });
      
      await moduleManager.registerModule(transformer1);
      await moduleManager.registerModule(transformer2);
      
      await transformer1.start();
      // transformer2未启动
      
      const input = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1000,
      };
      
      await expect(moduleManager.executePipeline([
        transformer1.getId(),
        transformer2.getId()
      ], input)).rejects.toThrow('Module is not running');
    });
  });
});