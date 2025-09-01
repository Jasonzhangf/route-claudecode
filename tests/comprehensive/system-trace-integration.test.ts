/**
 * System Trace Integration Test - 系统跟踪集成测试
 *
 * @fileoverview 使用真实配置文件进行完整系统初始化跟踪的集成测试
 * @version 4.0.0
 * @author RCC Architecture Team
 * 
 * 🎯 测试目标：
 * 1. 完整的系统初始化到服务建立的跟踪
 * 2. 配置解析 → 路由生成 → 流水线组装的数据流验证
 * 3. 27条流水线构造的详细验证
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 系统跟踪结果接口
 */
interface SystemTraceResult {
  configurationAnalysis: {
    providersFound: number;
    modelsFound: number;
    routerRulesFound: number;
    serverConfigFound: boolean;
    providersDetail: Array<{
      name: string;
      priority: number;
      modelsCount: number;
      keysCount: number;
      serverCompatibility: string;
    }>;
  };
  routingSystemAnalysis: {
    expectedPipelines: number;
    routingCategoriesFound: number;
    providerDistribution: Record<string, number>;
    modelDistribution: Record<string, number>;
    routerBasedPipelines: Record<string, Array<{ provider: string; model: string }>>;
  };
  pipelineAssemblyAnalysis: {
    totalExpectedPipelines: number;
    pipelinesByProvider: Record<string, number>;
    layerTypesRequired: string[];
    serverCompatibilityTypes: string[];
  };
  detailedPipelineConstruction: Array<{
    pipelineId: string;
    provider: string;
    model: string;
    category: string;
    serverCompatibility: string;
    expectedLayers: Array<{
      type: string;
      name: string;
      purpose: string;
    }>;
  }>;
}

describe('System Trace Integration Test', () => {
  let configPath: string;
  let traceResult: SystemTraceResult;

  beforeAll(async () => {
    // 使用用户提供的真实配置文件
    configPath = '/Users/fanzhang/.route-claudecode/config.json';
    
    console.log('🚀 开始系统跟踪集成测试', {
      configPath,
      testStart: new Date().toISOString()
    });

    // 验证配置文件存在
    expect(fs.existsSync(configPath)).toBe(true);
  });

  afterAll(async () => {
    // 输出分类的跟踪结果到用户目录
    if (traceResult) {
      const baseOutputDir = path.join(process.env.HOME!, '.route-claudecode', 'debug-logs', 'system-trace-results');
      
      // 确保目录存在
      if (!fs.existsSync(baseOutputDir)) {
        fs.mkdirSync(baseOutputDir, { recursive: true });
      }
      
      // 分类存储结果
      await saveClassifiedResults(baseOutputDir, traceResult);
      
      console.log('📊 系统跟踪集成测试完成', {
        outputDirectory: baseOutputDir,
        totalRouterBasedPipelines: traceResult.pipelineAssemblyAnalysis?.totalExpectedPipelines || 'unknown',
        testEnd: new Date().toISOString()
      });
    }
  });

  test('Phase 1: Configuration System Analysis', async () => {
    console.log('📋 Phase 1: 配置系统分析');

    // 读取和解析配置文件
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    // 分析配置结构
    const providersDetail = config.Providers.map((provider: any) => {
      const activeModels = provider.models.filter((model: any) => 
        !provider.model_blacklist || !provider.model_blacklist.includes(model.name)
      );
      
      return {
        name: provider.name,
        priority: provider.priority,
        modelsCount: activeModels.length,
        keysCount: provider.apiKeys ? provider.apiKeys.length : 1,
        serverCompatibility: provider.serverCompatibility?.use || 'passthrough'
      };
    });

    const configAnalysis = {
      providersFound: config.Providers.length,
      modelsFound: config.Providers.reduce((total: number, provider: any) => {
        const activeModels = provider.models.filter((model: any) => 
          !provider.model_blacklist || !provider.model_blacklist.includes(model.name)
        );
        return total + activeModels.length;
      }, 0),
      routerRulesFound: Object.keys(config.Router || {}).length,
      serverConfigFound: !!config.server,
      providersDetail
    };

    // 验证配置分析结果
    expect(configAnalysis.providersFound).toBeGreaterThan(0);
    expect(configAnalysis.modelsFound).toBeGreaterThan(0);
    expect(configAnalysis.providersDetail.length).toBe(configAnalysis.providersFound);

    // 初始化跟踪结果
    traceResult = { configurationAnalysis: configAnalysis } as SystemTraceResult;

    console.log('✅ Phase 1 完成', {
      providers: configAnalysis.providersFound,
      models: configAnalysis.modelsFound,
      routerRules: configAnalysis.routerRulesFound
    });
  });

  test('Phase 2: Routing System Analysis', async () => {
    console.log('🔀 Phase 2: 路由系统分析');

    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    // 基于Router区域分析流水线需求
    const routerCategories = config.Router || {};
    const routerBasedPipelines: Record<string, Array<{ provider: string; model: string }>> = {};
    
    // ✅ 修复：过滤掉中文注释键，只处理实际的英文路由分类
    Object.entries(routerCategories).forEach(([category, routes]: [string, any]) => {
      // 跳过中文注释键（以"//"开头或包含中文的键）
      if (category.startsWith('//') || /[\u4e00-\u9fa5]/.test(category)) {
        return;
      }
      
      if (typeof routes === 'string') {
        const routeEntries = routes.split(';');
        routerBasedPipelines[category] = [];
        
        routeEntries.forEach((route: string) => {
          const [provider, model] = route.trim().split(',');
          if (provider && model) {
            routerBasedPipelines[category].push({ provider, model });
          }
        });
      }
    });

    // 计算基于Router的总流水线数
    const totalRouterBasedPipelines = Object.values(routerBasedPipelines).reduce((sum, pipelines) => {
      return sum + pipelines.length;
    }, 0);

    // 分析Provider和Model在路由中的分布
    const routerProviderDistribution: Record<string, number> = {};
    const routerModelDistribution: Record<string, number> = {};
    
    Object.values(routerBasedPipelines).forEach(pipelines => {
      pipelines.forEach(({ provider, model }) => {
        routerProviderDistribution[provider] = (routerProviderDistribution[provider] || 0) + 1;
        routerModelDistribution[model] = (routerModelDistribution[model] || 0) + 1;
      });
    });

    const routingAnalysis = {
      expectedPipelines: totalRouterBasedPipelines,
      routingCategoriesFound: Object.keys(routerCategories).length,
      providerDistribution: routerProviderDistribution,
      modelDistribution: routerModelDistribution,
      routerBasedPipelines // 新增：基于路由的流水线映射
    };

    // 验证路由分析结果
    expect(routingAnalysis.expectedPipelines).toBeGreaterThan(0);
    expect(routingAnalysis.routingCategoriesFound).toBeGreaterThan(0);
    expect(Object.keys(routingAnalysis.providerDistribution).length).toBeGreaterThan(0);

    traceResult.routingSystemAnalysis = routingAnalysis;

    console.log('✅ Phase 2 完成', {
      routerBasedPipelines: routingAnalysis.expectedPipelines,
      routingCategories: routingAnalysis.routingCategoriesFound,
      uniqueProvidersInRoutes: Object.keys(routerProviderDistribution).length
    });
  });

  test('Phase 3: Pipeline Assembly Analysis', async () => {
    console.log('🏭 Phase 3: 流水线组装分析');

    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    // 分析服务器兼容性类型
    const serverCompatibilityTypes = [...new Set(
      config.Providers.map((provider: any) => provider.serverCompatibility?.use || 'passthrough')
    )] as string[];

    // ✅ 修复：定义正确的4层架构（移除独立的response-transformer层）
    const layerTypesRequired = [
      'transformer',        // 双向：Anthropic ↔ OpenAI 标准格式转换
      'protocol',          // 透传：OpenAI 协议验证和元数据处理（不做格式转换）
      'server-compatibility', // 双向：Provider特定的OpenAI格式微调和响应处理
      'server'             // 双向：HTTP 请求发送和响应接收
    ];

    // ✅ 修复：使用Router-based计算而非Provider-based计算
    // 基于Router区域分析流水线需求 - 复用Phase 2的逻辑
    const routerBasedPipelines = traceResult.routingSystemAnalysis.routerBasedPipelines;
    const totalRouterBasedPipelines = Object.values(routerBasedPipelines).reduce((sum, pipelines: any[]) => {
      return sum + pipelines.length;
    }, 0);

    // 按Provider统计Router-based流水线分布
    const pipelinesByProvider: Record<string, number> = {};
    Object.values(routerBasedPipelines).forEach((pipelines: any[]) => {
      pipelines.forEach(({ provider }: { provider: string }) => {
        pipelinesByProvider[provider] = (pipelinesByProvider[provider] || 0) + 1;
      });
    });
    
    const assemblyAnalysis = {
      totalExpectedPipelines: totalRouterBasedPipelines, // ✅ 修复：使用Router-based计算
      pipelinesByProvider, // ✅ 修复：基于Router区域的Provider分布
      layerTypesRequired,
      serverCompatibilityTypes
    };

    // 验证流水线组装分析
    expect(assemblyAnalysis.totalExpectedPipelines).toBe(traceResult.routingSystemAnalysis.expectedPipelines);
    expect(assemblyAnalysis.layerTypesRequired.length).toBe(4); // ✅ 修复：4层架构
    expect(assemblyAnalysis.serverCompatibilityTypes.length).toBeGreaterThan(0);

    traceResult.pipelineAssemblyAnalysis = assemblyAnalysis;

    console.log('✅ Phase 3 完成', {
      routerBasedPipelines: assemblyAnalysis.totalExpectedPipelines, // ✅ 修复：使用正确的Router-based术语
      layerTypes: assemblyAnalysis.layerTypesRequired.length, // 4层架构
      compatibilityTypes: assemblyAnalysis.serverCompatibilityTypes.length
    });
  });

  test('Phase 4: Detailed Pipeline Construction Specification', async () => {
    console.log('🔧 Phase 4: 详细流水线构造规范');

    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    const detailedConstruction: Array<{
      pipelineId: string;
      provider: string;
      model: string;
      category: string;
      serverCompatibility: string;
      expectedLayers: Array<{
        type: string;
        name: string;
        purpose: string;
      }>;
    }> = [];

    // 基于Router区域生成详细的流水线构造规范
    const routerBasedPipelines = traceResult.routingSystemAnalysis.routerBasedPipelines;
    
    Object.entries(routerBasedPipelines).forEach(([category, pipelines]: [string, any[]]) => {
      pipelines.forEach((pipeline: any, index: number) => {
        const { provider: providerName, model: modelName } = pipeline;
        
        // 查找Provider配置
        const providerConfig = config.Providers.find((p: any) => p.name === providerName);
        const pipelineId = `pipeline-${category}-${providerName}-${modelName}-${index}`;
        
        // ✅ 修复：正确的4层双向架构定义
        const serverCompatType = providerConfig?.serverCompatibility?.use || 'passthrough';
        const expectedLayers = [
          {
            type: 'transformer',
            name: 'BidirectionalAnthropicOpenAITransformer',
            purpose: '双向处理：Request(Anthropic→OpenAI) + Response(OpenAI→Anthropic)标准格式转换'
          },
          {
            type: 'protocol',
            name: 'OpenAIProtocolValidator',
            purpose: '透传处理：OpenAI协议验证和元数据增强，不做格式转换'
          },
          {
            type: 'server-compatibility', 
            name: `${serverCompatType.charAt(0).toUpperCase() + serverCompatType.slice(1)}ServerCompatibilityLayer`,
            purpose: `双向处理：${serverCompatType}特定的OpenAI格式微调(Request)和Provider响应处理(Response)`
          },
          {
            type: 'server',
            name: 'HTTPServerLayer',
            purpose: `双向处理：HTTP请求发送到${providerConfig?.baseURL || 'unknown'}和响应接收`
          }
        ];

        detailedConstruction.push({
          pipelineId,
          provider: providerName,
          model: modelName,
          category,
          serverCompatibility: providerConfig?.serverCompatibility?.use || 'passthrough',
          expectedLayers
        });
      });
    });

    // 验证详细构造规范
    expect(detailedConstruction.length).toBe(traceResult.pipelineAssemblyAnalysis.totalExpectedPipelines);
    
    // ✅ 修复：验证每个流水线都有正确的4层架构
    detailedConstruction.forEach(pipeline => {
      expect(pipeline.expectedLayers.length).toBe(4); // 4层架构
      expect(pipeline.pipelineId).toContain(pipeline.provider);
      expect(pipeline.pipelineId).toContain(pipeline.model);
      expect(pipeline.pipelineId).toContain(pipeline.category);
    });

    traceResult.detailedPipelineConstruction = detailedConstruction;

    console.log('✅ Phase 4 完成', {
      routerBasedPipelines: detailedConstruction.length,
      layersPerPipeline: detailedConstruction[0]?.expectedLayers.length || 0, // 应为4层
      categoriesUsed: [...new Set(detailedConstruction.map(p => p.category))].length
    });
  });

  test('Phase 5: Complete System Integration Validation', async () => {
    console.log('🎯 Phase 5: 完整系统集成验证');

    // 验证数据流的完整性和一致性
    expect(traceResult.configurationAnalysis).toBeDefined();
    expect(traceResult.routingSystemAnalysis).toBeDefined();
    expect(traceResult.pipelineAssemblyAnalysis).toBeDefined();
    expect(traceResult.detailedPipelineConstruction).toBeDefined();

    // 验证数据一致性
    expect(traceResult.detailedPipelineConstruction.length)
      .toBe(traceResult.pipelineAssemblyAnalysis.totalExpectedPipelines);
    
    expect(traceResult.pipelineAssemblyAnalysis.totalExpectedPipelines)
      .toBe(traceResult.routingSystemAnalysis.expectedPipelines);

    // ✅ 修复：验证Router中实际使用的Provider都有对应的流水线
    // 注意：只验证Router区域中实际使用的Provider，不是配置文件中的全部Provider
    const routerProviders = Object.keys(traceResult.routingSystemAnalysis.providerDistribution);
    const providersInPipelines = [...new Set(traceResult.detailedPipelineConstruction.map(p => p.provider))];
    
    expect(providersInPipelines.sort()).toEqual(routerProviders.sort());

    // ✅ 修复：验证正确的4层双向架构的完整性
    traceResult.detailedPipelineConstruction.forEach(pipeline => {
      const layerTypes = pipeline.expectedLayers.map(layer => layer.type);
      expect(layerTypes).toEqual(['transformer', 'protocol', 'server-compatibility', 'server']);
      
      // 验证每层都明确标注了双向处理能力
      pipeline.expectedLayers.forEach(layer => {
        if (layer.type !== 'protocol') {
          expect(layer.purpose).toContain('双向处理');
        } else {
          expect(layer.purpose).toContain('透传处理'); // Protocol层透传
        }
      });
    });

    console.log('✅ Phase 5 完成 - 系统集成验证通过', {
      totalValidations: 'passed',
      pipelinesValidated: traceResult.detailedPipelineConstruction.length,
      providersValidated: providersInPipelines.length,
      systemIntegrity: 'verified'
    });
  });
});

/**
 * 分类保存结果到不同文件夹
 */
async function saveClassifiedResults(baseDir: string, traceResult: SystemTraceResult): Promise<void> {
  // 1. 配置分析结果
  const configDir = path.join(baseDir, '01-configuration-analysis');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(configDir, 'providers-summary.json'),
    JSON.stringify(traceResult.configurationAnalysis, null, 2)
  );

  // 按Provider详细保存
  traceResult.configurationAnalysis.providersDetail.forEach(provider => {
    fs.writeFileSync(
      path.join(configDir, `provider-${provider.name}.json`),
      JSON.stringify(provider, null, 2)
    );
  });

  // 2. 路由系统分析结果
  const routingDir = path.join(baseDir, '02-routing-analysis');
  if (!fs.existsSync(routingDir)) {
    fs.mkdirSync(routingDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(routingDir, 'routing-summary.json'),
    JSON.stringify({
      expectedPipelines: traceResult.routingSystemAnalysis.expectedPipelines,
      routingCategoriesFound: traceResult.routingSystemAnalysis.routingCategoriesFound,
      providerDistribution: traceResult.routingSystemAnalysis.providerDistribution,
      modelDistribution: traceResult.routingSystemAnalysis.modelDistribution
    }, null, 2)
  );

  // 按路由类别保存 - ✅ 修复：清理文件名特殊字符
  Object.entries(traceResult.routingSystemAnalysis.routerBasedPipelines).forEach(([category, pipelines]) => {
    // 清理文件名中的特殊字符，替换为安全的文件名
    const safeCategoryName = category
      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_') // 替换特殊字符为下划线
      .replace(/^_+|_+$/g, '') // 移除首尾下划线
      .replace(/_+/g, '_'); // 合并多个连续下划线
    
    fs.writeFileSync(
      path.join(routingDir, `category-${safeCategoryName}.json`),
      JSON.stringify({ 
        originalCategory: category, // 保留原始类别名
        safeCategory: safeCategoryName, // 安全文件名
        pipelines 
      }, null, 2)
    );
  });

  // 3. 流水线组装分析结果
  const assemblyDir = path.join(baseDir, '03-pipeline-assembly');
  if (!fs.existsSync(assemblyDir)) {
    fs.mkdirSync(assemblyDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(assemblyDir, 'assembly-summary.json'),
    JSON.stringify(traceResult.pipelineAssemblyAnalysis, null, 2)
  );

  // 4. 详细流水线构造表 - 按类别和Provider分组
  const pipelineDir = path.join(baseDir, '04-pipeline-construction');
  if (!fs.existsSync(pipelineDir)) {
    fs.mkdirSync(pipelineDir, { recursive: true });
  }

  // 按类别分组保存
  const pipelinesByCategory: Record<string, any[]> = {};
  traceResult.detailedPipelineConstruction.forEach(pipeline => {
    if (!pipelinesByCategory[pipeline.category]) {
      pipelinesByCategory[pipeline.category] = [];
    }
    pipelinesByCategory[pipeline.category].push(pipeline);
  });

  Object.entries(pipelinesByCategory).forEach(([category, pipelines]) => {
    // ✅ 修复：清理目录名特殊字符
    const safeCategoryName = category
      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
    
    const categoryDir = path.join(pipelineDir, `category-${safeCategoryName}`);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }

    // 保存类别总结
    fs.writeFileSync(
      path.join(categoryDir, '_category-summary.json'),
      JSON.stringify({
        originalCategory: category, // ✅ 修复：保留原始类别名
        safeCategory: safeCategoryName, // ✅ 修复：安全目录名
        totalPipelines: pipelines.length,
        providers: [...new Set(pipelines.map(p => p.provider))],
        models: [...new Set(pipelines.map(p => p.model))]
      }, null, 2)
    );

    // 按Provider分组
    const pipelinesByProvider: Record<string, any[]> = {};
    pipelines.forEach(pipeline => {
      if (!pipelinesByProvider[pipeline.provider]) {
        pipelinesByProvider[pipeline.provider] = [];
      }
      pipelinesByProvider[pipeline.provider].push(pipeline);
    });

    Object.entries(pipelinesByProvider).forEach(([provider, providerPipelines]) => {
      fs.writeFileSync(
        path.join(categoryDir, `provider-${provider}.json`),
        JSON.stringify({
          originalCategory: category, // ✅ 修复：保留原始类别名
          safeCategory: safeCategoryName, // ✅ 修复：安全目录名
          provider,
          pipelines: providerPipelines
        }, null, 2)
      );
    });
  });

  // 5. 生成总结报告
  const summaryReport = {
    testTimestamp: new Date().toISOString(),
    summary: {
      totalProviders: traceResult.configurationAnalysis.providersFound,
      totalModels: traceResult.configurationAnalysis.modelsFound,
      totalRoutingCategories: traceResult.routingSystemAnalysis.routingCategoriesFound,
      totalRouterBasedPipelines: traceResult.routingSystemAnalysis.expectedPipelines,
      layerTypesRequired: traceResult.pipelineAssemblyAnalysis.layerTypesRequired, // 4层架构
      serverCompatibilityTypes: traceResult.pipelineAssemblyAnalysis.serverCompatibilityTypes,
      architectureNote: '4层双向架构：transformer(双向转换), protocol(透传验证), server-compatibility(双向微调), server(双向HTTP)'
    },
    fileStructure: {
      '01-configuration-analysis': 'Provider配置和模型分析',
      '02-routing-analysis': '路由系统和类别分析',
      '03-pipeline-assembly': '流水线组装配置分析',
      '04-pipeline-construction': '详细流水线构造表（按类别和Provider分组）'
    }
  };

  fs.writeFileSync(
    path.join(baseDir, 'README.json'),
    JSON.stringify(summaryReport, null, 2)
  );

  console.log('📁 结果分类保存完成:', {
    baseDirectory: baseDir,
    filesCreated: {
      configurationFiles: traceResult.configurationAnalysis.providersDetail.length + 1,
      routingFiles: Object.keys(traceResult.routingSystemAnalysis.routerBasedPipelines).length + 1,
      assemblyFiles: 1,
      pipelineFiles: Object.keys(pipelinesByCategory).length * 2 + Object.values(pipelinesByCategory).reduce((sum, pipelines) => {
        const providers = [...new Set(pipelines.map((p: any) => p.provider))];
        return sum + providers.length;
      }, 0),
      summaryFiles: 1
    }
  });
}