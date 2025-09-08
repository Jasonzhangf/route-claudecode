/**
 * Pipeline Assembly Integration Test
 * 
 * Pipeline组装器集成测试 - 使用真实的RouterPreprocessor输出
 * 
 * @author Claude Code Router v4.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { PipelineAssembler, PipelineAssemblyResult } from '../index';
import { PipelineConfig } from '../../../router/src/router-preprocessor';
import { JQJsonHandler } from '../../../utils/jq-json-handler';
import { ModuleType } from '../module-interface';

/**
 * 输出路径配置
 */
const TEST_OUTPUTS_DIR = path.join(__dirname, 'test-outputs');
const ROUTER_TEST_OUTPUTS_DIR = path.join(__dirname, '../../../router/src/__tests__/test-outputs');

/**
 * 确保输出目录存在
 */
function ensureTestOutputsDir(): void {
  if (!fs.existsSync(TEST_OUTPUTS_DIR)) {
    fs.mkdirSync(TEST_OUTPUTS_DIR, { recursive: true });
  }
}

/**
 * 保存输出到文件
 */
function saveTestOutput(filename: string, data: any): void {
  const filePath = path.join(TEST_OUTPUTS_DIR, filename);
  fs.writeFileSync(filePath, JQJsonHandler.stringifyJson(data, true), 'utf-8');
}

/**
 * 读取RouterPreprocessor的输出
 */
function loadRouterOutput(): PipelineConfig[] {
  const configPath = path.join(ROUTER_TEST_OUTPUTS_DIR, 'pipeline-configs.json');
  
  if (!fs.existsSync(configPath)) {
    return [];
  }
  
  const content = fs.readFileSync(configPath, 'utf-8');
  return JQJsonHandler.parseJsonString(content) as PipelineConfig[];
}

describe('Pipeline Assembly Integration', () => {
  let assembler: PipelineAssembler;
  let pipelineConfigs: PipelineConfig[];
  let originalEnv: Record<string, string | undefined>;
  
  beforeAll(() => {
    // 保存原始环境变量
    originalEnv = {
      NODE_ENV: process.env.NODE_ENV,
      RCC4_AUTH_MODE: process.env.RCC4_AUTH_MODE,
      RCC4_SKIP_AUTH_VALIDATION: process.env.RCC4_SKIP_AUTH_VALIDATION
    };
    
    // 设置测试环境变量 - 使用OAuth鉴权模式
    process.env.NODE_ENV = 'test';
    process.env.RCC4_AUTH_MODE = 'oauth';
    process.env.RCC4_SKIP_AUTH_VALIDATION = 'true'; // 在测试环境中跳过鉴权验证
    
    ensureTestOutputsDir();
    assembler = new PipelineAssembler();
    pipelineConfigs = loadRouterOutput();
  });
  
  afterAll(async () => {
    if (assembler) {
      await assembler.destroy();
    }
  });
  
  it('should load RouterPreprocessor output successfully', () => {
    expect(pipelineConfigs).toBeDefined();
    expect(Array.isArray(pipelineConfigs)).toBe(true);
    expect(pipelineConfigs.length).toBeGreaterThan(0);
    
    // 验证每个配置的结构
    for (const config of pipelineConfigs) {
      expect(config.pipelineId).toBeDefined();
      expect(config.routeId).toBeDefined();
      expect(config.provider).toBeDefined();
      expect(config.model).toBeDefined();
      expect(config.endpoint).toBeDefined();
      expect(config.layers).toBeDefined();
      expect(Array.isArray(config.layers)).toBe(true);
      expect(config.layers.length).toBeGreaterThan(0);
    }
    
    // 保存配置信息供手动检查
    saveTestOutput('input-pipeline-configs.json', {
      totalConfigs: pipelineConfigs.length,
      configSample: pipelineConfigs.slice(0, 2),
      providerBreakdown: pipelineConfigs.reduce((acc, config) => {
        acc[config.provider] = (acc[config.provider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });
  });
  
  it('should assemble all pipelines successfully', async () => {
    const result: PipelineAssemblyResult = await assembler.assemble(pipelineConfigs);
    
    // 基本成功检查
    expect(result).toBeDefined();
    
    // 调试信息：显示组装结果
    console.log('🔍 [DEBUG] 组装结果概览:', {
      success: result.success,
      totalErrors: result.errors.length,
      totalWarnings: result.warnings.length,
      totalPipelines: result.allPipelines.length,
      totalConfigs: pipelineConfigs.length
    });
    
    if (!result.success) {
      console.log('🔍 [DEBUG] 组装失败，错误信息:', result.errors);
      console.log('🔍 [DEBUG] 组装警告:', result.warnings);
      console.log('🔍 [DEBUG] 组装统计:', result.stats);
    }
    
    // 检查每个配置对应的流水线状态
    console.log('🔍 [DEBUG] 单个流水线状态检查:');
    for (let i = 0; i < pipelineConfigs.length; i++) {
      const config = pipelineConfigs[i];
      const pipeline = result.allPipelines.find(p => p.pipelineId === config.pipelineId);
      
      console.log(`  ${i + 1}. ${config.pipelineId}:`);
      console.log(`     配置层: [${config.layers.map(l => l.type).join(', ')}]`);
      
      if (pipeline) {
        console.log(`     状态: ${pipeline.assemblyStatus}`);
        console.log(`     模块数: ${pipeline.modules.length}`);
        console.log(`     错误: [${pipeline.assemblyErrors.join(', ')}]`);
      } else {
        console.log(`     ❌ 未找到对应的组装流水线`);
      }
    }
    
    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
    
    // 统计信息验证
    expect(result.stats).toBeDefined();
    expect(result.stats.totalPipelines).toBe(pipelineConfigs.length);
    expect(result.stats.successfulAssemblies).toBe(pipelineConfigs.length);
    expect(result.stats.failedAssemblies).toBe(0);
    expect(result.stats.assemblyTimeMs).toBeGreaterThan(0);
    
    // 流水线验证
    expect(result.allPipelines).toBeDefined();
    expect(result.allPipelines.length).toBe(pipelineConfigs.length);
    
    // 每个流水线的结构验证
    for (const pipeline of result.allPipelines) {
      expect(pipeline.pipelineId).toBeDefined();
      expect(pipeline.routeId).toBeDefined();
      expect(pipeline.routeName).toBeDefined();
      expect(pipeline.provider).toBeDefined();
      expect(pipeline.model).toBeDefined();
      expect(pipeline.modules).toBeDefined();
      expect(Array.isArray(pipeline.modules)).toBe(true);
      expect(pipeline.modules.length).toBeGreaterThan(0);
      expect(pipeline.assemblyStatus).toBe('assembled');
      expect(pipeline.isActive).toBe(true);
      expect(['healthy', 'degraded'].includes(pipeline.health)).toBe(true);
    }
    
    // 保存组装结果
    saveTestOutput('assembly-result.json', {
      success: result.success,
      stats: result.stats,
      errors: result.errors,
      warnings: result.warnings,
      pipelineCount: result.allPipelines.length,
      routeModelCount: Object.keys(result.pipelinesByRouteModel).length
    });
  }, 30000); // 30秒超时
  
  it('should group pipelines by route model correctly', async () => {
    const result: PipelineAssemblyResult = await assembler.assemble(pipelineConfigs);
    
    expect(result.pipelinesByRouteModel).toBeDefined();
    expect(typeof result.pipelinesByRouteModel).toBe('object');
    
    const routeModels = Object.keys(result.pipelinesByRouteModel);
    expect(routeModels.length).toBeGreaterThan(0);
    
    // 验证每个路由模型组
    for (const [routeModel, pipelines] of Object.entries(result.pipelinesByRouteModel)) {
      expect(routeModel).toBeDefined();
      expect(Array.isArray(pipelines)).toBe(true);
      expect(pipelines.length).toBeGreaterThan(0);
      
      // 验证所有流水线都属于同一路由模型
      for (const pipeline of pipelines) {
        expect(pipeline.routeName).toBe(routeModel);
      }
    }
    
    // 验证总数匹配
    const totalPipelines = Object.values(result.pipelinesByRouteModel)
      .reduce((sum, pipelines) => sum + pipelines.length, 0);
    expect(totalPipelines).toBe(result.allPipelines.length);
    
    // 保存分组信息
    const groupingInfo = Object.entries(result.pipelinesByRouteModel).map(([routeModel, pipelines]) => ({
      routeModel,
      pipelineCount: pipelines.length,
      providers: [...new Set(pipelines.map(p => p.provider))],
      models: [...new Set(pipelines.map(p => p.model))]
    }));
    
    saveTestOutput('pipeline-grouping.json', {
      totalRouteModels: routeModels.length,
      routeModels,
      groupingDetails: groupingInfo
    });
  });
  
  it('should validate module initialization and connections', async () => {
    const result: PipelineAssemblyResult = await assembler.assemble(pipelineConfigs);
    
    expect(result.success).toBe(true);
    
    const initializationReport: any[] = [];
    
    // 验证每个流水线的模块初始化
    for (const pipeline of result.allPipelines) {
      const pipelineReport = {
        pipelineId: pipeline.pipelineId,
        provider: pipeline.provider,
        model: pipeline.model,
        moduleCount: pipeline.modules.length,
        modules: []
      };
      
      for (let i = 0; i < pipeline.modules.length; i++) {
        const module = pipeline.modules[i];
        
        // 验证模块基本信息
        expect(module.instance).toBeDefined();
        expect(module.isInitialized).toBe(true);
        expect(module.initializationTime).toBeGreaterThan(0);
        
        // 验证模块状态
        const status = module.instance.getStatus();
        expect(status.status).toBe('running');
        expect(['healthy', 'degraded'].includes(status.health)).toBe(true);
        
        // 验证连接关系
        if (i > 0) {
          expect(module.previousModule).toBeDefined();
          expect(module.previousModule!.nextModule).toBe(module);
        }
        
        if (i < pipeline.modules.length - 1) {
          expect(module.nextModule).toBeDefined();
        }
        
        pipelineReport.modules.push({
          name: module.name,
          type: module.type,
          order: module.order,
          isInitialized: module.isInitialized,
          initializationTime: module.initializationTime,
          hasNextConnection: !!module.nextModule,
          hasPreviousConnection: !!module.previousModule
        });
      }
      
      initializationReport.push(pipelineReport);
    }
    
    // 保存初始化报告
    saveTestOutput('module-initialization-report.json', {
      totalPipelines: result.allPipelines.length,
      initializationReport
    });
  });
  
  it('should generate comprehensive summary', async () => {
    const result: PipelineAssemblyResult = await assembler.assemble(pipelineConfigs);
    
    const summary = {
      executionTime: new Date().toISOString(),
      inputData: {
        configurationCount: pipelineConfigs.length,
        uniqueProviders: [...new Set(pipelineConfigs.map(c => c.provider))],
        uniqueModels: [...new Set(pipelineConfigs.map(c => c.model))],
        layerTypes: [...new Set(pipelineConfigs.flatMap(c => c.layers.map(l => l.type)))]
      },
      assemblyResults: {
        success: result.success,
        totalPipelines: result.allPipelines.length,
        successfulAssemblies: result.stats.successfulAssemblies,
        failedAssemblies: result.stats.failedAssemblies,
        assemblyTimeMs: result.stats.assemblyTimeMs,
        averageAssemblyTime: result.stats.averageAssemblyTime,
        memoryUsageMB: result.stats.memoryUsageMB
      },
      routeModelGrouping: {
        totalRouteModels: Object.keys(result.pipelinesByRouteModel).length,
        routeModels: Object.keys(result.pipelinesByRouteModel),
        pipelinesPerRouteModel: Object.entries(result.pipelinesByRouteModel).map(([name, pipelines]) => ({
          routeModel: name,
          count: pipelines.length
        }))
      },
      moduleRegistry: {
        totalModulesRegistered: result.stats.totalModulesRegistered,
        modulesByType: result.stats.modulesByType
      },
      healthStatus: {
        healthyPipelines: result.allPipelines.filter(p => p.health === 'healthy').length,
        degradedPipelines: result.allPipelines.filter(p => p.health === 'degraded').length,
        unhealthyPipelines: result.allPipelines.filter(p => p.health === 'unhealthy').length
      },
      errors: result.errors,
      warnings: result.warnings
    };
    
    // 保存完整总结
    saveTestOutput('comprehensive-summary.json', summary);
    
    // 验证关键指标
    expect(summary.assemblyResults.success).toBe(true);
    expect(summary.assemblyResults.totalPipelines).toBeGreaterThan(0);
    expect(summary.assemblyResults.failedAssemblies).toBe(0);
    expect(summary.routeModelGrouping.totalRouteModels).toBeGreaterThan(0);
    expect(summary.errors.length).toBe(0);
  });
});