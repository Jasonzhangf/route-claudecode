/**
 * 智能错误恢复模块 (占位符)
 * 
 * 注意：由于零Fallback策略，此模块已被禁用
 * 所有智能流水线切换功能都被零Fallback策略覆盖
 * 
 * @module IntelligentErrorRecovery
 * @version 4.0.0-disabled
 * @status DEPRECATED - 被零Fallback策略取代
 */

/**
 * 流水线恢复上下文接口
 */
export interface PipelineRecoveryContext {
  readonly requestId: string;
  readonly originalRequest: any;
  readonly routingDecision: any;
  readonly failedPipelineId: string;
  readonly error: any;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly startTime: number;
  readonly errorChain: any[];
}

/**
 * 错误恢复结果接口
 */
export interface ErrorRecoveryResult {
  readonly success: boolean;
  readonly recoveredPipelineId?: string;
  readonly response?: any;
  readonly error?: any;
  readonly recoveryTime: number;
  readonly retryAttempt: number;
}

/**
 * 智能错误恢复管理器 (已禁用)
 * 
 * 在零Fallback策略下，此类不执行任何恢复操作
 * 所有错误都会立即抛出，不进行智能切换
 */
export class IntelligentErrorRecoveryManager {
  constructor() {
    // 空构造函数 - 零Fallback策略下不需要初始化
  }

  /**
   * 尝试智能错误恢复 (已禁用)
   * 
   * @param context 恢复上下文
   * @param executeRequest 请求执行函数
   * @returns 永远返回失败，因为零Fallback策略
   */
  async attemptIntelligentRecovery(
    context: PipelineRecoveryContext,
    executeRequest: (pipelineId: string) => Promise<any>
  ): Promise<ErrorRecoveryResult> {
    // 零Fallback策略：不进行任何恢复尝试
    return {
      success: false,
      error: new Error('Intelligent recovery disabled by Zero Fallback Policy'),
      recoveryTime: 0,
      retryAttempt: 0
    };
  }

  /**
   * 初始化恢复管理器 (空操作)
   */
  async initialize(): Promise<void> {
    // 空操作 - 零Fallback策略下不需要初始化
  }

  /**
   * 关闭恢复管理器 (空操作)
   */
  async shutdown(): Promise<void> {
    // 空操作
  }
}