/**
 * CodeWhisperer通用流式解析器实现
 * 基于通用框架的具体Provider实现
 * Owner: Jason Zhang
 */

import { logger } from '@/utils/logger';
import { parseEvents, convertEventsToAnthropic } from './parser';
import { processBufferedResponse } from './parser-buffered';
import { 
  UniversalStreamingParser,
  StreamOptimizationStrategy,
  StreamAnalysisResult,
  CodeWhispererAnalyzer,
  BufferedProcessingStrategy,
  BatchStreamingStrategy,
  DirectStreamingStrategy,
  UniversalParserFactory
} from '../common/universal-streaming-parser';

/**
 * CodeWhisperer批量流式策略实现
 */
class CodeWhispererBatchStrategy extends BatchStreamingStrategy {
  async process(data: Buffer | string, requestId: string, metadata?: any): Promise<any[]> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const analysis = metadata?.analysis as StreamAnalysisResult;
    
    const startTime = Date.now();
    
    logger.info('🚀 CodeWhisperer batch streaming started', {
      bufferSize: buffer.length,
      estimatedEvents: analysis?.estimatedEventCount,
      batchSize: 50
    }, requestId, 'cw-batch-parser');

    try {
      // 解析原始SSE事件
      const rawEvents = parseEvents(buffer);
      
      // 批量合并小事件
      const batchedEvents = this.batchCodeWhispererEvents(rawEvents, requestId);
      
      // 转换为Anthropic格式
      const anthropicEvents = convertEventsToAnthropic(batchedEvents, requestId);
      
      const processingTime = Date.now() - startTime;
      
      logger.info('✅ CodeWhisperer batch streaming completed', {
        originalEvents: rawEvents.length,
        batchedEvents: batchedEvents.length,
        anthropicEvents: anthropicEvents.length,
        processingTime,
        compressionRatio: `${rawEvents.length}:${batchedEvents.length}`,
        eventsPerSecond: Math.round(rawEvents.length / (processingTime / 1000))
      }, requestId, 'cw-batch-parser');
      
      return anthropicEvents;
      
    } catch (error) {
      logger.error('❌ CodeWhisperer batch streaming failed', {
        error: error instanceof Error ? error.message : String(error),
        bufferSize: buffer.length
      }, requestId, 'cw-batch-parser');
      
      // 降级到缓冲处理
      return processBufferedResponse(buffer, requestId, 'claude-optimized');
    }
  }

  /**
   * CodeWhisperer特定的事件批量合并逻辑
   */
  private batchCodeWhispererEvents(events: any[], requestId: string): any[] {
    const batchedEvents: any[] = [];
    const BATCH_SIZE = 50;
    const TEXT_THRESHOLD = 10;
    
    let currentBatch: string[] = [];
    let batchCount = 0;
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      // 检查是否为CodeWhisperer的小文本事件
      if (this.isCodeWhispererSmallTextEvent(event, TEXT_THRESHOLD)) {
        const textContent = this.extractCodeWhispererTextContent(event);
        currentBatch.push(textContent);
        
        // 达到批量大小或到达末尾
        if (currentBatch.length >= BATCH_SIZE || i === events.length - 1) {
          const mergedEvent = this.createCodeWhispererMergedEvent(currentBatch, batchCount);
          batchedEvents.push(mergedEvent);
          
          batchCount++;
          currentBatch = [];
        }
      } else {
        // 非小文本事件直接添加
        batchedEvents.push(event);
      }
    }
    
    logger.debug('CodeWhisperer event batching completed', {
      originalCount: events.length,
      batchedCount: batchedEvents.length,
      batchesCreated: batchCount,
      compressionRatio: events.length / batchedEvents.length
    }, requestId, 'cw-batch-parser');
    
    return batchedEvents;
  }

  private isCodeWhispererSmallTextEvent(event: any, threshold: number): boolean {
    if (event.event !== 'assistantResponseEvent') return false;
    if (!event.data?.content) return false;
    
    let textContent: string;
    if (typeof event.data.content === 'string') {
      textContent = event.data.content;
    } else if (typeof event.data.content === 'object' && event.data.content.content) {
      textContent = event.data.content.content;
    } else {
      textContent = JSON.stringify(event.data.content);
    }
    
    return textContent.length <= threshold;
  }

  private extractCodeWhispererTextContent(event: any): string {
    if (typeof event.data.content === 'string') {
      return event.data.content;
    }
    
    if (typeof event.data.content === 'object' && event.data.content.content) {
      return event.data.content.content;
    }
    
    return JSON.stringify(event.data.content);
  }

  private createCodeWhispererMergedEvent(textPieces: string[], batchIndex: number): any {
    const mergedContent = textPieces.join('');
    
    return {
      event: 'assistantResponseEvent',
      data: {
        content: mergedContent
      },
      metadata: {
        merged: true,
        batchIndex,
        batchSize: textPieces.length,
        originalEventCount: textPieces.length
      }
    };
  }
}

/**
 * CodeWhisperer缓冲处理策略实现
 */
class CodeWhispererBufferedStrategy extends BufferedProcessingStrategy {
  async process(data: Buffer | string, requestId: string, metadata?: any): Promise<any[]> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    
    logger.info('🔧 CodeWhisperer buffered processing (tool calls detected)', {
      bufferSize: buffer.length,
      reason: 'tool_calls_detected'
    }, requestId, 'cw-buffered-parser');
    
    return processBufferedResponse(buffer, requestId, metadata?.modelName || 'claude-optimized');
  }
}

/**
 * CodeWhisperer直接流式策略实现
 */
class CodeWhispererDirectStrategy extends DirectStreamingStrategy {
  async process(data: Buffer | string, requestId: string, metadata?: any): Promise<any[]> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    
    logger.info('⚡ CodeWhisperer direct streaming (small response)', {
      bufferSize: buffer.length,
      reason: 'small_response_no_tools'
    }, requestId, 'cw-direct-parser');
    
    try {
      const rawEvents = parseEvents(buffer);
      return convertEventsToAnthropic(rawEvents, requestId);
    } catch (error) {
      logger.warn('Direct streaming failed, falling back to buffered', {
        error: error instanceof Error ? error.message : String(error)
      }, requestId, 'cw-direct-parser');
      
      return processBufferedResponse(buffer, requestId, metadata?.modelName || 'claude-optimized');
    }
  }
}

/**
 * 创建CodeWhisperer优化解析器
 */
export function createOptimizedCodeWhispererParser(requestId: string): UniversalStreamingParser {
  const analyzer = new CodeWhispererAnalyzer();
  const strategies = [
    new CodeWhispererBufferedStrategy(),
    new CodeWhispererBatchStrategy(),
    new CodeWhispererDirectStrategy()
  ];
  
  return new UniversalStreamingParser(analyzer, strategies);
}

/**
 * 便捷的处理方法
 */
export async function processCodeWhispererResponse(
  buffer: Buffer, 
  requestId: string, 
  modelName: string
): Promise<any[]> {
  const parser = createOptimizedCodeWhispererParser(requestId);
  return parser.processResponse(buffer, requestId, { modelName });
}