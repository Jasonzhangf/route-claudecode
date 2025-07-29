/**
 * 智能流式解析器 - 只在检测到工具调用时才缓冲
 * 核心优化：默认流式响应，仅在必要时切换到缓冲模式
 * Owner: Jason Zhang
 */

import { logger } from '@/utils/logger';
import { parseEvents, convertEventsToAnthropic, ParsedEvent } from './parser';

/**
 * 智能解析器状态
 */
interface SmartParserState {
  mode: 'streaming' | 'buffering';
  hasToolCall: boolean;
  buffer: Buffer;
  streamedEvents: ParsedEvent[];
  requestId: string;
}

/**
 * 智能流式解析器
 * 策略：
 * 1. 默认流式处理，立即输出响应
 * 2. 检测到工具调用信号时，切换到缓冲模式
 * 3. 工具调用完成后，统一处理缓冲内容
 */
export class SmartStreamParser {
  private state: SmartParserState;
  private toolCallKeywords = [
    'tool_use',
    'function_call', 
    'Tool call:',
    '"type": "tool_use"',
    '"name":', // 工具名称
    '"input":' // 工具输入
  ];

  constructor(requestId: string) {
    this.state = {
      mode: 'streaming',
      hasToolCall: false,
      buffer: Buffer.alloc(0),
      streamedEvents: [],
      requestId
    };
  }

  /**
   * 处理数据块 - 智能决定流式还是缓冲
   */
  async processChunk(chunk: Buffer): Promise<ParsedEvent[]> {
    this.state.buffer = Buffer.concat([this.state.buffer, chunk]);
    
    // 如果已经在缓冲模式，继续缓冲
    if (this.state.mode === 'buffering') {
      logger.debug(`📦 Buffering mode: added ${chunk.length} bytes`, {
        totalBuffered: this.state.buffer.length
      }, this.state.requestId, 'smart-parser');
      return [];
    }
    
    // 检查是否包含工具调用信号
    const chunkString = chunk.toString('utf8');
    const hasToolCallSignal = this.toolCallKeywords.some(keyword => 
      chunkString.includes(keyword) || this.state.buffer.toString('utf8').includes(keyword)
    );
    
    if (hasToolCallSignal && !this.state.hasToolCall) {
      // 🔄 切换到缓冲模式
      this.state.mode = 'buffering';
      this.state.hasToolCall = true;
      
      logger.info(`🔧 Detected tool call, switching to buffering mode`, {
        bufferSize: this.state.buffer.length,
        triggerKeyword: this.toolCallKeywords.find(k => chunkString.includes(k) || this.state.buffer.toString('utf8').includes(k))
      }, this.state.requestId, 'smart-parser');
      
      return []; // 开始缓冲，不输出
    }
    
    // 流式模式：立即解析并输出
    return this.processStreamingChunk(chunk);
  }

  /**
   * 流式处理数据块
   */
  private processStreamingChunk(chunk: Buffer): ParsedEvent[] {
    try {
      // 尝试解析当前缓冲区的事件
      const events = parseEvents(Buffer.from(this.state.buffer));
      const anthropicEvents = convertEventsToAnthropic(events, this.state.requestId);
      
      // 记录已流式输出的事件
      this.state.streamedEvents.push(...anthropicEvents);
      
      logger.debug(`🚀 Streaming output: ${anthropicEvents.length} events`, {
        chunkSize: chunk.length,
        totalEvents: this.state.streamedEvents.length,
        bufferSize: this.state.buffer.length
      }, this.state.requestId, 'smart-parser');
      
      return anthropicEvents;
      
    } catch (error) {
      // 解析失败，可能是不完整的事件，继续缓冲
      logger.debug(`⏳ Incomplete event data, continuing to buffer`, {
        error: error instanceof Error ? error.message : String(error),
        bufferSize: this.state.buffer.length
      }, this.state.requestId, 'smart-parser');
      
      return [];
    }
  }

  /**
   * 完成处理 - 处理剩余的缓冲内容
   */
  async finalize(): Promise<ParsedEvent[]> {
    if (this.state.mode === 'streaming') {
      // 流式模式：处理最后的缓冲内容
      return this.processStreamingChunk(Buffer.alloc(0));
    } else {
      // 缓冲模式：使用完整缓冲处理
      logger.info(`🔧 Finalizing buffered content for tool call processing`, {
        bufferSize: this.state.buffer.length,
        streamedEvents: this.state.streamedEvents.length
      }, this.state.requestId, 'smart-parser');
      
      return this.processBufferedContent();
    }
  }

  /**
   * 处理缓冲的内容（包含工具调用）
   */
  private processBufferedContent(): ParsedEvent[] {
    try {
      // 使用现有的缓冲处理逻辑
      const { processBufferedResponse } = require('./parser-buffered');
      const events = processBufferedResponse(this.state.buffer, this.state.requestId, 'claude-optimized');
      
      logger.info(`✅ Buffered tool call processing completed`, {
        totalEvents: events.length,
        bufferSize: this.state.buffer.length,
        hadToolCall: this.state.hasToolCall
      }, this.state.requestId, 'smart-parser');
      
      return events;
      
    } catch (error) {
      logger.error(`❌ Buffered processing failed, falling back to basic parsing`, {
        error: error instanceof Error ? error.message : String(error),
        bufferSize: this.state.buffer.length
      }, this.state.requestId, 'smart-parser');
      
      // 降级到基本解析
      const events = parseEvents(this.state.buffer);
      return convertEventsToAnthropic(events, this.state.requestId);
    }
  }

  /**
   * 获取当前状态信息
   */
  getState(): {
    mode: string;
    hasToolCall: boolean;
    bufferSize: number;
    streamedEvents: number;
  } {
    return {
      mode: this.state.mode,
      hasToolCall: this.state.hasToolCall,
      bufferSize: this.state.buffer.length,
      streamedEvents: this.state.streamedEvents.length
    };
  }
}

/**
 * 快速工具调用检测器
 */
export class ToolCallDetector {
  private static readonly TOOL_SIGNATURES = [
    /tool_use/i,
    /function_call/i,
    /"type":\s*"tool_use"/,
    /"name":\s*"[^"]+"/,
    /Tool call:/i,
    /"input":\s*\{/
  ];

  static hasToolCall(content: string): boolean {
    return this.TOOL_SIGNATURES.some(regex => regex.test(content));
  }

  static getConfidenceLevel(content: string): number {
    let confidence = 0;
    this.TOOL_SIGNATURES.forEach(regex => {
      if (regex.test(content)) {
        confidence += 1;
      }
    });
    return confidence / this.TOOL_SIGNATURES.length;
  }
}

/**
 * 创建智能流式解析器
 */
export function createSmartStreamParser(requestId: string): SmartStreamParser {
  return new SmartStreamParser(requestId);
}