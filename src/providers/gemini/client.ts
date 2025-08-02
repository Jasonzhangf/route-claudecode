/**
 * Gemini API Client
 * Google Gemini API integration via Generative Language API
 * Project owner: Jason Zhang
 */

import { BaseRequest, BaseResponse, ProviderConfig, ProviderError } from '../../types';
import { logger } from '../../utils/logger';
import { processGeminiResponse } from './universal-gemini-parser';
import { ApiKeyRotationManager } from '../openai/api-key-rotation';
import { EnhancedRateLimitManager } from './enhanced-rate-limit-manager';

export class GeminiClient {
  public readonly name: string;
  public readonly type = 'gemini';
  
  private apiKey: string;
  private baseUrl: string;
  private apiKeyRotationManager?: ApiKeyRotationManager;
  private enhancedRateLimitManager?: EnhancedRateLimitManager;
  private apiKeys: string[] = [];
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;
  private readonly requestTimeout = 60000; // 60 seconds timeout

  constructor(private config: ProviderConfig, providerId?: string) {
    this.name = providerId || 'gemini-client';
    
    // Handle API key configuration - support both single and multiple keys
    const credentials = config.authentication.credentials;
    const apiKey = credentials ? (credentials.apiKey || credentials.api_key) : undefined;
    
    if (Array.isArray(apiKey) && apiKey.length > 1) {
      // Multiple API keys - initialize enhanced rate limit manager
      this.apiKeys = apiKey;
      this.enhancedRateLimitManager = new EnhancedRateLimitManager(
        apiKey,
        this.name
      );
      
      // Also keep the old rotation manager for backward compatibility
      this.apiKeyRotationManager = new ApiKeyRotationManager(
        apiKey,
        this.name,
        config.keyRotation || { strategy: 'rate_limit_aware' }
      );
      this.apiKey = ''; // Will be set dynamically per request
      
      logger.info('Initialized Enhanced Gemini Rate Limit Manager', {
        providerId: this.name,
        keyCount: apiKey.length,
        strategy: 'rpm_tpm_rpd_aware_with_model_fallback',
        fallbackSupported: true
      });
    } else {
      // Single API key - traditional approach
      this.apiKey = Array.isArray(apiKey) ? apiKey[0] : (apiKey || '');
      this.apiKeys = [this.apiKey];
      
      if (!this.apiKey) {
        throw new Error('Gemini API key is required');
      }
    }

    this.baseUrl = config.endpoint || 'https://generativelanguage.googleapis.com';
    logger.info('Gemini client initialized', {
      endpoint: this.baseUrl,
      hasApiKey: !!this.apiKey || !!this.apiKeyRotationManager,
      keyRotationEnabled: !!this.apiKeyRotationManager
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Get current API key for health check
      const apiKey = this.getCurrentApiKey('health-check');
      
      // Check if we can list models (lightweight health check)
      const response = await fetch(`${this.baseUrl}/v1beta/models?key=${apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const success = response.ok;
      
      if (success) {
        this.reportApiKeySuccess(apiKey, 'health-check');
      } else {
        const isRateLimit = response.status === 429;
        this.reportApiKeyError(apiKey, isRateLimit, 'health-check');
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
    const requestId = request.metadata?.requestId || 'unknown';
    let geminiRequest = this.convertToGeminiFormat(request);
    let modelName = this.extractModelName(request.model);
    let actualApiKey: string;
    let keyIndex = 0;
    let fallbackApplied = false;
    let fallbackReason: string | undefined;
    
    // Enhanced Rate Limit Management with Model Fallback
    if (this.enhancedRateLimitManager) {
      const estimatedTokens = this.estimateTokens(request);
      const keyAndModel = this.enhancedRateLimitManager.getAvailableKeyAndModel(
        modelName, 
        estimatedTokens, 
        requestId
      );
      
      actualApiKey = this.apiKeys[keyAndModel.keyIndex];
      keyIndex = keyAndModel.keyIndex;
      modelName = keyAndModel.model;
      fallbackApplied = keyAndModel.fallbackApplied;
      fallbackReason = keyAndModel.fallbackReason;
      
      if (fallbackApplied) {
        logger.info('Applied Gemini model fallback due to rate limits', {
          originalModel: this.extractModelName(request.model),
          fallbackModel: modelName,
          reason: fallbackReason,
          keyIndex
        }, requestId, 'gemini-provider');
      }
    } else {
      actualApiKey = this.getCurrentApiKey(requestId);
    }
    
    logger.info('Sending non-streaming request to Gemini API', {
      model: modelName,
      messageCount: geminiRequest.contents?.length || 0,
      hasTools: !!geminiRequest.tools,
      maxTokens: geminiRequest.generationConfig?.maxOutputTokens
    }, requestId, 'gemini-provider');

    // Execute with enhanced error handling and fallback support
    let response: Response;
    try {
      const url = `${this.baseUrl}/v1beta/models/${modelName}:generateContent?key=${actualApiKey}`;
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
      
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(geminiRequest),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`Gemini API error (${response.status}): ${errorText}`) as any;
          error.status = response.status;
          error.responseText = errorText;
          throw error;
        }
      } catch (error) {
        clearTimeout(timeoutId);
        
        if ((error as any).name === 'AbortError') {
          throw new Error(`Gemini API request timeout after ${this.requestTimeout}ms`);
        }
        throw error;
      }
    } catch (error) {
      // Report error to enhanced rate limit manager
      if (this.enhancedRateLimitManager) {
        const errorStatus = (error as any)?.status || 0;
        const errorDetails = (error as any)?.responseText || (error as any)?.message;
        this.enhancedRateLimitManager.report429Error(
          keyIndex,
          errorDetails || 'Unknown error',
          requestId
        );
      }
      throw error;
    }

    const geminiResponse = await response.json();
    
    // Report success to enhanced rate limit manager
    if (this.enhancedRateLimitManager) {
      const tokensUsed = this.extractTokenUsage(geminiResponse);
      // Enhanced Rate Limit Manager automatically tracks usage internally
    }
    
    // 🔧 Capture raw response for debugging empty response issues
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      try {
        const debugFile = `/tmp/gemini-raw-response-${Date.now()}-${requestId}.json`;
        require('fs').writeFileSync(debugFile, JSON.stringify({
          request: geminiRequest,
          response: geminiResponse,
          actualModel: modelName,
          fallbackApplied,
          fallbackReason,
          keyIndex,
          timestamp: new Date().toISOString(),
          requestId
        }, null, 2));
        logger.debug('Raw Gemini response captured for debugging', { 
          debugFile, 
          fallbackApplied, 
          actualModel: modelName 
        });
      } catch (err) {
        logger.warn('Failed to capture raw response', { error: err instanceof Error ? err.message : String(err) });
      }
    }
    
    const finalResponse = this.convertFromGeminiFormat(geminiResponse, request);
    
    // Update response model to reflect actual model used (important for fallback transparency)
    finalResponse.model = modelName;
    
    return finalResponse;
  }

  async* streamCompletion(request: BaseRequest): AsyncIterable<any> {
    const requestId = request.metadata?.requestId || 'unknown';
    let currentApiKey: string;
    let keyIndex = 0;
    let fallbackApplied = false;
    let fallbackReason: string | undefined;
    let modelName = this.extractModelName(request.model);
    
    try {
      let geminiRequest = {
        ...this.convertToGeminiFormat(request)
      };
      
      // Enhanced Rate Limit Management for streaming
      if (this.enhancedRateLimitManager) {
        const estimatedTokens = this.estimateTokens(request);
        const keyAndModel = this.enhancedRateLimitManager.getAvailableKeyAndModel(
          modelName, 
          estimatedTokens, 
          requestId
        );
        
        currentApiKey = this.apiKeys[keyAndModel.keyIndex];
        keyIndex = keyAndModel.keyIndex;
        modelName = keyAndModel.model;
        fallbackApplied = keyAndModel.fallbackApplied;
        fallbackReason = keyAndModel.fallbackReason;
        
        if (fallbackApplied) {
          logger.info('Applied Gemini streaming model fallback due to rate limits', {
            originalModel: this.extractModelName(request.model),
            fallbackModel: modelName,
            reason: fallbackReason,
            keyIndex
          }, requestId, 'gemini-provider');
        }
      } else {
        // Get current API key
        currentApiKey = this.getCurrentApiKey(requestId);
      }

      logger.info('Starting optimized Gemini streaming request', {
        model: modelName,
        originalModel: this.extractModelName(request.model),
        messageCount: geminiRequest.contents?.length || 0,
        strategy: 'enhanced-rate-limit-aware',
        fallbackApplied,
        fallbackReason
      }, requestId, 'gemini-provider');
      
      const url = `${this.baseUrl}/v1beta/models/${modelName}:streamGenerateContent?key=${currentApiKey}`;
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
      
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(geminiRequest),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Gemini API error (${response.status}): ${await response.text()}`);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        
        if ((error as any).name === 'AbortError') {
          throw new Error(`Gemini API request timeout after ${this.requestTimeout}ms`);
        }
        throw error;
      }

    if (!response.body) {
      throw new Error('No response body for streaming request');
    }

    // SMART CACHING STRATEGY: Only cache tool calls, stream text transparently
    logger.info('Starting Gemini smart caching strategy', {
      responseStatus: response.status,
      strategy: 'cache_tools_stream_text'
    }, requestId, 'gemini-provider');

    try {
      yield* this.processSmartCachedGeminiStream(response.body, request, requestId);
      
      // Report success to enhanced rate limit manager
      if (this.enhancedRateLimitManager) {
        // Estimate tokens from stream (will be more accurate in real implementation)
        const estimatedTokens = 100; // TODO: Calculate from actual stream content
        // Enhanced Rate Limit Manager automatically tracks usage internally
      } else {
        this.reportApiKeySuccess(currentApiKey!, requestId);
      }
    } catch (error) {
      throw error;
    }

    } catch (error) {
      logger.error(`${this.name} streaming request failed`, error, requestId, 'gemini-provider');
      
      // Report error to enhanced rate limit manager
      if (this.enhancedRateLimitManager && currentApiKey!) {
        const errorStatus = (error as any)?.status || 0;
        const errorDetails = (error as any)?.responseText || (error as any)?.message;
        this.enhancedRateLimitManager.report429Error(
          keyIndex,
          errorDetails || 'Unknown error',
          requestId
        );
      } else if (currentApiKey!) {
        const isRateLimit = (error as any)?.status === 429;
        this.reportApiKeyError(currentApiKey!, isRateLimit, requestId);
      }
      
      // 🔧 新架构: 不抛出ProviderError，防止Provider级别拉黑
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`${this.name} streaming request failed: ${errorMessage}`);
    }
  }

  private extractModelName(model: string): string {
    // Convert common model names to Gemini format
    const modelMappings: Record<string, string> = {
      'gemini-pro': 'gemini-1.5-pro',
      'gemini-flash': 'gemini-1.5-flash',
      'gemini-2.5-pro': 'gemini-2.5-pro',
      'gemini-2.5-flash': 'gemini-2.5-flash'
    };

    return modelMappings[model] || model;
  }

  private convertToGeminiFormat(request: BaseRequest): any {
    const geminiRequest: any = {
      contents: this.convertMessages(request.messages),
      generationConfig: {
        maxOutputTokens: request.max_tokens || 4096
      }
    };

    // Add temperature if specified
    if (request.temperature !== undefined) {
      geminiRequest.generationConfig.temperature = request.temperature;
    }

    // Handle tools if present - Check both top-level and metadata
    const tools = request.tools || request.metadata?.tools;
    if (tools && Array.isArray(tools) && tools.length > 0) {
      // 🔧 修复: Gemini API正确的工具格式是tools数组，不是单个对象
      geminiRequest.tools = [this.convertTools(tools)];
      logger.debug('Converted tools for Gemini request (fixed format)', {
        toolCount: tools.length,
        toolNames: tools.map((t: any) => t.name),
        geminiToolsFormat: 'array with functionDeclarations object'
      });
    }

    return geminiRequest;
  }

  private convertMessages(messages: Array<{ role: string; content: any }>): any[] {
    const contents: any[] = [];
    
    for (const message of messages) {
      if (message.role === 'system') {
        // System messages are treated as user messages in Gemini
        const textContent = this.extractTextContent(message.content);
        contents.push({
          role: 'user',
          parts: [{ text: textContent }]
        });
      } else if (message.role === 'user') {
        const textContent = this.extractTextContent(message.content);
        contents.push({
          role: 'user',
          parts: [{ text: textContent }]
        });
      } else if (message.role === 'assistant') {
        // 🔧 Fixed: Handle assistant messages with tool_use and text content
        const parts = this.convertAssistantContent(message.content);
        if (parts.length > 0) {
          contents.push({
            role: 'model',
            parts: parts
          });
        }
      } else if (message.role === 'tool') {
        // 🔧 Fixed: Handle tool result messages for conversation history
        const toolContent = this.convertToolResultContent(message);
        contents.push({
          role: 'user',
          parts: [{ text: toolContent }]
        });
      }
    }

    return contents;
  }

  /**
   * Extract text content from various content formats
   */
  private extractTextContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    } else if (Array.isArray(content)) {
      // Anthropic格式：content是一个数组，提取text类型的内容
      return content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');
    } else if (content && typeof content === 'object') {
      // 其他对象格式
      return content.text || JSON.stringify(content);
    } else {
      return String(content || '');
    }
  }

  /**
   * Convert assistant content to Gemini parts format
   * Handle both text and tool_use content blocks
   */
  private convertAssistantContent(content: any): any[] {
    const parts: any[] = [];
    
    if (typeof content === 'string') {
      // Simple text content
      if (content.trim()) {
        parts.push({ text: content });
      }
    } else if (Array.isArray(content)) {
      // Anthropic format: array of content blocks
      for (const block of content) {
        if (block.type === 'text' && block.text) {
          parts.push({ text: block.text });
        } else if (block.type === 'tool_use') {
          // 🔧 Convert tool_use to Gemini functionCall format
          parts.push({
            functionCall: {
              name: block.name,
              args: block.input || {}
            }
          });
        }
      }
    } else if (content && typeof content === 'object') {
      // Other object formats
      const textContent = content.text || JSON.stringify(content);
      if (textContent.trim()) {
        parts.push({ text: textContent });
      }
    }

    return parts;
  }

  /**
   * Convert tool result message to text format for Gemini
   */
  private convertToolResultContent(message: any): string {
    const toolCallId = message.tool_call_id || 'unknown';
    const content = message.content || '';
    
    // Format tool result as readable text for conversation history
    return `Tool "${toolCallId}" result: ${typeof content === 'string' ? content : JSON.stringify(content)}`;
  }

  private convertTools(tools: any[]): any {
    // Convert Anthropic/OpenAI tools to Gemini function declarations
    // Gemini expects: { functionDeclarations: [...] } (single object, not array)
    const functionDeclarations = tools.map(tool => {
      // Handle both Anthropic format (tool.input_schema) and OpenAI format (tool.function.parameters)
      const rawParameters = tool.input_schema || tool.function?.parameters || {};
      
      // 🔧 Critical Fix: Clean JSON Schema for Gemini API compatibility
      // Gemini API doesn't support additionalProperties, $schema, and other JSON Schema metadata
      const parameters = this.cleanJsonSchemaForGemini(rawParameters);
      
      return {
        name: tool.name,
        description: tool.description || tool.function?.description || '',
        parameters: parameters
      };
    });
    
    return {
      functionDeclarations: functionDeclarations
    };
  }

  /**
   * Clean JSON Schema object for Gemini API compatibility
   * Removes fields that Gemini API doesn't support
   */
  private cleanJsonSchemaForGemini(schema: any): any {
    if (!schema || typeof schema !== 'object') {
      return schema;
    }

    const cleaned: any = {};
    
    // Gemini API supported fields for schema
    const supportedFields = ['type', 'properties', 'required', 'items', 'description', 'enum'];
    
    for (const [key, value] of Object.entries(schema)) {
      if (supportedFields.includes(key)) {
        if (key === 'properties' && typeof value === 'object') {
          // Recursively clean properties
          cleaned[key] = {};
          for (const [propKey, propValue] of Object.entries(value as any)) {
            cleaned[key][propKey] = this.cleanJsonSchemaForGemini(propValue);
          }
        } else if (key === 'items' && typeof value === 'object') {
          // Recursively clean array items schema
          cleaned[key] = this.cleanJsonSchemaForGemini(value);
        } else {
          cleaned[key] = value;
        }
      }
      // Skip unsupported fields like: additionalProperties, $schema, minItems, maxItems, etc.
    }
    
    return cleaned;
  }

  private convertFromGeminiFormat(geminiResponse: any, originalRequest: BaseRequest): BaseResponse {
    const candidate = geminiResponse.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    
    // 🔧 Enhanced debugging for empty response diagnosis
    logger.debug('Converting Gemini response to Anthropic format', {
      candidatesCount: geminiResponse.candidates?.length || 0,
      partsCount: parts.length,
      finishReason: candidate?.finishReason,
      hasUsageMetadata: !!geminiResponse.usageMetadata,
      safetyRatings: candidate?.safetyRatings,
      requestId: originalRequest.metadata?.requestId || 'unknown'
    });
    
    // Extract usage information
    const usageMetadata = geminiResponse.usageMetadata || {};
    
    // Convert parts to Anthropic content format
    const content: any[] = [];
    
    for (const part of parts) {
      if (part.text) {
        // Text content
        content.push({
          type: 'text',
          text: part.text
        });
      } else if (part.functionCall) {
        // Tool use content - convert Gemini functionCall to Anthropic tool_use
        content.push({
          type: 'tool_use',
          id: `toolu_${Date.now()}_${content.length}`,
          name: part.functionCall.name,
          input: part.functionCall.args || {}
        });
      }
    }
    
    // If no content found, add helpful default response instead of empty text
    if (content.length === 0) {
      content.push({
        type: 'text',
        text: 'I apologize, but I cannot provide a response at the moment. This may be due to content filtering, API limitations, or quota restrictions. Please try rephrasing your question or try again later.'
      });
    }
    
    // 🔧 Log conversion results for debugging
    logger.debug('Gemini response conversion completed', {
      contentBlocks: content.length,
      textBlocks: content.filter(c => c.type === 'text').length,
      toolBlocks: content.filter(c => c.type === 'tool_use').length,
      isEmpty: content.length === 1 && content[0].type === 'text' && (!content[0].text || content[0].text.trim() === ''),
      requestId: originalRequest.metadata?.requestId || 'unknown'
    });
    
    return {
      id: `gemini_${Date.now()}`,
      type: 'message',
      model: originalRequest.model,
      role: 'assistant',
      content: content,
      stop_reason: this.mapFinishReason(candidate?.finishReason),
      stop_sequence: null,
      usage: {
        input_tokens: usageMetadata.promptTokenCount || 0,
        output_tokens: usageMetadata.candidatesTokenCount || 0
      }
    };
  }

  private mapFinishReason(finishReason?: string): string {
    const reasonMap: Record<string, string> = {
      'STOP': 'end_turn',
      'MAX_TOKENS': 'max_tokens',
      'SAFETY': 'stop_sequence',
      'RECITATION': 'stop_sequence',
      'OTHER': 'end_turn'
    };

    return reasonMap[finishReason || 'OTHER'] || 'end_turn';
  }

  /**
   * Detect if response was blocked by Content Safety
   */
  private detectContentSafetyBlock(geminiResponse: any): { blocked: boolean, reason?: string, details?: string } {
    const candidate = geminiResponse.candidates?.[0];
    
    // Check finish reason
    if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'RECITATION') {
      return { blocked: true, reason: candidate.finishReason };
    }
    
    // Check safety ratings
    const blockedRatings = candidate?.safetyRatings?.filter((rating: any) => rating.blocked === true);
    if (blockedRatings?.length > 0) {
      return { 
        blocked: true, 
        reason: 'SAFETY_RATINGS',
        details: blockedRatings.map((r: any) => r.category).join(', ')
      };
    }
    
    return { blocked: false };
  }

  /**
   * Get current API key for request
   */
  private getCurrentApiKey(requestId?: string): string {
    if (this.apiKeyRotationManager) {
      return this.apiKeyRotationManager.getNextApiKey(requestId);
    }
    return this.apiKey;
  }

  /**
   * Estimate token usage for a request (for rate limiting)
   */
  private estimateTokens(request: BaseRequest): number {
    let totalTokens = 0;
    
    // Estimate based on message content
    for (const message of request.messages || []) {
      const textContent = this.extractTextContent(message.content);
      totalTokens += Math.ceil(textContent.length / 4); // Rough estimation: 4 chars = 1 token
    }
    
    // Add some buffer for tools and other metadata
    if (request.tools && request.tools.length > 0) {
      totalTokens += request.tools.length * 50; // Estimate 50 tokens per tool definition
    }
    
    return Math.max(totalTokens, 100); // Minimum 100 tokens
  }

  /**
   * Extract token usage from Gemini response
   */
  private extractTokenUsage(geminiResponse: any): number {
    const usageMetadata = geminiResponse.usageMetadata || {};
    return (usageMetadata.promptTokenCount || 0) + (usageMetadata.candidatesTokenCount || 0);
  }

  /**
   * Report success to rotation manager
   */
  private reportApiKeySuccess(apiKey: string, requestId?: string): void {
    if (this.apiKeyRotationManager) {
      this.apiKeyRotationManager.reportSuccess(apiKey, requestId);
    }
  }

  /**
   * Report error to rotation manager
   */
  private reportApiKeyError(apiKey: string, isRateLimit: boolean, requestId?: string): void {
    if (this.apiKeyRotationManager) {
      this.apiKeyRotationManager.reportError(apiKey, isRateLimit, requestId);
    }
  }

  /**
   * Check if error is retryable (429, 502, 503, 504)
   */
  private isRetryableError(error: any): boolean {
    const status = error?.status || error?.response?.status;
    if (status) {
      return status === 429 || status === 502 || status === 503 || status === 504;
    }
    return false;
  }

  /**
   * Wait for retry delay - 429 specific: 3 retries with 60s wait on 3rd retry
   */
  private async waitForRetry(attempt: number, isRateLimited: boolean = false): Promise<void> {
    let delay: number;
    
    if (isRateLimited) {
      // For 429 errors: 1s, 5s, 60s delays
      if (attempt === 0) delay = 1000;      // 1st retry: 1s
      else if (attempt === 1) delay = 5000;  // 2nd retry: 5s  
      else delay = 60000;                    // 3rd retry: 60s
    } else {
      // For other retryable errors: exponential backoff
      delay = this.retryDelay * Math.pow(2, attempt);
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Execute request with retry logic and API key rotation
   */
  private async executeWithRetry<T>(
    requestFn: (apiKey: string) => Promise<T>,
    operation: string,
    requestId: string
  ): Promise<T> {
    let lastError: any;
    let currentApiKey: string;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Get current API key for this attempt
        currentApiKey = this.getCurrentApiKey(requestId);
        
        const result = await requestFn(currentApiKey);
        
        // Report success to rotation manager
        this.reportApiKeySuccess(currentApiKey, requestId);
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Report error to rotation manager
        const isRateLimited = (error as any)?.status === 429 || 
                             (error as any)?.response?.status === 429;
        this.reportApiKeyError(currentApiKey!, isRateLimited, requestId);
        
        if (attempt === this.maxRetries || !this.isRetryableError(error)) {
          break;
        }
        
        const delayInfo = isRateLimited ? 
          (attempt === 0 ? '1s' : attempt === 1 ? '5s' : '60s') : 
          `${this.retryDelay * Math.pow(2, attempt)}ms`;
        
        logger.warn(`${operation} failed, will retry`, {
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          error: error instanceof Error ? error.message : String(error),
          status: (error as any)?.status || (error as any)?.response?.status,
          nextRetryDelay: delayInfo,
          isRateLimited,
          currentApiKey: currentApiKey! ? `***${currentApiKey!.slice(-4)}` : 'none'
        }, requestId, 'gemini-provider');
        
        await this.waitForRetry(attempt, isRateLimited);
      }
    }
    
    // 🔧 新架构: 检查是否所有API Key都不可用
    if (this.apiKeyRotationManager) {
      const stats = this.apiKeyRotationManager.getStats();
      const allKeysBlocked = stats.activeKeys === 0 && stats.totalKeys > 0;
      
      if (allKeysBlocked) {
        logger.warn('All Gemini API keys are temporarily unavailable', {
          totalKeys: stats.totalKeys,
          rateLimitedKeys: stats.rateLimitedKeys,
          disabledKeys: stats.disabledKeys,
          waitForRecovery: '60s'
        }, requestId, 'gemini-provider');
        
        // 不抛出ProviderError，返回一个简单的错误响应
        // 这样SimpleProviderManager不会拉黑整个Provider
        throw new Error(`All ${stats.totalKeys} Gemini API keys temporarily unavailable. Will recover automatically.`);
      }
    }
    
    // 如果不是所有Key都失败，这可能是真正的服务问题
    if ((lastError as any)?.status === 429 || (lastError as any)?.response?.status === 429) {
      throw new Error(`Gemini rate limit - will retry with different API key`);
    }
    
    throw lastError;
  }

  /**
   * 处理包含工具调用的缓冲响应（直接Gemini到Anthropic转换）
   */
  private async *processBufferedToolResponse(fullResponseBuffer: string, request: BaseRequest, requestId: string): AsyncIterable<any> {
    logger.info('Processing Gemini tool response with direct Anthropic conversion', {
      bufferLength: fullResponseBuffer.length
    }, requestId, 'gemini-tool-processor');

    try {
      // 解析Gemini响应
      const parsedContent = JSON.parse(fullResponseBuffer);
      const geminiEvents = Array.isArray(parsedContent) ? parsedContent : [parsedContent];

      logger.debug('Parsed Gemini events for tool processing', {
        eventCount: geminiEvents.length
      }, requestId, 'gemini-tool-processor');

      // 🔧 直接转换为Anthropic格式
      const anthropicEvents = this.convertGeminiToAnthropicStream(geminiEvents, request, requestId);

      logger.info('Direct Gemini to Anthropic conversion completed', {
        streamEventCount: anthropicEvents.length,
        strategy: 'direct-gemini-to-anthropic'
      }, requestId, 'gemini-tool-processor');

      // 输出所有事件
      for (const streamEvent of anthropicEvents) {
        yield streamEvent;
      }

    } catch (error) {
      logger.error('Failed to process Gemini tool response', error, requestId, 'gemini-tool-processor');
      throw error;
    }
  }

  /**
   * 直接将Gemini事件转换为Anthropic流式事件
   * 🔧 处理文本和工具调用
   */
  private convertGeminiToAnthropicStream(geminiEvents: any[], request: BaseRequest, requestId: string): any[] {
    const events: any[] = [];
    const messageId = `msg_${Date.now()}`;
    let inputTokens = 0;
    let outputTokens = 0;
    let contentIndex = 0;

    // 提取所有内容
    const contentBlocks: any[] = [];
    
    for (const event of geminiEvents) {
      if (event.candidates && event.candidates[0] && event.candidates[0].content) {
        const parts = event.candidates[0].content.parts || [];
        
        for (const part of parts) {
          if (part.text) {
            // 文本内容
            contentBlocks.push({
              type: 'text',
              text: part.text
            });
          } else if (part.functionCall) {
            // 🔧 工具调用转换
            contentBlocks.push({
              type: 'tool_use',
              id: `toolu_${Date.now()}_${contentIndex++}`,
              name: part.functionCall.name,
              input: part.functionCall.args || {}
            });
            
            logger.debug('Converted Gemini functionCall to Anthropic tool_use', {
              functionName: part.functionCall.name,
              args: part.functionCall.args
            }, requestId, 'gemini-tool-processor');
          }
        }
      }
      
      // 聚合token信息
      if (event.usageMetadata) {
        inputTokens = Math.max(inputTokens, event.usageMetadata.promptTokenCount || 0);
        outputTokens += event.usageMetadata.candidatesTokenCount || 0;
      }
    }

    // 估算tokens如果没有提供
    if (outputTokens === 0) {
      const textLength = contentBlocks
        .filter(block => block.type === 'text')
        .reduce((sum, block) => sum + (block.text?.length || 0), 0);
      outputTokens = Math.ceil((textLength + contentBlocks.filter(b => b.type === 'tool_use').length * 50) / 4);
    }

    // 生成Anthropic流式事件
    // 1. message_start
    events.push({
      event: 'message_start',
      data: {
        type: 'message_start',
        message: {
          id: messageId,
          type: 'message',
          role: 'assistant',
          content: [],
          model: request.model,
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: inputTokens, output_tokens: 0 }
        }
      }
    });

    // 2. ping
    events.push({
      event: 'ping',
      data: { type: 'ping' }
    });

    // 3. 为每个内容块生成事件
    contentBlocks.forEach((block, index) => {
      // content_block_start
      events.push({
        event: 'content_block_start',
        data: {
          type: 'content_block_start',
          index: index,
          content_block: block
        }
      });

      if (block.type === 'text' && block.text) {
        // 为文本生成delta事件
        const chunkSize = 20;
        for (let i = 0; i < block.text.length; i += chunkSize) {
          const chunk = block.text.slice(i, i + chunkSize);
          events.push({
            event: 'content_block_delta',
            data: {
              type: 'content_block_delta',
              index: index,
              delta: {
                type: 'text_delta',
                text: chunk
              }
            }
          });
        }
      }

      // content_block_stop
      events.push({
        event: 'content_block_stop',
        data: {
          type: 'content_block_stop',
          index: index
        }
      });
    });

    // 4. message_delta (with usage)
    events.push({
      event: 'message_delta',
      data: {
        type: 'message_delta',
        delta: {},
        usage: {
          output_tokens: outputTokens
        }
      }
    });

    // 5. message_stop
    events.push({
      event: 'message_stop',
      data: {
        type: 'message_stop'
      }
    });

    logger.debug('Generated Anthropic stream events', {
      eventCount: events.length,
      contentBlocks: contentBlocks.length,
      textBlocks: contentBlocks.filter(b => b.type === 'text').length,
      toolBlocks: contentBlocks.filter(b => b.type === 'tool_use').length,
      outputTokens
    }, requestId, 'gemini-tool-processor');

    return events;
  }

  /**
   * 处理纯文本响应（智能流式传输 - 学习OpenAI方式）
   */
  private async *processStreamingTextResponse(fullResponseBuffer: string, request: BaseRequest, requestId: string): AsyncIterable<any> {
    logger.info('Processing Gemini text response with smart streaming strategy (OpenAI-style)', {
      bufferLength: fullResponseBuffer.length,
      strategy: 'smart-text-streaming'
    }, requestId, 'gemini-stream-processor');

    try {
      // 解析响应提取文本
      const parsedContent = JSON.parse(fullResponseBuffer);
      const geminiEvents = Array.isArray(parsedContent) ? parsedContent : [parsedContent];
      
      // 提取所有文本内容
      let fullText = '';
      let inputTokens = 0;
      let outputTokens = 0;
      
      for (const event of geminiEvents) {
        if (event.candidates && event.candidates[0] && event.candidates[0].content) {
          const parts = event.candidates[0].content.parts || [];
          for (const part of parts) {
            if (part.text) {
              fullText += part.text;
            }
          }
        }
        
        // 聚合token信息
        if (event.usageMetadata) {
          inputTokens = Math.max(inputTokens, event.usageMetadata.promptTokenCount || 0);
          outputTokens += event.usageMetadata.candidatesTokenCount || 0;
        }
      }

      // 估算tokens（如果没有提供）
      if (outputTokens === 0 && fullText) {
        outputTokens = Math.ceil(fullText.length / 4);
      }

      logger.debug('Extracted text content for streaming', {
        textLength: fullText.length,
        inputTokens,
        outputTokens,
        estimatedTokens: outputTokens === Math.ceil(fullText.length / 4)
      }, requestId, 'gemini-stream-processor');

      // 🚀 智能流式事件生成 - 立即开始输出，避免等待
      const messageId = `msg_${Date.now()}`;
      
      // 发送message_start
      yield {
        event: 'message_start',
        data: {
          type: 'message_start',
          message: {
            id: messageId,
            type: 'message',
            role: 'assistant',
            content: [],
            model: request.model,
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: inputTokens, output_tokens: 0 }
          }
        }
      };

      // 发送ping
      yield {
        event: 'ping',
        data: { type: 'ping' }
      };

      // 发送content_block_start
      yield {
        event: 'content_block_start',
        data: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' }
        }
      };

      // 🔥 智能分块策略：根据内容长度调整chunk大小和延迟
      const contentLength = fullText.length;
      let chunkSize: number;
      let delayMs: number;
      
      if (contentLength > 10000) {
        // 长内容：大块快速传输
        chunkSize = 50;
        delayMs = 5;
      } else if (contentLength > 1000) {
        // 中等内容：适中块适中延迟
        chunkSize = 20;
        delayMs = 8;
      } else {
        // 短内容：小块慢速传输（更好的用户体验）
        chunkSize = 10;
        delayMs = 15;
      }
      
      logger.debug('Smart chunking strategy selected', {
        contentLength,
        chunkSize,
        delayMs,
        estimatedChunks: Math.ceil(contentLength / chunkSize)
      }, requestId, 'gemini-stream-processor');

      // 分块发送文本内容（智能流式体验）
      let sentChunks = 0;
      for (let i = 0; i < fullText.length; i += chunkSize) {
        const chunk = fullText.slice(i, i + chunkSize);
        sentChunks++;
        
        yield {
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: 0,
            delta: {
              type: 'text_delta',
              text: chunk
            }
          }
        };
        
        // 智能延迟：前几个块立即发送，后续添加延迟
        if (sentChunks > 3) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      // 发送结束事件
      yield {
        event: 'content_block_stop',
        data: {
          type: 'content_block_stop',
          index: 0
        }
      };

      yield {
        event: 'message_delta',
        data: {
          type: 'message_delta',
          delta: {},
          usage: {
            output_tokens: outputTokens
          }
        }
      };

      yield {
        event: 'message_stop',
        data: {
          type: 'message_stop'
        }
      };

      logger.info('Smart text streaming completed', {
        textLength: fullText.length,
        outputTokens: outputTokens,
        totalChunks: sentChunks,
        chunkSize,
        delayMs,
        strategy: 'smart-text-streaming'
      }, requestId, 'gemini-stream-processor');

    } catch (error) {
      logger.error('Failed to process Gemini smart text response', error, requestId, 'gemini-stream-processor');
      throw error;
    }
  }

  /**
   * 实时提取Gemini响应中的内容并生成流式事件
   */
  private extractAndYieldContent(buffer: string, currentTokens: number, requestId: string, isFinal: boolean = false): { events: any[], totalTokens: number } {
    const events: any[] = [];
    let totalTokens = currentTokens;
    
    try {
      // 尝试解析JSON数组格式的Gemini响应
      const parsedContent = JSON.parse(buffer);
      const geminiEvents = Array.isArray(parsedContent) ? parsedContent : [parsedContent];
      
      // 提取新的文本内容
      let newText = '';
      for (const event of geminiEvents) {
        if (event.candidates && event.candidates[0] && event.candidates[0].content) {
          const parts = event.candidates[0].content.parts || [];
          for (const part of parts) {
            if (part.text) {
              newText += part.text;
            }
          }
        }
      }
      
      // 如果有新内容，生成content_block_delta事件
      if (newText) {
        // 按小块发送以模拟真实流式体验
        const chunkSize = 20;
        for (let i = 0; i < newText.length; i += chunkSize) {
          const chunk = newText.slice(i, i + chunkSize);
          events.push({
            event: 'content_block_delta',
            data: {
              type: 'content_block_delta',
              index: 0,
              delta: {
                type: 'text_delta',
                text: chunk
              }
            }
          });
          
          // 更新token计数（粗略估算：4字符=1token）
          totalTokens += Math.ceil(chunk.length / 4);
        }
        
        logger.debug('Extracted content from Gemini buffer', {
          textLength: newText.length,
          chunkCount: Math.ceil(newText.length / chunkSize),
          newTokens: Math.ceil(newText.length / 4),
          totalTokens
        }, requestId, 'gemini-real-time');
      }
      
    } catch (error) {
      // 如果不是完整的JSON，只在最终处理时记录
      if (isFinal) {
        logger.debug('Buffer does not contain complete JSON, skipping extraction', {
          bufferLength: buffer.length,
          bufferPreview: buffer.slice(0, 100)
        }, requestId, 'gemini-real-time');
      }
    }
    
    return { events, totalTokens };
  }

  /**
   * Convert OpenAI buffered response to OpenAI streaming events format
   */
  private convertToOpenAIEvents(bufferedResponse: any, requestId: string): any[] {
    const content = bufferedResponse.choices?.[0]?.message?.content || '';
    const usage = bufferedResponse.usage || {};
    
    // Create OpenAI streaming events similar to real OpenAI API
    const events: any[] = [];
    
    // Add chunks for content (simulate streaming)
    const chunkSize = 10; // Characters per chunk to simulate realistic streaming
    for (let i = 0; i < content.length; i += chunkSize) {
      const chunk = content.slice(i, i + chunkSize);
      events.push({
        id: bufferedResponse.id,
        object: 'chat.completion.chunk',
        created: bufferedResponse.created,
        model: bufferedResponse.model,
        choices: [{
          index: 0,
          delta: {
            content: chunk
          },
          finish_reason: null
        }]
      });
    }
    
    // Add final event with finish reason and usage
    events.push({
      id: bufferedResponse.id,
      object: 'chat.completion.chunk',
      created: bufferedResponse.created,
      model: bufferedResponse.model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop'
      }],
      usage: usage
    });
    
    logger.debug('Converted to OpenAI streaming events', {
      originalLength: content.length,
      eventCount: events.length,
      chunkSize
    }, requestId, 'gemini-buffered-processor');
    
    return events;
  }

  /**
   * Convert Gemini events array to OpenAI buffered response format
   * 🔧 Critical Fix: Handle both text and function calls from Gemini
   */
  private convertGeminiToOpenAIBuffered(geminiEvents: any[], requestId: string): any {
    // Extract all content from Gemini events - both text and tool calls
    let fullText = '';
    const toolCalls: any[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let toolCallIndex = 0;
    
    for (const event of geminiEvents) {
      if (event.candidates && event.candidates[0] && event.candidates[0].content) {
        const parts = event.candidates[0].content.parts || [];
        for (const part of parts) {
          // Handle text content
          if (part.text) {
            fullText += part.text;
          }
          
          // 🔧 Critical Fix: Handle function calls from Gemini
          if (part.functionCall) {
            const toolCall = {
              index: toolCallIndex++,
              id: `call_${Date.now()}_${toolCallIndex}`,
              type: 'function',
              function: {
                name: part.functionCall.name,
                arguments: JSON.stringify(part.functionCall.args || {})
              }
            };
            toolCalls.push(toolCall);
            
            logger.debug('Converted Gemini functionCall to OpenAI tool_call', {
              functionName: part.functionCall.name,
              args: part.functionCall.args,
              toolCallId: toolCall.id
            }, requestId, 'gemini-buffered-processor');
          }
        }
      }
      
      // Aggregate usage metadata
      if (event.usageMetadata) {
        inputTokens = Math.max(inputTokens, event.usageMetadata.promptTokenCount || 0);
        outputTokens += event.usageMetadata.candidatesTokenCount || 0;
      }
    }
    
    // Estimate tokens if not provided
    if (outputTokens === 0 && (fullText || toolCalls.length > 0)) {
      outputTokens = Math.ceil((fullText.length + toolCalls.length * 50) / 4); // Rough estimation
    }
    
    logger.debug('Gemini to OpenAI conversion with tool calls', {
      geminiEvents: geminiEvents.length,
      fullTextLength: fullText.length,
      toolCallCount: toolCalls.length,
      inputTokens,
      outputTokens
    }, requestId, 'gemini-buffered-processor');
    
    // 🔧 Create OpenAI-compatible buffered response with tool calls
    const message: any = {
      role: 'assistant'
    };

    // OpenAI format: if there are tool calls, content should be null or empty
    // If there's only text, content should be the text
    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
      message.content = fullText || null;
    } else {
      // Pure text response
      message.content = fullText || '';
    }
    
    return {
      id: `chatcmpl-gemini-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gemini-2.5-pro',
      choices: [{
        index: 0,
        message: message,
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens
      }
    };
  }

  private convertStreamEvent(event: any): any {
    // Convert Gemini streaming events to our standard format
    const candidate = event.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    
    return {
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'text_delta',
        text: part?.text || ''
      },
      content_block: candidate?.content,
      usage: event.usageMetadata ? {
        input_tokens: event.usageMetadata.promptTokenCount || 0,
        output_tokens: event.usageMetadata.candidatesTokenCount || 0
      } : undefined
    };
  }
  
  /**
   * 将流式事件转换为非流式BaseResponse格式
   * 用于统一所有请求都使用智能缓冲策略
   */
  private convertStreamEventsToBaseResponse(streamEvents: any[], originalRequest: BaseRequest, requestId: string): BaseResponse {
    logger.debug('Converting stream events to BaseResponse', {
      eventCount: streamEvents.length
    }, requestId, 'gemini-provider');

    // 提取关键信息
    let messageId = '';
    let content: any[] = [];
    let stopReason = 'end_turn';
    let inputTokens = 0;
    let outputTokens = 0;
    let currentTextBlock = '';

    for (const event of streamEvents) {
      const eventData = event.data || event;
      
      switch (eventData.type) {
        case 'message_start':
          messageId = eventData.message?.id || `gemini_${Date.now()}`;
          if (eventData.message?.usage?.input_tokens) {
            inputTokens = eventData.message.usage.input_tokens;
          }
          break;
          
        case 'content_block_start':
          // 开始新的内容块
          if (eventData.content_block?.type === 'text') {
            currentTextBlock = '';
          }
          break;
          
        case 'content_block_delta':
          // 累积文本内容
          if (eventData.delta?.type === 'text_delta' && eventData.delta.text) {
            currentTextBlock += eventData.delta.text;
          }
          break;
          
        case 'content_block_stop':
          // 完成内容块
          if (currentTextBlock) {
            content.push({
              type: 'text',
              text: currentTextBlock
            });
            currentTextBlock = '';
          }
          break;
          
        case 'message_delta':
          // 提取最终使用情况和停止原因
          if (eventData.delta?.stop_reason) {
            stopReason = eventData.delta.stop_reason;
          }
          if (eventData.usage?.output_tokens) {
            outputTokens = eventData.usage.output_tokens;
          }
          break;
          
        case 'tool_use':
          // 处理工具调用
          if (eventData.id && eventData.name) {
            content.push({
              type: 'tool_use',
              id: eventData.id,
              name: eventData.name,
              input: eventData.input || {}
            });
          }
          break;
      }
    }

    // 如果还有未完成的文本块，添加它
    if (currentTextBlock) {
      content.push({
        type: 'text',
        text: currentTextBlock
      });
    }

    // 如果没有内容，创建空文本块
    if (content.length === 0) {
      content.push({
        type: 'text',
        text: ''
      });
    }

    const response: BaseResponse = {
      id: messageId || `gemini_${Date.now()}`,
      model: originalRequest.model,
      role: 'assistant',
      content: content,
      stop_reason: stopReason,
      stop_sequence: null,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens
      }
    };

    logger.debug('Stream to BaseResponse conversion completed', {
      messageId: response.id,
      contentBlocks: response.content.length,
      totalTextLength: response.content
        .filter(block => block.type === 'text')
        .reduce((sum, block) => sum + (block.text?.length || 0), 0),
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      stopReason: response.stop_reason
    }, requestId, 'gemini-provider');

    return response;
  }

  /**
   * Get API key rotation statistics
   */
  getRotationStats(): any {
    if (this.apiKeyRotationManager) {
      return this.apiKeyRotationManager.getStats();
    }
    return {
      providerId: this.name,
      totalKeys: 1,
      activeKeys: 1,
      rotationEnabled: false
    };
  }

  /**
   * Smart caching strategy for Gemini: Only cache tool calls, stream text transparently
   */
  private async *processSmartCachedGeminiStream(responseBody: ReadableStream, request: BaseRequest, requestId: string): AsyncIterable<any> {
    const reader = responseBody.getReader();
    const decoder = new TextDecoder();
    let fullResponseBuffer = '';
    let hasToolCalls = false;

    logger.debug('Starting Gemini smart cached stream processing', {
      strategy: 'cache_tools_stream_text'
    }, requestId, 'gemini-provider');

    try {
      // First pass: collect response and detect tool calls
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullResponseBuffer += chunk;
        
        // Quick tool call detection without full parsing
        if (!hasToolCalls && (
          fullResponseBuffer.includes('functionCall') || 
          fullResponseBuffer.includes('function_call') ||
          fullResponseBuffer.includes('tool_call') ||
          fullResponseBuffer.includes('function_result')
        )) {
          hasToolCalls = true;
          logger.debug('Tool calls detected in Gemini response', {}, requestId, 'gemini-provider');
        }
      }

      logger.info('Gemini response analysis completed', {
        responseLength: fullResponseBuffer.length,
        hasToolCalls,
        strategy: hasToolCalls ? 'buffered_tool_parsing' : 'direct_streaming'
      }, requestId, 'gemini-provider');

      if (hasToolCalls) {
        // Tool calls detected: use buffered processing for reliability
        logger.info('Using buffered processing for Gemini tool calls', {}, requestId, 'gemini-provider');
        yield* this.processBufferedToolResponse(fullResponseBuffer, request, requestId);
      } else {
        // No tool calls: stream text content directly
        logger.info('Using direct streaming for Gemini text-only response', {}, requestId, 'gemini-provider');
        yield* this.processStreamingTextResponse(fullResponseBuffer, request, requestId);
      }

    } finally {
      reader.releaseLock();
    }
  }
}