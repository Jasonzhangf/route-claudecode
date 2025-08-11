/**
 * OpenAI Buffered Response Processor
 * 完全缓冲式处理：类似CodeWhisperer的processBufferedResponse
 * 专门解决多个工具调用被合并为文本的问题
 */

import { logger } from '@/utils/logger';
import { mapFinishReason } from '@/utils/finish-reason-handler';

export interface OpenAIBufferedResponse {
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

export interface OpenAIEvent {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index: number;
    delta?: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * 完全缓冲式处理OpenAI响应：先收集所有事件，再统一处理，最后转换为流式格式
 * 解决工具调用分段问题
 */
export function processOpenAIBufferedResponse(allEvents: OpenAIEvent[], requestId: string, modelName: string): any[] {
  try {
    logger.info('Starting OpenAI buffered response processing', {
      eventCount: allEvents.length,
      hasToolCalls: allEvents.some(e => e.choices?.[0]?.delta?.tool_calls)
    }, requestId);

    // 第一步：将所有OpenAI事件合并为完整的非流式响应
    const bufferedResponse = convertOpenAIEventsToBuffered(allEvents, requestId);
    logger.debug('Converted OpenAI events to buffered response', {
      contentBlocks: bufferedResponse.content.length,
      contentTypes: bufferedResponse.content.map(c => c.type),
      hasUsage: !!bufferedResponse.usage
    }, requestId);

    // 第二步：将非流式响应转换回流式事件格式
    const streamEvents = convertBufferedResponseToAnthropicStream(bufferedResponse, requestId, modelName);
    logger.info('Converted buffered response to Anthropic stream events', {
      streamEventCount: streamEvents.length,
      eventTypes: streamEvents.map(e => e.event)
    }, requestId);

    return streamEvents;
  } catch (error) {
    logger.error('Failed to process OpenAI buffered response', {
      error: error instanceof Error ? error.message : String(error),
      eventCount: allEvents.length
    }, requestId);
    return [];
  }
}

/**
 * 将OpenAI流事件合并为完整的非流式响应
 * 关键：正确处理工具调用的累积
 */
function convertOpenAIEventsToBuffered(events: OpenAIEvent[], requestId: string): OpenAIBufferedResponse {
  const content: OpenAIBufferedResponse['content'] = [];
  const toolCallMap: { [index: number]: { id?: string; name?: string; arguments: string } } = {};
  let textContent = '';
  let usage: any = null;
  
  logger.debug('Starting OpenAI events to buffered conversion', {
    eventCount: events.length
  }, requestId);

  for (const event of events) {
    try {
      const choice = event.choices?.[0];
      if (!choice?.delta) continue;

      // 处理文本内容
      if (choice.delta.content !== undefined) {
        textContent += choice.delta.content || '';
        logger.debug('Added text content', { 
          addedText: choice.delta.content,
          totalTextLength: textContent.length 
        }, requestId);
      }

      // 处理工具调用
      if (choice.delta.tool_calls) {
        for (const toolCall of choice.delta.tool_calls) {
          const index = toolCall.index;
          
          if (!toolCallMap[index]) {
            toolCallMap[index] = {
              id: toolCall.id,
              name: toolCall.function?.name,
              arguments: ''
            };
            logger.debug('Started tool call accumulation', { 
              index, 
              toolId: toolCall.id, 
              toolName: toolCall.function?.name 
            }, requestId);
          }

          // 累积工具参数
          if (toolCall.function?.arguments) {
            toolCallMap[index].arguments += toolCall.function.arguments;
            logger.debug('Added tool arguments', { 
              index, 
              addedArgs: toolCall.function.arguments,
              totalArgsLength: toolCallMap[index].arguments.length
            }, requestId);
          }
        }
      }

      // 处理usage信息
      if (event.usage) {
        usage = event.usage;
      }
    } catch (error) {
      logger.error('Error processing OpenAI event in buffered conversion', {
        error: error instanceof Error ? error.message : String(error)
      }, requestId);
    }
  }

  // 构建最终内容数组
  const finalContent: OpenAIBufferedResponse['content'] = [];

  // 检查文本内容中是否包含工具调用模式
  let processedTextContent = textContent.trim();
  let extractedToolCalls: Array<{id: string, name: string, input: any}> = [];
  
  if (processedTextContent) {
    // 检测和提取工具调用模式 "⏺ Tool call: ToolName(...)" 或 "Tool call: ToolName(...)"
    const toolCallPattern = /(?:⏺\s*)?Tool call:\s*(\w+)\((.*?)\)(?:\n|$)/g;
    let match;
    let toolCallIndex = Object.keys(toolCallMap).length; // 继续现有的工具调用索引
    
    while ((match = toolCallPattern.exec(processedTextContent)) !== null) {
      const [fullMatch, toolName, argsString] = match;
      let toolInput = {};
      
      logger.info('Detected tool call pattern in text', {
        fullMatch,
        toolName,
        argsString
      }, requestId);
      
      // 尝试解析工具参数
      try {
        if (argsString.trim()) {
          // 如果参数看起来像JSON，尝试解析
          if (argsString.trim().startsWith('{') && argsString.trim().endsWith('}')) {
            toolInput = JSON.parse(argsString);
          } else {
            // 否则，假设它是一个简单的命令字符串
            toolInput = { command: argsString };
          }
        }
      } catch (e) {
        logger.warn('Failed to parse tool call arguments from text', {
          argsString,
          error: e instanceof Error ? e.message : String(e)
        }, requestId);
        toolInput = { command: argsString };
      }
      
      extractedToolCalls.push({
        id: `extracted_${Date.now()}_${toolCallIndex}`,
        name: toolName,
        input: toolInput
      });
      
      toolCallIndex++;
    }
    
    if (extractedToolCalls.length > 0) {
      logger.info('Extracted tool calls from text content', {
        extractedCount: extractedToolCalls.length,
        toolNames: extractedToolCalls.map(t => t.name)
      }, requestId);
      
      // 移除文本中的工具调用模式，保留剩余文本
      processedTextContent = processedTextContent.replace(toolCallPattern, '').trim();
    }
  }

  // 添加剩余的文本内容（如果有）
  if (processedTextContent) {
    finalContent.push({
      type: 'text',
      text: processedTextContent
    });
    logger.debug('Added text content block', { 
      textLength: processedTextContent.length 
    }, requestId);
  }

  // 添加工具调用（按index排序）
  const sortedToolCalls = Object.entries(toolCallMap).sort(([a], [b]) => parseInt(a) - parseInt(b));
  
  for (const [index, toolCall] of sortedToolCalls) {
    try {
      let parsedInput = {};
      if (toolCall.arguments) {
        try {
          parsedInput = JSON.parse(toolCall.arguments);
          logger.info('Successfully parsed tool arguments', {
            index,
            toolId: toolCall.id,
            toolName: toolCall.name,
            argumentsJson: toolCall.arguments,
            parsedInput: JSON.stringify(parsedInput)
          }, requestId);
        } catch (parseError) {
          logger.error('Failed to parse tool arguments JSON', {
            index,
            toolId: toolCall.id,
            argumentsJson: toolCall.arguments,
            error: parseError instanceof Error ? parseError.message : String(parseError)
          }, requestId);
          parsedInput = {};
        }
      }

      finalContent.push({
        type: 'tool_use',
        id: toolCall.id || `call_${Date.now()}_${index}`,
        name: toolCall.name || `tool_${index}`,
        input: parsedInput
      });
    } catch (error) {
      logger.error('Error processing tool call', {
        index,
        error: error instanceof Error ? error.message : String(error)
      }, requestId);
    }
  }
  
  // 添加从文本中提取的工具调用
  for (const extractedTool of extractedToolCalls) {
    finalContent.push({
      type: 'tool_use',
      id: extractedTool.id,
      name: extractedTool.name,
      input: extractedTool.input
    });
    logger.info('Added extracted tool call', {
      toolId: extractedTool.id,
      toolName: extractedTool.name,
      toolInput: extractedTool.input
    }, requestId);
  }
  
  logger.info('OpenAI buffered response conversion completed', {
    originalEvents: events.length,
    contentBlocks: finalContent.length,
    textBlocks: finalContent.filter(c => c.type === 'text').length,
    toolBlocks: finalContent.filter(c => c.type === 'tool_use').length,
    extractedToolCalls: extractedToolCalls.length,
    regularToolCalls: Object.keys(toolCallMap).length
  }, requestId);

  return {
    content: finalContent,
    usage: usage ? {
      input_tokens: usage.prompt_tokens || 0,
      output_tokens: usage.completion_tokens || 0
    } : { input_tokens: 0, output_tokens: 0 }
  };
}

/**
 * 将缓冲响应转换回Anthropic流式事件格式
 * 重新生成标准的Anthropic流式事件
 */
function convertBufferedResponseToAnthropicStream(bufferedResponse: OpenAIBufferedResponse, requestId: string, modelName: string): any[] {
  const events: any[] = [];
  const messageId = `msg_${Date.now()}`;
  
  logger.debug('Converting buffered response to Anthropic stream events', {
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

  // 4. message_delta event (with stop reason) - 简化逻辑
  const hasToolCalls = bufferedResponse.content.some(block => block.type === 'tool_use');
  const openaiFinishReason = hasToolCalls ? 'tool_calls' : 'stop';
  const finishReason = mapFinishReason(openaiFinishReason);
  
  events.push({
    event: 'message_delta',
    data: {
      type: 'message_delta',
      delta: {
        stop_reason: finishReason,
        stop_sequence: null
      },
      usage: {
        output_tokens: bufferedResponse.usage?.output_tokens || 0
      }
    }
  });

  // 5. message_stop event - 只有非工具调用场景才发送
  if (finishReason !== 'tool_use') {
    events.push({
      event: 'message_stop',
      data: {
        type: 'message_stop'
      }
    });
  }

  logger.info('Anthropic stream events generated from OpenAI buffered response', {
    totalEvents: events.length,
    messageId: messageId,
    contentBlocks: bufferedResponse.content.length
  }, requestId);

  return events;
}