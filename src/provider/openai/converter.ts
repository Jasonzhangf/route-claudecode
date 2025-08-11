/**
 * OpenAI Format Converter Implementation
 * Real implementation of format conversion for OpenAI
 */

import { AIRequest, AIResponse, Tool } from '../../types/interfaces.js';

export class OpenAIConverter {
  constructor() {
    console.log('✅ OpenAIConverter initialized');
  }

  async toOpenAIFormat(request: AIRequest): Promise<any> {
    const openaiRequest: any = {
      model: request.model,
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream: request.stream || false,
      max_tokens: this.getMaxTokens(request.model),
      temperature: 0.7,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    };

    // Add tools if present
    if (request.tools && request.tools.length > 0) {
      openaiRequest.tools = request.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));
      openaiRequest.tool_choice = 'auto';
    }

    return openaiRequest;
  }

  async fromOpenAIFormat(response: any): Promise<AIResponse> {
    return {
      id: response.id,
      model: response.model,
      choices: response.choices.map((choice: any) => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content || '',
          metadata: {
            toolCalls: choice.message.tool_calls
          }
        },
        finishReason: choice.finish_reason
      })),
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      },
      metadata: {
        timestamp: new Date(),
        processingTime: 0,
        provider: 'openai'
      }
    };
  }

  async toAnthropicFormat(request: AIRequest): Promise<any> {
    return {
      model: this.mapModelToAnthropic(request.model),
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      max_tokens: this.getMaxTokens(request.model),
      stream: request.stream || false,
      temperature: 0.7
    };
  }

  async toGeminiFormat(request: AIRequest): Promise<any> {
    return {
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
  }

  private getMaxTokens(model: string): number {
    const maxTokensMap: Record<string, number> = {
      'gpt-4-turbo': 4096,
      'gpt-4': 4096,
      'gpt-3.5-turbo': 4096
    };
    
    return maxTokensMap[model] || 4096;
  }

  private mapModelToAnthropic(openaiModel: string): string {
    const modelMap: Record<string, string> = {
      'gpt-4-turbo': 'claude-3-5-sonnet-20241022',
      'gpt-4': 'claude-3-opus-20240229',
      'gpt-3.5-turbo': 'claude-3-haiku-20240307'
    };
    
    return modelMap[openaiModel] || 'claude-3-haiku-20240307';
  }

  // Utility method to validate OpenAI request format
  validateOpenAIRequest(request: any): boolean {
    if (!request.model || !request.messages || !Array.isArray(request.messages)) {
      return false;
    }

    // Validate messages format
    for (const message of request.messages) {
      if (!message.role || !['user', 'assistant', 'system'].includes(message.role)) {
        return false;
      }
      if (!message.content && !message.tool_calls) {
        return false;
      }
    }

    return true;
  }

  // Utility method to estimate tokens for a request
  estimateTokens(request: any): number {
    const messageText = request.messages
      .map((msg: any) => msg.content || '')
      .join(' ');
    
    // Rough estimation: 4 characters per token
    return Math.ceil(messageText.length / 4);
  }
}

console.log('✅ OpenAI converter loaded - real implementation');