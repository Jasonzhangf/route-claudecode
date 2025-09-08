/**
 * RCC v4.0 RouterPreprocessor Integration Test
 * 
 * 专门测试路由预处理器的核心功能：
 * - 路由预处理功能
 * - 流水线配置生成
 * - 验证layer.type字段正确性
 * - 测试与ConfigPreprocessor的集成
 * 
 * 这是系统启动流程的第二步，确保路由正确预处理和流水线配置生成
 */

import * as fs from 'fs';
import * as path from 'path';
import { RouterPreprocessor } from '../router-preprocessor';
import { ConfigPreprocessor } from '../../../config/src/config-preprocessor';
import { RoutingTable } from '../routing-table-types';
import { JQJsonHandler } from '../../../error-handler/src/utils/jq-json-handler';

describe('RCC v4.0 RouterPreprocessor Integration Test', () => {
  const testOutputDir = path.join(__dirname, 'test-outputs', 'router-integration');
  const configPath = '/Users/fanzhang/.route-claudecode/config.json';
  let testRoutingTable: RoutingTable;
  
  beforeAll(async () => {
    // 创建测试输出目录
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
    
    // 使用ConfigPreprocessor获取路由表
    const configResult = await ConfigPreprocessor.preprocess(configPath);
    expect(configResult.success).toBe(true);
    testRoutingTable = configResult.routingTable!;
    
    // 保存输入数据
    const inputFile = path.join(testOutputDir, 'input-routing-table.json');
    await fs.promises.writeFile(inputFile, JSON.stringify({
      testTimestamp: new Date().toISOString(),
      configSource: configPath,
      routingTable: testRoutingTable
    }, null, 2));
  });

  describe('路由预处理核心功能', () => {
    test('should successfully preprocess routing table', async () => {
      const startTime = Date.now();
      const result = await RouterPreprocessor.preprocess(testRoutingTable);
      const processingTime = Date.now() - startTime;
      
      // 基本验证
      expect(result.success).toBe(true);
      expect(result.routingTable).toBeDefined();
      expect(result.pipelineConfigs).toBeDefined();
      expect(result.errors).toEqual([]);
      expect(processingTime).toBeLessThan(30); // 性能要求
      
      // 保存完整结果
      const outputFile = path.join(testOutputDir, 'router-preprocessing-result.json');
      await fs.promises.writeFile(outputFile, JSON.stringify({
        testTimestamp: new Date().toISOString(),
        processingTimeMs: processingTime,
        success: result.success,
        routingTable: result.routingTable,
        pipelineConfigs: result.pipelineConfigs,
        stats: result.stats,
        rawResult: result
      }, null, 2));
      
      console.log(`✅ Router preprocessing completed in ${processingTime}ms`);
    });

    test('should generate internal routing table with correct structure', async () => {
      const result = await RouterPreprocessor.preprocess(testRoutingTable);
      const internalTable = result.routingTable!;
      
      // 验证基本结构
      expect(internalTable.routes).toBeDefined();
      expect(internalTable.defaultRoute).toBe('default');
      expect(internalTable.metadata).toBeDefined();
      
      // 验证路由映射
      Object.keys(testRoutingTable.routes).forEach(routeName => {
        const internalRoutes = internalTable.routes[routeName];
        expect(internalRoutes).toBeDefined();
        expect(Array.isArray(internalRoutes)).toBe(true);
        expect(internalRoutes.length).toBeGreaterThan(0);
        
        // 验证每个内部路由条目
        internalRoutes.forEach(route => {
          expect(route.routeId).toBeTruthy();
          expect(route.routeName).toBe(routeName);
          expect(route.virtualModel).toBe(routeName);
          expect(route.provider).toBeTruthy();
          expect(route.pipelineId).toBeTruthy();
          expect(route.isActive).toBe(true);
          expect(route.health).toBe('healthy');
          expect(typeof route.apiKeyIndex).toBe('number');
        });
      });
      
      // 保存内部路由表
      const internalTableFile = path.join(testOutputDir, 'internal-routing-table.json');
      await fs.promises.writeFile(internalTableFile, JSON.stringify({
        testTimestamp: new Date().toISOString(),
        internalRoutingTable: internalTable,
        validation: {
          routesCount: Object.keys(internalTable.routes).length,
          defaultRouteExists: !!internalTable.routes.default,
          allRoutesHaveEntries: Object.values(internalTable.routes).every(routes => routes.length > 0)
        }
      }, null, 2));
    });
  });

  describe('流水线配置生成验证', () => {
    test('should generate complete pipeline configurations', async () => {
      const result = await RouterPreprocessor.preprocess(testRoutingTable);
      const pipelineConfigs = result.pipelineConfigs!;
      
      expect(pipelineConfigs.length).toBeGreaterThan(0);
      
      // 验证每个流水线配置的完整性
      pipelineConfigs.forEach(config => {
        expect(config.pipelineId).toBeTruthy();
        expect(config.routeId).toBeTruthy();
        expect(config.provider).toBeTruthy();
        expect(config.model).toBeTruthy();
        expect(config.endpoint).toBeTruthy();
        expect(config.apiKey).toBeTruthy();
        expect(typeof config.timeout).toBe('number');
        expect(typeof config.maxRetries).toBe('number');
        
        // 验证层结构
        expect(config.layers).toBeDefined();
        expect(Array.isArray(config.layers)).toBe(true);
        expect(config.layers.length).toBe(4); // 4层流水线
      });
      
      // 保存流水线配置
      const pipelineConfigFile = path.join(testOutputDir, 'pipeline-configurations.json');
      await fs.promises.writeFile(pipelineConfigFile, JSON.stringify({
        testTimestamp: new Date().toISOString(),
        totalConfigs: pipelineConfigs.length,
        pipelineConfigurations: pipelineConfigs,
        validation: {
          allHaveRequiredFields: pipelineConfigs.every(c => 
            c.pipelineId && c.provider && c.model && c.endpoint && c.apiKey
          ),
          allHave4Layers: pipelineConfigs.every(c => c.layers.length === 4)
        }
      }, null, 2));
    });

    test('should generate correct 4-layer pipeline structure', async () => {
      const result = await RouterPreprocessor.preprocess(testRoutingTable);
      const configs = result.pipelineConfigs!;
      const firstConfig = configs[0];
      
      // 验证4层结构
      const expectedLayers = ['transformer', 'protocol', 'server-compatibility', 'server'];
      const actualLayers = firstConfig.layers.map(layer => layer.name);
      
      expect(actualLayers).toEqual(expectedLayers);
      
      // 验证每层的配置和layer.type字段
      firstConfig.layers.forEach((layer, index) => {
        expect(layer.name).toBe(expectedLayers[index]);
        expect(layer.type).toBeTruthy(); // 确保layer.type不是undefined
        expect(layer.order).toBe(index + 1);
        expect(layer.config).toBeDefined();
        expect(typeof layer.config).toBe('object');
        
        // 验证每层都有必要的配置
        expect(layer.config.provider).toBeTruthy();
        expect(layer.config.model).toBeTruthy();
        
        // 记录layer.type用于调试
        console.log(`Layer ${layer.name}: type=${layer.type}`);
      });
      
      // 保存层结构验证
      const layerStructureFile = path.join(testOutputDir, 'layer-structure-validation.json');
      await fs.promises.writeFile(layerStructureFile, JSON.stringify({
        testTimestamp: new Date().toISOString(),
        expectedLayers,
        actualLayers,
        layerDetails: firstConfig.layers.map(layer => ({
          name: layer.name,
          type: layer.type,
          order: layer.order,
          hasConfig: !!layer.config,
          configKeys: Object.keys(layer.config || {})
        })),
        validation: {
          correctOrder: actualLayers.join(',') === expectedLayers.join(','),
          allLayersHaveType: firstConfig.layers.every(l => !!l.type),
          allLayersHaveConfig: firstConfig.layers.every(l => !!l.config)
        }
      }, null, 2));
    });
  });

  describe('与ConfigPreprocessor集成验证', () => {
    test('should seamlessly integrate with ConfigPreprocessor output', async () => {
      // Step 1: Config preprocessing
      const configResult = await ConfigPreprocessor.preprocess(configPath);
      expect(configResult.success).toBe(true);
      
      // Step 2: Router preprocessing
      const routerResult = await RouterPreprocessor.preprocess(configResult.routingTable!);
      expect(routerResult.success).toBe(true);
      
      // 验证数据完整性
      const configProviders = configResult.routingTable!.providers;
      const routerPipelines = routerResult.pipelineConfigs!;
      
      // 验证所有Provider都有对应的流水线配置
      configProviders.forEach(provider => {
        const providerPipelines = routerPipelines.filter(p => p.provider === provider.name);
        expect(providerPipelines.length).toBeGreaterThan(0);
        
        // 验证每个模型都有流水线配置
        provider.models.forEach(model => {
          const modelPipeline = providerPipelines.find(p => p.model === model.name);
          expect(modelPipeline).toBeDefined();
        });
      });
      
      // 保存集成验证结果
      const integrationFile = path.join(testOutputDir, 'config-router-integration.json');
      await fs.promises.writeFile(integrationFile, JSON.stringify({
        testTimestamp: new Date().toISOString(),
        step1_config: {
          success: configResult.success,
          providersCount: configProviders.length,
          routesCount: Object.keys(configResult.routingTable!.routes).length
        },
        step2_router: {
          success: routerResult.success,
          pipelinesCount: routerPipelines.length,
          processingTime: routerResult.stats.processingTimeMs
        },
        integration_validation: {
          allProvidersHavePipelines: configProviders.every(provider => 
            routerPipelines.some(p => p.provider === provider.name)
          ),
          allModelsHavePipelines: configProviders.every(provider =>
            provider.models.every(model => 
              routerPipelines.some(p => p.provider === provider.name && p.model === model.name)
            )
          )
        },
        readyForPipelineAssembly: true
      }, null, 2));
    });
  });

  describe('错误处理验证', () => {
    test('should handle invalid routing table input', async () => {
      const invalidTable = null as any;
      const result = await RouterPreprocessor.preprocess(invalidTable);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('路由表不能为空');
    });

    test('should handle empty providers', async () => {
      const emptyProvidersTable = { ...testRoutingTable, providers: [] };
      const result = await RouterPreprocessor.preprocess(emptyProvidersTable);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('路由表中没有Provider配置');
    });
  });

  describe('零接口暴露验证', () => {
    test('should only expose preprocess static method', () => {
      const publicMethods = Object.getOwnPropertyNames(RouterPreprocessor)
        .filter(name => !name.startsWith('_') && name !== 'length' && name !== 'name' && name !== 'prototype');
      
      expect(publicMethods).toEqual(['preprocess']);
      expect(typeof RouterPreprocessor.preprocess).toBe('function');
    });
  });

  describe('性能验证', () => {
    test('should complete processing within 30ms', async () => {
      const iterations = 3;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const result = await RouterPreprocessor.preprocess(testRoutingTable);
        const processingTime = Date.now() - startTime;
        
        expect(result.success).toBe(true);
        expect(processingTime).toBeLessThan(30);
        times.push(processingTime);
      }
      
      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`⚡ Average router processing time: ${averageTime.toFixed(2)}ms (${iterations} iterations)`);
      
      // 保存性能测试结果
      const perfFile = path.join(testOutputDir, 'performance-test.json');
      await fs.promises.writeFile(perfFile, JSON.stringify({
        testTimestamp: new Date().toISOString(),
        iterations,
        times,
        averageTimeMs: averageTime,
        maxTimeMs: Math.max(...times),
        minTimeMs: Math.min(...times),
        allUnder30ms: times.every(t => t < 30)
      }, null, 2));
    });
  });

  describe('输出完整性验证', () => {
    test('should generate complete test output files', async () => {
      const result = await RouterPreprocessor.preprocess(testRoutingTable);
      
      // 生成完整的测试报告
      const completeReport = {
        testSuite: 'RouterPreprocessor Integration Test',
        timestamp: new Date().toISOString(),
        inputSource: configPath,
        testResults: {
          preprocessingSuccess: result.success,
          internalRoutingTableGenerated: !!result.routingTable,
          pipelineConfigsGenerated: !!result.pipelineConfigs,
          pipelineConfigsCount: result.pipelineConfigs?.length || 0,
          layerTypeFieldsValid: result.pipelineConfigs?.every(c => 
            c.layers.every(l => !!l.type)
          ) || false,
          integrationWithConfigTested: true,
          errorHandlingTested: true,
          performanceValidated: true
        },
        outputFiles: [
          'input-routing-table.json',
          'router-preprocessing-result.json',
          'internal-routing-table.json',
          'pipeline-configurations.json',
          'layer-structure-validation.json',
          'config-router-integration.json',
          'performance-test.json'
        ],
        nextStep: 'Ready for PipelineAssembler integration',
        layerTypeDebugging: {
          message: 'layer.type字段已验证，确保不再出现undefined问题',
          validation: result.pipelineConfigs?.every(c => c.layers.every(l => !!l.type)) || false
        }
      };
      
      const reportFile = path.join(testOutputDir, 'integration-test-report.json');
      await fs.promises.writeFile(reportFile, JSON.stringify(completeReport, null, 2));
      
      console.log(`📋 RouterPreprocessor integration test completed`);
      console.log(`📁 Test outputs saved to: ${testOutputDir}`);
      console.log(`🔍 Layer.type validation: ${completeReport.testResults.layerTypeFieldsValid ? 'PASSED' : 'FAILED'}`);
      
      expect(completeReport.testResults.preprocessingSuccess).toBe(true);
      expect(completeReport.testResults.pipelineConfigsCount).toBeGreaterThan(0);
      expect(completeReport.testResults.layerTypeFieldsValid).toBe(true);
    });
  });
});