/**
 * 流水线模块统一接口实现
 * 
 * RCC v4.0 架构重构核心组件
 * 提供统一的流水线模块接口实现
 * 
 * @author RCC v4.0 Architecture Team
 */

import { UnifiedInitializer, UnifiedInitializerConfig, InitializationResult } from './unified-initializer';
import { RuntimeScheduler, RuntimeSchedulerConfig, ScheduleRequest, ScheduleResponse } from './runtime-scheduler';
import { PipelineManager } from './pipeline-manager';
import { PipelineModuleInterface } from './index';
import { PIPELINE_MODULE_VERSION } from './index';

/**
 * 流水线模块统一实现
 * 
 * 整合UnifiedInitializer、RuntimeScheduler和PipelineManager
 * 提供符合PipelineModuleInterface的统一接口
 */
export class PipelineModule implements PipelineModuleInterface {
  public readonly version: string = PIPELINE_MODULE_VERSION;
  
  private initializer: UnifiedInitializer;
  private scheduler: RuntimeScheduler;
  private pipelineManager: PipelineManager | null = null;
  
  constructor(
    initializerConfig?: UnifiedInitializerConfig,
    schedulerConfig?: RuntimeSchedulerConfig
  ) {
    this.initializer = new UnifiedInitializer(initializerConfig);
    this.scheduler = new RuntimeScheduler(schedulerConfig);
  }
  
  /**
   * 初始化流水线系统
   * 
   * @param config 初始化配置
   * @returns 初始化结果
   */
  async initialize(config?: UnifiedInitializerConfig): Promise<InitializationResult> {
    const result = await this.initializer.initialize(config);
    
    if (result.success && result.pipelineManager) {
      this.pipelineManager = result.pipelineManager;
      
      // 注册所有流水线到调度器
      if (result.completePipelines) {
        for (const [pipelineId, pipeline] of result.completePipelines) {
          this.scheduler.registerPipeline(pipeline, pipeline.virtualModel);
        }
      }
    }
    
    return result;
  }
  
  /**
   * 调度请求
   * 
   * @param request 调度请求
   * @returns 调度响应
   */
  async schedule(request: ScheduleRequest): Promise<ScheduleResponse> {
    return this.scheduler.scheduleRequest(request);
  }
  
  /**
   * 获取模块状态
   * 
   * @returns 模块状态信息
   */
  getStatus(): any {
    const initializerStatus = this.initializer.getStatus();
    const schedulerStatus = this.scheduler.getStatus();
    const pipelineManagerStatus = this.pipelineManager ? this.pipelineManager.getStatus() : null;
    
    return {
      version: this.version,
      initializer: initializerStatus,
      scheduler: schedulerStatus,
      pipelineManager: pipelineManagerStatus,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * 清理模块资源
   */
  async cleanup(): Promise<void> {
    await this.scheduler.cleanup();
    // PipelineManager和UnifiedInitializer的清理由它们自己管理
  }
}