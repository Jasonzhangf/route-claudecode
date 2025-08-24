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
   */
  public createApiErrorResponse(error: any, statusCode?: number, requestId?: string): any {
    secureLogger.info('创建API错误响应', {
      requestId,
      statusCode,
      errorMessage: error.message || error,
      errorType: typeof error
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

    // 构建符合Anthropic API格式的错误响应
    const anthropicError = {
      type: "error",
      error: {
        type: statusCode === 401 ? "authentication_error" : 
              statusCode === 403 ? "permission_error" :
              statusCode === 400 ? "invalid_request_error" :
              statusCode === 429 ? "rate_limit_error" :
              statusCode && statusCode >= 500 ? "server_error" : 
              "api_error",
        message: errorDetails.message || errorDetails || "API request failed"
      }
    };

    return anthropicError;
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