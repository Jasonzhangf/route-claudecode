/**
 * Enhanced Config Preprocessor Unit Test
 * 
 * 完整的配置预处理器单元测试，包含输出文件保存和详细报告
 */

import * as fs from 'fs';
import * as path from 'path';
import { ConfigPreprocessor } from '../config-preprocessor';
import { JQJsonHandler } from '../../../error-handler/src/utils/jq-json-handler';

describe('Enhanced Config Preprocessor', () => {
  const testOutputDir = path.join(__dirname, 'test-outputs');
  const configPath = '/Users/fanzhang/.route-claudecode/config/v4/single-provider/qwen-iflow-mixed-v4-5511-standard.json';

  beforeAll(() => {
    // 创建测试输出目录
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  test('应该成功读取和预处理配置文件', async () => {
    const startTime = Date.now();
    
    // 执行配置预处理
    const result = ConfigPreprocessor.preprocess(configPath);
    
    const processingTime = Date.now() - startTime;

    // 基础验证
    expect(result.success).toBe(true);
    expect(result.routingTable).toBeDefined();
    expect(result.metadata).toBeDefined();

    // 保存完整结果到输出文件
    const outputFile = path.join(testOutputDir, 'config-preprocessor-full-result.json');
    fs.writeFileSync(outputFile, JQJsonHandler.stringifyJson(result, true), 'utf8');

    // 生成详细测试报告
    const report = {
      testName: 'Enhanced Config Preprocessor Test',
      timestamp: new Date().toISOString(),
      configFile: configPath,
      processingTime: processingTime,
      success: result.success,
      
      // 配置文件分析
      sourceAnalysis: {
        format: result.metadata.sourceFormat,
        processingTimeMs: result.metadata.processingTime
      },

      // Provider分析
      providerAnalysis: result.routingTable ? {
        totalProviders: result.routingTable.providers.length,
        providers: result.routingTable.providers.map(provider => ({
          name: provider.name,
          priority: provider.priority,
          modelsCount: provider.models.length,
          hasServerCompatibility: !!provider.serverCompatibility,
          systemEnhanced: provider.serverCompatibility?.options ? 
            Object.keys(provider.serverCompatibility.options).includes('timeout') ||
            Object.keys(provider.serverCompatibility.options).includes('protocol') ||
            Object.keys(provider.serverCompatibility.options).includes('transformer')
            : false,
          enhancedOptions: provider.serverCompatibility?.options ? 
            Object.keys(provider.serverCompatibility.options).filter(key => 
              ['timeout', 'maxRetries', 'protocol', 'transformer'].includes(key)
            ) : []
        }))
      } : null,

      // 路由分析
      routingAnalysis: result.routingTable ? {
        totalRoutes: Object.keys(result.routingTable.routes).length,
        routeNames: Object.keys(result.routingTable.routes),
        hasDefaultRoute: 'default' in result.routingTable.routes,
        multiProviderRoutes: Object.entries(result.routingTable.routes)
          .filter(([, value]) => value.includes(';'))
          .map(([name]) => name)
      } : null,

      // 服务器配置分析
      serverAnalysis: result.routingTable ? {
        port: result.routingTable.server.port,
        host: result.routingTable.server.host,
        debugEnabled: result.routingTable.server.debug
      } : null,

      // 验证结果
      validationResults: {
        hasProviders: result.routingTable ? result.routingTable.providers.length > 0 : false,
        hasRoutes: result.routingTable ? Object.keys(result.routingTable.routes).length > 0 : false,
        hasApiKey: result.routingTable ? !!result.routingTable.apiKey : false,
        hasDescription: result.routingTable ? !!result.routingTable.description : false,
        systemConfigLoaded: result.routingTable ? 
          result.routingTable.providers.some(p => 
            p.serverCompatibility?.options && 
            ('timeout' in p.serverCompatibility.options || 'protocol' in p.serverCompatibility.options)
          ) : false
      }
    };

    // 保存测试报告
    const reportFile = path.join(testOutputDir, 'config-preprocessor-test-report.json');
    fs.writeFileSync(reportFile, JQJsonHandler.stringifyJson(report, true), 'utf8');

    // 分别保存路由表和元数据
    if (result.routingTable) {
      const routingTableFile = path.join(testOutputDir, 'routing-table-output.json');
      fs.writeFileSync(routingTableFile, JQJsonHandler.stringifyJson(result.routingTable, true), 'utf8');
    }

    const metadataFile = path.join(testOutputDir, 'preprocessing-metadata.json');
    fs.writeFileSync(metadataFile, JQJsonHandler.stringifyJson(result.metadata, true), 'utf8');

    // 断言验证
    expect(result.routingTable?.providers.length).toBeGreaterThan(0);
    expect(Object.keys(result.routingTable?.routes || {}).length).toBeGreaterThan(0);
    expect(result.routingTable?.apiKey).toBeTruthy();
    expect(result.routingTable?.server.port).toBe(5511);

    // 验证系统配置增强
    const iflowProvider = result.routingTable?.providers.find(p => p.name === 'iflow');
    expect(iflowProvider).toBeDefined();
    expect(iflowProvider?.serverCompatibility?.options).toHaveProperty('timeout');
    expect(iflowProvider?.serverCompatibility?.options).toHaveProperty('protocol', 'openai');
    expect(iflowProvider?.serverCompatibility?.options).toHaveProperty('transformer', 'anthropic-to-openai-transformer');

    console.log(`✅ 测试完成 - 输出文件保存在: ${testOutputDir}`);
    console.log(`📊 处理时间: ${processingTime}ms`);
    console.log(`🔍 Providers: ${result.routingTable?.providers.length}`);
    console.log(`🔍 Routes: ${Object.keys(result.routingTable?.routes || {}).length}`);
  });

  test('应该正确处理系统配置合并', () => {
    const result = ConfigPreprocessor.preprocess(configPath);
    
    expect(result.success).toBe(true);
    
    // 检查iflow provider的系统配置增强
    const iflowProvider = result.routingTable?.providers.find(p => p.name === 'iflow');
    expect(iflowProvider?.serverCompatibility?.options).toMatchObject({
      timeout: 60000,
      maxRetries: 3,
      protocol: 'openai',
      transformer: 'anthropic-to-openai-transformer'
    });

    // 保存系统配置增强验证结果
    const enhancementVerification = {
      testName: 'System Config Enhancement Verification',
      timestamp: new Date().toISOString(),
      
      enhancedProviders: result.routingTable?.providers.map(provider => ({
        name: provider.name,
        originalOptions: Object.keys(provider.serverCompatibility?.options || {})
          .filter(key => !['timeout', 'maxRetries', 'protocol', 'transformer'].includes(key)),
        systemEnhancedOptions: Object.keys(provider.serverCompatibility?.options || {})
          .filter(key => ['timeout', 'maxRetries', 'protocol', 'transformer'].includes(key))
      })) || []
    };

    const enhancementFile = path.join(testOutputDir, 'system-enhancement-verification.json');
    fs.writeFileSync(enhancementFile, JQJsonHandler.stringifyJson(enhancementVerification, true), 'utf8');
  });

  test('应该生成完整的测试摘要', () => {
    const result = ConfigPreprocessor.preprocess(configPath);
    
    const summary = {
      testSuite: 'Enhanced Config Preprocessor Unit Tests',
      timestamp: new Date().toISOString(),
      configSource: configPath,
      
      testResults: {
        configProcessingSuccess: result.success,
        providersProcessed: result.routingTable?.providers.length || 0,
        routesGenerated: Object.keys(result.routingTable?.routes || {}).length,
        systemConfigMerged: result.routingTable?.providers.some(p => 
          p.serverCompatibility?.options && 
          ('timeout' in p.serverCompatibility.options)
        ) || false
      },
      
      outputFiles: [
        'config-preprocessor-full-result.json',
        'config-preprocessor-test-report.json', 
        'routing-table-output.json',
        'preprocessing-metadata.json',
        'system-enhancement-verification.json',
        'test-summary.json'
      ],
      
      nextSteps: [
        '1. 手动检查 routing-table-output.json 确认路由表正确性',
        '2. 验证系统配置增强是否符合预期',
        '3. 确认可以传递给路由器模块进行下一步处理'
      ]
    };

    const summaryFile = path.join(testOutputDir, 'test-summary.json');
    fs.writeFileSync(summaryFile, JQJsonHandler.stringifyJson(summary, true), 'utf8');

    expect(summary.testResults.configProcessingSuccess).toBe(true);
    expect(summary.testResults.providersProcessed).toBeGreaterThan(0);
  });
});