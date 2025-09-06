/**
 * 统一错误处理接口
 * 
 * 提供简化的错误处理接口，最多包含3个核心方法
 * 与RCCError和现有错误分类系统保持兼容
 * 
 * @author Claude Code Router v4.0
 */

import { RCCError, RCCErrorCode, ErrorContext } from '../../types/src';
import { ModuleInterface } from '../../interfaces/module/base-module';
import { ErrorClassification, UnifiedErrorResponse, ErrorStatistics, ErrorSummaryReport } from '../../interfaces/core/error-coordination-center';

/**
 * 统一错误处理器接口
 * 
 * 简化为3个核心方法：
 * 1. handleError - 处理错误并记录
 * 2. classifyError - 分类错误
 * 3. generateResponse - 生成统一错误响应
 */
export interface UnifiedErrorHandlerInterface extends ModuleInterface {
  /**
   * 处理错误并记录
   * 
   * @param error 错误对象
   * @param context 错误上下文信息
   * @returns Promise<void>
   */
  handleError(error: Error | RCCError, context?: ErrorContext): Promise<void>;

  /**
   * 分类错误
   * 
   * @param error 错误对象
   * @param context 错误上下文信息
   * @returns ErrorClassification 错误分类结果
   */
  classifyError(error: Error | RCCError, context?: ErrorContext): ErrorClassification;

  /**
   * 生成统一错误响应
   * 
   * @param error 错误对象
   * @param provider 提供商名称
   * @returns UnifiedErrorResponse 统一错误响应
   */
  generateResponse(error: Error | RCCError, provider: string): UnifiedErrorResponse;
}

/**
 * 错误处理工厂接口
 */
export interface ErrorHandlerFactory {
  /**
   * 创建统一错误处理器实例
   * 
   * @param serverPort 服务器端口
   * @returns UnifiedErrorHandlerInterface 错误处理器实例
   */
  createErrorHandler(serverPort?: number): UnifiedErrorHandlerInterface;
}