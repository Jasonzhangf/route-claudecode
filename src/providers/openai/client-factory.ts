/**
 * OpenAI Client Factory - 平滑切换管理器
 * 在Enhanced Client和SDK Client之间提供平滑切换
 * 
 * 设计目标:
 * 1. 统一的客户端创建接口
 * 2. 基于配置的自动选择
 * 3. 运行时切换支持
 * 4. 向后兼容性保证
 */

import { Provider, ProviderConfig } from '@/types';
import { logger } from '@/utils/logger';
import { OpenAISDKClient, OpenAISDKConfig } from './sdk-client';
import { PureOpenAIClient, PureOpenAIConfig } from './pure-client';
// import { UnifiedOpenAIProviderFactory, shouldUseUnifiedConversion } from './unified-factory';

export interface OpenAIClientConfig extends ProviderConfig {
  // 客户端选择配置
  clientType?: 'pure' | 'sdk' | 'unified' | 'auto';
  
  // SDK特定配置
  sdkOptions?: {
    timeout?: number;
    maxRetries?: number;
    defaultHeaders?: Record<string, string>;
  };
  
  // 切换策略配置
  switchingStrategy?: {
    // 自动切换条件
    autoSwitch?: boolean;
    // 错误阈值（连续错误次数）
    errorThreshold?: number;
    // 性能阈值（响应时间ms）
    performanceThreshold?: number;
    // 切换冷却时间（ms）
    switchCooldown?: number;
  };
}

/**
 * 客户端类型枚举
 */
export enum ClientType {
  PURE = 'pure',
  SDK = 'sdk',
  UNIFIED = 'unified'
}

/**
 * 客户端性能统计
 */
interface ClientStats {
  requestCount: number;
  errorCount: number;
  consecutiveErrors: number;
  averageResponseTime: number;
  lastErrorTime?: Date;
  lastSwitchTime?: Date;
}

/**
 * OpenAI客户端工厂
 */
export class OpenAIClientFactory {
  private static clientStats: Map<string, ClientStats> = new Map();
  private static activeClients: Map<string, { client: Provider; type: ClientType }> = new Map();

  /**
   * 创建OpenAI客户端
   */
  static createClient(config: OpenAIClientConfig, providerId: string, globalConfig?: any): Provider {
    // 🎯 暂时禁用统一转换层直到修复完成
    // if (shouldUseUnifiedConversion()) {
    //   logger.info('🔄 Using unified conversion layer for OpenAI provider', {
    //     providerId,
    //     clientType: 'unified',
    //     reason: 'solve_duplicate_response_and_silent_stop'
    //   });
    //   return UnifiedOpenAIProviderFactory.createProvider(config, providerId, globalConfig?.port);
    // }

    const clientType = this.determineClientType(config, providerId);
    const client = this.instantiateClient(clientType, config, providerId, globalConfig);
    
    // 记录活跃客户端
    this.activeClients.set(providerId, { client, type: clientType });
    
    // 初始化统计
    if (!this.clientStats.has(providerId)) {
      this.clientStats.set(providerId, {
        requestCount: 0,
        errorCount: 0,
        consecutiveErrors: 0,
        averageResponseTime: 0
      });
    }

    logger.info('OpenAI client created', {
      providerId,
      clientType,
      autoSwitch: config.switchingStrategy?.autoSwitch || false,
      hasSDKOptions: !!config.sdkOptions
    });

    return this.wrapClientWithMonitoring(client, clientType, config, providerId);
  }

  /**
   * 确定客户端类型 - 优先使用统一转换层
   * 统一转换层解决重复响应和静默停止问题
   */
  private static determineClientType(config: OpenAIClientConfig, providerId: string): ClientType {
    // 暂时使用pure客户端，因为unified客户端被禁用
    const clientType = config.clientType || 'pure';
    
    if (clientType === 'unified') {
      logger.warn('Unified client disabled, falling back to pure client', { 
        providerId,
        originalType: 'unified',
        fallbackType: 'pure'
      });
      return ClientType.PURE;
    } else if (clientType === 'pure') {
      logger.debug('Selected Pure OpenAI client (legacy)', { 
        providerId,
        clientType: 'pure',
        reason: 'transformer-based architecture'
      });
      return ClientType.PURE;
    } else if (clientType === 'sdk') {
      logger.debug('Selected SDK OpenAI client (legacy)', { 
        providerId,
        clientType: 'sdk',
        reason: 'explicit configuration'
      });
      return ClientType.SDK;
    } else {
      // 默认使用pure客户端（unified客户端已禁用）
      logger.debug('Auto-selected Pure client (unified disabled)', { 
        providerId,
        originalClientType: clientType,
        selectedClientType: 'pure',
        reason: 'zero-cross-node-coupling-architecture'
      });
      return ClientType.PURE;
    }
  }

  /**
   * 实例化客户端
   */
  private static instantiateClient(
    clientType: ClientType, 
    config: OpenAIClientConfig, 
    providerId: string,
    globalConfig?: any
  ): Provider {
    switch (clientType) {
      case ClientType.UNIFIED:
        logger.debug('Creating Unified Conversion OpenAI client', {
          providerId,
          clientType: 'unified',
          architecture: 'unified-conversion-layer'
        });
        // return UnifiedOpenAIProviderFactory.createProvider(config, providerId, globalConfig?.port);
        throw new Error('Unified client temporarily disabled - use pure or sdk client');
        
      case ClientType.PURE:
        logger.debug('Creating Pure OpenAI client', {
          providerId,
          clientType: 'pure',
          architecture: 'transformer-based'
        });
        return new PureOpenAIClient(config as PureOpenAIConfig, providerId);
        
      case ClientType.SDK:
        logger.debug('Creating SDK OpenAI client', {
          providerId,
          clientType: 'sdk',
          architecture: 'legacy'
        });
        return new OpenAISDKClient(config as OpenAISDKConfig, providerId);
        
      default:
        throw new Error(`Unsupported client type: ${clientType} - violates zero fallback principle`);
    }
  }

  /**
   * 包装客户端以添加监控和自动切换功能
   */
  private static wrapClientWithMonitoring(
    client: Provider,
    clientType: ClientType,
    config: OpenAIClientConfig,
    providerId: string
  ): Provider {
    const originalSendRequest = client.sendRequest.bind(client);
    const originalSendStreamRequest = client.sendStreamRequest.bind(client);

    // 包装非流式请求
    client.sendRequest = async (request) => {
      const startTime = Date.now();
      const stats = this.clientStats.get(providerId)!;
      
      try {
        const response = await originalSendRequest(request);
        
        // 更新成功统计
        OpenAIClientFactory.updateSuccessStats(providerId, Date.now() - startTime);
        
        return response;
      } catch (error) {
        // 更新错误统计
        OpenAIClientFactory.updateErrorStats(providerId, error);
        
        // 检查是否需要切换客户端
        if (config.switchingStrategy?.autoSwitch) {
          await OpenAIClientFactory.checkAndSwitchClient(config, providerId, error);
        }
        
        throw error;
      }
    };

    // 包装流式请求
    client.sendStreamRequest = async function* (request: any) {
      const startTime = Date.now();
      
      try {
        for await (const chunk of originalSendStreamRequest(request)) {
          yield chunk;
        }
        
        // 更新成功统计
        OpenAIClientFactory.updateSuccessStats(providerId, Date.now() - startTime);
        
      } catch (error) {
        // 更新错误统计
        OpenAIClientFactory.updateErrorStats(providerId, error);
        
        // 检查是否需要切换客户端
        if (config.switchingStrategy?.autoSwitch) {
          await OpenAIClientFactory.checkAndSwitchClient(config, providerId, error);
        }
        
        throw error;
      }
    }.bind(this);

    return client;
  }

  /**
   * 更新成功统计
   */
  private static updateSuccessStats(providerId: string, responseTime: number): void {
    const stats = this.clientStats.get(providerId);
    if (!stats) return;

    stats.requestCount++;
    stats.consecutiveErrors = 0;
    
    // 更新平均响应时间
    stats.averageResponseTime = (
      (stats.averageResponseTime * (stats.requestCount - 1)) + responseTime
    ) / stats.requestCount;
  }

  /**
   * 更新错误统计
   */
  private static updateErrorStats(providerId: string, error: any): void {
    const stats = this.clientStats.get(providerId);
    if (!stats) return;

    stats.requestCount++;
    stats.errorCount++;
    stats.consecutiveErrors++;
    stats.lastErrorTime = new Date();

    logger.warn('Client error recorded', {
      providerId,
      errorCount: stats.errorCount,
      consecutiveErrors: stats.consecutiveErrors,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  /**
   * 检查并切换客户端
   */
  private static async checkAndSwitchClient(
    config: OpenAIClientConfig,
    providerId: string,
    error: any
  ): Promise<void> {
    const stats = this.clientStats.get(providerId);
    const activeClient = this.activeClients.get(providerId);
    
    if (!stats || !activeClient) return;

    const strategy = config.switchingStrategy!;
    const errorThreshold = strategy.errorThreshold || 3;
    const switchCooldown = strategy.switchCooldown || 60000; // 1分钟

    // 检查冷却时间
    if (stats.lastSwitchTime) {
      const timeSinceLastSwitch = Date.now() - stats.lastSwitchTime.getTime();
      if (timeSinceLastSwitch < switchCooldown) {
        return;
      }
    }

    // 检查是否达到切换条件
    const shouldSwitch = stats.consecutiveErrors >= errorThreshold;
    
    if (shouldSwitch) {
      const currentType = activeClient.type;
      const newType = currentType === ClientType.PURE ? ClientType.SDK : ClientType.PURE;
      
      logger.warn('Switching OpenAI client due to consecutive errors', {
        providerId,
        fromType: currentType,
        toType: newType,
        consecutiveErrors: stats.consecutiveErrors,
        errorThreshold
      });

      try {
        // 创建新客户端
        const newClient = this.instantiateClient(newType, config, providerId);
        
        // 更新活跃客户端
        this.activeClients.set(providerId, { client: newClient, type: newType });
        
        // 重置统计
        stats.consecutiveErrors = 0;
        stats.lastSwitchTime = new Date();
        
        logger.info('OpenAI client switched successfully', {
          providerId,
          newType,
          resetStats: true
        });
        
      } catch (switchError) {
        logger.error('Failed to switch OpenAI client', {
          providerId,
          targetType: newType,
          error: switchError instanceof Error ? switchError.message : String(switchError)
        });
      }
    }
  }

  /**
   * 获取客户端统计信息
   */
  static getClientStats(providerId: string): ClientStats | undefined {
    return this.clientStats.get(providerId);
  }

  /**
   * 获取活跃客户端信息
   */
  static getActiveClientInfo(providerId: string): { type: ClientType; stats: ClientStats } | undefined {
    const activeClient = this.activeClients.get(providerId);
    const stats = this.clientStats.get(providerId);
    
    if (!activeClient || !stats) return undefined;
    
    return {
      type: activeClient.type,
      stats
    };
  }

  /**
   * 手动切换客户端
   */
  static async switchClient(
    providerId: string,
    targetType: ClientType,
    config: OpenAIClientConfig
  ): Promise<boolean> {
    const activeClient = this.activeClients.get(providerId);
    if (!activeClient) {
      logger.error('Cannot switch client: provider not found', { providerId });
      return false;
    }

    if (activeClient.type === targetType) {
      logger.info('Client already using target type', { providerId, targetType });
      return true;
    }

    try {
      // 创建新客户端
      const newClient = this.instantiateClient(targetType, config, providerId);
      
      // 更新活跃客户端
      this.activeClients.set(providerId, { client: newClient, type: targetType });
      
      // 更新统计
      const stats = this.clientStats.get(providerId);
      if (stats) {
        stats.lastSwitchTime = new Date();
        stats.consecutiveErrors = 0;
      }
      
      logger.info('OpenAI client manually switched', {
        providerId,
        fromType: activeClient.type,
        toType: targetType
      });
      
      return true;
      
    } catch (error) {
      logger.error('Failed to manually switch OpenAI client', {
        providerId,
        targetType,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }

  /**
   * 获取所有客户端状态
   */
  static getAllClientStatus(): Record<string, { type: ClientType; stats: ClientStats }> {
    const status: Record<string, { type: ClientType; stats: ClientStats }> = {};
    
    for (const [providerId, activeClient] of this.activeClients.entries()) {
      const stats = this.clientStats.get(providerId);
      if (stats) {
        status[providerId] = {
          type: activeClient.type,
          stats
        };
      }
    }
    
    return status;
  }
}

/**
 * 便捷函数：创建OpenAI客户端
 */
export function createOpenAIClient(config: OpenAIClientConfig, providerId: string, globalConfig?: any): Provider {
  return OpenAIClientFactory.createClient(config, providerId, globalConfig);
}