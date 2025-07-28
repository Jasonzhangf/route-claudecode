/**
 * Gemini API Client
 * Google Gemini API integration via Generative Language API
 * Project owner: Jason Zhang
 */

import { BaseRequest, BaseResponse, ProviderConfig } from '../../types';
import { logger } from '../../utils/logger';

export class GeminiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(private config: ProviderConfig) {
    this.apiKey = config.authentication.credentials.apiKey;
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
    const geminiRequest = {
      ...this.convertToGeminiFormat(request)
    };
    const modelName = this.extractModelName(request.model);

    logger.debug('Starting streaming request to Gemini API', {
      model: modelName,
      messageCount: geminiRequest.contents?.length || 0
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

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }

            try {
              const event = JSON.parse(data);
              yield this.convertStreamEvent(event);
            } catch (error) {
              logger.warn('Failed to parse Gemini stream event', {
                line,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }
        }
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