/**
 * OpenAI SDK Client - 并行模块
 * 使用官方OpenAI SDK实现，提供平滑切换选项
 * 
 * 设计目标:
 * 1. 使用官方OpenAI SDK
 * 2. 保持与enhanced-client相同的接口
 * 3. 支持平滑切换
 * 4. 集成竞态控制系统
 */

import OpenAI from 'openai';
import { BaseRequest, BaseResponse, Provider, ProviderConfig, ProviderError } from '@/types';
import { logger } from '@/utils/logger';
import { getConversationQueueManager } from '@/session/conversation-queue-manager';
import { getRequestSequenceManager } from '@/session/request-sequence-manager';
import { transformationManager } from '@/transformers/manager';
import { transformAnthropicToOpenAI } from '@/transformers';
import { createPatchManager } from '@/patches/registry';
import { 
  StreamingToolCallParser, 
  parseOpenAIToolCalls,
  standardizeToolId,
  convertToAnthropicToolCall,
  validateToolCall 
} from '@/utils/unified-tool-parser';

export interface OpenAISDKConfig extends ProviderConfig {
  // 扩展配置选项
  useOfficialSDK?: boolean;
  sdkOptions?: {
    timeout?: number;
    maxRetries?: number;
    defaultHeaders?: Record<string, string>;
  };
}

/**
 * OpenAI SDK客户端 - 官方SDK实现
 */
export class OpenAISDKClient implements Provider {
  public readonly name: string;
  public readonly type = 'openai-sdk';
  
  protected openaiClient: OpenAI;
  public config: OpenAISDKConfig;
  private conversationQueueManager: ReturnType<typeof getConversationQueueManager>;
  private requestSequenceManager: ReturnType<typeof getRequestSequenceManager>;
  private patchManager = createPatchManager();

  constructor(config: OpenAISDKConfig, providerId: string) {
    this.name = providerId;
    this.config = config;

    // 初始化官方OpenAI SDK
    const apiKey = this.extractApiKey(config);
    const baseURL = this.extractBaseURL(config);

    this.openaiClient = new OpenAI({
      apiKey: apiKey || 'dummy-key', // 某些兼容服务不需要真实key
      baseURL,
      timeout: config.sdkOptions?.timeout || 60000,
      maxRetries: config.sdkOptions?.maxRetries || 3,
      defaultHeaders: {
        'User-Agent': 'claude-code-router-sdk/2.8.0',
        ...config.sdkOptions?.defaultHeaders
      }
    });

    // 初始化竞态控制系统
    const port = this.extractPortFromConfig(config);
    this.conversationQueueManager = getConversationQueueManager(port);
    this.requestSequenceManager = getRequestSequenceManager(port);

    logger.info('OpenAI SDK Client initialized', {
      providerId,
      baseURL,
      hasApiKey: !!apiKey,
      timeout: config.sdkOptions?.timeout || 60000,
      maxRetries: config.sdkOptions?.maxRetries || 3
    });
  }

  /**
   * 提取API Key
   */
  private extractApiKey(config: OpenAISDKConfig): string | undefined {
    const credentials = config.authentication?.credentials;
    if (!credentials) return undefined;

    const apiKey = credentials.apiKey || credentials.api_key;
    return Array.isArray(apiKey) ? apiKey[0] : apiKey;
  }

  /**
   * 提取Base URL
   */
  private extractBaseURL(config: OpenAISDKConfig): string {
    if (!config.endpoint) {
      return 'https://api.openai.com/v1'; // 默认OpenAI API
    }

    let baseURL = config.endpoint;
    
    // 如果endpoint包含chat/completions，提取base URL部分
    if (baseURL.includes('/chat/completions')) {
      baseURL = baseURL.replace(/\/chat\/completions.*$/, '');
    }
    
    // 确保以/v1结尾
    if (!baseURL.endsWith('/v1')) {
      // 移除可能的尾随斜杠
      if (baseURL.endsWith('/')) {
        baseURL = baseURL.slice(0, -1);
      }
      // 添加/v1
      baseURL += '/v1';
    }

    return baseURL;
  }

  /**
   * 提取端口配置
   */
  private extractPortFromConfig(config: OpenAISDKConfig): number {
    // 尝试从endpoint URL提取端口
    try {
      const url = new URL(config.endpoint);
      if (url.port) {
        return parseInt(url.port, 10);
      }
    } catch (error) {
      // URL解析失败，继续其他方法
    }

    // 从环境变量获取
    if (process.env.RCC_PORT) {
      return parseInt(process.env.RCC_PORT, 10);
    }

    // 默认端口
    return 3456;
  }

  /**
   * 健康检查
   */
  async isHealthy(): Promise<boolean> {
    try {
      // 使用官方SDK进行健康检查
      const response = await this.openaiClient.chat.completions.create({
        model: this.config.defaultModel || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      return !!response.id;
    } catch (error) {
      logger.warn('OpenAI SDK health check failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: this.name
      });
      return false;
    }
  }

  /**
   * 发送非流式请求 - 通过流式响应收集完整响应
   */
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    const originalRequestId = request.metadata?.requestId || 'unknown';
    
    logger.debug('Converting non-streaming request to streaming for OpenAI SDK', {
      requestId: originalRequestId,
      provider: this.name
    }, originalRequestId, 'provider');

    // 🎯 通过流式响应收集完整响应
    const chunks: any[] = [];
    let finalResponse: BaseResponse | null = null;

    try {
      for await (const chunk of this.sendStreamRequest(request)) {
        chunks.push(chunk);
        
        // 收集完整响应 - 修复：也在message_delta with stop_reason时构建响应
        if (chunk.event === 'message_stop' || 
            (chunk.event === 'message_delta' && chunk.data?.delta?.stop_reason)) {
          // 构建完整响应
          finalResponse = await this.buildCompleteResponseFromStream(chunks, request);
          break;
        }
      }

      if (!finalResponse) {
        throw new Error('Failed to build complete response from stream');
      }

      logger.debug('Successfully converted streaming response to complete response', {
        requestId: originalRequestId,
        chunks: chunks.length,
        stopReason: finalResponse.stop_reason
      }, originalRequestId, 'provider');

      return finalResponse;

    } catch (error) {
      logger.error('OpenAI SDK non-streaming request failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: this.name,
        requestId: originalRequestId
      }, originalRequestId, 'provider');
      throw error;
    }
  }

  /**
   * 从流式响应构建完整响应 - 使用统一工具解析器
   */
  private async buildCompleteResponseFromStream(chunks: any[], originalRequest: BaseRequest): Promise<BaseResponse> {
    const content: any[] = [];
    let messageId = '';
    let stopReason = 'end_turn';
    let model = originalRequest.model;
    let usage = { input_tokens: 0, output_tokens: 0 };

    // 🎯 使用统一流式工具解析器
    const toolParser = new StreamingToolCallParser();
    let textContent = '';

    // 🔍 调试：记录所有接收到的chunks
    const requestId = originalRequest.metadata?.requestId || 'unknown';
    logger.debug('Building complete response from stream chunks', {
      totalChunks: chunks.length,
      chunkTypes: chunks.map(c => c.event),
      requestId
    });

    for (const chunk of chunks) {
      if (chunk.event === 'message_start') {
        messageId = chunk.data?.message?.id || messageId;
        model = chunk.data?.message?.model || model;
      }
      
      if (chunk.event === 'content_block_delta') {
        if (chunk.data?.delta?.type === 'text_delta') {
          textContent += chunk.data.delta.text || '';
        } else if (chunk.data?.delta?.type === 'input_json_delta') {
          // 🎯 使用统一解析器处理工具参数增量
          const index = chunk.data.index || 0;
          const partialJson = chunk.data.delta.partial_json || '';
          toolParser.handleToolArgumentsDelta(index, partialJson);
          
          // 🔍 调试：记录参数增量处理
          logger.debug('Processing tool arguments delta in buildCompleteResponse', {
            index,
            partialJsonLength: partialJson.length,
            partialJson: partialJson.substring(0, 100) + (partialJson.length > 100 ? '...' : ''),
            requestId
          });
        }
      }
      
      if (chunk.event === 'content_block_start' && chunk.data?.content_block?.type === 'tool_use') {
        const toolBlock = chunk.data.content_block;
        const index = chunk.data.index || 0;
        
        // 🎯 使用统一解析器处理工具调用开始
        const parsedTool = toolParser.handleToolCallStart(index, {
          id: toolBlock.id,
          name: toolBlock.name,
          input: toolBlock.input
        });

        // 🔍 调试：记录工具调用开始处理
        logger.debug('Processing tool call start in buildCompleteResponse', {
          toolBlockId: toolBlock.id,
          toolName: toolBlock.name,
          index,
          parsedToolId: parsedTool?.id,
          parsedSuccess: !!parsedTool,
          requestId
        });

        if (!parsedTool) {
          logger.warn('Failed to parse tool call start', { toolBlock, index });
        }
      }
      
      if (chunk.event === 'message_delta') {
        if (chunk.data?.delta?.stop_reason) {
          stopReason = chunk.data.delta.stop_reason;
        }
        if (chunk.data?.usage) {
          usage.input_tokens += chunk.data.usage.input_tokens || 0;
          usage.output_tokens += chunk.data.usage.output_tokens || 0;
        }
      }
    }

    // 🎯 完成工具调用解析
    const toolCalls = toolParser.finalizeToolCalls();
    
    // 🔍 调试：记录解析结果
    logger.debug('Tool call parsing completed in buildCompleteResponse', {
      toolCallsCount: toolCalls.length,
      tools: toolCalls.map(t => ({
        id: t.id,
        name: t.name,
        hasInput: Object.keys(t.input).length > 0,
        inputKeys: Object.keys(t.input)
      })),
      requestId
    });

    // 构建content数组
    if (textContent.trim()) {
      content.push({
        type: 'text',
        text: textContent.trim()
      });
    }

    // 🎯 验证并添加工具调用
    for (const toolCall of toolCalls) {
      if (validateToolCall(toolCall)) {
        content.push(convertToAnthropicToolCall(toolCall));
      } else {
        logger.warn('Skipping invalid tool call', { toolCall });
      }
    }

    // 🎯 修复：如果有工具调用，强制设置stop_reason为tool_use
    
    // 🎯 修复：如果有工具调用，强制设置stop_reason为tool_use
    const finalStopReason = toolCalls.length > 0 ? 'tool_use' : this.mapFinishReason(stopReason, toolCalls.length > 0);

    logger.debug('Built complete response from stream', {
      messageId,
      textLength: textContent.length,
      toolCallsCount: toolCalls.length,
      finalStopReason,
      requestId: originalRequest.metadata?.requestId
    });

    return {
      id: messageId,
      content,
      model: originalRequest.metadata?.originalModel || model,
      role: 'assistant',
      stop_reason: finalStopReason,
      stop_sequence: null,
      usage
    };
  }

  /**
   * 发送流式请求
   */
  async *sendStreamRequest(request: BaseRequest): AsyncIterable<any> {
    const originalRequestId = request.metadata?.requestId || 'unknown';
    const sessionId = request.metadata?.sessionId;
    const conversationId = request.metadata?.conversationId;

    // 应用竞态控制（如果有会话信息）
    if (sessionId && conversationId) {
      logger.debug('Applying OpenAI SDK race control for streaming', {
        sessionId,
        conversationId,
        originalRequestId,
        provider: this.name
      }, originalRequestId, 'provider');

      try {
        // 生成序列化requestId
        const sequenceResult = this.requestSequenceManager.generateSequencedRequestId(
          sessionId,
          conversationId,
          0
        );

        // 入队处理
        const queueResult = await this.conversationQueueManager.enqueueRequest(
          sessionId,
          conversationId,
          true
        );

        // 更新请求元数据
        request.metadata = {
          ...request.metadata,
          requestId: sequenceResult.requestId,
          sequenceNumber: sequenceResult.sequenceNumber,
          queueSequenceNumber: queueResult.sequenceNumber,
          originalRequestId
        };

        // 标记处理开始
        this.requestSequenceManager.startProcessing(sequenceResult.requestId);

        // 处理流式请求
        let finishReason: string | undefined;
        try {
          for await (const chunk of this.processSDKStreamRequest(request)) {
            // 提取finish reason
            if (chunk?.event === 'message_delta' && chunk?.data?.delta?.stop_reason) {
              finishReason = chunk.data.delta.stop_reason;
            }
            yield chunk;
          }
        } finally {
          // 标记完成
          this.conversationQueueManager.completeRequest(
            sequenceResult.requestId,
            finishReason || 'stream_end'
          );
          this.requestSequenceManager.completeRequest(
            sequenceResult.requestId,
            finishReason || 'stream_end'
          );
        }

      } catch (error) {
        // 标记失败
        if (request.metadata?.requestId) {
          this.conversationQueueManager.failRequest(request.metadata.requestId, error);
          this.requestSequenceManager.failRequest(request.metadata.requestId, error);
        }
        throw error;
      }
    } else {
      // 无会话信息，直接处理
      yield* this.processSDKStreamRequest(request);
    }
  }


  /**
   * 处理SDK流式请求
   */
  private async *processSDKStreamRequest(request: BaseRequest): AsyncIterable<any> {
    const requestId = request.metadata?.requestId || 'unknown';

    try {
      // 转换为OpenAI格式
      const openaiRequest = { ...this.convertToOpenAISDK(request), stream: true };

      logger.debug('Sending streaming request via OpenAI SDK', {
        model: openaiRequest.model,
        messageCount: openaiRequest.messages.length,
        hasTools: !!openaiRequest.tools
      }, requestId, 'provider');

      // 使用官方SDK发送流式请求
      const stream = await this.openaiClient.chat.completions.create(openaiRequest);

      let messageId = `msg_${Date.now()}`;
      let hasStarted = false;
      let hasToolCalls = false; // 🎯 跟踪是否有工具调用
      
      // 🎯 使用统一工具解析器处理流式工具调用
      const streamingParser = new StreamingToolCallParser();

      // 确保stream是可迭代的
      if (Symbol.asyncIterator in stream) {
        for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        // 发送message_start事件
        if (!hasStarted) {
          yield {
            event: 'message_start',
            data: {
              type: 'message_start',
              message: {
                id: messageId,
                type: 'message',
                role: 'assistant',
                content: [],
                model: chunk.model,
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: 0, output_tokens: 0 }
              }
            }
          };
          hasStarted = true;
        }

        // 处理内容增量
        if (choice.delta?.content) {
          yield {
            event: 'content_block_delta',
            data: {
              type: 'content_block_delta',
              index: 0,
              delta: {
                type: 'text_delta',
                text: choice.delta.content
              }
            }
          };
        }

        // 处理工具调用 - 使用统一解析器
        if (choice.delta?.tool_calls) {
          hasToolCalls = true; // 🎯 标记有工具调用
          for (const toolCall of choice.delta.tool_calls) {
            if (toolCall.function?.name) {
              // 🎯 使用统一解析器处理工具调用开始
              const parsedTool = streamingParser.handleToolCallStart(toolCall.index || 0, {
                id: toolCall.id,
                name: toolCall.function.name,
                function: toolCall.function
              });

              if (parsedTool) {
                yield {
                  event: 'content_block_start',
                  data: {
                    type: 'content_block_start',
                    index: toolCall.index || 0,
                    content_block: {
                      type: 'tool_use',
                      id: parsedTool.id,
                      name: parsedTool.name,
                      input: {} // 流式调用时先发送空对象，参数通过delta发送
                    }
                  }
                };
              }
            }

            if (toolCall.function?.arguments) {
              // 🎯 使用统一解析器处理参数增量
              streamingParser.handleToolArgumentsDelta(toolCall.index || 0, toolCall.function.arguments);
              
              yield {
                event: 'content_block_delta',
                data: {
                  type: 'content_block_delta',
                  index: toolCall.index || 0,
                  delta: {
                    type: 'input_json_delta',
                    partial_json: toolCall.function.arguments
                  }
                }
              };
            }
          }
        }

        // 处理结束
        if (choice.finish_reason) {
          let anthropicStopReason: string;
          
          // 🎯 修复：如果整个响应中有工具调用，强制覆盖stop_reason为tool_use
          if (hasToolCalls) {
            anthropicStopReason = 'tool_use';
            
            // 记录工具调用解析结果用于调试
            const finalToolCalls = streamingParser.finalizeToolCalls();
            logger.debug('Streaming tool calls finalized', {
              requestId,
              toolCallsCount: finalToolCalls.length,
              stopReason: anthropicStopReason,
              tools: finalToolCalls.map(t => ({ id: t.id, name: t.name }))
            });
            
            // 重新初始化解析器以避免状态泄露
            streamingParser.reset();
          } else {
            anthropicStopReason = this.mapFinishReason(choice.finish_reason, hasToolCalls);
          }
          
          yield {
            event: 'message_delta',
            data: {
              type: 'message_delta',
              delta: {
                stop_reason: anthropicStopReason
              },
              usage: {
                output_tokens: 1 // 近似值
              }
            }
          };

          // 🔧 修复：工具调用场景下不发送message_stop
          if (anthropicStopReason !== 'tool_use') {
            yield {
              event: 'message_stop',
              data: {
                type: 'message_stop'
              }
            };
          }
        }
      }
      } else {
        throw new Error('Stream response is not iterable');
      }

    } catch (error) {
      logger.error('OpenAI SDK streaming request failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: this.name,
        model: request.model
      }, requestId, 'provider');

      if (error instanceof OpenAI.APIError) {
        throw new ProviderError(
          `OpenAI SDK Streaming API Error: ${error.message}`,
          this.name,
          error.status || 500,
          error
        );
      }

      throw new ProviderError(
        `OpenAI SDK Streaming Error: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        500,
        error
      );
    }
  }

  // 🎯 已移除内部转换方法，使用统一转换器系统
  // convertContentToString() 和 extractToolsFromMessages() 已被统一转换器替代

  /**
   * 转换为OpenAI SDK格式
   * 🎯 修复：使用完整转换器系统，确保兼容性
   */
  private convertToOpenAISDK(request: BaseRequest): OpenAI.Chat.ChatCompletionCreateParams {
    // 🎯 修复方案: 使用与Enhanced Client相同的转换逻辑
    // 构建Anthropic风格的请求，然后使用统一转换器
    const anthropicRequest = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.max_tokens || 131072,
      temperature: request.temperature,
      stream: false,
      system: request.metadata?.system,
      tools: request.metadata?.tools
    };

    // 使用统一转换器 (与Enhanced Client相同)
    const openaiRequest = transformAnthropicToOpenAI(anthropicRequest, request.metadata?.requestId);

    // 确保必要参数存在 (兼容ModelScope等服务)
    if (!openaiRequest.max_tokens) {
      openaiRequest.max_tokens = 4096;
    }
    if (typeof openaiRequest.temperature === 'undefined') {
      openaiRequest.temperature = 0.7;
    }

    return openaiRequest;
  }


  /**
   * 映射finish reason - 增强版本，确保工具调用正确映射
   */
  private mapFinishReason(finishReason: string, hasToolCalls: boolean = false): string {
    // 🔧 Critical Fix: 如果有工具调用，强制返回tool_use
    if (hasToolCalls && (finishReason === 'stop' || finishReason === 'tool_calls')) {
      return 'tool_use';
    }
    
    const mapping: Record<string, string> = {
      'stop': 'end_turn',
      'length': 'max_tokens',
      'tool_calls': 'tool_use',
      'function_call': 'tool_use',
      'content_filter': 'stop_sequence'
    };

    return mapping[finishReason] || 'end_turn';
  }
}

/**
 * 创建OpenAI SDK客户端
 */
export function createOpenAISDKClient(config: OpenAISDKConfig, providerId: string): OpenAISDKClient {
  return new OpenAISDKClient(config, providerId);
}