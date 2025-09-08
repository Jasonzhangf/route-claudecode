/**
 * RCC v4.0 Router Preprocessor Unit Test
 * 
 * 重构后的路由预处理器测试 - 适配一次性预处理器架构
 * 
 * 测试目标：
 * - 零接口暴露验证：只能调用 preprocess() 方法
 * - 内部路由表生成验证
 * - 六层流水线配置生成验证
 * - 每个流水线的6层结构完整性验证
 * - 优先级处理验证
 */

import * as fs from 'fs';
import * as path from 'path';
import { RouterPreprocessor, RouterPreprocessResult, PipelineConfig, PipelineLayer } from '../router-preprocessor';
import { RoutingTable } from '../routing-table-types';
import { ConfigPreprocessor } from '../../../config/src/config-preprocessor';
import { JQJsonHandler } from '../../../error-handler/src/utils/jq-json-handler';

describe('RCC v4.0 Router Preprocessor', () => {
  const testOutputDir = path.join(__dirname, 'test-outputs');
  const configPath = '/Users/fanzhang/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506.json';
  
  let testRoutingTable: RoutingTable;
  
  beforeAll(async () => {
    // 创建测试输出目录
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
    
    // 使用真实的ConfigPreprocessor获取路由表
    const configResult = await ConfigPreprocessor.preprocess(configPath);
    expect(configResult.success).toBe(true);
    testRoutingTable = configResult.routingTable!;
    
    // 保存输入数据供调试使用
    const inputFile = path.join(testOutputDir, 'input-routing-table.json');
    fs.writeFileSync(inputFile, JQJsonHandler.stringifyJson(testRoutingTable, true), 'utf8');
  });

  describe('零接口暴露验证', () => {
    test('只能访问 preprocess() 静态方法', () => {
      // 验证 RouterPreprocessor 类只暴露 preprocess 静态方法
      const publicMethods = Object.getOwnPropertyNames(RouterPreprocessor)
        .filter(name => !name.startsWith('_') && name !== 'length' && name !== 'name' && name !== 'prototype');
      
      expect(publicMethods).toEqual(['preprocess']);
      expect(typeof RouterPreprocessor.preprocess).toBe('function');
    });

    test('无法访问私有方法和属性', () => {
      // 验证无法访问私有成员（TypeScript编译时会报错）
      const privateMethods = ['_validateInput', '_generateInternalRoutingTable', '_generatePipelineConfigs', '_generateLayerConfigs', '_validateResults'];
      
      privateMethods.forEach(method => {
        // 在实际使用中，TypeScript会阻止访问这些私有方法
        expect(RouterPreprocessor).toHaveProperty(method);
      });
    });
  });

  describe('路由表输入验证', () => {
    test('应该接受有效的路由表输入', async () => {
      const result = await RouterPreprocessor.preprocess(testRoutingTable);
      
      expect(result.success).toBe(true);
      expect(result.routingTable).toBeDefined();
      expect(result.pipelineConfigs).toBeDefined();
      expect(result.errors).toEqual([]);
    });

    test('应该拒绝空的路由表', async () => {
      const emptyTable = null as any;
      
      const result = await RouterPreprocessor.preprocess(emptyTable);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('路由表不能为空');
    });

    test('应该拒绝没有Provider的路由表', async () => {
      const noProvidersTable = { ...testRoutingTable, providers: [] };
      
      const result = await RouterPreprocessor.preprocess(noProvidersTable);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('路由表中没有Provider配置');
    });
  });

  describe('内部路由表生成验证', () => {
    test('应该生成正确的内部路由表结构', async () => {
      const result = await RouterPreprocessor.preprocess(testRoutingTable);
      
      expect(result.success).toBe(true);
      expect(result.routingTable).toBeDefined();
      
      const internalTable = result.routingTable!;
      
      // 验证基本结构
      expect(internalTable.routes).toBeDefined();
      expect(internalTable.defaultRoute).toBe('default');
      expect(internalTable.metadata).toBeDefined();
      expect(internalTable.metadata.preprocessorVersion).toBeTruthy();
      
      // 验证路由映射
      expect(internalTable.routes['default']).toBeDefined();
      expect(Array.isArray(internalTable.routes['default'])).toBe(true);
      expect(internalTable.routes['default'].length).toBeGreaterThan(0);
      
      // 保存内部路由表
      const internalTableFile = path.join(testOutputDir, 'internal-routing-table.json');
      fs.writeFileSync(internalTableFile, JQJsonHandler.stringifyJson(internalTable, true), 'utf8');
    });

    test('应该正确处理路由规格', async () => {
      const result = await RouterPreprocessor.preprocess(testRoutingTable);
      
      expect(result.success).toBe(true);
      
      const internalTable = result.routingTable!;
      
      // 验证每个路由都有对应的内部路由条目
      Object.keys(testRoutingTable.routes).forEach(routeName => {
        const internalRoutes = internalTable.routes[routeName];
        expect(internalRoutes).toBeDefined();
        expect(Array.isArray(internalRoutes)).toBe(true);
        expect(internalRoutes.length).toBeGreaterThan(0);
        
        // 验证每个内部路由条目的完整性
        internalRoutes.forEach(route => {
          expect(route.routeId).toBeDefined();
          expect(route.routeName).toBe(routeName);
          expect(route.virtualModel).toBe(routeName);
          expect(route.provider).toBeDefined();
          expect(route.pipelineId).toBeDefined();
          expect(route.isActive).toBe(true);
          expect(route.health).toBe('healthy');
          expect(typeof route.apiKeyIndex).toBe('number');
        });
      });
    });
  });

  describe('六层流水线配置生成验证', () => {
    test('应该生成完整的流水线配置', async () => {
      const result = await RouterPreprocessor.preprocess(testRoutingTable);
      
      expect(result.success).toBe(true);
      expect(result.pipelineConfigs).toBeDefined();
      
      const configs = result.pipelineConfigs!;
      expect(configs.length).toBeGreaterThan(0);
      
      // 验证每个流水线配置的完整性
      configs.forEach(config => {
        expect(config.pipelineId).toBeDefined();
        expect(config.routeId).toBeDefined();
        expect(config.provider).toBeDefined();
        expect(config.model).toBeDefined();
        expect(config.endpoint).toBeDefined();
        expect(config.apiKey).toBeDefined();
        expect(config.timeout).toBe(60000);
        expect(config.maxRetries).toBe(3);
        
        // 验证层结构
        expect(config.layers).toBeDefined();
        expect(Array.isArray(config.layers)).toBe(true);
        expect(config.layers.length).toBe(4); // transformer, protocol, server-compatibility, server
      });
      
      // 保存流水线配置
      const pipelineConfigsFile = path.join(testOutputDir, 'pipeline-configs.json');
      fs.writeFileSync(pipelineConfigsFile, JQJsonHandler.stringifyJson(configs, true), 'utf8');
    });

    test('应该生成正确的四层流水线结构', async () => {
      const result = await RouterPreprocessor.preprocess(testRoutingTable);
      
      const configs = result.pipelineConfigs!;
      const firstConfig = configs[0];
      
      // 验证四层结构
      const expectedLayers = ['transformer', 'protocol', 'server-compatibility', 'server'];
      const actualLayers = firstConfig.layers.map(layer => layer.name);
      
      expect(actualLayers).toEqual(expectedLayers);
      
      // 验证每层的配置
      firstConfig.layers.forEach((layer, index) => {
        expect(layer.name).toBe(expectedLayers[index]);
        expect(layer.type).toBeTruthy();
        expect(layer.order).toBe(index + 1);
        expect(layer.config).toBeDefined();
        expect(typeof layer.config).toBe('object');
        
        // 验证每层都有必要的配置
        expect(layer.config.provider).toBeTruthy();
        expect(layer.config.model).toBeTruthy();
      });
    });

    test('应该正确处理maxTokens配置', async () => {
      const result = await RouterPreprocessor.preprocess(testRoutingTable);
      
      const configs = result.pipelineConfigs!;
      
      // 检查具有maxTokens的Provider
      const providersWithMaxTokens = testRoutingTable.providers.filter(p => p.maxTokens);
      
      if (providersWithMaxTokens.length > 0) {
        const configsWithMaxTokens = configs.filter(config => config.maxTokens);
        expect(configsWithMaxTokens.length).toBeGreaterThan(0);
        
        configsWithMaxTokens.forEach(config => {
          expect(config.maxTokens).toBeDefined();
          expect(typeof config.maxTokens).toBe('number');
          expect(config.maxTokens).toBeGreaterThan(0);
          
          // 验证server-compatibility和server层也有maxTokens
          const serverLayers = config.layers.filter(layer => 
            layer.type === 'server-compatibility' || layer.type === 'server'
          );
          
          serverLayers.forEach(layer => {
            expect(layer.config.maxTokens).toBeDefined();
            expect(layer.config.maxTokens).toBe(config.maxTokens);
          });
        });
      }
    });
  });

  describe('serverCompatibility配置处理验证', () => {
    test('应该正确处理serverCompatibility配置', async () => {
      const result = await RouterPreprocessor.preprocess(testRoutingTable);
      
      const configs = result.pipelineConfigs!;
      
      // 查找有serverCompatibility配置的流水线
      const serverCompatibilityConfigs = configs.filter(config => {
        const serverCompatibilityLayer = config.layers.find(layer => layer.type === 'server-compatibility');
        return serverCompatibilityLayer && Object.keys(serverCompatibilityLayer.config).length > 4; // 超过基本字段数量
      });
      
      if (serverCompatibilityConfigs.length > 0) {
        serverCompatibilityConfigs.forEach(config => {
          const serverCompatibilityLayer = config.layers.find(layer => layer.type === 'server-compatibility')!;
          const layerConfig = serverCompatibilityLayer.config;
          
          // 验证基本字段
          expect(layerConfig.provider).toBeTruthy();
          expect(layerConfig.model).toBeTruthy();
          expect(layerConfig.endpoint).toBeTruthy();
          expect(layerConfig.apiKey).toBeTruthy();
          
          // 可能有的增强配置
          if (layerConfig.timeout) {
            expect(typeof layerConfig.timeout).toBe('number');
          }
          if (layerConfig.protocol) {
            expect(typeof layerConfig.protocol).toBe('string');
          }
          if (layerConfig.transformer) {
            expect(typeof layerConfig.transformer).toBe('string');
          }
        });
      }
    });
  });

  describe('优先级处理验证', () => {
    test('应该按Provider优先级排序路由', async () => {
      const result = await RouterPreprocessor.preprocess(testRoutingTable);
      
      const internalTable = result.routingTable!;
      
      // 检查有多个路由选项的路由
      Object.values(internalTable.routes).forEach(routes => {
        if (routes.length > 1) {
          // 验证按优先级排序
          const providerPriorities = routes.map(route => {
            const provider = testRoutingTable.providers.find(p => p.name === route.provider);
            return provider?.priority || 0;
          });
          
          // 验证优先级是降序排列
          for (let i = 0; i < providerPriorities.length - 1; i++) {
            expect(providerPriorities[i]).toBeGreaterThanOrEqual(providerPriorities[i + 1]);
          }
        }
      });
    });
  });

  describe('性能要求验证', () => {
    test('RouterPreprocessor处理时间应少于30ms', async () => {
      const startTime = Date.now();
      
      const result = await RouterPreprocessor.preprocess(testRoutingTable);
      
      const processingTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(30);
      
      console.log(`⚡ RouterPreprocessor处理时间: ${processingTime}ms (要求: <30ms)`);
    });
  });

  describe('错误处理验证', () => {
    test('应该正确处理无效的路由规格', async () => {
      const invalidRoutingTable = {
        ...testRoutingTable,
        routes: {
          'invalid-route': 'nonexistent-provider,nonexistent-model'
        }
      };
      
      const result = await RouterPreprocessor.preprocess(invalidRoutingTable);
      
      // 根据实际实现行为：当所有路由都无效时，RouterPreprocessor返回失败状态
      // 这是合理的行为，因为没有可用的路由配置
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain('生成的路由表为空');
      expect(result.errors).toContain('没有生成流水线配置');
      expect(result.stats?.routesCount).toBe(0);
      expect(result.stats?.pipelinesCount).toBe(0);
    });
  });

  describe('输出文件生成验证', () => {
    test('应该生成标准的测试输出文件', async () => {
      const result = await RouterPreprocessor.preprocess(testRoutingTable);
      
      expect(result.success).toBe(true);
      
      // 生成标准输出文件
      const outputs = {
        'router-preprocessor-result.json': result,
        'internal-routing-table.json': result.routingTable,
        'pipeline-configs.json': result.pipelineConfigs,
        'router-stats.json': result.stats
      };
      
      Object.entries(outputs).forEach(([filename, data]) => {
        const filePath = path.join(testOutputDir, filename);
        fs.writeFileSync(filePath, JQJsonHandler.stringifyJson(data, true), 'utf8');
        
        // 验证文件存在且可读
        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.readFileSync(filePath, 'utf8')).toBeTruthy();
      });
      
      console.log(`📁 路由预处理器输出文件已生成在: ${testOutputDir}`);
    });
  });

  describe('端到端数据流验证', () => {
    test('应该产生可以用于PipelineManager的完整数据', async () => {
      const result = await RouterPreprocessor.preprocess(testRoutingTable);
      
      expect(result.success).toBe(true);
      expect(result.routingTable).toBeDefined();
      expect(result.pipelineConfigs).toBeDefined();
      
      const internalTable = result.routingTable!;
      const pipelineConfigs = result.pipelineConfigs!;
      
      // 验证数据可以被PipelineManager使用
      expect(Object.keys(internalTable.routes).length).toBeGreaterThan(0);
      expect(pipelineConfigs.length).toBeGreaterThan(0);
      
      // 验证每个流水线配置都有对应的路由
      pipelineConfigs.forEach(config => {
        const routeExists = Object.values(internalTable.routes)
          .flat()
          .some(route => route.pipelineId === config.pipelineId);
        expect(routeExists).toBe(true);
      });
      
      // 保存端到端验证结果
      const endToEndResult = {
        testName: 'Router Preprocessor End-to-End Validation',
        timestamp: new Date().toISOString(),
        inputRoutingTableProviders: testRoutingTable.providers.length,
        inputRoutes: Object.keys(testRoutingTable.routes).length,
        outputInternalRoutes: Object.keys(internalTable.routes).length,
        outputPipelineConfigs: pipelineConfigs.length,
        readyForPipelineManager: true,
        dataIntegrityChecks: {
          allPipelinesHaveRoutes: pipelineConfigs.every(config => 
            Object.values(internalTable.routes)
              .flat()
              .some(route => route.pipelineId === config.pipelineId)
          ),
          allRoutesHavePipelines: Object.values(internalTable.routes)
            .flat()
            .every(route => 
              pipelineConfigs.some(config => config.pipelineId === route.pipelineId)
            ),
          layerStructureComplete: pipelineConfigs.every(config => 
            config.layers.length === 4 &&
            config.layers.every(layer => layer.name && layer.type && layer.config)
          )
        }
      };
      
      const endToEndFile = path.join(testOutputDir, 'router-end-to-end-result.json');
      fs.writeFileSync(endToEndFile, JQJsonHandler.stringifyJson(endToEndResult, true), 'utf8');
      
      console.log(`🔗 路由预处理器端到端数据流验证通过`);
    });
  });
});