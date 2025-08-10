/**
 * Anthropic Output Format Processor
 * Converts provider responses to Anthropic API format
 */

import { OutputProcessor, BaseRequest, BaseResponse, AnthropicResponse } from '@/types';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { MaxTokensErrorHandler } from '@/utils/max-tokens-error-handler';
// import { PipelineDebugger } from '@/debug/pipeline-debugger'; // 已迁移到统一日志系统
import { PipelineDebugger } from '@/utils/logger';
import { getConsistencyValidator } from './consistency-validator';
import { 
  convertToAnthropicResponse,
  validateAndNormalizeAnthropicResponse 
} from '@/transformers/response-converter';

export class AnthropicOutputProcessor implements OutputProcessor {
  public readonly name = 'anthropic';
  private pipelineDebugger: PipelineDebugger;
  private consistencyValidator: ReturnType<typeof getConsistencyValidator>;
  private port: number;

  constructor(port: number) {
    // 🔧 修复硬编码：必须明确指定端口，不允许fallback
    this.port = port;
    this.pipelineDebugger = new PipelineDebugger(port);
    this.consistencyValidator = getConsistencyValidator(port);
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

      // 使用统一的转换器处理所有格式
      console.log(`🔍 [DEBUG-PROCESS] Using unified response converter`);
      let anthropicResponse: AnthropicResponse;
      
      if (this.isAnthropicFormat(response)) {
        console.log(`🔍 [DEBUG-PROCESS] Validating existing Anthropic format`);
        anthropicResponse = validateAndNormalizeAnthropicResponse(response, originalRequest, requestId);
      } else {
        console.log(`🔍 [DEBUG-PROCESS] Converting from other format`);
        anthropicResponse = convertToAnthropicResponse(response, originalRequest, requestId);
      }
      
      console.log(`🔍 [DEBUG-PROCESS] Final result stop_reason: "${anthropicResponse.stop_reason || 'undefined'}"`);
      
      // 🎯 最终一致性验证 - 输出前强制检查finish reason一致性
      if (this.consistencyValidator.shouldValidate(anthropicResponse)) {
        const validationResult = this.consistencyValidator.validateAndFix(anthropicResponse, requestId);
        const finalResponse = validationResult.response;
        
        if (validationResult.result.fixed) {
          logger.info('🔧 [OUTPUT] Final consistency fix applied', {
            report: this.consistencyValidator.generateValidationReport(validationResult.result),
            requestId
          }, requestId, 'output-consistency');
        }
        
        // 🔧 [FIXED] 移除错误的max_tokens检查 - max_tokens是正常完成状态，不是错误
        // MaxTokensErrorHandler.checkAndThrowMaxTokensError(
        //   finalResponse,
        //   originalRequest.metadata?.targetProvider || 'unknown',
        //   originalRequest.metadata?.originalModel || originalRequest.model,
        //   requestId
        // );
        
        logger.trace(requestId, 'output', 'Response processed successfully', {
          contentBlocks: finalResponse.content?.length || 0,
          usage: finalResponse.usage
        });

        return finalResponse;
      }
      
      // 🔧 [FIXED] 移除错误的max_tokens检查 - max_tokens是正常完成状态，不是错误
      // MaxTokensErrorHandler.checkAndThrowMaxTokensError(
      //   anthropicResponse,
      //   originalRequest.metadata?.targetProvider || 'unknown',
      //   originalRequest.metadata?.originalModel || originalRequest.model,
      //   requestId
      // );
      
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

  /**
   * 计算工具调用数量
   */
  private countToolCalls(data: any): number {
    if (!data?.content || !Array.isArray(data.content)) {
      return 0;
    }
    return data.content.filter((block: any) => block.type === 'tool_use').length;
  }
}