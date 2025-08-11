/**
 * 通用高效流式解析器框架
 * 适用于所有Provider的响应优化
 * Owner: Jason Zhang
 */

import { logger } from '@/utils/logger';

/**
 * 通用流式数据分析器
 */
export interface StreamDataAnalyzer {
  analyzeResponseStructure(buffer: Buffer | string): StreamAnalysisResult;
  detectToolCalls(buffer: Buffer | string): boolean;
  estimateEventCount(buffer: Buffer | string): number;
}

/**
 * 流式数据分析结果
 */
export interface StreamAnalysisResult {
  totalSize: number;
  estimatedEventCount: number;
  hasToolCalls: boolean;
  recommendedStrategy: 'buffered' | 'batch-streaming' | 'direct-streaming';
  eventSize: 'small' | 'medium' | 'large';
  confidence: number; // 0-1
}

/**
 * 通用流式优化策略
 */
export interface StreamOptimizationStrategy {
  name: string;
  shouldUse(analysis: StreamAnalysisResult): boolean;
  process(data: Buffer | string, requestId: string, metadata?: any): Promise<any[]>;
}

/**
 * CodeWhisperer数据分析器
 */
export class CodeWhispererAnalyzer implements StreamDataAnalyzer {
  analyzeResponseStructure(buffer: Buffer | string): StreamAnalysisResult {
    const size = Buffer.isBuffer(buffer) ? buffer.length : Buffer.byteLength(buffer);
    const content = Buffer.isBuffer(buffer) ? buffer.toString('utf8', 0, Math.min(2048, size)) : buffer.slice(0, 2048);
    
    // 基于实际CodeWhisperer数据模式
    const hasToolCalls = this.detectToolCalls(content);
    const estimatedEventCount = this.estimateEventCount(content);
    
    return {
      totalSize: size,
      estimatedEventCount,
      hasToolCalls,
      recommendedStrategy: hasToolCalls ? 'buffered' : 
        (estimatedEventCount > 500 ? 'batch-streaming' : 'direct-streaming'),
      eventSize: estimatedEventCount > 500 ? 'small' : 'medium',
      confidence: 0.9
    };
  }

  detectToolCalls(data: string): boolean {
    const toolSignatures = [
      'tool_use', 'function_call', 'Tool call:', 
      '"type": "tool_use"', '"name":', '"input":'
    ];
    return toolSignatures.some(sig => data.includes(sig));
  }

  estimateEventCount(data: string): number {
    // 基于实际观察：114KB = 856个事件
    const avgEventSize = 133; // 字节
    const totalSize = Buffer.byteLength(data);
    return Math.ceil(totalSize / avgEventSize);
  }
}

/**
 * OpenAI数据分析器
 */
export class OpenAIAnalyzer implements StreamDataAnalyzer {
  analyzeResponseStructure(buffer: Buffer | string): StreamAnalysisResult {
    const size = Buffer.isBuffer(buffer) ? buffer.length : Buffer.byteLength(buffer);
    const content = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : buffer;
    
    const hasToolCalls = this.detectToolCalls(content);
    const estimatedEventCount = this.estimateEventCount(content);
    
    return {
      totalSize: size,
      estimatedEventCount,
      hasToolCalls,
      recommendedStrategy: hasToolCalls ? 'buffered' : 'direct-streaming',
      eventSize: 'medium',
      confidence: 0.8
    };
  }

  detectToolCalls(data: string): boolean {
    const toolSignatures = [
      '"tool_calls":', '"function":', '"tool_call_id":',
      'function_call', 'tool_call'
    ];
    return toolSignatures.some(sig => data.includes(sig));
  }

  estimateEventCount(data: string): number {
    // OpenAI事件通常比CodeWhisperer大
    const lines = data.split('\n').filter(line => line.startsWith('data: '));
    return lines.length;
  }
}

/**
 * 批量流式优化策略
 */
export class BatchStreamingStrategy implements StreamOptimizationStrategy {
  name = 'batch-streaming';
  
  shouldUse(analysis: StreamAnalysisResult): boolean {
    return analysis.recommendedStrategy === 'batch-streaming' && 
           analysis.eventSize === 'small' &&
           analysis.estimatedEventCount > 100;
  }

  async process(data: Buffer | string, requestId: string, metadata?: any): Promise<any[]> {
    logger.info(`🚀 Using batch streaming optimization`, {
      dataSize: Buffer.isBuffer(data) ? data.length : data.length,
      strategy: this.name
    }, requestId, 'universal-parser');

    // 这里应该调用具体provider的批量处理逻辑
    // 由子类实现具体的解析逻辑
    throw new Error('BatchStreamingStrategy.process must be implemented by provider-specific class');
  }
}

/**
 * 完全缓冲优化策略
 */
export class BufferedProcessingStrategy implements StreamOptimizationStrategy {
  name = 'buffered';
  
  shouldUse(analysis: StreamAnalysisResult): boolean {
    return analysis.recommendedStrategy === 'buffered' || analysis.hasToolCalls;
  }

  async process(data: Buffer | string, requestId: string, metadata?: any): Promise<any[]> {
    logger.info(`🔧 Using buffered processing (tool calls detected)`, {
      dataSize: Buffer.isBuffer(data) ? data.length : data.length,
      strategy: this.name
    }, requestId, 'universal-parser');

    // 由子类实现具体的缓冲处理逻辑
    throw new Error('BufferedProcessingStrategy.process must be implemented by provider-specific class');
  }
}

/**
 * 直接流式策略
 */
export class DirectStreamingStrategy implements StreamOptimizationStrategy {
  name = 'direct-streaming';
  
  shouldUse(analysis: StreamAnalysisResult): boolean {
    return analysis.recommendedStrategy === 'direct-streaming' && 
           !analysis.hasToolCalls &&
           analysis.estimatedEventCount < 100;
  }

  async process(data: Buffer | string, requestId: string, metadata?: any): Promise<any[]> {
    logger.info(`⚡ Using direct streaming (small response)`, {
      dataSize: Buffer.isBuffer(data) ? data.length : data.length,
      strategy: this.name
    }, requestId, 'universal-parser');

    // 由子类实现具体的直接处理逻辑
    throw new Error('DirectStreamingStrategy.process must be implemented by provider-specific class');
  }
}

/**
 * 通用流式解析器
 */
export class UniversalStreamingParser {
  private analyzer: StreamDataAnalyzer;
  private strategies: StreamOptimizationStrategy[];
  
  constructor(analyzer: StreamDataAnalyzer, strategies: StreamOptimizationStrategy[]) {
    this.analyzer = analyzer;
    this.strategies = strategies;
  }

  async processResponse(data: Buffer | string, requestId: string, metadata?: any): Promise<any[]> {
    const startTime = Date.now();
    
    // 分析数据特征
    const analysis = this.analyzer.analyzeResponseStructure(data);
    
    logger.info('📊 Stream response analysis completed', {
      totalSize: analysis.totalSize,
      estimatedEvents: analysis.estimatedEventCount,
      hasToolCalls: analysis.hasToolCalls,
      recommendedStrategy: analysis.recommendedStrategy,
      eventSize: analysis.eventSize,
      confidence: analysis.confidence,
      analysisTime: Date.now() - startTime
    }, requestId, 'universal-parser');

    // 选择最佳策略
    const selectedStrategy = this.strategies.find(strategy => strategy.shouldUse(analysis));
    
    if (!selectedStrategy) {
      throw new Error(`No suitable streaming strategy found for analysis: ${JSON.stringify(analysis)}`);
    }

    logger.info(`🎯 Selected optimization strategy: ${selectedStrategy.name}`, {
      strategy: selectedStrategy.name,
      reason: analysis.recommendedStrategy
    }, requestId, 'universal-parser');

    // 执行选择的策略
    return selectedStrategy.process(data, requestId, { analysis, ...metadata });
  }
}

/**
 * Provider工厂方法
 */
export class UniversalParserFactory {
  static createCodeWhispererParser(): UniversalStreamingParser {
    const analyzer = new CodeWhispererAnalyzer();
    const strategies = [
      new BufferedProcessingStrategy(),
      new BatchStreamingStrategy(), 
      new DirectStreamingStrategy()
    ];
    
    return new UniversalStreamingParser(analyzer, strategies);
  }

  static createOpenAIParser(): UniversalStreamingParser {
    const analyzer = new OpenAIAnalyzer();
    const strategies = [
      new BufferedProcessingStrategy(),
      new DirectStreamingStrategy()
    ];
    
    return new UniversalStreamingParser(analyzer, strategies);
  }

  static createGeminiParser(): UniversalStreamingParser {
    // Note: GeminiAnalyzer will be imported from gemini provider
    // This method will be implemented after circular dependency resolution
    throw new Error('Gemini parser should be created via gemini provider factory method');
  }

  /**
   * 通用工厂方法 - 根据provider类型创建对应解析器
   */
  static createParser(providerType: 'codewhisperer' | 'openai' | 'gemini'): UniversalStreamingParser {
    switch (providerType) {
      case 'codewhisperer':
        return this.createCodeWhispererParser();
      case 'openai':
        return this.createOpenAIParser();
      case 'gemini':
        return this.createGeminiParser();
      default:
        throw new Error(`Unsupported provider type: ${providerType}`);
    }
  }
}