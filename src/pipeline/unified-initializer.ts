/**
 * 统一初始化器 - Unified Initializer
 * 
 * RCC v4.0 架构重构核心组件
 * 
 * 设计理念：
 * - 一次性配置路由处理器和流水线组装器的合并实现
 * - 系统启动时执行一次性的初始化
 * - 与动态调度器完全分离的架构
 * - 职责单一原则
 * 
 * @author RCC v4.0 Architecture Team
 */

import { EventEmitter } from 'events';
import { ConfigPreprocessor, ConfigPreprocessResult } from '../config/config-preprocessor';
import { RouterPreprocessor, RouterPreprocessResult } from '../router/router-preprocessor';
import { RoutingTable } from '../config/routing-table-types';
import { PipelineManager } from '../pipeline/pipeline-manager';
import { StandardPipelineFactoryImpl, PipelineFactory } from '../pipeline/pipeline-factory';
import { secureLogger } from '../utils/secure-logger';
import { CompletePipeline } from '../pipeline/pipeline-manager-types';

/**
 * 统一初始化器配置接口
 */
export interface UnifiedInitializerConfig {
  /** 用户配置文件路径 */
  userConfigPath?: string;
  /** 系统配置文件路径 */
  systemConfigPath?: string;
  /** 调试模式 */
  debugEnabled?: boolean;
  /** CLI端口参数 */
  cliPort?: number;
}

/**
 * 初始化结果接口
 */
export interface InitializationResult {
  success: boolean;
  routingTable?: RoutingTable;
  pipelineManager?: PipelineManager;
  // lifecycleManager 已废弃，使用 UnifiedInitializer 自身管理生命周期
  completePipelines?: Map<string, CompletePipeline>;
  errors: string[];
  warnings: string[];
  stats: {
    configProcessingTime: number;
    routingProcessingTime: number;
    pipelineAssemblyTime: number;
    totalTime: number;
  };
}

/**
 * 统一初始化器错误类
 */
export class UnifiedInitializerError extends Error {
  constructor(
    message: string, 
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'UnifiedInitializerError';
  }
}

/**
 * 统一初始化器 - 合并配置路由和流水线组装功能
 * 
 * 职责：
 * 1. 一次性配置路由处理
 * 2. 流水线实例创建和组装
 * 3. 初始化状态管理
 * 4. 错误处理
 * 
 * 设计原则：
 * - 一次性执行：只在系统启动时运行一次
 * - 职责单一：专注于初始化，不处理运行时逻辑
 * - 与调度器分离：初始化完成后将控制权交给调度器
 */
export class UnifiedInitializer extends EventEmitter {
  
  private config: UnifiedInitializerConfig;
  private isInitialized: boolean = false;
  private startTime: number = 0;
  private stats: any = {};
  
  constructor(config: UnifiedInitializerConfig) {
    super();
    this.config = config;
    secureLogger.info('🏗️ 统一初始化器创建', {
      userConfigPath: config.userConfigPath,
      systemConfigPath: config.systemConfigPath,
      debugEnabled: config.debugEnabled,
      cliPort: config.cliPort
    });
  }
  
  /**
   * 一次性初始化方法 - 系统启动入口点
   * 
   * 执行完整的初始化流程：
   * 1. 配置预处理
   * 2. 路由预处理
   * 3. 流水线组装
   * 4. 生命周期管理器初始化
   * 
   * @param config 可选的初始化配置
   * @returns 初始化结果
   */
  async initialize(config?: UnifiedInitializerConfig): Promise<InitializationResult> {
    // 如果提供了配置，则更新内部配置
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    if (this.isInitialized) {
      throw new UnifiedInitializerError(
        '初始化器已执行初始化，不能重复执行', 
        'ALREADY_INITIALIZED'
      );
    }
    
    this.startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    secureLogger.info('🔧 [UnifiedInitializer] 开始系统初始化');
    
    try {
      // 1. 配置预处理
      const configStartTime = Date.now();
      const configResult = await this._processConfig();
      const configProcessingTime = Date.now() - configStartTime;
      
      if (!configResult.success) {
        throw new UnifiedInitializerError(
          `配置预处理失败: ${configResult.error?.message}`, 
          'CONFIG_PROCESSING_FAILED',
          configResult.error as any
        );
      }
      
      // 2. 路由预处理
      const routingStartTime = Date.now();
      const routingResult = await this._processRouting(configResult.routingTable!);
      const routingProcessingTime = Date.now() - routingStartTime;
      
      if (!routingResult.success) {
        throw new UnifiedInitializerError(
          `路由预处理失败: ${routingResult.errors.join(', ')}`, 
          'ROUTING_PROCESSING_FAILED'
        );
      }
      
      // 3. 流水线组装
      const pipelineStartTime = Date.now();
      const { completePipelines, pipelineManager } = await this._assemblePipelines(
        routingResult,
        configResult.routingTable!
      );
      const pipelineAssemblyTime = Date.now() - pipelineStartTime;
      
      const totalTime = Date.now() - this.startTime;
      
      this.isInitialized = true;
      
      secureLogger.info('✅ [UnifiedInitializer] 系统初始化完成', {
        totalTime: `${totalTime}ms`,
        configProcessingTime: `${configProcessingTime}ms`,
        routingProcessingTime: `${routingProcessingTime}ms`,
        pipelineAssemblyTime: `${pipelineAssemblyTime}ms`,
        pipelinesCount: completePipelines.size
      });
      
      return {
        success: true,
        routingTable: configResult.routingTable,
        pipelineManager,
        // lifecycleManager 已废弃，由 UnifiedInitializer 自身管理生命周期
        completePipelines,
        errors: [],
        warnings: [],
        stats: {
          configProcessingTime,
          routingProcessingTime,
          pipelineAssemblyTime,
          totalTime
        }
      };
      
    } catch (error) {
      const totalTime = Date.now() - this.startTime;
      
      secureLogger.error('❌ [UnifiedInitializer] 系统初始化失败', {
        errorMessage: error.message,
        errorStack: error.stack,
        totalTime: `${totalTime}ms`
      });
      
      return {
        success: false,
        errors: [error.message],
        warnings: [],
        stats: {
          configProcessingTime: 0,
          routingProcessingTime: 0,
          pipelineAssemblyTime: 0,
          totalTime
        }
      };
    }
  }
  
  /**
   * 配置预处理
   */
  private async _processConfig(): Promise<ConfigPreprocessResult> {
    secureLogger.debug('📋 开始配置预处理');
    
    try {
      const result = ConfigPreprocessor.preprocess(
        this.config.userConfigPath || './config.json'
      );
      
      if (!result.success) {
        secureLogger.error('❌ 配置预处理失败', result.error);
        return result;
      }
      
      secureLogger.info('✅ 配置预处理完成', {
        providersCount: result.routingTable?.providers.length,
        routesCount: result.routingTable ? Object.keys(result.routingTable.routes).length : 0
      });
      
      return result;
      
    } catch (error) {
      secureLogger.error('❌ 配置预处理异常', { error: error.message });
      throw new UnifiedInitializerError(
        `配置预处理异常: ${error.message}`,
        'CONFIG_PROCESSING_EXCEPTION',
        error
      );
    }
  }
  
  /**
   * 路由预处理
   */
  private async _processRouting(routingTable: RoutingTable): Promise<RouterPreprocessResult> {
    secureLogger.debug('🔄 开始路由预处理');
    
    try {
      const result = await RouterPreprocessor.preprocess(routingTable);
      
      if (!result.success) {
        secureLogger.error('❌ 路由预处理失败', { errors: result.errors });
        throw new UnifiedInitializerError(
          `路由预处理失败: ${result.errors.join(', ')}`,
          'ROUTING_PROCESSING_FAILED'
        );
      }
      
      secureLogger.info('✅ 路由预处理完成', result.stats);
      
      return result;
      
    } catch (error) {
      secureLogger.error('❌ 路由预处理异常', { error: error.message });
      throw new UnifiedInitializerError(
        `路由预处理异常: ${error.message}`,
        'ROUTING_PROCESSING_EXCEPTION',
        error
      );
    }
  }
  
  /**
   * 流水线组装
   */
  private async _assemblePipelines(
    routingResult: RouterPreprocessResult,
    routingTable: RoutingTable
  ): Promise<{
    completePipelines: Map<string, CompletePipeline>;
    pipelineManager: PipelineManager;
  }> {
    secureLogger.debug('🏗️ 开始流水线组装');
    
    try {
      // 创建标准流水线工厂
      const standardFactory = new StandardPipelineFactoryImpl();
      
      // 创建系统配置
      const systemConfig = {
        providerTypes: routingTable.providers.reduce((acc, provider) => {
          acc[provider.name] = {
            endpoint: provider.api_base_url,
            protocol: 'openai',
            transformer: 'anthropic-openai',
            serverCompatibility: provider.serverCompatibility?.use || provider.name,
            timeout: 60000,
            maxRetries: 3
          };
          return acc;
        }, {} as any)
      };
      
      // 创建PipelineManager
      const pipelineManager = new PipelineManager(standardFactory, systemConfig);
      
      // 使用路由表初始化PipelineManager
      if (routingResult.routingTable) {
        await pipelineManager.initializeFromRoutingTable(
          routingResult.routingTable as any,
          {
            name: 'unified-initializer-config',
            file: this.config.userConfigPath || 'default',
            port: this.config.cliPort
          }
        );
      }
      
      // 获取所有创建的完整流水线
      const completePipelines = pipelineManager.getAllPipelines();
      
      secureLogger.info('✅ 流水线组装完成', {
        pipelinesCount: completePipelines.size
      });
      
      return { completePipelines, pipelineManager };
      
    } catch (error) {
      secureLogger.error('❌ 流水线组装异常', { error: error.message });
      throw new UnifiedInitializerError(
        `流水线组装异常: ${error.message}`,
        'PIPELINE_ASSEMBLY_EXCEPTION',
        error
      );
    }
  }
  
  /**
   * 检查是否已初始化
   */
  private _checkInitialized(): void {
    if (!this.isInitialized) {
      throw new UnifiedInitializerError(
        '初始化器尚未执行初始化', 
        'NOT_INITIALIZED'
      );
    }
  }
  
  /**
   * 获取初始化器状态
   */
  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      config: this.config,
      stats: this.stats,
      startTime: this.startTime
    };
  }
}