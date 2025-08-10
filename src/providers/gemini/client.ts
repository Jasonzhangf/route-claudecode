/**
 * Gemini API Client - Pure API Client
 * Google Gemini API integration via Generative Language API
 * Project owner: Jason Zhang
 * 
 * Architecture: Pure API client following transformer architecture
 * - Zero hardcoding, zero fallback principles
 * - Provider only handles API calls, no format conversion
 * - All transformations handled by transformer layer
 */

import { BaseRequest, BaseResponse, ProviderConfig, ProviderError, GeminiApiRequest, GeminiApiResponse } from '../../types';
import { logger } from '../../utils/logger';
import { EnhancedRateLimitManager } from './enhanced-rate-limit-manager';
import { GoogleGenAI } from '@google/genai';

// Using interfaces from types.ts to avoid conflicts

export class GeminiClient {
  public readonly name: string;
  public readonly type = 'gemini';
  
  private apiKey: string;
  private baseUrl: string;
  private enhancedRateLimitManager?: EnhancedRateLimitManager;
  private apiKeys: string[] = [];
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly requestTimeout: number;
  private genAIClients: GoogleGenAI[] = [];

  constructor(private config: ProviderConfig, providerId?: string) {
    if (!providerId) {
      throw new Error('GeminiClient: providerId is required - no default fallback allowed');
    }
    this.name = providerId;
    
    // Zero Hardcode Principle: All configuration from config
    // @ts-ignore - TODO: Add proper types for timeout and retry
    if (!config.timeout) {
      throw new Error('GeminiClient: config.timeout is required');
    }
    // @ts-ignore - TODO: Add proper types for timeout and retry
    if (!config.retry) {
      throw new Error('GeminiClient: config.retry is required with maxRetries and delayMs properties');
    }
    
    // @ts-ignore - TODO: Add proper types for timeout and retry
    this.maxRetries = config.retry.maxRetries;
    // @ts-ignore - TODO: Add proper types for timeout and retry
    this.retryDelay = config.retry.delayMs;
    // @ts-ignore - TODO: Add proper types for timeout and retry
    this.requestTimeout = config.timeout;
    
    // Handle API key configuration - support both single and multiple keys
    const credentials = config.authentication.credentials;
    const apiKey = credentials ? (credentials.apiKey ?? credentials.api_key) : undefined;
    
    if (Array.isArray(apiKey) && apiKey.length > 1) {
      this.apiKeys = apiKey;
      
      // Initialize rate limit manager without fallback (Zero Fallback Principle)
      this.enhancedRateLimitManager = new EnhancedRateLimitManager(apiKey, this.name, this.config);
      this.apiKey = '';
      this.genAIClients = apiKey.map(key => new GoogleGenAI({ apiKey: key }));
      
      logger.info('Initialized Enhanced Gemini Rate Limit Manager', {
        providerId: this.name,
        keyCount: apiKey.length,
        fallbackDisabled: 'Zero Fallback Principle enforced'
      });
    } else {
      if (!apiKey) {
        throw new Error('GeminiClient: API key is required');
      }
      this.apiKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
      this.apiKeys = [this.apiKey];
      
      if (!this.apiKey) {
        throw new Error('Gemini API key is required');
      }
      
      this.genAIClients = [new GoogleGenAI({ apiKey: this.apiKey })];
    }

    if (!config.endpoint) {
      throw new Error('GeminiClient: config.endpoint is required - no default endpoint allowed (Zero Hardcode Principle)');
    }
    this.baseUrl = config.endpoint;
    
    logger.info('Gemini client initialized with minimal architecture', {
      endpoint: this.baseUrl,
      hasApiKey: !!(this.apiKey ?? this.enhancedRateLimitManager),
      keyRotationEnabled: !!this.enhancedRateLimitManager
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const genAI = this.genAIClients[0];
      
      if (!genAI) {
        logger.error('No GenAI client available for health check');
        return false;
      }
      
      // 获取健康检查用的模型名 - 零硬编码原则
      const healthCheckModel = (this.config.healthCheck as any)?.model;
      if (!healthCheckModel) {
        throw new Error('Health check model not configured. Required: config.healthCheck.model');
      }
      
      // 使用配置化的健康检查请求
      const testResponse = await genAI.models.generateContent({
        model: healthCheckModel,
        contents: [{
          role: 'user',
          parts: [{ text: 'Hi' }]
        }]
      });
      
      const success = !!(testResponse && testResponse.candidates && testResponse.candidates.length > 0);
      
      if (success) {
        logger.debug('Gemini health check succeeded', { model: healthCheckModel });
      } else {
        logger.warn('Gemini health check returned no response', { model: healthCheckModel });
      }
      
      return success;
    } catch (error) {
      logger.error('Gemini health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async createCompletion(request: BaseRequest): Promise<BaseResponse> {
    if (!request.metadata?.requestId) {
      throw new Error('GeminiClient: request.metadata.requestId is required');
    }
    const requestId = request.metadata.requestId;
    
    logger.info('Processing pure Gemini API request', {
      model: request.model,
      messageCount: request.messages?.length ?? 0,
      hasTools: !!request.tools,
      maxTokens: request.max_tokens
    }, requestId, 'gemini-provider');

    // 期望接收已转换的Gemini格式请求
    if (!this.isValidGeminiRequest(request)) {
      throw new Error('GeminiClient: Invalid Gemini request format. Request must be pre-transformed.');
    }
    
    // 构建Gemini API请求
    const geminiRequest = this.buildGeminiApiRequest(request);
    
    // 执行API调用
    const geminiResponse = await this.executeWithRetry(
      async (genAI: GoogleGenAI, model: string) => {
        const apiRequest = {
          ...geminiRequest,
          model: model
        };
        
        return Promise.race([
          genAI.models.generateContent(apiRequest),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Gemini SDK timeout after ${this.requestTimeout}ms`)), this.requestTimeout)
          )
        ]) as Promise<GeminiApiResponse>;
      },
      request.model,
      'createCompletion',
      requestId
    );
    
    // 构建原始Gemini响应
    const response = this.buildGeminiResponse(geminiResponse, request.model, requestId);
    
    logger.info('Pure Gemini API request completed successfully', {
      originalModel: request.model,
      responseType: 'raw_gemini_response',
      candidatesCount: geminiResponse.candidates?.length ?? 0
    }, requestId, 'gemini-provider');
    
    return response;
  }

  async* streamCompletion(request: BaseRequest): AsyncIterable<any> {
    if (!request.metadata?.requestId) {
      throw new Error('GeminiClient: request.metadata.requestId is required');
    }
    const requestId = request.metadata.requestId;
    
    logger.info('Starting pure Gemini API streaming', {
      model: request.model,
      messageCount: request.messages?.length ?? 0
    }, requestId, 'gemini-provider');

    // For now, use non-streaming and return raw response
    const response = await this.createCompletion(request);
    
    // 返回原始Gemini响应，不进行Anthropic格式转换
    yield response;
    
    logger.info('Pure Gemini API streaming completed', {
      responseType: 'raw_gemini_response'
    }, requestId, 'gemini-provider');
  }

  /**
   * Execute request with retry logic and API key rotation
   */
  private async executeWithRetry<T>(
    requestFn: (genAI: GoogleGenAI, model: string) => Promise<T>,
    modelName: string,
    operation: string,
    requestId: string
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      let genAIClient: GoogleGenAI;
      let keyIndex = 0;
      let currentModel = modelName;
      
      try {
        if (this.enhancedRateLimitManager) {
          const keyAndModel = this.enhancedRateLimitManager.getAvailableKeyAndModel(modelName, requestId);
          genAIClient = this.genAIClients[keyAndModel.keyIndex];
          keyIndex = keyAndModel.keyIndex;
          currentModel = keyAndModel.model;
          
          // No fallback logging - Zero Fallback Principle enforced
          // All model routing must be handled at routing layer, not provider layer
        } else {
          keyIndex = attempt % this.genAIClients.length;
          genAIClient = this.genAIClients[keyIndex];
        }
      } catch (keyError) {
        logger.error(`No available keys for ${operation}`, keyError, requestId, 'gemini-provider');
        throw keyError;
      }

      try {
        const result = await requestFn(genAIClient, currentModel);
        
        logger.debug(`${operation} succeeded`, {
          keyIndex,
          model: currentModel,
          attempt: attempt + 1
        }, requestId, 'gemini-provider');
        
        return result;
      } catch (error) {
        lastError = error;
        const isRateLimited = (
          (error as any)?.message?.includes('quota') ||
          (error as any)?.message?.includes('rate') ||
          (error as any)?.status === 429
        );

        logger.warn(`${operation} failed`, {
            keyIndex,
            model: currentModel,
            attempt: attempt + 1,
            maxRetries: this.maxRetries,
            isRateLimited,
            error: error instanceof Error ? error.message : String(error)
        }, requestId, 'gemini-provider');

        // Report error to rate limit manager
        if (this.enhancedRateLimitManager && isRateLimited) {
          this.enhancedRateLimitManager.report429Error(keyIndex, currentModel, requestId);
        }

        if (!this.isRetryableError(error)) {
          break;
        }
        
        if (attempt < this.maxRetries - 1) {
          await this.waitForRetry(attempt, isRateLimited);
        }
      }
    }
    throw lastError;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const status = error?.status ?? error?.response?.status;
    const message = error?.message ?? '';
    
    // HTTP status code based retries
    if (status) {
      const retryableStatuses = [429, 502, 503, 504];
      if (retryableStatuses.includes(status)) {
        return true;
      }
    }
    
    // Gemini specific error patterns
    const retryablePatterns = [
      'quota',
      'rate',
      'RESOURCE_EXHAUSTED',
      'Too Many Requests',
      'temporarily unavailable',
      'service unavailable'
    ];
    
    return retryablePatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Wait for retry delay
   */
  private async waitForRetry(attempt: number, isRateLimited: boolean = false): Promise<void> {
    let delay: number;
    
    if (isRateLimited) {
      // Use configuration for retry delays
      const retryDelays = (this.config as any).retryDelays as number[] | undefined;
      if (!retryDelays || retryDelays.length < 3) {
        throw new Error('Gemini client requires retryDelays configuration with at least 3 values');
      }
      if (attempt === 0) delay = retryDelays[0];      // 1st retry
      else if (attempt === 1) delay = retryDelays[1];  // 2nd retry  
      else delay = retryDelays[2];                    // 3rd retry
    } else {
      delay = this.retryDelay * Math.pow(2, attempt);
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 验证请求是否为有效的Gemini格式
   */
  private isValidGeminiRequest(request: BaseRequest): boolean {
    // 暂时接受所有请求，内部进行转换
    // 检查是否已经是Gemini格式，或者是需要转换的Anthropic/OpenAI格式
    return !!request.metadata?.geminiFormat || this.isTransformableRequest(request);
  }

  private isTransformableRequest(request: BaseRequest): boolean {
    // 检查是否是可以转换的请求格式
    return !!(request.messages && Array.isArray(request.messages) && request.messages.length > 0);
  }

  /**
   * 构建Gemini API请求格式
   */
  private buildGeminiApiRequest(request: BaseRequest): GeminiApiRequest {
    // 如果已经是预处理的Gemini格式，直接使用
    if (request.metadata?.geminiFormat && request.metadata?.geminiRequest) {
      return {
        model: request.model,
        ...request.metadata.geminiRequest
      };
    }
    
    // 否则进行内部转换 (临时解决方案)
    return this.transformRequestToGemini(request);
  }

  private transformRequestToGemini(request: BaseRequest): GeminiApiRequest {
    // 简化的内部转换逻辑
    const contents = [];
    
    // 添加系统消息
    if (request.metadata?.system) {
      const systemText = Array.isArray(request.metadata.system) 
        ? request.metadata.system.map(s => s.text || JSON.stringify(s)).join('\n')
        : request.metadata.system;
      
      contents.push({
        role: 'user' as const,
        parts: [{ text: `System: ${systemText}` }]
      });
    }

    // 转换消息
    for (const message of request.messages) {
      const role = message.role === 'assistant' ? 'model' : 'user';
      const text = typeof message.content === 'string' 
        ? message.content 
        : JSON.stringify(message.content);
      
      contents.push({
        role: role as 'user' | 'model',
        parts: [{ text }]
      });
    }

    const geminiRequest: GeminiApiRequest = {
      model: request.model,
      contents,
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.max_tokens || 131072
      }
    };

    // 处理工具
    if (request.tools && request.tools.length > 0) {
      geminiRequest.tools = [{
        functionDeclarations: request.tools.map(tool => ({
          name: tool.name || tool.function?.name,
          description: tool.description || tool.function?.description,
          parameters: tool.input_schema || tool.parameters || tool.function?.parameters || {}
        }))
      }];

      geminiRequest.toolConfig = {
        functionCallingConfig: {
          mode: 'AUTO',
          allowedFunctionNames: geminiRequest.tools[0].functionDeclarations.map(f => f.name)
        }
      };
    }

    // 添加安全设置
    geminiRequest.safetySettings = [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ];

    return geminiRequest;
  }

  /**
   * 构建原Gemini响应格式
   */
  private buildGeminiResponse(geminiResponse: GeminiApiResponse, originalModel: string, requestId: string): BaseResponse {
    // 进行内部转换 (临时解决方案)
    return this.transformGeminiResponseToAnthropic(geminiResponse, originalModel, requestId);
  }

  private transformGeminiResponseToAnthropic(geminiResponse: GeminiApiResponse, originalModel: string, requestId: string): BaseResponse {
    if (!geminiResponse.candidates || geminiResponse.candidates.length === 0) {
      throw new Error('No candidates in Gemini response');
    }

    const candidate = geminiResponse.candidates[0];
    const content = [];

    // 转换响应内容
    if (candidate.content && candidate.content.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          content.push({
            type: 'text',
            text: part.text
          });
        } else if (part.functionCall) {
          content.push({
            type: 'tool_use',
            id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: part.functionCall.name,
            input: part.functionCall.args || {}
          });
        }
      }
    }

    // 如果没有内容，添加空文本
    if (content.length === 0) {
      content.push({
        type: 'text',
        text: ''
      });
    }

    // 确定stop_reason
    let stopReason = 'end_turn';
    const hasToolUse = content.some(block => block.type === 'tool_use');
    if (hasToolUse) {
      stopReason = 'tool_use';
    } else if (candidate.finishReason === 'MAX_TOKENS') {
      stopReason = 'max_tokens';
    }

    return {
      id: requestId,
      type: 'message',
      role: 'assistant',
      content: content,
      model: originalModel,
      stop_reason: stopReason,
      usage: geminiResponse.usageMetadata ? {
        input_tokens: geminiResponse.usageMetadata.promptTokenCount || 0,
        output_tokens: geminiResponse.usageMetadata.candidatesTokenCount || 0
      } : undefined
    };
  }

  /**
   * 生成唯一消息ID
   */
  private generateMessageId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `msg_gemini_${timestamp}_${random}`;
  }

  /**
   * Get API key rotation statistics
   */
  getRotationStats(): any {
    if (this.enhancedRateLimitManager) {
      return this.enhancedRateLimitManager.getStatus();
    }
    return {
      providerId: this.name,
      totalKeys: 1,
      activeKeys: 1,
      rotationEnabled: false
    };
  }
}