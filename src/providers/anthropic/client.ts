/**
 * Anthropic API Client
 * Direct integration with Anthropic's official Messages API
 * Project owner: Jason Zhang
 */

import { BaseRequest, BaseResponse, ProviderConfig } from '../../types';
import { logger } from '../../utils/logger';

export class AnthropicClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(private config: ProviderConfig) {
    const credentials = config.authentication.credentials;
    const apiKey = credentials ? (credentials.apiKey || credentials.api_key) : undefined;
    this.apiKey = Array.isArray(apiKey) ? apiKey[0] : (apiKey || '');
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    this.baseUrl = config.endpoint || 'https://api.anthropic.com';
    logger.info('Anthropic client initialized', {
      endpoint: this.baseUrl,
      hasApiKey: !!this.apiKey
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - try to make a minimal request
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        signal: AbortSignal.timeout(30000), // 30 second timeout for health check
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      });

      // We expect either success or a recognizable error (not network/auth errors)
      return response.status < 500;
    } catch (error) {
      logger.error('Anthropic health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async createMessage(request: BaseRequest): Promise<BaseResponse> {
    const anthropicRequest = this.convertToAnthropicFormat(request);
    
    logger.debug('Sending request to Anthropic API', {
      model: anthropicRequest.model,
      messageCount: anthropicRequest.messages.length,
      hasTools: !!anthropicRequest.tools,
      maxTokens: anthropicRequest.max_tokens
    });

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(anthropicRequest),
      signal: AbortSignal.timeout(300000) // 5 minute timeout for production
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    const anthropicResponse = await response.json();
    return this.convertFromAnthropicFormat(anthropicResponse, request);
  }

  async* streamMessage(request: BaseRequest): AsyncIterable<any> {
    const anthropicRequest = {
      ...this.convertToAnthropicFormat(request),
      stream: true
    };

    logger.debug('Starting streaming request to Anthropic API', {
      model: anthropicRequest.model,
      messageCount: anthropicRequest.messages.length
    });

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(anthropicRequest),
      signal: AbortSignal.timeout(300000) // 5 minute timeout for production
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic streaming API error (${response.status}): ${errorText}`);
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
              logger.warn('Failed to parse Anthropic stream event', {
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

  private convertToAnthropicFormat(request: BaseRequest): any {
    const anthropicRequest: any = {
      model: request.model,
      messages: this.filterMessages(request.messages),
      max_tokens: request.max_tokens || 4096
    };

    // Add optional parameters
    if (request.temperature !== undefined) {
      anthropicRequest.temperature = request.temperature;
    }

    // Handle system messages - extract from messages array if present
    const systemMessages = request.messages.filter((msg: any) => msg.role === 'system');
    if (systemMessages.length > 0) {
      anthropicRequest.system = systemMessages.map((msg: any) => msg.content).join('\n');
      anthropicRequest.messages = anthropicRequest.messages.filter((msg: any) => msg.role !== 'system');
    }

    // Handle tools if present - but only for compatible APIs
    const anthropicRequest_typed = request as any;
    if (anthropicRequest_typed.tools && this.supportsTools()) {
      anthropicRequest.tools = anthropicRequest_typed.tools;
    }

    return anthropicRequest;
  }

  private filterMessages(messages: any[]): any[] {
    // Filter out tool_result messages for APIs that don't support them
    if (!this.supportsToolResults()) {
      return messages.map((msg: any) => {
        if (msg.role === 'user' && Array.isArray(msg.content)) {
          // Filter out tool_result content blocks
          const filteredContent = msg.content.filter((block: any) => block.type !== 'tool_result');
          if (filteredContent.length === 0) {
            // If all content was tool_result, replace with summarized text
            const toolResults = msg.content.filter((block: any) => block.type === 'tool_result');
            const summary = this.summarizeToolResults(toolResults);
            return { ...msg, content: summary };
          }
          return { ...msg, content: filteredContent };
        }
        return msg;
      }).filter((msg: any) => msg !== null);
    }
    return messages;
  }

  private supportsTools(): boolean {
    // Check if this API endpoint supports tools
    return !this.baseUrl.includes('modelscope.cn');
  }

  private supportsToolResults(): boolean {
    // Check if this API endpoint supports tool_result messages
    return !this.baseUrl.includes('modelscope.cn');
  }

  private summarizeToolResults(toolResults: any[]): string {
    if (toolResults.length === 0) {
      return "Previous tool execution completed.";
    }

    // Create a summary of tool results that maintains context
    const summaries = toolResults.map((result: any) => {
      const toolName = result.tool_use_id || 'tool';
      const content = result.content || '';
      
      // Truncate very long content but preserve key information
      if (typeof content === 'string' && content.length > 200) {
        return `Tool ${toolName} executed successfully. Result: ${content.substring(0, 200)}...`;
      }
      
      return `Tool ${toolName} executed successfully. Result: ${content}`;
    });

    return summaries.join('\n');
  }

  private convertFromAnthropicFormat(anthropicResponse: any, originalRequest: BaseRequest): BaseResponse {
    return {
      id: anthropicResponse.id,
      type: 'message',
      model: anthropicResponse.model,
      role: 'assistant',
      content: anthropicResponse.content || [],
      stop_reason: anthropicResponse.stop_reason,
      stop_sequence: anthropicResponse.stop_sequence || null,
      usage: {
        input_tokens: anthropicResponse.usage?.input_tokens || 0,
        output_tokens: anthropicResponse.usage?.output_tokens || 0
      }
    };
  }

  private convertStreamEvent(event: any): any {
    // Convert Anthropic streaming events to our standard format
    // This maintains compatibility with existing stream processing
    return {
      type: event.type,
      index: event.index || 0,
      delta: event.delta,
      content_block: event.content_block,
      message: event.message,
      usage: event.usage
    };
  }
}