/**
 * 智能流水线切换系统
 * 
 * 核心功能：
 * 1. 错误分类：可恢复 vs 不可恢复
 * 2. 流水线切换：自动切换到替代流水线
 * 3. 流水线销毁：拉黑并销毁有问题的流水线
 * 4. 负载均衡集成：与负载均衡器协作进行流水线管理
 * 
 * 零容错原则：所有错误必须得到处理，要么切换流水线，要么立即失败
 * 
 * @author RCC v4.0 Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { secureLogger } from '../utils/secure-logger';

// =============================================================================
// 错误分类系统
// =============================================================================

/**
 * 错误可恢复性枚举
 */
export enum ErrorRecoverability {
  /** 可恢复错误 - 直接切换流水线重试 */
  RECOVERABLE = 'recoverable',
  /** 不可恢复错误 - 拉黑并销毁流水线 */
  NON_RECOVERABLE = 'non_recoverable',
  /** 终端错误 - 返回给客户端，不切换流水线 */
  TERMINAL = 'terminal'
}

/**
 * 流水线状态枚举
 */
export enum PipelineStatus {
  /** 健康状态 - 可以接收请求 */
  HEALTHY = 'healthy',
  /** 临时阻塞 - 暂时不可用但可能恢复 */
  TEMPORARILY_BLOCKED = 'temporarily_blocked',
  /** 已拉黑 - 永久不可用，需要销毁 */
  BLACKLISTED = 'blacklisted',
  /** 已销毁 - 完全移除，不再使用 */
  DESTROYED = 'destroyed'
}

/**
 * 错误分类规则接口
 */
export interface ErrorClassificationRule {
  /** 规则名称 */
  name: string;
  /** 状态码匹配 */
  statusCodes?: number[];
  /** 错误消息关键词匹配 */
  messageKeywords?: string[];
  /** 错误类型匹配 */
  errorTypes?: string[];
  /** 可恢复性分类 */
  recoverability: ErrorRecoverability;
  /** 规则优先级 (数字越小优先级越高) */
  priority: number;
  /** 规则说明 */
  description: string;
}

/**
 * 流水线切换策略接口
 */
export interface PipelineSwitchStrategy {
  /** 策略名称 */
  name: string;
  /** 选择下一个流水线 */
  selectNextPipeline(
    failedPipelineId: string,
    availablePipelines: string[],
    context: PipelineRecoveryContext
  ): string | null;
}

/**
 * 流水线恢复上下文
 */
export interface PipelineRecoveryContext {
  /** 请求ID */
  requestId: string;
  /** 原始请求 */
  originalRequest: any;
  /** 路由决策 */
  routingDecision: any;
  /** 失败的流水线ID */
  failedPipelineId: string;
  /** 错误信息 */
  error: any;
  /** 错误分类结果 */
  errorClassification?: ErrorClassificationResult;
  /** 重试次数 */
  retryCount: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 开始时间 */
  startTime: number;
}

/**
 * 错误分类结果
 */
export interface ErrorClassificationResult {
  /** 可恢复性 */
  recoverability: ErrorRecoverability;
  /** 匹配的规则 */
  matchedRule: ErrorClassificationRule;
  /** 分类信心度 (0-1) */
  confidence: number;
  /** 分类原因 */
  reason: string;
}

/**
 * 流水线恢复结果
 */
export interface PipelineRecoveryResult {
  /** 是否成功恢复 */
  success: boolean;
  /** 使用的新流水线ID */
  newPipelineId?: string;
  /** 执行的恢复动作 */
  recoveryAction: 'switched' | 'destroyed' | 'terminal' | 'failed';
  /** 恢复响应 */
  response?: any;
  /** 恢复耗时 */
  recoveryTime: number;
  /** 恢复详情 */
  details: string;
}

/**
 * 流水线恢复配置
 */
export interface PipelineRecoveryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 拉黑阈值 (连续失败多少次后拉黑) */
  blacklistThreshold: number;
  /** 临时阻塞持续时间 (毫秒) */
  temporaryBlockDuration: number;
  /** 恢复超时时间 (毫秒) */
  recoveryTimeout: number;
  /** 启用激进恢复 (更快的切换) */
  enableAggressiveRecovery: boolean;
  /** 启用流水线销毁 */
  enablePipelineDestroy: boolean;
}

// =============================================================================
// 智能流水线切换系统主类
// =============================================================================

/**
 * 智能流水线切换系统
 * 
 * 实现零容错的流水线错误处理：
 * - 可恢复错误：立即切换到其他可用流水线
 * - 不可恢复错误：拉黑当前流水线，切换到其他流水线
 * - 终端错误：直接返回错误给客户端
 */
export class IntelligentPipelineSwitching extends EventEmitter {
  private errorClassificationRules: ErrorClassificationRule[] = [];
  private pipelineStatuses: Map<string, PipelineStatus> = new Map();
  private pipelineFailureCounts: Map<string, number> = new Map();
  private pipelineLastFailure: Map<string, number> = new Map();
  private switchStrategy: PipelineSwitchStrategy;
  private config: PipelineRecoveryConfig;

  constructor(config: Partial<PipelineRecoveryConfig> = {}) {
    super();
    
    this.config = {
      maxRetries: 3,
      blacklistThreshold: 5, // 连续失败5次后拉黑
      temporaryBlockDuration: 30000, // 临时阻塞30秒
      recoveryTimeout: 120000, // 恢复超时2分钟
      enableAggressiveRecovery: true,
      enablePipelineDestroy: true,
      ...config
    };

    this.initializeDefaultRules();
    this.initializeDefaultStrategy();
    
    secureLogger.info('🚀 智能流水线切换系统已初始化', {
      maxRetries: this.config.maxRetries,
      blacklistThreshold: this.config.blacklistThreshold,
      enableAggressiveRecovery: this.config.enableAggressiveRecovery
    });
  }

  /**
   * 初始化默认错误分类规则
   */
  private initializeDefaultRules(): void {
    this.errorClassificationRules = [
      // 可恢复错误 - 网络和临时问题
      {
        name: 'network-timeout',
        statusCodes: [408, 503, 504],
        messageKeywords: ['timeout', 'connection reset', 'network error'],
        recoverability: ErrorRecoverability.RECOVERABLE,
        priority: 1,
        description: '网络超时或连接问题 - 可通过切换流水线恢复'
      },
      {
        name: 'rate-limiting',
        statusCodes: [429],
        messageKeywords: ['rate limit', 'too many requests'],
        recoverability: ErrorRecoverability.RECOVERABLE,
        priority: 2,
        description: '流控限制 - 可切换到其他流水线'
      },
      {
        name: 'server-overload',
        statusCodes: [502, 503],
        messageKeywords: ['server overload', 'temporary unavailable', 'bad gateway'],
        recoverability: ErrorRecoverability.RECOVERABLE,
        priority: 3,
        description: '服务器过载 - 可切换流水线'
      },
      
      // 不可恢复错误 - 需要拉黑流水线
      {
        name: 'authentication-error',
        statusCodes: [401, 403],
        messageKeywords: ['authentication', 'unauthorized', 'forbidden', 'invalid key'],
        recoverability: ErrorRecoverability.NON_RECOVERABLE,
        priority: 1,
        description: '认证错误 - 需要拉黑流水线'
      },
      {
        name: 'model-not-found',
        statusCodes: [404],
        messageKeywords: ['model not found', 'not available', 'does not exist'],
        recoverability: ErrorRecoverability.NON_RECOVERABLE,
        priority: 2,
        description: '模型不存在 - 需要拉黑流水线'
      },
      {
        name: 'server-internal-error',
        statusCodes: [500],
        messageKeywords: ['internal server error', 'unexpected error'],
        recoverability: ErrorRecoverability.NON_RECOVERABLE,
        priority: 3,
        description: '服务器内部错误 - 需要拉黑流水线'
      },
      
      // 终端错误 - 返回给客户端
      {
        name: 'client-error',
        statusCodes: [400, 413, 414, 415],
        messageKeywords: ['bad request', 'payload too large', 'unsupported media type'],
        recoverability: ErrorRecoverability.TERMINAL,
        priority: 1,
        description: '客户端错误 - 返回给客户端处理'
      }
    ];

    // 按优先级排序
    this.errorClassificationRules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 初始化默认切换策略
   */
  private initializeDefaultStrategy(): void {
    this.switchStrategy = {
      name: 'priority-based-switch',
      selectNextPipeline: (failedPipelineId, availablePipelines, context) => {
        // 过滤掉失败的流水线和已拉黑的流水线
        const healthyPipelines = availablePipelines.filter(pipelineId => {
          if (pipelineId === failedPipelineId) return false;
          const status = this.pipelineStatuses.get(pipelineId);
          return !status || status === PipelineStatus.HEALTHY;
        });

        if (healthyPipelines.length === 0) {
          return null;
        }

        // 优先选择失败次数最少的流水线
        const pipelineFailures = healthyPipelines.map(id => ({
          id,
          failures: this.pipelineFailureCounts.get(id) || 0,
          lastFailure: this.pipelineLastFailure.get(id) || 0
        }));

        // 按失败次数和最近失败时间排序
        pipelineFailures.sort((a, b) => {
          if (a.failures !== b.failures) {
            return a.failures - b.failures;
          }
          return a.lastFailure - b.lastFailure; // 更早失败的优先
        });

        return pipelineFailures[0].id;
      }
    };
  }

  /**
   * 执行流水线切换恢复
   */
  async executePipelineSwitching(
    error: any,
    context: PipelineRecoveryContext,
    executeRequest: (pipelineId: string) => Promise<any>
  ): Promise<PipelineRecoveryResult> {
    const startTime = Date.now();
    
    secureLogger.info('🔄 开始流水线错误恢复', {
      requestId: context.requestId,
      failedPipelineId: context.failedPipelineId,
      retryCount: context.retryCount,
      errorMessage: error.message
    });

    // 1. 错误分类
    const errorClassification = this.classifyError(error);
    context.errorClassification = errorClassification;

    secureLogger.info('🎯 错误分类完成', {
      requestId: context.requestId,
      recoverability: errorClassification.recoverability,
      matchedRule: errorClassification.matchedRule.name,
      confidence: errorClassification.confidence
    });

    // 2. 根据错误类型执行相应的恢复策略
    let result: PipelineRecoveryResult;

    switch (errorClassification.recoverability) {
      case ErrorRecoverability.RECOVERABLE:
        result = await this.handleRecoverableError(context, executeRequest);
        break;
      
      case ErrorRecoverability.NON_RECOVERABLE:
        result = await this.handleNonRecoverableError(context, executeRequest);
        break;
      
      case ErrorRecoverability.TERMINAL:
        result = this.handleTerminalError(context);
        break;
      
      default:
        result = this.handleUnknownError(context);
    }

    result.recoveryTime = Date.now() - startTime;

    // 3. 触发相应事件
    this.emit('pipeline-recovery', {
      requestId: context.requestId,
      failedPipelineId: context.failedPipelineId,
      result,
      errorClassification
    });

    secureLogger.info('✅ 流水线恢复完成', {
      requestId: context.requestId,
      success: result.success,
      recoveryAction: result.recoveryAction,
      newPipelineId: result.newPipelineId,
      recoveryTime: result.recoveryTime
    });

    return result;
  }

  /**
   * 处理可恢复错误 - 直接切换流水线重试
   */
  private async handleRecoverableError(
    context: PipelineRecoveryContext,
    executeRequest: (pipelineId: string) => Promise<any>
  ): Promise<PipelineRecoveryResult> {
    // 记录失败
    this.recordPipelineFailure(context.failedPipelineId);

    // 检查是否达到临时阻塞阈值
    const failureCount = this.pipelineFailureCounts.get(context.failedPipelineId) || 0;
    if (failureCount >= this.config.blacklistThreshold / 2) {
      this.temporarilyBlockPipeline(context.failedPipelineId);
    }

    // 获取可用流水线列表
    const availablePipelines = this.getAvailablePipelines(context.routingDecision);
    
    // 选择下一个流水线
    const nextPipelineId = this.switchStrategy.selectNextPipeline(
      context.failedPipelineId,
      availablePipelines,
      context
    );

    if (!nextPipelineId) {
      return {
        success: false,
        recoveryAction: 'failed',
        recoveryTime: 0,
        details: '无可用的健康流水线进行切换'
      };
    }

    try {
      // 切换到新流水线并重试请求
      secureLogger.info('🔀 切换流水线重试', {
        requestId: context.requestId,
        fromPipeline: context.failedPipelineId,
        toPipeline: nextPipelineId,
        retryCount: context.retryCount + 1
      });

      // 执行请求
      const response = await executeRequest(nextPipelineId);

      // 成功后重置失败计数
      this.pipelineFailureCounts.set(nextPipelineId, 0);

      return {
        success: true,
        newPipelineId: nextPipelineId,
        recoveryAction: 'switched',
        response,
        recoveryTime: 0, // 将在外部计算
        details: `成功切换到流水线 ${nextPipelineId}`
      };

    } catch (switchError) {
      secureLogger.error('❌ 流水线切换失败', {
        requestId: context.requestId,
        newPipelineId: nextPipelineId,
        error: switchError.message
      });

      // 记录新流水线的失败
      this.recordPipelineFailure(nextPipelineId);

      // 如果还有重试机会，递归尝试
      if (context.retryCount + 1 < context.maxRetries) {
        const newContext = {
          ...context,
          failedPipelineId: nextPipelineId,
          retryCount: context.retryCount + 1,
          error: switchError
        };
        
        return await this.executePipelineSwitching(switchError, newContext, executeRequest);
      }

      return {
        success: false,
        recoveryAction: 'failed',
        recoveryTime: 0,
        details: `所有流水线切换尝试均失败`
      };
    }
  }

  /**
   * 处理不可恢复错误 - 拉黑并销毁流水线
   */
  private async handleNonRecoverableError(
    context: PipelineRecoveryContext,
    executeRequest: (pipelineId: string) => Promise<any>
  ): Promise<PipelineRecoveryResult> {
    // 立即拉黑流水线
    this.blacklistPipeline(context.failedPipelineId, context.errorClassification!.reason);

    // 触发流水线销毁事件
    if (this.config.enablePipelineDestroy) {
      this.emit('pipeline-destroy', {
        pipelineId: context.failedPipelineId,
        reason: `不可恢复错误: ${context.errorClassification!.reason}`,
        requestId: context.requestId,
        timestamp: Date.now()
      });
    }

    // 切换到其他可用流水线
    const availablePipelines = this.getAvailablePipelines(context.routingDecision);
    const nextPipelineId = this.switchStrategy.selectNextPipeline(
      context.failedPipelineId,
      availablePipelines,
      context
    );

    if (!nextPipelineId) {
      return {
        success: false,
        recoveryAction: 'destroyed',
        recoveryTime: 0,
        details: '流水线已销毁，但无其他可用流水线'
      };
    }

    try {
      secureLogger.info('💥 销毁故障流水线并切换', {
        requestId: context.requestId,
        destroyedPipeline: context.failedPipelineId,
        newPipeline: nextPipelineId,
        reason: context.errorClassification!.reason
      });

      // 执行请求
      const response = await executeRequest(nextPipelineId);

      return {
        success: true,
        newPipelineId: nextPipelineId,
        recoveryAction: 'destroyed',
        response,
        recoveryTime: 0,
        details: `已销毁流水线 ${context.failedPipelineId}，切换到 ${nextPipelineId}`
      };

    } catch (switchError) {
      return {
        success: false,
        recoveryAction: 'destroyed',
        recoveryTime: 0,
        details: `流水线已销毁，但切换到新流水线 ${nextPipelineId} 也失败了`
      };
    }
  }

  /**
   * 处理终端错误 - 返回给客户端
   */
  private handleTerminalError(context: PipelineRecoveryContext): PipelineRecoveryResult {
    secureLogger.info('⚠️ 终端错误，返回给客户端', {
      requestId: context.requestId,
      reason: context.errorClassification!.reason
    });

    return {
      success: false,
      recoveryAction: 'terminal',
      recoveryTime: 0,
      details: `终端错误，无法恢复: ${context.errorClassification!.reason}`
    };
  }

  /**
   * 处理未知错误
   */
  private handleUnknownError(context: PipelineRecoveryContext): PipelineRecoveryResult {
    return {
      success: false,
      recoveryAction: 'failed',
      recoveryTime: 0,
      details: '未知错误类型，无法确定恢复策略'
    };
  }

  /**
   * 错误分类
   */
  private classifyError(error: any): ErrorClassificationResult {
    const statusCode = error.status || error.statusCode || 0;
    const errorMessage = (error.message || '').toLowerCase();
    const errorType = error.constructor?.name || 'UnknownError';

    // 遍历分类规则，找到最匹配的
    for (const rule of this.errorClassificationRules) {
      let matches = 0;
      let totalCriteria = 0;

      // 检查状态码匹配
      if (rule.statusCodes) {
        totalCriteria++;
        if (rule.statusCodes.includes(statusCode)) {
          matches++;
        }
      }

      // 检查关键词匹配
      if (rule.messageKeywords) {
        totalCriteria++;
        if (rule.messageKeywords.some(keyword => 
          errorMessage.includes(keyword.toLowerCase()))) {
          matches++;
        }
      }

      // 检查错误类型匹配
      if (rule.errorTypes) {
        totalCriteria++;
        if (rule.errorTypes.includes(errorType)) {
          matches++;
        }
      }

      // 计算匹配度
      const confidence = totalCriteria > 0 ? matches / totalCriteria : 0;

      // 如果匹配度 >= 50%，使用此规则
      if (confidence >= 0.5) {
        return {
          recoverability: rule.recoverability,
          matchedRule: rule,
          confidence,
          reason: `${rule.description} (匹配度: ${Math.round(confidence * 100)}%)`
        };
      }
    }

    // 如果没有规则匹配，默认为可恢复错误
    return {
      recoverability: ErrorRecoverability.RECOVERABLE,
      matchedRule: {
        name: 'default',
        recoverability: ErrorRecoverability.RECOVERABLE,
        priority: 999,
        description: '默认分类规则'
      },
      confidence: 0.1,
      reason: '未匹配任何具体规则，使用默认可恢复分类'
    };
  }

  /**
   * 记录流水线失败
   */
  private recordPipelineFailure(pipelineId: string): void {
    const currentCount = this.pipelineFailureCounts.get(pipelineId) || 0;
    this.pipelineFailureCounts.set(pipelineId, currentCount + 1);
    this.pipelineLastFailure.set(pipelineId, Date.now());

    secureLogger.debug('📊 记录流水线失败', {
      pipelineId,
      failureCount: currentCount + 1,
      lastFailure: new Date().toISOString()
    });
  }

  /**
   * 临时阻塞流水线
   */
  private temporarilyBlockPipeline(pipelineId: string): void {
    this.pipelineStatuses.set(pipelineId, PipelineStatus.TEMPORARILY_BLOCKED);
    
    secureLogger.warn('⏸️ 临时阻塞流水线', {
      pipelineId,
      duration: this.config.temporaryBlockDuration,
      reason: '连续失败次数过多'
    });

    // 设置自动恢复定时器
    setTimeout(() => {
      if (this.pipelineStatuses.get(pipelineId) === PipelineStatus.TEMPORARILY_BLOCKED) {
        this.pipelineStatuses.set(pipelineId, PipelineStatus.HEALTHY);
        secureLogger.info('🔄 流水线临时阻塞已恢复', { pipelineId });
      }
    }, this.config.temporaryBlockDuration);
  }

  /**
   * 拉黑流水线
   */
  private blacklistPipeline(pipelineId: string, reason: string): void {
    this.pipelineStatuses.set(pipelineId, PipelineStatus.BLACKLISTED);
    
    secureLogger.error('🚫 拉黑流水线', {
      pipelineId,
      reason,
      failureCount: this.pipelineFailureCounts.get(pipelineId) || 0
    });
  }

  /**
   * 销毁流水线
   */
  public destroyPipeline(pipelineId: string): void {
    this.pipelineStatuses.set(pipelineId, PipelineStatus.DESTROYED);
    this.pipelineFailureCounts.delete(pipelineId);
    this.pipelineLastFailure.delete(pipelineId);
    
    secureLogger.error('💀 销毁流水线', { pipelineId });
  }

  /**
   * 获取可用流水线列表
   */
  private getAvailablePipelines(routingDecision: any): string[] {
    // 从路由决策中提取所有可用的流水线
    const availablePipelines = routingDecision.availablePipelines || [];
    
    // 过滤掉已拉黑和已销毁的流水线
    return availablePipelines.filter((pipelineId: string) => {
      const status = this.pipelineStatuses.get(pipelineId);
      return !status || status === PipelineStatus.HEALTHY;
    });
  }

  /**
   * 获取流水线状态
   */
  public getPipelineStatus(pipelineId: string): PipelineStatus {
    return this.pipelineStatuses.get(pipelineId) || PipelineStatus.HEALTHY;
  }

  /**
   * 获取统计信息
   */
  public getStatistics() {
    const healthyCount = Array.from(this.pipelineStatuses.values())
      .filter(status => status === PipelineStatus.HEALTHY).length;
    
    const blockedCount = Array.from(this.pipelineStatuses.values())
      .filter(status => status === PipelineStatus.TEMPORARILY_BLOCKED).length;
      
    const blacklistedCount = Array.from(this.pipelineStatuses.values())
      .filter(status => status === PipelineStatus.BLACKLISTED).length;
      
    const destroyedCount = Array.from(this.pipelineStatuses.values())
      .filter(status => status === PipelineStatus.DESTROYED).length;

    return {
      totalPipelines: this.pipelineStatuses.size,
      healthyPipelines: healthyCount,
      temporarilyBlockedPipelines: blockedCount,
      blacklistedPipelines: blacklistedCount,
      destroyedPipelines: destroyedCount,
      totalFailureRecords: this.pipelineFailureCounts.size
    };
  }

  /**
   * 手动恢复流水线状态
   */
  public recoverPipeline(pipelineId: string): boolean {
    const currentStatus = this.pipelineStatuses.get(pipelineId);
    
    if (currentStatus === PipelineStatus.DESTROYED) {
      return false; // 已销毁的流水线无法恢复
    }
    
    this.pipelineStatuses.set(pipelineId, PipelineStatus.HEALTHY);
    this.pipelineFailureCounts.set(pipelineId, 0);
    
    secureLogger.info('🔄 手动恢复流水线状态', {
      pipelineId,
      previousStatus: currentStatus
    });
    
    return true;
  }
}