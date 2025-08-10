/**
 * Anthropic Input Format Processor
 * Handles incoming requests in Anthropic API format
 */

import { InputProcessor, AnthropicRequest, BaseRequest, ValidationError } from '@/types';
import { validateAnthropicRequest } from './validator';
import { logger } from '@/utils/logger';
import { optimizedToolCallDetector } from '@/utils/optimized-tool-call-detector';

/**
 * Architecture Note: Preprocessing has been moved to the routing layer.
 * Input layer now only handles basic format validation and parsing.
 * All transformations and patches are handled by the Enhanced Routing Engine.
 */
export class AnthropicInputProcessor implements InputProcessor {
  public readonly name = 'anthropic';

  /**
   * Check if this processor can handle the request
   */
  canProcess(request: any): boolean {
    try {
      // Check for Anthropic-specific fields
      return (
        typeof request === 'object' &&
        request !== null &&
        Array.isArray(request.messages) &&
        // Anthropic uses 'system' as array, OpenAI uses string
        (Array.isArray(request.system) || request.system === undefined) &&
        // Check for Anthropic-style tools format
        (!request.tools || this.isAnthropicToolsFormat(request.tools))
      );
    } catch (error) {
      logger.debug('Error checking if request can be processed by Anthropic processor:', error);
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
        throw new ValidationError('Invalid Anthropic request format');
      }

      const anthropicRequest = request as AnthropicRequest;
      const requestId = anthropicRequest.metadata?.requestId || 'temp-id';
      
      // 🎯 Preprocessing moved to routing layer - use original request
      
      // 🎯 保留优化的工具调用检测，但作为补充验证
      const toolDetectionResult = optimizedToolCallDetector.detectInRequest(anthropicRequest, requestId);
      
      logger.debug('Input processed through unified preprocessing and tool detection', {
        requestId,
        hasToolCalls: toolDetectionResult.hasToolCalls,
        detectedPatterns: toolDetectionResult.detectedPatterns,
        confidence: toolDetectionResult.confidence,
        needsBuffering: toolDetectionResult.needsBuffering,
        extractedCount: toolDetectionResult.extractedToolCalls?.length || 0,
        detectionMethod: toolDetectionResult.detectionMethod,
        preprocessingApplied: false
      }, requestId, 'input-processor');
      
      // Normalize the request to our internal format
      const baseRequest: BaseRequest = {
        model: anthropicRequest.model,
        messages: this.normalizeMessages(anthropicRequest.messages),
        stream: anthropicRequest.stream || false,
        max_tokens: anthropicRequest.max_tokens || 131072,
        temperature: anthropicRequest.temperature,
        // 🔧 FIX: Store tools at top level for Provider access
        tools: anthropicRequest.tools,
        metadata: {
          requestId: '',  // Will be set by server
          ...anthropicRequest.metadata,
          originalFormat: 'anthropic',
          system: anthropicRequest.system,
          tools: anthropicRequest.tools,  // Keep copy in metadata for session management
          thinking: anthropicRequest.thinking || false,
          // 🎯 添加工具调用检测结果到metadata
          toolDetection: toolDetectionResult,
          // 🆕 添加预处理信息
          preprocessing: {
            applied: false,  // Preprocessing moved to routing layer
            timestamp: Date.now()
          }
        }
      };

      logger.debug('Processed Anthropic request:', {
        requestId: baseRequest.metadata?.requestId,
        model: baseRequest.model,
        messageCount: baseRequest.messages.length,
        hasTools: !!anthropicRequest.tools?.length,
        hasSystem: !!anthropicRequest.system?.length,
        isThinking: !!anthropicRequest.thinking,
        toolDetectionConfidence: toolDetectionResult.confidence,
        needsBuffering: toolDetectionResult.needsBuffering,
        detectionMethod: toolDetectionResult.detectionMethod,
        preprocessingApplied: baseRequest.metadata?.preprocessing.applied
      });

      return baseRequest;
    } catch (error) {
      logger.error('Error processing Anthropic request:', error);
      throw error;
    }
  }

  /**
   * Validate the request format
   */
  validate(request: any): boolean {
    try {
      return validateAnthropicRequest(request);
    } catch (error) {
      logger.error('Validation error:', error);
      return false;
    }
  }

  /**
   * Check if tools are in Anthropic format
   */
  private isAnthropicToolsFormat(tools: any[]): boolean {
    if (!Array.isArray(tools) || tools.length === 0) {
      return true;
    }

    // Anthropic tools have 'input_schema', OpenAI has 'function.parameters'
    return tools.every(tool =>
      tool &&
      typeof tool.name === 'string' &&
      typeof tool.description === 'string' &&
      tool.input_schema &&
      typeof tool.input_schema === 'object'
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