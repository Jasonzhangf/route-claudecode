/**
 * OpenAI Input Format Processor
 * Handles incoming requests in OpenAI API format
 * 项目所有者: Jason Zhang
 */

import { InputProcessor, BaseRequest, ValidationError } from '@/types';
import { logger } from '@/utils/logger';
import { optimizedToolCallDetector } from '@/utils/optimized-tool-call-detector';
export interface OpenAIRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | Array<any>;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
    tool_call_id?: string;
  }>;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  }>;
  tool_choice?: 'auto' | 'none' | string | { type: 'function'; function: { name: string } };
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  metadata?: Record<string, any>;
}


/**
 * Architecture Note: Preprocessing has been moved to the routing layer.
 * Input layer now only handles basic format validation and parsing.
 * All transformations and patches are handled by the Enhanced Routing Engine.
 */
export class OpenAIInputProcessor implements InputProcessor {
  public readonly name = 'openai';

  /**
   * Check if this processor can handle the request
   */
  canProcess(request: any): boolean {
    try {
      // Check for OpenAI-specific fields
      return (
        typeof request === 'object' &&
        request !== null &&
        Array.isArray(request.messages) &&
        // OpenAI doesn't use 'system' as array (it's in messages)
        (request.system === undefined || typeof request.system === 'string') &&
        // Check for OpenAI-style tools format
        (!request.tools || this.isOpenAIToolsFormat(request.tools))
      );
    } catch (error) {
      logger.debug('Error checking if request can be processed by OpenAI processor:', error);
      return false;
    }
  }

  /**
   * Process the incoming request
   */
  async process(request: any): Promise<BaseRequest> {
    try {
      // Validate the request
      if (!this.validate(request)) {
        throw new ValidationError('Invalid OpenAI request format');
      }

      const openaiRequest = request as OpenAIRequest;
      const requestId = openaiRequest.metadata?.requestId || 'temp-id';
      
      // Convert OpenAI format to Anthropic-like format for internal processing
      const anthropicLikeRequest = this.convertToAnthropicFormat(openaiRequest);
      
      // 🎯 保留优化的工具调用检测，但作为补充验证
      const toolDetectionResult = optimizedToolCallDetector.detectInRequest(anthropicLikeRequest, requestId);
      
      logger.debug('OpenAI input processed through unified preprocessing and tool detection', {
        requestId,
        hasToolCalls: toolDetectionResult.hasToolCalls,
        detectedPatterns: toolDetectionResult.detectedPatterns,
        confidence: toolDetectionResult.confidence,
        needsBuffering: toolDetectionResult.needsBuffering,
        extractedCount: toolDetectionResult.extractedToolCalls?.length || 0,
        detectionMethod: toolDetectionResult.detectionMethod,
        preprocessingApplied: false,  // Preprocessing moved to routing layer
        originalFormat: 'openai'
      }, requestId, 'openai-input-processor');
      
      // Normalize to our internal format
      const baseRequest: BaseRequest = {
        model: anthropicLikeRequest.model,
        messages: this.normalizeMessages(anthropicLikeRequest.messages),
        stream: anthropicLikeRequest.stream || false,
        max_tokens: anthropicLikeRequest.max_tokens || 131072,
        temperature: anthropicLikeRequest.temperature,
        // 🔧 Store tools at top level for Provider access
        tools: anthropicLikeRequest.tools,
        metadata: {
          requestId: '',  // Will be set by server
          ...anthropicLikeRequest.metadata,
          originalFormat: 'openai',
          system: anthropicLikeRequest.system,
          tools: anthropicLikeRequest.tools,  // Keep copy in metadata for session management
          thinking: anthropicLikeRequest.thinking || false,
          // 🎯 添加工具调用检测结果到metadata
          toolDetection: toolDetectionResult,
          // 🆕 添加预处理信息
          preprocessing: {
            applied: false,  // Preprocessing moved to routing layer
            timestamp: Date.now()
          },
          // 保留原始OpenAI格式信息
          originalOpenAIRequest: {
            tool_choice: openaiRequest.tool_choice,
            hasToolCalls: !!openaiRequest.messages.some(m => m.tool_calls),
            toolCallCount: openaiRequest.messages.reduce((count, m) => count + (m.tool_calls?.length || 0), 0)
          }
        }
      };

      logger.debug('Processed OpenAI request:', {
        requestId: baseRequest.metadata?.requestId,
        model: baseRequest.model,
        messageCount: baseRequest.messages.length,
        hasTools: !!anthropicLikeRequest.tools?.length,
        hasSystem: !!anthropicLikeRequest.system?.length,
        isThinking: !!anthropicLikeRequest.thinking,
        toolDetectionConfidence: toolDetectionResult.confidence,
        needsBuffering: toolDetectionResult.needsBuffering,
        detectionMethod: toolDetectionResult.detectionMethod,
        preprocessingApplied: baseRequest.metadata?.preprocessing.applied,
        originalFormat: 'openai'
      });

      return baseRequest;
    } catch (error) {
      logger.error('Error processing OpenAI request:', error);
      throw error;
    }
  }

  /**
   * Convert OpenAI format to Anthropic-like format for internal processing
   */
  private convertToAnthropicFormat(openaiRequest: OpenAIRequest): any {
    const anthropicRequest: any = {
      model: openaiRequest.model,
      max_tokens: openaiRequest.max_tokens || 131072,
      temperature: openaiRequest.temperature,
      stream: openaiRequest.stream || false,
      metadata: openaiRequest.metadata
    };

    // Convert messages
    const messages: any[] = [];
    let systemMessage: string | undefined;

    for (const msg of openaiRequest.messages) {
      if (msg.role === 'system') {
        // Extract system message
        systemMessage = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      } else {
        // Convert regular messages
        const convertedMsg: any = {
          role: msg.role === 'tool' ? 'user' : msg.role, // Convert tool messages to user
          content: this.convertMessageContent(msg)
        };
        
        messages.push(convertedMsg);
      }
    }

    anthropicRequest.messages = messages;

    // Add system message if exists
    if (systemMessage) {
      anthropicRequest.system = [{ type: 'text', text: systemMessage }];
    }

    // Convert tools from OpenAI to Anthropic format
    if (openaiRequest.tools) {
      anthropicRequest.tools = openaiRequest.tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters
      }));
    }

    // Convert tool_choice
    if (openaiRequest.tool_choice) {
      if (openaiRequest.tool_choice === 'auto') {
        anthropicRequest.tool_choice = { type: 'auto' };
      } else if (openaiRequest.tool_choice === 'none') {
        // Don't set tool_choice for 'none'
      } else if (typeof openaiRequest.tool_choice === 'string') {
        anthropicRequest.tool_choice = {
          type: 'tool',
          name: openaiRequest.tool_choice
        };
      } else if (typeof openaiRequest.tool_choice === 'object' && openaiRequest.tool_choice.function) {
        anthropicRequest.tool_choice = {
          type: 'tool',
          name: openaiRequest.tool_choice.function.name
        };
      }
    }

    return anthropicRequest;
  }

  /**
   * Convert OpenAI message content to Anthropic format
   */
  private convertMessageContent(msg: OpenAIRequest['messages'][0]): any {
    const content: any[] = [];

    // Add text content
    if (msg.content) {
      if (typeof msg.content === 'string') {
        content.push({ type: 'text', text: msg.content });
      } else if (Array.isArray(msg.content)) {
        // Handle complex content (images, etc.)
        msg.content.forEach(block => {
          if (block.type === 'text') {
            content.push({ type: 'text', text: block.text });
          } else {
            content.push(block); // Pass through other types
          }
        });
      }
    }

    // Add tool calls as tool_use blocks
    if (msg.tool_calls) {
      msg.tool_calls.forEach(toolCall => {
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments || '{}')
        });
      });
    }

    // Handle tool results
    if (msg.role === 'tool' && msg.tool_call_id) {
      content.push({
        type: 'tool_result',
        tool_use_id: msg.tool_call_id,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      });
    }

    // Return single text if only one text block
    if (content.length === 1 && content[0].type === 'text') {
      return content[0].text;
    }

    return content.length > 0 ? content : '';
  }

  /**
   * Validate the request format
   */
  validate(request: any): boolean {
    try {
      return (
        request &&
        typeof request === 'object' &&
        typeof request.model === 'string' &&
        Array.isArray(request.messages) &&
        request.messages.length > 0 &&
        request.messages.every((msg: any) =>
          msg &&
          typeof msg.role === 'string' &&
          ['user', 'assistant', 'system', 'tool'].includes(msg.role) &&
          (msg.content !== undefined || msg.tool_calls)
        )
      );
    } catch (error) {
      logger.error('OpenAI validation error:', error);
      return false;
    }
  }

  /**
   * Check if tools are in OpenAI format
   */
  private isOpenAIToolsFormat(tools: any[]): boolean {
    if (!Array.isArray(tools) || tools.length === 0) {
      return true;
    }

    // OpenAI tools have 'function.parameters', Anthropic has 'input_schema'
    return tools.every(tool =>
      tool &&
      tool.type === 'function' &&
      tool.function &&
      typeof tool.function.name === 'string' &&
      typeof tool.function.description === 'string' &&
      tool.function.parameters &&
      typeof tool.function.parameters === 'object'
    );
  }

  /**
   * Normalize messages to internal format
   */
  private normalizeMessages(messages: any[]): Array<{ role: string; content: any }> {
    return messages.map(message => ({
      role: message.role,
      content: this.normalizeContent(message.content)
    }));
  }

  /**
   * Normalize content to handle both string and array formats
   */
  private normalizeContent(content: any): any {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content.map(block => {
        if (typeof block === 'string') {
          return { type: 'text', text: block };
        }
        return block;
      });
    }

    return content;
  }
}