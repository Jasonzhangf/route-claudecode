/**
 * 流式响应优化器 - 减少累积延迟
 * 解决CodeWhisperer API返回大量小事件导致的响应累积问题
 * Owner: Jason Zhang
 */

import { logger } from '@/utils/logger';

export interface StreamOptimizer {
  /**
   * 处理单个事件并立即输出，不等待累积
   */
  processEventImmediately(event: any): any[];
  
  /**
   * 获取当前累积的事件总数
   */
  getProcessedEventCount(): number;
  
  /**
   * 重置处理器状态
   */
  reset(): void;
}

/**
 * 立即输出流式优化器
 * 核心理念：收到事件立即处理和输出，不等待累积
 */
export class ImmediateStreamOptimizer implements StreamOptimizer {
  private processedCount = 0;
  private textBuffer = '';
  private lastOutputTime = Date.now();
  
  constructor(private requestId: string) {}

  /**
   * 立即处理事件，不等待累积
   */
  processEventImmediately(event: any): any[] {
    this.processedCount++;
    
    // 如果是文本内容，立即组合输出
    if (event.type === 'content_block_delta' && event.delta?.text) {
      this.textBuffer += event.delta.text;
      
      // 立即输出累积的文本，不等待更多内容
      const outputEvent = {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: event.delta.text  // 立即输出单个文本片段
        }
      };
      
      this.lastOutputTime = Date.now();
      
      logger.debug(`📤 Immediate output: event ${this.processedCount}`, {
        textLength: event.delta.text.length,
        timeSinceLastOutput: Date.now() - this.lastOutputTime
      }, this.requestId, 'stream-optimizer');
      
      return [outputEvent];
    }
    
    // 对于其他类型的事件，也立即输出
    if (event.type === 'content_block_start') {
      return [{
        type: 'content_block_start',
        index: 0,
        content_block: {
          type: 'text',
          text: ''
        }
      }];
    }
    
    if (event.type === 'content_block_stop') {
      return [{
        type: 'content_block_stop',
        index: 0
      }];
    }
    
    if (event.type === 'message_start') {
      return [{
        type: 'message_start',
        message: event.message || {
          id: `opt_${Date.now()}`,
          type: 'message',
          role: 'assistant',
          content: [],
          model: 'claude-optimized',
          usage: { input_tokens: 0, output_tokens: 0 }
        }
      }];
    }
    
    if (event.type === 'message_stop') {
      logger.info(`🎯 Stream optimization completed`, {
        totalEvents: this.processedCount,
        totalTextLength: this.textBuffer.length,
        avgEventSize: this.textBuffer.length / this.processedCount
      }, this.requestId, 'stream-optimizer');
      
      return [{
        type: 'message_stop'
      }];
    }
    
    // 未知事件类型，也立即输出
    return [event];
  }

  getProcessedEventCount(): number {
    return this.processedCount;
  }

  reset(): void {
    this.processedCount = 0;
    this.textBuffer = '';
    this.lastOutputTime = Date.now();
  }
}

/**
 * 批量输出流式优化器
 * 收集少量事件后批量输出，平衡延迟和效率
 */
export class BatchStreamOptimizer implements StreamOptimizer {
  private eventBuffer: any[] = [];
  private processedCount = 0;
  private batchSize = 5; // 每5个事件输出一次
  private lastFlushTime = Date.now();
  private maxBatchDelayMs = 100; // 最多100ms延迟
  
  constructor(private requestId: string) {}

  processEventImmediately(event: any): any[] {
    this.processedCount++;
    this.eventBuffer.push(event);
    
    const shouldFlush = 
      this.eventBuffer.length >= this.batchSize ||
      (Date.now() - this.lastFlushTime) > this.maxBatchDelayMs ||
      event.type === 'message_stop';
    
    if (shouldFlush) {
      const outputEvents = [...this.eventBuffer];
      this.eventBuffer = [];
      this.lastFlushTime = Date.now();
      
      logger.debug(`📦 Batch output: ${outputEvents.length} events`, {
        totalProcessed: this.processedCount,
        batchSize: outputEvents.length
      }, this.requestId, 'stream-optimizer');
      
      return outputEvents;
    }
    
    return []; // 还没到输出时间
  }

  getProcessedEventCount(): number {
    return this.processedCount;
  }

  reset(): void {
    this.eventBuffer = [];
    this.processedCount = 0;
    this.lastFlushTime = Date.now();
  }
}

/**
 * 创建流式优化器
 */
export function createStreamOptimizer(
  type: 'immediate' | 'batch', 
  requestId: string
): StreamOptimizer {
  switch (type) {
    case 'immediate':
      return new ImmediateStreamOptimizer(requestId);
    case 'batch':
      return new BatchStreamOptimizer(requestId);
    default:
      return new ImmediateStreamOptimizer(requestId);
  }
}