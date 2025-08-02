/**
 * CodeWhisperer 实时流式客户端
 * 基于demo2的Go实现移植，实现零延迟流式处理
 * 项目所有者: Jason Zhang
 */

import axios, { AxiosResponse } from 'axios';
import { logger } from '@/utils/logger';
import { CodeWhispererAuth } from './auth';
import { CodeWhispererConverter } from './converter';
import { CodeWhispererRealtimeParser } from './parser-realtime';
import { CodeWhispererPerformanceMetrics } from './config/performance-metrics';
import { 
  AnthropicRequest, 
  CodeWhispererRequest, 
  CodeWhispererConfig,
  SSEEvent,
  ICodeWhispererClient,
  PerformanceReport,
} from './client-interface';
import { CodeWhispererStreamingConfig } from './config/streaming-config';

export interface RealtimeClientOptions {
  enableZeroDelay: boolean;
  maxConcurrentStreams: number;
  binaryFrameSize: number;
  toolCallStrategy: 'immediate' | 'buffered';
  enableCompression: boolean;
}

export class CodeWhispererRealtimeClient implements ICodeWhispererClient {
  private readonly auth: CodeWhispererAuth;
  private readonly converter: CodeWhispererConverter;
  private readonly parser: CodeWhispererRealtimeParser;
  private readonly metrics: CodeWhispererPerformanceMetrics;
  private readonly config: CodeWhispererStreamingConfig;
  private readonly options: RealtimeClientOptions;
  private readonly httpTimeout: number;
  private readonly maxRetries: number;
  private tokenBlacklisted: boolean = false;
  private consecutiveRefreshFailures: number = 0;
  private readonly maxRefreshFailures: number = 3;
  private activeStreams: Set<string> = new Set();

  constructor(config: CodeWhispererStreamingConfig) {
    this.config = config;
    this.options = config.realtimeOptions;
    this.auth = CodeWhispererAuth.getInstance();
    this.converter = new CodeWhispererConverter();
    this.parser = new CodeWhispererRealtimeParser({
      maxFrameSize: this.options.binaryFrameSize,
      enableCompression: this.options.enableCompression,
    });
    this.metrics = new CodeWhispererPerformanceMetrics(config);
    this.httpTimeout = 60000; // 60秒超时
    this.maxRetries = 3; // Token刷新重试次数

    logger.info('CodeWhispererRealtimeClient初始化完成', {
      implementation: 'realtime',
      options: this.options,
      timeout: this.httpTimeout,
      maxRetries: this.maxRetries,
    });
  }

  /**
   * 处理流式请求 - 实时流式实现
   */
  public async handleStreamRequest(
    anthropicReq: AnthropicRequest,
    writeSSE: (event: string, data: any) => void,
    onError: (message: string, error: Error) => void
  ): Promise<void> {
    const requestId = `realtime_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    try {
      // 检查并发流限制
      if (this.activeStreams.size >= this.options.maxConcurrentStreams) {
        throw new Error(`超过最大并发流数限制: ${this.options.maxConcurrentStreams}`);
      }
      
      this.activeStreams.add(requestId);
      
      const requestInfo = this.createRequestInfo(anthropicReq, requestId);
      logger.info('开始处理实时流式请求', requestInfo);

      // 开始性能跟踪
      this.metrics.startTracking(requestId, 'realtime');

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
          
          // 实时处理响应流（零延迟转发）
          await this.processRealtimeStream(
            responseBuffer,
            anthropicReq,
            writeSSE,
            requestId
          );
        },
        'realtime-stream',
        requestId
      );

      // 结束性能跟踪
      this.metrics.endTracking(requestId, true);

    } catch (error) {
      // 结束性能跟踪（失败）
      this.metrics.endTracking(requestId, false, error instanceof Error ? error.message : String(error));
      await this.handleStreamError(error, onError);
    } finally {
      this.activeStreams.delete(requestId);
    }
  }

  /**
   * 实时处理响应流 - 核心实时特性
   */
  private async processRealtimeStream(
    responseBuffer: Buffer,
    anthropicReq: AnthropicRequest,
    writeSSE: (event: string, data: any) => void,
    requestId: string
  ): Promise<void> {
    logger.debug('开始实时流式响应处理', {
      requestId,
      bufferSize: responseBuffer.length,
      enableZeroDelay: this.options.enableZeroDelay,
    });

    // 生成消息ID
    const messageId = `msg_${Date.now()}`;

    // 发送初始事件序列
    await this.sendInitialEvents(messageId, anthropicReq, writeSSE);

    // 实时解析和转发事件（零延迟）
    let outputTokens = 0;
    let eventsCount = 0;

    if (this.options.toolCallStrategy === 'immediate') {
      // 立即处理策略 - 基于demo2的实时转发
      for await (const event of this.parser.parseRealtimeStream(
        this.bufferToStream(responseBuffer),
        (progress) => {
          logger.debug('实时解析进度', {
            requestId,
            progress,
          });
        }
      )) {
        // 零延迟转发事件
        writeSSE(event.event, event.data);
        
        // 记录性能指标
        if (this.config.performanceMetrics.collectLatencyData) {
          this.metrics.recordLatency(requestId, event);
        }
        
        // 计算输出token数量
        if (event.event === 'content_block_delta' && event.data?.delta?.text) {
          outputTokens += Math.floor(event.data.delta.text.length / 4);
        }
        
        eventsCount++;
        
        // 仅在不启用零延迟时添加微小延时
        if (!this.options.enableZeroDelay) {
          await this.sleep(Math.random() * 10); // 最多10ms延时
        }
      }
    } else {
      // 缓冲处理策略（兼容现有逻辑）
      const events = this.parser.parseEvents(responseBuffer);
      for (const event of events) {
        writeSSE(event.event, event.data);
        
        if (this.config.performanceMetrics.collectLatencyData) {
          this.metrics.recordLatency(requestId, event);
        }
        
        if (event.event === 'content_block_delta' && event.data?.delta?.text) {
          outputTokens += Math.floor(event.data.delta.text.length / 4);
        }
        
        eventsCount++;
        
        await this.sleep(Math.random() * 50); // 缓冲式延时
      }
    }

    // 发送结束事件序列
    await this.sendFinalEvents(outputTokens, writeSSE);

    logger.info('实时流式请求处理完成', {
      requestId,
      eventCount: eventsCount,
      outputTokens,
      processingTime: Date.now() - parseInt(requestId.split('_')[1]),
    });
  }

  /**
   * 发送初始事件
   */
  private async sendInitialEvents(
    messageId: string,
    anthropicReq: AnthropicRequest,
    writeSSE: (event: string, data: any) => void
  ): Promise<void> {
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
   * 发送结束事件
   */
  private async sendFinalEvents(
    outputTokens: number,
    writeSSE: (event: string, data: any) => void
  ): Promise<void> {
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
   * 处理非流式请求 - 实时优化版本
   */
  public async handleNonStreamRequest(anthropicReq: AnthropicRequest): Promise<any> {
    const requestId = `nonstream_realtime_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    try {
      const requestInfo = this.createRequestInfo(anthropicReq, requestId);
      logger.info('开始处理实时非流式请求', requestInfo);

      // 开始性能跟踪
      this.metrics.startTracking(requestId, 'realtime');

      // 使用重试机制执行非流式请求
      const result = await this.executeWithRetry(
        async () => {
          // 获取认证信息
          const { accessToken, profileArn } = await this.getAuthInfo();

          // 构建和验证请求
          const cwReq = await this.buildAndValidateRequest(anthropicReq, profileArn);
          const cwReqBody = JSON.stringify(cwReq);

          // 发送HTTP请求
          const responseBuffer = await this.sendNonStreamHttpRequest(accessToken, cwReqBody, requestId);
          
          // 实时处理响应
          return await this.processRealtimeNonStreamResponse(responseBuffer, anthropicReq, requestId);
        },
        'realtime-nonstream',
        requestId
      );

      // 结束性能跟踪
      this.metrics.endTracking(requestId, true);
      
      return result;

    } catch (error) {
      // 结束性能跟踪（失败）
      this.metrics.endTracking(requestId, false, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 实时处理非流式响应
   */
  private async processRealtimeNonStreamResponse(
    responseBuffer: Buffer,
    anthropicReq: AnthropicRequest,
    requestId: string
  ): Promise<any> {
    logger.debug('开始实时非流式响应处理', {
      requestId,
      bufferSize: responseBuffer.length,
    });

    // 实时解析事件
    const events = this.parser.parseEvents(responseBuffer);

    if (events.length === 0) {
      throw new Error('没有解析到任何事件');
    }

    // 构建非流式响应
    const anthropicResp = this.parser.buildNonStreamResponse(events, anthropicReq.model);

    logger.info('实时非流式请求处理完成', {
      requestId,
      eventCount: events.length,
      contentBlocks: anthropicResp.content?.length || 0,
    });

    return anthropicResp;
  }

  /**
   * 获取客户端类型
   */
  public getClientType(): 'buffered' | 'realtime' {
    return 'realtime';
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
      
      // 检查并发流状态
      const streamsHealthy = this.activeStreams.size < this.options.maxConcurrentStreams;
      
      const healthy = tokenAvailable && streamsHealthy && !this.tokenBlacklisted;
      
      return {
        healthy,
        type: 'realtime',
        message: healthy 
          ? 'Realtime client is healthy' 
          : `Issues: ${!tokenAvailable ? 'auth ' : ''}${!streamsHealthy ? 'streams ' : ''}${this.tokenBlacklisted ? 'blacklisted' : ''}`,
      };
    } catch (error) {
      return {
        healthy: false,
        type: 'realtime',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Token可用性检查
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
   * 标记token为不可用
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
   * 报告token刷新失败
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
   * 报告token刷新成功
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
   * 执行带重试机制的操作
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
    logger.debug('发送CodeWhisperer实时请求', {
      requestId,
      requestSize: requestBody.length,
      endpoint: 'https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse',
    });

    const response = await axios.post<ArrayBuffer>(
      'https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse',
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
    logger.debug('收到CodeWhisperer实时响应', {
      requestId,
      responseSize: responseBuffer.length,
    });

    return responseBuffer;
  }

  /**
   * 发送非流式HTTP请求
   */
  private async sendNonStreamHttpRequest(accessToken: string, requestBody: string, requestId: string): Promise<Buffer> {
    logger.debug('发送CodeWhisperer实时非流式请求', {
      requestId,
      requestSize: requestBody.length,
    });

    const response = await axios.post<ArrayBuffer>(
      'https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse',
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
   * 处理流式请求错误
   */
  private async handleStreamError(error: any, onError: (message: string, error: Error) => void): Promise<void> {
    logger.error('实时流式请求处理失败', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    onError(`CodeWhisperer实时请求失败: ${errorMessage}`, error as Error);
  }

  /**
   * 创建请求信息
   */
  private createRequestInfo(anthropicReq: AnthropicRequest, requestId: string) {
    return {
      requestId,
      model: anthropicReq.model,
      messageCount: anthropicReq.messages.length,
      hasTools: !!(anthropicReq.tools && anthropicReq.tools.length > 0),
      hasSystem: !!(anthropicReq.system && anthropicReq.system.length > 0),
      contentLength: this.calculateMessageLength(anthropicReq),
      activeStreams: this.activeStreams.size,
    };
  }

  /**
   * 计算消息长度
   */
  private calculateMessageLength(anthropicReq: AnthropicRequest): number {
    let totalLength = 0;
    
    if (anthropicReq.system) {
      for (const sysMsg of anthropicReq.system) {
        totalLength += sysMsg.text.length;
      }
    }
    
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
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 将Buffer转换为Readable流
   */
  private bufferToStream(buffer: Buffer): any {
    const { Readable } = require('stream');
    return Readable.from([buffer]);
  }
}
