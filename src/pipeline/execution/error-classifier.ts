/**
 * 错误分类器 - 分析错误并决定处理策略
 * 
 * 职责：
 * 1. 分析HTTP错误、网络错误、应用错误
 * 2. 决定错误处理策略：重试、跳过、拉黑、致命错误
 * 3. 为负载均衡器提供流水线健康反馈
 * 
 * @author RCC v4.0 - Pipeline Execution Architecture
 */

export interface ErrorAction {
  type: 'BLACKLIST_PIPELINE' | 'SKIP_PIPELINE' | 'RETRY_SAME_PIPELINE' | 'FATAL_ERROR';
  reason: string;
  duration?: number; // 拉黑持续时间(毫秒)
  retryAfter?: number; // 重试延迟时间(毫秒)
}

export interface ErrorContext {
  pipelineId: string;
  attempt: number;
  maxRetries: number;
  requestId?: string;
  endpoint?: string;
}

/**
 * 错误分类器
 */
export class ErrorClassifier {
  
  /**
   * 分析错误并返回处理策略
   */
  classifyError(error: Error, context: ErrorContext): ErrorAction {
    const statusCode = this.extractStatusCode(error);
    
    // HTTP状态码错误
    if (statusCode) {
      return this.classifyHttpError(statusCode, error, context);
    }
    
    // 网络连接错误
    if (this.isNetworkError(error)) {
      return this.classifyNetworkError(error, context);
    }
    
    // JSON解析错误
    if (this.isJsonError(error)) {
      return this.classifyJsonError(error, context);
    }
    
    // 超时错误
    if (this.isTimeoutError(error)) {
      return this.classifyTimeoutError(error, context);
    }
    
    // 未知错误
    return {
      type: 'FATAL_ERROR',
      reason: 'unknown_error'
    };
  }
  
  /**
   * 分类HTTP状态码错误
   */
  private classifyHttpError(statusCode: number, error: Error, context: ErrorContext): ErrorAction {
    // 5xx服务器错误
    if (statusCode >= 500) {
      switch (statusCode) {
        case 502: // Bad Gateway - 网关错误，跳过此流水线
          return {
            type: 'SKIP_PIPELINE',
            reason: 'bad_gateway'
          };
          
        case 503: // Service Unavailable - 服务暂时不可用，短期拉黑
          return {
            type: 'BLACKLIST_PIPELINE',
            duration: 30000, // 30秒
            reason: 'service_unavailable'
          };
          
        case 504: // Gateway Timeout - 网关超时，跳过此流水线
          return {
            type: 'SKIP_PIPELINE',
            reason: 'gateway_timeout'
          };
          
        default: // 其他5xx错误，较长时间拉黑
          return {
            type: 'BLACKLIST_PIPELINE',
            duration: 60000, // 1分钟
            reason: 'server_error'
          };
      }
    }
    
    // 429 Rate Limit - 限流，拉黑较长时间
    if (statusCode === 429) {
      return {
        type: 'BLACKLIST_PIPELINE',
        duration: 120000, // 2分钟
        reason: 'rate_limit'
      };
    }
    
    // 4xx客户端错误 - 致命错误，不重试
    if (statusCode >= 400) {
      return {
        type: 'FATAL_ERROR',
        reason: `client_error_${statusCode}`
      };
    }
    
    return {
      type: 'SKIP_PIPELINE',
      reason: 'unknown_http_error'
    };
  }
  
  /**
   * 分类网络连接错误
   */
  private classifyNetworkError(error: Error, context: ErrorContext): ErrorAction {
    const message = error.message.toLowerCase();
    
    // 连接被拒绝 - 流水线可能下线，跳过
    if (message.includes('econnrefused')) {
      return {
        type: 'SKIP_PIPELINE',
        reason: 'connection_refused'
      };
    }
    
    // DNS解析失败 - 配置问题，跳过
    if (message.includes('enotfound')) {
      return {
        type: 'SKIP_PIPELINE',
        reason: 'dns_resolution_failed'
      };
    }
    
    // 连接重置 - 网络问题，可以重试
    if (message.includes('econnreset')) {
      return context.attempt < context.maxRetries ? {
        type: 'RETRY_SAME_PIPELINE',
        reason: 'connection_reset',
        retryAfter: 1000 // 1秒后重试
      } : {
        type: 'SKIP_PIPELINE',
        reason: 'connection_reset_max_retries'
      };
    }
    
    // Socket hang up - 通常是暂时的网络问题，可以重试
    if (message.includes('socket hang up')) {
      return context.attempt < context.maxRetries ? {
        type: 'RETRY_SAME_PIPELINE',
        reason: 'socket_hang_up',
        retryAfter: 2000 // 2秒后重试（比econnreset稍长）
      } : {
        type: 'SKIP_PIPELINE',
        reason: 'socket_hang_up_max_retries'
      };
    }
    
    return {
      type: 'SKIP_PIPELINE',
      reason: 'network_error'
    };
  }
  
  /**
   * 分类JSON解析错误
   */
  private classifyJsonError(error: Error, context: ErrorContext): ErrorAction {
    // JSON解析失败通常是服务器返回了非标准响应，跳过此流水线
    return {
      type: 'SKIP_PIPELINE',
      reason: 'invalid_json_response'
    };
  }
  
  /**
   * 分类超时错误
   */
  private classifyTimeoutError(error: Error, context: ErrorContext): ErrorAction {
    // 超时错误可以重试，但达到最大重试次数后跳过
    return context.attempt < context.maxRetries ? {
      type: 'RETRY_SAME_PIPELINE',
      reason: 'timeout_retry',
      retryAfter: Math.min(1000 * Math.pow(2, context.attempt), 10000) // 指数退避，最大10秒
    } : {
      type: 'SKIP_PIPELINE',
      reason: 'timeout_max_retries'
    };
  }
  
  /**
   * 从错误中提取HTTP状态码
   */
  private extractStatusCode(error: Error): number | undefined {
    // 从error对象的各种可能属性中提取状态码
    const errorAny = error as any;
    
    return errorAny.status ||
           errorAny.statusCode ||
           errorAny.response?.status ||
           errorAny.response?.statusCode;
  }
  
  /**
   * 判断是否为网络错误
   */
  private isNetworkError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('econnrefused') ||
           message.includes('enotfound') ||
           message.includes('econnreset') ||
           message.includes('socket hang up') ||
           message.includes('network');
  }
  
  /**
   * 判断是否为JSON解析错误
   */
  private isJsonError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('invalid json') ||
           message.includes('unexpected token') ||
           message.includes('json parse') ||
           message.includes('syntax error');
  }
  
  /**
   * 判断是否为超时错误
   */
  private isTimeoutError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('timeout') ||
           message.includes('etimedout') ||
           message.includes('request timeout');
  }
}