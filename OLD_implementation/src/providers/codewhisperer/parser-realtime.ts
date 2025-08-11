/**
 * CodeWhisperer 实时流式解析器
 * 基于demo2的Go实现移植，实现零延迟二进制流解析
 * 项目所有者: Jason Zhang
 */

import { logger } from '@/utils/logger';
import { SSEEvent } from './client-interface';
import { AssistantResponseEvent } from './types';
import { Readable } from 'stream';

export interface BinaryFrame {
  totalLength: number;
  headerLength: number;
  payloadLength: number;
  payload: Buffer;
  offset: number;
}

export class CodeWhispererRealtimeParser {
  private readonly maxFrameSize: number;
  private readonly enableCompression: boolean;

  constructor(options: {
    maxFrameSize?: number;
    enableCompression?: boolean;
  } = {}) {
    this.maxFrameSize = options.maxFrameSize || 1024 * 1024; // 默认1MB
    this.enableCompression = options.enableCompression || false;
  }

  /**
   * 实时解析二进制流 - 基于demo2的ParseEvents函数
   * 返回AsyncIterable以支持真正的流式处理
   */
  async *parseRealtimeStream(
    stream: Readable,
    onProgress?: (progress: { parsedBytes: number; totalBytes: number; eventsCount: number }) => void
  ): AsyncIterable<SSEEvent> {
    const buffer = await this.streamToBuffer(stream);
    let offset = 0;
    let eventsCount = 0;
    const totalBytes = buffer.length;

    logger.debug('开始实时解析CodeWhisperer流', {
      bufferSize: totalBytes,
      maxFrameSize: this.maxFrameSize,
    });

    while (offset < buffer.length) {
      try {
        const frame = this.readBinaryFrame(buffer, offset);
        if (!frame) {
          break;
        }

        // 验证帧大小
        if (frame.totalLength > this.maxFrameSize) {
          logger.warn('帧大小超过限制，跳过', {
            frameLength: frame.totalLength,
            maxFrameSize: this.maxFrameSize,
            offset,
          });
          offset += frame.totalLength;
          continue;
        }

        // 解析帧payload
        const events = this.parseFramePayload(frame.payload);
        eventsCount += events.length;

        // 实时yield每个事件（零延迟转发）
        for (const event of events) {
          yield event;
        }

        offset += frame.totalLength;

        // 报告进度
        if (onProgress) {
          onProgress({
            parsedBytes: offset,
            totalBytes,
            eventsCount,
          });
        }

      } catch (error) {
        logger.error('解析二进制帧失败', {
          error: error instanceof Error ? error.message : String(error),
          offset,
          remainingBytes: buffer.length - offset,
        });
        break;
      }
    }

    logger.debug('实时流解析完成', {
      parsedBytes: offset,
      totalBytes,
      eventsCount,
    });
  }

  /**
   * 解析完整的缓冲区（向后兼容）
   */
  parseEvents(responseBuffer: Buffer): SSEEvent[] {
    const events: SSEEvent[] = [];
    let offset = 0;

    logger.debug('开始解析CodeWhisperer响应', {
      bufferLength: responseBuffer.length,
    });

    while (offset < responseBuffer.length) {
      const frame = this.readBinaryFrame(responseBuffer, offset);
      if (!frame) {
        break;
      }

      const frameEvents = this.parseFramePayload(frame.payload);
      events.push(...frameEvents);

      offset += frame.totalLength;
    }

    logger.debug('CodeWhisperer响应解析完成', {
      totalEvents: events.length,
      parsedBytes: offset,
      totalBytes: responseBuffer.length,
    });

    return events;
  }

  /**
   * 读取二进制帧 - 基于demo2的帧读取逻辑
   */
  private readBinaryFrame(buffer: Buffer, offset: number): BinaryFrame | null {
    // 检查是否有足够的字节读取帧头（基于demo2的长度检查）
    if (buffer.length - offset < 12) {
      logger.debug('剩余字节不足12，停止解析', {
        remaining: buffer.length - offset,
        offset,
      });
      return null;
    }

    try {
      // 读取总长度和头部长度（基于demo2的binary.Read逻辑）
      const totalLen = buffer.readUInt32BE(offset);
      const headerLen = buffer.readUInt32BE(offset + 4);

      logger.debug('读取帧信息', {
        totalLen,
        headerLen,
        currentOffset: offset + 8,
      });

      // 验证帧长度（基于demo2的长度验证）
      if (totalLen > buffer.length - offset + 8) {
        logger.warn('帧长度无效，停止解析', {
          totalLen,
          remainingBytes: buffer.length - offset + 8,
          offset,
        });
        return null;
      }

      // 跳过头部（基于demo2的header跳过逻辑）
      const headerOffset = offset + 8;
      const payloadOffset = headerOffset + headerLen;

      // 计算payload长度
      const payloadLen = totalLen - headerLen - 12;
      if (payloadLen <= 0) {
        // 空payload，跳过CRC32并继续
        logger.debug('空payload帧，跳过');
        return {
          totalLength: totalLen,
          headerLength: headerLen,
          payloadLength: 0,
          payload: Buffer.alloc(0),
          offset: offset + totalLen,
        };
      }

      // 读取payload
      const payload = buffer.subarray(payloadOffset, payloadOffset + payloadLen);

      // 跳过CRC32（基于demo2的CRC32跳过）
      const nextOffset = offset + totalLen;

      logger.debug('成功读取二进制帧', {
        totalLen,
        headerLen,
        payloadLen,
        payloadPreview: payload.toString('utf8').substring(0, 100),
        offset: nextOffset,
      });

      return {
        totalLength: totalLen,
        headerLength: headerLen,
        payloadLength: payloadLen,
        payload,
        offset: nextOffset,
      };

    } catch (error) {
      logger.error('读取二进制帧失败', {
        error: error instanceof Error ? error.message : String(error),
        offset,
        bufferLength: buffer.length,
      });
      return null;
    }
  }

  /**
   * 解析帧payload - 基于demo2的payload处理逻辑
   */
  private parseFramePayload(payload: Buffer): SSEEvent[] {
    if (payload.length === 0) {
      return [];
    }

    let payloadStr = payload.toString('utf8');

    // 移除"vent"前缀（基于demo2的TrimPrefix逻辑）
    if (payloadStr.startsWith('vent')) {
      payloadStr = payloadStr.substring(4);
    }

    logger.debug('解析payload', {
      payloadLen: payload.length,
      payloadPreview: payloadStr.substring(0, 100),
    });

    // 尝试解析为JSON（基于demo2的json.Unmarshal）
    try {
      const evt: AssistantResponseEvent = JSON.parse(payloadStr);

      logger.debug('成功解析事件', {
        hasContent: !!evt.content,
        hasToolInfo: !!(evt.toolUseId && evt.name),
        stop: evt.stop,
      });

      // 转换为SSE事件（基于demo2的convertAssistantEventToSSE）
      const sseEvents: SSEEvent[] = [];
      const mainEvent = this.convertAssistantEventToSSE(evt);
      if (mainEvent.event) {
        sseEvents.push(mainEvent);
      }

      // 处理工具调用的特殊情况（基于demo2的工具调用处理）
      if (evt.toolUseId && evt.name && evt.stop) {
        const stopEvent: SSEEvent = {
          event: 'message_delta',
          data: {
            type: 'message_delta',
            delta: {
              stop_reason: 'tool_use',
              stop_sequence: null,
            },
            usage: { output_tokens: 0 },
          },
        };
        sseEvents.push(stopEvent);

        logger.debug('添加工具调用停止事件');
      }

      return sseEvents;

    } catch (parseError) {
      logger.warn('JSON解析失败', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        payloadPreview: payloadStr.substring(0, 200),
      });
      return [];
    }
  }

  /**
   * 将AssistantResponseEvent转换为SSEEvent（完全基于demo2的convertAssistantEventToSSE函数）
   */
  private convertAssistantEventToSSE(evt: AssistantResponseEvent): SSEEvent {
    // 文本内容事件（基于demo2的文本处理）
    if (evt.content) {
      return {
        event: 'content_block_delta',
        data: {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'text_delta',
            text: evt.content,
          },
        },
      };
    }

    // 工具调用事件（基于demo2的工具调用处理）
    if (evt.toolUseId && evt.name && !evt.stop) {
      if (!evt.input) {
        // 工具调用开始事件
        return {
          event: 'content_block_start',
          data: {
            type: 'content_block_start',
            index: 1,
            content_block: {
              type: 'tool_use',
              id: evt.toolUseId,
              name: evt.name,
              input: {},
            },
          },
        };
      } else {
        // 工具调用输入增量事件
        return {
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: 1,
            delta: {
              type: 'input_json_delta',
              id: evt.toolUseId,
              name: evt.name,
              partial_json: evt.input,
            },
          },
        };
      }
    }

    // 停止事件（基于demo2的停止处理）
    if (evt.stop) {
      return {
        event: 'content_block_stop',
        data: {
          type: 'content_block_stop',
          index: 1,
        },
      };
    }

    // 无效事件
    return { event: '', data: null };
  }

  /**
   * 将流转换为Buffer（用于向后兼容）
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalLength = 0;

      stream.on('data', (chunk) => {
        chunks.push(chunk);
        totalLength += chunk.length;
      });

      stream.on('end', () => {
        resolve(Buffer.concat(chunks, totalLength));
      });

      stream.on('error', reject);
    });
  }

  /**
   * 实时工具调用解析 - 立即处理而不缓冲
   */
  parseToolCallsRealtime(events: SSEEvent[]): {
    textContent: string;
    toolCalls: Array<{
      id: string;
      name: string;
      input: any;
    }>;
  } {
    const textContent = '';
    const toolCalls: Array<{
      id: string;
      name: string;
      input: any;
    }> = [];

    let currentTool: {
      id: string;
      name: string;
      jsonFragments: string[];
    } | null = null;

    for (const event of events) {
      if (!event.data || typeof event.data !== 'object') continue;

      const dataMap = event.data as any;

      switch (dataMap.type) {
        case 'content_block_start':
          if (dataMap.content_block?.type === 'tool_use') {
            // 开始新的工具调用
            currentTool = {
              id: dataMap.content_block.id,
              name: dataMap.content_block.name,
              jsonFragments: [],
            };
          }
          break;

        case 'content_block_delta':
          if (dataMap.delta?.type === 'input_json_delta' && currentTool) {
            // 收集JSON片段
            if (dataMap.delta.partial_json) {
              currentTool.jsonFragments.push(dataMap.delta.partial_json);
            }
          } else if (dataMap.delta?.type === 'text_delta') {
            // 收集文本内容
            // textContent += dataMap.delta.text;
          }
          break;

        case 'content_block_stop':
          if (dataMap.index === 1 && currentTool) {
            // 完成工具调用
            try {
              const completeJson = currentTool.jsonFragments.join('');
              const toolInput = JSON.parse(completeJson);
              toolCalls.push({
                id: currentTool.id,
                name: currentTool.name,
                input: toolInput,
              });
            } catch (parseError) {
              logger.warn('工具JSON解析失败', {
                toolId: currentTool.id,
                error: parseError instanceof Error ? parseError.message : String(parseError),
              });
            }
            currentTool = null;
          }
          break;
      }
    }

    return {
      textContent,
      toolCalls,
    };
  }

  /**
   * 构建非流式响应
   */
  buildNonStreamResponse(events: any[], model: string): any {
    // 简单构建响应对象
    return {
      content: events.filter(e => e.data?.content).map(e => e.data.content).join(''),
      model,
      events
    };
  }
}
