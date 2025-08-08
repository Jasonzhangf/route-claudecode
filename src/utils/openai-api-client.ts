/**
 * 纯API调用客户端封装
 * 提供最小化的OpenAI API调用封装，无业务逻辑
 * 
 * 遵循零硬编码、零Fallback、零沉默失败原则
 */

import OpenAI from 'openai';
import { logger } from '@/utils/logger';
import { validateProviderConfig, validateApiKey } from './config-validation';

export interface OpenAIClientConfig {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  defaultHeaders?: Record<string, string>;
  allowDummyKey?: boolean; // 是否允许dummy key（某些兼容服务不需要真实key）
}

export interface OpenAIRequestParams {
  model: string;
  messages: any[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  tools?: any[];
  tool_choice?: any;
}

/**
 * 纯粹的OpenAI API客户端
 * 只负责API调用，不包含任何业务逻辑或格式转换
 */
export class PureOpenAIAPIClient {
  private client: OpenAI;
  private config: OpenAIClientConfig;

  constructor(config: OpenAIClientConfig) {
    // 🚨 验证配置，不允许fallback
    this.validateConfig(config);
    this.config = config;

    // 验证API Key
    const tempConfig: any = {
      authentication: {
        type: 'api_key',
        credentials: { apiKey: config.apiKey }
      }
    };
    const validatedApiKey = validateApiKey(tempConfig, 'OpenAI-API');

    // 初始化OpenAI SDK
    this.client = new OpenAI({
      apiKey: validatedApiKey || 'dummy-key',
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3,
      defaultHeaders: {
        'User-Agent': 'claude-code-router-pure-api/2.9.0',
        ...config.defaultHeaders
      }
    });

    logger.debug('Pure OpenAI API Client initialized', {
      baseURL: config.baseURL,
      hasApiKey: !!config.apiKey,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3,
      allowDummyKey: config.allowDummyKey || false
    });
  }

  /**
   * 🎯 发送非流式请求
   */
  async sendChatCompletion(params: OpenAIRequestParams): Promise<any> {
    this.validateRequestParams(params);

    const requestParams = {
      ...params,
      stream: false
    };

    logger.debug('Sending OpenAI chat completion request', {
      model: params.model,
      messageCount: params.messages.length,
      hasTools: !!(params.tools && params.tools.length > 0),
      maxTokens: params.max_tokens
    });

    try {
      const response = await this.client.chat.completions.create(requestParams) as OpenAI.Chat.Completions.ChatCompletion;
      
      if (!response) {
        throw new Error('OpenAI API returned null response - potential silent failure');
      }

      if (!response.choices || response.choices.length === 0) {
        throw new Error('OpenAI API returned no choices - invalid response format');
      }

      return response;

    } catch (error) {
      this.handleApiError(error, 'chat completion');
      throw error; // 重新抛出，确保无静默失败
    }
  }

  /**
   * 🎯 发送流式请求
   */
  async sendStreamChatCompletion(params: OpenAIRequestParams): Promise<AsyncIterable<any>> {
    this.validateRequestParams(params);

    const requestParams = {
      ...params,
      stream: true as const
    };

    logger.debug('Sending OpenAI streaming chat completion request', {
      model: params.model,
      messageCount: params.messages.length,
      hasTools: !!(params.tools && params.tools.length > 0),
      maxTokens: params.max_tokens
    });

    try {
      const stream = await this.client.chat.completions.create(requestParams);
      
      if (!stream) {
        throw new Error('OpenAI API returned null stream - potential silent failure');
      }

      // 验证stream是可迭代的
      if (!(Symbol.asyncIterator in stream)) {
        throw new Error('OpenAI API returned non-iterable stream - invalid response format');
      }

      return stream as AsyncIterable<any>;

    } catch (error) {
      this.handleApiError(error, 'streaming chat completion');
      throw error; // 重新抛出，确保无静默失败
    }
  }

  /**
   * 🎯 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const testParams: OpenAIRequestParams = {
        model: 'gpt-3.5-turbo', // 使用最基础的模型进行健康检查
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      };

      const response = await this.sendChatCompletion(testParams);
      return !!(response && response.id);

    } catch (error) {
      logger.warn('OpenAI API health check failed', {
        error: error instanceof Error ? error.message : String(error),
        baseURL: this.config.baseURL
      });
      return false;
    }
  }

  /**
   * 验证配置
   */
  private validateConfig(config: OpenAIClientConfig): void {
    if (!config) {
      throw new Error('OpenAI client config is required - violates zero fallback principle');
    }

    if (!config.baseURL) {
      throw new Error('OpenAI client baseURL is required - violates zero fallback principle');
    }

    // 🚨 检查fallback baseURL
    if (config.baseURL === 'default' || config.baseURL === 'unknown') {
      throw new Error(`Invalid baseURL: ${config.baseURL} - violates zero fallback principle`);
    }

    // 验证timeout不是fallback值
    if (config.timeout === 0) {
      throw new Error('OpenAI client timeout cannot be 0 - violates zero fallback principle');
    }

    // 验证maxRetries不是负值
    if (config.maxRetries !== undefined && config.maxRetries < 0) {
      throw new Error('OpenAI client maxRetries cannot be negative - violates zero fallback principle');
    }
  }

  /**
   * 验证请求参数
   */
  private validateRequestParams(params: OpenAIRequestParams): void {
    if (!params) {
      throw new Error('Request params are required - violates zero fallback principle');
    }

    if (!params.model) {
      throw new Error('Model is required - violates zero fallback principle');
    }

    if (!params.messages || !Array.isArray(params.messages)) {
      throw new Error('Messages array is required - violates zero fallback principle');
    }

    if (params.messages.length === 0) {
      throw new Error('At least one message is required - violates zero fallback principle');
    }

    // 🚨 检查fallback模型名
    if (params.model === 'default' || params.model === 'unknown') {
      throw new Error(`Invalid model name: ${params.model} - violates zero fallback principle`);
    }

    // 验证每个消息的格式
    params.messages.forEach((msg, index) => {
      if (!msg || typeof msg !== 'object') {
        throw new Error(`Invalid message at index ${index} - violates zero fallback principle`);
      }

      if (!msg.role) {
        throw new Error(`Message at index ${index} missing role - violates zero fallback principle`);
      }

      // 检查fallback role
      if (msg.role === 'default' || msg.role === 'unknown') {
        throw new Error(`Invalid role at index ${index}: ${msg.role} - violates zero fallback principle`);
      }
    });

    // 验证工具配置（如果存在）
    if (params.tools && !Array.isArray(params.tools)) {
      throw new Error('Tools must be an array - violates zero fallback principle');
    }
  }

  /**
   * 处理API错误
   */
  private handleApiError(error: unknown, operation: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const httpStatus = (error as any)?.response?.status || (error as any)?.status || 500;

    console.error(`🚨 [OpenAI-API-CLIENT] ${operation.toUpperCase()} FAILED - NO SILENT FAILURE:`);
    console.error(`   Operation: ${operation}`);
    console.error(`   Base URL: ${this.config.baseURL}`);
    console.error(`   Status: ${httpStatus}`);
    console.error(`   Error: ${errorMessage}`);
    console.error(`   RESULT: Throwing error to prevent silent failure`);

    logger.error(`OpenAI API ${operation} failed`, {
      error: errorMessage,
      status: httpStatus,
      baseURL: this.config.baseURL,
      operation
    });
  }

  /**
   * 获取客户端配置（只读）
   */
  getConfig(): Readonly<OpenAIClientConfig> {
    return { ...this.config };
  }

  /**
   * 获取基础URL
   */
  getBaseURL(): string {
    return this.config.baseURL;
  }

  /**
   * 检查是否有有效的API Key
   */
  hasValidApiKey(): boolean {
    return !!(this.config.apiKey && 
             this.config.apiKey !== 'dummy-key' && 
             this.config.apiKey !== 'fake-key' && 
             this.config.apiKey !== 'placeholder');
  }
}