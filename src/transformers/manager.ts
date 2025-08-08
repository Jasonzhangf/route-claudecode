/**
 * Transformation Manager
 * Central hub for managing message format transformations
 */

import { MessageTransformer, UnifiedRequest, UnifiedResponse, TransformationContext } from './types';

// Re-export TransformationContext for convenience
export { TransformationContext } from './types';
import { OpenAITransformer, createOpenAITransformer } from './openai';
import { AnthropicTransformer, createAnthropicTransformer } from './anthropic';
import { CodeWhispererTransformer, createCodeWhispererTransformer } from './codewhisperer';
import { StreamingTransformer, createStreamingTransformer, StreamTransformOptions } from './streaming';
import { logger } from '@/utils/logger';

export class TransformationManager {
  private transformers: Map<string, MessageTransformer> = new Map();

  constructor() {
    this.initializeTransformers();
  }

  /**
   * Initialize all available transformers
   */
  private initializeTransformers(): void {
    const openaiTransformer = createOpenAITransformer();
    const anthropicTransformer = createAnthropicTransformer();
    const codewhispererTransformer = createCodeWhispererTransformer();

    this.transformers.set('openai', openaiTransformer);
    this.transformers.set('anthropic', anthropicTransformer);
    this.transformers.set('codewhisperer', codewhispererTransformer);

    // Use console.log instead of logger during initialization to avoid port dependency
    console.log('Transformation manager initialized with transformers:', Array.from(this.transformers.keys()));
  }

  /**
   * Get transformer by name
   */
  getTransformer(name: string): MessageTransformer | undefined {
    return this.transformers.get(name);
  }

  /**
   * Transform request between formats
   */
  transformRequest(
    request: any,
    context: TransformationContext,
    requestId?: string
  ): any {
    try {
      logger.debug('Transforming request', {
        source: context.sourceProvider,
        target: context.targetProvider,
        requestId
      });

      // If source and target are the same, return as-is
      if (context.sourceProvider === context.targetProvider) {
        return request;
      }

      // Convert to unified format first
      let unifiedRequest: UnifiedRequest;
      
      if (context.sourceProvider === 'unified') {
        unifiedRequest = request;
      } else {
        const sourceTransformer = this.transformers.get(context.sourceProvider);
        if (!sourceTransformer) {
          throw new Error(`Source transformer not found: ${context.sourceProvider}`);
        }
        unifiedRequest = sourceTransformer.transformRequestToUnified(request);
      }

      // Convert from unified to target format
      if (context.targetProvider === 'unified') {
        return unifiedRequest;
      }

      const targetTransformer = this.transformers.get(context.targetProvider);
      if (!targetTransformer) {
        throw new Error(`Target transformer not found: ${context.targetProvider}`);
      }

      const transformedRequest = targetTransformer.transformRequestFromUnified(unifiedRequest);

      logger.debug('Request transformation completed', {
        source: context.sourceProvider,
        target: context.targetProvider,
        requestId
      });

      return transformedRequest;

    } catch (error) {
      logger.error('Request transformation failed', error, requestId);
      throw error;
    }
  }

  /**
   * Transform response between formats
   */
  transformResponse(
    response: any,
    context: TransformationContext,
    requestId?: string
  ): any {
    try {
      logger.debug('Transforming response', {
        source: context.sourceProvider,
        target: context.targetProvider,
        requestId
      });

      // If source and target are the same, return as-is
      if (context.sourceProvider === context.targetProvider) {
        return response;
      }

      // Convert to unified format first
      let unifiedResponse: UnifiedResponse;
      
      if (context.sourceProvider === 'unified') {
        unifiedResponse = response;
      } else {
        const sourceTransformer = this.transformers.get(context.sourceProvider);
        if (!sourceTransformer) {
          throw new Error(`Source transformer not found: ${context.sourceProvider}`);
        }
        unifiedResponse = sourceTransformer.transformResponseToUnified(response);
      }

      // Convert from unified to target format
      if (context.targetProvider === 'unified') {
        return unifiedResponse;
      }

      const targetTransformer = this.transformers.get(context.targetProvider);
      if (!targetTransformer) {
        throw new Error(`Target transformer not found: ${context.targetProvider}`);
      }

      const transformedResponse = targetTransformer.transformResponseFromUnified(unifiedResponse);

      logger.debug('Response transformation completed', {
        source: context.sourceProvider,
        target: context.targetProvider,
        requestId
      });

      return transformedResponse;

    } catch (error) {
      logger.error('Response transformation failed', error, requestId);
      throw error;
    }
  }

  /**
   * Create streaming transformer
   */
  createStreamingTransformer(options: StreamTransformOptions): StreamingTransformer {
    const sourceTransformer = this.transformers.get(options.sourceFormat);
    const targetTransformer = this.transformers.get(options.targetFormat);

    if (!sourceTransformer) {
      throw new Error(`Source transformer not found: ${options.sourceFormat}`);
    }

    if (!targetTransformer) {
      throw new Error(`Target transformer not found: ${options.targetFormat}`);
    }

    return createStreamingTransformer(sourceTransformer, targetTransformer, options);
  }

  /**
   * Transform streaming response
   */
  async *transformStream(
    stream: ReadableStream,
    options: StreamTransformOptions
  ): AsyncIterable<string> {
    const streamingTransformer = this.createStreamingTransformer(options);

    if (options.sourceFormat === 'openai' && options.targetFormat === 'anthropic') {
      yield* streamingTransformer.transformOpenAIToAnthropic(stream);
    } else if (options.sourceFormat === 'anthropic' && options.targetFormat === 'openai') {
      yield* streamingTransformer.transformAnthropicToOpenAI(stream);
    } else {
      throw new Error(`Unsupported streaming transformation: ${options.sourceFormat} -> ${options.targetFormat}`);
    }
  }

  /**
   * Detect request format
   */
  detectRequestFormat(request: any): 'openai' | 'anthropic' | 'unknown' {
    // Check for Anthropic-specific fields
    if (Array.isArray(request.system) || 
        (request.tools && request.tools.some((t: any) => t.input_schema))) {
      return 'anthropic';
    }

    // Check for OpenAI-specific fields
    if (request.tools && request.tools.some((t: any) => t.function)) {
      return 'openai';
    }

    // Default heuristics
    if (request.messages && Array.isArray(request.messages)) {
      const hasToolRole = request.messages.some((m: any) => m.role === 'tool');
      const hasToolCalls = request.messages.some((m: any) => m.tool_calls);
      
      if (hasToolRole || hasToolCalls) {
        return 'openai';
      }
    }

    return 'unknown';
  }

  /**
   * Get available transformers
   */
  getAvailableTransformers(): string[] {
    return Array.from(this.transformers.keys());
  }

  /**
   * Register custom transformer
   */
  registerTransformer(name: string, transformer: MessageTransformer): void {
    this.transformers.set(name, transformer);
    logger.info(`Registered custom transformer: ${name}`);
  }

  /**
   * Get transformation statistics
   */
  getStats(): Record<string, any> {
    return {
      availableTransformers: this.getAvailableTransformers(),
      totalTransformers: this.transformers.size
    };
  }
}

// Global transformation manager instance
export const transformationManager = new TransformationManager();

/**
 * Utility functions for common transformations
 */

/**
 * Transform OpenAI request to Anthropic format
 */
export function transformOpenAIToAnthropic(request: any, requestId?: string): any {
  return transformationManager.transformRequest(request, {
    sourceProvider: 'openai',
    targetProvider: 'anthropic'
  }, requestId);
}

/**
 * Transform Anthropic request to OpenAI format
 */
export function transformAnthropicToOpenAI(request: any, requestId?: string): any {
  return transformationManager.transformRequest(request, {
    sourceProvider: 'anthropic',
    targetProvider: 'openai'
  }, requestId);
}

/**
 * Transform OpenAI response to Anthropic format
 */
export function transformOpenAIResponseToAnthropic(response: any, requestId?: string): any {
  return transformationManager.transformResponse(response, {
    sourceProvider: 'openai',
    targetProvider: 'anthropic'
  }, requestId);
}

/**
 * Transform Anthropic response to OpenAI format
 */
export function transformAnthropicResponseToOpenAI(response: any, requestId?: string): any {
  return transformationManager.transformResponse(response, {
    sourceProvider: 'anthropic',
    targetProvider: 'openai'
  }, requestId);
}