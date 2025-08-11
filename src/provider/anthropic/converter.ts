/**
 * Anthropic Format Converter Implementation
 * Real implementation of format conversion between Anthropic and other formats
 */

import { AIRequest, AIResponse, Tool } from '../../types/interfaces.js';
import { AnthropicRequest, AnthropicMessage, AnthropicTool, AnthropicContent } from './types.js';

export class AnthropicConverter {
  constructor() {
    console.log('✅ AnthropicConverter initialized');
  }

  async toAnthropicFormat(request: AIRequest): Promise<AnthropicRequest> {
    const anthropicRequest: AnthropicRequest = {
      model: request.model,
      messages: await this.convertMessages(request.messages),
      max_tokens: this.getMaxTokens(request.model),
      stream: request.stream || false
    };

    // Add tools if present
    if (request.tools && request.tools.length > 0) {
      anthropicRequest.tools = await this.convertTools(request.tools);
    }

    return anthropicRequest;
  }

  async fromAnthropicFormat(response: any): Promise<AIResponse> {
    return {
      id: response.id,
      model: response.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: this.extractTextContent(response.content),
          metadata: {
            toolCalls: this.extractToolCalls(response.content)
          }
        },
        finishReason: this.mapFinishReason(response.stop_reason)
      }],
      usage: {
        promptTokens: response.usage?.input_tokens || 0,
        completionTokens: response.usage?.output_tokens || 0,
        totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      },
      metadata: {
        timestamp: new Date(),
        processingTime: 0, // Would be calculated from request timing
        provider: 'anthropic'
      }
    };
  }

  async toOpenAIFormat(request: AIRequest): Promise<any> {
    // Convert Anthropic-style request to OpenAI format
    const openAIRequest = {
      model: this.mapModelToOpenAI(request.model),
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream: request.stream || false,
      max_tokens: this.getMaxTokens(request.model)
    };

    // Add tools if present
    if (request.tools && request.tools.length > 0) {
      openAIRequest.tools = request.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));
    }

    return openAIRequest;
  }

  async toGeminiFormat(request: AIRequest): Promise<any> {
    // Convert Anthropic-style request to Gemini format
    const geminiRequest = {
      contents: request.messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      })),
      generationConfig: {
        maxOutputTokens: this.getMaxTokens(request.model),
        temperature: 0.7,
        topP: 0.8,
        topK: 40
      }
    };

    // Add tools if present (Gemini format)
    if (request.tools && request.tools.length > 0) {
      geminiRequest.tools = [{
        functionDeclarations: request.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }))
      }];
    }

    return geminiRequest;
  }

  private async convertMessages(messages: any[]): Promise<AnthropicMessage[]> {
    return messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: typeof msg.content === 'string' ? msg.content : this.convertComplexContent(msg.content)
    }));
  }

  private convertComplexContent(content: any): AnthropicContent[] {
    if (typeof content === 'string') {
      return [{ type: 'text', text: content }];
    }

    if (Array.isArray(content)) {
      return content.map(item => {
        if (item.type === 'text') {
          return { type: 'text', text: item.text };
        } else if (item.type === 'image') {
          return {
            type: 'image',
            source: {
              type: 'base64',
              media_type: item.media_type || 'image/jpeg',
              data: item.data
            }
          };
        }
        return item;
      });
    }

    return [{ type: 'text', text: String(content) }];
  }

  private async convertTools(tools: Tool[]): Promise<AnthropicTool[]> {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: tool.parameters.properties || {},
        required: tool.parameters.required || []
      }
    }));
  }

  private extractTextContent(content: AnthropicContent[]): string {
    if (!Array.isArray(content)) {
      return String(content);
    }

    return content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('');
  }

  private extractToolCalls(content: AnthropicContent[]): any[] {
    if (!Array.isArray(content)) {
      return [];
    }

    return content
      .filter(item => item.type === 'tool_use')
      .map(item => ({
        id: item.id,
        type: 'function',
        function: {
          name: item.name,
          arguments: JSON.stringify(item.input)
        }
      }));
  }

  private mapFinishReason(stopReason: string): string {
    const reasonMap: Record<string, string> = {
      'end_turn': 'stop',
      'max_tokens': 'length',
      'stop_sequence': 'stop',
      'tool_use': 'tool_calls'
    };
    return reasonMap[stopReason] || 'stop';
  }

  private getMaxTokens(model: string): number {
    // Model-specific max tokens
    const maxTokensMap: Record<string, number> = {
      'claude-3-5-sonnet-20241022': 8192,
      'claude-3-5-haiku-20241022': 8192,
      'claude-3-opus-20240229': 4096,
      'claude-3-sonnet-20240229': 4096,
      'claude-3-haiku-20240307': 4096
    };
    
    return maxTokensMap[model] || 4096;
  }

  private mapModelToOpenAI(anthropicModel: string): string {
    // Map Anthropic models to equivalent OpenAI models for conversion
    const modelMap: Record<string, string> = {
      'claude-3-5-sonnet-20241022': 'gpt-4-turbo',
      'claude-3-5-haiku-20241022': 'gpt-3.5-turbo',
      'claude-3-opus-20240229': 'gpt-4',
      'claude-3-sonnet-20240229': 'gpt-4-turbo',
      'claude-3-haiku-20240307': 'gpt-3.5-turbo'
    };
    
    return modelMap[anthropicModel] || 'gpt-3.5-turbo';
  }

  // Utility method to validate Anthropic request format
  validateAnthropicRequest(request: AnthropicRequest): boolean {
    if (!request.model || !request.messages || !Array.isArray(request.messages)) {
      return false;
    }

    if (request.max_tokens <= 0) {
      return false;
    }

    // Validate messages format
    for (const message of request.messages) {
      if (!message.role || !['user', 'assistant'].includes(message.role)) {
        return false;
      }
      if (!message.content) {
        return false;
      }
    }

    return true;
  }

  // Utility method to estimate tokens for a request
  estimateTokens(request: AnthropicRequest): number {
    const messageText = request.messages
      .map(msg => typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))
      .join(' ');
    
    // Rough estimation: 4 characters per token
    return Math.ceil(messageText.length / 4);
  }
}

console.log('✅ Anthropic converter loaded - real implementation');