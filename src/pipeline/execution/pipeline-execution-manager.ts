/**
 * 流水线执行管理器 - 统一的流水线执行协调器
 * 
 * 职责：
 * 1. 整合ErrorClassifier、PipelineHealthManager、LoadBalancer
 * 2. 实现错误驱动的负载均衡策略
 * 3. 处理流水线重试、跳过、拉黑逻辑
 * 4. 确保只有在没有流水线可用时才报错
 * 
 * 核心原理：错误返回给负载均衡管理进行重试和流水线关闭/拉黑/跳过
 * 
 * @author RCC v4.0 - Pipeline Execution Architecture
 */

import { secureLogger } from '../../utils/secure-logger';
import { ErrorClassifier, ErrorAction, ErrorContext } from './error-classifier';
import { PipelineHealthManager } from './pipeline-health-manager';
import { LoadBalancer } from '../../router/load-balancer';

export interface ExecutionRequest {
  input: any;
  context: {
    requestId: string;
    maxRetries?: number;
    timeout?: number;
  };
}

export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: PipelineExecutionError;
  pipelineId?: string;
  attempts: ExecutionAttempt[];
  totalTime: number;
  finalStatus: 'success' | 'failed' | 'no_pipelines_available';
}

export interface ExecutionAttempt {
  pipelineId: string;
  attempt: number;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  data?: any;
  error?: PipelineExecutionError;
  errorAction?: ErrorAction;
  skipped?: boolean;
}

export interface PipelineExecutionConfig {
  maxRetries: number;
  maxExecutionTime: number; // 总执行超时时间
  retryDelay: number; // 基础重试延迟
  enableHealthManagement: boolean;
  enableErrorClassification: boolean;
}

/**
 * 流水线执行错误类
 */
export class PipelineExecutionError extends Error {
  public readonly type: string;
  public readonly pipelineId?: string;
  public readonly requestId?: string;
  public readonly statusCode?: number;
  
  constructor(message: string, type: string, pipelineId?: string, requestId?: string, statusCode?: number) {
    super(message);
    this.name = 'PipelineExecutionError';
    this.type = type;
    this.pipelineId = pipelineId;
    this.requestId = requestId;
    this.statusCode = statusCode;
  }
}

/**
 * 没有可用流水线错误
 */
export class NoPipelinesAvailableError extends PipelineExecutionError {
  constructor(message: string, requestId?: string) {
    super(message, 'NO_PIPELINES_AVAILABLE', undefined, requestId);
    this.name = 'NoPipelinesAvailableError';
  }
}

/**
 * 流水线超时错误
 */
export class PipelineTimeoutError extends PipelineExecutionError {
  constructor(message: string, pipelineId?: string, requestId?: string) {
    super(message, 'PIPELINE_TIMEOUT', pipelineId, requestId);
    this.name = 'PipelineTimeoutError';
  }
}

/**
 * 流水线执行管理器
 * 核心协调器，集成错误处理与负载均衡
 */
export class PipelineExecutionManager {
  private errorClassifier: ErrorClassifier;
  private healthManager: PipelineHealthManager;
  private loadBalancer: LoadBalancer;
  private config: PipelineExecutionConfig;
  
  constructor(
    errorClassifier: ErrorClassifier,
    healthManager: PipelineHealthManager,
    loadBalancer: LoadBalancer,
    config: Partial<PipelineExecutionConfig> = {}
  ) {
    this.errorClassifier = errorClassifier;
    this.healthManager = healthManager;
    this.loadBalancer = loadBalancer;
    this.config = {
      maxRetries: 3,
      maxExecutionTime: 30000, // 30秒总超时
      retryDelay: 1000, // 1秒基础延迟
      enableHealthManagement: true,
      enableErrorClassification: true,
      ...config
    };
  }
  
  /**
   * 执行流水线请求 - 主要入口点
   * 
   * 核心逻辑：
   * 1. 获取健康的流水线列表
   * 2. 使用LoadBalancer选择流水线
   * 3. 执行请求，如果失败则分类错误
   * 4. 根据错误类型决定：重试/跳过/拉黑
   * 5. 重复直到成功或没有可用流水线
   */
  public async execute(
    request: ExecutionRequest,
    executeFunction: (pipelineId: string, input: any) => Promise<any>,
    getAllPipelinesFunction: () => string[]
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const attempts: ExecutionAttempt[] = [];
    let globalAttempt = 0;
    
    secureLogger.info('Pipeline execution started', {
      requestId: request.context.requestId,
      maxRetries: this.config.maxRetries
    });
    
    while (globalAttempt < this.config.maxRetries) {
      // 检查总执行时间
      if (Date.now() - startTime > this.config.maxExecutionTime) {
        secureLogger.warn('Pipeline execution timeout - exceeding max execution time', {
          requestId: request.context.requestId,
          totalTime: Date.now() - startTime,
          maxExecutionTime: this.config.maxExecutionTime
        });
        break;
      }
      
      // 获取所有流水线并筛选健康的流水线
      const allPipelines = getAllPipelinesFunction();
      const healthyPipelines = this.config.enableHealthManagement 
        ? this.healthManager.getHealthyPipelines(allPipelines)
        : allPipelines;
      
      if (healthyPipelines.length === 0) {
        secureLogger.warn('No healthy pipelines available', {
          requestId: request.context.requestId,
          totalPipelines: allPipelines.length,
          globalAttempt,
          attempts: attempts.length
        });
        
        return {
          success: false,
          error: new NoPipelinesAvailableError(
            'No healthy pipelines available for execution',
            request.context.requestId
          ),
          attempts,
          totalTime: Date.now() - startTime,
          finalStatus: 'no_pipelines_available'
        };
      }
      
      // 使用LoadBalancer选择流水线
      let selectedPipeline: string;
      try {
        selectedPipeline = this.loadBalancer.selectPipeline(healthyPipelines);
      } catch (loadBalancerError) {
        secureLogger.error('Load balancer failed to select pipeline', {
          requestId: request.context.requestId,
          error: (loadBalancerError as Error).message,
          healthyPipelines
        });
        
        // 如果负载均衡器失败，使用第一个健康流水线
        selectedPipeline = healthyPipelines[0];
      }
      
      // 执行单个流水线请求
      const executionResult = await this.executeSinglePipeline(
        selectedPipeline,
        request,
        executeFunction,
        globalAttempt
      );
      
      attempts.push(executionResult);
      
      // 如果执行成功
      if (executionResult.success) {
        if (this.config.enableHealthManagement) {
          this.healthManager.recordSuccess(selectedPipeline, executionResult.duration);
        }
        
        secureLogger.info('Pipeline execution succeeded', {
          requestId: request.context.requestId,
          pipelineId: selectedPipeline,
          totalAttempts: attempts.length,
          totalTime: Date.now() - startTime
        });
        
        return {
          success: true,
          data: executionResult.data,
          pipelineId: selectedPipeline,
          attempts,
          totalTime: Date.now() - startTime,
          finalStatus: 'success'
        };
      }
      
      // 执行失败，记录失败并分析错误
      if (this.config.enableHealthManagement) {
        this.healthManager.recordFailure(selectedPipeline, executionResult.error!);
      }
      
      // 使用ErrorClassifier分析错误并决定下一步行动
      const errorAction = this.config.enableErrorClassification 
        ? this.errorClassifier.classifyError(executionResult.error!, {
            pipelineId: selectedPipeline,
            attempt: globalAttempt,
            maxRetries: this.config.maxRetries,
            requestId: request.context.requestId
          })
        : { type: 'SKIP_PIPELINE' as const, reason: 'error_classification_disabled' };
      
      executionResult.errorAction = errorAction;
      
      // 根据错误动作处理流水线
      await this.handleErrorAction(errorAction, selectedPipeline, request.context.requestId);
      
      // 决定是否继续尝试
      if (errorAction.type === 'FATAL_ERROR') {
        secureLogger.error('Fatal error encountered, stopping execution', {
          requestId: request.context.requestId,
          pipelineId: selectedPipeline,
          errorReason: errorAction.reason,
          totalAttempts: attempts.length
        });
        break;
      }
      
      // 如果是重试同一流水线，不增加全局尝试计数
      if (errorAction.type === 'RETRY_SAME_PIPELINE') {
        // 等待重试延迟
        if (errorAction.retryAfter) {
          await this.delay(errorAction.retryAfter);
        }
        // 不增加globalAttempt，直接重试同一流水线
      } else {
        // 跳过流水线或拉黑流水线，增加全局尝试计数
        globalAttempt++;
      }
      
      secureLogger.info('Pipeline execution attempt completed', {
        requestId: request.context.requestId,
        pipelineId: selectedPipeline,
        success: false,
        errorAction: errorAction.type,
        globalAttempt,
        willContinue: globalAttempt < this.config.maxRetries
      });
    }
    
    // 所有尝试都失败了
    secureLogger.error('Pipeline execution failed after all attempts', {
      requestId: request.context.requestId,
      totalAttempts: attempts.length,
      globalAttempts: globalAttempt,
      totalTime: Date.now() - startTime
    });
    
    return {
      success: false,
      error: new PipelineExecutionError(
        `Pipeline execution failed after ${attempts.length} attempts`,
        'MAX_RETRIES_EXCEEDED',
        undefined,
        request.context.requestId
      ),
      attempts,
      totalTime: Date.now() - startTime,
      finalStatus: 'failed'
    };
  }
  
  /**
   * 执行单个流水线
   */
  private async executeSinglePipeline(
    pipelineId: string,
    request: ExecutionRequest,
    executeFunction: (pipelineId: string, input: any) => Promise<any>,
    globalAttempt: number
  ): Promise<ExecutionAttempt> {
    const startTime = Date.now();
    
    secureLogger.info('Executing single pipeline', {
      requestId: request.context.requestId,
      pipelineId,
      globalAttempt
    });
    
    try {
      const result = await executeFunction(pipelineId, request.input);
      const endTime = Date.now();
      
      return {
        pipelineId,
        attempt: globalAttempt,
        startTime,
        endTime,
        duration: endTime - startTime,
        success: true,
        data: result
      };
      
    } catch (executionError) {
      const endTime = Date.now();
      const error = executionError as Error;
      
      secureLogger.warn('Pipeline execution failed', {
        requestId: request.context.requestId,
        pipelineId,
        globalAttempt,
        error: error.message,
        duration: endTime - startTime
      });
      
      // 包装为PipelineExecutionError
      const wrappedError = new PipelineExecutionError(
        error.message,
        'EXECUTION_FAILED',
        pipelineId,
        request.context.requestId
      );
      
      return {
        pipelineId,
        attempt: globalAttempt,
        startTime,
        endTime,
        duration: endTime - startTime,
        success: false,
        error: wrappedError
      };
    }
  }
  
  /**
   * 处理错误动作
   */
  private async handleErrorAction(
    errorAction: ErrorAction,
    pipelineId: string,
    requestId: string
  ): Promise<void> {
    switch (errorAction.type) {
      case 'BLACKLIST_PIPELINE':
        if (this.config.enableHealthManagement && errorAction.duration) {
          this.healthManager.blacklistPipeline(pipelineId, errorAction.duration, errorAction.reason);
          secureLogger.info('Pipeline blacklisted', {
            requestId,
            pipelineId,
            duration: errorAction.duration,
            reason: errorAction.reason
          });
        }
        break;
        
      case 'SKIP_PIPELINE':
        secureLogger.info('Pipeline skipped', {
          requestId,
          pipelineId,
          reason: errorAction.reason
        });
        // 跳过流水线不需要特殊处理，下次循环会选择其他流水线
        break;
        
      case 'RETRY_SAME_PIPELINE':
        secureLogger.info('Pipeline will be retried', {
          requestId,
          pipelineId,
          reason: errorAction.reason,
          retryAfter: errorAction.retryAfter
        });
        break;
        
      case 'FATAL_ERROR':
        secureLogger.error('Fatal error, execution will be stopped', {
          requestId,
          pipelineId,
          reason: errorAction.reason
        });
        break;
    }
  }
  
  /**
   * 延迟函数
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 获取执行统计
   */
  public getExecutionStats() {
    return {
      healthStats: this.config.enableHealthManagement 
        ? this.healthManager.getAllHealthStats()
        : new Map(),
      blacklistStatus: this.config.enableHealthManagement 
        ? this.healthManager.getBlacklistStatus()
        : new Map(),
      loadBalancingStats: this.loadBalancer.getLoadBalancingStats()
    };
  }
  
  /**
   * 重置统计信息
   */
  public resetStats(): void {
    if (this.config.enableHealthManagement) {
      this.healthManager.resetStats();
    }
    this.loadBalancer.resetStats();
    
    secureLogger.info('Pipeline execution manager stats reset');
  }
  
  /**
   * 停止执行管理器
   */
  public stop(): void {
    this.loadBalancer.stop();
    secureLogger.info('Pipeline execution manager stopped');
  }
}