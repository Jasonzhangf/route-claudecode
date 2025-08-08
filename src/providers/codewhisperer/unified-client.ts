/**
 * CodeWhisperer Unified Client - 重构版本
 * 遵循OpenAI SDK Client的架构模式
 * 职责：纯API调用，不做格式转换
 * 项目所有者: Jason Zhang
 */

import { BaseRequest, BaseResponse, Provider, ProviderConfig, ProviderError } from '@/types';
import { logger } from '@/utils/logger';
import { getSimpleSessionManager } from '@/session/simple-session-manager';
import { createCodeWhispererTransformer } from '@/transformers/codewhisperer';
import { 
  validateNonStreamingResponse, 
  handleProviderError,
  isValidContentChunk,
  extractFinishReasonFromChunk 
} from '@/utils/response-validation';
import { 
  validateProviderConfig, 
  type ValidatedConfig 
} from '@/utils/config-validation';
import { 
  createCodeWhispererStreamingHandler,
  type CodeWhispererStreamingHandler 
} from '@/utils/codewhisperer-streaming-handler';
import { CodeWhispererAuth } from './auth';
import axios, { AxiosInstance } from 'axios';

export interface CodeWhispererUnifiedConfig extends ProviderConfig {
  profileArn?: string;
  region?: string;
  authMethod?: string;
  credentials?: {
    priorityOrder?: string[];
  };
  httpOptions?: {
    timeout?: number;
    maxRetries?: number;
    defaultHeaders?: Record<string, string>;
  };
}

/**
 * CodeWhisperer统一客户端 - 架构重构版
 */
export class CodeWhispererUnifiedClient implements Provider {
  public readonly name: string;
  public readonly type = 'codewhisperer';
  public readonly config: CodeWhispererUnifiedConfig;
  
  private httpClient: AxiosInstance;
  private auth: CodeWhispererAuth;
  private validatedConfig: ValidatedConfig;
  private sessionManager: ReturnType<typeof getSimpleSessionManager>;
  private transformer = createCodeWhispererTransformer();
  private streamingHandler: CodeWhispererStreamingHandler;

  constructor(config: CodeWhispererUnifiedConfig, providerId: string) {
    this.name = providerId;
    this.config = config;
    
    // 🚨 严格配置验证 - 零fallback原则
    this.validatedConfig = validateProviderConfig(config, providerId, config.httpOptions);

    // 初始化认证系统
    this.auth = CodeWhispererAuth.getInstance();
    
    // 初始化HTTP客户端
    this.httpClient = this.createHttpClient();
    
    // 初始化会话管理系统
    this.sessionManager = getSimpleSessionManager(this.validatedConfig.port);
    
    // 初始化流式处理器
    this.streamingHandler = createCodeWhispererStreamingHandler({
      providerName: this.name,
      httpClient: this.httpClient,
      transformer: this.transformer,
      auth: this.auth
    });

    logger.info('CodeWhisperer Unified Client initialized', {
      providerId,
      endpoint: this.validatedConfig.baseURL,
      region: config.region,
      hasProfileArn: !!config.profileArn,
      port: this.validatedConfig.port,
      defaultModel: this.validatedConfig.defaultModel,
      timeout: this.validatedConfig.httpOptions?.timeout,
      sessionTracking: true
    });
  }

  /**
   * 创建HTTP客户端 - 纯粹的API通信
   */
  private createHttpClient(): AxiosInstance {
    const client = axios.create({
      timeout: this.validatedConfig.httpOptions?.timeout || 120000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'claude-code-router-cw/2.8.0',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...this.validatedConfig.httpOptions?.defaultHeaders
      }
    });

    // 请求拦截器 - 自动添加认证头
    client.interceptors.request.use(async (config) => {
      try {
        const { token, profileArn, authMethod } = await this.auth.getAuthInfo();

        config.headers.Authorization = `Bearer ${token}`;

        if (profileArn) {
          config.headers['X-Profile-Arn'] = profileArn;
        }
        if (authMethod) {
          config.headers['X-Auth-Method'] = authMethod;
        }

        logger.debug('CodeWhisperer request interceptor: Added auth headers', {
          url: config.url,
          method: config.method?.toUpperCase(),
          hasAuth: !!config.headers.Authorization,
          hasProfileArn: !!config.headers['X-Profile-Arn'],
          authMethod
        });

      } catch (error) {
        logger.error('CodeWhisperer auth interceptor failed', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }

      return config;
    });

    return client;
  }

  /**
   * 健康检查
   */
  async isHealthy(): Promise<boolean> {
    try {
      // 使用统一transformer构建测试请求
      const testRequest: BaseRequest = {
        model: this.validatedConfig.defaultModel,
        messages: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
        max_tokens: 1
      };

      const cwRequest = this.transformer.transformBaseToCodeWhisperer(testRequest);
      
      const response = await this.httpClient.post(this.validatedConfig.baseURL, cwRequest);
      return response.status === 200;
    } catch (error) {
      logger.warn('CodeWhisperer health check failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: this.name
      });
      return false;
    }
  }

  /**
   * 发送非流式请求 - 重构使用统一处理
   */
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    const originalRequestId = request.metadata?.requestId || 'unknown';
    const sessionId = request.metadata?.sessionId;
    const conversationId = request.metadata?.conversationId;

    // 生成会话ID（如果有会话信息）
    let requestId = originalRequestId;
    if (sessionId && conversationId) {
      requestId = this.sessionManager.generateRequestId(sessionId, conversationId, false);
      request.metadata = { ...request.metadata, requestId, originalRequestId };
    }

    try {
      // 🔄 使用transformer转换请求（统一逻辑）
      const cwRequest = this.transformer.transformBaseToCodeWhisperer(request);
      
      logger.debug('Sending non-streaming request to CodeWhisperer', {
        model: cwRequest.model,
        hasTools: !!(cwRequest.tools && cwRequest.tools.length > 0),
        messageCount: cwRequest.messages.length,
        requestId,
        provider: this.name
      }, requestId, 'provider');

      // 🎯 纯粹的CodeWhisperer API调用
      const response = await this.httpClient.post(this.validatedConfig.baseURL, cwRequest);

      // 🔄 使用transformer转换响应（统一逻辑）
      const baseResponse = this.transformer.transformCodeWhispererToBase(response.data, request);

      // 🚨 统一响应验证，防止静默失败
      validateNonStreamingResponse(baseResponse, requestId, this.name);

      // 标记会话完成
      if (sessionId && conversationId) {
        this.sessionManager.completeRequest(requestId, baseResponse.stop_reason);
      }

      logger.debug('Non-streaming request completed successfully', {
        stopReason: baseResponse.stop_reason,
        hasTools: baseResponse.content.some((c: any) => c.type === 'tool_use'),
        contentBlocks: baseResponse.content.length,
        requestId,
        provider: this.name
      }, requestId, 'provider');

      return baseResponse;

    } catch (error) {
      // 标记会话失败
      if (sessionId && conversationId) {
        this.sessionManager.failRequest(requestId, error);
      }

      // 🚨 统一错误处理，确保无静默失败
      handleProviderError(error, requestId, this.name, 'non-streaming');
    }
  }

  /**
   * 发送流式请求 - 重构使用统一流式处理器
   */
  async *sendStreamRequest(request: BaseRequest): AsyncIterable<any> {
    const originalRequestId = request.metadata?.requestId || 'unknown';
    const sessionId = request.metadata?.sessionId;
    const conversationId = request.metadata?.conversationId;

    // 生成会话ID（如果有会话信息）
    let requestId = originalRequestId;
    if (sessionId && conversationId) {
      requestId = this.sessionManager.generateRequestId(sessionId, conversationId, true);
      request.metadata = { ...request.metadata, requestId, originalRequestId };
    }

    let chunkCount = 0;
    let hasValidContent = false;
    let finishReason: string | undefined;

    try {
      // 🎯 使用统一流式处理器（消除重复逻辑）
      for await (const chunk of this.streamingHandler.processStreamRequest(request)) {
        chunkCount++;
        
        // 跟踪有效内容和状态
        if (isValidContentChunk(chunk)) {
          hasValidContent = true;
        }

        // 提取finish reason
        const extractedFinishReason = extractFinishReasonFromChunk(chunk);
        if (extractedFinishReason) {
          finishReason = extractedFinishReason;
        }

        yield chunk;
      }

      // 标记会话完成
      if (sessionId && conversationId) {
        this.sessionManager.completeRequest(requestId, finishReason || 'stream_end');
      }

      logger.debug('Streaming request completed successfully via handler', {
        chunkCount,
        hasValidContent,
        finishReason,
        requestId,
        provider: this.name
      }, requestId, 'provider');

    } catch (error) {
      // 标记会话失败
      if (sessionId && conversationId) {
        this.sessionManager.failRequest(requestId, error);
      }

      // 🚨 统一错误处理，确保无静默失败
      handleProviderError(error, requestId, this.name, 'streaming');
    }
  }
}

/**
 * 创建CodeWhisperer统一客户端 - 重构后的简化版本
 */
export function createCodeWhispererUnifiedClient(
  config: CodeWhispererUnifiedConfig, 
  providerId: string
): CodeWhispererUnifiedClient {
  return new CodeWhispererUnifiedClient(config, providerId);
}