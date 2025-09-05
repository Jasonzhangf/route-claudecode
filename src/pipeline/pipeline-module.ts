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
import { PIPELINE_MODULE_VERSION } from './index';

// 定义流水线模块接口
export interface PipelineModuleInterface {
  manager: PipelineManager;
  initializer: UnifiedInitializer;
  scheduler: RuntimeScheduler;
  version: string;
}
import {
  ModuleInterface,
  ModuleType,
  ModuleStatus,
  ModuleMetrics,
  SimpleModuleAdapter,
} from '../interfaces/module/base-module';

/**
 * 流水线模块统一实现
 * 
 * 整合UnifiedInitializer、RuntimeScheduler和PipelineManager
 * 提供符合PipelineModuleInterface的统一接口
 */
export class PipelineModule implements PipelineModuleInterface, ModuleInterface {
  public readonly version: string = PIPELINE_MODULE_VERSION;
  
  private initializer: UnifiedInitializer;
  private scheduler: RuntimeScheduler;
  private pipelineManager: PipelineManager | null = null;
  private moduleAdapter: SimpleModuleAdapter;
  
  constructor(
    initializerConfig?: UnifiedInitializerConfig,
    schedulerConfig?: RuntimeSchedulerConfig
  ) {
    this.initializer = new UnifiedInitializer(initializerConfig);
    this.scheduler = new RuntimeScheduler(schedulerConfig);
    this.moduleAdapter = new SimpleModuleAdapter(
      'pipeline-module',
      'Pipeline Module',
      ModuleType.PIPELINE,
      PIPELINE_MODULE_VERSION
    );
  }

  // ModuleInterface implementations
  getId(): string { return this.moduleAdapter.getId(); }
  getName(): string { return this.moduleAdapter.getName(); }
  getType(): ModuleType { return this.moduleAdapter.getType(); }
  getVersion(): string { return this.moduleAdapter.getVersion(); }
  getModuleStatus(): ModuleStatus { return this.moduleAdapter.getStatus(); }
  getMetrics(): ModuleMetrics { return this.moduleAdapter.getMetrics(); }

  async configure(config: any): Promise<void> {
    await this.moduleAdapter.configure(config);
  }

  async start(): Promise<void> {
    await this.moduleAdapter.start();
  }

  async stop(): Promise<void> {
    await this.moduleAdapter.stop();
  }

  async reset(): Promise<void> {
    await this.moduleAdapter.reset();
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return this.moduleAdapter.healthCheck();
  }

  addConnection(module: ModuleInterface): void {
    this.moduleAdapter.addConnection(module);
  }

  removeConnection(moduleId: string): void {
    this.moduleAdapter.removeConnection(moduleId);
  }

  getConnection(moduleId: string): ModuleInterface | undefined {
    return this.moduleAdapter.getConnection(moduleId);
  }

  getConnections(): ModuleInterface[] {
    return this.moduleAdapter.getConnections();
  }

  async sendToModule(targetModuleId: string, message: any, type?: string): Promise<any> {
    return this.moduleAdapter.sendToModule(targetModuleId, message, type);
  }

  async broadcastToModules(message: any, type?: string): Promise<void> {
    await this.moduleAdapter.broadcastToModules(message, type);
  }

  onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void {
    this.moduleAdapter.onModuleMessage(listener);
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.moduleAdapter.on(event, listener);
  }

  removeAllListeners(): void {
    this.moduleAdapter.removeAllListeners();
  }

  async process(input: any): Promise<any> {
    return this.moduleAdapter.process(input);
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
    await this.moduleAdapter.cleanup();
    // PipelineManager和UnifiedInitializer的清理由它们自己管理
  }
}