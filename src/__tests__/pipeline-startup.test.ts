/**
 * RCC v4.0 Pipeline Startup Test
 * 
 * 完整的端到端流水线启动测试
 * 
 * 功能要求：
 * - 从配置文件开始，经过 ConfigPreprocessor → RouterPreprocessor
 * - 每个模块将输出保存为单独的文件到 test-outputs/pipeline-startup/ 目录
 * - 验证每个模块的输出能正确传递给下一个模块
 * - 执行完整的流水线启动过程
 * 
 * @author Claude Code Router v4.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { ConfigPreprocessor, ConfigPreprocessResult } from '../modules/config/src/config-preprocessor';
import { RouterPreprocessor, RouterPreprocessResult, PipelineConfig } from '../modules/router/src/router-preprocessor';
import { RoutingTable } from '../modules/config/src/routing-table-types';
import { RCCError, RCCErrorCode } from '../modules/types/src/index';

describe('Pipeline Startup Integration Test', () => {
  const testOutputDir = path.join(__dirname, 'test-outputs', 'pipeline-startup');
  const configPath = '/Users/fanzhang/.route-claudecode/config.json';

  beforeAll(async () => {
    // 创建测试输出目录
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    // 清理之前的测试文件
    const files = [
      '01-config-input.json',
      '02-config-preprocessor-output.json',
      '03-routing-table.json',
      '04-router-preprocessor-input.json',
      '05-router-preprocessor-output.json',
      '06-pipeline-configs.json',
      'startup-validation-report.json'
    ];

    files.forEach(file => {
      const filePath = path.join(testOutputDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });

  test('Complete Pipeline Startup Process', async () => {
    const startTime = Date.now();
    const testReport = {
      testName: 'Complete Pipeline Startup Process',
      startTime: new Date().toISOString(),
      steps: [] as any[],
      success: false,
      totalProcessingTime: 0,
      errors: [] as string[],
      warnings: [] as string[]
    };

    try {
      // Step 1: 加载原始配置文件
      let stepStartTime = Date.now();
      
      if (!fs.existsSync(configPath)) {
        throw new RCCError(`Config file not found: ${configPath}`, RCCErrorCode.CONFIG_MISSING, 'pipeline-startup-test');
      }

      const rawConfigContent = fs.readFileSync(configPath, 'utf8');
      const originalConfig = JSON.parse(rawConfigContent);
      
      // 保存原始配置
      const configInputPath = path.join(testOutputDir, '01-config-input.json');
      fs.writeFileSync(configInputPath, JSON.stringify(originalConfig, null, 2));
      
      const step1Time = Date.now() - stepStartTime;
      testReport.steps.push({
        step: 1,
        name: 'Load Original Config',
        duration: step1Time,
        success: true,
        outputFile: '01-config-input.json',
        data: {
          providersCount: originalConfig.Providers?.length || 0,
          routesCount: Object.keys(originalConfig.router || {}).length,
          serverPort: originalConfig.server?.port
        }
      });

      // Step 2: ConfigPreprocessor处理
      stepStartTime = Date.now();

      const configResult: ConfigPreprocessResult = await ConfigPreprocessor.preprocess(configPath);
      
      if (!configResult.success) {
        throw new RCCError(`ConfigPreprocessor failed: ${configResult.error?.message}`, RCCErrorCode.CONFIG_PARSE_ERROR, 'pipeline-startup-test');
      }

      // 保存ConfigPreprocessor完整输出
      const configOutputPath = path.join(testOutputDir, '02-config-preprocessor-output.json');
      fs.writeFileSync(configOutputPath, JSON.stringify(configResult, null, 2));

      // 保存路由表
      const routingTablePath = path.join(testOutputDir, '03-routing-table.json');
      fs.writeFileSync(routingTablePath, JSON.stringify(configResult.routingTable, null, 2));

      const step2Time = Date.now() - stepStartTime;
      testReport.steps.push({
        step: 2,
        name: 'ConfigPreprocessor Processing',
        duration: step2Time,
        success: configResult.success,
        outputFile: '02-config-preprocessor-output.json',
        data: {
          providersCount: configResult.routingTable?.providers.length || 0,
          routesCount: Object.keys(configResult.routingTable?.routes || {}).length,
          processingTime: configResult.metadata.processingTime,
          sourceFormat: configResult.metadata.sourceFormat
        }
      });

      // Step 3: 准备RouterPreprocessor输入
      stepStartTime = Date.now();

      const routingTable = configResult.routingTable!;
      
      // 保存RouterPreprocessor输入数据
      const routerInputPath = path.join(testOutputDir, '04-router-preprocessor-input.json');
      fs.writeFileSync(routerInputPath, JSON.stringify(routingTable, null, 2));

      const step3Time = Date.now() - stepStartTime;
      testReport.steps.push({
        step: 3,
        name: 'Prepare RouterPreprocessor Input',
        duration: step3Time,
        success: true,
        outputFile: '04-router-preprocessor-input.json',
        data: {
          providers: routingTable.providers.map(p => ({ name: p.name, modelsCount: p.models.length })),
          routes: Object.keys(routingTable.routes)
        }
      });

      // Step 4: RouterPreprocessor处理
      stepStartTime = Date.now();

      const routerResult: RouterPreprocessResult = await RouterPreprocessor.preprocess(routingTable);
      
      if (!routerResult.success) {
        throw new RCCError(`RouterPreprocessor failed: ${routerResult.errors.join(', ')}`, RCCErrorCode.ROUTER_CONFIG_ERROR, 'pipeline-startup-test');
      }

      // 保存RouterPreprocessor完整输出
      const routerOutputPath = path.join(testOutputDir, '05-router-preprocessor-output.json');
      fs.writeFileSync(routerOutputPath, JSON.stringify(routerResult, null, 2));

      const step4Time = Date.now() - stepStartTime;
      testReport.steps.push({
        step: 4,
        name: 'RouterPreprocessor Processing',
        duration: step4Time,
        success: routerResult.success,
        outputFile: '05-router-preprocessor-output.json',
        data: {
          routesCount: routerResult.stats.routesCount,
          pipelinesCount: routerResult.stats.pipelinesCount,
          processingTime: routerResult.stats.processingTimeMs,
          errors: routerResult.errors.length,
          warnings: routerResult.warnings.length
        }
      });

      // Step 5: 保存流水线配置
      stepStartTime = Date.now();

      const pipelineConfigs = routerResult.pipelineConfigs!;
      
      // 保存流水线配置数组
      const pipelineConfigsPath = path.join(testOutputDir, '06-pipeline-configs.json');
      fs.writeFileSync(pipelineConfigsPath, JSON.stringify(pipelineConfigs, null, 2));

      const step5Time = Date.now() - stepStartTime;
      testReport.steps.push({
        step: 5,
        name: 'Save Pipeline Configurations',
        duration: step5Time,
        success: true,
        outputFile: '06-pipeline-configs.json',
        data: {
          pipelinesCount: pipelineConfigs.length,
          providers: [...new Set(pipelineConfigs.map(p => p.provider))],
          models: [...new Set(pipelineConfigs.map(p => p.model))],
          avgLayersPerPipeline: pipelineConfigs.reduce((sum, p) => sum + p.layers.length, 0) / pipelineConfigs.length
        }
      });

      // Step 6: 验证数据完整性
      stepStartTime = Date.now();

      const validationResults = await validateDataIntegrity(originalConfig, routingTable, pipelineConfigs);
      
      const step6Time = Date.now() - stepStartTime;
      testReport.steps.push({
        step: 6,
        name: 'Data Integrity Validation',
        duration: step6Time,
        success: validationResults.success,
        data: validationResults
      });

      if (validationResults.errors.length > 0) {
        testReport.errors.push(...validationResults.errors);
      }
      if (validationResults.warnings.length > 0) {
        testReport.warnings.push(...validationResults.warnings);
      }

      // 完成测试
      testReport.success = validationResults.success;
      testReport.totalProcessingTime = Date.now() - startTime;

    } catch (error) {
      testReport.success = false;
      if (error instanceof RCCError) {
        testReport.errors.push(error.message);
      } else {
        testReport.errors.push((error as Error).message);
      }
      testReport.totalProcessingTime = Date.now() - startTime;
    } finally {
      // 保存测试报告
      const reportPath = path.join(testOutputDir, 'startup-validation-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(testReport, null, 2));
    }

    // 测试断言
    expect(testReport.success).toBe(true);
    expect(testReport.errors.length).toBe(0);
    expect(testReport.steps.length).toBe(6);
    
    // 验证所有输出文件都存在
    const expectedFiles = [
      '01-config-input.json',
      '02-config-preprocessor-output.json',
      '03-routing-table.json',
      '04-router-preprocessor-input.json',
      '05-router-preprocessor-output.json',
      '06-pipeline-configs.json',
      'startup-validation-report.json'
    ];
    
    expectedFiles.forEach(file => {
      const filePath = path.join(testOutputDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    // 验证处理时间合理性
    expect(testReport.totalProcessingTime).toBeLessThan(10000); // 小于10秒
    testReport.steps.forEach((step) => {
      expect(step.duration).toBeLessThan(5000); // 每个步骤小于5秒
    });

  }, 30000); // 30秒超时
});

/**
 * 验证数据完整性
 */
async function validateDataIntegrity(
  originalConfig: any,
  routingTable: RoutingTable,
  pipelineConfigs: PipelineConfig[]
): Promise<{
  success: boolean;
  errors: string[];
  warnings: string[];
  checks: any[];
}> {
  const checks: any[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 检查1: Provider数量一致性
    const originalProvidersCount = originalConfig.Providers?.length || 0;
    const processedProvidersCount = routingTable.providers.length;
    
    const providerCheck = {
      name: 'Provider Count Consistency',
      original: originalProvidersCount,
      processed: processedProvidersCount,
      success: originalProvidersCount === processedProvidersCount
    };
    checks.push(providerCheck);
    
    if (!providerCheck.success) {
      errors.push(`Provider count mismatch: original ${originalProvidersCount}, processed ${processedProvidersCount}`);
    }

    // 检查2: 路由数量一致性
    const originalRoutesCount = Object.keys(originalConfig.router || {}).length;
    const processedRoutesCount = Object.keys(routingTable.routes).length;
    
    const routeCheck = {
      name: 'Route Count Consistency',
      original: originalRoutesCount,
      processed: processedRoutesCount,
      success: originalRoutesCount <= processedRoutesCount // 允许自动生成的路由
    };
    checks.push(routeCheck);
    
    if (!routeCheck.success) {
      errors.push(`Route count inconsistent: original ${originalRoutesCount}, processed ${processedRoutesCount}`);
    }

    // 检查3: 流水线配置完整性
    const pipelineIntegrityChecks = [];
    for (const pipeline of pipelineConfigs) {
      const pipelineCheck = {
        pipelineId: pipeline.pipelineId,
        hasRequiredFields: !!(pipeline.provider && pipeline.model && pipeline.endpoint && pipeline.apiKey),
        layersCount: pipeline.layers.length,
        hasAllLayers: pipeline.layers.length === 4, // transformer, protocol, server-compatibility, server
        layerTypes: pipeline.layers.map(l => l.type)
      };
      pipelineIntegrityChecks.push(pipelineCheck);
      
      if (!pipelineCheck.hasRequiredFields) {
        errors.push(`Pipeline ${pipeline.pipelineId} missing required fields`);
      }
      
      if (!pipelineCheck.hasAllLayers) {
        warnings.push(`Pipeline ${pipeline.pipelineId} has ${pipelineCheck.layersCount} layers (expected 4)`);
      }

      // 验证层配置
      for (const layer of pipeline.layers) {
        if (!layer.config || Object.keys(layer.config).length === 0) {
          warnings.push(`Pipeline ${pipeline.pipelineId} layer ${layer.name} has empty config`);
        }
      }
    }
    
    const pipelineCheck = {
      name: 'Pipeline Configuration Integrity',
      totalPipelines: pipelineConfigs.length,
      validPipelines: pipelineIntegrityChecks.filter(p => p.hasRequiredFields).length,
      completePipelines: pipelineIntegrityChecks.filter(p => p.hasAllLayers).length,
      details: pipelineIntegrityChecks
    };
    checks.push(pipelineCheck);

    // 检查4: 模型映射一致性
    const modelMappingChecks = [];
    for (const provider of routingTable.providers) {
      const originalProvider = originalConfig.Providers?.find((p: any) => p.name === provider.name);
      if (originalProvider) {
        const originalModels = Array.isArray(originalProvider.models) ? originalProvider.models : [];
        const processedModels = provider.models.map(m => typeof m === 'string' ? m : m.name);
        
        const modelCheck = {
          provider: provider.name,
          originalCount: originalModels.length,
          processedCount: processedModels.length,
          originalModels,
          processedModels,
          consistent: originalModels.length === processedModels.length
        };
        modelMappingChecks.push(modelCheck);
        
        if (!modelCheck.consistent) {
          warnings.push(`Provider ${provider.name} model count changed: ${originalModels.length} -> ${processedModels.length}`);
        }
      }
    }
    
    checks.push({
      name: 'Model Mapping Consistency',
      details: modelMappingChecks
    });

    // 检查5: 六层架构验证
    const layerArchitectureCheck = {
      name: 'Six-Layer Architecture Validation',
      expectedLayers: ['transformer', 'protocol', 'server-compatibility', 'server'],
      pipelineLayerValidation: [] as any[]
    };
    
    for (const pipeline of pipelineConfigs) {
      const layerTypes = pipeline.layers.map(l => l.type);
      const hasAllExpected = layerArchitectureCheck.expectedLayers.every(expected => 
        layerTypes.includes(expected as any)
      );
      
      layerArchitectureCheck.pipelineLayerValidation.push({
        pipelineId: pipeline.pipelineId,
        layers: layerTypes,
        hasAllExpected,
        missing: layerArchitectureCheck.expectedLayers.filter(expected => 
          !layerTypes.includes(expected as any)
        )
      });
      
      if (!hasAllExpected) {
        errors.push(`Pipeline ${pipeline.pipelineId} missing required layers`);
      }
    }
    
    checks.push(layerArchitectureCheck);

    return {
      success: errors.length === 0,
      errors,
      warnings,
      checks
    };

  } catch (error) {
    if (error instanceof RCCError) {
      errors.push(`Validation failed: ${error.message}`);
    } else {
      errors.push(`Validation failed: ${(error as Error).message}`);
    }
    return {
      success: false,
      errors,
      warnings,
      checks
    };
  }
}