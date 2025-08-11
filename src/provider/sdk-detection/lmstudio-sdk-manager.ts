/**
 * LMStudio SDK Manager
 * Author: Jason Zhang
 * 
 * Manages LMStudio official SDK integration with OpenAI-compatible fallback
 */

import { SDKDetector } from './sdk-detector.js';
import { 
  SDKInfo, 
  LocalModelServerConfig, 
  ModelServerDetection,
  SDKCapabilities 
} from './types.js';
import { AIRequest, AIResponse } from '../../types/interfaces.js';

export class LMStudioSDKManager {
  private detector: SDKDetector;
  private currentSDK: SDKInfo | null = null;
  private officialSDK: any = null;
  private fallbackClient: any = null;
  private serverConfig: LocalModelServerConfig | null = null;

  constructor() {
    this.detector = new SDKDetector('official-first');
  }

  /**
   * Initialize LMStudio SDK manager with server configuration
   */
  async initialize(config: LocalModelServerConfig): Promise<void> {
    this.serverConfig = config;
    
    // Detect available SDKs
    const detection = await this.detector.detectSDKs('lmstudio');
    
    if (!detection.preferred) {
      throw new Error('No LMStudio SDK or fallback available');
    }

    this.currentSDK = detection.preferred;
    
    // Initialize the preferred SDK
    if (this.currentSDK.name === 'lmstudio-official') {
      await this.initializeOfficialSDK();
    } else {
      await this.initializeFallbackSDK();
    }

    console.log(`✅ LMStudio SDK Manager initialized with: ${this.currentSDK.name}`);
  }

  /**
   * Initialize official LMStudio SDK
   */
  private async initializeOfficialSDK(): Promise<void> {
    try {
      // Dynamic import of LMStudio SDK
      const LMStudioSDK = await import('lmstudio-sdk');
      
      this.officialSDK = new LMStudioSDK.LMStudioClient({
        baseURL: this.serverConfig?.endpoint || 'http://localhost:1234',
        timeout: this.serverConfig?.timeout || 30000
      });

      // Test connection
      await this.officialSDK.llm.list();
      
      console.log('🎯 LMStudio official SDK initialized successfully');
    } catch (error) {
      console.warn('⚠️ Failed to initialize official LMStudio SDK, falling back:', error.message);
      await this.initializeFallbackSDK();
      this.updateCurrentSDK('lmstudio-openai-compatible');
    }
  }

  /**
   * Initialize OpenAI-compatible fallback SDK
   */
  private async initializeFallbackSDK(): Promise<void> {
    try {
      // Use OpenAI SDK for compatibility
      const OpenAI = await import('openai');
      
      this.fallbackClient = new OpenAI.default({
        apiKey: this.serverConfig?.apiKey || 'lm-studio',
        baseURL: this.serverConfig?.endpoint || 'http://localhost:1234/v1',
        timeout: this.serverConfig?.timeout || 30000
      });

      // Test connection
      await this.fallbackClient.models.list();
      
      console.log('🔄 LMStudio fallback (OpenAI-compatible) initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize LMStudio fallback SDK:', error.message);
      throw error;
    }
  }

  /**
   * Process request using the active SDK
   */
  async processRequest(request: AIRequest): Promise<AIResponse> {
    if (!this.currentSDK) {
      throw new Error('LMStudio SDK Manager not initialized');
    }

    try {
      if (this.currentSDK.name === 'lmstudio-official' && this.officialSDK) {
        return await this.processWithOfficialSDK(request);
      } else if (this.fallbackClient) {
        return await this.processWithFallbackSDK(request);
      } else {
        throw new Error('No active SDK available');
      }
    } catch (error) {
      // Auto-fallback on SDK failure
      if (this.currentSDK.name === 'lmstudio-official' && this.fallbackClient) {
        console.warn('⚠️ Official SDK failed, falling back to OpenAI-compatible:', error.message);
        this.updateCurrentSDK('lmstudio-openai-compatible');
        return await this.processWithFallbackSDK(request);
      }
      throw error;
    }
  }

  /**
   * Process request with official LMStudio SDK
   */
  private async processWithOfficialSDK(request: AIRequest): Promise<AIResponse> {
    if (!this.officialSDK) {
      throw new Error('Official LMStudio SDK not available');
    }

    try {
      // Convert request format for LMStudio SDK
      const lmstudioRequest = this.convertToLMStudioFormat(request);
      
      let response;
      if (request.stream) {
        response = await this.handleOfficialStreaming(lmstudioRequest);
      } else {
        response = await this.officialSDK.llm.complete(lmstudioRequest);
      }

      // Convert response to standard format
      return this.convertFromLMStudioFormat(response, request);
      
    } catch (error) {
      throw new Error(`LMStudio official SDK error: ${error.message}`);
    }
  }

  /**
   * Process request with OpenAI-compatible fallback
   */
  private async processWithFallbackSDK(request: AIRequest): Promise<AIResponse> {
    if (!this.fallbackClient) {
      throw new Error('Fallback SDK not available');
    }

    try {
      // Use OpenAI format directly
      const openaiRequest = this.convertToOpenAIFormat(request);
      
      let response;
      if (request.stream) {
        response = await this.handleFallbackStreaming(openaiRequest);
      } else {
        response = await this.fallbackClient.chat.completions.create(openaiRequest);
      }

      // Apply LMStudio-specific post-processing if needed
      return this.applyLMStudioPostProcessing(response, request);
      
    } catch (error) {
      throw new Error(`LMStudio fallback SDK error: ${error.message}`);
    }
  }

  /**
   * Handle streaming with official SDK
   */
  private async handleOfficialStreaming(request: any): Promise<any> {
    const stream = await this.officialSDK.llm.complete({
      ...request,
      stream: true
    });

    // Collect streaming response
    let fullResponse = {
      text: '',
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      model: request.model
    };

    for await (const chunk of stream) {
      if (chunk.text) {
        fullResponse.text += chunk.text;
      }
      if (chunk.usage) {
        fullResponse.usage = chunk.usage;
      }
    }

    return fullResponse;
  }

  /**
   * Handle streaming with fallback SDK
   */
  private async handleFallbackStreaming(request: any): Promise<any> {
    const stream = await this.fallbackClient.chat.completions.create({
      ...request,
      stream: true
    });

    // Collect streaming response
    let fullResponse = {
      id: '',
      object: 'chat.completion',
      created: Date.now(),
      model: request.model,
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

      if (chunk.id) fullResponse.id = chunk.id;
      if (chunk.usage) fullResponse.usage = chunk.usage;
    }

    return fullResponse;
  }

  /**
   * Convert request to LMStudio official SDK format
   */
  private convertToLMStudioFormat(request: AIRequest): any {
    // Extract messages and convert to LMStudio format
    const prompt = this.extractPromptFromMessages(request.messages || []);
    
    return {
      model: request.model,
      prompt: prompt,
      max_tokens: request.maxTokens || 4000,
      temperature: request.temperature || 0.7,
      top_p: request.topP || 1.0,
      stop: request.stopSequences || [],
      stream: request.stream || false
    };
  }

  /**
   * Convert request to OpenAI format for fallback
   */
  private convertToOpenAIFormat(request: AIRequest): any {
    return {
      model: request.model,
      messages: request.messages || [],
      max_tokens: request.maxTokens || 4000,
      temperature: request.temperature || 0.7,
      top_p: request.topP || 1.0,
      stop: request.stopSequences || [],
      tools: request.tools || [],
      tool_choice: request.toolChoice,
      stream: request.stream || false
    };
  }

  /**
   * Convert response from LMStudio official SDK format
   */
  private convertFromLMStudioFormat(response: any, request: AIRequest): AIResponse {
    return {
      id: `lmstudio-${Date.now()}`,
      model: request.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response.text || response.content || ''
        },
        finishReason: this.mapFinishReason(response.finish_reason)
      }],
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      },
      metadata: {
        timestamp: new Date(),
        processingTime: 0,
        provider: 'lmstudio-official'
      }
    };
  }

  /**
   * Apply LMStudio-specific post-processing
   */
  private applyLMStudioPostProcessing(response: any, request: AIRequest): AIResponse {
    // Apply tool call text parsing fix if needed
    const processedResponse = this.fixEmbeddedToolCalls(response);
    
    return {
      id: processedResponse.id || `lmstudio-fallback-${Date.now()}`,
      model: request.model,
      choices: processedResponse.choices || [{
        index: 0,
        message: {
          role: 'assistant',
          content: processedResponse.content || ''
        },
        finishReason: this.mapFinishReason(processedResponse.finish_reason)
      }],
      usage: {
        promptTokens: processedResponse.usage?.prompt_tokens || 0,
        completionTokens: processedResponse.usage?.completion_tokens || 0,
        totalTokens: processedResponse.usage?.total_tokens || 0
      },
      metadata: {
        timestamp: new Date(),
        processingTime: 0,
        provider: 'lmstudio-fallback'
      }
    };
  }

  /**
   * Fix embedded tool calls in content (LMStudio specific issue)
   */
  private fixEmbeddedToolCalls(response: any): any {
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
        console.warn('Failed to parse embedded tool call:', error.message);
      }
    }

    return response;
  }

  /**
   * Helper methods
   */
  private extractPromptFromMessages(messages: any[]): string {
    return messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  private mapFinishReason(reason: string | undefined): string {
    const reasonMap: Record<string, string> = {
      'stop': 'stop',
      'length': 'length',
      'tool_calls': 'tool_calls',
      'content_filter': 'content_filter'
    };
    
    return reasonMap[reason || 'stop'] || 'stop';
  }

  private updateCurrentSDK(sdkName: string): void {
    if (this.currentSDK) {
      this.currentSDK.name = sdkName;
    }
  }

  /**
   * Get current SDK information
   */
  getCurrentSDK(): SDKInfo | null {
    return this.currentSDK;
  }

  /**
   * Get server capabilities
   */
  getCapabilities(): SDKCapabilities {
    return this.detector.deriveCapabilities(this.currentSDK);
  }

  /**
   * Check if official SDK is available
   */
  isOfficialSDKAvailable(): boolean {
    return this.officialSDK !== null;
  }

  /**
   * Force fallback mode
   */
  async forceFallback(): Promise<void> {
    if (this.fallbackClient) {
      this.updateCurrentSDK('lmstudio-openai-compatible');
      console.log('🔄 Forced fallback to OpenAI-compatible mode');
    } else {
      await this.initializeFallbackSDK();
      this.updateCurrentSDK('lmstudio-openai-compatible');
    }
  }

  /**
   * Attempt to restore official SDK
   */
  async restoreOfficialSDK(): Promise<boolean> {
    try {
      await this.initializeOfficialSDK();
      return true;
    } catch (error) {
      console.warn('Failed to restore official SDK:', error.message);
      return false;
    }
  }
}