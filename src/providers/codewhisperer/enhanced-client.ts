/**
 * CodeWhisperer 增强客户端
 * 集成增强认证管理器和智能重试机制的完整实现
 * 基于 AIClient-2-API 的优秀架构设计
 * 项目所有者: Jason Zhang
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '@/utils/logger';
import { EnhancedCodeWhispererAuth } from './enhanced-auth-manager';
import { RetryManager, RetryableError } from './retry-manager';
import { AnthropicRequest, CodeWhispererRequest, TokenData, HistoryUserMessage, HistoryAssistantMessage } from './types';
import { ICodeWhispererClient } from './client-interface';
import { KiroAuthConfig, DEFAULT_REGION_CONFIG } from './enhanced-auth-config';
import { CodeWhispererParser } from './parser';

export class EnhancedCodeWhispererClient implements ICodeWhispererClient {
  private auth: EnhancedCodeWhispererAuth;
  private retryManager: RetryManager;
  private httpClient: AxiosInstance;
  private config: KiroAuthConfig;
  private parser: CodeWhispererParser;
  private requestCount: number = 0;

  constructor(config?: Partial<KiroAuthConfig>) {
    // 初始化配置和管理器
    this.auth = EnhancedCodeWhispererAuth.getInstance(config);
    this.config = this.auth.getConfig();
    this.retryManager = new RetryManager(this.config.retry, logger);
    this.parser = new CodeWhispererParser();

    // 创建 HTTP 客户端
    this.httpClient = this.createHttpClient();

    this.log('info', 'Enhanced CodeWhisperer Client initialized', {
      region: this.config.region?.region,
      authMethod: this.config.authMethod,
      retryConfig: this.config.retry,
      credentialSources: this.config.credentials.priorityOrder
    });
  }

  /**
   * 创建配置化的 HTTP 客户端
   */
  private createHttpClient(): AxiosInstance {
    const client = axios.create({
      timeout: this.config.retry?.timeoutMs || 120000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': this.config.userAgent || 'CodeWhisperer-Router/2.7.0'
      }
    });

    // 请求拦截器 - 自动添加认证头
    client.interceptors.request.use(async (config) => {
      try {
        const token = await this.auth.getToken();
        config.headers.Authorization = `Bearer ${token}`;
        
        this.log('debug', 'Request interceptor: Added authorization header', {
          url: config.url,
          method: config.method?.toUpperCase(),
          hasAuth: !!config.headers.Authorization
        });
      } catch (error) {
        this.log('error', 'Request interceptor: Failed to get token', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
      return config;
    });

    // 响应拦截器 - 自动处理认证错误
    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // 检查是否为认证错误且未重试过
        if (error.response?.status === 403 && !originalRequest._retried) {
          originalRequest._retried = true;
          
          this.log('warn', 'Response interceptor: 403 error, attempting token refresh', {
            url: originalRequest.url,
            status: error.response.status
          });
          
          try {
            // 强制刷新 token
            await this.auth.refreshToken(true);
            
            // 重新获取 token 并重试请求
            const newToken = await this.auth.getToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            
            return client(originalRequest);
          } catch (refreshError) {
            this.log('error', 'Response interceptor: Token refresh failed', {
              error: refreshError instanceof Error ? refreshError.message : String(refreshError)
            });
            return Promise.reject(refreshError);
          }
        }
        
        return Promise.reject(error);
      }
    );

    return client;
  }

  /**
   * 构建 API URL
   */
  private buildApiUrl(): string {
    const region = this.config.region?.region || 'us-east-1';
    const template = this.config.region?.baseUrl || DEFAULT_REGION_CONFIG.baseUrl;
    return template?.replace('{{region}}', region) || `https://codewhisperer.${region}.amazonaws.com/generateAssistantResponse`;
  }

  /**
   * 处理流式请求 - 完整的错误处理和重试机制
   */
  public async handleStreamRequest(
    anthropicReq: AnthropicRequest,
    writeSSE: (event: string, data: any) => void,
    onError: (message: string, error: Error) => void
  ): Promise<void> {
    const requestId = `enhanced_stream_${++this.requestCount}_${Date.now()}`;
    const startTime = Date.now();

    try {
      this.log('info', 'Starting enhanced stream request', {
        requestId,
        model: anthropicReq.model,
        messageCount: anthropicReq.messages.length,
        hasTools: !!anthropicReq.tools?.length,
        region: this.config.region?.region
      });

      // 通过重试管理器执行请求
      await this.retryManager.executeWithRetry(async () => {
        await this.executeStreamRequest(requestId, anthropicReq, writeSSE, onError);
      });

      const duration = Date.now() - startTime;
      this.log('info', 'Enhanced stream request completed successfully', {
        requestId,
        duration,
        region: this.config.region?.region
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.log('error', 'Enhanced stream request failed', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : String(error),
        region: this.config.region?.region
      });

      onError(
        `Enhanced CodeWhisperer stream request failed: ${error instanceof Error ? error.message : String(error)}`,
        error as Error
      );
    }
  }

  /**
   * 执行实际的流式请求
   */
  private async executeStreamRequest(
    requestId: string,
    anthropicReq: AnthropicRequest,
    writeSSE: (event: string, data: any) => void,
    onError: (message: string, error: Error) => void
  ): Promise<void> {
    // 转换请求格式
    const codewhispererReq = await this.transformAnthropicToCodeWhisperer(anthropicReq);
    const apiUrl = this.buildApiUrl();

    this.log('debug', 'Executing stream request', {
      requestId,
      apiUrl,
      profileArn: codewhispererReq.profileArn,
      conversationId: codewhispererReq.conversationState.conversationId
    });

    try {
      const response = await this.httpClient.post(apiUrl, codewhispererReq, {
        responseType: 'stream',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });

      // 处理流式响应
      let buffer = '';
      
      response.data.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              this.processStreamLine(line, writeSSE);
            } catch (parseError) {
              this.log('warn', 'Failed to process stream line', {
                requestId,
                line: line.substring(0, 100),
                error: parseError instanceof Error ? parseError.message : String(parseError)
              });
            }
          }
        }
      });

      response.data.on('end', () => {
        this.log('debug', 'Stream response ended', { requestId });
      });

      response.data.on('error', (streamError: Error) => {
        const retryableError = RetryManager.createRetryableErrorFromResponse(
          streamError,
          'Stream data error'
        );
        
        this.log('error', 'Stream data error', {
          requestId,
          error: streamError.message,
          isRetryable: retryableError.isRetryable
        });
        
        throw retryableError;
      });

    } catch (error) {
      // 创建包含错误信息的 RetryableError
      const retryableError = RetryManager.createRetryableErrorFromResponse(
        error,
        'Stream request failed'
      );
      
      this.log('error', 'Stream request execution failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        statusCode: retryableError.statusCode,
        isRetryable: retryableError.isRetryable
      });
      
      throw retryableError;
    }
  }

  /**
   * 处理非流式请求
   */
  public async handleNonStreamRequest(anthropicReq: AnthropicRequest): Promise<any> {
    const requestId = `enhanced_nonstream_${++this.requestCount}_${Date.now()}`;
    const startTime = Date.now();

    try {
      this.log('info', 'Starting enhanced non-stream request', {
        requestId,
        model: anthropicReq.model,
        messageCount: anthropicReq.messages.length,
        region: this.config.region?.region
      });

      // 通过重试管理器执行请求
      const result = await this.retryManager.executeWithRetry(async () => {
        return this.executeNonStreamRequest(requestId, anthropicReq);
      });

      const duration = Date.now() - startTime;
      this.log('info', 'Enhanced non-stream request completed successfully', {
        requestId,
        duration,
        region: this.config.region?.region
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.log('error', 'Enhanced non-stream request failed', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : String(error),
        region: this.config.region?.region
      });

      throw error;
    }
  }

  /**
   * 执行实际的非流式请求
   */
  private async executeNonStreamRequest(requestId: string, anthropicReq: AnthropicRequest): Promise<any> {
    // 转换请求格式
    const codewhispererReq = await this.transformAnthropicToCodeWhisperer(anthropicReq);
    const apiUrl = this.buildApiUrl();

    this.log('debug', 'Executing non-stream request', {
      requestId,
      apiUrl,
      profileArn: codewhispererReq.profileArn
    });

    try {
      const response: AxiosResponse<any> = await this.httpClient.post(
        apiUrl,
        codewhispererReq,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      // 🔧 关键修复：使用parser解析响应，支持工具调用
      const responseBuffer = Buffer.from(response.data);
      
      this.log('debug', 'Parsing CodeWhisperer response', {
        requestId,
        bufferLength: responseBuffer.length
      });

      // 解析响应事件
      const events = this.parser.parseEvents(responseBuffer);

      // 构建非流式响应
      const anthropicResp = this.parser.buildNonStreamResponse(events, anthropicReq.model);

      this.log('debug', 'Response parsing completed', {
        requestId,
        eventCount: events.length,
        contentBlocks: anthropicResp.content?.length || 0,
        hasToolUse: anthropicResp.content?.some((c: any) => c.type === 'tool_use') || false
      });

      return anthropicResp;

    } catch (error) {
      const retryableError = RetryManager.createRetryableErrorFromResponse(
        error,
        'Non-stream request failed'
      );
      
      this.log('error', 'Non-stream request execution failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        statusCode: retryableError.statusCode,
        isRetryable: retryableError.isRetryable
      });
      
      throw retryableError;
    }
  }

  /**
   * 转换 Anthropic 请求为 CodeWhisperer 格式
   */
  private async transformAnthropicToCodeWhisperer(anthropicReq: AnthropicRequest): Promise<CodeWhispererRequest> {
    const profileArn = await this.auth.getProfileArn();
    
    // 获取最新的用户消息内容
    const latestUserMessage = anthropicReq.messages[anthropicReq.messages.length - 1];
    const content = Array.isArray(latestUserMessage.content) 
      ? latestUserMessage.content.map(c => typeof c === 'string' ? c : c.text || '').join('')
      : latestUserMessage.content;

    // 构建历史消息
    const history: (HistoryUserMessage | HistoryAssistantMessage)[] = [];
    for (let i = 0; i < anthropicReq.messages.length - 1; i++) {
      const msg = anthropicReq.messages[i];
      const messageContent = Array.isArray(msg.content) 
        ? msg.content.map(c => typeof c === 'string' ? c : c.text || '').join('')
        : msg.content;

      if (msg.role === 'user') {
        history.push({
          userInputMessage: {
            content: messageContent,
            modelId: anthropicReq.model,
            origin: 'chat'
          }
        });
      } else if (msg.role === 'assistant') {
        history.push({
          assistantResponseMessage: {
            content: messageContent,
            toolUses: []
          }
        });
      }
    }
    
    return {
      profileArn,
      conversationState: {
        chatTriggerType: 'manual',
        conversationId: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        currentMessage: {
          userInputMessage: {
            content,
            modelId: anthropicReq.model,
            origin: 'chat',
            userInputMessageContext: {}
          }
        },
        history
      }
    };
  }

  /**
   * 处理流式数据行
   */
  private processStreamLine(line: string, writeSSE: (event: string, data: any) => void): void {
    if (line.startsWith('data: ')) {
      const data = line.substring(6);
      if (data === '[DONE]') {
        return;
      }
      
      try {
        const parsed = JSON.parse(data);
        if (parsed.content) {
          writeSSE('content_block_delta', { delta: { text: parsed.content } });
        }
      } catch (parseError) {
        // 忽略解析错误，继续处理其他行
        this.log('debug', 'Failed to parse stream data', {
          data: data.substring(0, 100),
          error: parseError instanceof Error ? parseError.message : String(parseError)
        });
      }
    }
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<{ healthy: boolean; type: string; message?: string }> {
    try {
      const tokenValid = await this.auth.validateToken();
      return {
        healthy: tokenValid,
        type: 'enhanced-codewhisperer',
        message: tokenValid ? `Ready in region ${this.config.region?.region || 'us-east-1'}` : 'Authentication failed'
      };
    } catch (error) {
      return {
        healthy: false,
        type: 'enhanced-codewhisperer',
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 获取客户端类型
   */
  public getClientType(): 'buffered' | 'realtime' {
    return 'realtime'; // 增强客户端基于实时处理
  }

  /**
   * 获取当前配置
   */
  public getConfig(): KiroAuthConfig {
    return this.auth.getConfig();
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<KiroAuthConfig>): void {
    this.auth.updateConfig(newConfig);
    this.config = this.auth.getConfig();
    
    // 重新创建 HTTP 客户端以应用新配置
    this.httpClient = this.createHttpClient();
    
    this.log('info', 'Enhanced client configuration updated', {
      region: this.config.region?.region,
      authMethod: this.config.authMethod
    });
  }

  /**
   * 日志输出方法
   */
  private log(level: string, message: string, meta?: any): void {
    if (!this.config.enableDebugLog && level === 'debug') {
      return;
    }

    if (logger) {
      (logger as any)[level]?.(message, meta);
    } else {
      console.log(`[EnhancedCodeWhispererClient] ${level.toUpperCase()}: ${message}`, meta || '');
    }
  }
}