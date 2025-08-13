/**
 * V3.0 Base Provider Implementation
 * Common provider functionality
 * 
 * Project owner: Jason Zhang
 */

import { Provider, BaseRequest, BaseResponse, ProviderConfig } from '../types/index.js';

export abstract class BaseProvider implements Provider {
  public id: string;
  public type: string;
  public name: string;
  protected config: ProviderConfig;

  constructor(id: string, config: ProviderConfig) {
    this.id = id;
    this.type = config.type;
    this.name = config.name;
    this.config = config;
    
    console.log(`🔧 V3 ${this.type} provider initialized: ${this.id}`);
  }

  abstract isHealthy(): Promise<boolean>;
  abstract sendRequest(request: BaseRequest): Promise<BaseResponse>;
  
  // Legacy method for backward compatibility
  async processRequest(request: BaseRequest, requestId: string): Promise<BaseResponse> {
    return this.sendRequest(request);
  }

  protected createErrorResponse(request: BaseRequest, error: string): BaseResponse {
    return {
      id: `msg-${this.type}-error-${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content: [{
        type: 'text',
        text: `Error from ${this.type} provider: ${error}`
      }],
      model: request.model,
      stop_reason: 'error',
      usage: {
        input_tokens: 0,
        output_tokens: 0
      }
    };
  }
}

// Mock provider implementations for V3
export class CodeWhispererProvider extends BaseProvider {
  constructor(id: string, config?: ProviderConfig) {
    super(id, config || { 
      type: 'codewhisperer', 
      name: 'CodeWhisperer Provider',
      endpoint: 'https://codewhisperer.us-east-1.amazonaws.com',
      defaultModel: 'CLAUDE_SONNET_4',
      authentication: { type: 'bearer', credentials: {} },
      models: ['CLAUDE_SONNET_4']
    });
  }
  
  async isHealthy(): Promise<boolean> { return true; }
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    // TODO: Implement real CodeWhisperer API calls
    return this.createErrorResponse(request, 'CodeWhisperer provider not yet implemented with real API calls');
  }
}

export class GeminiProvider extends BaseProvider {
  constructor(config: ProviderConfig, id: string) {
    super(id, config);
  }
  
  async isHealthy(): Promise<boolean> { return true; }
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    // TODO: Implement real Gemini API calls
    return this.createErrorResponse(request, 'Gemini provider not yet implemented with real API calls');
  }
}

export class AnthropicProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super('anthropic', config);
  }
  
  async isHealthy(): Promise<boolean> { return true; }
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    // TODO: Implement real Anthropic API calls
    return this.createErrorResponse(request, 'Anthropic provider not yet implemented with real API calls');
  }
}

export class LMStudioClient extends BaseProvider {
  private endpoint: string;
  
  constructor(config: ProviderConfig, id: string) {
    super(id, config);
    // Extract base URL from endpoint if it contains the full path
    this.endpoint = config.endpoint || 'http://localhost:1234';
    if (this.endpoint.includes('/v1/chat/completions')) {
      this.endpoint = this.endpoint.replace('/v1/chat/completions', '');
    }
  }
  
  async isHealthy(): Promise<boolean> {
    try {
      const timeoutMs = this.config.timeout || 120000; // Default to 120 seconds
      const response = await fetch(`${this.endpoint}/v1/models`, {
        signal: AbortSignal.timeout(timeoutMs)
      });
      return response.ok;
    } catch (error) {
      console.error(`LM Studio health check failed: ${error}`);
      return false;
    }
  }
  
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    try {
      // Convert Anthropic format to OpenAI format
      const openAIRequest: any = {
        model: request.metadata?.targetModel || request.model,
        messages: request.messages,
        max_tokens: request.max_tokens,
        stream: request.stream || false
      };

      // Only include tools if they exist - LM Studio requires type='function'
      if (request.tools?.length > 0) {
        // LM Studio requires type to be exactly 'function'
        const cleanTools = request.tools.map(tool => ({
          type: 'function',  // LM Studio requires this to be exactly 'function'
          function: {
            name: tool.name || tool.function?.name,
            description: tool.description || tool.function?.description,
            parameters: tool.input_schema || tool.function?.parameters
          }
        }));
        openAIRequest.tools = cleanTools;
      }

      console.log(`🔧 LM Studio request:`, JSON.stringify(openAIRequest, null, 2));

      const timeoutMs = this.config.timeout || 120000; // Default to 120 seconds
      const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(openAIRequest),
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ LM Studio API error: ${response.status} ${response.statusText}`);
        console.error(`❌ Error response: ${errorText}`);
        throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();
      console.log(`✅ LM Studio response:`, JSON.stringify(data, null, 2));
      
      // Convert OpenAI format back to Anthropic format
      const choice = data.choices?.[0];
      const message = choice?.message;
      
      // Handle tool calls response
      if (message?.tool_calls && Array.isArray(message.tool_calls)) {
        console.log(`🔧 LM Studio returned ${message.tool_calls.length} tool calls`);
        
        const content = [];
        
        // Add text content if present
        if (message.content) {
          content.push({
            type: 'text',
            text: message.content
          });
        }
        
        // Convert OpenAI tool_calls to Anthropic tool_use format
        for (const toolCall of message.tool_calls) {
          content.push({
            type: 'tool_use',
            id: toolCall.id || `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: toolCall.function?.name || 'unknown_function',
            input: this.parseToolArguments(toolCall.function?.arguments)
          });
        }
        
        return {
          id: data.id || `msg-lmstudio-${Date.now()}`,
          type: 'message',
          role: 'assistant',
          content,
          model: request.model,
          stop_reason: this.mapFinishReason(choice?.finish_reason),
          usage: {
            input_tokens: data.usage?.prompt_tokens || 0,
            output_tokens: data.usage?.completion_tokens || 0
          }
        };
      }
      
      // Handle regular text response
      return {
        id: data.id || `msg-lmstudio-${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: message?.content || 'No response from LM Studio'
        }],
        model: request.model, // Keep original model name for client
        stop_reason: this.mapFinishReason(choice?.finish_reason),
        usage: {
          input_tokens: data.usage?.prompt_tokens || 0,
          output_tokens: data.usage?.completion_tokens || 0
        }
      };
    } catch (error) {
      console.error(`LM Studio request failed: ${error}`);
      // Return error response in Anthropic format
      return {
        id: `msg-lmstudio-error-${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        model: request.model,
        stop_reason: 'error',
        usage: {
          input_tokens: 0,
          output_tokens: 0
        }
      };
    }
  }
  
  private parseToolArguments(argumentsStr: string | undefined): any {
    if (!argumentsStr) {
      return {};
    }
    
    try {
      return JSON.parse(argumentsStr);
    } catch (error) {
      console.warn(`⚠️  Failed to parse tool arguments: ${argumentsStr}`);
      // Try to handle common malformed JSON cases
      try {
        // Remove any trailing commas or fix common issues
        const cleaned = argumentsStr.trim()
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');
        return JSON.parse(cleaned);
      } catch (secondError) {
        console.error(`❌ Cannot parse tool arguments as JSON: ${argumentsStr}`);
        return { raw_arguments: argumentsStr };
      }
    }
  }

  private mapFinishReason(openAIReason: string | undefined): string {
    switch (openAIReason) {
      case 'stop': return 'end_turn';
      case 'length': return 'max_tokens';
      case 'tool_calls': return 'tool_use';
      default: return 'end_turn';
    }
  }
}