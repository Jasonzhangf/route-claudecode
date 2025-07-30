/**
 * Gemini API Client
 * Google Gemini API integration via Generative Language API
 * Project owner: Jason Zhang
 */

import { BaseRequest, BaseResponse, ProviderConfig } from '../../types';
import { logger } from '../../utils/logger';
import { processGeminiResponse } from './universal-gemini-parser';

export class GeminiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(private config: ProviderConfig) {
    const credentials = config.authentication.credentials;
    const apiKey = credentials.apiKey || credentials.api_key;
    this.apiKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
    if (!this.apiKey) {
      throw new Error('Gemini API key is required');
    }

    this.baseUrl = config.endpoint || 'https://generativelanguage.googleapis.com';
    logger.info('Gemini client initialized', {
      endpoint: this.baseUrl,
      hasApiKey: !!this.apiKey
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check if we can list models (lightweight health check)
      const response = await fetch(`${this.baseUrl}/v1/models?key=${this.apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      logger.error('Gemini health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async createCompletion(request: BaseRequest): Promise<BaseResponse> {
    const geminiRequest = this.convertToGeminiFormat(request);
    const modelName = this.extractModelName(request.model);
    
    logger.debug('Sending request to Gemini API', {
      model: modelName,
      messageCount: geminiRequest.contents?.length || 0,
      hasTools: !!geminiRequest.tools,
      maxTokens: geminiRequest.generationConfig?.maxOutputTokens
    });

    const url = `${this.baseUrl}/v1/models/${modelName}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(geminiRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const geminiResponse = await response.json();
    return this.convertFromGeminiFormat(geminiResponse, request);
  }

  async* streamCompletion(request: BaseRequest): AsyncIterable<any> {
    const requestId = request.metadata?.requestId || 'unknown';
    const geminiRequest = {
      ...this.convertToGeminiFormat(request)
    };
    const modelName = this.extractModelName(request.model);

    logger.info('Starting optimized Gemini streaming request', {
      model: modelName,
      messageCount: geminiRequest.contents?.length || 0,
      strategy: 'universal-auto-detect'
    });

    const url = `${this.baseUrl}/v1/models/${modelName}:streamGenerateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(geminiRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini streaming API error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming request');
    }

    // 🚀 使用完全缓冲策略 + 优化解析器
    logger.info('Collecting full Gemini response for optimization', {
      responseStatus: response.status
    }, requestId, 'gemini-provider');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponseContent = '';

    try {
      // 收集完整响应，同时发送心跳保持连接
      let lastHeartbeat = Date.now();
      const heartbeatInterval = 30000; // 30秒发送一次心跳
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullResponseContent += decoder.decode(value, { stream: true });
        
        // 发送心跳以保持连接活跃
        const now = Date.now();
        if (now - lastHeartbeat > heartbeatInterval) {
          logger.debug('Sending heartbeat to keep connection alive', {
            requestId,
            elapsed: now - lastHeartbeat
          }, requestId, 'gemini-provider');
          
          // 发送心跳事件
          yield {
            type: 'ping',
            timestamp: now
          };
          
          lastHeartbeat = now;
        }
      }

      logger.info('Gemini response collection completed', {
        responseLength: fullResponseContent.length,
        responsePreview: fullResponseContent.slice(0, 200)
      }, requestId, 'gemini-provider');

      // 🚀 使用通用优化解析器处理
      const optimizedEvents = await processGeminiResponse(
        fullResponseContent, 
        requestId, 
        { modelName, originalRequest: request }
      );

      logger.info('Gemini optimization completed', {
        eventCount: optimizedEvents.length,
        processingStrategy: 'universal-optimized'
      }, requestId, 'gemini-provider');

      // 转换并输出优化后的事件
      for (const event of optimizedEvents) {
        yield this.convertStreamEvent(event);
      }

    } finally {
      reader.releaseLock();
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

    // Handle tools if present
    const typedRequest = request as any;
    if (typedRequest.tools) {
      geminiRequest.tools = this.convertTools(typedRequest.tools);
    }

    return geminiRequest;
  }

  private convertMessages(messages: Array<{ role: string; content: any }>): any[] {
    const contents: any[] = [];
    
    for (const message of messages) {
      if (message.role === 'system') {
        // System messages are treated as user messages in Gemini
        contents.push({
          role: 'user',
          parts: [{ text: message.content }]
        });
      } else if (message.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: message.content }]
        });
      } else if (message.role === 'assistant') {
        contents.push({
          role: 'model',
          parts: [{ text: message.content }]
        });
      }
    }

    return contents;
  }

  private convertTools(tools: any[]): any[] {
    // Convert Anthropic/OpenAI tools to Gemini function declarations
    return tools.map(tool => ({
      functionDeclarations: [{
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema || tool.function?.parameters
      }]
    }));
  }

  private convertFromGeminiFormat(geminiResponse: any, originalRequest: BaseRequest): BaseResponse {
    const candidate = geminiResponse.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';
    
    // Extract usage information
    const usageMetadata = geminiResponse.usageMetadata || {};
    
    return {
      id: `gemini_${Date.now()}`,
      type: 'message',
      model: originalRequest.model,
      role: 'assistant',
      content: [{ type: 'text', text: content }],
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
}