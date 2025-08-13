/**
 * LM Studio专用缓冲式处理器
 * 解决工具调用被错误处理为文本的问题
 * @author Jason Zhang
 * @version v3.0
 */

import { getLogger } from '../../logging/index.js';

const logger = getLogger();

/**
 * LM Studio专用缓冲式处理器类
 * 实现LayerInterface以符合v3.0六层架构
 */
export class LMStudioBufferedProcessor {
  constructor() {
    this.name = 'lmstudio-buffered-processor';
    this.version = '3.0.0';
    this.layerType = 'preprocessor';
  }

  async process(input, context) {
    if (!this.isLMStudioResponse(input)) {
      return input;
    }

    logger.info('LM Studio buffered processing started', {
      hasEvents: !!input.events,
      eventCount: input.events?.length || 0
    });

    try {
      // 步骤1: 解析所有事件为结构化数据
      const events = this.parseStreamEvents(input.data || input.events || input);
      
      // 步骤2: 缓冲式合并处理所有事件
      const bufferedResponse = this.processBufferedEvents(events, context.requestId);
      
      // 步骤3: 转换为标准输出格式
      const standardResponse = this.convertToStandardFormat(bufferedResponse, context.requestId);
      
      logger.info('LM Studio buffered processing completed', {
        originalEvents: events.length,
        contentBlocks: standardResponse.content?.length || 0,
        toolBlocks: standardResponse.content?.filter(c => c.type === 'tool_use').length || 0
      });

      return standardResponse;
    } catch (error) {
      logger.error('LM Studio buffered processing failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return input;
    }
  }

  async healthCheck() {
    return true;
  }

  getCapabilities() {
    return {
      canHandleStreaming: true,
      canHandleToolCalls: true,
      maxConcurrentRequests: 100
    };
  }

  async initialize(config) {
    // 初始化处理器
  }

  async cleanup() {
    // 清理资源
  }

  /**
   * 检测是否为LM Studio响应
   */
  isLMStudioResponse(input) {
    // 检查响应特征
    if (typeof input === 'string') {
      return input.includes('data: {') && input.includes('Tool call:');
    }
    
    if (input.events && Array.isArray(input.events)) {
      return input.events.some((event) => 
        event.choices?.[0]?.delta?.content?.includes('Tool call:')
      );
    }

    return false;
  }

  /**
   * 解析流事件为结构化数据
   */
  parseStreamEvents(data) {
    const events = [];

    try {
      let content = '';
      
      if (typeof data === 'string') {
        content = data;
      } else if (Array.isArray(data)) {
        // 如果已经是事件数组，直接返回
        return data;
      } else if (data.events) {
        return data.events;
      }

      // 解析SSE格式的流数据
      const lines = content.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataContent = line.slice(6).trim();
          if (dataContent === '[DONE]') {
            break;
          }
          
          try {
            const parsedEvent = JSON.parse(dataContent);
            events.push(parsedEvent);
          } catch (parseError) {
            logger.debug('Failed to parse SSE event', {
              line: dataContent.slice(0, 100),
              error: parseError instanceof Error ? parseError.message : String(parseError)
            });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to parse stream events', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return events;
  }

  /**
   * 缓冲式处理所有事件
   */
  processBufferedEvents(events, requestId) {
    const content = [];
    const toolCallMap = {};
    let textContent = '';
    let usage = null;

    logger.debug('Processing buffered events', {
      eventCount: events.length
    });

    // 第一阶段：合并所有事件
    for (const event of events) {
      try {
        const choice = event.choices?.[0];
        if (!choice?.delta) continue;

        // 处理文本内容
        if (choice.delta.content !== undefined) {
          textContent += choice.delta.content || '';
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
            }

            // 累积工具参数
            if (toolCall.function?.arguments) {
              toolCallMap[index].arguments += toolCall.function.arguments;
            }
          }
        }

        // 处理usage信息
        if (event.usage) {
          usage = event.usage;
        }
      } catch (error) {
        logger.error('Error processing event in buffered processing', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // 第二阶段：从文本中提取工具调用模式
    let processedTextContent = textContent.trim();
    const extractedToolCalls = this.extractToolCallsFromText(processedTextContent, requestId);
    
    if (extractedToolCalls.length > 0) {
      logger.info('Extracted tool calls from text content', {
        extractedCount: extractedToolCalls.length,
        toolNames: extractedToolCalls.map(t => t.name)
      });
      
      // 移除文本中的工具调用模式，保留剩余文本
      const toolCallPattern = /(?:⏺\s*)?Tool call:\s*(\w+)\((.*?)\)(?:\n|$)/g;
      processedTextContent = processedTextContent.replace(toolCallPattern, '').trim();
    }

    // 第三阶段：构建最终内容数组
    
    // 添加剩余的文本内容（如果有）
    if (processedTextContent) {
      content.push({
        type: 'text',
        text: processedTextContent
      });
    }

    // 添加正常解析的工具调用
    const sortedToolCalls = Object.entries(toolCallMap).sort(([a], [b]) => parseInt(a) - parseInt(b));
    
    for (const [index, toolCall] of sortedToolCalls) {
      try {
        let parsedInput = {};
        if (toolCall.arguments) {
          try {
            parsedInput = JSON.parse(toolCall.arguments);
          } catch (parseError) {
            logger.warn('Failed to parse tool arguments JSON', {
              index,
              arguments: toolCall.arguments,
              error: parseError instanceof Error ? parseError.message : String(parseError)
            });
            parsedInput = { command: toolCall.arguments };
          }
        }

        content.push({
          type: 'tool_use',
          id: toolCall.id || `call_${Date.now()}_${index}`,
          name: toolCall.name || `tool_${index}`,
          input: parsedInput
        });
      } catch (error) {
        logger.error('Error processing tool call', {
          index,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // 添加从文本中提取的工具调用
    for (const extractedTool of extractedToolCalls) {
      content.push({
        type: 'tool_use',
        id: extractedTool.id,
        name: extractedTool.name,
        input: extractedTool.input
      });
    }

    logger.info('Buffered processing completed', {
      originalEvents: events.length,
      contentBlocks: content.length,
      textBlocks: content.filter(c => c.type === 'text').length,
      toolBlocks: content.filter(c => c.type === 'tool_use').length,
      extractedToolCalls: extractedToolCalls.length,
      regularToolCalls: Object.keys(toolCallMap).length
    });

    return {
      content,
      usage: usage ? {
        input_tokens: usage.prompt_tokens || 0,
        output_tokens: usage.completion_tokens || 0
      } : { input_tokens: 0, output_tokens: 0 }
    };
  }

  /**
   * 从文本中提取工具调用模式
   */
  extractToolCallsFromText(text, requestId) {
    const toolCalls = [];
    
    // 支持多种工具调用模式
    const patterns = [
      /(?:⏺\s*)?Tool call:\s*(\w+)\((.*?)\)(?:\n|$)/g,
      /Tool call:\s*(\w+)\((.*?)\)(?:\n|$)/g,
      /function_call\s*=\s*(\w+)\((.*?)\)/g
    ];

    for (const pattern of patterns) {
      const globalPattern = new RegExp(pattern.source, 'g');
      let match;
      
      while ((match = globalPattern.exec(text)) !== null) {
        const [fullMatch, toolName, argsString] = match;
        let toolInput = {};
        
        logger.debug('Detected tool call pattern in text', {
          fullMatch,
          toolName,
          argsString
        });
        
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
          });
          toolInput = { command: argsString };
        }
        
        toolCalls.push({
          id: `extracted_${Date.now()}_${toolCalls.length}`,
          name: toolName,
          input: toolInput
        });
      }
    }
    
    return toolCalls;
  }

  /**
   * 转换为标准输出格式（Anthropic兼容）
   */
  convertToStandardFormat(bufferedResponse, requestId) {
    const events = [];
    const messageId = `msg_${Date.now()}`;
    
    logger.debug('Converting to standard format', {
      contentBlocks: bufferedResponse.content.length
    });

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
          model: 'lmstudio',
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

    // 3. 处理每个内容块
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

        // 分段发送文本内容
        const text = block.text || '';
        const chunkSize = 50;
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

        // 分段发送工具输入JSON
        const inputJson = JSON.stringify(block.input || {});
        const chunkSize = 20;
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

    // 4. message_delta event
    const hasToolCalls = bufferedResponse.content.some(block => block.type === 'tool_use');
    const finishReason = hasToolCalls ? 'tool_use' : 'end_turn';
    
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

    // 5. message_stop event (只有非工具调用场景才发送)
    if (finishReason !== 'tool_use') {
      events.push({
        event: 'message_stop',
        data: {
          type: 'message_stop'
        }
      });
    }

    logger.info('Standard format conversion completed', {
      totalEvents: events.length,
      messageId: messageId,
      contentBlocks: bufferedResponse.content.length,
      hasToolCalls
    });

    return { events };
  }
}

/**
 * 创建LM Studio缓冲式处理器实例
 */
export function createLMStudioBufferedProcessor() {
  return new LMStudioBufferedProcessor();
}