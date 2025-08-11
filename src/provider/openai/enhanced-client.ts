/**
 * Enhanced OpenAI Client with LMStudio SDK Integration
 * Author: Jason Zhang
 * 
 * Extends OpenAI Client to support LMStudio SDK detection and automatic fallback
 */

import OpenAI from 'openai';
import { BaseProvider } from '../base-provider.js';
import { AIRequest, AIResponse, ModelInfo, ProviderConfig, AuthResult } from '../../types/interfaces.js';
import { OpenAIConverter } from './converter.js';
import { OpenAIParser } from './parser.js';
import { OpenAIAuth } from './auth.js';
import { CompatibilityPreprocessor } from '../sdk-detection/compatibility-preprocessor.js';
import { LMStudioSDKManager } from '../sdk-detection/lmstudio-sdk-manager.js';
import { LocalModelServerConfig, SDKSelectionStrategy } from '../sdk-detection/types.js';

export class EnhancedOpenAIClient extends BaseProvider {
  private converter: OpenAIConverter;
  private parser: OpenAIParser;
  private auth: OpenAIAuth;
  private openaiSDK?: OpenAI;
  private compatibilityPreprocessor: CompatibilityPreprocessor;
  private lmstudioManager?: LMStudioSDKManager;
  private isLMStudioServer: boolean = false;
  private serverConfig?: LocalModelServerConfig;

  constructor(strategy: SDKSelectionStrategy = 'official-first') {
    super('enhanced-openai', '2.8.0');
    this.converter = new OpenAIConverter();
    this.parser = new OpenAIParser();
    this.auth = new OpenAIAuth();
    this.compatibilityPreprocessor = new CompatibilityPreprocessor(strategy);
  }

  async initialize(config: ProviderConfig): Promise<void> {
    await super.initialize(config);
    
    // Initialize OpenAI-specific authentication
    await this.auth.initialize(config.apiKey || '');
    
    // Detect if this is connecting to a local model server
    const serverConfig = this.detectLocalModelServer(config);
    
    if (serverConfig) {
      this.isLMStudioServer = serverConfig.serverType === 'lmstudio';
      this.serverConfig = serverConfig;
      
      if (this.isLMStudioServer) {
        console.log('🎯 Detected LMStudio server, initializing SDK manager');
        await this.initializeLMStudioSupport(serverConfig);
      }
    }
    
    // Initialize standard OpenAI SDK as fallback or primary
    this.openaiSDK = new OpenAI({
      apiKey: config.apiKey || 'local-key',
      baseURL: config.endpoint || 'https://api.openai.com/v1',
      timeout: config.timeout || 30000,
      maxRetries: config.retryAttempts || 3
    });

    console.log(`✅ Enhanced OpenAI Client initialized (LMStudio support: ${this.isLMStudioServer})`);
  }

  /**
   * Detect if this is a local model server configuration
   */
  private detectLocalModelServer(config: ProviderConfig): LocalModelServerConfig | null {
    const endpoint = config.endpoint || '';
    
    // Check for localhost or local IP patterns
    const isLocal = endpoint.includes('localhost') || 
                   endpoint.includes('127.0.0.1') || 
                   endpoint.includes('0.0.0.0') ||
                   endpoint.match(/192\.168\.\d+\.\d+/) ||
                   endpoint.match(/10\.\d+\.\d+\.\d+/) ||
                   endpoint.match(/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/);
    
    if (!isLocal) {
      return null;
    }

    // Extract host and port
    const urlMatch = endpoint.match(/https?:\/\/([^:]+):?(\d+)?/);
    const host = urlMatch ? urlMatch[1] : 'localhost';
    const port = urlMatch && urlMatch[2] ? parseInt(urlMatch[2]) : (endpoint.includes('1234') ? 1234 : 11434);
    
    // Determine server type based on port and patterns
    let serverType: 'lmstudio' | 'ollama' | 'openai-compatible' = 'openai-compatible';
    if (port === 1234 || endpoint.includes('1234')) {
      serverType = 'lmstudio';
    } else if (port === 11434 || endpoint.includes('11434')) {
      serverType = 'ollama';
    }

    return {
      host,
      port,
      endpoint,
      timeout: config.timeout || 30000,
      maxRetries: config.retryAttempts || 3,
      apiKey: config.apiKey,
      serverType
    };
  }

  /**
   * Initialize LMStudio SDK support
   */
  private async initializeLMStudioSupport(serverConfig: LocalModelServerConfig): Promise<void> {
    try {
      this.lmstudioManager = new LMStudioSDKManager();
      await this.lmstudioManager.initialize(serverConfig);
      console.log('🎯 LMStudio SDK Manager initialized successfully');
    } catch (error) {
      console.warn('⚠️ Failed to initialize LMStudio SDK support, using OpenAI fallback:', error.message);
      this.lmstudioManager = undefined;
    }
  }

  async processRequest(request: AIRequest): Promise<AIResponse> {
    // If this is a LMStudio server and we have compatibility preprocessor
    if (this.isLMStudioServer && this.serverConfig) {
      try {
        return await this.processWithCompatibilityPreprocessor(request);
      } catch (error) {
        console.warn('⚠️ Compatibility preprocessor failed, falling back to standard OpenAI:', error.message);
        return await this.processWithStandardOpenAI(request);
      }
    }

    // Standard OpenAI processing
    return await this.processWithStandardOpenAI(request);
  }

  /**
   * Process request using compatibility preprocessor (for LMStudio)
   */
  private async processWithCompatibilityPreprocessor(request: AIRequest): Promise<AIResponse> {
    if (!this.serverConfig) {
      throw new Error('Server configuration not available');
    }

    console.log('🔄 Processing request with compatibility preprocessor');
    return await this.compatibilityPreprocessor.processRequest(request, this.serverConfig);
  }

  /**
   * Process request using standard OpenAI SDK
   */
  private async processWithStandardOpenAI(request: AIRequest): Promise<AIResponse> {
    if (!this.openaiSDK) {
      throw new Error('OpenAI SDK not initialized');
    }

    try {
      // Validate authentication if not local
      if (!this.isLMStudioServer && !await this.validateToken()) {
        const authResult = await this.refreshToken();
        if (!authResult.success) {
          throw new Error('Authentication failed');
        }
      }

      // Convert request to OpenAI format
      const openaiRequest = await this.converter.toOpenAIFormat(request);
      
      // Apply LMStudio-specific preprocessing if needed
      const preprocessedRequest = this.isLMStudioServer 
        ? this.applyLMStudioPreprocessing(openaiRequest)
        : openaiRequest;

      // Make API call using official SDK
      let response;
      if (request.stream) {
        response = await this.handleStreamingRequest(preprocessedRequest);
      } else {
        response = await this.openaiSDK.chat.completions.create({
          model: preprocessedRequest.model,
          messages: preprocessedRequest.messages,
          tools: preprocessedRequest.tools,
          tool_choice: preprocessedRequest.tool_choice,
          temperature: preprocessedRequest.temperature,
          max_tokens: preprocessedRequest.max_tokens,
          top_p: preprocessedRequest.top_p,
          frequency_penalty: preprocessedRequest.frequency_penalty,
          presence_penalty: preprocessedRequest.presence_penalty,
          stop: preprocessedRequest.stop,
          stream: false
        });
      }

      // Apply LMStudio-specific post-processing if needed
      const processedResponse = this.isLMStudioServer 
        ? this.applyLMStudioPostprocessing(response)
        : response;

      // Parse and convert response
      return await this.parser.parseResponse(processedResponse);
      
    } catch (error) {
      const providerError = this.handleSDKError(error);
      
      if (this.shouldRetry(providerError)) {
        await this.delay(providerError.retryAfter || 1000);
        return this.processWithStandardOpenAI(request);
      }
      
      throw providerError;
    }
  }

  /**
   * Apply LMStudio-specific preprocessing to OpenAI request
   */
  private applyLMStudioPreprocessing(openaiRequest: any): any {
    console.log('🔧 Applying LMStudio preprocessing to OpenAI request');
    
    // Clone to avoid mutations
    const preprocessedRequest = { ...openaiRequest };

    // Add LMStudio-specific metadata
    preprocessedRequest.metadata = {
      ...preprocessedRequest.metadata,
      serverType: 'lmstudio',
      preprocessor: 'enhanced-openai-client'
    };

    return preprocessedRequest;
  }

  /**
   * Apply LMStudio-specific post-processing to response
   */
  private applyLMStudioPostprocessing(response: any): any {
    console.log('🔧 Applying LMStudio post-processing to response');

    // Fix embedded tool calls if present (LMStudio specific issue)
    return this.fixLMStudioEmbeddedToolCalls(response);
  }

  /**
   * Fix LMStudio embedded tool calls
   */
  private fixLMStudioEmbeddedToolCalls(response: any): any {
    if (!response.choices || response.choices.length === 0) {
      return response;
    }

    const choice = response.choices[0];
    const content = choice.message?.content;

    if (typeof content !== 'string') {
      return response;
    }

    // Look for embedded tool calls in <tool_call> tags
    const toolCallRegex = /<tool_call>\s*(\{.*?\})\s*<\/tool_call>/s;
    const match = content.match(toolCallRegex);

    if (match) {
      try {
        const toolCallContent = JSON.parse(match[1]);
        
        const newToolCall = {
          id: `call_${Date.now()}`,
          type: 'function',
          function: {
            name: toolCallContent.name,
            arguments: JSON.stringify(toolCallContent.arguments)
          }
        };

        // Remove tool call from content and add to tool_calls array
        const newContent = content.replace(toolCallRegex, '').trim();
        
        console.log('🔧 Fixed embedded tool call in LMStudio response');
        
        return {
          ...response,
          choices: [{
            ...choice,
            message: {
              ...choice.message,
              content: newContent || null,
              tool_calls: [newToolCall]
            },
            finish_reason: 'tool_calls'
          }]
        };
      } catch (error) {
        console.warn('⚠️ Failed to parse embedded tool call:', error.message);
      }
    }

    return response;
  }

  private async handleStreamingRequest(openaiRequest: any): Promise<any> {
    if (!this.openaiSDK) {
      throw new Error('OpenAI SDK not initialized');
    }

    const stream = await this.openaiSDK.chat.completions.create({
      ...openaiRequest,
      stream: true
    });

    // Collect streaming response
    let fullResponse = {
      id: '',
      object: 'chat.completion',
      created: Date.now(),
      model: openaiRequest.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant' as const,
          content: ''
        },
        finish_reason: null
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };

    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        fullResponse.choices[0].message.content += chunk.choices[0].delta.content;
      }
      
      if (chunk.choices[0]?.finish_reason) {
        fullResponse.choices[0].finish_reason = chunk.choices[0].finish_reason;
      }

      if (chunk.id) {
        fullResponse.id = chunk.id;
      }

      if (chunk.usage) {
        fullResponse.usage = chunk.usage;
      }
    }

    return fullResponse;
  }

  async getModels(): Promise<ModelInfo[]> {
    // If this is LMStudio and we have the manager, try to get models from it first
    if (this.isLMStudioServer && this.lmstudioManager) {
      try {
        const lmstudioModels = await this.getLMStudioModels();
        if (lmstudioModels.length > 0) {
          return lmstudioModels;
        }
      } catch (error) {
        console.warn('⚠️ Failed to get models from LMStudio manager, using fallback');
      }
    }

    // Fallback to standard OpenAI model detection
    return await this.getStandardModels();
  }

  /**
   * Get models from LMStudio (if available)
   */
  private async getLMStudioModels(): Promise<ModelInfo[]> {
    if (!this.openaiSDK) {
      return [];
    }

    try {
      const models = await this.openaiSDK.models.list();
      
      return models.data.map(model => ({
        id: model.id,
        name: model.id,
        provider: 'lmstudio',
        capabilities: ['text-generation', 'conversation'],
        maxTokens: 4096,
        contextWindow: 32000, // LMStudio typically supports larger context
        pricing: {
          inputTokens: 0, // Local models are free
          outputTokens: 0
        }
      }));
    } catch (error) {
      console.warn('Failed to fetch models from LMStudio:', error.message);
      return [];
    }
  }

  /**
   * Get standard OpenAI models
   */
  private async getStandardModels(): Promise<ModelInfo[]> {
    if (!this.openaiSDK) {
      return this.getStaticModelList();
    }

    try {
      const models = await this.openaiSDK.models.list();
      
      return models.data
        .filter(model => model.id.includes('gpt'))
        .map(model => ({
          id: model.id,
          name: this.getModelDisplayName(model.id),
          provider: this.name,
          capabilities: this.getModelCapabilities(model.id),
          maxTokens: this.getModelMaxTokens(model.id),
          contextWindow: this.getModelContextWindow(model.id),
          pricing: this.getModelPricing(model.id)
        }));
    } catch (error) {
      console.warn('Failed to fetch models from API, using static list:', error);
      return this.getStaticModelList();
    }
  }

  // Inherit other methods from parent and add static model methods
  private getStaticModelList(): ModelInfo[] {
    return [
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: this.name,
        capabilities: ['text-generation', 'conversation', 'tool-calling', 'vision'],
        maxTokens: 4096,
        contextWindow: 128000,
        pricing: { inputTokens: 10.00, outputTokens: 30.00 }
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: this.name,
        capabilities: ['text-generation', 'conversation', 'tool-calling'],
        maxTokens: 4096,
        contextWindow: 8192,
        pricing: { inputTokens: 30.00, outputTokens: 60.00 }
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: this.name,
        capabilities: ['text-generation', 'conversation', 'tool-calling'],
        maxTokens: 4096,
        contextWindow: 16385,
        pricing: { inputTokens: 0.50, outputTokens: 1.50 }
      }
    ];
  }

  private getModelDisplayName(modelId: string): string {
    const nameMap: Record<string, string> = {
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4': 'GPT-4',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo'
    };
    return nameMap[modelId] || modelId;
  }

  private getModelCapabilities(modelId: string): string[] {
    if (modelId.includes('vision')) {
      return ['text-generation', 'conversation', 'tool-calling', 'vision'];
    }
    if (modelId.includes('gpt-4') || modelId.includes('gpt-3.5')) {
      return ['text-generation', 'conversation', 'tool-calling'];
    }
    return ['text-generation', 'conversation'];
  }

  private getModelMaxTokens(modelId: string): number {
    return 4096; // Most OpenAI models support 4096 max tokens
  }

  private getModelContextWindow(modelId: string): number {
    const contextMap: Record<string, number> = {
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-3.5-turbo': 16385
    };
    return contextMap[modelId] || 4096;
  }

  private getModelPricing(modelId: string): { inputTokens: number; outputTokens: number } {
    const pricingMap: Record<string, { inputTokens: number; outputTokens: number }> = {
      'gpt-4-turbo': { inputTokens: 10.00, outputTokens: 30.00 },
      'gpt-4': { inputTokens: 30.00, outputTokens: 60.00 },
      'gpt-3.5-turbo': { inputTokens: 0.50, outputTokens: 1.50 }
    };
    return pricingMap[modelId] || { inputTokens: 0, outputTokens: 0 };
  }

  protected async performHealthCheck(): Promise<void> {
    if (!this.openaiSDK) {
      throw new Error('Enhanced OpenAI SDK not initialized');
    }

    try {
      // For LMStudio, just check models endpoint
      if (this.isLMStudioServer) {
        await this.openaiSDK.models.list();
      } else {
        // For regular OpenAI, make a simple request
        await this.openaiSDK.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1
        });
      }
    } catch (error) {
      throw new Error(`Enhanced OpenAI health check failed: ${error.message}`);
    }
  }

  protected async performAuthentication(): Promise<AuthResult> {
    return await this.auth.authenticate();
  }

  protected async performTokenRefresh(): Promise<AuthResult> {
    return await this.auth.refreshToken();
  }

  protected async performTokenValidation(): Promise<boolean> {
    return this.auth.isTokenValid();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get SDK information for debugging
   */
  getSDKInfo(): any {
    return {
      isLMStudioServer: this.isLMStudioServer,
      serverConfig: this.serverConfig,
      lmstudioManagerAvailable: !!this.lmstudioManager,
      currentSDK: this.lmstudioManager?.getCurrentSDK()
    };
  }

  /**
   * Force fallback to standard OpenAI processing
   */
  async forceFallbackMode(): Promise<void> {
    if (this.lmstudioManager) {
      await this.lmstudioManager.forceFallback();
      console.log('🔄 Forced fallback mode for LMStudio SDK Manager');
    }
  }
}

console.log('✅ Enhanced OpenAI Client loaded with LMStudio SDK integration');