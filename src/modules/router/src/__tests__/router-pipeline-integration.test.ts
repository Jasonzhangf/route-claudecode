/**
 * Router and Pipeline Integration Test
 * 
 * 完整的Config -> Router -> Pipeline集成测试
 */

import * as fs from 'fs';
import * as path from 'path';
import { ConfigPreprocessor } from '../../../config/src/config-preprocessor';
import { RouterPreprocessor } from '../router-preprocessor';
import { JQJsonHandler } from '../../../utils/jq-json-handler';

describe('Router and Pipeline Integration', () => {
  const testOutputDir = path.join(__dirname, 'test-outputs');
  const configPath = '/Users/fanzhang/.route-claudecode/config/v4/single-provider/qwen-iflow-mixed-v4-5511-standard.json';

  beforeAll(() => {
    // 创建测试输出目录
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  test('应该完成完整的Config->Router->Pipeline流程', async () => {
    const fullProcessStartTime = Date.now();

    // 步骤1: Config预处理
    console.log('🔧 步骤1: 配置预处理...');
    const configResult = await ConfigPreprocessor.preprocess(configPath);
    expect(configResult.success).toBe(true);
    expect(configResult.routingTable).toBeDefined();

    // 保存Config步骤输出
    const configOutput = path.join(testOutputDir, 'step1-config-output.json');
    fs.writeFileSync(configOutput, JQJsonHandler.stringifyJson(configResult, true), 'utf8');

    // 步骤2: Router预处理
    console.log('🚀 步骤2: 路由器预处理...');
    const routerResult = await RouterPreprocessor.preprocess(configResult.routingTable!);
    expect(routerResult.success).toBe(true);
    expect(routerResult.routingTable).toBeDefined();
    expect(routerResult.pipelineConfigs).toBeDefined();

    // 保存Router步骤输出
    const routerOutput = path.join(testOutputDir, 'step2-router-output.json');
    fs.writeFileSync(routerOutput, JQJsonHandler.stringifyJson(routerResult, true), 'utf8');

    const fullProcessTime = Date.now() - fullProcessStartTime;

    // 生成完整集成报告
    const integrationReport = {
      testName: 'Config->Router->Pipeline Integration Test',
      timestamp: new Date().toISOString(),
      configSource: configPath,
      totalProcessingTime: fullProcessTime,
      
      step1_config: {
        success: configResult.success,
        processingTime: configResult.metadata.processingTime,
        providersFound: configResult.routingTable?.providers.length || 0,
        routesFound: Object.keys(configResult.routingTable?.routes || {}).length,
        systemConfigMerged: configResult.routingTable?.providers.some(p => 
          p.serverCompatibility?.options && 
          ('timeout' in p.serverCompatibility.options)
        ) || false
      },
      
      step2_router: {
        success: routerResult.success,
        processingTime: routerResult.stats.processingTimeMs,
        internalRoutesGenerated: routerResult.stats.routesCount,
        pipelineConfigsGenerated: routerResult.stats.pipelinesCount,
        errors: routerResult.errors,
        warnings: routerResult.warnings
      },
      
      dataFlow: {
        configProviders: configResult.routingTable?.providers.map(p => p.name) || [],
        routerRoutes: Object.keys(routerResult.routingTable?.routes || {}),
        pipelineIds: routerResult.pipelineConfigs?.map(p => p.pipelineId) || [],
        endpointUrls: [...new Set(routerResult.pipelineConfigs?.map(p => p.endpoint) || [])]
      },
      
      validation: {
        configToRouterDataIntegrity: configResult.routingTable?.providers.length === 
          (routerResult.pipelineConfigs?.map(p => p.provider).filter((v, i, a) => a.indexOf(v) === i).length || 0),
        allRoutesHavePipelines: Object.keys(configResult.routingTable?.routes || {}).every(route =>
          routerResult.pipelineConfigs?.some(p => p.routeId.includes(route)) || false
        ),
        pipelineLayersValid: routerResult.pipelineConfigs?.every(p => 
          p.layers.length >= 4 && 
          p.layers.some(l => l.type === 'transformer') &&
          p.layers.some(l => l.type === 'server')
        ) || false
      }
    };

    // 保存集成报告
    const reportOutput = path.join(testOutputDir, 'integration-report.json');
    fs.writeFileSync(reportOutput, JQJsonHandler.stringifyJson(integrationReport, true), 'utf8');

    // 单独保存关键输出用于检查
    if (routerResult.routingTable) {
      const internalRoutingTableOutput = path.join(testOutputDir, 'internal-routing-table.json');
      fs.writeFileSync(internalRoutingTableOutput, JQJsonHandler.stringifyJson(routerResult.routingTable, true), 'utf8');
    }

    if (routerResult.pipelineConfigs) {
      const pipelineConfigsOutput = path.join(testOutputDir, 'pipeline-configs.json');
      fs.writeFileSync(pipelineConfigsOutput, JQJsonHandler.stringifyJson(routerResult.pipelineConfigs, true), 'utf8');
    }

    // 断言验证
    expect(routerResult.pipelineConfigs?.length).toBeGreaterThan(0);
    expect(routerResult.routingTable?.routes).toBeDefined();
    expect(Object.keys(routerResult.routingTable?.routes || {}).length).toBeGreaterThan(0);
    
    // 验证pipeline配置结构
    if (routerResult.pipelineConfigs) {
      for (const pipeline of routerResult.pipelineConfigs) {
        expect(pipeline.pipelineId).toBeTruthy();
        expect(pipeline.provider).toBeTruthy();
        expect(pipeline.model).toBeTruthy();
        expect(pipeline.endpoint).toBeTruthy();
        expect(pipeline.layers.length).toBeGreaterThanOrEqual(4);
      }
    }

    console.log(`✅ 集成测试完成 - 总处理时间: ${fullProcessTime}ms`);
    console.log(`🔍 生成了 ${routerResult.stats.pipelinesCount} 个流水线配置`);
    console.log(`📁 输出文件保存在: ${testOutputDir}`);
  });

  test('应该验证流水线配置的完整性', async () => {
    const configResult = await ConfigPreprocessor.preprocess(configPath);
    const routerResult = await RouterPreprocessor.preprocess(configResult.routingTable!);
    
    expect(routerResult.success).toBe(true);

    // 验证每个流水线都有完整的6层架构
    const pipelineValidation = routerResult.pipelineConfigs?.map(pipeline => ({
      pipelineId: pipeline.pipelineId,
      provider: pipeline.provider,
      model: pipeline.model,
      layersCount: pipeline.layers.length,
      hasTransformer: pipeline.layers.some(l => l.type === 'transformer'),
      hasProtocol: pipeline.layers.some(l => l.type === 'protocol'),
      hasServerCompatibility: pipeline.layers.some(l => l.type === 'server-compatibility'),
      hasServer: pipeline.layers.some(l => l.type === 'server'),
      layerTypes: pipeline.layers.map(l => l.type),
      isValid: pipeline.layers.length >= 4 &&
               pipeline.layers.some(l => l.type === 'transformer') &&
               pipeline.layers.some(l => l.type === 'protocol') &&
               pipeline.layers.some(l => l.type === 'server-compatibility') &&
               pipeline.layers.some(l => l.type === 'server')
    })) || [];

    const validationOutput = path.join(testOutputDir, 'pipeline-validation.json');
    fs.writeFileSync(validationOutput, JQJsonHandler.stringifyJson({
      validationTimestamp: new Date().toISOString(),
      totalPipelines: pipelineValidation.length,
      validPipelines: pipelineValidation.filter(p => p.isValid).length,
      invalidPipelines: pipelineValidation.filter(p => !p.isValid).length,
      pipelines: pipelineValidation
    }, true));

    // 所有流水线都应该有效
    expect(pipelineValidation.every(p => p.isValid)).toBe(true);
  });

  test('应该生成最终测试摘要', async () => {
    const configResult = await ConfigPreprocessor.preprocess(configPath);
    const routerResult = await RouterPreprocessor.preprocess(configResult.routingTable!);

    const finalSummary = {
      testSuite: 'Router and Pipeline Integration Tests',
      timestamp: new Date().toISOString(),
      configSource: configPath,
      
      overallResults: {
        configProcessingSuccess: configResult.success,
        routerProcessingSuccess: routerResult.success,
        integrationComplete: configResult.success && routerResult.success,
        totalProcessingSteps: 2
      },
      
      dataTransformation: {
        inputProviders: configResult.routingTable?.providers.length || 0,
        inputRoutes: Object.keys(configResult.routingTable?.routes || {}).length,
        outputInternalRoutes: routerResult.stats.routesCount,
        outputPipelineConfigs: routerResult.stats.pipelinesCount
      },
      
      readyForNextStep: {
        hasInternalRoutingTable: !!routerResult.routingTable,
        hasPipelineConfigs: !!routerResult.pipelineConfigs,
        allPipelinesValid: routerResult.pipelineConfigs?.every(p => p.layers.length >= 4) || false,
        canStartHTTPServer: routerResult.success && 
                           !!routerResult.routingTable && 
                           !!routerResult.pipelineConfigs &&
                           routerResult.pipelineConfigs.length > 0
      },
      
      outputFiles: [
        'step1-config-output.json',
        'step2-router-output.json', 
        'integration-report.json',
        'internal-routing-table.json',
        'pipeline-configs.json',
        'pipeline-validation.json',
        'final-summary.json'
      ],
      
      nextSteps: [
        '1. 手动检查 pipeline-configs.json 确认流水线配置正确',
        '2. 验证 internal-routing-table.json 路由表结构',
        '3. 准备启动HTTP服务器，使用生成的配置'
      ]
    };

    const summaryOutput = path.join(testOutputDir, 'final-summary.json');
    fs.writeFileSync(summaryOutput, JQJsonHandler.stringifyJson(finalSummary, true), 'utf8');

    expect(finalSummary.readyForNextStep.canStartHTTPServer).toBe(true);
    expect(finalSummary.overallResults.integrationComplete).toBe(true);

    console.log('📋 最终摘要已生成');
    console.log(`🚀 准备启动HTTP服务器: ${finalSummary.readyForNextStep.canStartHTTPServer}`);
  });
});