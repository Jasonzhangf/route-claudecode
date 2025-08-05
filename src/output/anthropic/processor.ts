/**
 * Anthropic Output Format Processor
 * Converts provider responses to Anthropic API format
 */

import { OutputProcessor, BaseRequest, BaseResponse, AnthropicResponse } from '@/types';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { mapFinishReason } from '@/utils/finish-reason-handler';
import { MaxTokensErrorHandler } from '@/utils/max-tokens-error-handler';
// import { PipelineDebugger } from '@/debug/pipeline-debugger'; // 已迁移到统一日志系统
import { PipelineDebugger } from '@/utils/logger';

export class AnthropicOutputProcessor implements OutputProcessor {
  public readonly name = 'anthropic';
  private pipelineDebugger: PipelineDebugger;

  constructor(port: number = 3456) {
    this.pipelineDebugger = new PipelineDebugger(port);
  }

  /**
   * Check if this processor can handle the response format
   */
  canProcess(response: any, format: string): boolean {
    return format === 'anthropic' || format === 'claude';
  }

  /**
   * Process provider response to Anthropic format
   */
  async process(response: any, originalRequest: BaseRequest): Promise<BaseResponse> {
    const requestId = originalRequest.metadata?.requestId || 'unknown';
    
    try {
      logger.trace(requestId, 'output', 'Processing response to Anthropic format', {
        responseType: typeof response,
        hasContent: !!response.content
      });

      // If already in correct format, validate and return
      if (this.isAnthropicFormat(response)) {
        console.log(`🔍 [DEBUG-PROCESS] Taking validateAndNormalize path`);
        const result = this.validateAndNormalize(response, originalRequest, requestId);
        console.log(`🔍 [DEBUG-PROCESS] Final result stop_reason: "${result.stop_reason}"`);
        
        // 🚨 检查max_tokens错误并抛出500错误
        MaxTokensErrorHandler.checkAndThrowMaxTokensError(
          result,
          originalRequest.metadata?.targetProvider || 'unknown',
          originalRequest.metadata?.originalModel || originalRequest.model,
          requestId
        );
        
        return result;
      }

      // Convert from other formats
      console.log(`🔍 [DEBUG-PROCESS] Taking convertToAnthropic path`);
      const anthropicResponse = await this.convertToAnthropic(response, originalRequest, requestId);
      console.log(`🔍 [DEBUG-PROCESS] Converted result stop_reason: "${anthropicResponse.stop_reason}"`);
      
      // 🚨 检查max_tokens错误并抛出500错误
      MaxTokensErrorHandler.checkAndThrowMaxTokensError(
        anthropicResponse,
        originalRequest.metadata?.targetProvider || 'unknown',
        originalRequest.metadata?.originalModel || originalRequest.model,
        requestId
      );
      
      logger.trace(requestId, 'output', 'Response processed successfully', {
        contentBlocks: anthropicResponse.content?.length || 0,
        usage: anthropicResponse.usage
      });

      return anthropicResponse;
    } catch (error) {
      logger.error('Failed to process response to Anthropic format', error, requestId, 'output');
      throw error;
    }
  }

  /**
   * Check if response is already in Anthropic format
   */
  private isAnthropicFormat(response: any): boolean {
    return (
      response &&
      typeof response === 'object' &&
      response.role === 'assistant' &&
      Array.isArray(response.content) &&
      (response.type === 'message' || !response.type)
    );
  }

  /**
   * Validate and normalize existing Anthropic format response
   */
  private validateAndNormalize(response: any, originalRequest: BaseRequest, requestId: string): AnthropicResponse {
    // 🔍 添加详细调试日志
    console.log(`🔍 [DEBUG-VALIDATE] Input stop_reason: "${response.stop_reason}" (type: ${typeof response.stop_reason})`);
    
    const content = this.normalizeContent(response.content, requestId);
    const originalStopReason = response.stop_reason;
    const finalStopReason = response.stop_reason || mapFinishReason('stop');
    
    const normalized: AnthropicResponse = {
      content: content,
      id: response.id || `msg_${uuidv4().replace(/-/g, '')}`,
      model: originalRequest.metadata?.originalModel || originalRequest.model, // Use original model name, not internal mapped name
      role: 'assistant',
      // 确保stop_reason存在，使用映射的finish reason
      stop_reason: finalStopReason,
      stop_sequence: response.stop_sequence || null,
      type: 'message',
      usage: {
        input_tokens: response.usage?.input_tokens || this.estimateInputTokens(originalRequest),
        output_tokens: response.usage?.output_tokens || this.estimateOutputTokens(content)
      }
    };

    // 🔍 添加详细调试日志
    console.log(`🔍 [DEBUG-VALIDATE] Output stop_reason: "${normalized.stop_reason}" (type: ${typeof normalized.stop_reason})`);
    console.log(`🔍 [DEBUG-VALIDATE] Full normalized object:`, JSON.stringify(normalized, null, 2));

    // 🆕 总是记录原始和转换后的finish reason，即使它们相同
    logger.logDualFinishReason(
      originalStopReason || 'unknown',
      finalStopReason,
      originalRequest.metadata?.targetProvider || 'unknown',
      {
        model: originalRequest.metadata?.originalModel || originalRequest.model,
        responseType: 'non-streaming',
        context: 'validateAndNormalize',
        usage: normalized.usage,
        note: originalStopReason === 'unknown' ? 'Original stop reason is unknown, not sending stop_reason to Anthropic' : 'Normal conversion'
      },
      requestId,
      'dual-reason-validate'
    );
    
    // 如果原始stop reason是unknown，则删除stop_reason属性
    if (originalStopReason === 'unknown') {
      delete (normalized as any).stop_reason;
    }

    logger.debug('Normalized Anthropic response', {
      id: normalized.id,
      contentBlocks: normalized.content.length,
      stopReason: normalized.stop_reason
    }, requestId, 'output');

    return normalized;
  }

  /**
   * Convert other formats to Anthropic format
   */
  private async convertToAnthropic(response: any, originalRequest: BaseRequest, requestId: string): Promise<AnthropicResponse> {
    logger.debug('Converting response to Anthropic format', {
      originalFormat: originalRequest.metadata?.originalFormat
    }, requestId, 'output');

    // Handle OpenAI format
    if (response.choices && Array.isArray(response.choices)) {
      return this.convertFromOpenAI(response, originalRequest, requestId);
    }

    // Handle raw content arrays (from providers)
    if (Array.isArray(response)) {
      return this.convertFromContentArray(response, originalRequest, requestId);
    }

    // Handle simple text responses
    if (typeof response === 'string') {
      return this.convertFromText(response, originalRequest, requestId);
    }

    // Handle structured provider responses
    if (response.content) {
      return this.convertFromStructured(response, originalRequest, requestId);
    }

    throw new Error(`Unsupported response format: ${typeof response}`);
  }

  /**
   * Convert OpenAI format to Anthropic
   */
  private convertFromOpenAI(response: any, originalRequest: BaseRequest, requestId: string): AnthropicResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No choices in OpenAI response');
    }

    const content = this.convertOpenAIMessageToContent(choice.message);
    const originalFinishReason = choice.finish_reason;
    let convertedStopReason = this.mapOpenAIFinishReason(originalFinishReason);
    
    // 如果原始finish reason是unknown，则不设置stop_reason
    if (originalFinishReason === 'unknown') {
      convertedStopReason = undefined;
    }

    const anthropicResponse: AnthropicResponse = {
      content: content,
      id: response.id || `msg_${uuidv4().replace(/-/g, '')}`,
      model: originalRequest.metadata?.originalModel || originalRequest.model, // Use original model name, not internal mapped name
      role: 'assistant',
      // 只有当convertedStopReason不为undefined时才设置stop_reason属性
      ...(convertedStopReason !== undefined && { stop_reason: convertedStopReason }),
      stop_sequence: undefined,
      type: 'message',
      usage: {
        input_tokens: response.usage?.prompt_tokens || this.estimateInputTokens(originalRequest),
        output_tokens: response.usage?.completion_tokens || this.estimateOutputTokens(content)
      }
    };

    // 🆕 记录原始OpenAI和转换后的Anthropic finish reason
    logger.logDualFinishReason(
      originalFinishReason || 'unknown',
      convertedStopReason || 'undefined', // 显示为'undefined'而不是实际的undefined值
      originalRequest.metadata?.targetProvider || 'unknown',
      {
        model: originalRequest.metadata?.originalModel || originalRequest.model,
        responseType: 'non-streaming',
        context: 'convertFromOpenAI',
        usage: anthropicResponse.usage,
        conversionMethod: 'mapOpenAIFinishReason',
        note: originalFinishReason === 'unknown' ? 'Original finish reason is unknown, not sending stop_reason to Anthropic' : 'Normal conversion'
      },
      requestId,
      'dual-reason-openai-convert'
    );

    return anthropicResponse;
  }

  /**
   * Convert content array format to Anthropic
   */
  private convertFromContentArray(content: any[], originalRequest: BaseRequest, requestId: string): AnthropicResponse {
    const normalizedContent = this.normalizeContent(content, requestId);
    const stopReason = mapFinishReason('stop');

    const response: AnthropicResponse = {
      id: `msg_${uuidv4().replace(/-/g, '')}`,
      type: 'message',
      role: 'assistant',
      model: originalRequest.metadata?.originalModel || originalRequest.model, // Use original model name, not internal mapped name
      content: normalizedContent,
      stop_reason: stopReason, // 添加正确的停止原因
      stop_sequence: undefined,
      usage: {
        input_tokens: this.estimateInputTokens(originalRequest),
        output_tokens: this.estimateOutputTokens(normalizedContent)
      }
    };
    
    // 🆕 记录原始和转换后的finish reason
    logger.logDualFinishReason(
      'unknown', // 原始来源不明确
      stopReason,
      originalRequest.metadata?.targetProvider || 'unknown',
      {
        model: originalRequest.metadata?.originalModel || originalRequest.model,
        responseType: 'non-streaming',
        context: 'convertFromContentArray',
        usage: response.usage
      },
      requestId,
      'dual-reason-content-array'
    );

    return response;
  }

  /**
   * Convert text response to Anthropic
   */
  private convertFromText(text: string, originalRequest: BaseRequest, requestId: string): AnthropicResponse {
    const content = [{ type: 'text', text: text }];
    const stopReason = mapFinishReason('stop');

    const response: AnthropicResponse = {
      id: `msg_${uuidv4().replace(/-/g, '')}`,
      type: 'message',
      role: 'assistant',
      model: originalRequest.metadata?.originalModel || originalRequest.model, // Use original model name, not internal mapped name
      content: content,
      stop_reason: stopReason, // 添加正确的停止原因
      stop_sequence: undefined,
      usage: {
        input_tokens: this.estimateInputTokens(originalRequest),
        output_tokens: this.estimateOutputTokens(content)
      }
    };
    
    // 🆕 记录原始和转换后的finish reason
    logger.logDualFinishReason(
      'unknown', // 原始来源不明确
      stopReason,
      originalRequest.metadata?.targetProvider || 'unknown',
      {
        model: originalRequest.metadata?.originalModel || originalRequest.model,
        responseType: 'non-streaming',
        context: 'convertFromText',
        usage: response.usage
      },
      requestId,
      'dual-reason-text'
    );

    return response;
  }

  /**
   * Convert structured response to Anthropic
   */
  private convertFromStructured(response: any, originalRequest: BaseRequest, requestId: string): AnthropicResponse {
    const stopReason = response.stop_reason || mapFinishReason('stop');
    
    const anthropicResponse: AnthropicResponse = {
      id: response.id || `msg_${uuidv4().replace(/-/g, '')}`,
      type: 'message',
      role: 'assistant',
      model: originalRequest.metadata?.originalModel || originalRequest.model, // Use original model name, not internal mapped name
      content: this.normalizeContent(response.content, requestId),
      // 确保stop_reason存在，使用映射的finish reason
      stop_reason: stopReason,
      stop_sequence: response.stop_sequence || null,
      usage: {
        input_tokens: response.usage?.input_tokens || this.estimateInputTokens(originalRequest),
        output_tokens: response.usage?.output_tokens || this.estimateOutputTokens(response.content)
      }
    };
    
    // 🆕 记录原始和转换后的finish reason
    logger.logDualFinishReason(
      response.stop_reason || 'unknown',
      stopReason,
      originalRequest.metadata?.targetProvider || 'unknown',
      {
        model: originalRequest.metadata?.originalModel || originalRequest.model,
        responseType: 'non-streaming',
        context: 'convertFromStructured',
        usage: anthropicResponse.usage
      },
      requestId,
      'dual-reason-structured'
    );

    return anthropicResponse;
  }

  /**
   * Normalize content to Anthropic format with tool error detection
   */
  private normalizeContent(content: any, requestId?: string): any[] {
    if (!content) return [];
    
    if (typeof content === 'string') {
      this.checkForToolCallsInText(content, requestId || 'unknown', 'content-normalization');
      return [{ type: 'text', text: content }];
    }

    if (Array.isArray(content)) {
      return content.map(block => this.normalizeContentBlock(block, requestId));
    }

    if (typeof content === 'object') {
      return [this.normalizeContentBlock(content, requestId)];
    }

    const textContent = String(content);
    this.checkForToolCallsInText(textContent, requestId || 'unknown', 'content-normalization');
    return [{ type: 'text', text: textContent }];
  }

  /**
   * Normalize a single content block with tool error detection
   */
  private normalizeContentBlock(block: any, requestId?: string): any {
    if (typeof block === 'string') {
      // Check for tool calls in text content
      this.checkForToolCallsInText(block, requestId || 'unknown', 'output-processing');
      return { type: 'text', text: block };
    }

    if (!block || typeof block !== 'object') {
      const textContent = String(block);
      // Check for tool calls in converted text
      this.checkForToolCallsInText(textContent, requestId || 'unknown', 'output-processing');
      return { type: 'text', text: textContent };
    }

    // Already in correct format
    if (block.type && (block.text || block.id || block.content)) {
      // Check text content in properly formatted blocks
      if (block.type === 'text' && block.text) {
        this.checkForToolCallsInText(block.text, requestId || 'unknown', 'output-processing');
      }
      return block;
    }

    // Convert common formats
    if (block.content && !block.type) {
      this.checkForToolCallsInText(block.content, requestId || 'unknown', 'output-processing');
      return { type: 'text', text: block.content };
    }

    if (block.message && !block.type) {
      this.checkForToolCallsInText(block.message, requestId || 'unknown', 'output-processing');
      return { type: 'text', text: block.message };
    }

    // Default to text block
    const jsonText = JSON.stringify(block);
    this.checkForToolCallsInText(jsonText, requestId || 'unknown', 'output-processing');
    return { type: 'text', text: jsonText };
  }

  /**
   * Check for tool calls appearing in text areas (error condition)
   */
  private checkForToolCallsInText(text: string, requestId: string, stage: string): void {
    this.pipelineDebugger.detectToolCallError(
      text,
      requestId,
      stage,
      'anthropic',
      'unknown'
    );
  }

  /**
   * Convert OpenAI message to Anthropic content
   */
  private convertOpenAIMessageToContent(message: any): any[] {
    if (typeof message.content === 'string') {
      return [{ type: 'text', text: message.content }];
    }

    if (Array.isArray(message.content)) {
      return message.content.map((block: any) => {
        if (block.type === 'text') {
          return { type: 'text', text: block.text };
        }
        return block; // Pass through other types
      });
    }

    return [{ type: 'text', text: String(message.content || '') }];
  }

  /**
   * Map OpenAI finish reason to Anthropic stop reason
   */
  private mapOpenAIFinishReason(finishReason: string): string {
    const mapping: Record<string, string> = {
      'stop': 'end_turn',
      'length': 'max_tokens',
      'function_call': 'tool_use',
      'tool_calls': 'tool_use',
      'content_filter': 'stop_sequence'
    };

    const result = mapping[finishReason];
    if (!result) {
      throw new Error(`Unknown finish reason '${finishReason}' - no mapping found and fallback disabled. Available reasons: ${Object.keys(mapping).join(', ')}`);
    }
    return result;
  }

  /**
   * Estimate input tokens
   */
  private estimateInputTokens(request: BaseRequest): number {
    try {
      let totalChars = 0;
      
      request.messages.forEach(msg => {
        if (typeof msg.content === 'string') {
          totalChars += msg.content.length;
        } else if (Array.isArray(msg.content)) {
          msg.content.forEach((block: any) => {
            if (block.text) totalChars += block.text.length;
          });
        }
      });

      // Add system and tools
      if (request.metadata?.system) {
        totalChars += JSON.stringify(request.metadata.system).length;
      }
      if (request.metadata?.tools) {
        totalChars += JSON.stringify(request.metadata.tools).length;
      }

      return Math.ceil(totalChars / 4); // ~4 chars per token
    } catch {
      return 100; // Fallback estimate
    }
  }

  /**
   * Estimate output tokens
   */
  private estimateOutputTokens(content: any[]): number {
    try {
      let totalChars = 0;
      
      content.forEach(block => {
        if (block.text) {
          totalChars += block.text.length;
        } else if (block.input) {
          totalChars += JSON.stringify(block.input).length;
        } else if (block.content) {
          totalChars += JSON.stringify(block.content).length;
        }
      });

      return Math.ceil(totalChars / 4); // ~4 chars per token
    } catch {
      return 50; // Fallback estimate
    }
  }
}