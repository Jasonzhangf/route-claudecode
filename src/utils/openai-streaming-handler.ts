/**
 * 统一OpenAI非流式处理基类 (重构版)
 * 项目所有者: Jason Zhang
 * 
 * Provider统一使用非流式调用API，然后根据需求模拟流式响应
 * 遵循零硬编码、零Fallback、零静默失败原则
 */

import OpenAI from 'openai';
import { BaseRequest, BaseResponse } from '@/types';
import { logger } from '@/utils/logger';
import { 
  validateNonStreamingResponse
} from './response-validation';
import { createOpenAITransformer } from '@/transformers/openai';

/**
 * 统一API处理配置接口
 */
export interface APIHandlerConfig {
  providerName: string;
  openaiClient: OpenAI;
  transformer?: ReturnType<typeof createOpenAITransformer>;
}

/**
 * 统一的OpenAI API处理类 - 只做非流式调用
 * 所有Provider都通过此类进行统一的非流式API调用
 */
export class OpenAIAPIHandler {
  private config: APIHandlerConfig;
  private transformer: ReturnType<typeof createOpenAITransformer>;

  constructor(config: APIHandlerConfig) {
    this.config = config;
    this.transformer = config.transformer || createOpenAITransformer();
  }

  /**
   * 统一的非流式API调用 - 所有工具转换在transformer中处理
   */
  async callAPI(request: BaseRequest): Promise<BaseResponse> {
    const requestId = request.metadata?.requestId || 'unknown';

    try {
      // 🔄 使用transformer转换请求（统一逻辑）
      const openaiRequest = this.transformer.transformBaseRequestToOpenAI(request);
      
      logger.debug('Sending non-streaming request to OpenAI API', {
        model: openaiRequest.model,
        hasTools: !!(openaiRequest.tools && openaiRequest.tools.length > 0),
        messageCount: openaiRequest.messages.length,
        requestId,
        provider: this.config.providerName
      }, requestId, 'api-handler');

      // 🎯 纯粹的非流式OpenAI API调用
      const response = await this.config.openaiClient.chat.completions.create(openaiRequest);

      // 🔄 使用transformer转换响应（统一逻辑，包含所有工具转换）
      const baseResponse = this.transformer.transformOpenAIResponseToBase(response, request);

      // 🚨 统一响应验证，防止静默失败
      validateNonStreamingResponse(baseResponse, requestId, this.config.providerName);

      logger.debug('Non-streaming API call completed successfully', {
        stopReason: baseResponse.stop_reason,
        hasTools: baseResponse.content.some((c: any) => c.type === 'tool_use'),
        contentBlocks: baseResponse.content.length,
        requestId,
        provider: this.config.providerName
      }, requestId, 'api-handler');

      return baseResponse;

    } catch (error) {
      logger.error('OpenAI API call failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: this.config.providerName,
        model: request.model,
        requestId
      }, requestId, 'api-handler');

      throw error;
    }
  }

  /**
   * 获取provider名称
   */
  get providerName(): string {
    return this.config.providerName;
  }
}

/**
 * 流式响应模拟器 - 将非流式响应转换为流式格式
 */
export class StreamingSimulator {
  /**
   * 将BaseResponse转换为Anthropic流式事件序列
   */
  static *simulateStreamingResponse(response: BaseResponse, requestId: string): Generator<any, void, unknown> {
    const messageId = response.id || `msg_${Date.now()}`;

    // 发送message_start事件
    yield {
      event: 'message_start',
      data: {
        type: 'message_start',
        message: {
          id: messageId,
          type: 'message',
          role: 'assistant',
          content: [],
          model: response.model,
          stop_reason: null,
          stop_sequence: null,
          usage: response.usage
        }
      }
    };

    // 发送内容块
    for (let i = 0; i < response.content.length; i++) {
      const block = response.content[i];
      
      // content_block_start
      yield {
        event: 'content_block_start',
        data: {
          type: 'content_block_start',
          index: i,
          content_block: block
        }
      };

      // 如果是文本块，模拟文本增量
      if (block.type === 'text' && block.text) {
        // 简单的文本分块模拟
        const chunks = block.text.match(/.{1,10}/g) || [block.text];
        for (const textChunk of chunks) {
          yield {
            event: 'content_block_delta',
            data: {
              type: 'content_block_delta',
              index: i,
              delta: {
                type: 'text_delta',
                text: textChunk
              }
            }
          };
        }
      }

      // 如果是工具调用块，模拟参数增量
      if (block.type === 'tool_use' && block.input) {
        const inputJson = JSON.stringify(block.input);
        // 简单的JSON分块模拟
        const chunks = inputJson.match(/.{1,20}/g) || [inputJson];
        for (const jsonChunk of chunks) {
          yield {
            event: 'content_block_delta',
            data: {
              type: 'content_block_delta',
              index: i,
              delta: {
                type: 'input_json_delta',
                partial_json: jsonChunk
              }
            }
          };
        }
      }

      // content_block_stop
      yield {
        event: 'content_block_stop',
        data: {
          type: 'content_block_stop',
          index: i
        }
      };
    }

    // 发送message_delta
    yield {
      event: 'message_delta',
      data: {
        type: 'message_delta',
        delta: {
          stop_reason: response.stop_reason,
          stop_sequence: response.stop_sequence
        },
        usage: {
          output_tokens: response.usage?.output_tokens || 0
        }
      }
    };

    // 发送message_stop（如果不是工具调用）
    if (response.stop_reason !== 'tool_use') {
      yield {
        event: 'message_stop',
        data: {
          type: 'message_stop'
        }
      };
    }
  }
}

/**
 * 创建API处理器实例
 */
export function createAPIHandler(config: APIHandlerConfig): OpenAIAPIHandler {
  return new OpenAIAPIHandler(config);
}

// 为了向后兼容，保留原来的函数名
export function createStreamingHandler(config: APIHandlerConfig): OpenAIAPIHandler {
  logger.warn('createStreamingHandler is deprecated, use createAPIHandler instead');
  return new OpenAIAPIHandler(config);
}

export type OpenAIStreamingHandler = OpenAIAPIHandler;