/**
 * Anthropic Input Format Processor
 * Handles incoming requests in Anthropic API format
 */

import { InputProcessor, AnthropicRequest, BaseRequest, ValidationError } from '@/types';
import { validateAnthropicRequest } from './validator';
import { logger } from '@/utils/logger';
import { optimizedToolCallDetector } from '@/utils/optimized-tool-call-detector';
import { getUnifiedPatchPreprocessor } from '../../preprocessing/unified-patch-preprocessor';
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
      
      // 🎯 统一预处理：应用补丁系统到输入数据
      // 这将替代原本分散的工具调用检测和修复逻辑
      const preprocessor = getUnifiedPatchPreprocessor();
      const preprocessedRequest = await preprocessor.preprocessInput(
        anthropicRequest,
        'anthropic',
        anthropicRequest.model,
        requestId
      );
      
      // 🎯 保留优化的工具调用检测，但作为补充验证
      const toolDetectionResult = optimizedToolCallDetector.detectInRequest(preprocessedRequest, requestId);
      
      logger.debug('Input processed through unified preprocessing and tool detection', {
        requestId,
        hasToolCalls: toolDetectionResult.hasToolCalls,
        detectedPatterns: toolDetectionResult.detectedPatterns,
        confidence: toolDetectionResult.confidence,
        needsBuffering: toolDetectionResult.needsBuffering,
        extractedCount: toolDetectionResult.extractedToolCalls?.length || 0,
        detectionMethod: toolDetectionResult.detectionMethod,
        preprocessingApplied: preprocessedRequest !== anthropicRequest
      }, requestId, 'input-processor');
      
      // Normalize the preprocessed request to our internal format
      const baseRequest: BaseRequest = {
        model: preprocessedRequest.model,
        messages: this.normalizeMessages(preprocessedRequest.messages),
        stream: preprocessedRequest.stream || false,
        max_tokens: preprocessedRequest.max_tokens || 131072,
        temperature: preprocessedRequest.temperature,
        // 🔧 FIX: Store tools at top level for Provider access
        tools: preprocessedRequest.tools,
        metadata: {
          requestId: '',  // Will be set by server
          ...preprocessedRequest.metadata,
          originalFormat: 'anthropic',
          system: preprocessedRequest.system,
          tools: preprocessedRequest.tools,  // Keep copy in metadata for session management
          thinking: preprocessedRequest.thinking || false,
          // 🎯 添加工具调用检测结果到metadata
          toolDetection: toolDetectionResult,
          // 🆕 添加预处理信息
          preprocessing: {
            applied: preprocessedRequest !== anthropicRequest,
            timestamp: Date.now()
          }
        }
      };

      logger.debug('Processed Anthropic request through unified preprocessing:', {
        requestId: baseRequest.metadata?.requestId,
        model: baseRequest.model,
        messageCount: baseRequest.messages.length,
        hasTools: !!preprocessedRequest.tools?.length,
        hasSystem: !!preprocessedRequest.system?.length,
        isThinking: !!preprocessedRequest.thinking,
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