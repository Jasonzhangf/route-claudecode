/**
 * HTTP请求处理器模块 - 从pipeline-request-processor.ts中拆分
 *
 * 职责：
 * 1. HTTP请求执行（原生Node.js HTTP/HTTPS）
 * 2. 错误分类和重试逻辑
 * 3. 长文本请求的心跳机制支持
 * 4. API错误响应格式化
 *
 * @author RCC v4.0 - Pipeline Refactoring
 */

import https from 'https';
import http from 'http';
import { secureLogger } from '../../utils/secure-logger';

export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  bodyBuffer?: Buffer;
  timeout?: number;
}

export interface HttpResponse {
  status: number;
  body: string;
  headers: any;
}

/**
 * HTTP请求处理器
 * 处理HTTP请求执行、错误分类、重试逻辑等功能
 */
export class HttpRequestHandler {

  /**
   * 判断错误是否应该重试
   * API错误(4xx)和认证错误不重试，网络错误和服务器错误(5xx)可重试
   */
  public shouldRetryError(error: Error, statusCode?: number): boolean {
    // 超时错误 - 可重试
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return true;
    }
    
    // 连接错误 - 可重试
    if (error.message.includes('ECONNREFUSED') || 
        error.message.includes('ENOTFOUND') || 
        error.message.includes('socket hang up') ||
        error.message.includes('ECONNRESET')) {
      return true;
    }
    
    // 如果有HTTP状态码
    if (statusCode !== undefined) {
      // 4xx客户端错误 - 不重试 (API Schema错误、认证错误等)
      if (statusCode >= 400 && statusCode < 500) {
        return false;
      }
      
      // 5xx服务器错误 - 可重试
      if (statusCode >= 500) {
        return true;
      }
    }
    
    // 其他网络相关错误 - 可重试
    return true;
  }

  /**
   * 创建客户端可见的API错误响应
   * 将Provider的具体API错误转换为符合Anthropic格式的错误响应
   * 🔧 修复：正确处理502等HTTP错误，返回给客户端进行重试
   * 🔧 增强：添加错误码、provider和model信息
   */
  public createApiErrorResponse(
    error: any, 
    statusCode?: number, 
    requestId?: string, 
    context?: { provider?: string; model?: string; endpoint?: string }
  ): any {
    secureLogger.info('创建API错误响应', {
      requestId,
      statusCode,
      errorMessage: error.message || error,
      errorType: typeof error,
      isHttpError: statusCode >= 400
    });

    // 如果是字符串形式的API错误，尝试解析
    let errorDetails = error;
    if (typeof error === 'string' && error.startsWith('API Error: ')) {
      try {
        const jsonStr = error.replace('API Error: ', '');
        errorDetails = JSON.parse(jsonStr);
      } catch (parseError) {
        errorDetails = { message: error };
      }
    }

    // 🔧 关键修复：为HTTP错误提供更详细的错误信息
    let errorMessage = errorDetails.message || errorDetails || "API request failed";
    let errorType = "api_error";
    
    // 根据HTTP状态码确定错误类型和消息
    if (statusCode) {
      switch (statusCode) {
        case 401:
          errorType = "authentication_error";
          break;
        case 403:
          errorType = "permission_error";
          break;
        case 400:
          errorType = "invalid_request_error";
          break;
        case 429:
          errorType = "rate_limit_error";
          errorMessage = "请求频率过高，请稍后重试";
          break;
        case 502:
          errorType = "server_error";
          errorMessage = `提供商服务网关错误 (HTTP 502)。建议稍后重试。原因: ${errorMessage}`;
          break;
        case 503:
          errorType = "server_error";
          errorMessage = `提供商服务暂时不可用 (HTTP 503)。请稍后重试。原因: ${errorMessage}`;
          break;
        case 504:
          errorType = "server_error";
          errorMessage = `提供商网关超时 (HTTP 504)。建议稍后重试。原因: ${errorMessage}`;
          break;
        default:
          if (statusCode >= 500) {
            errorType = "server_error";
            errorMessage = `提供商服务器错误 (HTTP ${statusCode})。建议稍后重试。原因: ${errorMessage}`;
          } else if (statusCode >= 400) {
            errorType = "invalid_request_error";
            errorMessage = `请求错误 (HTTP ${statusCode}): ${errorMessage}`;
          }
          break;
      }
    }

    // 🔧 增强：生成具体的错误码
    const errorCode = this.generateErrorCode(statusCode, errorType);
    
    // 构建符合Anthropic API格式的错误响应
    const anthropicError = {
      type: "error",
      error: {
        type: errorType,
        code: errorCode,
        message: errorMessage,
        details: {
          http_status: statusCode || 0,
          provider: context?.provider || "unknown",
          model: context?.model || "unknown",
          endpoint: context?.endpoint,
          request_id: requestId,
          retryable: statusCode ? statusCode >= 500 || statusCode === 429 : false,
          timestamp: new Date().toISOString()
        }
      }
    };

    // 🔧 为服务器错误添加额外的重试提示
    if (statusCode && statusCode >= 500) {
      (anthropicError.error.details as any).suggestion = "这是一个服务器端错误，建议客户端稍后重试";
    } else if (statusCode === 429) {
      (anthropicError.error.details as any).suggestion = "请求频率过高，请适当降低请求频率后重试";
    }

    secureLogger.debug('API错误响应已创建', {
      requestId,
      statusCode,
      errorType,
      messagePreview: errorMessage.substring(0, 100),
      isRetryable: statusCode >= 500
    });

    return anthropicError;
  }

  /**
   * 生成具体的错误码
   */
  private generateErrorCode(statusCode?: number, errorType?: string): string {
    if (!statusCode) return `API_ERROR_${Date.now()}`;
    
    // 基于HTTP状态码生成具体的错误码
    switch (statusCode) {
      case 400: return "HTTP_400_BAD_REQUEST";
      case 401: return "HTTP_401_UNAUTHORIZED";
      case 403: return "HTTP_403_FORBIDDEN";
      case 404: return "HTTP_404_NOT_FOUND";
      case 429: return "HTTP_429_RATE_LIMITED";
      case 500: return "HTTP_500_INTERNAL_SERVER_ERROR";
      case 502: return "HTTP_502_BAD_GATEWAY";
      case 503: return "HTTP_503_SERVICE_UNAVAILABLE";
      case 504: return "HTTP_504_GATEWAY_TIMEOUT";
      default:
        if (statusCode >= 500) {
          return `HTTP_${statusCode}_SERVER_ERROR`;
        } else if (statusCode >= 400) {
          return `HTTP_${statusCode}_CLIENT_ERROR`;
        }
        return `HTTP_${statusCode}_UNKNOWN`;
    }
  }

  /**
   * 执行HTTP请求 - 使用原生Node.js HTTP/HTTPS
   * 支持长文本请求的心跳机制，防止连接断开
   */
  public async makeHttpRequest(url: string, options: HttpRequestOptions): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
      try {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        // 检测是否为长文本请求（请求体大于10KB）
        const bodySize = options.body ? Buffer.byteLength(options.body, 'utf8') : 0;
        const isLongTextRequest = bodySize > 10 * 1024; // 10KB阈值
        
        const requestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: options.method || 'POST',
          headers: {
            ...options.headers,
            // 长文本请求添加Keep-Alive头
            ...(isLongTextRequest && {
              'Connection': 'keep-alive',
              'Keep-Alive': 'timeout=300, max=10' // 5分钟超时，最多10个请求
            })
          },
          timeout: options.timeout || 120000, // 默认2分钟超时
        };

        secureLogger.info('发起HTTP请求', {
          url: url.replace(/\/[^/]+$/, '/***'), // 隐藏敏感路径
          method: requestOptions.method,
          bodySize,
          isLongTextRequest,
          timeout: requestOptions.timeout
        });

        const req = httpModule.request(requestOptions, (res) => {
          let responseData = '';
          let lastDataTime = Date.now();
          let heartbeatInterval: NodeJS.Timeout | null = null;
          
          // 长文本请求启动心跳监控
          if (isLongTextRequest) {
            heartbeatInterval = setInterval(() => {
              const timeSinceLastData = Date.now() - lastDataTime;
              if (timeSinceLastData > 30000) { // 30秒无数据
                secureLogger.warn('长文本请求心跳检查', {
                  url: url.replace(/\/[^/]+$/, '/***'),
                  timeSinceLastData,
                  responseDataLength: responseData.length
                });
              }
            }, 30000); // 每30秒检查一次
          }

          res.on('data', (chunk) => {
            responseData += chunk;
            lastDataTime = Date.now();
            
            // 长文本请求记录数据接收进度
            if (isLongTextRequest && responseData.length % (50 * 1024) === 0) { // 每50KB记录一次
              secureLogger.debug('长文本响应接收中', {
                url: url.replace(/\/[^/]+$/, '/***'),
                receivedBytes: responseData.length
              });
            }
          });

          res.on('end', () => {
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval);
            }
            
            secureLogger.info('HTTP请求完成', {
              url: url.replace(/\/[^/]+$/, '/***'),
              statusCode: res.statusCode,
              responseSize: responseData.length,
              isLongTextRequest
            });
            
            resolve({
              status: res.statusCode || 0,
              body: responseData,
              headers: res.headers,
            });
          });
          
          res.on('error', (error) => {
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval);
            }
            secureLogger.error('HTTP响应接收失败', {
              url: url.replace(/\/[^/]+$/, '/***'),
              error: error.message
            });
            reject(error);
          });
        });

        req.on('error', (error) => {
          secureLogger.error('HTTP请求失败', {
            url: url.replace(/\/[^/]+$/, '/***'),
            error: error.message,
            bodySize,
            isLongTextRequest,
            stack: error.stack,
          });
          reject(error);
        });

        req.on('timeout', () => {
          req.destroy();
          const timeoutError = new Error(`Request timeout after ${options.timeout || 120000}ms`);
          secureLogger.error('HTTP请求超时', {
            url: url.replace(/\/[^/]+$/, '/***'),
            timeout: options.timeout || 120000,
            bodySize,
            isLongTextRequest,
            suggestion: isLongTextRequest ? '长文本请求可能需要更长超时时间' : '考虑检查网络连接'
          });
          reject(timeoutError);
        });

        // 🔧 修复: 使用Buffer写入请求体，确保大型JSON正确传输
        // 对于长文本请求，使用分块写入避免内存问题
        if (options.bodyBuffer) {
          if (isLongTextRequest) {
            // 分块写入大型请求体
            const chunkSize = 8192; // 8KB chunks
            for (let i = 0; i < options.bodyBuffer.length; i += chunkSize) {
              const chunk = options.bodyBuffer.slice(i, i + chunkSize);
              req.write(chunk);
            }
          } else {
            req.write(options.bodyBuffer);
          }
        } else if (options.body) {
          if (isLongTextRequest) {
            // 分块写入大型请求体
            const bodyBuffer = Buffer.from(options.body, 'utf8');
            const chunkSize = 8192; // 8KB chunks
            for (let i = 0; i < bodyBuffer.length; i += chunkSize) {
              const chunk = bodyBuffer.slice(i, i + chunkSize);
              req.write(chunk);
            }
          } else {
            req.write(options.body);
          }
        }
        
        req.end();
        
        // 长文本请求的额外日志
        if (isLongTextRequest) {
          secureLogger.info('长文本请求已发送', {
            url: url.replace(/\/[^/]+$/, '/***'),
            bodySize,
            timeout: options.timeout || 120000
          });
        }

      } catch (error) {
        secureLogger.error('HTTP请求创建失败', {
          url,
          error: (error as Error).message,
          stack: (error as Error).stack,
        });
        reject(error);
      }
    });
  }
}