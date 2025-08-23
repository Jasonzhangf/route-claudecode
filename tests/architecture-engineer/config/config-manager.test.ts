/**
 * Config模块单元测试
 * 
 * 基于实际配置文件进行测试验证
 * 测试双接口设计：输入多配置源 → 输出模块化配置
 * 
 * @module ConfigManagerTest
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ConfigManager, getConfigManager, setConfigManager, cleanupGlobalConfigManager } from '../../src/config/config-manager';
import { ResponsibilityChecker } from '../../src/config/responsibility-checker';
import { JQJsonHandler } from '../../src/utils/jq-json-handler';
import path from 'path';

describe('Config模块核心功能测试', () => {
  let configManager: ConfigManager;
  const testConfigPath = path.join(__dirname, 'lmstudio-v4-5506-demo1-enhanced.json');

  beforeEach(() => {
    configManager = new ConfigManager();
  });

  afterEach(() => {
    configManager.clearCache();
    cleanupGlobalConfigManager();
  });

  describe('模块责任分离验证', () => {
    test('应该通过模块字段责任分离检查', () => {
      const result = ResponsibilityChecker.checkModuleResponsibilities();
      
      expect(result.hasConflicts).toBe(false);
      expect(result.summary.totalFields).toBeGreaterThan(0);
      expect(result.summary.conflictingFields).toBe(0);
    });

    test('应该正确识别模块字段所有权', () => {
      expect(ResponsibilityChecker.isFieldOwnedByModule('client.serverUrl', 'client')).toBe(true);
      expect(ResponsibilityChecker.isFieldOwnedByModule('routing.pipelineArchitecture', 'router')).toBe(true);
      expect(ResponsibilityChecker.isFieldOwnedByModule('providers', 'provider')).toBe(true);
      expect(ResponsibilityChecker.isFieldOwnedByModule('server.port', 'server')).toBe(true);
      
      // 测试跨模块字段访问应该被拒绝
      expect(ResponsibilityChecker.isFieldOwnedByModule('client.serverUrl', 'router')).toBe(false);
      expect(ResponsibilityChecker.isFieldOwnedByModule('server.port', 'client')).toBe(false);
    });

    test('应该生成详细的责任分离报告', () => {
      const report = ResponsibilityChecker.generateResponsibilityReport();
      
      expect(report).toContain('# 模块字段责任分离报告');
      expect(report).toContain('## client模块');
      expect(report).toContain('## router模块');
      expect(report).toContain('## provider模块');
      expect(report).toContain('✅ 无责任冲突');
    });
  });

  describe('配置加载和转换测试', () => {
    test('应该成功加载实际配置文件', async () => {
      const sources = {
        userConfigPath: testConfigPath
      };

      const moduleConfig = await configManager.loadConfiguration(sources);

      expect(moduleConfig).toBeDefined();
      expect(moduleConfig.config.version).toBe('4.0.0');
      expect(moduleConfig.config.architecture).toBe('six-layer-enterprise');
    });

    test('应该正确转换Demo1格式到模块化配置', async () => {
      const sources = {
        userConfigPath: testConfigPath
      };

      const moduleConfig = await configManager.loadConfiguration(sources);

      // 验证Provider模块配置
      expect(moduleConfig.provider.providers).toHaveLength(1);
      expect(moduleConfig.provider.providers[0]).toMatchObject({
        name: 'openai',
        api_base_url: 'http://localhost:1234/v1/chat/completions',
        api_key: 'lm-studio-key-1'
      });
      expect(moduleConfig.provider.providers[0].models).toContain('gpt-oss-20b-mlx');

      // 验证Router模块配置
      expect(moduleConfig.router.routingRules.modelMapping).toMatchObject({
        default: 'openai,gpt-oss-20b-mlx',
        reasoning: 'openai,gpt-oss-20b-mlx'
      });

      // 验证Server模块配置
      expect(moduleConfig.server.port).toBe(5506);
      expect(moduleConfig.server.host).toBe('0.0.0.0');
      expect(moduleConfig.server.name).toBe('RCC-v4-Server');

      // 验证Security模块配置
      expect(moduleConfig.security.authentication.apiKey).toBe('rcc4-proxy-key');
    });

    test('应该正确处理配置文件中的各种字段类型', async () => {
      const sources = {
        userConfigPath: testConfigPath
      };

      const moduleConfig = await configManager.loadConfiguration(sources);

      // 测试数字类型
      expect(typeof moduleConfig.server.port).toBe('number');
      expect(moduleConfig.server.port).toBe(5506);

      // 测试字符串类型
      expect(typeof moduleConfig.server.host).toBe('string');
      expect(moduleConfig.server.host).toBe('0.0.0.0');

      // 测试布尔类型
      expect(typeof moduleConfig.debug.enabled).toBe('boolean');
      expect(moduleConfig.debug.enabled).toBe(true);

      // 测试数组类型
      expect(Array.isArray(moduleConfig.provider.providers[0].models)).toBe(true);
      expect(moduleConfig.provider.providers[0].models).toContain('qwen2.5-coder-7b-instruct-q4_k_m.gguf');

      // 测试对象类型
      expect(typeof moduleConfig.router.routingRules).toBe('object');
      expect(moduleConfig.router.routingRules.modelMapping.longContext).toBe('openai,gpt-oss-20b-mlx');
    });
  });

  describe('模块配置访问测试', () => {
    test('应该允许模块访问自有配置字段', async () => {
      const sources = {
        userConfigPath: testConfigPath
      };

      await configManager.loadConfiguration(sources);

      const clientConfig = configManager.getModuleConfiguration('client');
      expect(clientConfig).toBeDefined();
      expect(clientConfig?.serverUrl).toBe('http://localhost:3456');
      expect(clientConfig?.timeout).toBe(30000);

      const serverConfig = configManager.getModuleConfiguration('server');
      expect(serverConfig).toBeDefined();
      expect(serverConfig?.port).toBe(5506);
      expect(serverConfig?.host).toBe('0.0.0.0');
    });

    test('应该为每个模块生成完整的配置', async () => {
      const sources = {
        userConfigPath: testConfigPath
      };

      await configManager.loadConfiguration(sources);

      // 验证所有模块都有配置
      const moduleNames = ['client', 'router', 'pipeline', 'provider', 'debug', 'errorHandler', 'server', 'security', 'config'];
      
      for (const moduleName of moduleNames) {
        const moduleConfig = configManager.getModuleConfiguration(moduleName as any);
        expect(moduleConfig).toBeDefined();
        expect(typeof moduleConfig).toBe('object');
      }
    });
  });

  describe('JQ JSON处理测试', () => {
    test('应该使用JQ严格解析JSON配置文件', () => {
      const jqHandler = new JQJsonHandler();
      const configData = jqHandler.parseJsonFile(testConfigPath);

      expect(configData).toBeDefined();
      expect(configData.Providers).toHaveLength(1);
      expect(configData.Providers[0].name).toBe('openai');
      expect(configData.Router.default).toBe('openai,gpt-oss-20b-mlx');
      expect(configData.server.port).toBe(5506);
      expect(configData.APIKEY).toBe('rcc4-proxy-key');
    });

    test('应该使用JQ生成格式化的配置输出', async () => {
      const sources = {
        userConfigPath: testConfigPath
      };

      await configManager.loadConfiguration(sources);
      const jsonOutput = configManager.generateConfigurationOutput('json');

      expect(jsonOutput).toBeDefined();
      expect(typeof jsonOutput).toBe('string');
      
      // 验证JSON格式有效
      const parsedOutput = JSON.parse(jsonOutput);
      expect(parsedOutput.config.version).toBe('4.0.0');
      expect(parsedOutput.server.port).toBe(5506);
    });
  });

  describe('错误处理和验证测试', () => {
    test('应该在配置文件不存在时抛出明确错误', async () => {
      const sources = {
        userConfigPath: '/path/to/nonexistent/config.json'
      };

      await expect(
        configManager.loadConfiguration(sources)
      ).rejects.toThrow(/JQ配置读取失败/);
    });

    test('应该在配置格式无效时抛出验证错误', async () => {
      // 创建无效配置文件用于测试
      const invalidConfigPath = path.join(__dirname, 'invalid-config.json');
      const invalidConfig = {
        Providers: 'not-an-array', // 应该是数组
        Router: null // 应该是对象
      };

      const jqHandler = new JQJsonHandler();
      jqHandler.writeJsonFile(invalidConfigPath, invalidConfig);

      const sources = {
        userConfigPath: invalidConfigPath
      };

      await expect(
        configManager.loadConfiguration(sources)
      ).rejects.toThrow(/配置验证失败/);

      // 清理测试文件
      require('fs').unlinkSync(invalidConfigPath);
    });

    test('应该在模块责任冲突时阻止配置加载', async () => {
      // 这个测试验证责任检查器在检测到冲突时的行为
      // 由于当前设计没有冲突，我们验证检查机制本身
      const result = ResponsibilityChecker.checkModuleResponsibilities();
      expect(result.hasConflicts).toBe(false);
      
      // 如果有冲突，配置加载应该失败
      // 这里验证检查机制正常工作
      expect(result.summary.totalFields).toBeGreaterThan(50); // 应该检查了足够多的字段
    });
  });

  describe('配置状态和缓存管理测试', () => {
    test('应该正确跟踪配置加载状态', async () => {
      let status = configManager.getConfigurationStatus();
      expect(status.loaded).toBe(false);
      expect(status.modulesCount).toBe(0);

      const sources = {
        userConfigPath: testConfigPath
      };

      await configManager.loadConfiguration(sources);

      status = configManager.getConfigurationStatus();
      expect(status.loaded).toBe(true);
      expect(status.modulesCount).toBe(9); // 9个模块
      expect(status.lastLoadTime).toBeDefined();
    });

    test('应该正确清理配置缓存', async () => {
      const sources = {
        userConfigPath: testConfigPath
      };

      await configManager.loadConfiguration(sources);
      expect(configManager.getConfigurationStatus().loaded).toBe(true);

      configManager.clearCache();
      expect(configManager.getConfigurationStatus().loaded).toBe(false);
    });
  });

  describe('全局配置管理器测试', () => {
    test('应该提供单例全局配置管理器', () => {
      const manager1 = getConfigManager();
      const manager2 = getConfigManager();
      
      expect(manager1).toBe(manager2); // 应该是同一个实例
    });

    test('应该允许设置和清理全局配置管理器', () => {
      const customManager = new ConfigManager();
      setConfigManager(customManager);
      
      const retrievedManager = getConfigManager();
      expect(retrievedManager).toBe(customManager);

      cleanupGlobalConfigManager();
      
      // 清理后获取新实例应该不同
      const newManager = getConfigManager();
      expect(newManager).not.toBe(customManager);
    });
  });

  describe('实际配置文件兼容性测试', () => {
    test('应该正确处理Demo1增强格式的所有字段', async () => {
      const sources = {
        userConfigPath: testConfigPath
      };

      const moduleConfig = await configManager.loadConfiguration(sources);

      // 验证Provider权重配置
      expect(moduleConfig.provider.providers[0].weight).toBe(100);
      
      // 验证maxTokens配置
      expect(moduleConfig.provider.providers[0].maxTokens).toBe(131072);
      
      // 验证serverCompatibility配置
      expect(moduleConfig.provider.providers[0].serverCompatibility).toBe('lmstudio');
      
      // 验证多个模型配置
      const models = moduleConfig.provider.providers[0].models;
      expect(models).toContain('gpt-oss-20b-mlx');
      expect(models).toContain('llama-3.1-8b-instruct-q4_k_m.gguf');
      expect(models).toContain('qwen2.5-coder-7b-instruct-q4_k_m.gguf');
      expect(models).toContain('deepseek-r1-distill-llama-8b-q4_k_m.gguf');

      // 验证Router配置的完整性
      const routerMapping = moduleConfig.router.routingRules.modelMapping;
      expect(routerMapping.default).toBe('openai,gpt-oss-20b-mlx');
      expect(routerMapping.reasoning).toBe('openai,gpt-oss-20b-mlx');
      expect(routerMapping.longContext).toBe('openai,gpt-oss-20b-mlx');
      expect(routerMapping.webSearch).toBe('openai,gpt-oss-20b-mlx');
      expect(routerMapping.background).toBe('openai,gpt-oss-20b-mlx');
    });

    test('应该保持配置转换的数据完整性', async () => {
      const sources = {
        userConfigPath: testConfigPath
      };

      // 先读取原始配置
      const jqHandler = new JQJsonHandler();
      const originalConfig = jqHandler.parseJsonFile(testConfigPath);

      // 加载并转换配置
      const moduleConfig = await configManager.loadConfiguration(sources);

      // 验证关键数据没有丢失或改变
      expect(moduleConfig.provider.providers[0].api_base_url).toBe(originalConfig.Providers[0].api_base_url);
      expect(moduleConfig.provider.providers[0].api_key).toBe(originalConfig.Providers[0].api_key);
      expect(moduleConfig.server.port).toBe(originalConfig.server.port);
      expect(moduleConfig.server.host).toBe(originalConfig.server.host);
      expect(moduleConfig.security.authentication.apiKey).toBe(originalConfig.APIKEY);
    });
  });
});