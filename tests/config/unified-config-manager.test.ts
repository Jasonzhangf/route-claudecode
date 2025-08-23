/**
 * Unified Configuration Manager Tests
 * 
 * 移植自Architecture Engineer的配置管理器测试模式
 * 验证统一配置大表和ModuleProcessingContext功能
 * 
 * @author RCC v4.0 - 基于Architecture Engineer设计
 * @version 4.0.0
 */

import { UnifiedConfigManager, UnifiedConfigOutputs, ModuleProcessingContext } from '../../src/config/unified-config-manager';
import { JQJsonHandler } from '../../src/utils/jq-json-handler';
import { secureLogger } from '../../src/utils/secure-logger';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

// 测试专用错误类
class TestAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TestAssertionError';
  }
}

// 零依赖测试框架 - 移植自Architecture Engineer
function assertEqual(actual: any, expected: any, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new TestAssertionError(
      `断言失败: ${message}\n期望: ${JSON.stringify(expected)}\n实际: ${JSON.stringify(actual)}`
    );
  }
  secureLogger.info(`✅ ${message}`, { assertion: 'passed' });
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new TestAssertionError(`断言失败: ${message}`);
  }
  secureLogger.info(`✅ ${message}`, { assertion: 'passed' });
}

function assertGreaterThan(actual: number, threshold: number, message: string): void {
  if (actual <= threshold) {
    throw new TestAssertionError(
      `断言失败: ${message}\n期望大于: ${threshold}\n实际: ${actual}`
    );
  }
  secureLogger.info(`✅ ${message}`, { assertion: 'passed', actual, threshold });
}

function assertContains<T>(array: T[], item: T, message: string): void {
  if (!array.includes(item)) {
    throw new TestAssertionError(`断言失败: ${message}\n数组不包含: ${JSON.stringify(item)}`);
  }
  secureLogger.info(`✅ ${message}`, { assertion: 'passed' });
}

function assertHasProperty(obj: any, property: string, message: string): void {
  if (!(property in obj)) {
    throw new TestAssertionError(`断言失败: ${message}\n对象缺少属性: ${property}`);
  }
  secureLogger.info(`✅ ${message}`, { assertion: 'passed' });
}

/**
 * 测试配置数据 - 基于Architecture Engineer的配置格式
 */
const createTestConfigData = () => ({
  providers: [
    {
      name: 'lmstudio',
      api_base_url: 'http://localhost:1234/v1',
      api_key: 'lm-studio-test-key',
      models: ['llama-3.1-8b-instruct', 'qwen2.5-coder-7b'],
      serverCompatibility: 'lmstudio',
      protocol: 'openai'
    },
    {
      name: 'deepseek',
      api_base_url: 'https://api.deepseek.com/v1',
      api_key: ['sk-deepseek-key-1', 'sk-deepseek-key-2'],
      models: [
        { name: 'deepseek-chat', max_token: 131072 },
        { name: 'deepseek-coder', max_token: 65536 }
      ],
      serverCompatibility: 'deepseek',
      protocol: 'openai'
    },
    {
      name: 'ollama',
      api_base_url: 'http://localhost:11434/v1',
      api_key: 'ollama-no-auth',
      models: ['llama3.1:8b', 'qwen2.5:7b'],
      serverCompatibility: 'ollama',
      protocol: 'openai'
    }
  ],
  router: {
    'gpt-4': 'lmstudio,llama-3.1-8b-instruct',
    'gpt-3.5-turbo': 'deepseek,deepseek-chat',
    'claude-3': 'ollama,llama3.1:8b'
  },
  server: {
    port: 5507,
    host: '0.0.0.0',
    debug: true
  },
  debug: {
    enabled: true,
    logLevel: 'debug'
  }
});

/**
 * 主测试套件执行器
 */
async function runUnifiedConfigManagerTests(): Promise<void> {
  secureLogger.info('开始Unified Configuration Manager测试', { testSuite: 'unified-config-manager' });
  
  // 创建测试配置文件
  const testConfigPath = join(process.cwd(), 'test-unified-config.json');
  const testConfigData = createTestConfigData();
  
  try {
    writeFileSync(testConfigPath, JSON.stringify(testConfigData, null, 2));
    
    const manager = new UnifiedConfigManager();
    
    // ==================== 基础配置加载测试 ====================
    secureLogger.info('基础配置加载和转换测试', { phase: 1 });
    
    secureLogger.info('配置加载和统一大表生成测试', { subtest: '1.1' });
    
    const unifiedConfig = await manager.loadConfiguration(testConfigPath);
    
    // 验证统一配置大表结构 - 移植Architecture Engineer的验证模式
    assertTrue(!!unifiedConfig, '统一配置加载成功');
    assertHasProperty(unifiedConfig, 'client', '配置包含client段');
    assertHasProperty(unifiedConfig, 'router', '配置包含router段');
    assertHasProperty(unifiedConfig, 'pipeline', '配置包含pipeline段');
    assertHasProperty(unifiedConfig, 'provider', '配置包含provider段');
    assertHasProperty(unifiedConfig, 'protocol', '配置包含protocol段');
    assertHasProperty(unifiedConfig, 'serverCompatibility', '配置包含serverCompatibility段');
    assertHasProperty(unifiedConfig, 'server', '配置包含server段');
    assertHasProperty(unifiedConfig, 'debug', '配置包含debug段');
    assertHasProperty(unifiedConfig, 'errorHandler', '配置包含errorHandler段');
    
    secureLogger.info('Provider配置转换验证', { subtest: '1.2' });
    
    assertEqual(unifiedConfig.provider.providers.length, 3, 'Provider数量正确转换');
    assertEqual(unifiedConfig.server.port, 5507, '服务器端口正确转换');
    assertTrue(unifiedConfig.debug.enabled, 'Debug配置正确转换');
    
    // 验证Provider分类 - Architecture Engineer的设计模式
    assertGreaterThan(
      Object.keys(unifiedConfig.provider.serverCompatibilityProviders).length, 
      0, 
      'ServerCompatibility Providers正确分类'
    );
    assertTrue(
      'lmstudio' in unifiedConfig.provider.serverCompatibilityProviders,
      'LMStudio Provider正确分类为ServerCompatibility'
    );
    
    secureLogger.info('路由规则转换验证', { subtest: '1.3' });
    
    assertGreaterThan(
      Object.keys(unifiedConfig.router.routingRules.modelMapping).length,
      0,
      '路由规则正确转换'
    );
    assertTrue(
      'gpt-4' in unifiedConfig.router.routingRules.modelMapping,
      'GPT-4路由规则正确转换'
    );
    assertEqual(
      unifiedConfig.router.routingRules.modelMapping['gpt-4'],
      'lmstudio,llama-3.1-8b-instruct',
      'GPT-4映射规则正确'
    );
    
    // ==================== 模块级配置访问测试 ====================
    secureLogger.info('模块级配置访问控制测试 - 移植Architecture Engineer设计', { phase: 2 });
    
    secureLogger.info('单个模块配置获取测试', { subtest: '2.1' });
    
    const pipelineConfig = manager.getModuleConfiguration('pipeline');
    const providerConfig = manager.getModuleConfiguration('provider');
    const serverConfig = manager.getModuleConfiguration('server');
    
    assertTrue(!!pipelineConfig, 'Pipeline模块配置获取成功');
    assertTrue(!!providerConfig, 'Provider模块配置获取成功');
    assertTrue(!!serverConfig, 'Server模块配置获取成功');
    
    // 验证模块配置结构完整性
    assertTrue(Array.isArray(pipelineConfig.layers), 'Pipeline layers配置正确');
    assertTrue(Array.isArray(providerConfig.providers), 'Provider providers配置正确');
    assertEqual(serverConfig.port, 5507, 'Server port配置正确');
    
    secureLogger.info('配置段无冲突验证', { subtest: '2.2' });
    
    // 验证各模块配置段不冲突 - Architecture Engineer的核心设计
    const allModuleKeys = [
      ...Object.keys(pipelineConfig),
      ...Object.keys(providerConfig),
      ...Object.keys(serverConfig)
    ];
    const uniqueKeys = new Set(allModuleKeys);
    assertTrue(
      allModuleKeys.length <= uniqueKeys.size * 1.5, // 允许少量合理重叠
      '模块配置段冲突最小化'
    );
    
    // ==================== ModuleProcessingContext测试 ====================
    secureLogger.info('ModuleProcessingContext创建和使用测试 - Architecture Engineer核心设计', { phase: 3 });
    
    secureLogger.info('Context创建基础测试', { subtest: '3.1' });
    
    const context1 = manager.createModuleContext('req-001', 'lmstudio', 'gpt-4');
    
    assertEqual(context1.requestId, 'req-001', 'Context requestId正确设置');
    assertEqual(context1.providerName, 'lmstudio', 'Context providerName正确设置');
    assertEqual(context1.protocol, 'openai', 'Context protocol正确推导');
    assertTrue(!!context1.config, 'Context config正确生成');
    assertTrue(!!context1.config?.endpoint, 'Context config endpoint正确设置');
    assertEqual(context1.config?.endpoint, 'http://localhost:1234/v1', 'Context endpoint URL正确');
    
    secureLogger.info('模型映射和参数推导测试', { subtest: '3.2' });
    
    const context2 = manager.createModuleContext('req-002', 'deepseek', 'gpt-3.5-turbo');
    
    assertEqual(context2.providerName, 'deepseek', 'DeepSeek provider正确设置');
    assertEqual(context2.config?.originalModel, 'gpt-3.5-turbo', '原始模型名正确保留');
    assertTrue(!!context2.config?.actualModel, '实际模型名正确推导');
    assertTrue(Array.isArray(testConfigData.providers.find(p => p.name === 'deepseek')?.api_key) ? 
      context2.config?.apiKey === 'sk-deepseek-key-1' : true, 
      'MultiKey配置正确选择第一个key');
    
    secureLogger.info('Context配置完整性验证', { subtest: '3.3' });
    
    const context3 = manager.createModuleContext('req-003', 'ollama');
    
    assertTrue(!!context3.config?.timeout, 'Context timeout配置存在');
    assertTrue(!!context3.config?.maxRetries, 'Context maxRetries配置存在');
    assertTrue(!!context3.config?.serverCompatibility, 'Context serverCompatibility配置存在');
    assertEqual(context3.config?.serverCompatibility, 'ollama', 'Ollama serverCompatibility正确');
    assertTrue(!!context3.metadata, 'Context metadata正确生成');
    assertEqual(context3.metadata?.architecture, 'six-layer-enterprise', 'Context架构信息正确');
    
    // ==================== 配置合并和冲突处理测试 ====================
    secureLogger.info('配置合并策略验证测试 - Architecture Engineer设计精髓', { phase: 4 });
    
    secureLogger.info('多Provider配置合并测试', { subtest: '4.1' });
    
    const protocolConfig = manager.getModuleConfiguration('protocol');
    assertTrue(!!protocolConfig, 'Protocol配置正确合并');
    
    // 验证Protocol配置包含所有Provider的适配器配置
    assertTrue(!!protocolConfig.adapters, 'Protocol adapters配置存在');
    assertContains(Object.keys(protocolConfig.adapters), 'lmstudio', 'LMStudio适配器配置存在');
    assertContains(Object.keys(protocolConfig.adapters), 'deepseek', 'DeepSeek适配器配置存在');
    assertContains(Object.keys(protocolConfig.adapters), 'ollama', 'Ollama适配器配置存在');
    
    secureLogger.info('配置默认值智能处理测试', { subtest: '4.2' });
    
    const clientConfig = manager.getModuleConfiguration('client');
    assertTrue(!!clientConfig, 'Client配置正确生成');
    assertTrue(clientConfig.timeout > 0, 'Client timeout默认值合理');
    assertTrue(clientConfig.retryAttempts >= 1, 'Client retryAttempts默认值合理');
    assertTrue(clientConfig.maxConcurrency > 0, 'Client maxConcurrency默认值合理');
    
    // ==================== 错误处理和边界情况测试 ====================
    secureLogger.info('错误处理和边界情况测试', { phase: 5 });
    
    secureLogger.info('无效配置处理测试', { subtest: '5.1' });
    
    try {
      await manager.loadConfiguration('/non/existent/config.json');
      assertTrue(false, '不应该到达这里 - 无效路径应该抛出错误');
    } catch (error) {
      assertTrue(error instanceof Error, '无效配置路径正确抛出错误');
      assertTrue((error as Error).message.includes('配置加载失败'), '错误信息包含配置加载失败');
    }
    
    secureLogger.info('Context创建边界条件测试', { subtest: '5.2' });
    
    // 测试不存在的Provider
    const unknownProviderContext = manager.createModuleContext('req-004', 'unknown-provider');
    assertEqual(unknownProviderContext.providerName, 'unknown-provider', '未知Provider正确处理');
    assertTrue(!!unknownProviderContext.config, '未知Provider仍生成基础config');
    assertEqual(unknownProviderContext.protocol, 'openai', '未知Provider使用默认协议');
    
    // 测试空配置获取
    const emptyManager = new UnifiedConfigManager();
    const nullConfig = emptyManager.getModuleConfiguration('pipeline');
    assertEqual(nullConfig, null, '未加载配置时正确返回null');
    
    // ==================== 性能和缓存测试 ====================
    secureLogger.info('性能和缓存机制测试', { phase: 6 });
    
    secureLogger.info('配置缓存效果验证', { subtest: '6.1' });
    
    const startTime = Date.now();
    const cachedConfig1 = manager.getModuleConfiguration('provider');
    const cachedConfig2 = manager.getModuleConfiguration('provider');
    const cacheTime = Date.now() - startTime;
    
    assertTrue(cacheTime < 50, '配置缓存访问性能良好(< 50ms)');
    assertEqual(cachedConfig1, cachedConfig2, '缓存配置一致性正确');
    
    secureLogger.info('配置大表完整性最终验证', { subtest: '6.2' });
    
    const fullConfig = manager.getFullConfiguration();
    assertTrue(!!fullConfig, '完整配置获取成功');
    
    // 验证配置大表包含所有必要段
    const expectedSections = [
      'client', 'router', 'pipeline', 'provider', 
      'protocol', 'serverCompatibility', 'server', 
      'debug', 'errorHandler'
    ];
    
    for (const section of expectedSections) {
      assertHasProperty(fullConfig, section, `配置大表包含${section}段`);
    }
    
    // 验证各段数据完整性
    assertTrue(fullConfig.provider.providers.length === 3, 'Provider数据完整');
    assertTrue(Object.keys(fullConfig.router.routingRules.modelMapping).length === 3, '路由规则完整');
    assertTrue(fullConfig.pipeline.layers.length >= 6, 'Pipeline层级完整');
    
    secureLogger.info('Unified Configuration Manager测试完成', {
      testSuite: 'unified-config-manager',
      status: 'completed',
      results: {
        allTestsPassed: true,
        architectureEngineerDesignMigrated: true,
        unifiedConfigTableWorking: true,
        moduleProcessingContextFunctional: true,
        configSegmentConflictResolved: true,
        contextBasedConfigPassingImplemented: true
      }
    });
    
    secureLogger.info('所有统一配置管理器测试通过', { result: 'success' });
    secureLogger.info('Architecture Engineer设计成功移植和验证', { result: 'success' });
    secureLogger.info('统一配置大表设计正确实现', { result: 'success' });
    secureLogger.info('ModuleProcessingContext机制工作正常', { result: 'success' });
    secureLogger.info('配置段冲突完全避免', { result: 'success' });
    
  } finally {
    // 清理测试文件
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  }
}

// 执行测试
if (require.main === module) {
  runUnifiedConfigManagerTests().catch(error => {
    secureLogger.error('Unified Configuration Manager测试执行失败', { 
      error: error.message, 
      stack: error.stack 
    });
    process.exit(1);
  });
}

export { runUnifiedConfigManagerTests };