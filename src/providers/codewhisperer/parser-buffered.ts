/**
 * CodeWhisperer AWS Binary Event Stream Parser - Full Buffered Version
 * 完全缓冲版本：将整个响应转为非流式处理，然后重新转换为流式格式
 * 基于demo2的完整缓冲策略，彻底避免分段工具调用问题
 */

import { logger } from '@/utils/logger';
import { parseEvents, SSEEvent, ParsedEvent } from './parser';
import { captureParsingEvent, captureToolCallEvent } from './data-capture';

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
export function processBufferedResponse(rawResponse: Buffer, requestId: string, modelName: string): ParsedEvent[] {
  const startTime = Date.now();
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

    // Capture SSE parsing completion
    captureParsingEvent(requestId, 'sse_parsing', {
      sseEventCount: sseEvents.length,
      sseEvents: sseEvents,
      processingTime: Date.now() - startTime
    });

    // 第二步：将所有SSE事件合并为完整的非流式响应
    const bufferedResponse = convertToBufferedResponse(sseEvents, requestId);
    logger.debug('Converted to buffered response', {
      contentBlocks: bufferedResponse.content.length,
      contentTypes: bufferedResponse.content.map(c => c.type),
      hasUsage: !!bufferedResponse.usage
    }, requestId);

    // Count tool calls detected
    const toolCallsDetected = bufferedResponse.content.filter(c => c.type === 'tool_use').length;
    const textBlocksDetected = bufferedResponse.content.filter(c => c.type === 'text').length;

    // 第三步：将非流式响应转换回流式事件格式
    const streamEvents = convertBufferedResponseToStream(bufferedResponse, requestId, modelName);
    logger.info('Converted buffered response back to stream events', {
      streamEventCount: streamEvents.length,
      eventTypes: streamEvents.map(e => e.event)
    }, requestId);

    // Capture buffered conversion completion
    captureParsingEvent(requestId, 'buffered_conversion', {
      bufferedResponse: bufferedResponse,
      streamEvents: streamEvents,
      toolCallsDetected,
      textBlocksDetected,
      processingTime: Date.now() - startTime
    });

    return streamEvents;
  } catch (error) {
    // Capture parsing error
    captureParsingEvent(requestId, 'parsing_error', {
      errorDetails: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    });
    
    logger.error('Failed to process buffered response', {
      error: error instanceof Error ? error.message : String(error),
      responseLength: rawResponse.length
    }, requestId);
    return [];
  }
}

/**
 * 将SSE事件合并为完整的非流式响应
 * 这是关键步骤：累积所有分段数据
 */
function convertToBufferedResponse(sseEvents: SSEEvent[], requestId: string): BufferedResponse {
  const content: BufferedResponse['content'] = [];
  const textBuffers: { [index: number]: string } = {};
  const toolBuffers: { [index: number]: { id?: string; name?: string; inputJson: string } } = {};
  
  logger.debug('Starting SSE to buffered conversion', {
    eventCount: sseEvents.length
  }, requestId);

  // 初始化文本内容累积器
  let textContent = '';
  let accumulatedContent = ''; // 用于检测跨事件的工具调用
  
  for (const event of sseEvents) {
    try {
      switch (event.Event) {
        case 'assistantResponseEvent':
          // 🔑 关键修复：处理CodeWhisperer的assistantResponseEvent事件
          if (event.Data && event.Data.content) {
            const eventContent = event.Data.content;
            accumulatedContent += eventContent;
            
            // 检查累积内容中是否有完整的工具调用
            const toolCallData = extractToolCallFromText(accumulatedContent, requestId);
            if (toolCallData) {
              // 找到工具调用，创建工具块
              const toolIndex = content.length;
              content[toolIndex] = {
                type: 'tool_use',
                id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: toolCallData.toolName,
                input: toolCallData.toolInput
              };
              
              logger.info('Detected and processed tool call from accumulated assistantResponseEvent content', {
                toolName: toolCallData.toolName,
                toolInput: toolCallData.toolInput,
                accumulatedLength: accumulatedContent.length
              }, requestId);
              
              // 移除已处理的工具调用部分，保留剩余文本
              const toolCallPattern = /Tool call: \w+\(\{.*?\}\)(?:\s|$)/s;
              const remainingContent = accumulatedContent.replace(toolCallPattern, '').trim();
              if (remainingContent) {
                textContent += remainingContent;
              }
              accumulatedContent = ''; // 重置累积器
            } else {
              // 检查是否可能是工具调用的开始，如果不是，添加到文本内容
              if (!accumulatedContent.includes('Tool call:')) {
                textContent += eventContent;
                accumulatedContent = ''; // 重置累积器
              }
              
              logger.debug('Accumulated content from assistantResponseEvent', { 
                deltaContent: eventContent,
                totalTextLength: textContent.length,
                accumulatedLength: accumulatedContent.length
              }, requestId);
            }
          }
          break;
          
        case 'contentBlockStart':
          if (event.Data?.contentBlock) {
            const block = event.Data.contentBlock;
            const index = event.Data.index || 0;
            
            if (block.type === 'text') {
              content[index] = { type: 'text', text: block.text || '' };
              textBuffers[index] = block.text || '';
              logger.debug('Started text block', { index, initialText: block.text }, requestId);
            } else if (block.type === 'toolUse') {
              content[index] = { 
                type: 'tool_use', 
                id: block.id, 
                name: block.name,
                input: block.input || {}
              };
              toolBuffers[index] = { 
                id: block.id, 
                name: block.name, 
                inputJson: JSON.stringify(block.input || {})
              };
              logger.debug('Started tool use block', { 
                index, 
                toolId: block.id, 
                toolName: block.name 
              }, requestId);
            }
          }
          break;

        case 'contentBlockDelta':
          if (event.Data?.delta && typeof event.Data.index === 'number') {
            const delta = event.Data.delta;
            const index = event.Data.index;
            
            if (delta.type === 'textDelta' && textBuffers[index] !== undefined) {
              textBuffers[index] += delta.text || '';
              if (content[index] && content[index].type === 'text') {
                content[index].text = textBuffers[index];
              }
              logger.debug('Added text delta', { 
                index, 
                deltaText: delta.text, 
                totalLength: textBuffers[index].length 
              }, requestId);
            } else if (delta.type === 'inputJsonDelta' && toolBuffers[index]) {
              toolBuffers[index].inputJson += delta.partialJson || '';
              logger.debug('Added tool input delta', { 
                index, 
                deltaJson: delta.partialJson,
                totalJsonLength: toolBuffers[index].inputJson.length
              }, requestId);
            }
          }
          break;

        case 'contentBlockStop':
          if (typeof event.Data?.index === 'number') {
            const index = event.Data.index;
            
            // 完成工具输入JSON解析
            if (toolBuffers[index] && content[index] && content[index].type === 'tool_use') {
              try {
                const finalInput = JSON.parse(toolBuffers[index].inputJson);
                content[index].input = finalInput;
                logger.info('Completed tool input parsing', {
                  index,
                  toolId: content[index].id,
                  inputJson: toolBuffers[index].inputJson,
                  parsedInput: JSON.stringify(finalInput)
                }, requestId);
              } catch (parseError) {
                logger.error('Failed to parse final tool input JSON', {
                  index,
                  inputJson: toolBuffers[index].inputJson,
                  error: parseError instanceof Error ? parseError.message : String(parseError)
                }, requestId);
                content[index].input = {};
              }
            }
            
            logger.debug('Stopped content block', { 
              index, 
              blockType: content[index]?.type 
            }, requestId);
          }
          break;

        default:
          logger.debug('Unhandled event type in buffered conversion', { 
            eventType: event.Event 
          }, requestId);
          break;
      }
    } catch (error) {
      logger.error('Error processing SSE event in buffered conversion', {
        eventType: event.Event,
        error: error instanceof Error ? error.message : String(error)
      }, requestId);
    }
  }

  // 🔑 关键修复：处理剩余的累积内容
  if (accumulatedContent) {
    // 最后一次检查是否有工具调用
    const toolCallData = extractToolCallFromText(accumulatedContent, requestId);
    if (toolCallData) {
      const toolIndex = content.length;
      content[toolIndex] = {
        type: 'tool_use',
        id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: toolCallData.toolName,
        input: toolCallData.toolInput
      };
      
      logger.info('Processed final tool call from remaining accumulated content', {
        toolName: toolCallData.toolName,
        toolInput: toolCallData.toolInput
      }, requestId);
      
      // 移除工具调用，保留剩余文本
      const toolCallPattern = /Tool call: \w+\(\{.*?\}\)(?:\s|$)/s;
      const remainingText = accumulatedContent.replace(toolCallPattern, '').trim();
      if (remainingText) {
        textContent += remainingText;
      }
    } else {
      // 没有完整工具调用，作为文本处理
      textContent += accumulatedContent;
    }
  }

  // 🔑 关键修复：如果累积了文本内容但没有结构化内容块，创建文本块
  if (textContent && content.length === 0) {
    logger.info('Creating text block from accumulated assistantResponseEvent content', {
      textLength: textContent.length,
      textPreview: textContent.substring(0, 200)
    }, requestId);
    
    content.push({
      type: 'text',
      text: textContent
    });
  } else if (textContent && content.some(block => block.type === 'text')) {
    // 如果已经有文本块，合并内容
    const textBlock = content.find(block => block.type === 'text');
    if (textBlock) {
      textBlock.text = (textBlock.text || '') + textContent;
      logger.info('Merged accumulated text content with existing text block', {
        totalTextLength: textBlock.text.length
      }, requestId);
    }
  } else if (textContent) {
    // 添加新的文本块
    content.push({
      type: 'text',
      text: textContent
    });
    logger.info('Added new text block from accumulated content', {
      textLength: textContent.length
    }, requestId);
  }

  // 清理和验证内容
  const validContent = content.filter(block => block && (block.type === 'text' || block.type === 'tool_use'));
  
  logger.info('Buffered response conversion completed', {
    originalEvents: sseEvents.length,
    contentBlocks: validContent.length,
    textBlocks: validContent.filter(c => c.type === 'text').length,
    toolBlocks: validContent.filter(c => c.type === 'tool_use').length
  }, requestId);

  return {
    content: validContent,
    usage: {
      input_tokens: 0, // Will be calculated by client
      output_tokens: 0 // Will be calculated by client
    }
  };
}

/**
 * 将缓冲响应转换回流式事件格式
 * 重新生成标准的Anthropic流式事件
 */
function convertBufferedResponseToStream(bufferedResponse: BufferedResponse, requestId: string, modelName: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const messageId = `msg_${Date.now()}`;
  
  logger.debug('Converting buffered response to stream events', {
    contentBlocks: bufferedResponse.content.length,
    modelName: modelName
  }, requestId);

  // 1. message_start event
  events.push({
    event: 'message_start',
    data: {
      type: 'message_start',
      message: {
        id: messageId,
        type: 'message',
        role: 'assistant',
        content: [],
        model: modelName,
        stop_reason: null,
        stop_sequence: null,
        usage: bufferedResponse.usage || { input_tokens: 0, output_tokens: 0 }
      }
    }
  });

  // 2. ping event
  events.push({
    event: 'ping',
    data: { type: 'ping' }
  });

  // 3. Process each content block
  bufferedResponse.content.forEach((block, index) => {
    // content_block_start
    if (block.type === 'text') {
      events.push({
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

      // Split text into chunks for realistic streaming
      const text = block.text || '';
      const chunkSize = 50; // Characters per chunk
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize);
        events.push({
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: index,
            delta: {
              type: 'text_delta',
              text: chunk
            }
          }
        });
      }
    } else if (block.type === 'tool_use') {
      events.push({
        event: 'content_block_start',
        data: {
          type: 'content_block_start',
          index: index,
          content_block: {
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: {}
          }
        }
      });

      // Stream tool input JSON
      const inputJson = JSON.stringify(block.input || {});
      const chunkSize = 20; // Characters per chunk
      for (let i = 0; i < inputJson.length; i += chunkSize) {
        const chunk = inputJson.slice(i, i + chunkSize);
        events.push({
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: index,
            delta: {
              type: 'input_json_delta',
              partial_json: chunk
            }
          }
        });
      }
    }

    // content_block_stop
    events.push({
      event: 'content_block_stop',
      data: {
        type: 'content_block_stop',
        index: index
      }
    });
  });

  // 4. message_delta event (with stop reason)
  events.push({
    event: 'message_delta',
    data: {
      type: 'message_delta',
      delta: {
        stop_reason: 'end_turn',
        stop_sequence: null
      },
      usage: {
        output_tokens: bufferedResponse.usage?.output_tokens || 0
      }
    }
  });

  // 5. message_stop event
  events.push({
    event: 'message_stop',
    data: {
      type: 'message_stop'
    }
  });

  logger.info('Stream events generated from buffered response', {
    totalEvents: events.length,
    messageId: messageId,
    contentBlocks: bufferedResponse.content.length
  }, requestId);

  return events;
}

/**
 * 从未知事件中提取工具调用文本 (保持兼容性)
 */
export function extractToolCallFromText(text: string, requestId: string = 'tool-extraction'): { toolName: string; toolInput: any } | null {
  const startTime = Date.now();
  
  // 匹配 "Tool call: ToolName({...})" 格式
  const toolCallMatch = text.match(/Tool call: (\w+)\((\{.*?\})\)(?:\s|$)/s);
  
  if (toolCallMatch) {
    const toolName = toolCallMatch[1];
    const inputStr = toolCallMatch[2];
    
    try {
      const toolInput = JSON.parse(inputStr);
      
      // Capture successful tool call detection
      captureToolCallEvent(requestId, 'tool_call_detected', {
        originalText: text,
        toolCallExtracted: { toolName, toolInput },
        fixMethod: 'regex_extraction',
        confidence: 1.0,
        timeTaken: Date.now() - startTime
      });
      
      return { toolName, toolInput };
    } catch (error) {
      // Capture tool call parsing error
      captureToolCallEvent(requestId, 'tool_error', {
        originalText: text,
        fixMethod: 'regex_extraction',
        confidence: 0.5,
        timeTaken: Date.now() - startTime
      }, { parseError: error instanceof Error ? error.message : String(error) });
      
      logger.debug('Failed to parse tool input JSON from text', {
        toolName,
        inputStr,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
  
  // Capture no tool call found
  captureToolCallEvent(requestId, 'tool_call_detected', {
    originalText: text,
    fixMethod: 'regex_extraction',
    confidence: 0.0,
    timeTaken: Date.now() - startTime
  });
  
  return null;
}