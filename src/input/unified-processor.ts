/**
 * Unified Input Processor Manager
 * 自动检测请求格式并选择合适的处理器
 * 项目所有者: Jason Zhang
 */

import { InputProcessor, BaseRequest, ValidationError } from '@/types';
import { AnthropicInputProcessor } from './anthropic';
import { OpenAIInputProcessor } from './openai';
import { logger } from '@/utils/logger';

export class UnifiedInputProcessor implements InputProcessor {
  public readonly name = 'unified';

  private processors: InputProcessor[];

  constructor() {
    this.processors = [
      new OpenAIInputProcessor(),    // 优先检查OpenAI格式
      new AnthropicInputProcessor(), // 然后检查Anthropic格式
    ];

    logger.debug('UnifiedInputProcessor initialized with processors:', {
      processorNames: this.processors.map(p => p.name)
    });
  }

  /**
   * Check if any processor can handle the request
   */
  canProcess(request: any): boolean {
    try {
      return this.processors.some(processor => processor.canProcess(request));
    } catch (error) {
      logger.debug('Error checking if request can be processed by any processor:', error);
      return false;
    }
  }

  /**
   * Process the request using the appropriate processor
   */
  async process(request: any): Promise<BaseRequest> {
    const requestId = request?.metadata?.requestId || `unified-${Date.now()}`;
    
    try {
      // Find the first processor that can handle this request
      const suitableProcessor = this.processors.find(processor => {
        try {
          return processor.canProcess(request);
        } catch (error) {
          logger.debug(`Processor ${processor.name} failed canProcess check:`, error);
          return false;
        }
      });

      if (!suitableProcessor) {
        const errorMsg = 'No suitable processor found for request format';
        logger.error(errorMsg, {
          requestId,
          requestKeys: Object.keys(request || {}),
          hasMessages: Array.isArray(request?.messages),
          messageCount: request?.messages?.length || 0,
          hasTools: Array.isArray(request?.tools),
          toolCount: request?.tools?.length || 0,
          model: request?.model,
          availableProcessors: this.processors.map(p => p.name)
        });
        throw new ValidationError(errorMsg);
      }

      logger.debug(`Selected processor: ${suitableProcessor.name}`, {
        requestId,
        processorName: suitableProcessor.name,
        requestFormat: this.detectRequestFormat(request)
      });

      // Process the request with the selected processor
      const result = await suitableProcessor.process(request);

      // Ensure processor name is recorded in metadata
      if (result.metadata) {
        result.metadata.selectedProcessor = suitableProcessor.name;
      }

      logger.debug(`Request processed successfully by ${suitableProcessor.name}`, {
        requestId,
        processorName: suitableProcessor.name,
        model: result.model,
        messageCount: result.messages.length,
        hasTools: !!result.tools?.length,
        originalFormat: result.metadata?.originalFormat
      });

      return result;

    } catch (error) {
      logger.error('Error in unified input processing:', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        requestFormat: this.detectRequestFormat(request),
        availableProcessors: this.processors.map(p => p.name)
      });
      throw error;
    }
  }

  /**
   * Validate using all processors
   */
  validate(request: any): boolean {
    try {
      return this.processors.some(processor => {
        try {
          return processor.validate(request);
        } catch (error) {
          logger.debug(`Processor ${processor.name} validation failed:`, error);
          return false;
        }
      });
    } catch (error) {
      logger.error('Validation error in unified processor:', error);
      return false;
    }
  }

  /**
   * Detect request format for debugging
   */
  private detectRequestFormat(request: any): string {
    if (!request || typeof request !== 'object') {
      return 'invalid';
    }

    const format: string[] = [];

    // Check for OpenAI indicators
    if (request.tools?.some((t: any) => t.type === 'function' && t.function?.parameters)) {
      format.push('openai-tools');
    }
    if (request.messages?.some((m: any) => m.tool_calls)) {
      format.push('openai-tool-calls');
    }
    if (request.tool_choice && typeof request.tool_choice === 'object' && request.tool_choice.function) {
      format.push('openai-tool-choice');
    }

    // Check for Anthropic indicators
    if (Array.isArray(request.system)) {
      format.push('anthropic-system');
    }
    if (request.tools?.some((t: any) => t.input_schema && !t.function)) {
      format.push('anthropic-tools');
    }
    if (request.tool_choice?.type === 'tool' && request.tool_choice.name) {
      format.push('anthropic-tool-choice');
    }

    // Check for generic indicators
    if (Array.isArray(request.messages)) {
      format.push('has-messages');
    }
    if (typeof request.model === 'string') {
      format.push('has-model');
    }

    return format.length > 0 ? format.join(',') : 'unknown';
  }

  /**
   * Get information about available processors
   */
  getProcessorInfo(): Array<{ name: string; canProcess: (request: any) => boolean }> {
    return this.processors.map(processor => ({
      name: processor.name,
      canProcess: processor.canProcess.bind(processor)
    }));
  }
}