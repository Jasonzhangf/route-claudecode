/**
 * 高效流式解析器 - 基于实际数据重新设计
 * 解决智能流式解析器的77,643事件性能问题
 * Owner: Jason Zhang
 */

import { logger } from '@/utils/logger';
import { parseEvents, convertEventsToAnthropic, ParsedEvent } from './parser';
import { processBufferedResponse } from './parser-buffered';

/**
 * 工具调用检测器 - 快速预检查
 */
export class FastToolCallDetector {
  private static readonly TOOL_SIGNATURES = [
    'tool_use',
    'function_call', 
    'Tool call:',
    '"type": "tool_use"',
    '"name":',
    '"input":'
  ];

  /**
   * 快速检测 - 只检查前1KB数据
   */
  static quickCheck(buffer: Buffer): boolean {
    const preview = buffer.toString('utf8', 0, Math.min(1024, buffer.length));
    return this.TOOL_SIGNATURES.some(signature => preview.includes(signature));
  }

  /**
   * 深度检测 - 检查更多数据
   */
  static deepCheck(buffer: Buffer): boolean {
    const preview = buffer.toString('utf8', 0, Math.min(8192, buffer.length)); // 8KB
    return this.TOOL_SIGNATURES.some(signature => preview.includes(signature));
  }
}

/**
 * 高效流式解析器
 * 策略：
 * 1. 快速工具调用预检 (1KB)
 * 2. 有工具调用 -> 完全缓冲处理
 * 3. 无工具调用 -> 批量流式处理 (合并小事件)
 */
export class EfficientStreamingParser {
  private requestId: string;
  private responseBuffer: Buffer;
  
  constructor(requestId: string) {
    this.requestId = requestId;
    this.responseBuffer = Buffer.alloc(0);
  }

  /**
   * 处理完整响应缓冲区
   */
  async processBuffer(buffer: Buffer, modelName: string): Promise<ParsedEvent[]> {
    this.responseBuffer = buffer;
    
    const startTime = Date.now();
    
    // 🚀 第一步：快速工具调用检测 (只检查前1KB)
    const hasToolCall = FastToolCallDetector.quickCheck(buffer);
    
    if (hasToolCall) {
      // 🔧 有工具调用：使用完全缓冲处理
      logger.info('🔧 Tool call detected, using full buffered processing', {
        responseLength: buffer.length,
        detectionTime: Date.now() - startTime
      }, this.requestId, 'efficient-parser');
      
      return processBufferedResponse(buffer, this.requestId, modelName);
    } else {
      // ⚡ 无工具调用：使用高效批量流式处理
      logger.info('⚡ No tool calls, using efficient batch streaming', {
        responseLength: buffer.length,
        detectionTime: Date.now() - startTime
      }, this.requestId, 'efficient-parser');
      
      return this.processBatchStreaming(buffer);
    }
  }

  /**
   * 批量流式处理 - 合并小事件，减少处理开销
   */
  private processBatchStreaming(buffer: Buffer): ParsedEvent[] {
    const startTime = Date.now();
    
    try {
      // 解析所有SSE事件
      const rawEvents = parseEvents(buffer);
      
      logger.debug('Parsed raw SSE events', {
        eventCount: rawEvents.length,
        parseTime: Date.now() - startTime
      }, this.requestId, 'efficient-parser');
      
      // 批量合并小文本事件
      const batchedEvents = this.batchTextEvents(rawEvents);
      
      // 转换为Anthropic格式
      const anthropicEvents = convertEventsToAnthropic(batchedEvents, this.requestId);
      
      const totalTime = Date.now() - startTime;
      
      logger.info('✅ Efficient batch streaming completed', {
        originalEvents: rawEvents.length,
        batchedEvents: batchedEvents.length,
        anthropicEvents: anthropicEvents.length,
        processingTime: totalTime,
        eventsPerSecond: Math.round(rawEvents.length / (totalTime / 1000))
      }, this.requestId, 'efficient-parser');
      
      return anthropicEvents;
      
    } catch (error) {
      logger.error('❌ Batch streaming failed, falling back to buffered processing', {
        error: error instanceof Error ? error.message : String(error),
        bufferSize: buffer.length
      }, this.requestId, 'efficient-parser');
      
      // 降级到完全缓冲处理
      return processBufferedResponse(buffer, this.requestId, 'claude-optimized');
    }
  }

  /**
   * 批量合并文本事件 - 关键优化算法
   * 将连续的小文本片段合并为较大的块
   */
  private batchTextEvents(events: any[]): any[] {
    const batchedEvents: any[] = [];
    const BATCH_SIZE = 50; // 每50个小事件合并为1个
    const TEXT_THRESHOLD = 10; // 小于10字符的认为是小文本片段
    
    let currentBatch: string[] = [];
    let batchStartIndex = 0;
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      // 检查是否为小文本事件
      if (this.isSmallTextEvent(event, TEXT_THRESHOLD)) {
        currentBatch.push(this.extractTextContent(event));
        
        // 达到批量大小或到达数组末尾
        if (currentBatch.length >= BATCH_SIZE || i === events.length - 1) {
          // 创建合并后的事件
          const mergedEvent = this.createMergedTextEvent(currentBatch, batchStartIndex);
          batchedEvents.push(mergedEvent);
          
          // 重置批量状态
          currentBatch = [];
          batchStartIndex = i + 1;
        }
      } else {
        // 非小文本事件：直接添加
        batchedEvents.push(event);
      }
    }
    
    return batchedEvents;
  }

  /**
   * 判断是否为小文本事件
   */
  private isSmallTextEvent(event: any, threshold: number): boolean {
    if (event.event !== 'assistantResponseEvent') return false;
    if (!event.data?.content) return false;
    
    const content = typeof event.data.content === 'string' 
      ? event.data.content 
      : JSON.stringify(event.data.content);
    
    return content.length <= threshold;
  }

  /**
   * 提取文本内容
   */
  private extractTextContent(event: any): string {
    if (typeof event.data.content === 'string') {
      return event.data.content;
    }
    
    // 处理JSON内容
    if (typeof event.data.content === 'object' && event.data.content.content) {
      return event.data.content.content;
    }
    
    return JSON.stringify(event.data.content);
  }

  /**
   * 创建合并后的文本事件
   */
  private createMergedTextEvent(textPieces: string[], startIndex: number): any {
    const mergedContent = textPieces.join('');
    
    return {
      event: 'assistantResponseEvent',
      data: {
        content: mergedContent
      },
      metadata: {
        batchSize: textPieces.length,
        startIndex,
        merged: true
      }
    };
  }
}

/**
 * 创建高效流式解析器
 */
export function createEfficientStreamingParser(requestId: string): EfficientStreamingParser {
  return new EfficientStreamingParser(requestId);
}