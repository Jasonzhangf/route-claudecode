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
      const rawResponse = await this.config.openaiClient.chat.completions.create(openaiRequest);
      
      // 🔍 [CRITICAL-DEBUG] 检查OpenAI SDK返回的数据类型和结构
      console.log('🔍 [CRITICAL-DEBUG] OpenAI SDK raw response analysis:', {
        requestId,
        rawResponseIsObject: typeof rawResponse === 'object',
        rawResponseConstructor: rawResponse?.constructor?.name,
        rawResponseProto: Object.getPrototypeOf(rawResponse)?.constructor?.name,
        hasOwnChoices: Object.hasOwnProperty.call(rawResponse || {}, 'choices'),
        choicesDescriptor: Object.getOwnPropertyDescriptor(rawResponse || {}, 'choices'),
        rawResponseString: JSON.stringify(rawResponse),
        directChoicesAccess: rawResponse?.choices
      });

      // 🔍 [SDK-DEBUG] 记录OpenAI SDK原始响应
      console.log('🔍 [SDK-DEBUG] Raw OpenAI SDK response:', {
        requestId,
        hasRawResponse: !!rawResponse,
        rawResponseType: typeof rawResponse,
        rawResponseKeys: rawResponse ? Object.keys(rawResponse) : null,
        hasChoices: !!rawResponse?.choices,
        choicesType: typeof rawResponse?.choices,
        choicesLength: rawResponse?.choices?.length || 0,
        rawResponseId: rawResponse?.id,
        rawResponseObject: rawResponse?.object
      });

      if (!rawResponse?.choices) {
        console.log('🚨 [SDK-DEBUG] RAW RESPONSE MISSING CHOICES!', {
          requestId,
          fullRawResponse: JSON.stringify(rawResponse, null, 2)
        });
      }

      // 🔧 CRITICAL FIX: 在transformer之前应用格式兼容性修复
      const response = await this.applyResponseFormatFix(rawResponse, request);

      // 🔍 [FORMAT-FIX-DEBUG] 记录格式修复后的响应
      console.log('🔍 [FORMAT-FIX-DEBUG] Response after format fix:', {
        requestId,
        hasResponse: !!response,
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : null,
        hasChoices: !!response?.choices,
        choicesLength: response?.choices?.length || 0,
        wasFixed: rawResponse !== response
      });

      if (!response?.choices) {
        console.log('🚨 [FORMAT-FIX-DEBUG] RESPONSE MISSING CHOICES AFTER FORMAT FIX!', {
          requestId,
          fullResponse: JSON.stringify(response, null, 2)
        });
      }

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
      // 检查是否是超时错误
      const isTimeoutError = this.isTimeoutError(error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('OpenAI API call failed', {
        error: errorMessage,
        isTimeout: isTimeoutError,
        provider: this.config.providerName,
        model: request.model,
        requestId
      }, requestId, 'api-handler');

      // 如果是超时错误，抛出明确的超时错误而不是静默失败
      if (isTimeoutError) {
        const timeoutError = new Error(`API_TIMEOUT: ${this.config.providerName} API request timed out`);
        (timeoutError as any).type = 'api_timeout';
        (timeoutError as any).provider = this.config.providerName;
        (timeoutError as any).originalError = error;
        throw timeoutError;
      }

      throw error;
    }
  }

  /**
   * 检查是否是超时错误
   */
  private isTimeoutError(error: any): boolean {
    if (!error) return false;
    
    // 检查错误消息
    const errorMessage = error.message || error.toString().toLowerCase();
    const timeoutKeywords = [
      'timeout', 
      'timed out', 
      'request timed out',
      'connection timeout',
      'etimedout',
      'esockettimedout'
    ];
    
    const hasTimeoutMessage = timeoutKeywords.some(keyword => 
      errorMessage.toLowerCase().includes(keyword)
    );
    
    // 检查错误类型或代码
    const isTimeoutType = 
      error.code === 'ETIMEDOUT' ||
      error.code === 'ESOCKETTIMEDOUT' ||
      error.name === 'TimeoutError' ||
      error.name === 'APIConnectionTimeoutError' ||
      error.type === 'timeout';
    
    return hasTimeoutMessage || isTimeoutType;
  }

  /**
   * 获取provider名称
   */
  get providerName(): string {
    return this.config.providerName;
  }

  /**
   * 🔧 CRITICAL FIX: 应用响应格式兼容性修复
   * 解决ModelScope/ShuaiHong等非标准API的格式问题
   */
  private async applyResponseFormatFix(response: any, originalRequest: BaseRequest): Promise<any> {
    // 如果响应格式正常，直接返回
    if (response && response.choices && Array.isArray(response.choices) && response.choices.length > 0) {
      return response;
    }

    // 获取模型和Provider信息用于匹配
    const modelName = originalRequest.metadata?.originalModel || originalRequest.model || 'unknown';
    const providerId = this.config.providerName;

    console.log(`🔧 [FORMAT-FIX] Checking response format for ${modelName} on ${providerId}`);

    // 基于模型匹配的目标列表
    const targetModels = [
      'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-pro', 'gemini-flash',
      'glm-4.5', 'glm-4-plus', 'glm-4', 
      'DeepSeek-V3', 'deepseek-v3',
      'claude-4-sonnet', 'claude-3-sonnet',
      'ZhipuAI/GLM-4.5', 'Qwen/Qwen3-Coder-480B-A35B-Instruct'
    ];
    
    // 检查是否需要修复
    const needsFix = targetModels.some(model => 
      modelName.toLowerCase().includes(model.toLowerCase()) ||
      model.toLowerCase().includes(modelName.toLowerCase())
    ) || providerId.includes('modelscope') || providerId.includes('shuaihong');

    if (!needsFix) {
      console.log(`⏭️  [FORMAT-FIX] Skipping fix for ${modelName} on ${providerId}`);
      return response;
    }

    console.log(`🔧 [FORMAT-FIX] Applying format fix for ${modelName} on ${providerId}`);
    
    // 构造标准OpenAI格式响应
    const fixedResponse = {
      id: response?.id || `msg_${Date.now()}_fix`,
      object: 'chat.completion',
      created: response?.created || Math.floor(Date.now() / 1000),
      model: modelName,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: this.extractContent(response) || '',
          tool_calls: this.extractToolCalls(response) || null
        },
        finish_reason: this.extractFinishReason(response) || 'stop'
      }],
      usage: response?.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };

    // 如果有工具调用但没有内容，设置content为null
    if (fixedResponse.choices[0].message.tool_calls && !fixedResponse.choices[0].message.content) {
      (fixedResponse.choices[0].message as any).content = null;
    }

    console.log(`✅ [FORMAT-FIX] Successfully fixed response format for ${modelName}`);
    return fixedResponse;
  }

  /**
   * 从非标准响应中提取内容
   */
  private extractContent(data: any): string | null {
    if (!data) return null;
    
    // 尝试多种可能的内容字段
    if (data.content) return data.content;
    if (data.message && typeof data.message === 'string') return data.message;
    if (data.text) return data.text;
    if (data.response) return data.response;
    if (data.output) return data.output;
    
    // 尝试从嵌套对象中提取
    if (data.result && data.result.content) return data.result.content;
    if (data.data && data.data.content) return data.data.content;
    
    return null;
  }

  /**
   * 从非标准响应中提取工具调用
   */
  private extractToolCalls(data: any): any[] | null {
    if (!data) return null;
    
    // 检查标准位置
    if (data.tool_calls && Array.isArray(data.tool_calls)) {
      return data.tool_calls;
    }
    
    // 检查嵌套位置
    if (data.message && data.message.tool_calls) {
      return data.message.tool_calls;
    }
    
    // 检查其他可能的位置
    if (data.function_calls) {
      return data.function_calls;
    }
    
    return null;
  }

  /**
   * 从非标准响应中提取finish_reason
   */
  private extractFinishReason(data: any): string {
    if (!data) return 'stop';
    
    // 尝试多种可能的finish_reason字段
    if (data.finish_reason) return data.finish_reason;
    if (data.stop_reason) return data.stop_reason;
    if (data.finishReason) return data.finishReason;
    if (data.status) return data.status;
    
    // 检查嵌套位置
    if (data.result && data.result.finish_reason) return data.result.finish_reason;
    if (data.choices && data.choices[0] && data.choices[0].finish_reason) {
      return data.choices[0].finish_reason;
    }
    
    // 如果有工具调用相关内容，返回tool_calls
    if (this.extractToolCalls(data)) {
      return 'tool_calls';
    }
    
    // 默认为stop
    return 'stop';
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