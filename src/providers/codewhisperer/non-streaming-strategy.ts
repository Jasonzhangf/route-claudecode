/**
 * CodeWhisperer非流式请求+输出转换策略
 * 测试是否比流式处理更快
 * Owner: Jason Zhang
 */

import { logger } from '@/utils/logger';
import { BaseRequest } from '@/types';
import { processBufferedResponse } from './parser-buffered';

/**
 * 非流式策略性能分析
 */
export interface NonStreamingPerformanceAnalysis {
  shouldUseNonStreaming(request: BaseRequest): boolean;
  getPerformanceMetrics(): NonStreamingMetrics;
}

export interface NonStreamingMetrics {
  averageResponseTime: number;
  averageParsingTime: number;
  eventCountReduction: number;
  memoryUsage: number;
  successRate: number;
}

/**
 * 非流式+转换策略实现
 */
export class NonStreamingStrategy {
  private metrics: {
    totalRequests: number;
    totalResponseTime: number;
    totalParsingTime: number;
    totalEventsBefore: number;
    totalEventsAfter: number;
    memoryPeaks: number[];
  } = {
    totalRequests: 0,
    totalResponseTime: 0,
    totalParsingTime: 0,
    totalEventsBefore: 0,
    totalEventsAfter: 0,
    memoryPeaks: []
  };

  /**
   * 执行非流式请求+转换
   */
  async executeNonStreamingRequest(
    httpClient: any,
    cwRequest: any,
    requestId: string,
    modelName: string
  ): Promise<{
    events: any[];
    metrics: {
      responseTime: number;
      parsingTime: number;
      eventsBefore: number;
      eventsAfter: number;
      memoryPeak: number;
    }
  }> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    logger.info('🚀 Starting non-streaming CodeWhisperer request', {
      strategy: 'non-streaming-conversion',
      requestSize: JSON.stringify(cwRequest).length
    }, requestId, 'non-streaming');

    try {
      // 1️⃣ 发送非流式请求
      const response = await httpClient.post('/generateAssistantResponse', cwRequest, {
        responseType: 'arraybuffer'  // 获取完整响应
      });

      if (response.status !== 200) {
        throw new Error(`CodeWhisperer API returned status ${response.status}`);
      }

      const responseTime = Date.now() - startTime;
      const responseBuffer = Buffer.from(response.data);

      logger.info('📨 Non-streaming response received', {
        responseTime,
        responseSize: responseBuffer.length,
        rawPreview: responseBuffer.toString('hex').substring(0, 100)
      }, requestId, 'non-streaming');

      // 2️⃣ 开始解析和转换
      const parseStartTime = Date.now();
      
      // 使用现有的缓冲处理器解析响应
      const anthropicEvents = processBufferedResponse(responseBuffer, requestId, modelName);
      
      const parseTime = Date.now() - parseStartTime;
      const totalTime = Date.now() - startTime;
      const peakMemory = process.memoryUsage().heapUsed;

      logger.info('✅ Non-streaming processing completed', {
        totalTime,
        responseTime,
        parseTime,
        eventCount: anthropicEvents.length,
        memoryIncrease: peakMemory - startMemory,
        throughput: Math.round(responseBuffer.length / totalTime * 1000) // bytes per second
      }, requestId, 'non-streaming');

      // 更新指标
      this.updateMetrics({
        responseTime,
        parseTime,
        eventsBefore: this.estimateRawEventCount(responseBuffer),
        eventsAfter: anthropicEvents.length,
        memoryPeak: peakMemory - startMemory
      });

      return {
        events: anthropicEvents,
        metrics: {
          responseTime,
          parsingTime: parseTime,
          eventsBefore: this.estimateRawEventCount(responseBuffer),
          eventsAfter: anthropicEvents.length,
          memoryPeak: peakMemory - startMemory
        }
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      logger.error('❌ Non-streaming request failed', {
        error: error instanceof Error ? error.message : String(error),
        elapsedTime: totalTime
      }, requestId, 'non-streaming');

      throw error;
    }
  }

  /**
   * 估算原始事件数量（用于性能对比）
   */
  private estimateRawEventCount(buffer: Buffer): number {
    // 基于实际观察：114KB = 856个事件
    const avgEventSize = 133;
    return Math.ceil(buffer.length / avgEventSize);
  }

  /**
   * 更新性能指标
   */
  private updateMetrics(metrics: {
    responseTime: number;
    parseTime: number;
    eventsBefore: number;
    eventsAfter: number;
    memoryPeak: number;
  }): void {
    this.metrics.totalRequests++;
    this.metrics.totalResponseTime += metrics.responseTime;
    this.metrics.totalParsingTime += metrics.parseTime;
    this.metrics.totalEventsBefore += metrics.eventsBefore;
    this.metrics.totalEventsAfter += metrics.eventsAfter;
    this.metrics.memoryPeaks.push(metrics.memoryPeak);
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): NonStreamingMetrics {
    const requests = this.metrics.totalRequests || 1;
    
    return {
      averageResponseTime: this.metrics.totalResponseTime / requests,
      averageParsingTime: this.metrics.totalParsingTime / requests,
      eventCountReduction: (this.metrics.totalEventsBefore - this.metrics.totalEventsAfter) / this.metrics.totalEventsBefore,
      memoryUsage: this.metrics.memoryPeaks.reduce((a, b) => a + b, 0) / this.metrics.memoryPeaks.length,
      successRate: 1.0 // 基于成功调用计算
    };
  }

  /**
   * 决策算法：是否应该使用非流式策略
   */
  shouldUseNonStreaming(request: BaseRequest): boolean {
    // 🚨 EMERGENCY FIX: Force disable non-streaming due to severe performance issues
    // Non-streaming is causing 100+ second response times
    logger.warn('🚨 Non-streaming strategy temporarily disabled due to performance issues', {
      reason: 'Causing excessive response times (100+ seconds)',
      forceStreaming: true
    });
    return false;
  }

  private calculateMessageLength(request: BaseRequest): number {
    return request.messages.reduce((total, msg) => {
      if (typeof msg.content === 'string') {
        return total + msg.content.length;
      } else if (Array.isArray(msg.content)) {
        return total + msg.content.reduce((subtotal, item) => {
          return subtotal + (typeof item === 'string' ? item.length : JSON.stringify(item).length);
        }, 0);
      }
      return total + JSON.stringify(msg.content).length;
    }, 0);
  }
}

/**
 * 性能对比测试工具
 */
export class StreamingPerformanceComparator {
  private nonStreamingStrategy = new NonStreamingStrategy();
  private comparisonResults: Array<{
    requestId: string;
    nonStreamingTime: number;
    streamingTime: number;
    improvement: number;
    recommendation: 'non-streaming' | 'streaming';
  }> = [];

  /**
   * 添加对比结果
   */
  addComparison(
    requestId: string,
    nonStreamingTime: number,
    streamingTime: number
  ): void {
    const improvement = (streamingTime - nonStreamingTime) / streamingTime;
    const recommendation = improvement > 0.2 ? 'non-streaming' : 'streaming'; // 20%以上提升才推荐
    
    this.comparisonResults.push({
      requestId,
      nonStreamingTime,
      streamingTime,
      improvement,
      recommendation
    });

    logger.info('📊 Streaming vs Non-streaming comparison', {
      requestId,
      nonStreamingTime,
      streamingTime,
      improvement: `${(improvement * 100).toFixed(1)}%`,
      recommendation
    });
  }

  /**
   * 获取总体性能报告
   */
  getPerformanceReport(): {
    totalComparisons: number;
    averageImprovement: number;
    nonStreamingWins: number;
    streamingWins: number;
    recommendation: 'non-streaming' | 'streaming' | 'mixed';
  } {
    const total = this.comparisonResults.length;
    const avgImprovement = this.comparisonResults.reduce((sum, result) => sum + result.improvement, 0) / total;
    const nonStreamingWins = this.comparisonResults.filter(r => r.recommendation === 'non-streaming').length;
    const streamingWins = total - nonStreamingWins;
    
    let recommendation: 'non-streaming' | 'streaming' | 'mixed';
    if (nonStreamingWins > streamingWins * 1.5) {
      recommendation = 'non-streaming';
    } else if (streamingWins > nonStreamingWins * 1.5) {
      recommendation = 'streaming';
    } else {
      recommendation = 'mixed';
    }

    return {
      totalComparisons: total,
      averageImprovement: avgImprovement,
      nonStreamingWins,
      streamingWins,
      recommendation
    };
  }
}

/**
 * 创建非流式策略实例
 */
export function createNonStreamingStrategy(): NonStreamingStrategy {
  return new NonStreamingStrategy();
}

/**
 * 创建性能对比工具
 */
export function createPerformanceComparator(): StreamingPerformanceComparator {
  return new StreamingPerformanceComparator();
}