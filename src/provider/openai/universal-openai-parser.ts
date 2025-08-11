/**
 * OpenAI通用流式解析器实现
 * 基于通用框架的OpenAI Provider优化
 * Owner: Jason Zhang
 */

import { logger } from '@/utils/logger';
import { 
  UniversalStreamingParser,
  StreamOptimizationStrategy,
  StreamAnalysisResult,
  OpenAIAnalyzer,
  BufferedProcessingStrategy,
  DirectStreamingStrategy
} from '../common/universal-streaming-parser';

/**
 * OpenAI缓冲处理策略实现
 */
class OpenAIBufferedStrategy extends BufferedProcessingStrategy {
  async process(data: Buffer | string, requestId: string, metadata?: any): Promise<any[]> {
    const content = Buffer.isBuffer(data) ? data.toString() : data;
    
    logger.info('🔧 OpenAI buffered processing (tool calls detected)', {
      dataLength: content.length,
      reason: 'tool_calls_detected'
    }, requestId, 'openai-buffered-parser');
    
    return this.parseOpenAIStreamResponse(content, requestId);
  }

  private parseOpenAIStreamResponse(content: string, requestId: string): any[] {
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
          logger.debug('Failed to parse OpenAI stream line', {
            line: data,
            error: error instanceof Error ? error.message : String(error)
          }, requestId, 'openai-buffered-parser');
        }
      }
    }
    
    logger.debug('OpenAI buffered parsing completed', {
      totalEvents: events.length,
      eventTypes: events.map(e => e.object || 'unknown').slice(0, 5)
    }, requestId, 'openai-buffered-parser');
    
    return events;
  }
}

/**
 * OpenAI直接流式策略实现
 */
class OpenAIDirectStrategy extends DirectStreamingStrategy {
  async process(data: Buffer | string, requestId: string, metadata?: any): Promise<any[]> {
    const content = Buffer.isBuffer(data) ? data.toString() : data;
    
    logger.info('⚡ OpenAI direct streaming (no tools, small response)', {
      dataLength: content.length,
      reason: 'small_response_no_tools'
    }, requestId, 'openai-direct-parser');
    
    // 对于小响应，直接解析即可
    return this.parseOpenAIStreamResponse(content, requestId);
  }

  private parseOpenAIStreamResponse(content: string, requestId: string): any[] {
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
          logger.debug('Failed to parse OpenAI stream line', {
            line: data.slice(0, 100),
            error: error instanceof Error ? error.message : String(error)
          }, requestId, 'openai-direct-parser');
        }
      }
    }
    
    logger.debug('OpenAI direct parsing completed', {
      totalEvents: events.length,
      processingTime: 'minimal'
    }, requestId, 'openai-direct-parser');
    
    return events;
  }
}

/**
 * OpenAI批量处理策略 (如果需要的话)
 */
class OpenAIBatchStrategy extends DirectStreamingStrategy {
  name = 'openai-batch';
  
  shouldUse(analysis: StreamAnalysisResult): boolean {
    // OpenAI通常不需要批量处理，因为事件已经比较大
    // 但如果发现有大量小事件，可以启用
    return analysis.estimatedEventCount > 1000 && analysis.eventSize === 'small';
  }

  async process(data: Buffer | string, requestId: string, metadata?: any): Promise<any[]> {
    logger.info('🚀 OpenAI batch processing (large event count)', {
      dataLength: Buffer.isBuffer(data) ? data.length : data.length,
      reason: 'large_event_count'
    }, requestId, 'openai-batch-parser');
    
    // 对于OpenAI，通常直接处理即可，因为事件本身不会太小
    return new OpenAIDirectStrategy().process(data, requestId, metadata);
  }
}

/**
 * 创建OpenAI优化解析器
 */
export function createOptimizedOpenAIParser(requestId: string): UniversalStreamingParser {
  const analyzer = new OpenAIAnalyzer();
  const strategies = [
    new OpenAIBufferedStrategy(),
    new OpenAIBatchStrategy(),
    new OpenAIDirectStrategy()
  ];
  
  return new UniversalStreamingParser(analyzer, strategies);
}

/**
 * 便捷的OpenAI响应处理方法
 */
export async function processOpenAIResponse(
  data: Buffer | string, 
  requestId: string, 
  metadata?: any
): Promise<any[]> {
  const parser = createOptimizedOpenAIParser(requestId);
  return parser.processResponse(data, requestId, metadata);
}

/**
 * OpenAI增强分析器 - 针对特定提供商优化
 */
export class EnhancedOpenAIAnalyzer extends OpenAIAnalyzer {
  analyzeResponseStructure(buffer: Buffer | string): StreamAnalysisResult {
    const baseAnalysis = super.analyzeResponseStructure(buffer);
    
    // 针对特定OpenAI兼容提供商的优化
    const content = Buffer.isBuffer(buffer) ? buffer.toString() : buffer;
    
    // 检查是否为Shuaihong等第三方提供商的特殊响应格式
    const isThirdPartyProvider = this.detectThirdPartyProvider(content);
    const hasLargeContent = content.length > 50000; // 50KB
    
    return {
      ...baseAnalysis,
      recommendedStrategy: isThirdPartyProvider && hasLargeContent ? 'buffered' :
        baseAnalysis.hasToolCalls ? 'buffered' : 'direct-streaming',
      confidence: isThirdPartyProvider ? 0.95 : baseAnalysis.confidence
    };
  }

  private detectThirdPartyProvider(content: string): boolean {
    // 检测第三方提供商的特殊标识
    const thirdPartySignatures = [
      'shuaihong', 'modelscope', 'deepseek', 'zhipu'
    ];
    
    return thirdPartySignatures.some(sig => content.toLowerCase().includes(sig));
  }
}