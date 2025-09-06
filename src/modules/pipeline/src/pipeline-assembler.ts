/**
 * Pipeline Assembler
 * 
 * 一次性Pipeline组装器 - 动态组装流水线模块
 * 
 * @author Claude Code Router v4.0
 */

import { ModuleInterface, ModuleType } from './module-interface';
import { ModuleRegistry } from './module-registry';
import { PipelineConfig } from '../../router/src/router-preprocessor';
import {
  AssembledPipeline,
  AssembledModule,
  PipelineAssemblyResult,
  PipelinesByRouteModel,
  AssemblyStats,
  ModuleSelectionStrategy,
  ModuleHealthCheck
} from './assembly-types';
import { RCCError, RCCErrorCode } from '../../types/src';
import { EnhancedErrorHandler } from '../../error-handler/src/enhanced-error-handler';
import { ModuleDebugIntegration } from '../../logging/src/debug-integration';

/**
 * 默认模块选择策略
 */
class DefaultModuleSelectionStrategy implements ModuleSelectionStrategy {
  constructor(private registry: ModuleRegistry) {}
  
  async selectModule(type: ModuleType, config: Record<string, any>): Promise<ModuleInterface | null> {
    const availableModules = this.getAvailableModules(type);
    
    if (availableModules.length === 0) {
      return null;
    }
    
    // 根据provider选择合适的模块
    const provider = config.provider;
    if (provider) {
      // 优先选择provider特定的模块
      const specificModule = availableModules.find(module => 
        module.getName().toLowerCase().includes(provider.toLowerCase())
      );
      if (specificModule) {
        return specificModule;
      }
    }
    
    // 默认返回第一个可用模块
    return availableModules[0];
  }
  
  getAvailableModules(type: ModuleType): ModuleInterface[] {
    const registrations = this.registry.getModulesByType(type);
    return registrations
      .filter(reg => reg.isActive)
      .map(reg => reg.module);
  }
  
  async validateModuleCompatibility(modules: ModuleInterface[]): Promise<boolean> {
    // 基础兼容性检查
    return modules.length > 0 && modules.every(module => {
      const status = module.getStatus();
      return status.health !== 'unhealthy';
    });
  }
}

/**
 * Pipeline组装器
 * 
 * 一次性生命周期：启动 → 扫描 → 组装 → 输出 → 销毁
 */
export class PipelineAssembler {
  private registry: ModuleRegistry;
  private selectionStrategy: ModuleSelectionStrategy;
  private assembledPipelines: Map<string, AssembledPipeline> = new Map();
  private isDestroyed = false;
  private static errorHandler: EnhancedErrorHandler = new EnhancedErrorHandler();
  private static debugIntegration: ModuleDebugIntegration = new ModuleDebugIntegration({
    moduleId: 'pipeline-assembler',
    moduleName: 'PipelineAssembler',
    enabled: true,
    captureLevel: 'full'
  });
  
  constructor() {
    this.registry = new ModuleRegistry();
    this.selectionStrategy = new DefaultModuleSelectionStrategy(this.registry);
  }
  
  /**
   * 组装流水线 - 主要入口方法
   * 
   * @param pipelineConfigs 来自RouterPreprocessor的流水线配置数组
   * @returns 组装结果
   */
  async assemble(pipelineConfigs: PipelineConfig[]): Promise<PipelineAssemblyResult> {
    const requestId = `pipeline-assembly-${Date.now()}`;
    
    // 初始化debug系统并开始会话
    await PipelineAssembler.debugIntegration.initialize();
    const sessionId = PipelineAssembler.debugIntegration.startSession();
    
    // 记录输入
    PipelineAssembler.debugIntegration.recordInput(requestId, { 
      pipelineConfigsCount: pipelineConfigs.length,
      pipelineIds: pipelineConfigs.map(c => c.pipelineId)
    });
    
    if (this.isDestroyed) {
      const destroyedError = new RCCError(
        'PipelineAssembler has been destroyed',
        RCCErrorCode.PIPELINE_ASSEMBLY_FAILED,
        'pipeline',
        {}
      );
      
      // 记录错误
      PipelineAssembler.debugIntegration.recordError(requestId, destroyedError);
      
      await PipelineAssembler.errorHandler.handleRCCError(destroyedError, { requestId });
      await PipelineAssembler.debugIntegration.endSession();
      return this._createFailureResult(['PipelineAssembler has been destroyed'], [], Date.now());
    }
    
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 1. 扫描并注册模块
    await this.registry.scanAndRegisterModules();
    
    const registryStats = this.registry.getRegistryStats();
    if (registryStats.totalModules === 0) {
      errors.push('No modules found during scanning');
      return this._createFailureResult(errors, warnings, startTime);
    }
    
    // 2. 组装每个流水线
    const assemblies: AssembledPipeline[] = [];
    
    for (const config of pipelineConfigs) {
      const assembledPipeline = await this._assembleSinglePipeline(config);
      if (assembledPipeline.assemblyStatus === 'assembled') {
        assemblies.push(assembledPipeline);
        this.assembledPipelines.set(config.pipelineId, assembledPipeline);
      } else {
        errors.push(...assembledPipeline.assemblyErrors);
      }
    }
    
    // 3. 按路由模型分组
    const pipelinesByRouteModel = this._groupPipelinesByRouteModel(assemblies);
    
    // 4. 验证连接和健康检查
    await this._validateAllConnections(assemblies);
    const healthChecks = await this._performHealthChecks(assemblies);
    
    // 5. 计算统计信息
    const assemblyTime = Date.now() - startTime;
    const stats: AssemblyStats = {
      totalPipelines: assemblies.length,
      successfulAssemblies: assemblies.filter(p => p.assemblyStatus === 'assembled').length,
      failedAssemblies: pipelineConfigs.length - assemblies.length,
      totalModulesRegistered: registryStats.totalModules,
      modulesByType: registryStats.modulesByType,
      assemblyTimeMs: assemblyTime,
      averageAssemblyTime: assemblies.length > 0 ? assemblyTime / assemblies.length : 0,
      memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024
    };
    
    // 6. 返回结果
    const result = {
      success: errors.length === 0,
      pipelinesByRouteModel,
      allPipelines: assemblies,
      stats,
      errors,
      warnings
    };
    
    // 记录输出
    PipelineAssembler.debugIntegration.recordOutput(requestId, {
      success: result.success,
      assembledPipelinesCount: assemblies.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      assemblyTimeMs: stats.assemblyTimeMs
    });
    
    // 结束debug会话
    await PipelineAssembler.debugIntegration.endSession();
    
    return result;
  }
  
  /**
   * 销毁组装器
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }
    
    // 清理所有已组装的流水线
    for (const pipeline of this.assembledPipelines.values()) {
      for (const module of pipeline.modules) {
        if (module.instance) {
          await module.instance.cleanup();
        }
      }
    }
    
    this.assembledPipelines.clear();
    this.isDestroyed = true;
  }
  
  /**
   * 组装单个流水线
   */
  private async _assembleSinglePipeline(config: PipelineConfig): Promise<AssembledPipeline> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    const pipeline: AssembledPipeline = {
      pipelineId: config.pipelineId,
      routeId: config.routeId,
      routeName: this._extractRouteNameFromRouteId(config.routeId),
      provider: config.provider,
      model: config.model,
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
      maxTokens: config.maxTokens,
      modules: [],
      assemblyStatus: 'assembling',
      assemblyTime: 0,
      assemblyErrors: [],
      isActive: true,
      health: 'healthy'
    };
    
    // 按顺序组装每一层模块
    let previousModule: AssembledModule | undefined;
    
    for (const layerConfig of config.layers) {
      const moduleType = layerConfig.type as ModuleType;
      const moduleInstance = await this.selectionStrategy.selectModule(moduleType, layerConfig.config);
      
      if (!moduleInstance) {
        errors.push(`No module found for type: ${moduleType}`);
        continue;
      }
      
      // 配置模块
      await moduleInstance.configure(layerConfig.config);
      
      // 创建组装后的模块
      const assembledModule: AssembledModule = {
        name: layerConfig.name,
        type: moduleType,
        order: layerConfig.order,
        config: layerConfig.config,
        instance: moduleInstance,
        previousModule,
        isInitialized: false,
        initializationTime: 0
      };
      
      // 建立连接关系
      if (previousModule) {
        previousModule.nextModule = assembledModule;
        moduleInstance.addConnection(previousModule.instance);
        previousModule.instance.addConnection(moduleInstance);
      }
      
      // 初始化模块
      const initStartTime = Date.now();
      await moduleInstance.start();
      assembledModule.isInitialized = true;
      assembledModule.initializationTime = Date.now() - initStartTime;
      
      pipeline.modules.push(assembledModule);
      previousModule = assembledModule;
    }
    
    // 完成组装
    pipeline.assemblyTime = Date.now() - startTime;
    pipeline.assemblyErrors = errors;
    pipeline.assemblyStatus = errors.length === 0 ? 'assembled' : 'failed';
    
    return pipeline;
  }
  
  /**
   * 按路由模型分组流水线
   */
  private _groupPipelinesByRouteModel(pipelines: AssembledPipeline[]): PipelinesByRouteModel {
    const grouped: PipelinesByRouteModel = {};
    
    for (const pipeline of pipelines) {
      const routeName = pipeline.routeName;
      if (!grouped[routeName]) {
        grouped[routeName] = [];
      }
      grouped[routeName].push(pipeline);
    }
    
    return grouped;
  }
  
  /**
   * 验证所有连接
   */
  private async _validateAllConnections(pipelines: AssembledPipeline[]): Promise<void> {
    for (const pipeline of pipelines) {
      for (let i = 0; i < pipeline.modules.length - 1; i++) {
        const currentModule = pipeline.modules[i];
        const nextModule = pipeline.modules[i + 1];
        
        // 验证连接是否正确建立
        if (!currentModule.instance.hasConnection(nextModule.instance.getId())) {
          pipeline.assemblyErrors.push(`Connection not established between ${currentModule.name} and ${nextModule.name}`);
          pipeline.health = 'degraded';
        }
      }
    }
  }
  
  /**
   * 执行健康检查
   */
  private async _performHealthChecks(pipelines: AssembledPipeline[]): Promise<ModuleHealthCheck[]> {
    const healthChecks: ModuleHealthCheck[] = [];
    
    for (const pipeline of pipelines) {
      for (const module of pipeline.modules) {
        const startTime = Date.now();
        const healthResult = await module.instance.healthCheck();
        const responseTime = Date.now() - startTime;
        
        const healthCheck: ModuleHealthCheck = {
          moduleId: module.instance.getId(),
          moduleName: module.instance.getName(),
          moduleType: module.instance.getType(),
          isHealthy: healthResult.healthy,
          responseTime,
          details: healthResult.details,
          lastChecked: new Date()
        };
        
        healthChecks.push(healthCheck);
        
        // 更新流水线健康状态
        if (!healthResult.healthy && pipeline.health === 'healthy') {
          pipeline.health = 'degraded';
        }
      }
    }
    
    return healthChecks;
  }
  
  /**
   * 从routeId提取routeName
   */
  private _extractRouteNameFromRouteId(routeId: string): string {
    // routeId格式: "route_default_iflow_0_0"
    const parts = routeId.split('_');
    return parts.length >= 2 ? parts[1] : 'unknown';
  }
  
  /**
   * 创建失败结果
   */
  private _createFailureResult(errors: string[], warnings: string[], startTime: number): PipelineAssemblyResult {
    return {
      success: false,
      pipelinesByRouteModel: {},
      allPipelines: [],
      stats: {
        totalPipelines: 0,
        successfulAssemblies: 0,
        failedAssemblies: 0,
        totalModulesRegistered: 0,
        modulesByType: {},
        assemblyTimeMs: Date.now() - startTime,
        averageAssemblyTime: 0,
        memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024
      },
      errors,
      warnings
    };
  }
}