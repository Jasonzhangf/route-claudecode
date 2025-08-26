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
import { JQJsonHandler } from '../../utils/jq-json-handler';
import { HeartbeatManager } from './heartbeat-manager';
import { API_DEFAULTS } from '../../constants/api-defaults';

export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  bodyBuffer?: Buffer;
  timeout?: number;
  requestId?: string;
  enableHeartbeat?: boolean;
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
   * 检查HTTP响应状态码并在需要时抛出错误
   * 对于可恢复的错误（5xx、429）抛出异常以触发重试机制
   */
  public checkResponseStatusAndThrow(response: HttpResponse, context?: { requestId?: string; endpoint?: string }): void {
    if (response.status >= 500) {
      // 5xx错误通常是服务器端问题，应该抛出错误触发重试
      const errorMessage = `Server error: ${response.status} Internal Server Error`;
      secureLogger.error('Server error detected, throwing for retry', {
        requestId: context?.requestId,
        status: response.status,
        endpoint: context?.endpoint,
        responsePreview: response.body?.substring(0, 200)
      });
      throw new Error(errorMessage);
    }
    
    if (response.status === 429) {
      // 429错误是限流，应该抛出错误触发重试
      const errorMessage = `Rate limit exceeded: ${response.status}`;
      secureLogger.warn('Rate limit detected, throwing for retry', {
        requestId: context?.requestId,
        status: response.status,
        endpoint: context?.endpoint,
        responsePreview: response.body?.substring(0, 200)
      });
      throw new Error(errorMessage);
    }
    
    if (response.status >= 400 && response.status < 500) {
      // 4xx错误（除了429）通常是客户端问题，抛出错误但不重试
      // 尝试从响应体中提取详细错误信息
      let detailedErrorMessage = `Client error: ${response.status} Bad Request`;
      
      if (response.body) {
        try {
          const responseData = JQJsonHandler.parseJsonString(response.body);
          if (responseData.errors && responseData.errors.message) {
            // ModelScope格式: {"errors": {"message": "Invalid model id: xxx"}}
            detailedErrorMessage = responseData.errors.message;
          } else if (responseData.error && responseData.error.message) {
            // OpenAI格式: {"error": {"message": "xxx"}}
            detailedErrorMessage = responseData.error.message;
          } else if (responseData.message) {
            // 简单格式: {"message": "xxx"}
            detailedErrorMessage = responseData.message;
          } else if (typeof responseData === 'string') {
            detailedErrorMessage = responseData;
          }
        } catch (parseError) {
          // JSON解析失败，使用响应体前200字符
          detailedErrorMessage = `Client error: ${response.status} - ${response.body.substring(0, 200)}`;
        }
      }
      
      secureLogger.error('Client error detected', {
        requestId: context?.requestId,
        status: response.status,
        endpoint: context?.endpoint,
        responsePreview: response.body?.substring(0, 200),
        extractedErrorMessage: detailedErrorMessage
      });
      throw new Error(detailedErrorMessage);
    }
  }

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
        errorDetails = JQJsonHandler.parseJsonString(jsonStr);
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
        const isLongTextRequest = bodySize > API_DEFAULTS.HTTP_CONFIG.LARGE_REQUEST_THRESHOLD;
        
        // 🔧 修复socket hang up：针对大型请求体配置合适的HTTP选项
        const requestTimeout = isLongTextRequest ? 
          API_DEFAULTS.HTTP_CONFIG.LONG_REQUEST_TIMEOUT : 
          (options.timeout || API_DEFAULTS.HTTP_CONFIG.STANDARD_REQUEST_TIMEOUT);
        
        const requestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: options.method || 'POST',
          headers: {
            ...options.headers,
            // 🔧 重要：长文本请求的连接管理配置
            ...(isLongTextRequest && {
              'Connection': 'keep-alive',
              'Keep-Alive': 'timeout=600, max=1', // 10分钟超时，单次连接
              'Transfer-Encoding': 'chunked', // 使用分块传输
              'Expect': '100-continue' // 请求服务器确认接收
            })
          },
          timeout: requestTimeout,
          // 🔧 针对大型请求的socket配置
          ...(isLongTextRequest && {
            highWaterMark: API_DEFAULTS.HTTP_CONFIG.HIGH_WATER_MARK, // 64KB 缓冲区
            noDelay: true, // 禁用Nagle算法，立即发送数据
            keepAlive: true,
            keepAliveInitialDelay: API_DEFAULTS.HTTP_CONFIG.KEEP_ALIVE_INITIAL_DELAY // 5分钟keep-alive延迟
          })
        };

        secureLogger.info('发起HTTP请求', {
          url: url.replace(/\/[^/]+$/, '/***'), // 隐藏敏感路径
          method: requestOptions.method,
          bodySize,
          isLongTextRequest,
          timeout: requestTimeout,
          // 🔧 大型请求的额外日志
          ...(isLongTextRequest && {
            specialHandling: 'chunked_transfer_with_extended_timeout',
            expectedDuration: 'up_to_10_minutes'
          })
        });

        const req = httpModule.request(requestOptions, (res) => {
          let responseData = '';
          let lastDataTime = Date.now();
          let heartbeatSession: any = null;
          
          // 长文本请求启动专业心跳管理
          if (isLongTextRequest && options.requestId) {
            const heartbeatManager = HeartbeatManager.getInstance();
            heartbeatSession = heartbeatManager.startHeartbeatSession(
              options.requestId,
              bodySize,
              () => {
                // 心跳回调 - 记录连接状态
                const timeSinceLastData = Date.now() - lastDataTime;
                secureLogger.debug('长文本请求心跳信号', {
                  requestId: options.requestId,
                  url: url.replace(/\/[^/]+$/, '/***'),
                  timeSinceLastData,
                  responseDataLength: responseData.length,
                  connectionStatus: 'active'
                });
                
                // 如果超过60秒无数据，发出警告
                if (timeSinceLastData > 60000) {
                  secureLogger.warn('长时间无响应数据', {
                    requestId: options.requestId,
                    timeSinceLastData,
                    responseSize: responseData.length
                  });
                }
              }
            );
          }

          res.on('data', (chunk) => {
            responseData += chunk;
            lastDataTime = Date.now();
            
            // 长文本请求记录数据接收进度
            if (isLongTextRequest && responseData.length % API_DEFAULTS.HTTP_CONFIG.PROGRESS_LOG_INTERVAL === 0) { // 每50KB记录一次
              secureLogger.debug('长文本响应接收中', {
                url: url.replace(/\/[^/]+$/, '/***'),
                receivedBytes: responseData.length
              });
            }
          });

          res.on('end', () => {
            // 清理心跳会话
            if (heartbeatSession && options.requestId) {
              const heartbeatManager = HeartbeatManager.getInstance();
              heartbeatManager.stopHeartbeatSession(options.requestId);
            }
            
            secureLogger.info('HTTP请求完成', {
              url: url.replace(/\/[^/]+$/, '/***'),
              statusCode: res.statusCode,
              responseSize: responseData.length,
              isLongTextRequest,
              ...(isLongTextRequest && options.requestId && {
                heartbeatSessionCleaned: true
              })
            });
            
            resolve({
              status: res.statusCode || 0,
              body: responseData,
              headers: res.headers,
            });
          });
          
          res.on('error', (error) => {
            // 清理心跳会话
            if (heartbeatSession && options.requestId) {
              const heartbeatManager = HeartbeatManager.getInstance();
              heartbeatManager.stopHeartbeatSession(options.requestId);
            }
            
            secureLogger.error('HTTP响应接收失败', {
              url: url.replace(/\/[^/]+$/, '/***'),
              error: error.message,
              heartbeatSessionCleaned: !!heartbeatSession
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
          const timeoutError = new Error(`Request timeout after ${requestTimeout}ms`);
          secureLogger.error('HTTP请求超时', {
            url: url.replace(/\/[^/]+$/, '/***'),
            timeout: requestTimeout,
            originalTimeout: options.timeout || 120000,
            bodySize,
            isLongTextRequest,
            suggestion: isLongTextRequest ? 
              '大型请求已使用延长超时 (10分钟)，考虑检查网络连接或提供商处理能力' : 
              '考虑检查网络连接',
            // 🔧 大型请求超时的详细诊断信息
            ...(isLongTextRequest && {
              diagnostic: {
                extendedTimeout: requestTimeout,
                chunkTransferEnabled: true,
                possibleCauses: ['网络不稳定', '提供商处理大型请求时间过长', 'socket连接配置问题']
              }
            })
          });
          reject(timeoutError);
        });

        // 🔧 关键修复: 大型请求体的高级处理策略
        if (options.bodyBuffer) {
          if (isLongTextRequest) {
            // 🔧 分块写入大型请求体，防止socket hang up
            const chunkSize = API_DEFAULTS.HTTP_CONFIG.CHUNK_SIZE; // 16KB chunks (增加块大小提高效率)
            let writtenBytes = 0;
            
            secureLogger.info('开始分块写入大型请求体', {
              totalSize: options.bodyBuffer.length,
              chunkSize,
              estimatedChunks: Math.ceil(options.bodyBuffer.length / chunkSize)
            });
            
            for (let i = 0; i < options.bodyBuffer.length; i += chunkSize) {
              const chunk = options.bodyBuffer.slice(i, i + chunkSize);
              const writeSuccess = req.write(chunk);
              writtenBytes += chunk.length;
              
              // 🔧 重要：等待drain事件，防止缓冲区溢出
              if (!writeSuccess) {
                // 使用同步方式等待drain事件
                req.once('drain', () => {});
              }
              
              // 每100KB记录进度
              if (writtenBytes % API_DEFAULTS.HTTP_CONFIG.WRITE_PROGRESS_INTERVAL === 0) {
                secureLogger.debug('分块写入进度', {
                  writtenBytes,
                  totalBytes: options.bodyBuffer.length,
                  progress: `${((writtenBytes / options.bodyBuffer.length) * 100).toFixed(1)}%`
                });
              }
            }
            
            secureLogger.info('大型请求体写入完成', {
              totalWritten: writtenBytes,
              expectedSize: options.bodyBuffer.length
            });
          } else {
            req.write(options.bodyBuffer);
          }
        } else if (options.body) {
          if (isLongTextRequest) {
            // 🔧 字符串请求体的优化处理
            const bodyBuffer = Buffer.from(options.body, 'utf8');
            const chunkSize = API_DEFAULTS.HTTP_CONFIG.CHUNK_SIZE; // 16KB chunks
            let writtenBytes = 0;
            
            for (let i = 0; i < bodyBuffer.length; i += chunkSize) {
              const chunk = bodyBuffer.slice(i, i + chunkSize);
              const writeSuccess = req.write(chunk);
              writtenBytes += chunk.length;
              
              // 等待drain事件，防止缓冲区溢出
              if (!writeSuccess) {
                // 使用同步方式等待drain事件
                req.once('drain', () => {});
              }
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