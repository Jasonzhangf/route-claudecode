/**
 * CodeWhisperer Streaming Handler - 统一流式处理
 * 处理CodeWhisperer流式响应，转换为Anthropic SSE格式
 * 项目所有者: Jason Zhang
 */

import { BaseRequest } from '@/types';
import { logger } from '@/utils/logger';
import { CodeWhispererTransformer } from '@/transformers/codewhisperer';
import { 
  validateStreamingChunk, 
  isValidContentChunk 
} from '@/utils/response-validation';
import { CodeWhispererAuth } from '@/providers/codewhisperer/auth';
import { AxiosInstance } from 'axios';

export interface CodeWhispererStreamingHandlerConfig {
  providerName: string;
  httpClient: AxiosInstance;
  transformer: CodeWhispererTransformer;
  auth: CodeWhispererAuth;
}

export interface CodeWhispererStreamingHandler {
  processStreamRequest(request: BaseRequest): AsyncIterable<any>;
}

/**
 * CodeWhisperer流式处理器实现
 */
export class CodeWhispererStreamingHandlerImpl implements CodeWhispererStreamingHandler {
  private config: CodeWhispererStreamingHandlerConfig;

  constructor(config: CodeWhispererStreamingHandlerConfig) {
    this.config = config;
  }

  /**
   * 处理流式请求
   */
  async *processStreamRequest(request: BaseRequest): AsyncIterable<any> {
    const requestId = request.metadata?.requestId || 'unknown';

    try {
      // 🔄 使用transformer转换请求
      const cwRequest = {
        ...this.config.transformer.transformBaseToCodeWhisperer(request),
        stream: true
      };

      logger.debug('Sending streaming request to CodeWhisperer', {
        model: cwRequest.model,
        hasTools: !!(cwRequest.tools && cwRequest.tools.length > 0),
        messageCount: cwRequest.messages.length,
        requestId,
        provider: this.config.providerName
      }, requestId, 'provider');

      // 🎯 发送流式请求到CodeWhisperer
      const response = await this.config.httpClient.post('/chat/completions', cwRequest, {
        responseType: 'stream'
      });

      let messageId = `msg_${Date.now()}`;
      let hasStarted = false;
      let chunkCount = 0;
      let hasValidContent = false;
      let finishReason: string | undefined;

      // 处理流式响应
      const stream = this.parseSSEStream(response.data);

      for await (const chunk of stream) {
        chunkCount++;

        // 🚨 验证流式chunk
        validateStreamingChunk(chunk, requestId, this.config.providerName, chunkCount);

        // 跟踪有效内容
        if (isValidContentChunk(chunk)) {
          hasValidContent = true;
        }

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
                model: request.metadata?.originalModel || cwRequest.model,
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: 0, output_tokens: 0 }
              }
            }
          };
          hasStarted = true;
        }

        // 🎯 转换和转发chunk
        const convertedChunk = this.convertCodeWhispererChunkToAnthropic(chunk, messageId);
        if (convertedChunk) {
          // 提取finish reason
          if (convertedChunk.event === 'message_delta' && convertedChunk.data?.delta?.stop_reason) {
            finishReason = convertedChunk.data.delta.stop_reason;
          }

          yield convertedChunk;
        }
      }

      // 🚨 确保流式响应产生了有效内容
      if (chunkCount === 0) {
        const error = new Error('CodeWhisperer streaming request produced no chunks - potential silent failure');
        console.error(`🚨 [${this.config.providerName}] STREAMING SILENT FAILURE DETECTED:`);
        console.error(`   Request ID: ${requestId}`);
        console.error(`   Chunks: ${chunkCount}`);
        console.error(`   Valid Content: ${hasValidContent}`);
        throw error;
      }

      logger.debug('CodeWhisperer streaming request completed successfully', {
        chunkCount,
        hasValidContent,
        finishReason,
        requestId,
        provider: this.config.providerName
      }, requestId, 'provider');

    } catch (error) {
      logger.error('CodeWhisperer streaming request failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: this.config.providerName,
        model: request.model,
        requestId
      }, requestId, 'provider');

      throw error;
    }
  }

  /**
   * 解析SSE流
   */
  private async *parseSSEStream(stream: any): AsyncIterable<any> {
    let buffer = '';

    for await (const chunk of stream) {
      buffer += chunk.toString();
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留不完整的行

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            yield parsed;
          } catch (error) {
            logger.warn('Failed to parse SSE data', { line, error });
          }
        }
      }
    }
  }

  /**
   * 转换CodeWhisperer chunk为Anthropic格式
   */
  private convertCodeWhispererChunkToAnthropic(chunk: any, messageId: string): any | null {
    if (!chunk || typeof chunk !== 'object') {
      return null;
    }

    // CodeWhisperer通常直接使用Anthropic格式
    // 但需要确保格式标准化
    
    if (chunk.type === 'content_block_delta') {
      return {
        event: 'content_block_delta',
        data: chunk
      };
    }

    if (chunk.type === 'content_block_start') {
      return {
        event: 'content_block_start',
        data: chunk
      };
    }

    if (chunk.type === 'message_delta') {
      return {
        event: 'message_delta',
        data: chunk
      };
    }

    if (chunk.type === 'message_stop') {
      return {
        event: 'message_stop',
        data: chunk
      };
    }

    // 如果是其他格式，尝试转换
    return {
      event: 'ping',
      data: chunk
    };
  }
}

/**
 * 创建CodeWhisperer流式处理器
 */
export function createCodeWhispererStreamingHandler(
  config: CodeWhispererStreamingHandlerConfig
): CodeWhispererStreamingHandler {
  return new CodeWhispererStreamingHandlerImpl(config);
}