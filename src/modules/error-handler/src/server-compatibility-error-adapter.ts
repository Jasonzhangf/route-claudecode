/**
 * 服务器兼容性模块错误处理适配器
 * 
 * 将服务器兼容性模块的错误处理集成到统一错误处理系统中
 * 
 * @author RCC v4.0
 */

import { RCCError, ErrorContext } from '../../types/src';
// import { UnifiedErrorResponse } from '../../interfaces/core/error-coordination-center';
// import { UnifiedErrorResponseNormalizer } from './unified-error-response-normalizer';

/**
 * 服务器兼容性错误适配器
 */
export class ServerCompatibilityErrorAdapter {
  /**
   * 适配服务器兼容性模块的错误响应
   * 
   * @param error 原始错误对象
   * @param serverType 服务器类型
   * @returns 统一的错误响应格式
   */
  static adaptServerError(error: any, serverType: string): any {
    // 使用统一的错误响应标准化器处理错误
    // return UnifiedErrorResponseNormalizer.normalizeErrorResponse(error, serverType);
    return {
      error: true,
      message: error.message || 'Unknown error',
      code: error.code || 'UNKNOWN_ERROR'
    };
  }

  /**
   * 适配服务器兼容性模块的重试逻辑
   * 
   * @param error 错误对象
   * @returns 是否可重试
   */
  static isRetryableError(error: any): boolean {
    // return UnifiedErrorResponseNormalizer.isRetryableError(error);
    return true;
  }

  /**
   * 获取建议的重试延迟
   * 
   * @param error 错误对象
   * @returns 重试延迟（毫秒）
   */
  static getRetryDelay(error: any): number {
    // return UnifiedErrorResponseNormalizer.getRetryDelay(error);
    return 1000;
  }

  /**
   * 获取错误严重程度
   * 
   * @param error 错误对象
   * @returns 错误严重程度
   */
  static getErrorSeverity(error: any): 'low' | 'medium' | 'high' | 'critical' {
    // 网络错误通常可重试
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      return 'high';
    }

    // HTTP状态码错误严重程度
    if (error.status) {
      if (error.status === 401 || error.status === 403) {
        return 'high'; // 认证错误 - 高严重程度
      } else if (error.status >= 400 && error.status < 500) {
        return 'medium'; // 客户端错误 - 中等严重程度
      } else if (error.status >= 500) {
        return 'high'; // 服务器错误 - 高严重程度
      }
    }

    // 网络错误 - 中等到高严重程度
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return 'high';
    }

    if (error.code === 'ETIMEDOUT') {
      return 'medium';
    }

    // 未知错误 - 中等严重程度
    return 'medium';
  }

  /**
   * 安全化错误数据，移除敏感信息
   * 
   * @param error 错误对象
   * @returns 安全化的错误数据
   */
  static sanitizeErrorData(error: any): any {
    const sanitized: any = {
      name: error?.name,
      message: error?.message,
      status: error?.status || error?.statusCode,
      code: error?.code,
    };

    // 移除可能包含敏感信息的字段
    if (error?.response?.data && typeof error.response.data === 'object') {
      sanitized.response_data = {
        error: error.response.data.error?.message || error.response.data.message,
      };
    }

    if (error?.config) {
      sanitized.config = {
        method: error.config.method,
        // 隐藏API key等敏感信息
        url: error.config.url?.replace(/[?&]key=[^&]+/g, '?key=***'),
        timeout: error.config.timeout,
      };
    }

    return sanitized;
  }

  /**
   * 记录错误标准化过程
   * 
   * @param debugRecorder 调试记录器
   * @param serverType 服务器类型
   * @param error 错误对象
   * @param normalizationType 标准化类型
   */
  static recordErrorNormalization(
    debugRecorder: any,
    serverType: string,
    error: any,
    normalizationType: string
  ): void {
    if (debugRecorder && typeof debugRecorder.record === 'function') {
      debugRecorder.record(normalizationType, {
        server_type: serverType,
        original_error_type: error?.constructor?.name,
        original_error_message: error?.message,
        original_error_status: error?.status || error?.statusCode,
        original_error_data: this.sanitizeErrorData(error),
      });
    }
  }
}