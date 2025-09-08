/**
 * RCC v4.0 ConfigPreprocessor Integration Test
 * 
 * 专门测试配置预处理器的核心功能：
 * - 配置文件解析功能
 * - 路由表生成
 * - 错误处理
 * - 使用真实配置文件进行测试
 * 
 * 这是系统启动流程的第一步，确保配置正确解析和转换
 */

import * as fs from 'fs';
import * as path from 'path';
import { ConfigPreprocessor } from '../config-preprocessor';
import { RoutingTable } from '../routing-table-types';
import { JQJsonHandler } from '../../../error-handler/src/utils/jq-json-handler';

describe('RCC v4.0 ConfigPreprocessor Integration Test', () => {
  const testOutputDir = path.join(__dirname, 'test-outputs', 'config-integration');
  const configPath = '/Users/fanzhang/.route-claudecode/config.json';
  
  beforeAll(() => {
    // 创建测试输出目录
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  describe('配置文件解析功能', () => {
    test('should successfully parse real config file', async () => {
      // 验证配置文件存在
      expect(fs.existsSync(configPath)).toBe(true);
      
      const startTime = Date.now();
      const result = await ConfigPreprocessor.preprocess(configPath);
      const processingTime = Date.now() - startTime;
      
      // 基本验证
      expect(result.success).toBe(true);
      expect(result.routingTable).toBeDefined();
      expect(result.errors).toEqual([]);
      expect(processingTime).toBeLessThan(50); // 性能要求
      
      // 保存完整结果
      const outputFile = path.join(testOutputDir, 'config-parsing-result.json');
      await fs.promises.writeFile(outputFile, JSON.stringify({
        testTimestamp: new Date().toISOString(),
        configPath,
        processingTimeMs: processingTime,
        success: result.success,
        routingTable: result.routingTable,
        metadata: result.metadata,
        rawResult: result
      }, null, 2));
      
      console.log(`✅ Config parsing completed in ${processingTime}ms`);
    });

    test('should generate correct routing table structure', async () => {
      const result = await ConfigPreprocessor.preprocess(configPath);
      const routingTable = result.routingTable!;
      
      // 验证基本结构
      expect(routingTable.providers).toBeDefined();
      expect(Array.isArray(routingTable.providers)).toBe(true);
      expect(routingTable.providers.length).toBeGreaterThan(0);
      expect(routingTable.routes).toBeDefined();
      expect(typeof routingTable.routes).toBe('object');
      
      // 验证Provider结构
      routingTable.providers.forEach(provider => {
        expect(provider.name).toBeTruthy();
        expect(provider.api_base_url).toBeTruthy();
        expect(provider.api_key).toBeDefined();
        expect(Array.isArray(provider.models)).toBe(true);
        expect(provider.models.length).toBeGreaterThan(0);
      });
      
      // 验证路由结构
      expect(routingTable.routes.default).toBeDefined();
      Object.values(routingTable.routes).forEach(route => {
        expect(typeof route).toBe('string');
        expect(route).toMatch(/^[^,]+,[^,]+$/); // provider,model格式
      });
      
      // 保存路由表
      const routingTableFile = path.join(testOutputDir, 'routing-table-structure.json');
      await fs.promises.writeFile(routingTableFile, JSON.stringify({
        testTimestamp: new Date().toISOString(),
        structure: {
          providersCount: routingTable.providers.length,
          routesCount: Object.keys(routingTable.routes).length,
          providers: routingTable.providers.map(p => ({
            name: p.name,
            modelsCount: p.models.length,
            hasApiKey: !!p.api_key,
            hasMaxTokens: !!p.maxTokens
          })),
          routes: Object.keys(routingTable.routes)
        },
        fullRoutingTable: routingTable
      }, null, 2));
    });
  });

  describe('错误处理测试', () => {
    test('should handle non-existent config file', async () => {
      const nonExistentPath = '/path/to/nonexistent/config.json';
      const result = await ConfigPreprocessor.preprocess(nonExistentPath);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('配置文件不存在');
    });

    test('should handle invalid JSON file', async () => {
      // 创建临时的无效JSON文件
      const invalidJsonPath = path.join(testOutputDir, 'invalid-config.json');
      await fs.promises.writeFile(invalidJsonPath, '{ invalid json }');
      
      const result = await ConfigPreprocessor.preprocess(invalidJsonPath);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // 清理
      fs.unlinkSync(invalidJsonPath);
    });
  });

  describe('Provider信息转换验证', () => {
    test('should correctly transform provider configurations', async () => {
      const result = await ConfigPreprocessor.preprocess(configPath);
      const routingTable = result.routingTable!;
      
      routingTable.providers.forEach(provider => {
        // 验证基本字段转换
        expect(provider.name).toBeTruthy();
        expect(provider.api_base_url).toBeTruthy();
        expect(provider.protocol).toBeTruthy();
        
        // 验证API Key处理 (支持字符串或数组)
        if (Array.isArray(provider.api_key)) {
          expect(provider.api_key.length).toBeGreaterThan(0);
          provider.api_key.forEach(key => expect(key).toBeTruthy());
        } else {
          expect(provider.api_key).toBeTruthy();
        }
        
        // 验证模型信息转换
        provider.models.forEach(model => {
          expect(model.name).toBeTruthy();
          if (model.maxTokens) {
            expect(typeof model.maxTokens).toBe('number');
            expect(model.maxTokens).toBeGreaterThan(0);
          }
        });
        
        // 验证serverCompatibility转换
        if (provider.serverCompatibility) {
          expect(provider.serverCompatibility.use).toBeTruthy();
          expect(typeof provider.serverCompatibility.options).toBe('object');
        }
      });
    });
  });

  describe('服务器配置映射验证', () => {
    test('should correctly map server configurations', async () => {
      const result = await ConfigPreprocessor.preprocess(configPath);
      const routingTable = result.routingTable!;
      
      // 验证服务器配置存在
      expect(routingTable.server).toBeDefined();
      expect(typeof routingTable.server.port).toBe('number');
      expect(routingTable.server.host).toBeTruthy();
      
      // 验证API Key配置
      expect(routingTable.apiKey).toBeTruthy();
      
      // 保存服务器配置验证结果
      const serverConfigFile = path.join(testOutputDir, 'server-config-validation.json');
      await fs.promises.writeFile(serverConfigFile, JSON.stringify({
        testTimestamp: new Date().toISOString(),
        serverConfig: routingTable.server,
        apiKey: routingTable.apiKey,
        validation: {
          portIsNumber: typeof routingTable.server.port === 'number',
          hostExists: !!routingTable.server.host,
          apiKeyExists: !!routingTable.apiKey
        }
      }, null, 2));
    });
  });

  describe('路由映射生成验证', () => {
    test('should generate all explicit and automatic routes', async () => {
      const result = await ConfigPreprocessor.preprocess(configPath);
      const routingTable = result.routingTable!;
      
      // 验证显式路由
      const explicitRoutes = Object.keys(routingTable.routes);
      expect(explicitRoutes).toContain('default');
      expect(explicitRoutes.length).toBeGreaterThan(1);
      
      // 验证每个路由的格式
      explicitRoutes.forEach(routeName => {
        const route = routingTable.routes[routeName];
        expect(route).toMatch(/^[^,]+,[^,]+$/); // provider,model格式
        
        const [providerName, modelName] = route.split(',');
        
        // 验证Provider存在
        const provider = routingTable.providers.find(p => p.name === providerName);
        expect(provider).toBeDefined();
        
        // 验证模型存在
        const model = provider!.models.find(m => m.name === modelName);
        expect(model).toBeDefined();
      });
      
      // 保存路由验证结果
      const routeValidationFile = path.join(testOutputDir, 'route-validation.json');
      await fs.promises.writeFile(routeValidationFile, JSON.stringify({
        testTimestamp: new Date().toISOString(),
        totalRoutes: explicitRoutes.length,
        routes: explicitRoutes.map(routeName => {
          const route = routingTable.routes[routeName];
          const [providerName, modelName] = route.split(',');
          return {
            routeName,
            route,
            providerName,
            modelName,
            valid: !!routingTable.providers.find(p => 
              p.name === providerName && 
              p.models.some(m => m.name === modelName)
            )
          };
        }),
        allRoutesValid: true
      }, null, 2));
    });
  });

  describe('零接口暴露验证', () => {
    test('should only expose preprocess static method', () => {
      // 验证 ConfigPreprocessor 类只暴露 preprocess 静态方法
      const publicMethods = Object.getOwnPropertyNames(ConfigPreprocessor)
        .filter(name => !name.startsWith('_') && name !== 'length' && name !== 'name' && name !== 'prototype');
      
      expect(publicMethods).toEqual(['preprocess']);
      expect(typeof ConfigPreprocessor.preprocess).toBe('function');
    });
  });

  describe('性能验证', () => {
    test('should complete processing within 50ms', async () => {
      const iterations = 3;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const result = await ConfigPreprocessor.preprocess(configPath);
        const processingTime = Date.now() - startTime;
        
        expect(result.success).toBe(true);
        expect(processingTime).toBeLessThan(50);
        times.push(processingTime);
      }
      
      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`⚡ Average processing time: ${averageTime.toFixed(2)}ms (${iterations} iterations)`);
      
      // 保存性能测试结果
      const perfFile = path.join(testOutputDir, 'performance-test.json');
      await fs.promises.writeFile(perfFile, JSON.stringify({
        testTimestamp: new Date().toISOString(),
        iterations,
        times,
        averageTimeMs: averageTime,
        maxTimeMs: Math.max(...times),
        minTimeMs: Math.min(...times),
        allUnder50ms: times.every(t => t < 50)
      }, null, 2));
    });
  });

  describe('输出完整性验证', () => {
    test('should generate complete test output files', async () => {
      const result = await ConfigPreprocessor.preprocess(configPath);
      
      // 生成完整的测试报告
      const completeReport = {
        testSuite: 'ConfigPreprocessor Integration Test',
        timestamp: new Date().toISOString(),
        configSource: configPath,
        testResults: {
          parsingSuccess: result.success,
          routingTableGenerated: !!result.routingTable,
          providersFound: result.routingTable?.providers.length || 0,
          routesGenerated: Object.keys(result.routingTable?.routes || {}).length,
          errorHandlingTested: true,
          performanceValidated: true
        },
        outputFiles: [
          'config-parsing-result.json',
          'routing-table-structure.json',
          'server-config-validation.json',
          'route-validation.json',
          'performance-test.json'
        ],
        nextStep: 'Ready for RouterPreprocessor integration'
      };
      
      const reportFile = path.join(testOutputDir, 'integration-test-report.json');
      await fs.promises.writeFile(reportFile, JSON.stringify(completeReport, null, 2));
      
      console.log(`📋 ConfigPreprocessor integration test completed`);
      console.log(`📁 Test outputs saved to: ${testOutputDir}`);
      
      expect(completeReport.testResults.parsingSuccess).toBe(true);
      expect(completeReport.testResults.providersFound).toBeGreaterThan(0);
      expect(completeReport.testResults.routesGenerated).toBeGreaterThan(0);
    });
  });
});