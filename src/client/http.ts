/**
 * HTTP客户端模块
 *
 * 提供HTTP请求处理、流数据处理和请求/响应转换功能
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { ValidateInput, ValidateOutput } from '../middleware/data-validator';
import { RCCError, ErrorHandler, ErrorContext } from '../interfaces/client/error-handler';
import { ClientSession, SessionManager } from './session';

/**
 * HTTP方法类型
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * HTTP请求配置
 */
export interface HttpRequestConfig {
  method?: HttpMethod;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
  validateStatus?: (status: number) => boolean;
  responseType?: 'json' | 'text' | 'stream' | 'buffer';
  signal?: AbortSignal;
}

/**
 * HTTP响应接口
 */
export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  responseTime: number;
  fromCache?: boolean;
}

/**
 * 流响应接口
 */
export interface StreamResponse {
  stream: Readable;
  headers: Record<string, string>;
  status: number;
  statusText: string;
  url: string;
}

/**
 * 请求统计
 */
export interface RequestStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
}

/**
 * HTTP错误类
 */
export class HttpError extends RCCError {
  public readonly status?: number;
  public readonly response?: any;

  constructor(message: string, status?: number, response?: any, details?: Record<string, any>) {
    super(message, 'HTTP_ERROR', { status, response, ...details });
    this.name = 'HttpError';
    this.status = status;
    this.response = response;
  }
}

/**
 * 请求缓存接口
 */
interface RequestCache {
  get(key: string): Promise<HttpResponse | null>;
  set(key: string, response: HttpResponse, ttl?: number): Promise<void>;
  clear(): Promise<void>;
  size(): number;
}

/**
 * 内存缓存实现
 */
class MemoryCache implements RequestCache {
  private cache = new Map<string, { response: HttpResponse; expires: number }>();
  private defaultTTL = 300000; // 5分钟

  async get(key: string): Promise<HttpResponse | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return { ...entry.response, fromCache: true };
  }

  async set(key: string, response: HttpResponse, ttl?: number): Promise<void> {
    const expires = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { response: { ...response }, expires });
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * HTTP客户端类
 */
export class HttpClient extends EventEmitter {
  private cache: RequestCache;
  private stats: RequestStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
  };
  private responseTimes: number[] = [];
  private cacheHits = 0;

  constructor(
    private sessionManager: SessionManager,
    private errorHandler: ErrorHandler,
    cache?: RequestCache
  ) {
    super();
    this.cache = cache || new MemoryCache();
  }

  /**
   * 发送HTTP请求
   */
  @ValidateInput({
    url: { type: 'string', required: true },
    config: {
      type: 'object',
      properties: {
        method: { type: 'string', required: false },
        timeout: { type: 'number', required: false },
        retries: { type: 'number', required: false },
      },
      required: false,
    },
  })
  async request<T = any>(url: string, data?: any, config: HttpRequestConfig = {}): Promise<HttpResponse<T>> {
    const startTime = Date.now();
    const requestConfig = this.mergeDefaultConfig(config);

    // 检查缓存
    if (requestConfig.method === 'GET' && !data) {
      const cacheKey = this.generateCacheKey(url, requestConfig);
      const cachedResponse = await this.cache.get(cacheKey);
      if (cachedResponse) {
        this.cacheHits++;
        this.updateStats(Date.now() - startTime, true);
        this.emit('request', { url, method: requestConfig.method, cached: true });
        return cachedResponse as HttpResponse<T>;
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= requestConfig.retries!; attempt++) {
      try {
        const response = await this.executeRequest<T>(url, data, requestConfig);
        const responseTime = Date.now() - startTime;

        // 缓存GET请求的响应
        if (requestConfig.method === 'GET' && !data && response.status >= 200 && response.status < 300) {
          const cacheKey = this.generateCacheKey(url, requestConfig);
          await this.cache.set(cacheKey, response);
        }

        this.updateStats(responseTime, false, true);
        this.emit('request', {
          url,
          method: requestConfig.method,
          success: true,
          responseTime,
          attempt: attempt + 1,
        });

        return response;
      } catch (error) {
        lastError = error as Error;

        if (attempt < requestConfig.retries!) {
          await this.delay(requestConfig.retryDelay! * Math.pow(2, attempt));
          this.emit('retry', {
            url,
            method: requestConfig.method,
            attempt: attempt + 1,
            error: lastError.message,
          });
        }
      }
    }

    this.updateStats(Date.now() - startTime, false, false);
    this.emit('request', {
      url,
      method: requestConfig.method,
      success: false,
      error: lastError?.message,
    });

    const httpError = new HttpError(
      `Request failed after ${requestConfig.retries! + 1} attempts: ${lastError?.message}`,
      undefined,
      undefined,
      { url, attempts: requestConfig.retries! + 1 }
    );

    this.errorHandler.handleError(httpError, this.createErrorContext(url, requestConfig));
    throw httpError;
  }

  /**
   * 执行单次请求
   */
  private async executeRequest<T>(
    url: string,
    data: any,
    config: Required<HttpRequestConfig>
  ): Promise<HttpResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const requestInit: RequestInit = {
        method: config.method,
        headers: this.buildHeaders(config.headers),
        body: data ? JSON.stringify(data) : undefined,
        signal: config.signal || controller.signal,
        redirect: config.followRedirects ? 'follow' : 'manual',
      };

      const response = await fetch(url, requestInit);

      // 状态验证
      if (!config.validateStatus(response.status)) {
        throw new HttpError(
          `Request failed with status ${response.status}: ${response.statusText}`,
          response.status,
          await this.parseResponseData(response, 'text')
        );
      }

      const responseData = await this.parseResponseData<T>(response, config.responseType);

      return {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: this.extractHeaders(response.headers),
        url: response.url,
        responseTime: 0, // 将在调用方设置
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 发送流请求
   */
  @ValidateInput({
    url: { type: 'string', required: true },
    config: {
      type: 'object',
      properties: {
        method: { type: 'string', required: false },
        timeout: { type: 'number', required: false },
      },
      required: false,
    },
  })
  async requestStream(url: string, data?: any, config: HttpRequestConfig = {}): Promise<StreamResponse> {
    const requestConfig = this.mergeDefaultConfig({ ...config, responseType: 'stream' });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestConfig.timeout);

      const requestInit: RequestInit = {
        method: requestConfig.method,
        headers: this.buildHeaders(requestConfig.headers),
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      };

      const response = await fetch(url, requestInit);

      if (!requestConfig.validateStatus!(response.status)) {
        const errorText = await response.text();
        throw new HttpError(
          `Stream request failed with status ${response.status}: ${response.statusText}`,
          response.status,
          errorText
        );
      }

      const stream = Readable.fromWeb(response.body as ReadableStream);

      clearTimeout(timeoutId);

      this.emit('stream_request', { url, method: requestConfig.method, success: true });

      return {
        stream,
        headers: this.extractHeaders(response.headers),
        status: response.status,
        statusText: response.statusText,
        url: response.url,
      };
    } catch (error) {
      const httpError = new HttpError(`Stream request failed: ${(error as Error).message}`, undefined, undefined, {
        url,
      });

      this.errorHandler.handleError(httpError, this.createErrorContext(url, requestConfig));
      this.emit('stream_request', { url, method: requestConfig.method, success: false, error: httpError.message });
      throw httpError;
    }
  }

  /**
   * GET请求
   */
  async get<T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>(url, undefined, { ...config, method: 'GET' });
  }

  /**
   * POST请求
   */
  async post<T = any>(url: string, data?: any, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>(url, data, { ...config, method: 'POST' });
  }

  /**
   * PUT请求
   */
  async put<T = any>(url: string, data?: any, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>(url, data, { ...config, method: 'PUT' });
  }

  /**
   * DELETE请求
   */
  async delete<T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>(url, undefined, { ...config, method: 'DELETE' });
  }

  /**
   * 构建请求头
   */
  private buildHeaders(headers: Record<string, string> = {}): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'RCC-HttpClient/4.0.0',
      ...headers,
    };
  }

  /**
   * 提取响应头
   */
  private extractHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * 解析响应数据
   */
  private async parseResponseData<T>(response: Response, responseType: string): Promise<T> {
    switch (responseType) {
      case 'json':
        return await response.json();
      case 'text':
        return (await response.text()) as T;
      case 'buffer':
        return (await response.arrayBuffer()) as T;
      case 'stream':
        return response.body as T;
      default:
        return await response.json();
    }
  }

  /**
   * 合并默认配置
   */
  private mergeDefaultConfig(config: HttpRequestConfig): Required<HttpRequestConfig> {
    return {
      method: config.method || 'GET',
      headers: config.headers || {},
      timeout: config.timeout || 30000,
      retries: config.retries || 2,
      retryDelay: config.retryDelay || 1000,
      followRedirects: config.followRedirects ?? true,
      maxRedirects: config.maxRedirects || 5,
      validateStatus: config.validateStatus || (status => status >= 200 && status < 300),
      responseType: config.responseType || 'json',
      signal: config.signal || new AbortController().signal,
    };
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(url: string, config: HttpRequestConfig): string {
    const key = `${config.method || 'GET'}:${url}`;
    if (config.headers) {
      const headerStr = Object.entries(config.headers)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join(',');
      return `${key}:${headerStr}`;
    }
    return key;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 创建错误上下文
   */
  private createErrorContext(url: string, config: HttpRequestConfig): ErrorContext {
    return {
      module: 'http_client',
      operation: 'http_request',
      timestamp: new Date(),
      additionalData: {
        url,
        method: config.method,
        timeout: config.timeout,
        retries: config.retries,
      },
    };
  }

  /**
   * 更新统计信息
   */
  private updateStats(responseTime: number, fromCache: boolean, success?: boolean): void {
    this.stats.totalRequests++;

    if (fromCache) {
      this.stats.cacheHitRate = this.cacheHits / this.stats.totalRequests;
    } else {
      this.responseTimes.push(responseTime);
      if (this.responseTimes.length > 100) {
        this.responseTimes.shift();
      }

      this.stats.averageResponseTime =
        this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
    }

    if (success === true) {
      this.stats.successfulRequests++;
    } else if (success === false) {
      this.stats.failedRequests++;
    }
  }

  /**
   * 获取统计信息
   */
  @ValidateOutput({
    type: 'object',
    properties: {
      totalRequests: { type: 'number', required: true },
      successfulRequests: { type: 'number', required: true },
      failedRequests: { type: 'number', required: true },
      averageResponseTime: { type: 'number', required: true },
      cacheHitRate: { type: 'number', required: true },
    },
  })
  getStats(): RequestStats {
    return { ...this.stats };
  }

  /**
   * 清除缓存
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
    this.cacheHits = 0;
    this.stats.cacheHitRate = 0;
    this.emit('cache_cleared');
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
    };
    this.responseTimes = [];
    this.cacheHits = 0;
    this.emit('stats_reset');
  }
}

/**
 * 流处理器类
 */
export class StreamProcessor extends EventEmitter {
  constructor(private errorHandler: ErrorHandler) {
    super();
  }

  /**
   * 处理SSE流
   */
  @ValidateInput({
    stream: { type: 'object', required: true },
    onMessage: { type: 'object', required: true },
  })
  async processSSEStream(
    stream: Readable,
    onMessage: (data: any) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    let buffer = '';

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = line.slice(6);
              if (data === '[DONE]') {
                onComplete?.();
                resolve();
                return;
              }

              const parsedData = JSON.parse(data);
              onMessage(parsedData);
              this.emit('message', parsedData);
            } catch (error) {
              const streamError = new HttpError(
                `Failed to parse SSE data: ${(error as Error).message}`,
                undefined,
                undefined,
                { data: line }
              );
              this.errorHandler.handleError(streamError);
              onError?.(streamError);
            }
          }
        }
      });

      stream.on('end', () => {
        onComplete?.();
        resolve();
      });

      stream.on('error', error => {
        const streamError = new HttpError(`Stream error: ${error.message}`, undefined, undefined, {
          originalError: error,
        });
        this.errorHandler.handleError(streamError);
        onError?.(streamError);
        reject(streamError);
      });
    });
  }

  /**
   * 处理JSON流
   */
  @ValidateInput({
    stream: { type: 'object', required: true },
    onData: { type: 'object', required: true },
  })
  async processJSONStream(
    stream: Readable,
    onData: (data: any) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    let buffer = '';

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();

        // 尝试解析JSON对象
        let braceCount = 0;
        let start = 0;

        for (let i = 0; i < buffer.length; i++) {
          if (buffer[i] === '{') braceCount++;
          if (buffer[i] === '}') braceCount--;

          if (braceCount === 0 && buffer[i] === '}') {
            try {
              const jsonStr = buffer.slice(start, i + 1);
              const data = JSON.parse(jsonStr);
              onData(data);
              this.emit('data', data);
              start = i + 1;
            } catch (error) {
              // 忽略解析错误，继续累积数据
            }
          }
        }

        buffer = buffer.slice(start);
      });

      stream.on('end', () => {
        onComplete?.();
        resolve();
      });

      stream.on('error', error => {
        const streamError = new HttpError(`JSON stream error: ${error.message}`, undefined, undefined, {
          originalError: error,
        });
        this.errorHandler.handleError(streamError);
        onError?.(streamError);
        reject(streamError);
      });
    });
  }
}

// 所有类型和类已通过export class/interface声明导出，无需重复导出
