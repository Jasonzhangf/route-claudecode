/**
 * 错误处理协调中心接口
 * 
 * 统一的错误处理协调器，负责：
 * 1. 错误分类和处理策略决策
 * 2. 流水线切换和销毁管理
 * 3. 统一错误响应格式化
 * 4. 与负载均衡中心集成
 * 
 * @author RCC v4.0
 */

import { ErrorType } from '../../debug/error-log-manager';
import { PipelineExecutionError } from '../../pipeline/execution/pipeline-execution-manager';

/**
 * 错误处理协调中心配置
 */
export interface ErrorCoordinationConfig {
  enableRetryHandling: boolean;
  maxRetryAttempts: number;
  retryDelayStrategy: 'fixed' | 'exponential' | 'adaptive';
  baseRetryDelay: number;
  maxRetryDelay: number;
  enablePipelineSwitching: boolean;
  enablePipelineDestruction: boolean;
  enableErrorClassification: boolean;
  enableLoadBalancerIntegration: boolean;
}

/**
 * 错误上下文信息
 */
export interface ErrorContext {
  requestId: string;
  pipelineId?: string;
  layerName?: string;
  provider?: string;
  model?: string;
  endpoint?: string;
  statusCode?: number;
  attemptNumber: number;
  maxAttempts: number;
  isLastAttempt: boolean;
  errorChain: any[];
  metadata?: Record<string, any>;
}

/**
 * 错误处理策略
 */
export interface ErrorHandlingStrategy {
  type: 'retry' | 'switch_pipeline' | 'destroy_pipeline' | 'return_error';
  retryAfter?: number;
  switchToPipeline?: string;
  destroyReason?: string;
  returnHttpCode?: number;
  returnErrorDetails?: any;
}

/**
 * 错误分类结果
 */
export interface ErrorClassification {
  type: ErrorType;
  confidence: number;
  matchedPattern: string;
  contextHints?: string[];
  isRetryable: boolean;
  isFatal: boolean;
  requiresPipelineSwitch: boolean;
  requiresPipelineDestruction: boolean;
}

/**
 * 错误处理结果
 */
export interface ErrorHandlingResult {
  success: boolean;
  actionTaken: 'retry' | 'switched' | 'destroyed' | 'returned' | 'ignored';
  retryAfter?: number;
  switchedToPipeline?: string;
  destroyedPipeline?: string;
  returnedError?: any;
  error?: Error;
  context: ErrorContext;
}

/**
 * 流水线管理接口
 */
export interface PipelineManagerInterface {
  destroyPipeline(pipelineId: string): Promise<boolean>;
  getAllPipelines(): Map<string, any>;
  getPipeline(pipelineId: string): any | null;
}

/**
 * 负载均衡器接口
 */
export interface LoadBalancerInterface {
  selectPipeline(availablePipelines: string[]): string;
  getHealthyPipelines(allPipelines: string[]): string[];
  blacklistPipeline(pipelineId: string, duration: number, reason: string): void;
}

/**
 * 错误处理协调中心接口
 */
export interface ErrorCoordinationCenter {
  /**
   * 处理错误并返回处理结果
   */
  handleError(error: Error, context: ErrorContext): Promise<ErrorHandlingResult>;

  /**
   * 分类错误类型
   */
  classifyError(error: Error, context: ErrorContext): ErrorClassification;

  /**
   * 确定错误处理策略
   */
  determineStrategy(error: Error, classification: ErrorClassification, context: ErrorContext): ErrorHandlingStrategy;

  /**
   * 执行错误处理策略
   */
  executeStrategy(strategy: ErrorHandlingStrategy, context: ErrorContext): Promise<ErrorHandlingResult>;

  /**
   * 格式化错误响应
   */
  formatErrorResponse(error: Error, context: ErrorContext, httpStatusCode?: number): any;

  /**
   * 记录错误日志
   */
  logError(error: Error, context: ErrorContext, classification: ErrorClassification): Promise<void>;

  /**
   * 获取错误统计信息
   */
  getErrorStats(): any;

  /**
   * 重置统计信息
   */
  resetStats(): void;
}