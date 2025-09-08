/**
 * Pipeline Assembler
 * 
 * 一次性Pipeline组装器 - 动态组装流水线模块
 * 
 * @author Claude Code Router v4.0
 */

import { ModuleInterface, ModuleType } from './module-interface';
import { StaticModuleRegistry } from './static-module-registry';
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
import { RCCError, RCCErrorCode } from '../../types/src/index';
import { EnhancedErrorHandler } from '../../error-handler/src/enhanced-error-handler';
import { ModuleDebugIntegration } from '../../logging/src/debug-integration';

/**
 * 默认模块选择策略
 */
class DefaultModuleSelectionStrategy implements ModuleSelectionStrategy {
  constructor(private registry: StaticModuleRegistry) {}
  
  async selectModule(type: ModuleType, config: Record<string, any>): Promise<ModuleInterface | null> {
    console.log(`🔍 [MODULE-SELECTION] 查找模块类型: ${type}`);
    const availableRegistrations = this.registry.getModulesByType(type);
    console.log(`🔍 [MODULE-SELECTION] 找到 ${availableRegistrations.length} 个 ${type} 模块`);
    
    if (availableRegistrations.length === 0) {
      // 获取registry统计信息进行调试
      const registryStats = this.registry.getRegistryStats();
      console.log(`❌ [MODULE-SELECTION] 没有找到 ${type} 模块`);
      console.log(`📊 [MODULE-SELECTION] Registry统计:`, registryStats);
      return null;
    }
    
    // 根据provider选择合适的模块注册信息
    let selectedRegistration = availableRegistrations[0];
    const provider = config.provider;
    if (provider) {
      // 优先选择provider特定的模块
      const specificRegistration = availableRegistrations.find(reg => 
        reg.name.toLowerCase().includes(provider.toLowerCase()) ||
        reg.className.toLowerCase().includes(provider.toLowerCase())
      );
      if (specificRegistration) {
        selectedRegistration = specificRegistration;
      }
    }
    
    // 使用配置创建模块实例
    try {
      const moduleInstance = await this.registry.createModuleInstance(selectedRegistration, config);
      return moduleInstance;
    } catch (error) {
      console.error(`Failed to create module instance: ${error.message}`);
      return null;
    }
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
  private registry: StaticModuleRegistry;
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
    console.log('🚀 PipelineAssembler: 构造函数被调用，即将创建StaticModuleRegistry...');
    this.registry = new StaticModuleRegistry();
    console.log('✅ PipelineAssembler: StaticModuleRegistry创建完成');
    
    // 立即检查registry状态
    const registryStats = this.registry.getRegistryStats();
    console.log('📊 PipelineAssembler: Registry初始状态:', registryStats);
    
    this.selectionStrategy = new DefaultModuleSelectionStrategy(this.registry);
    console.log('✅ PipelineAssembler: 模块选择策略初始化完成');
  }
  
  /**
   * 组装流水线 - 主要入口方法
   * 
   * @param pipelineConfigs 来自RouterPreprocessor的流水线配置数组
   * @returns 组装结果
   */
  async assemble(pipelineConfigs: PipelineConfig[]): Promise<PipelineAssemblyResult> {
    const requestId = `pipeline-assembly-${Date.now()}`;
    
    console.log(`🚀 PipelineAssembler.assemble 开始 - 配置数量: ${pipelineConfigs.length}`);
    console.log(`🔍 流水线配置:`, pipelineConfigs.map(c => ({ id: c.pipelineId, provider: c.provider, model: c.model })));
    
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
      console.log(`🔧 开始组装流水线: ${config.pipelineId}`);
      const assembledPipeline = await this._assembleSinglePipeline(config);
      console.log(`🔍 流水线组装状态: ${assembledPipeline.assemblyStatus}`);
      if (assembledPipeline.assemblyErrors?.length > 0) {
        console.log(`❌ 流水线组装错误:`, assembledPipeline.assemblyErrors);
      }
      if (assembledPipeline.assemblyStatus === 'assembled') {
        assemblies.push(assembledPipeline);
        this.assembledPipelines.set(config.pipelineId, assembledPipeline);
        console.log(`✅ 流水线组装成功: ${config.pipelineId}`);
      } else {
        errors.push(...assembledPipeline.assemblyErrors);
        console.log(`❌ 流水线组装失败: ${config.pipelineId}`);
      }
    }
    
    // 3. 按路由模型分组
    const pipelinesByRouteModel = this._groupPipelinesByRouteModel(assemblies);
    
    // 4. 组装完成 - 验证和健康检查由独立模块负责
    // REFACTORED: 移除组装阶段的验证逻辑，由SelfCheckModule和运行时验证负责
    console.log(`🏭 流水线组装完成，跳过验证阶段 - 将由独立验证模块处理`);
    
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
   * 获取模块注册统计信息 - 用于调试
   */
  getModuleRegistryStats(): Record<string, any> {
    return this.registry.getRegistryStats();
  }

  /**
   * 获取特定类型的模块数量 - 用于调试
   */
  getModuleCountByType(type: ModuleType): number {
    return this.registry.getModulesByType(type).length;
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
      // 修复：当type为undefined时，根据name推断type
      let moduleType = layerConfig.type as ModuleType;
      if (!moduleType && layerConfig.name) {
        const nameToTypeMap: Record<string, ModuleType> = {
          'transformer': ModuleType.TRANSFORMER,
          'protocol': ModuleType.PROTOCOL,
          'server-compatibility': ModuleType.SERVER_COMPATIBILITY,
          'server': ModuleType.SERVER
        };
        moduleType = nameToTypeMap[layerConfig.name];
        console.log(`🔧 Fixed type for layer ${layerConfig.name}: ${moduleType}`);
      }
      
      const moduleInstance = await this.selectionStrategy.selectModule(moduleType, layerConfig.config);
      
      if (!moduleInstance) {
        errors.push(`No module found for type: ${moduleType}`);
        continue;
      }
      
      // REFACTORED: 组装阶段仅进行基础配置，不进行鉴权验证
      // 移除API Key相关的条件检查，所有模块都使用轻量级配置
      console.log(`🔧 配置模块 ${layerConfig.name} - 组装阶段轻量级配置`);
      console.log(`🔍 配置内容:`, JSON.stringify(layerConfig.config, null, 2));
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
      
      // 组装阶段：只创建模块实例，不进行初始化和启动
      // 初始化和启动应该在PipelineManager中的startPipeline()阶段进行
      assembledModule.isInitialized = false; // 组装完成但未初始化
      assembledModule.initializationTime = 0; // 将在启动时计算
      
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
   * 验证所有连接 - DEPRECATED: 移至运行时验证
   * @deprecated 连接验证应由PipelineManager在运行时进行
   */
  private async _validateAllConnections(pipelines: AssembledPipeline[]): Promise<void> {
    console.log(`⚠️ [DEPRECATED] _validateAllConnections called - 连接验证应由运行时模块处理`);
    console.log(`📋 跳过连接验证，组装阶段专注于配置组装`);
    
    // REFACTORED: 移除网络连接验证逻辑
    // 连接验证应该在PipelineManager.startPipeline()阶段进行
    return;
  }
  
  /**
   * 执行健康检查 - DEPRECATED: 移至独立健康检查模块
   * @deprecated 健康检查应由SelfCheckModule或独立健康检查服务处理
   */
  private async _performHealthChecks(pipelines: AssembledPipeline[]): Promise<ModuleHealthCheck[]> {
    console.log(`⚠️ [DEPRECATED] _performHealthChecks called - 健康检查应由独立模块处理`);
    console.log(`📋 跳过健康检查，组装阶段专注于配置组装，避免网络依赖`);
    
    // REFACTORED: 移除组装阶段的健康检查逻辑
    // 健康检查应该由以下模块负责：
    // 1. SelfCheckModule - 系统启动后的自检
    // 2. PipelineManager - 运行时健康监控  
    // 3. 独立的HealthCheckService - 定期健康检查
    
    return []; // 返回空数组，避免破坏现有接口
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