/**
 * LM Studio专用缓冲式处理器
 * 解决工具调用被错误处理为文本的问题
 * @author Jason Zhang
 * @version v3.0
 */

import { getLogger } from '../../logging/index.js';

const logger = getLogger();
import { LayerInterface, ProcessingContext, LayerCapabilities } from '../../shared/layer-interface.js';

export interface LMStudioEvent {
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

export interface ProcessedToolCall {
  id: string;
  name: string;
  input: any;
}

export interface LMStudioBufferedResponse {
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
 * LM Studio专用缓冲式处理器类
 * 实现LayerInterface以符合v3.0六层架构
 */
export class LMStudioBufferedProcessor implements LayerInterface {
  readonly name = 'lmstudio-buffered-processor';
  readonly version = '3.0.0';
  readonly layerType = 'preprocessor' as const;
  readonly dependencies: string[] = [];

  async process(input: any, context: ProcessingContext): Promise<any> {
    const isLMStudio = this.isLMStudioResponse(input);
    
    logger.debug('LM Studio response detection', {
      isLMStudio,
      inputType: typeof input,
      hasData: !!(input && input.data),
      hasEvents: !!(input && input.events),
      inputKeys: input && typeof input === 'object' ? Object.keys(input) : []
    }, context.requestId);
    
    if (!isLMStudio) {
      return input;
    }

    logger.info('LM Studio buffered processing started', {
      hasEvents: !!input.events,
      eventCount: input.events?.length || 0
    }, context.requestId);

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
      }, context.requestId);

      return standardResponse;
    } catch (error) {
      logger.error('LM Studio buffered processing failed', {
        error: error instanceof Error ? error.message : String(error)
      }, context.requestId);
      return input;
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  getCapabilities(): LayerCapabilities {
    return {
      supportedOperations: ['buffer-process', 'tool-extraction', 'format-conversion'],
      inputTypes: ['lmstudio-stream', 'openai-events'],
      outputTypes: ['anthropic-stream'],
      dependencies: [],
      version: '3.0.0'
    };
  }

  async initialize(config?: any): Promise<void> {
    // 初始化处理器
  }

  async cleanup(): Promise<void> {
    // 清理资源
  }

  /**
   * 检测是否为LM Studio响应
   */
  private isLMStudioResponse(input: any): boolean {
    // 1. 检查纯字符串格式
    if (typeof input === 'string') {
      return input.includes('Tool call:');
    }
    
    // 2. 检查对象格式，包括 data 字段
    if (input && typeof input === 'object') {
      // 检查 data 字段（常见的LM Studio格式）
      if (input.data && typeof input.data === 'string') {
        return input.data.includes('Tool call:');
      }
      
      // 检查 events 数组格式
      if (input.events && Array.isArray(input.events)) {
        return input.events.some((event: any) => 
          event.choices?.[0]?.delta?.content?.includes('Tool call:')
        );
      }
      
      // 检查是否直接包含Tool call文本
      if (input.content && typeof input.content === 'string') {
        return input.content.includes('Tool call:');
      }
      
      // 检查choices结构（直接的OpenAI格式）
      if (input.choices && Array.isArray(input.choices)) {
        return input.choices.some((choice: any) => 
          choice.message?.content?.includes('Tool call:') ||
          choice.delta?.content?.includes('Tool call:')
        );
      }
    }

    return false;
  }

  /**
   * 解析流事件为结构化数据
   */
  private parseStreamEvents(data: any): LMStudioEvent[] {
    const events: LMStudioEvent[] = [];

    try {
      let content = '';
      
      if (typeof data === 'string') {
        content = data;
      } else if (Array.isArray(data)) {
        // 如果已经是事件数组，直接返回
        return data;
      } else if (data && typeof data === 'object') {
        // 处理对象格式
        if (data.events && Array.isArray(data.events)) {
          return data.events;
        }
        
        // 处理 {data: "..."} 格式
        if (data.data && typeof data.data === 'string') {
          content = data.data;
        }
        
        // 处理直接的文本内容
        if (data.content && typeof data.content === 'string') {
          content = data.content;
        }
        
        // 如果没有找到文本内容，创建一个模拟事件
        if (!content && data.data) {
          // 为非字符串data创建一个模拟的文本事件
          content = String(data.data);
        }
      }

      // 如果我们有文本内容，创建一个模拟事件来包装它
      if (content) {
        // 不解析SSE格式，而是创建一个包含文本内容的模拟事件
        events.push({
          id: `mock_${Date.now()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'lmstudio',
          choices: [{
            index: 0,
            delta: {
              role: 'assistant',
              content: content
            },
            finish_reason: null
          }],
          usage: {
            prompt_tokens: 0,
            completion_tokens: Math.ceil(content.length / 4),
            total_tokens: Math.ceil(content.length / 4)
          }
        });
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
  private processBufferedEvents(events: LMStudioEvent[], requestId: string): LMStudioBufferedResponse {
    const content: LMStudioBufferedResponse['content'] = [];
    const toolCallMap: { [index: number]: { id?: string; name?: string; arguments: string } } = {};
    let textContent = '';
    let usage: any = null;

    logger.debug('Processing buffered events', {
      eventCount: events.length
    }, requestId);

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
        }, requestId);
      }
    }

    // 第二阶段：从文本中提取工具调用模式
    let processedTextContent = textContent.trim();
    const extractedToolCalls = this.extractToolCallsFromText(processedTextContent, requestId);
    
    if (extractedToolCalls.length > 0) {
      logger.info('Extracted tool calls from text content', {
        extractedCount: extractedToolCalls.length,
        toolNames: extractedToolCalls.map(t => t.name)
      }, requestId);
      
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
            }, requestId);
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
        }, requestId);
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
    }, requestId);

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
  private extractToolCallsFromText(text: string, requestId: string): ProcessedToolCall[] {
    const toolCalls: ProcessedToolCall[] = [];
    const processedMatches = new Set<string>(); // 防重复处理
    
    // 使用单个综合正则模式，支持可选的⏺前缀
    const pattern = /(?:⏺\s*)?Tool call:\s*(\w+)\((.*?)\)(?:\n|$)/g;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const [fullMatch, toolName, argsString] = match;
      const matchKey = `${toolName}:${argsString.trim()}`; // 创建唯一键防重复
      
      // 跳过已处理的相同工具调用
      if (processedMatches.has(matchKey)) {
        continue;
      }
      processedMatches.add(matchKey);
      
      let toolInput = {};
      
      // Reduced debug logging for performance
      logger.debug('Tool call detected', {
        toolName,
        argsLength: argsString.length
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
      
      toolCalls.push({
        id: `extracted_${Date.now()}_${toolCalls.length}`,
        name: toolName,
        input: toolInput
      });
    }
    
    // 支持function_call格式作为备选
    const functionCallPattern = /function_call\s*=\s*(\w+)\((.*?)\)/g;
    let funcMatch;
    
    while ((funcMatch = functionCallPattern.exec(text)) !== null) {
      const [fullMatch, toolName, argsString] = funcMatch;
      const matchKey = `${toolName}:${argsString.trim()}`;
      
      if (processedMatches.has(matchKey)) {
        continue;
      }
      processedMatches.add(matchKey);
      
      let toolInput = {};
      
      try {
        if (argsString.trim()) {
          if (argsString.trim().startsWith('{') && argsString.trim().endsWith('}')) {
            toolInput = JSON.parse(argsString);
          } else {
            toolInput = { command: argsString };
          }
        }
      } catch (e) {
        toolInput = { command: argsString };
      }
      
      toolCalls.push({
        id: `extracted_${Date.now()}_${toolCalls.length}`,
        name: toolName,
        input: toolInput
      });
    }
    
    return toolCalls;
  }

  /**
   * 转换为标准输出格式（Anthropic兼容）
   */
  private convertToStandardFormat(bufferedResponse: LMStudioBufferedResponse, requestId: string): any {
    const events: any[] = [];
    const messageId = `msg_${Date.now()}`;
    
    logger.debug('Converting to standard format', {
      contentBlocks: bufferedResponse.content.length
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
    }, requestId);

    return { events };
  }
}

/**
 * 创建LM Studio缓冲式处理器实例
 */
export function createLMStudioBufferedProcessor(): LMStudioBufferedProcessor {
  return new LMStudioBufferedProcessor();
}