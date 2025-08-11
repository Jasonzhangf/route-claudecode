/**
 * CodeWhisperer 主客户端 - 重构版本
 * 支持动态切换缓冲式和实时流式实现
 * 项目所有者: Jason Zhang
 */

import { logger } from '@/utils/logger';
import { ICodeWhispererClient } from './client-interface';
import { CodeWhispererClientFactory } from './client-factory';
import { CodeWhispererStreamingConfigManager } from './config/streaming-config';
import { CodeWhispererStreamingConfig } from './config/streaming-config';
import { CodeWhispererPerformanceMetrics } from './config/performance-metrics';
import { AnthropicRequest } from './types';

export class CodeWhispererClient {
  private client: ICodeWhispererClient;
  private configManager: CodeWhispererStreamingConfigManager;
  private metrics: CodeWhispererPerformanceMetrics;
  private configChangeListener: (config: CodeWhispererStreamingConfig) => void = () => {}; // 默认空函数
  private failureCount: number = 0;
  private readonly maxFailuresBeforeFallback: number = 3;

  constructor(config?: CodeWhispererStreamingConfig) {
    this.configManager = CodeWhispererStreamingConfigManager.getInstance();
    
    // 如果提供了配置，更新管理器
    if (config) {
      this.configManager.updateConfig(config);
    }
    
    const currentConfig = this.configManager.getConfig();
    this.metrics = new CodeWhispererPerformanceMetrics(currentConfig);
    this.client = CodeWhispererClientFactory.createClient(currentConfig);
    
    // 设置配置变更监听器
    this.setupConfigChangeListener();
    
    logger.info('CodeWhisperer主客户端初始化完成', {
      implementation: currentConfig.implementation,
      config: {
        implementation: currentConfig.implementation,
        realtimeOptions: currentConfig.realtimeOptions,
        performanceMetrics: currentConfig.performanceMetrics,
        fallback: currentConfig.fallback,
      },
      clientType: this.client.getClientType(),
      healthCheck: typeof this.client.healthCheck === 'function' ? 'available' : 'unavailable',
    });
  }

  /**
   * 处理流式请求 - 统一接口
   */
  public async handleStreamRequest(
    anthropicReq: AnthropicRequest,
    writeSSE: (event: string, data: any) => void,
    onError: (message: string, error: Error) => void
  ): Promise<void> {
    const requestId = `main_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const startTime = Date.now();
    
    try {
      const config = this.configManager.getConfig();
      
      logger.info('CodeWhisperer主客户端开始处理流式请求', {
        requestId,
        implementation: config.implementation,
        clientType: this.client.getClientType(),
        model: anthropicReq.model,
        messageCount: anthropicReq.messages.length,
        hasTools: !!(anthropicReq.tools && anthropicReq.tools.length > 0),
      });

      // 执行请求
      await this.client.handleStreamRequest(anthropicReq, writeSSE, onError);
      
      // 重置失败计数
      this.failureCount = 0;
      
      const duration = Date.now() - startTime;
      logger.info('CodeWhisperer流式请求处理完成', {
        requestId,
        duration,
        implementation: config.implementation,
        success: true,
      });

    } catch (error) {
      this.failureCount++;
      const duration = Date.now() - startTime;
      const config = this.configManager.getConfig();
      
      logger.error('CodeWhisperer流式请求处理失败', {
        requestId,
        duration,
        implementation: config.implementation,
        clientType: this.client.getClientType(),
        failureCount: this.failureCount,
        maxFailuresBeforeFallback: this.maxFailuresBeforeFallback,
        error: error instanceof Error ? error.message : String(error),
      });

      // 检查是否需要故障转移
      if (this.shouldFallback(config)) {
        await this.handleFallback(error, onError);
      } else {
        // 直接调用错误处理
        onError(
          `CodeWhisperer请求失败: ${error instanceof Error ? error.message : String(error)}`,
          error as Error
        );
      }
    }
  }

  /**
   * 处理非流式请求 - 统一接口
   */
  public async handleNonStreamRequest(anthropicReq: AnthropicRequest): Promise<any> {
    const requestId = `main_nonstream_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const startTime = Date.now();
    
    try {
      const config = this.configManager.getConfig();
      
      logger.info('CodeWhisperer主客户端开始处理非流式请求', {
        requestId,
        implementation: config.implementation,
        clientType: this.client.getClientType(),
        model: anthropicReq.model,
        messageCount: anthropicReq.messages.length,
      });

      // 执行请求
      const result = await this.client.handleNonStreamRequest(anthropicReq);
      
      // 重置失败计数
      this.failureCount = 0;
      
      const duration = Date.now() - startTime;
      logger.info('CodeWhisperer非流式请求处理完成', {
        requestId,
        duration,
        implementation: config.implementation,
        success: true,
      });
      
      return result;

    } catch (error) {
      this.failureCount++;
      const duration = Date.now() - startTime;
      const config = this.configManager.getConfig();
      
      logger.error('CodeWhisperer非流式请求处理失败', {
        requestId,
        duration,
        implementation: config.implementation,
        clientType: this.client.getClientType(),
        failureCount: this.failureCount,
        maxFailuresBeforeFallback: this.maxFailuresBeforeFallback,
        error: error instanceof Error ? error.message : String(error),
      });

      // 检查是否需要故障转移
      if (this.shouldFallback(config)) {
        return await this.handleNonStreamFallback(error);
      } else {
        throw error;
      }
    }
  }

  /**
   * 动态切换实现
   */
  public switchImplementation(implementation: 'buffered' | 'realtime'): void {
    const oldImplementation = this.client.getClientType();
    const oldConfig = this.configManager.getConfig();
    
    logger.info('CodeWhisperer主客户端开始切换实现', {
      from: oldImplementation,
      to: implementation,
      failureCount: this.failureCount,
    });

    try {
      // 更新配置
      this.configManager.switchImplementation(implementation);
      const newConfig = this.configManager.getConfig();
      
      // 创建新的客户端实例
      const newClient = CodeWhispererClientFactory.createClient(newConfig);
      
      // 健康检查
      newClient.healthCheck().then(healthCheck => {
        logger.info('新客户端健康检查完成', {
          implementation,
          healthCheck,
        });
        
        if (healthCheck.healthy) {
          // 替换客户端
          this.client = newClient;
          
          // 重置失败计数
          this.failureCount = 0;
          
          logger.info('CodeWhisperer实现切换成功', {
            from: oldImplementation,
            to: implementation,
            newClientType: this.client.getClientType(),
          });
        } else {
          logger.warn('新客户端健康检查失败，回滚到原实现', {
            implementation,
            healthCheck,
          });
          
          // 回滚配置
          this.configManager.switchImplementation(oldImplementation);
        }
      }).catch(healthError => {
        logger.error('新客户端健康检查失败，回滚到原实现', {
          implementation,
          error: healthError instanceof Error ? healthError.message : String(healthError),
        });
        
        // 回滚配置
        this.configManager.switchImplementation(oldImplementation);
      });
      
    } catch (error) {
      logger.error('CodeWhisperer实现切换失败', {
        from: oldImplementation,
        to: implementation,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw error;
    }
  }

  /**
   * 获取当前客户端类型
   */
  public getClientType(): 'buffered' | 'realtime' {
    return this.client.getClientType();
  }

  /**
   * 获取当前配置
   */
  public getCurrentConfig(): CodeWhispererStreamingConfig {
    return this.configManager.getConfig();
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<CodeWhispererStreamingConfig>): void {
    this.configManager.updateConfig(newConfig);
    
    // 重新创建客户端以应用新配置
    const updatedConfig = this.configManager.getConfig();
    this.client = CodeWhispererClientFactory.createClient(updatedConfig);
    
    logger.info('CodeWhisperer主客户端配置已更新', {
      newConfig: updatedConfig,
      clientType: this.client.getClientType(),
    });
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    type: string;
    message?: string;
    implementation: string;
    config?: CodeWhispererStreamingConfig;
  }> {
    try {
      const clientHealth = await this.client.healthCheck();
      const config = this.configManager.getConfig();
      
      return {
        ...clientHealth,
        implementation: config.implementation,
        config,
      };
    } catch (error) {
      const config = this.configManager.getConfig();
      
      return {
        healthy: false,
        type: this.client.getClientType(),
        implementation: config.implementation,
        config,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取性能报告
   */
  public getPerformanceReport() {
    return this.metrics.getAggregatedReport();
  }

  /**
   * 获取实现对比报告
   */
  public getImplementationComparison() {
    return this.metrics.compareImplementations();
  }

  /**
   * 重置性能指标
   */
  public resetPerformanceMetrics(): void {
    this.metrics.resetAggregatedMetrics();
    logger.info('CodeWhisperer性能指标已重置');
  }

  /**
   * 判断是否需要故障转移
   */
  private shouldFallback(config: CodeWhispererStreamingConfig): boolean {
    return (
      config.fallback.enableFallback &&
      this.failureCount >= this.maxFailuresBeforeFallback &&
      config.fallback.fallbackToBuffered &&
      config.implementation === 'realtime'
    );
  }

  /**
   * 处理流式请求故障转移
   */
  private async handleFallback(
    error: any,
    onError: (message: string, error: Error) => void
  ): Promise<void> {
    logger.warn('CodeWhisperer实时客户端失败，尝试故障转移', {
      failureCount: this.failureCount,
      maxFailuresBeforeFallback: this.maxFailuresBeforeFallback,
      error: error instanceof Error ? error.message : String(error),
    });

    try {
      // 切换到缓冲式实现
      this.switchImplementation('buffered');
      
      // 重新执行请求
      await this.client.handleStreamRequest(
        (error as any).anthropicReq || {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'fallback request' }],
          stream: true,
        },
        (event: string, data: any) => {}, // writeSSE
        (message: string, error: Error) => {} // onError
      );
      
      logger.info('CodeWhisperer故障转移成功');
      
    } catch (fallbackError) {
      logger.error('CodeWhisperer故障转移失败', {
        fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        originalError: error instanceof Error ? error.message : String(error),
      });
      
      onError(
        `CodeWhisperer实时客户端失败且故障转移也失败: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
        fallbackError as Error
      );
    }
  }

  /**
   * 处理非流式请求故障转移
   */
  private async handleNonStreamFallback(error: any): Promise<any> {
    logger.warn('CodeWhisperer实时非流式客户端失败，尝试故障转移', {
      failureCount: this.failureCount,
      maxFailuresBeforeFallback: this.maxFailuresBeforeFallback,
      error: error instanceof Error ? error.message : String(error),
    });

    try {
      // 切换到缓冲式实现
      this.switchImplementation('buffered');
      
      // 重新执行请求
      const result = await this.client.handleNonStreamRequest(
        (error as any).anthropicReq || {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'fallback request' }],
          stream: false,
        }
      );
      
      logger.info('CodeWhisperer非流式故障转移成功');
      return result;
      
    } catch (fallbackError) {
      logger.error('CodeWhisperer非流式故障转移失败', {
        fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        originalError: error instanceof Error ? error.message : String(error),
      });
      
      throw fallbackError;
    }
  }

  /**
   * 设置配置变更监听器
   */
  private setupConfigChangeListener(): void {
    this.configChangeListener = (config: CodeWhispererStreamingConfig) => {
      logger.info('检测到CodeWhisperer配置变更', {
        newImplementation: config.implementation,
        configChange: true,
      });
      
      try {
        // 创建新的客户端实例
        const newClient = CodeWhispererClientFactory.createClient(config);
        
        // 健康检查
        newClient.healthCheck().then(healthCheck => {
          if (healthCheck.healthy) {
            // 替换客户端
            this.client = newClient;
            logger.info('配置变更后客户端更新成功', {
              implementation: config.implementation,
              clientType: this.client.getClientType(),
            });
          } else {
            logger.warn('配置变更后新客户端健康检查失败，保持原客户端', {
              implementation: config.implementation,
              healthCheck,
            });
          }
        }).catch(healthError => {
          logger.error('配置变更后新客户端健康检查失败', {
            implementation: config.implementation,
            error: healthError instanceof Error ? healthError.message : String(healthError),
          });
        });
      } catch (clientError) {
        logger.error('配置变更后客户端创建失败', {
          implementation: config.implementation,
          error: clientError instanceof Error ? clientError.message : String(clientError),
        });
      }
    };
    
    // 添加监听器
    this.configManager.addConfigChangeListener(this.configChangeListener);
  }

  /**
   * 销毁客户端
   */
  public destroy(): void {
    // 移除配置监听器
    if (this.configChangeListener) {
      this.configManager.removeConfigChangeListener(this.configChangeListener);
    }
    
    // 销毁性能监控器
    this.metrics.destroy();
    
    logger.info('CodeWhisperer主客户端已销毁');
  }
}

// 向后兼容的默认导出
export default CodeWhispererClient;