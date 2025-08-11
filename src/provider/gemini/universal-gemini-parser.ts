/**
 * Gemini通用流式解析器实现
 * 基于通用框架的Gemini Provider优化
 * Owner: Jason Zhang
 */

import { logger } from '@/utils/logger';
import { 
  UniversalStreamingParser,
  StreamOptimizationStrategy,
  StreamAnalysisResult,
  StreamDataAnalyzer,
  BufferedProcessingStrategy,
  BatchStreamingStrategy,
  DirectStreamingStrategy
} from '../common/universal-streaming-parser';

/**
 * Gemini数据分析器
 * 分析Gemini API的响应特征
 */
export class GeminiAnalyzer implements StreamDataAnalyzer {
  analyzeResponseStructure(buffer: Buffer | string): StreamAnalysisResult {
    const size = Buffer.isBuffer(buffer) ? buffer.length : Buffer.byteLength(buffer);
    const content = Buffer.isBuffer(buffer) ? buffer.toString('utf8', 0, Math.min(4096, size)) : buffer.slice(0, 4096);
    
    const hasToolCalls = this.detectToolCalls(content);
    const estimatedEventCount = this.estimateEventCount(content);
    
    // Gemini的响应通常比较结构化，但也可能有小片段
    const eventSize = estimatedEventCount > 300 ? 'small' : 'medium';
    
    return {
      totalSize: size,
      estimatedEventCount,
      hasToolCalls,
      recommendedStrategy: hasToolCalls ? 'buffered' : 
        (estimatedEventCount > 200 ? 'batch-streaming' : 'direct-streaming'),
      eventSize,
      confidence: 0.85
    };
  }

  detectToolCalls(data: string): boolean {
    const geminiToolSignatures = [
      'function_call', 'tool_call', 'functionCall',
      '"functionCall":', '"toolCall":',
      'tool_calls', 'function_calls',
      // Gemini特有的function calling格式
      '"name":', '"args":', '"arguments":',
      'executionResult', 'function_result'
    ];
    return geminiToolSignatures.some(sig => data.includes(sig));
  }

  estimateEventCount(data: string): number {
    // 分析Gemini的事件模式
    const lines = data.split('\n').filter(line => line.trim());
    let eventCount = 0;
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data && data !== '[DONE]') {
          eventCount++;
        }
      }
    }
    
    // 如果没有找到标准格式，基于内容大小估算
    if (eventCount === 0) {
      // Gemini通常每个事件较大，估算为200字节/事件
      const avgEventSize = 200;
      eventCount = Math.ceil(Buffer.byteLength(data) / avgEventSize);
    }
    
    return eventCount;
  }
}

/**
 * Gemini批量流式策略实现
 */
class GeminiBatchStrategy extends BatchStreamingStrategy {
  async process(data: Buffer | string, requestId: string, metadata?: any): Promise<any[]> {
    const content = Buffer.isBuffer(data) ? data.toString() : data;
    const analysis = metadata?.analysis as StreamAnalysisResult;
    
    const startTime = Date.now();
    
    logger.info('🚀 Gemini batch streaming started', {
      contentLength: content.length,
      estimatedEvents: analysis?.estimatedEventCount,
      batchSize: 30 // Gemini事件通常比CodeWhisperer大
    }, requestId, 'gemini-batch-parser');

    try {
      // 解析原始Gemini streaming事件
      const rawEvents = this.parseGeminiStreamEvents(content, requestId);
      
      // 批量合并小事件
      const batchedEvents = this.batchGeminiEvents(rawEvents, requestId);
      
      const processingTime = Date.now() - startTime;
      
      logger.info('✅ Gemini batch streaming completed', {
        originalEvents: rawEvents.length,
        batchedEvents: batchedEvents.length,
        processingTime,
        compressionRatio: `${rawEvents.length}:${batchedEvents.length}`,
        eventsPerSecond: Math.round(rawEvents.length / (processingTime / 1000))
      }, requestId, 'gemini-batch-parser');
      
      return batchedEvents;
      
    } catch (error) {
      logger.error('❌ Gemini batch streaming failed', {
        error: error instanceof Error ? error.message : String(error),
        contentLength: content.length
      }, requestId, 'gemini-batch-parser');
      
      // 降级到直接处理
      return new GeminiDirectStrategy().process(data, requestId, metadata);
    }
  }

  private parseGeminiStreamEvents(content: string, requestId: string): any[] {
    const events: any[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          break;
        }
        
        try {
          const parsedData = JSON.parse(data);
          events.push(parsedData);
        } catch (error) {
          logger.debug('Failed to parse Gemini stream line', {
            linePreview: data.slice(0, 100),
            error: error instanceof Error ? error.message : String(error)
          }, requestId, 'gemini-batch-parser');
        }
      }
    }
    
    return events;
  }

  private batchGeminiEvents(events: any[], requestId: string): any[] {
    const batchedEvents: any[] = [];
    const BATCH_SIZE = 30; // Gemini事件通常比CodeWhisperer大
    const TEXT_THRESHOLD = 20; // Gemini文本片段稍大
    
    let currentBatch: any[] = [];
    let batchCount = 0;
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      // 检查是否为Gemini的小文本事件
      if (this.isGeminiSmallTextEvent(event, TEXT_THRESHOLD)) {
        currentBatch.push(event);
        
        // 达到批量大小或到达末尾
        if (currentBatch.length >= BATCH_SIZE || i === events.length - 1) {
          const mergedEvent = this.createGeminiMergedEvent(currentBatch, batchCount);
          batchedEvents.push(mergedEvent);
          
          batchCount++;
          currentBatch = [];
        }
      } else {
        // 非小事件直接添加
        batchedEvents.push(event);
      }
    }
    
    logger.debug('Gemini event batching completed', {
      originalCount: events.length,
      batchedCount: batchedEvents.length,
      batchesCreated: batchCount,
      compressionRatio: events.length / (batchedEvents.length || 1)
    }, requestId, 'gemini-batch-parser');
    
    return batchedEvents;
  }

  private isGeminiSmallTextEvent(event: any, threshold: number): boolean {
    // 检查Gemini的候选响应结构
    if (!event.candidates || !Array.isArray(event.candidates)) return false;
    
    for (const candidate of event.candidates) {
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.text && part.text.length <= threshold) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  private createGeminiMergedEvent(events: any[], batchIndex: number): any {
    // 合并Gemini事件的文本内容
    let mergedText = '';
    const baseEvent = events[0];
    
    for (const event of events) {
      if (event.candidates && event.candidates[0] && event.candidates[0].content) {
        const parts = event.candidates[0].content.parts || [];
        for (const part of parts) {
          if (part.text) {
            mergedText += part.text;
          }
        }
      }
    }
    
    return {
      ...baseEvent,
      candidates: [{
        ...baseEvent.candidates[0],
        content: {
          parts: [{
            text: mergedText
          }],
          role: 'model'
        }
      }],
      metadata: {
        merged: true,
        batchIndex,
        batchSize: events.length,
        originalEventCount: events.length
      }
    };
  }
}

/**
 * Gemini缓冲处理策略实现
 */
class GeminiBufferedStrategy extends BufferedProcessingStrategy {
  async process(data: Buffer | string, requestId: string, metadata?: any): Promise<any[]> {
    const content = Buffer.isBuffer(data) ? data.toString() : data;
    
    logger.info('🔧 Gemini buffered processing (tool calls detected)', {
      contentLength: content.length,
      reason: 'tool_calls_detected'
    }, requestId, 'gemini-buffered-parser');
    
    return this.parseGeminiStreamResponse(content, requestId);
  }

  private parseGeminiStreamResponse(content: string, requestId: string): any[] {
    let events: any[] = [];
    
    try {
      // First try parsing as direct JSON array (Gemini's actual format)
      const parsedContent = JSON.parse(content);
      
      if (Array.isArray(parsedContent)) {
        events = parsedContent;
        logger.debug('Parsed Gemini response as JSON array', {
          eventCount: events.length
        }, requestId, 'gemini-buffered-parser');
      } else {
        // Single JSON object, wrap in array
        events = [parsedContent];
        logger.debug('Parsed Gemini response as single JSON object', {
          eventCount: 1
        }, requestId, 'gemini-buffered-parser');
      }
    } catch (error) {
      // Fallback: try parsing as SSE format (legacy)
      logger.debug('Attempting SSE format parsing as fallback', {}, requestId, 'gemini-buffered-parser');
      
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            break;
          }
          
          try {
            const parsedData = JSON.parse(data);
            events.push(parsedData);
          } catch (parseError) {
            logger.debug('Failed to parse Gemini SSE line', {
              linePreview: data.slice(0, 100),
              error: parseError instanceof Error ? parseError.message : String(parseError)
            }, requestId, 'gemini-buffered-parser');
          }
        }
      }
    }
    
    logger.debug('Gemini buffered parsing completed', {
      totalEvents: events.length,
      hasToolCalls: this.detectToolCallsInEvents(events),
      contentPreview: content.slice(0, 200) + '...'
    }, requestId, 'gemini-buffered-parser');
    
    return events;
  }

  private detectToolCallsInEvents(events: any[]): boolean {
    return events.some(event => {
      if (!event.candidates) return false;
      
      return event.candidates.some((candidate: any) => {
        return candidate.content && candidate.content.parts && 
               candidate.content.parts.some((part: any) => 
                 part.functionCall || part.toolCall || part.function_call
               );
      });
    });
  }
}

/**
 * Gemini直接流式策略实现
 */
class GeminiDirectStrategy extends DirectStreamingStrategy {
  async process(data: Buffer | string, requestId: string, metadata?: any): Promise<any[]> {
    const content = Buffer.isBuffer(data) ? data.toString() : data;
    
    logger.info('⚡ Gemini direct streaming (small response, no tools)', {
      contentLength: content.length,
      reason: 'small_response_no_tools'
    }, requestId, 'gemini-direct-parser');
    
    return this.parseGeminiStreamResponse(content, requestId);
  }

  private parseGeminiStreamResponse(content: string, requestId: string): any[] {
    let events: any[] = [];
    
    try {
      // First try parsing as direct JSON array (Gemini's actual format)
      const parsedContent = JSON.parse(content);
      
      if (Array.isArray(parsedContent)) {
        events = parsedContent;
        logger.debug('Parsed Gemini response as JSON array', {
          eventCount: events.length
        }, requestId, 'gemini-direct-parser');
      } else {
        // Single JSON object, wrap in array
        events = [parsedContent];
        logger.debug('Parsed Gemini response as single JSON object', {
          eventCount: 1
        }, requestId, 'gemini-direct-parser');
      }
    } catch (error) {
      // Fallback: try parsing as SSE format (legacy)
      logger.debug('Attempting SSE format parsing as fallback', {}, requestId, 'gemini-direct-parser');
      
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            break;
          }
          
          try {
            const parsedData = JSON.parse(data);
            events.push(parsedData);
          } catch (parseError) {
            logger.debug('Failed to parse Gemini SSE line', {
              linePreview: data.slice(0, 50),
              error: parseError instanceof Error ? parseError.message : String(parseError)
            }, requestId, 'gemini-direct-parser');
          }
        }
      }
    }
    
    logger.debug('Gemini direct parsing completed', {
      totalEvents: events.length,
      processingTime: 'minimal'
    }, requestId, 'gemini-direct-parser');
    
    return events;
  }
}

/**
 * 创建Gemini优化解析器
 */
export function createOptimizedGeminiParser(requestId: string): UniversalStreamingParser {
  const analyzer = new GeminiAnalyzer();
  const strategies = [
    new GeminiBufferedStrategy(),
    new GeminiBatchStrategy(),
    new GeminiDirectStrategy()
  ];
  
  return new UniversalStreamingParser(analyzer, strategies);
}

/**
 * 便捷的Gemini响应处理方法
 */
export async function processGeminiResponse(
  data: Buffer | string, 
  requestId: string, 
  metadata?: any
): Promise<any[]> {
  const parser = createOptimizedGeminiParser(requestId);
  return parser.processResponse(data, requestId, metadata);
}

/**
 * Gemini增强分析器 - 针对特定场景优化
 */
export class EnhancedGeminiAnalyzer extends GeminiAnalyzer {
  analyzeResponseStructure(buffer: Buffer | string): StreamAnalysisResult {
    const baseAnalysis = super.analyzeResponseStructure(buffer);
    
    const content = Buffer.isBuffer(buffer) ? buffer.toString() : buffer;
    
    // 检查是否为大型multimodal响应(图像、代码等)
    const hasMultimodal = this.detectMultimodalContent(content);
    const hasLongCode = this.detectLongCode(content);
    
    return {
      ...baseAnalysis,
      recommendedStrategy: hasMultimodal || hasLongCode ? 'buffered' :
        baseAnalysis.hasToolCalls ? 'buffered' : 
        baseAnalysis.recommendedStrategy,
      confidence: hasMultimodal ? 0.95 : baseAnalysis.confidence
    };
  }

  private detectMultimodalContent(content: string): boolean {
    const multimodalSignatures = [
      'image/', 'video/', 'audio/',
      'base64', 'data:image',
      'mimeType', 'fileData'
    ];
    
    return multimodalSignatures.some(sig => content.includes(sig));
  }

  private detectLongCode(content: string): boolean {
    // 检测长代码块响应
    const codeSignatures = [
      '```', 'function ', 'class ', 'def ', 'import ',
      'const ', 'let ', 'var ', '#include', 'public class'
    ];
    
    const codeBlockCount = (content.match(/```/g) || []).length;
    const hasCodeSignatures = codeSignatures.some(sig => content.includes(sig));
    
    return codeBlockCount >= 2 || (hasCodeSignatures && content.length > 5000);
  }
}