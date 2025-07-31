/**
 * CodeWhisperer AWS Binary Event Stream Parser
 * Handles AWS CodeWhisperer's binary event stream format
 */

import { logger } from '@/utils/logger';

export interface ParsedEvent {
  event: string;
  data: any;
}

export interface SSEEvent {
  Event: string;
  Data: any;
}

export interface AWSBinaryEvent {
  headers: Record<string, any>;
  payload: string;
  payloadJSON?: any;
}

/**
 * Parse CodeWhisperer AWS Binary Event Stream from raw response
 * Handles the binary format returned by CodeWhisperer API
 */
export function parseEvents(rawResponse: Buffer): SSEEvent[] {
  try {
    logger.debug('Parsing AWS Binary Event Stream', {
      responseLength: rawResponse.length,
      responsePreview: rawResponse.toString('hex').substring(0, 100)
    });
    
    const binaryEvents = parseAWSBinaryEvents(rawResponse);
    const sseEvents: SSEEvent[] = [];
    
    logger.debug('Binary events parsed', {
      eventCount: binaryEvents.length
    });
    
    // Convert AWS binary events to SSE format
    for (const binaryEvent of binaryEvents) {
      const sseEvent = convertBinaryEventToSSE(binaryEvent);
      if (sseEvent) {
        sseEvents.push(sseEvent);
      }
    }
    
    logger.debug('Events converted to SSE format', {
      eventCount: sseEvents.length,
      eventTypes: sseEvents.map(e => e.Event)
    });
    
    return sseEvents;
  } catch (error) {
    logger.error('Failed to parse AWS Binary Event Stream', error);
    return [];
  }
}

/**
 * Parse AWS Binary Event Stream format
 */
function parseAWSBinaryEvents(buffer: Buffer): AWSBinaryEvent[] {
  const events: AWSBinaryEvent[] = [];
  let offset = 0;
  
  while (offset < buffer.length) {
    try {
      const event = parseEventAtOffset(buffer, offset);
      if (event) {
        events.push(event.data);
        offset = event.nextOffset;
      } else {
        break;
      }
    } catch (error) {
      logger.debug('Failed to parse event at offset', { offset, error });
      break;
    }
  }
  
  return events;
}

/**
 * Parse single AWS event at given offset
 */
function parseEventAtOffset(buffer: Buffer, offset: number): { data: AWSBinaryEvent; nextOffset: number } | null {
  if (offset + 12 > buffer.length) {
    return null;
  }

  // AWS Event Stream format:
  // 4 bytes: total message length
  // 4 bytes: headers length  
  // 4 bytes: CRC of prelude
  // headers
  // payload
  // 4 bytes: message CRC

  const totalLength = buffer.readUInt32BE(offset);
  const headersLength = buffer.readUInt32BE(offset + 4);
  
  if (offset + totalLength > buffer.length) {
    return null;
  }

  // Parse headers
  const headersStart = offset + 12;
  const headers = parseHeaders(buffer, headersStart, headersLength);
  
  // Parse payload
  const payloadStart = headersStart + headersLength;
  const payloadLength = totalLength - 12 - headersLength - 4;
  const payload = buffer.slice(payloadStart, payloadStart + payloadLength);
  
  const eventData: AWSBinaryEvent = {
    headers: headers,
    payload: payload.toString('utf8')
  };

  // Try to parse JSON payload
  try {
    eventData.payloadJSON = JSON.parse(eventData.payload);
  } catch {
    // Payload is not JSON, keep as string
  }

  return {
    data: eventData,
    nextOffset: offset + totalLength
  };
}

/**
 * Parse AWS event headers
 */
function parseHeaders(buffer: Buffer, start: number, length: number): Record<string, any> {
  const headers: Record<string, any> = {};
  let offset = start;
  const end = start + length;

  while (offset < end) {
    if (offset + 4 > end) break;

    const nameLength = buffer.readUInt8(offset);
    offset += 1;

    if (offset + nameLength > end) break;

    const name = buffer.slice(offset, offset + nameLength).toString('utf8');
    offset += nameLength;

    if (offset + 3 > end) break;

    const valueType = buffer.readUInt8(offset);
    offset += 1;

    const valueLength = buffer.readUInt16BE(offset);
    offset += 2;

    if (offset + valueLength > end) break;

    let value;
    if (valueType === 7) { // String
      value = buffer.slice(offset, offset + valueLength).toString('utf8');
    } else {
      value = buffer.slice(offset, offset + valueLength);
    }

    headers[name] = value;
    offset += valueLength;
  }

  return headers;
}

/**
 * Convert AWS binary event to SSE format
 */
function convertBinaryEventToSSE(binaryEvent: AWSBinaryEvent): SSEEvent | null {
  try {
    // Extract event type from headers
    const eventType = binaryEvent.headers[':event-type'] || 'assistantResponseEvent';
    
    // Use JSON payload if available, otherwise use raw payload
    const data = binaryEvent.payloadJSON || { text: binaryEvent.payload };
    
    return {
      Event: eventType,
      Data: data
    };
  } catch (error) {
    logger.debug('Failed to convert binary event to SSE', { error, binaryEvent });
    return null;
  }
}

/**
 * Convert raw events to Anthropic format with tool call accumulation
 */
export function convertEventsToAnthropic(events: SSEEvent[], requestId: string, modelName?: string): any[] {
  logger.debug('Converting events to Anthropic format with tool call processing', {
    eventCount: events.length
  }, requestId);

  const anthropicEvents: any[] = [];
  let accumulatedText = ''; // 累积文本用于检测工具调用
  let currentBlockIndex = 0;
  let hasStartedText = false;
  
  // 添加消息开始事件
  anthropicEvents.push({
    event: 'message_start',
    data: {
      type: 'message_start',
      message: {
        id: `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: [],
        model: modelName,
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 }
      }
    }
  });

  // 添加 ping 事件
  anthropicEvents.push({
    event: 'ping',
    data: { type: 'ping' }
  });
  
  for (const event of events) {
    try {
      switch (event.Event) {
        case 'assistantResponseEvent':
          // 🔑 关键修复：处理CodeWhisperer的assistantResponseEvent事件
          if (event.Data && event.Data.content) {
            const eventContent = event.Data.content;
            accumulatedText += eventContent;
            
            // 检查累积文本中是否有完整的工具调用 (支持XML格式)
            // 匹配格式: <ToolName>input_content</ToolName> 或 Tool call: ToolName({...})
            const xmlToolCallMatch = accumulatedText.match(/<(\w+)>(.*?)<\/\1>/s);
            const legacyToolCallMatch = accumulatedText.match(/Tool call: (\w+)\((\{.*?\})\)(?:\s|$)/s);
            
            let toolName, toolInput;
            let toolCallMatch = null;
            
            if (xmlToolCallMatch) {
              // XML格式: <WebSearch>query text</WebSearch>
              toolName = xmlToolCallMatch[1];
              const inputContent = xmlToolCallMatch[2].trim();
              toolInput = { query: inputContent }; // 大多数工具使用query参数
              toolCallMatch = xmlToolCallMatch;
              
              logger.debug('Detected XML-style tool call', {
                toolName,
                inputContent: inputContent.substring(0, 100),
                fullMatch: xmlToolCallMatch[0].substring(0, 200)
              }, requestId);
            } else if (legacyToolCallMatch) {
              // 传统格式: Tool call: ToolName({...})
              toolName = legacyToolCallMatch[1];
              const inputStr = legacyToolCallMatch[2];
              toolCallMatch = legacyToolCallMatch;
              
              try {
                toolInput = JSON.parse(inputStr);
              } catch (parseError) {
                logger.error('Failed to parse legacy tool input JSON', {
                  toolName,
                  inputStr,
                  error: parseError instanceof Error ? parseError.message : String(parseError)
                }, requestId);
                toolInput = { query: inputStr };
              }
            }
            
            if (toolCallMatch) {
              try {
                
                // 生成工具调用的开始事件
                anthropicEvents.push({
                  event: 'content_block_start',
                  data: {
                    type: 'content_block_start',
                    index: currentBlockIndex,
                    content_block: {
                      type: 'tool_use',
                      id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                      name: toolName,
                      input: {}
                    }
                  }
                });

                // 生成工具输入的流式事件
                const inputJson = JSON.stringify(toolInput);
                const chunkSize = 20; // 字符分块大小
                for (let i = 0; i < inputJson.length; i += chunkSize) {
                  const chunk = inputJson.slice(i, i + chunkSize);
                  anthropicEvents.push({
                    event: 'content_block_delta',
                    data: {
                      type: 'content_block_delta',
                      index: currentBlockIndex,
                      delta: {
                        type: 'input_json_delta',
                        partial_json: chunk
                      }
                    }
                  });
                }

                // 生成工具调用的结束事件
                anthropicEvents.push({
                  event: 'content_block_stop',
                  data: {
                    type: 'content_block_stop',
                    index: currentBlockIndex
                  }
                });

                logger.info('Generated tool call events from assistantResponseEvent', {
                  toolName,
                  toolInput,
                  blockIndex: currentBlockIndex
                }, requestId);

                currentBlockIndex++;
                
                // 移除工具调用，保留剩余文本
                if (xmlToolCallMatch) {
                  accumulatedText = accumulatedText.replace(/<\w+>.*?<\/\w+>/s, '').trim();
                } else if (legacyToolCallMatch) {
                  accumulatedText = accumulatedText.replace(/Tool call: \w+\(\{.*?\}\)(?:\s|$)/s, '').trim();
                }
              } catch (parseError) {
                logger.error('Failed to generate tool call events from assistantResponseEvent', {
                  toolName,
                  toolInput,
                  error: parseError instanceof Error ? parseError.message : String(parseError)
                }, requestId);
              }
            }
            
            // 处理普通文本内容 (检查是否包含未完成的工具调用)
            const hasIncompleteXmlTool = /<\w+(?:[^>]*>(?:[^<]*(?:<(?!\/))*[^<]*)*)?$/s.test(accumulatedText);
            const hasIncompleteLegacyTool = accumulatedText.includes('Tool call:');
            
            if (!toolCallMatch && !hasIncompleteXmlTool && !hasIncompleteLegacyTool) {
              if (!hasStartedText) {
                // 开始文本块
                anthropicEvents.push({
                  event: 'content_block_start',
                  data: {
                    type: 'content_block_start',
                    index: currentBlockIndex,
                    content_block: {
                      type: 'text',
                      text: ''
                    }
                  }
                });
                hasStartedText = true;
              }
              
              // 分块发送文本内容
              const chunkSize = 50;
              for (let i = 0; i < eventContent.length; i += chunkSize) {
                const chunk = eventContent.slice(i, i + chunkSize);
                anthropicEvents.push({
                  event: 'content_block_delta',
                  data: {
                    type: 'content_block_delta',
                    index: currentBlockIndex,
                    delta: {
                      type: 'text_delta',
                      text: chunk
                    }
                  }
                });
              }
              
              accumulatedText = ''; // 重置累积器
            }
          }
          break;

        case 'contentBlockStart':
          anthropicEvents.push({
            event: 'content_block_start',
            data: {
              type: 'content_block_start',
              index: event.Data.index || 0,
              content_block: event.Data.contentBlock || { type: 'text', text: '' }
            }
          });
          break;

        case 'contentBlockDelta':
          anthropicEvents.push({
            event: 'content_block_delta',
            data: {
              type: 'content_block_delta',
              index: event.Data.index || 0,
              delta: event.Data.delta || { type: 'text_delta', text: '' }
            }
          });
          break;

        case 'contentBlockStop':
          anthropicEvents.push({
            event: 'content_block_stop',
            data: {
              type: 'content_block_stop',
              index: event.Data.index || 0
            }
          });
          break;

        default:
          logger.debug('Unhandled event type in streaming conversion', {
            eventType: event.Event
          }, requestId);
          break;
      }
    } catch (error) {
      logger.error('Error converting event to Anthropic format', {
        eventType: event.Event,
        error: error instanceof Error ? error.message : String(error)
      }, requestId);
    }
  }

  // 处理剩余的累积文本
  if (accumulatedText && hasStartedText) {
    // 发送剩余文本
    const chunkSize = 50;
    for (let i = 0; i < accumulatedText.length; i += chunkSize) {
      const chunk = accumulatedText.slice(i, i + chunkSize);
      anthropicEvents.push({
        event: 'content_block_delta',
        data: {
          type: 'content_block_delta',
          index: currentBlockIndex,
          delta: {
            type: 'text_delta',
            text: chunk
          }
        }
      });
    }
  }

  // 结束当前文本块
  if (hasStartedText) {
    anthropicEvents.push({
      event: 'content_block_stop',
      data: {
        type: 'content_block_stop',
        index: currentBlockIndex
      }
    });
  }

  // 添加消息结束事件
  anthropicEvents.push({
    event: 'message_delta',
    data: {
      type: 'message_delta',
      delta: {
        stop_reason: 'end_turn',
        stop_sequence: null
      },
      usage: {
        output_tokens: 100 // 近似计算
      }
    }
  });

  anthropicEvents.push({
    event: 'message_stop',
    data: {
      type: 'message_stop'
    }
  });

  return anthropicEvents;
}

/**
 * Parse non-streaming response (used by legacy code)
 */
export function parseNonStreamingResponse(response: any, requestId: string): any {
  logger.debug('Parsing non-streaming response (legacy)', {
    hasContent: !!response.content,
    contentType: typeof response.content
  }, requestId);

  // Just return the response as-is for non-streaming
  return response;
}