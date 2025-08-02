/**
 * CodeWhisperer 缓冲式客户端
 * 现有实现的重命名版本，确保向后兼容
 * 项目所有者: Jason Zhang
 */

import axios, { AxiosResponse } from 'axios';
import { logger } from '@/utils/logger';
import { CodeWhispererAuth } from './auth';
import { CodeWhispererConverter } from './converter';
import { CodeWhispererParser } from './parser';
import { CodeWhispererPerformanceMetrics } from './config/performance-metrics';
import {
  AnthropicRequest,
  CodeWhispererRequest,
  SSEEvent,
  CodeWhispererConfig,
  RequestValidationResult,
  createCodeWhispererConfig,
} from './types';
import { ICodeWhispererClient } from './client-interface';
import { CodeWhispererStreamingConfig } from './config/streaming-config';

export class CodeWhispererBufferedClient implements ICodeWhispererClient {
  private readonly auth: CodeWhispererAuth;
  private readonly converter: CodeWhispererConverter;
  private readonly parser: CodeWhispererParser;
  private readonly config: CodeWhispererConfig;
  private readonly streamingConfig: CodeWhispererStreamingConfig;
  private readonly metrics: CodeWhispererPerformanceMetrics;
  private readonly httpTimeout: number;
  private readonly maxRetries: number;
  private tokenBlacklisted: boolean = false; // Token状态管理
  private consecutiveRefreshFailures: number = 0;
  private readonly maxRefreshFailures: number = 3; // 最大连续刷新失败次数

  constructor(streamingConfig?: CodeWhispererStreamingConfig) {
    this.streamingConfig = streamingConfig || {
      implementation: 'buffered',
      realtimeOptions: {
        enableZeroDelay: false,
        maxConcurrentStreams: 100,
        binaryFrameSize: 1024 * 1024,
        toolCallStrategy: 'buffered',
        enableCompression: false,
      },
      performanceMetrics: {
        enableProfiling: false,
        collectLatencyData: false,
        memoryUsageTracking: false,
        metricsIntervalMs: 5000,
      },
      fallback: {
        enableFallback: true,
        fallbackToBuffered: true,
        maxFailuresBeforeFallback: 3,
      },
    };
    
    this.config = createCodeWhispererConfig();
    this.auth = CodeWhispererAuth.getInstance();
    this.converter = new CodeWhispererConverter(this.config);
    this.parser = new CodeWhispererParser();
    this.metrics = new CodeWhispererPerformanceMetrics(this.streamingConfig);
    this.httpTimeout = 60000; // 60秒超时
    this.maxRetries = 3; // Token刷新重试次数

    logger.debug('CodeWhispererBufferedClient初始化完成', {
      endpoint: this.config.endpoint,
      timeout: this.httpTimeout,
      maxRetries: this.maxRetries,
      maxRefreshFailures: this.maxRefreshFailures,
    });
  }

  /**
   * 处理流式请求 - 重构优化版本
   */
  public async handleStreamRequest(
    anthropicReq: AnthropicRequest,
    writeSSE: (event: string, data: any) => void,
    onError: (message: string, error: Error) => void
  ): Promise<void> {
    const requestId = `buffered_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    try {
      const requestInfo = this.createRequestInfo(anthropicReq, requestId);
      logger.info('开始处理缓冲式流式请求', requestInfo);

      // 开始性能跟踪
      this.metrics.startTracking(requestId, 'buffered');

      // 使用重试机制执行流式请求
      await this.executeWithRetry(
        async () => {
          // 获取认证信息
          const { accessToken, profileArn } = await this.getAuthInfo();

          // 构建和验证请求
          const cwReq = await this.buildAndValidateRequest(anthropicReq, profileArn);
          const cwReqBody = JSON.stringify(cwReq);

          // 发送HTTP请求
          const responseBuffer = await this.sendHttpRequest(accessToken, cwReqBody, requestId);
          
          // 处理响应和事件流
          await this.processStreamResponse(responseBuffer, anthropicReq, writeSSE, requestId);
        },
        'buffered-stream',
        requestId
      );

      // 结束性能跟踪
      this.metrics.endTracking(requestId, true);

    } catch (error) {
      // 结束性能跟踪（失败）
      this.metrics.endTracking(requestId, false, error instanceof Error ? error.message : String(error));
      await this.handleStreamError(error, onError);
    }
  }

  /**
   * 检查token是否可用 (类似OpenAI的Key可用性检查)
   */
  private isTokenAvailable(): boolean {
    if (this.tokenBlacklisted) {
      logger.warn('Token已被拉黑，不可用', {
        consecutiveRefreshFailures: this.consecutiveRefreshFailures,
        maxRefreshFailures: this.maxRefreshFailures
      });
      return false;
    }
    return true;
  }

  /**
   * 标记token为不可用 (类似OpenAI的blacklist机制)
   */
  private markTokenUnavailable(reason: string, requestId: string): void {
    this.tokenBlacklisted = true;
    logger.error(`CodeWhisperer token已拉黑`, {
      reason,
      consecutiveRefreshFailures: this.consecutiveRefreshFailures,
      maxRefreshFailures: this.maxRefreshFailures,
      requestId
    });
  }

  /**
   * 报告token刷新失败 (类似OpenAI的error reporting)
   */
  private reportRefreshFailure(error: any, requestId: string): void {
    this.consecutiveRefreshFailures++;
    
    if (this.consecutiveRefreshFailures >= this.maxRefreshFailures) {
      this.markTokenUnavailable(
        `连续${this.consecutiveRefreshFailures}次刷新失败`,
        requestId
      );
    }
    
    logger.warn('Token刷新失败计数', {
      consecutiveRefreshFailures: this.consecutiveRefreshFailures,
      maxRefreshFailures: this.maxRefreshFailures,
      tokenBlacklisted: this.tokenBlacklisted,
      requestId,
      error: error instanceof Error ? error.message : error
    });
  }

  /**
   * 报告token刷新成功 (重置失败计数)
   */
  private reportRefreshSuccess(requestId: string): void {
    if (this.consecutiveRefreshFailures > 0) {
      logger.info('Token刷新成功，重置失败计数', {
        previousFailures: this.consecutiveRefreshFailures,
        requestId
      });
      this.consecutiveRefreshFailures = 0;
    }
  }

  /**
   * 执行带重试机制的操作 (类似OpenAI和Gemini的executeWithRetry)
   */
  private async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    operation: string,
    requestId: string
  ): Promise<T> {
    // 首先检查token是否可用
    if (!this.isTokenAvailable()) {
      throw new Error('CodeWhisperer token不可用: token已被拉黑，无法执行请求');
    }

    let lastError: any;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // 清除auth缓存以确保获取最新token
        if (attempt > 0) {
          this.auth.clearCache();
          logger.info(`Token重试第${attempt}次`, { requestId, operation });
        }
        
        return await requestFn();
        
      } catch (error) {
        lastError = error;
        
        // 检查是否是403 token过期错误
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          logger.warn(`检测到403错误，尝试刷新token (尝试 ${attempt + 1}/${this.maxRetries})`, {
            requestId,
            operation,
            errorMessage: error.message
          });
          
          try {
            // 尝试刷新token
            await this.auth.refreshToken();
            this.reportRefreshSuccess(requestId);
            logger.info('Token刷新成功，准备重试', { requestId, operation, attempt: attempt + 1 });
            
            // 如果不是最后一次尝试，继续循环重试
            if (attempt < this.maxRetries - 1) {
              continue;
            }
          } catch (refreshError) {
            this.reportRefreshFailure(refreshError, requestId);
            logger.error('Token刷新失败', {
              requestId,
              operation,
              attempt: attempt + 1,
              refreshError: refreshError instanceof Error ? refreshError.message : refreshError,
              tokenBlacklisted: this.tokenBlacklisted
            });
            
            // 如果token已被拉黑，立即抛出错误
            if (this.tokenBlacklisted) {
              throw new Error(`CodeWhisperer token已拉黑: 连续刷新失败${this.consecutiveRefreshFailures}次`);
            }
            
            // 如果token刷新失败，抛出刷新错误
            throw new Error(`Token刷新失败: ${refreshError instanceof Error ? refreshError.message : refreshError}`);
          }
        } else {
          // 非403错误，不需要重试，直接抛出
          logger.error(`非token错误，不进行重试`, {
            requestId,
            operation,
            statusCode: axios.isAxiosError(error) ? error.response?.status : 'unknown',
            errorMessage: error instanceof Error ? error.message : error
          });
          throw error;
        }
      }
    }
    
    // 如果所有重试都失败，抛出最后一个错误
    logger.error(`所有重试尝试都失败`, {
      requestId,
      operation,
      maxRetries: this.maxRetries,
      tokenBlacklisted: this.tokenBlacklisted,
      lastError: lastError instanceof Error ? lastError.message : lastError
    });
    throw lastError;
  }

  /**
   * 获取认证信息
   */
  private async getAuthInfo(): Promise<{ accessToken: string; profileArn: string }> {
    const [accessToken, profileArn] = await Promise.all([
      this.auth.getToken(),
      this.auth.getProfileArn()
    ]);
    return { accessToken, profileArn };
  }

  /**
   * 构建和验证请求
   */
  private async buildAndValidateRequest(anthropicReq: AnthropicRequest, profileArn: string): Promise<CodeWhispererRequest> {
    const cwReq = await this.converter.buildCodeWhispererRequest(anthropicReq, profileArn);
    
    const validation = this.converter.validateRequest(cwReq);
    if (!validation.isValid) {
      throw new Error(`请求格式验证失败: ${validation.errors.join(', ')}`);
    }
    
    if (validation.warnings.length > 0) {
      logger.warn('请求验证警告', { warnings: validation.warnings });
    }
    
    return cwReq;
  }

  /**
   * 发送HTTP请求
   */
  private async sendHttpRequest(accessToken: string, requestBody: string, requestId: string): Promise<Buffer> {
    logger.debug('发送CodeWhisperer请求', {
      requestId,
      requestSize: requestBody.length,
      endpoint: this.config.endpoint,
    });

    const response = await axios.post<ArrayBuffer>(
      this.config.endpoint,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        responseType: 'arraybuffer',
        timeout: this.httpTimeout,
      }
    );

    if (response.status !== 200) {
      throw new Error(`HTTP请求失败，状态码: ${response.status}`);
    }

    const responseBuffer = Buffer.from(response.data);
    logger.debug('收到CodeWhisperer响应', {
      requestId,
      responseSize: responseBuffer.length,
    });

    return responseBuffer;
  }

  /**
   * 处理流式响应
   */
  private async processStreamResponse(
    responseBuffer: Buffer,
    anthropicReq: AnthropicRequest,
    writeSSE: (event: string, data: any) => void,
    requestId: string
  ): Promise<void> {
    // 解析响应事件
    const events = this.parser.parseEvents(responseBuffer);

    if (events.length === 0) {
      throw new Error('没有解析到任何事件');
    }

    // 生成消息ID
    const messageId = `msg_${Date.now()}`;

    // 发送流式事件序列
    this.sendInitialEvents(messageId, anthropicReq, writeSSE);
    const outputTokens = await this.sendParsedEvents(events, writeSSE, requestId);
    this.sendFinalEvents(outputTokens, writeSSE);

    logger.info('缓冲式流式请求处理完成', {
      requestId,
      eventCount: events.length,
      outputTokens,
    });
  }

  /**
   * 发送初始事件
   */
  private sendInitialEvents(
    messageId: string,
    anthropicReq: AnthropicRequest,
    writeSSE: (event: string, data: any) => void
  ): void {
    // 发送开始事件
    const messageStart = {
      type: 'message_start',
      message: {
        id: messageId,
        type: 'message',
        role: 'assistant',
        content: [],
        model: anthropicReq.model,
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: Math.max(1, Math.floor(this.calculateMessageLength(anthropicReq) / 4)),
          output_tokens: 1,
        },
      },
    };
    writeSSE('message_start', messageStart);

    // 发送ping事件
    writeSSE('ping', { type: 'ping' });

    // 发送content_block_start事件
    const contentBlockStart = {
      content_block: {
        text: '',
        type: 'text',
      },
      index: 0,
      type: 'content_block_start',
    };
    writeSSE('content_block_start', contentBlockStart);
  }

  /**
   * 发送解析的事件
   */
  private async sendParsedEvents(
    events: any[],
    writeSSE: (event: string, data: any) => void,
    requestId: string
  ): Promise<number> {
    let outputTokens = 0;
    
    for (const event of events) {
      writeSSE(event.event, event.data);

      // 记录性能指标
      if (this.streamingConfig.performanceMetrics.collectLatencyData) {
        this.metrics.recordLatency(requestId, event);
      }

      // 计算输出token数量
      if (event.event === 'content_block_delta' && event.data?.delta?.text) {
        outputTokens += Math.floor(event.data.delta.text.length / 4);
      }

      // 模拟延时（减少延时以提高性能）
      await this.sleep(Math.random() * 100); // 从300ms降到100ms
    }

    return outputTokens;
  }

  /**
   * 发送结束事件
   */
  private sendFinalEvents(outputTokens: number, writeSSE: (event: string, data: any) => void): void {
    writeSSE('content_block_stop', {
      index: 0,
      type: 'content_block_stop',
    });

    writeSSE('message_delta', {
      type: 'message_delta',
      delta: {
        stop_reason: 'end_turn',
        stop_sequence: null,
      },
      usage: {
        output_tokens: Math.max(1, outputTokens),
      },
    });

    writeSSE('message_stop', {
      type: 'message_stop',
    });
  }

  /**
   * 处理流式请求错误
   */
  private async handleStreamError(error: any, onError: (message: string, error: Error) => void): Promise<void> {
    logger.error('缓冲式流式请求处理失败', error);
    
    // executeWithRetry已经处理了token重试，这里只需要处理最终错误
    const errorMessage = error instanceof Error ? error.message : String(error);
    onError(`CodeWhisperer缓冲式请求失败: ${errorMessage}`, error as Error);
  }

  /**
   * 处理非流式请求 - 重构优化版本
   */
  public async handleNonStreamRequest(anthropicReq: AnthropicRequest): Promise<any> {
    const requestId = `nonstream_buffered_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    try {
      const requestInfo = this.createRequestInfo(anthropicReq, requestId);
      logger.info('开始处理缓冲式非流式请求', requestInfo);

      // 开始性能跟踪
      this.metrics.startTracking(requestId, 'buffered');

      // 使用重试机制执行非流式请求
      const result = await this.executeWithRetry(
        async () => {
          // 获取认证信息
          const { accessToken, profileArn } = await this.getAuthInfo();

          // 构建和验证请求
          const cwReq = await this.buildAndValidateRequest(anthropicReq, profileArn);
          const cwReqBody = JSON.stringify(cwReq);

          // 发送HTTP请求
          const response = await this.sendNonStreamHttpRequest(accessToken, cwReqBody, requestId);
          
          // 处理响应
          return await this.processNonStreamResponse(response, anthropicReq, requestId);
        },
        'buffered-nonstream',
        requestId
      );

      // 结束性能跟踪
      this.metrics.endTracking(requestId, true);
      
      return result;

    } catch (error) {
      // 结束性能跟踪（失败）
      this.metrics.endTracking(requestId, false, error instanceof Error ? error.message : String(error));
      return await this.handleNonStreamError(error, requestId);
    }
  }

  /**
   * 发送非流式HTTP请求
   */
  private async sendNonStreamHttpRequest(accessToken: string, requestBody: string, requestId: string): Promise<Buffer> {
    logger.debug('发送CodeWhisperer缓冲式非流式请求', {
      requestId,
      requestSize: requestBody.length,
      endpoint: this.config.endpoint,
    });

    const response = await axios.post<ArrayBuffer>(
      this.config.endpoint,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: this.httpTimeout,
      }
    );

    if (response.status !== 200) {
      throw new Error(`HTTP请求失败，状态码: ${response.status}`);
    }

    return Buffer.from(response.data);
  }

  /**
   * 处理非流式响应
   */
  private async processNonStreamResponse(responseBuffer: Buffer, anthropicReq: AnthropicRequest, requestId: string): Promise<any> {
    const responseStr = responseBuffer.toString('utf8');
    
    logger.debug('收到CodeWhisperer缓冲式非流式响应', {
      requestId,
      responseSize: responseBuffer.length,
    });

    // 检查错误响应
    if (responseStr.includes('Improperly formed request.')) {
      logger.error('CodeWhisperer返回格式错误', { 
        requestId,
        response: responseStr.substring(0, 500) // 只记录前500字符
      });
      throw new Error(`请求格式错误: ${responseStr}`);
    }

    // 解析响应事件
    const events = this.parser.parseEvents(responseBuffer);

    // 构建非流式响应
    const anthropicResp = this.parser.buildNonStreamResponse(events, anthropicReq.model);

    logger.info('缓冲式非流式请求处理完成', {
      requestId,
      eventCount: events.length,
      contentBlocks: anthropicResp.content?.length || 0,
    });

    return anthropicResp;
  }

  /**
   * 处理非流式请求错误
   */
  private async handleNonStreamError(error: any, requestId: string): Promise<never> {
    logger.error('缓冲式非流式请求处理失败', { requestId, error });

    // executeWithRetry已经处理了token重试，这里只需要抛出最终错误
    throw error;
  }

  /**
   * 获取客户端类型
   */
  public getClientType(): 'buffered' | 'realtime' {
    return 'buffered';
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    type: string;
    message?: string;
  }> {
    try {
      // 检查认证状态
      const tokenAvailable = await this.auth.getToken().then(() => true).catch(() => false);
      
      const healthy = tokenAvailable && !this.tokenBlacklisted;
      
      return {
        healthy,
        type: 'buffered',
        message: healthy 
          ? 'Buffered client is healthy' 
          : `Issues: ${!tokenAvailable ? 'auth ' : ''}${this.tokenBlacklisted ? 'blacklisted' : ''}`,
      };
    } catch (error) {
      return {
        healthy: false,
        type: 'buffered',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 创建请求信息（用于日志）
   */
  private createRequestInfo(anthropicReq: AnthropicRequest, requestId: string) {
    return {
      requestId,
      model: anthropicReq.model,
      messageCount: anthropicReq.messages.length,
      hasTools: !!(anthropicReq.tools && anthropicReq.tools.length > 0),
      hasSystem: !!(anthropicReq.system && anthropicReq.system.length > 0),
      contentLength: this.calculateMessageLength(anthropicReq),
    };
  }

  /**
   * 计算消息长度（用于token估算）- 优化版本
   */
  private calculateMessageLength(anthropicReq: AnthropicRequest): number {
    let totalLength = 0;
    
    // 计算系统消息长度
    if (anthropicReq.system) {
      for (const sysMsg of anthropicReq.system) {
        totalLength += sysMsg.text.length;
      }
    }
    
    // 计算常规消息长度
    for (const message of anthropicReq.messages) {
      totalLength += this.calculateContentLength(message.content);
    }

    return totalLength;
  }

  /**
   * 计算内容长度
   */
  private calculateContentLength(content: any): number {
    if (typeof content === 'string') {
      return content.length;
    }
    
    if (Array.isArray(content)) {
      return content.reduce((total, block) => {
        if (typeof block === 'string') {
          return total + block.length;
        }
        if (block && typeof block === 'object' && 'text' in block) {
          return total + ((block.text as string)?.length || 0);
        }
        return total;
      }, 0);
    }

    return 0;
  }

  /**
   * 睡眠函数（用于模拟延时）
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
