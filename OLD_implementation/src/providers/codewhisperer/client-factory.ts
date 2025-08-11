/**
 * CodeWhisperer 客户端工厂
 * 工厂模式创建缓冲式或实时流式客户端实例
 * 项目所有者: Jason Zhang
 */

import { logger } from '@/utils/logger';
import { ICodeWhispererClient } from './client-interface';
import { CodeWhispererBufferedClient } from './client-buffered';
import { CodeWhispererRealtimeClient } from './client-realtime';
import { CodeWhispererStreamingConfig } from './config/streaming-config';

export class CodeWhispererClientFactory {
  /**
   * 根据配置创建对应的客户端实例
   * @param config 流式配置
   * @returns 客户端实例
   */
  static createClient(config: CodeWhispererStreamingConfig): ICodeWhispererClient {
    const startTime = Date.now();
    
    try {
      logger.info('创建CodeWhisperer客户端', {
        implementation: config.implementation,
        config: {
          implementation: config.implementation,
          realtimeOptions: {
            enableZeroDelay: config.realtimeOptions.enableZeroDelay,
            maxConcurrentStreams: config.realtimeOptions.maxConcurrentStreams,
            toolCallStrategy: config.realtimeOptions.toolCallStrategy,
          },
          performanceMetrics: {
            enableProfiling: config.performanceMetrics.enableProfiling,
            collectLatencyData: config.performanceMetrics.collectLatencyData,
          },
        },
      });

      let client: ICodeWhispererClient;

      switch (config.implementation) {
        case 'realtime':
          client = new CodeWhispererRealtimeClient(config);
          break;
        
        case 'buffered':
        default:
          client = new CodeWhispererBufferedClient(config);
          break;
      }

      const creationTime = Date.now() - startTime;
      
      logger.info('CodeWhisperer客户端创建完成', {
        implementation: config.implementation,
        clientType: client.getClientType(),
        creationTimeMs: creationTime,
        healthCheck: typeof client.healthCheck === 'function' ? 'available' : 'unavailable',
      });

      return client;

    } catch (error) {
      const creationTime = Date.now() - startTime;
      
      logger.error('CodeWhisperer客户端创建失败', {
        implementation: config.implementation,
        creationTimeMs: creationTime,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // 如果实时客户端创建失败，检查是否可以回退到缓冲式客户端
      if (config.implementation === 'realtime' && config.fallback.enableFallback) {
        if (config.fallback.fallbackToBuffered) {
          logger.warn('实时客户端创建失败，回退到缓冲式客户端', {
            error: error instanceof Error ? error.message : String(error),
            fallbackEnabled: config.fallback.enableFallback,
          });
          
          try {
            const fallbackClient = new CodeWhispererBufferedClient(config);
            logger.info('缓冲式客户端回退创建成功');
            return fallbackClient;
          } catch (fallbackError) {
            logger.error('缓冲式客户端回退创建也失败', {
              error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
            });
            throw fallbackError;
          }
        }
      }

      throw error;
    }
  }

  /**
   * 创建缓冲式客户端
   */
  static createBufferedClient(config?: CodeWhispererStreamingConfig): ICodeWhispererClient {
    const bufferedConfig = config || {
      implementation: 'buffered',
    } as CodeWhispererStreamingConfig;
    
    return new CodeWhispererBufferedClient(bufferedConfig);
  }

  /**
   * 创建实时流式客户端
   */
  static createRealtimeClient(config: CodeWhispererStreamingConfig): ICodeWhispererClient {
    const realtimeConfig = {
      ...config,
      implementation: 'realtime' as const,
    };
    
    return new CodeWhispererRealtimeClient(realtimeConfig);
  }

  /**
   * 验证客户端配置
   */
  static validateConfig(config: CodeWhispererStreamingConfig): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证implementation
    if (!['buffered', 'realtime'].includes(config.implementation)) {
      errors.push('implementation必须是buffered或realtime');
    }

    // 实时特定配置验证
    if (config.implementation === 'realtime') {
      if (config.realtimeOptions.maxConcurrentStreams < 1) {
        errors.push('maxConcurrentStreams必须大于0');
      }

      if (config.realtimeOptions.maxConcurrentStreams > 1000) {
        warnings.push('maxConcurrentStreams值较大，可能影响内存使用');
      }

      if (config.realtimeOptions.binaryFrameSize < 1024) {
        errors.push('binaryFrameSize必须至少为1024字节');
      }

      if (config.realtimeOptions.binaryFrameSize > 10 * 1024 * 1024) {
        warnings.push('binaryFrameSize值较大，建议不超过10MB');
      }

      if (!['immediate', 'buffered'].includes(config.realtimeOptions.toolCallStrategy)) {
        errors.push('toolCallStrategy必须是immediate或buffered');
      }

      if (config.realtimeOptions.enableZeroDelay && config.realtimeOptions.toolCallStrategy === 'buffered') {
        warnings.push('启用零延迟但使用缓冲式工具调用策略，可能无法获得最佳性能');
      }
    }

    // 性能监控配置验证
    if (config.performanceMetrics.metricsIntervalMs < 100) {
      warnings.push('metricsIntervalMs值较小，可能增加CPU负载');
    }

    if (config.performanceMetrics.metricsIntervalMs > 60000) {
      warnings.push('metricsIntervalMs值较大，可能影响监控实时性');
    }

    // 故障转移配置验证
    if (config.fallback.maxFailuresBeforeFallback < 1) {
      errors.push('maxFailuresBeforeFallback必须大于0');
    }

    if (config.fallback.maxFailuresBeforeFallback > 10) {
      warnings.push('maxFailuresBeforeFallback值较大，可能导致故障转移延迟');
    }

    // 资源使用警告
    if (config.implementation === 'realtime' && config.realtimeOptions.enableZeroDelay) {
      if (config.realtimeOptions.maxConcurrentStreams > 100) {
        warnings.push('启用零延迟且并发流数较多，建议监控系统资源使用');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 获取推荐的配置
   */
  static getRecommendedConfig(usage: 'development' | 'testing' | 'production'): CodeWhispererStreamingConfig {
    const baseConfig = {
      implementation: 'buffered' as const,
      realtimeOptions: {
        enableZeroDelay: true,
        maxConcurrentStreams: 100,
        binaryFrameSize: 1024 * 1024,
        toolCallStrategy: 'immediate' as const,
        enableCompression: false,
      },
      performanceMetrics: {
        enableProfiling: false,
        collectLatencyData: false,
        memoryUsageTracking: false,
        metricsIntervalMs: 5000,
      },
      fallback: {
        enableFallback: true,
        fallbackToBuffered: true,
        maxFailuresBeforeFallback: 3,
      },
    };

    switch (usage) {
      case 'development':
        return {
          ...baseConfig,
          implementation: 'buffered',
          realtimeOptions: {
            ...baseConfig.realtimeOptions,
            maxConcurrentStreams: 10,
          },
          performanceMetrics: {
            ...baseConfig.performanceMetrics,
            enableProfiling: true,
            collectLatencyData: true,
            memoryUsageTracking: true,
          },
        };

      case 'testing':
        return {
          ...baseConfig,
          implementation: 'realtime',
          realtimeOptions: {
            ...baseConfig.realtimeOptions,
            maxConcurrentStreams: 50,
          },
          performanceMetrics: {
            ...baseConfig.performanceMetrics,
            enableProfiling: true,
            collectLatencyData: true,
            memoryUsageTracking: false,
          },
        };

      case 'production':
        return {
          ...baseConfig,
          implementation: 'realtime',
          realtimeOptions: {
            ...baseConfig.realtimeOptions,
            maxConcurrentStreams: 200,
            enableCompression: true,
          },
          performanceMetrics: {
            ...baseConfig.performanceMetrics,
            enableProfiling: true,
            collectLatencyData: true,
            memoryUsageTracking: true,
            metricsIntervalMs: 10000,
          },
        };

      default:
        return baseConfig;
    }
  }

  /**
   * 获取配置优化建议
   */
  static getOptimizationSuggestions(config: CodeWhispererStreamingConfig): {
    suggestions: string[];
    impact: 'low' | 'medium' | 'high';
  }[] {
    const suggestions: {
      suggestions: string[];
      impact: 'low' | 'medium' | 'high';
    }[] = [];

    // 性能优化建议
    if (config.implementation === 'buffered') {
      suggestions.push({
        suggestions: [
          '考虑切换到实时流式实现以获得更好的性能',
          '实时实现可以减少50%以上的延迟',
        ],
        impact: 'high',
      });
    }

    if (config.implementation === 'realtime' && !config.realtimeOptions.enableZeroDelay) {
      suggestions.push({
        suggestions: [
          '启用零延迟模式可以获得最佳性能',
          '零延迟模式下响应延迟可降低到10ms以下',
        ],
        impact: 'high',
      });
    }

    // 资源优化建议
    if (config.realtimeOptions.maxConcurrentStreams > 200) {
      suggestions.push({
        suggestions: [
          '高并发流数可能导致高内存使用',
          '建议监控内存使用情况',
          '考虑增加maxConcurrentStreams前的负载测试',
        ],
        impact: 'medium',
      });
    }

    if (config.realtimeOptions.binaryFrameSize > 5 * 1024 * 1024) {
      suggestions.push({
        suggestions: [
          '大帧大小可能导致内存压力',
          '建议将binaryFrameSize调整到合适的值',
        ],
        impact: 'medium',
      });
    }

    // 工具调用优化建议
    if (config.realtimeOptions.toolCallStrategy === 'buffered') {
      suggestions.push({
        suggestions: [
          '考虑使用immediate工具调用策略以获得更好的实时性',
          'immediate策略可以实时处理工具调用',
        ],
        impact: 'medium',
      });
    }

    // 监控优化建议
    if (!config.performanceMetrics.enableProfiling) {
      suggestions.push({
        suggestions: [
          '启用性能分析可以帮助优化配置',
          '建议在开发和测试环境中启用性能监控',
        ],
        impact: 'low',
      });
    }

    if (!config.fallback.enableFallback) {
      suggestions.push({
        suggestions: [
          '启用故障转移机制可以提高系统稳定性',
          '建议在生产环境中启用故障转移',
        ],
        impact: 'medium',
      });
    }

    return suggestions;
  }
}
