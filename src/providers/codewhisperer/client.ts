/**
 * CodeWhisperer HTTP Client - 重构优化版本
 * 基于demo2兼容性设计，消除硬编码和优化性能
 * 项目所有者: Jason Zhang
 */

import axios, { AxiosResponse } from 'axios';
import { logger } from '@/utils/logger';
import { CodeWhispererAuth } from './auth';
import { CodeWhispererConverter } from './converter';
import { CodeWhispererParser } from './parser';
import {
  AnthropicRequest,
  CodeWhispererRequest,
  SSEEvent,
  CodeWhispererConfig,
  RequestValidationResult,
  createCodeWhispererConfig,
} from './types';

export class CodeWhispererClient {
  private readonly auth: CodeWhispererAuth;
  private readonly converter: CodeWhispererConverter;
  private readonly parser: CodeWhispererParser;
  private readonly config: CodeWhispererConfig;
  private readonly httpTimeout: number;

  constructor(config?: CodeWhispererConfig) {
    this.config = config || createCodeWhispererConfig();
    this.auth = CodeWhispererAuth.getInstance();
    this.converter = new CodeWhispererConverter(this.config);
    this.parser = new CodeWhispererParser();
    this.httpTimeout = 60000; // 60秒超时

    logger.debug('CodeWhispererClient初始化完成', {
      endpoint: this.config.endpoint,
      timeout: this.httpTimeout,
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
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    try {
      const requestInfo = this.createRequestInfo(anthropicReq, requestId);
      logger.info('开始处理流式请求', requestInfo);

      // 获取认证信息
      const { accessToken, profileArn } = await this.getAuthInfo();

      // 构建和验证请求
      const cwReq = await this.buildAndValidateRequest(anthropicReq, profileArn);
      const cwReqBody = JSON.stringify(cwReq);

      // 发送HTTP请求
      const responseBuffer = await this.sendHttpRequest(accessToken, cwReqBody, requestId);
      // 处理响应和事件流
      await this.processStreamResponse(responseBuffer, anthropicReq, writeSSE, requestId);

    } catch (error) {
      await this.handleStreamError(error, onError);
    }
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
    const outputTokens = await this.sendParsedEvents(events, writeSSE);
    this.sendFinalEvents(outputTokens, writeSSE);

    logger.info('流式请求处理完成', {
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
    events: SSEEvent[],
    writeSSE: (event: string, data: any) => void
  ): Promise<number> {
    let outputTokens = 0;
    
    for (const event of events) {
      writeSSE(event.event, event.data);

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
    logger.error('流式请求处理失败', error);
    // 处理403错误（token过期）
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      logger.info('检测到403错误，尝试刷新token');
      try {
        await this.auth.refreshToken();
        onError('Token已刷新，请重试', new Error('Token refreshed'));
      } catch (refreshError) {
        onError('Token刷新失败', refreshError as Error);
      }
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      onError(`CodeWhisperer请求失败: ${errorMessage}`, error as Error);
    }
  }

  /**
   * 处理非流式请求 - 重构优化版本
   */
  public async handleNonStreamRequest(anthropicReq: AnthropicRequest): Promise<any> {
    const requestId = `nonstream_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    try {
      const requestInfo = this.createRequestInfo(anthropicReq, requestId);
      logger.info('开始处理非流式请求', requestInfo);

      // 获取认证信息
      const { accessToken, profileArn } = await this.getAuthInfo();

      // 构建和验证请求
      const cwReq = await this.buildAndValidateRequest(anthropicReq, profileArn);
      const cwReqBody = JSON.stringify(cwReq);

      // 发送HTTP请求
      const response = await this.sendNonStreamHttpRequest(accessToken, cwReqBody, requestId);
      
      // 处理响应
      return await this.processNonStreamResponse(response, anthropicReq, requestId);

    } catch (error) {
      return await this.handleNonStreamError(error, requestId);
    }
  }

  /**
   * 发送非流式HTTP请求
   */
  private async sendNonStreamHttpRequest(accessToken: string, requestBody: string, requestId: string): Promise<Buffer> {
    logger.debug('发送CodeWhisperer非流式请求', {
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
    
    logger.debug('收到CodeWhisperer非流式响应', {
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

    logger.info('非流式请求处理完成', {
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
    logger.error('非流式请求处理失败', { requestId, error });

    // 处理403错误
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      logger.info('检测到403错误，尝试刷新token', { requestId });
      await this.auth.refreshToken();
      throw new Error('Token已刷新，请重试');
    }

    throw error;
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