/**
 * CodeWhisperer AWS Binary Event Stream Parser - Full Buffered Version
 * 完全缓冲版本：将整个响应转为非流式处理，然后重新转换为流式格式
 * 基于demo2的完整缓冲策略，彻底避免分段工具调用问题
 */

import { logger } from '@/utils/logger';
import { parseEvents, SSEEvent, ParsedEvent } from './parser';

export interface BufferedResponse {
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: any;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * 完全缓冲式处理：模拟非流式响应，然后转换回流式格式
 * 这种方法能彻底避免分段工具调用的问题
 */
export function processBufferedResponse(rawResponse: Buffer, requestId: string): ParsedEvent[] {
  try {
    logger.info('Starting full buffered response processing', {
      responseLength: rawResponse.length,
      rawPreview: rawResponse.toString('hex').slice(0, 200)
    }, requestId);

    // 第一步：解析原始二进制响应为SSE事件
    const sseEvents = parseEvents(rawResponse);
    logger.info('Parsed SSE events from raw response', {
      eventCount: sseEvents.length,
      eventTypes: sseEvents.map(e => e.Event),
      eventDetails: sseEvents.map(e => ({
        event: e.Event,
        dataKeys: e.Data ? Object.keys(e.Data) : [],
        dataPreview: e.Data ? JSON.stringify(e.Data).slice(0, 200) : 'null'
      }))
    }, requestId);

    // 第二步：将所有SSE事件合并为完整的非流式响应
    const bufferedResponse = convertToBufferedResponse(sseEvents, requestId);
    logger.debug('Converted to buffered response', {
      contentBlocks: bufferedResponse.content.length,
      contentTypes: bufferedResponse.content.map(c => c.type)
    }, requestId);

    // 第三步：将缓冲响应重新转换为流式事件
    const streamEvents = convertBufferedResponseToStream(bufferedResponse, requestId);
    logger.debug('Converted buffered response back to stream events', {
      streamEventCount: streamEvents.length,
      streamEventTypes: streamEvents.map(e => e.event)
    }, requestId);

    return streamEvents;

  } catch (error) {
    logger.error('Failed to process buffered response', error, requestId);
    return [];
  }
}

/**
 * 将SSE事件转换为完整的缓冲响应（模拟非流式API响应）
 */
function convertToBufferedResponse(events: SSEEvent[], requestId: string): BufferedResponse {
  const response: BufferedResponse = {
    content: [],
    usage: { input_tokens: 0, output_tokens: 0 }
  };

  let currentTextContent = '';
  let currentToolCall: { name?: string; id?: string; input?: any } | null = null;
  let accumulatedToolInput = '';

  logger.debug('Converting SSE events to buffered response', {
    eventCount: events.length
  }, requestId);

  for (const event of events) {
    const { Event, Data } = event;
    
    logger.debug('Processing SSE event for buffering', {
      eventType: Event,
      dataKeys: Data ? Object.keys(Data) : []
    }, requestId);

    switch (Event) {
      case 'assistantResponseEvent':
        if (Data && typeof Data === 'object') {
          // 处理文本内容
          if (Data.content) {
            currentTextContent += Data.content;
            logger.debug('Accumulated text content from assistantResponseEvent', {
              addedLength: Data.content.length,
              totalLength: currentTextContent.length
            }, requestId);
          }

          // 处理工具调用
          if (Data.toolUseId && Data.name) {
            if (!currentToolCall || currentToolCall.id !== Data.toolUseId) {
              // 完成之前的工具调用（如果存在）
              if (currentToolCall) {
                logger.debug('Completing previous tool call before starting new one', {
                  previousTool: currentToolCall.name
                }, requestId);
                response.content.push({
                  type: 'tool_use',
                  id: currentToolCall.id,
                  name: currentToolCall.name,
                  input: currentToolCall.input
                });
              }

              // 开始新的工具调用
              currentToolCall = {
                name: Data.name,
                id: Data.toolUseId,
                input: {}
              };
              accumulatedToolInput = '';
              logger.debug('Started new tool call', {
                toolName: Data.name,
                toolId: Data.toolUseId
              }, requestId);
            }

            // 累积工具输入
            if (Data.input && Data.input !== null && Data.input !== undefined) {
              accumulatedToolInput += Data.input;
              logger.debug('Accumulated tool input', {
                addedInput: Data.input,
                totalInput: accumulatedToolInput
              }, requestId);
            }

            // 工具调用完成
            if (Data.stop && currentToolCall) {
              try {
                if (accumulatedToolInput.trim()) {
                  currentToolCall.input = JSON.parse(accumulatedToolInput);
                  logger.debug('Successfully parsed tool input JSON', {
                    inputLength: accumulatedToolInput.length,
                    parsedInput: currentToolCall.input
                  }, requestId);
                } else {
                  currentToolCall.input = {};
                  logger.debug('Using empty input for tool call (no accumulated input)', {}, requestId);
                }
              } catch (error) {
                logger.warn('Failed to parse accumulated tool input, using empty object', {
                  error: error,
                  input: accumulatedToolInput,
                  inputLength: accumulatedToolInput.length
                }, requestId);
                currentToolCall.input = {};
              }

              response.content.push({
                type: 'tool_use',
                id: currentToolCall.id,
                name: currentToolCall.name,
                input: currentToolCall.input
              });

              logger.info('Completed tool call buffering', {
                toolName: currentToolCall.name,
                toolId: currentToolCall.id,
                inputLength: accumulatedToolInput.length,
                hasValidInput: Object.keys(currentToolCall.input).length > 0
              }, requestId);

              currentToolCall = null;
              accumulatedToolInput = '';
            }
          }
        }
        break;

      case 'toolUseEvent':
        // 处理专门的工具使用事件
        if (Data && typeof Data === 'object') {
          logger.debug('Processing toolUseEvent', {
            dataKeys: Object.keys(Data),
            hasToolUseId: !!Data.toolUseId,
            hasName: !!Data.name,
            hasInput: !!Data.input,
            hasStop: !!Data.stop
          }, requestId);

          if (Data.toolUseId && Data.name) {
            if (!currentToolCall || currentToolCall.id !== Data.toolUseId) {
              currentToolCall = {
                name: Data.name,
                id: Data.toolUseId,
                input: {}
              };
              accumulatedToolInput = '';
            }

            if (Data.input && Data.input !== null && Data.input !== undefined) {
              accumulatedToolInput += Data.input;
              logger.info('Accumulated tool input from toolUseEvent', {
                addedInput: Data.input,
                totalAccumulated: accumulatedToolInput,
                accumulatedLength: accumulatedToolInput.length
              }, requestId);
            }

            if (Data.stop) {
              logger.info('Processing tool stop event', {
                toolName: currentToolCall.name,
                toolId: currentToolCall.id,
                finalAccumulatedInput: accumulatedToolInput,
                inputLength: accumulatedToolInput.length
              }, requestId);
              
              try {
                if (accumulatedToolInput.trim()) {
                  const parsedInput = JSON.parse(accumulatedToolInput);
                  currentToolCall.input = parsedInput;
                  logger.info('Successfully parsed tool input JSON', {
                    originalString: accumulatedToolInput,
                    parsedObject: JSON.stringify(parsedInput),
                    inputKeys: Object.keys(parsedInput)
                  }, requestId);
                } else {
                  currentToolCall.input = {};
                  logger.warn('Using empty input - no accumulated input', {}, requestId);
                }
              } catch (error) {
                logger.error('Failed to parse toolUseEvent input JSON', {
                  error: error instanceof Error ? error.message : String(error),
                  input: accumulatedToolInput,
                  inputLength: accumulatedToolInput.length,
                  inputPreview: accumulatedToolInput.slice(0, 100)
                }, requestId);
                currentToolCall.input = {};
              }

              response.content.push({
                type: 'tool_use',
                id: currentToolCall.id,
                name: currentToolCall.name,
                input: currentToolCall.input
              });

              currentToolCall = null;
              accumulatedToolInput = '';
            }
          }
        }
        break;

      default:
        // 处理其他事件中可能包含的文本内容
        logger.debug('Processing unknown event type', {
          eventType: Event,
          dataType: typeof Data,
          dataKeys: Data && typeof Data === 'object' ? Object.keys(Data) : []
        }, requestId);

        if (Data && typeof Data === 'object') {
          if (Data.text) {
            currentTextContent += Data.text;
            logger.debug('Accumulated text from unknown event', {
              addedText: Data.text
            }, requestId);
          } else if (Data.content) {
            currentTextContent += Data.content;
            logger.debug('Accumulated content from unknown event', {
              addedContent: Data.content
            }, requestId);
          }
        }
        break;
    }
  }

  // 处理剩余的文本内容
  if (currentTextContent.trim()) {
    // 检查文本中是否包含未处理的工具调用
    if (currentTextContent.includes('Tool call:')) {
      logger.warn('Found unprocessed tool call in text content', {
        textLength: currentTextContent.length,
        textPreview: currentTextContent.substring(0, 200)
      }, requestId);

      // 尝试从文本中提取工具调用
      const extractedToolCall = extractToolCallFromText(currentTextContent, requestId);
      if (extractedToolCall) {
        response.content.push(extractedToolCall);
        logger.info('Successfully extracted tool call from text', {
          toolName: extractedToolCall.name
        }, requestId);
      } else {
        // 如果提取失败，仍然作为文本处理
        response.content.push({
          type: 'text',
          text: currentTextContent
        });
      }
    } else {
      response.content.push({
        type: 'text',
        text: currentTextContent
      });
    }
  }

  logger.debug('Buffered response conversion completed', {
    totalContentBlocks: response.content.length,
    textBlocks: response.content.filter(c => c.type === 'text').length,
    toolBlocks: response.content.filter(c => c.type === 'tool_use').length
  }, requestId);

  return response;
}

/**
 * 从文本中提取工具调用（处理遗留的工具调用文本）
 */
function extractToolCallFromText(text: string, requestId: string): { type: 'tool_use'; id: string; name: string; input: any } | null {
  try {
    // 匹配工具调用格式：Tool call: ToolName({...})
    const toolCallMatch = text.match(/Tool call:\s*(\w+)\s*\((\{.*?\})\)/s);
    if (toolCallMatch) {
      const toolName = toolCallMatch[1];
      const toolArgsStr = toolCallMatch[2];

      let toolInput = {};
      try {
        toolInput = JSON.parse(toolArgsStr);
      } catch (parseError) {
        logger.warn('Failed to parse tool arguments from text', {
          error: parseError,
          toolName,
          argsString: toolArgsStr
        }, requestId);
      }

      return {
        type: 'tool_use',
        id: `extracted_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: toolName,
        input: toolInput
      };
    }

    return null;
  } catch (error) {
    logger.error('Failed to extract tool call from text', error, requestId);
    return null;
  }
}

/**
 * 将缓冲响应转换回流式事件格式
 */
function convertBufferedResponseToStream(bufferedResponse: BufferedResponse, requestId: string): ParsedEvent[] {
  const streamEvents: ParsedEvent[] = [];

  logger.debug('Converting buffered response to stream events', {
    contentBlocks: bufferedResponse.content.length
  }, requestId);

  // 添加消息开始事件
  streamEvents.push({
    event: 'message_start',
    data: {
      type: 'message_start',
      message: {
        id: `msg_buffered_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: [],
        model: 'claude-3-sonnet-20240229',
        stop_reason: null,
        stop_sequence: null,
        usage: bufferedResponse.usage
      }
    }
  });

  // 处理每个内容块
  bufferedResponse.content.forEach((contentBlock, index) => {
    if (contentBlock.type === 'text' && contentBlock.text) {
      // 文本内容块
      streamEvents.push({
        event: 'content_block_start',
        data: {
          type: 'content_block_start',
          index: index,
          content_block: {
            type: 'text',
            text: ''
          }
        }
      });

      streamEvents.push({
        event: 'content_block_delta',
        data: {
          type: 'content_block_delta',
          index: index,
          delta: {
            type: 'text_delta',
            text: contentBlock.text
          }
        }
      });

      streamEvents.push({
        event: 'content_block_stop',
        data: {
          type: 'content_block_stop',
          index: index
        }
      });

    } else if (contentBlock.type === 'tool_use') {
      // 工具调用内容块
      streamEvents.push({
        event: 'content_block_start',
        data: {
          type: 'content_block_start',
          index: index,
          content_block: {
            type: 'tool_use',
            id: contentBlock.id,
            name: contentBlock.name,
            input: {}
          }
        }
      });

      // 如果有输入参数，添加input_json_delta事件
      if (contentBlock.input && Object.keys(contentBlock.input).length > 0) {
        streamEvents.push({
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: index,
            delta: {
              type: 'input_json_delta',
              partial_json: JSON.stringify(contentBlock.input)
            }
          }
        });
      }

      streamEvents.push({
        event: 'content_block_stop',
        data: {
          type: 'content_block_stop',
          index: index
        }
      });

      logger.debug('Added tool use stream events', {
        toolName: contentBlock.name,
        toolId: contentBlock.id,
        eventsAdded: 3
      }, requestId);
    }
  });

  // 添加消息结束事件
  streamEvents.push({
    event: 'message_delta',
    data: {
      type: 'message_delta',
      delta: {
        stop_reason: 'end_turn',
        stop_sequence: null
      },
      usage: { output_tokens: 0 }
    }
  });

  streamEvents.push({
    event: 'message_stop',
    data: {
      type: 'message_stop'
    }
  });

  logger.debug('Stream events generation completed', {
    totalEvents: streamEvents.length,
    eventTypes: streamEvents.map(e => e.event)
  }, requestId);

  return streamEvents;
}