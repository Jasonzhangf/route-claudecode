/**
 * 错误系统诊断工具
 * 检测和修复静默失败问题
 */

import { FastifyReply } from 'fastify';
import { logger } from '@/utils/logger';

export interface ErrorDiagnostics {
  port: number;
  requestId: string;
  stage: string;
  errorType: string;
  isSilentFailure: boolean;
  hasClientNotification: boolean;
  errorDetails: any;
}

export class ErrorSystemDiagnostics {
  private static diagnosticsLog: ErrorDiagnostics[] = [];
  private static maxLogSize = 1000;

  /**
   * 诊断错误处理是否正确执行
   */
  static diagnoseError(
    error: any,
    reply: FastifyReply,
    context: {
      requestId: string;
      port: number;
      stage: string;
      providerId?: string;
      isStreaming?: boolean;
    }
  ): ErrorDiagnostics {
    const diagnostics: ErrorDiagnostics = {
      port: context.port,
      requestId: context.requestId,
      stage: context.stage,
      errorType: this.classifyError(error),
      isSilentFailure: false,
      hasClientNotification: false,
      errorDetails: {
        message: error?.message,
        status: error?.response?.status || error?.status,
        provider: context.providerId,
        isStreaming: context.isStreaming,
        timestamp: new Date().toISOString()
      }
    };

    // 检查是否为静默失败
    diagnostics.isSilentFailure = this.detectSilentFailure(error, reply, context);
    
    // 检查客户端是否收到通知
    diagnostics.hasClientNotification = this.checkClientNotification(reply, context);

    // 记录诊断信息
    this.logDiagnostics(diagnostics);

    // 如果发现静默失败，强制修复
    if (diagnostics.isSilentFailure) {
      this.forceFix(error, reply, context, diagnostics);
    }

    return diagnostics;
  }

  /**
   * 检测静默失败
   */
  private static detectSilentFailure(
    error: any,
    reply: FastifyReply,
    context: any
  ): boolean {
    // 检查1: 有错误但响应状态码仍为200
    if (error && (reply.statusCode === 200 || !reply.statusCode)) {
      console.error(`🚨 [SILENT FAILURE DETECTED] Error occurred but status code is ${reply.statusCode}`);
      return true;
    }

    // 检查2: 流式请求错误但连接未关闭
    if (context.isStreaming && error && !reply.sent) {
      console.error(`🚨 [SILENT FAILURE DETECTED] Streaming error but connection not closed`);
      return true;
    }

    // 检查3: 特定端口的已知问题
    if (context.port === 6689 && error?.response?.status >= 400) {
      console.error(`🚨 [SILENT FAILURE DETECTED] Port 6689 API error not properly handled`);
      return true;
    }

    // 检查4: Provider错误但没有设置错误状态
    if (error?.message?.includes('Provider') && reply.statusCode < 400) {
      console.error(`🚨 [SILENT FAILURE DETECTED] Provider error but no error status set`);
      return true;
    }

    return false;
  }

  /**
   * 检查客户端通知
   */
  private static checkClientNotification(
    reply: FastifyReply,
    context: any
  ): boolean {
    // 检查响应是否已发送
    if (reply.sent) {
      return true;
    }

    // 检查状态码是否设置
    if (reply.statusCode && reply.statusCode >= 400) {
      return true;
    }

    // 对于流式请求，检查是否写入了错误事件
    if (context.isStreaming) {
      // 这里需要检查是否写入了error事件，但由于技术限制，我们假设未通知
      return false;
    }

    return false;
  }

  /**
   * 强制修复静默失败
   */
  private static forceFix(
    error: any,
    reply: FastifyReply,
    context: any,
    diagnostics: ErrorDiagnostics
  ): void {
    console.error(`🔧 [FORCE FIX] Attempting to fix silent failure for request ${context.requestId}`);

    try {
      // 确定适当的错误状态码
      const statusCode = this.determineStatusCode(error);
      
      if (context.isStreaming) {
        // 流式请求修复
        this.fixStreamingError(error, reply, context, statusCode);
      } else {
        // 常规请求修复
        this.fixRegularError(error, reply, context, statusCode);
      }

      console.error(`✅ [FORCE FIX] Silent failure fixed with status ${statusCode}`);
      
    } catch (fixError) {
      console.error(`❌ [FORCE FIX] Failed to fix silent failure: ${fixError instanceof Error ? fixError.message : String(fixError)}`);
      
      // 最后的保险措施：至少设置500状态码
      try {
        if (!reply.sent) {
          reply.code(500).send({
            error: {
              type: 'internal_server_error',
              message: 'Request failed due to internal error',
              requestId: context.requestId,
              port: context.port,
              stage: context.stage,
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (lastResortError) {
        console.error(`❌ [LAST RESORT] Even last resort fix failed: ${lastResortError instanceof Error ? lastResortError.message : String(lastResortError)}`);
      }
    }
  }

  /**
   * 修复流式错误
   */
  private static fixStreamingError(
    error: any,
    reply: FastifyReply,
    context: any,
    statusCode: number
  ): void {
    if (reply.sent) return;

    reply.code(statusCode);

    const errorEvent = {
      type: 'error',
      error: {
        type: this.mapStatusCodeToType(statusCode),
        message: error?.message || 'Request failed',
        code: statusCode.toString(),
        requestId: context.requestId,
        port: context.port,
        provider: context.providerId,
        timestamp: new Date().toISOString()
      }
    };

    // 写入SSE错误事件
    reply.raw.write(`event: error\n`);
    reply.raw.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    reply.raw.end();

    console.error(`🔚 [STREAMING FIX] Connection closed with error event, status ${statusCode}`);
  }

  /**
   * 修复常规错误
   */
  private static fixRegularError(
    error: any,
    reply: FastifyReply,
    context: any,
    statusCode: number
  ): void {
    if (reply.sent) return;

    const errorResponse = {
      error: {
        type: this.mapStatusCodeToType(statusCode),
        message: error?.message || 'Request failed',
        code: statusCode.toString(),
        requestId: context.requestId,
        port: context.port,
        provider: context.providerId,
        stage: context.stage,
        timestamp: new Date().toISOString(),
        details: {
          originalError: error?.response?.data || error?.details,
          diagnostics: 'Silent failure detected and fixed'
        }
      }
    };

    reply.code(statusCode).send(errorResponse);
    console.error(`🔚 [REGULAR FIX] Error response sent with status ${statusCode}`);
  }

  /**
   * 确定错误状态码
   */
  private static determineStatusCode(error: any): number {
    if (error?.response?.status) return error.response.status;
    if (error?.status) return error.status;
    if (error?.code === 'ECONNREFUSED') return 503;
    if (error?.code === 'ETIMEDOUT') return 504;
    if (error?.message?.includes('401')) return 401;
    if (error?.message?.includes('403')) return 403;
    if (error?.message?.includes('404')) return 404;
    if (error?.message?.includes('429')) return 429;
    return 500; // 默认内部服务器错误
  }

  /**
   * 错误分类
   */
  private static classifyError(error: any): string {
    if (error?.response?.status) return `http_${error.response.status}`;
    if (error?.code) return `network_${error.code}`;
    if (error?.name) return `js_${error.name}`;
    return 'unknown_error';
  }

  /**
   * 状态码到错误类型映射
   */
  private static mapStatusCodeToType(statusCode: number): string {
    switch (statusCode) {
      case 400: return 'bad_request';
      case 401: return 'authentication_error';
      case 403: return 'permission_error';
      case 404: return 'not_found';
      case 429: return 'rate_limit_exceeded';
      case 500: return 'internal_server_error';
      case 502: return 'bad_gateway';
      case 503: return 'service_unavailable';
      case 504: return 'gateway_timeout';
      default: return statusCode >= 500 ? 'server_error' : 'client_error';
    }
  }

  /**
   * 记录诊断信息
   */
  private static logDiagnostics(diagnostics: ErrorDiagnostics): void {
    this.diagnosticsLog.push(diagnostics);
    
    // 保持日志大小限制
    if (this.diagnosticsLog.length > this.maxLogSize) {
      this.diagnosticsLog = this.diagnosticsLog.slice(-this.maxLogSize);
    }

    // 记录到系统日志
    logger.error('Error diagnostics', {
      port: diagnostics.port,
      requestId: diagnostics.requestId,
      stage: diagnostics.stage,
      errorType: diagnostics.errorType,
      isSilentFailure: diagnostics.isSilentFailure,
      hasClientNotification: diagnostics.hasClientNotification,
      errorDetails: diagnostics.errorDetails
    }, diagnostics.requestId, 'error-diagnostics');

    // 如果是静默失败，强制控制台输出
    if (diagnostics.isSilentFailure) {
      console.error(`🚨 [SILENT FAILURE] Port ${diagnostics.port}, Request ${diagnostics.requestId}`);
      console.error(`   Stage: ${diagnostics.stage}`);
      console.error(`   Error Type: ${diagnostics.errorType}`);
      console.error(`   Details: ${JSON.stringify(diagnostics.errorDetails, null, 2)}`);
    }
  }

  /**
   * 获取诊断统计
   */
  static getDiagnosticsStats(): {
    totalErrors: number;
    silentFailures: number;
    silentFailureRate: number;
    errorsByPort: Record<number, number>;
    errorsByType: Record<string, number>;
    recentSilentFailures: ErrorDiagnostics[];
  } {
    const stats = {
      totalErrors: this.diagnosticsLog.length,
      silentFailures: this.diagnosticsLog.filter(d => d.isSilentFailure).length,
      silentFailureRate: 0,
      errorsByPort: {} as Record<number, number>,
      errorsByType: {} as Record<string, number>,
      recentSilentFailures: [] as ErrorDiagnostics[]
    };

    stats.silentFailureRate = stats.totalErrors > 0 
      ? (stats.silentFailures / stats.totalErrors) * 100 
      : 0;

    // 统计各端口错误
    for (const diag of this.diagnosticsLog) {
      stats.errorsByPort[diag.port] = (stats.errorsByPort[diag.port] || 0) + 1;
      stats.errorsByType[diag.errorType] = (stats.errorsByType[diag.errorType] || 0) + 1;
    }

    // 获取最近的静默失败
    stats.recentSilentFailures = this.diagnosticsLog
      .filter(d => d.isSilentFailure)
      .slice(-10);

    return stats;
  }

  /**
   * 清理旧的诊断记录
   */
  static clearOldDiagnostics(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoffTime = Date.now() - maxAgeMs;
    const originalLength = this.diagnosticsLog.length;
    
    this.diagnosticsLog = this.diagnosticsLog.filter(diag => {
      const diagTime = new Date(diag.errorDetails.timestamp).getTime();
      return diagTime > cutoffTime;
    });
    
    return originalLength - this.diagnosticsLog.length;
  }
}

/**
 * 便捷函数：诊断并处理错误
 */
export function diagnoseAndHandleError(
  error: any,
  reply: FastifyReply,
  context: {
    requestId: string;
    port: number;
    stage: string;
    providerId?: string;
    isStreaming?: boolean;
  }
): ErrorDiagnostics {
  return ErrorSystemDiagnostics.diagnoseError(error, reply, context);
}