/**
 * 统一转换OpenAI Provider工厂
 * 替换现有的各种OpenAI provider实现，统一使用UnifiedConversionOpenAIClient
 * Project owner: Jason Zhang
 */

import { Provider, ProviderConfig } from '@/types';
import { UnifiedConversionOpenAIClient } from './unified-conversion-client';
import { logger } from '@/utils/logger';

export interface UnifiedProviderFactoryConfig {
  enableUnifiedConversion: boolean;
  fallbackToLegacyClient: boolean;
  debugTransformationPipeline: boolean;
  port?: number;
}

export class UnifiedOpenAIProviderFactory {
  private static defaultConfig: UnifiedProviderFactoryConfig = {
    enableUnifiedConversion: process.env.RCC_UNIFIED_CONVERSION !== 'false',
    fallbackToLegacyClient: process.env.RCC_FALLBACK_LEGACY === 'true',
    debugTransformationPipeline: process.env.RCC_DEBUG_PIPELINE === 'true',
    port: undefined
  };

  /**
   * 创建统一转换OpenAI Provider
   */
  static createProvider(
    config: ProviderConfig, 
    providerId: string, 
    factoryConfig?: Partial<UnifiedProviderFactoryConfig>
  ): Provider {
    const finalConfig = { ...this.defaultConfig, ...factoryConfig };
    
    if (!finalConfig.enableUnifiedConversion) {
      logger.warn('Unified conversion disabled, falling back to legacy client', {
        providerId,
        reason: 'feature_disabled'
      });
      return this.createLegacyProvider(config, providerId);
    }

    try {
      logger.info('🔄 Creating unified conversion OpenAI provider', {
        providerId,
        endpoint: config.endpoint,
        hasAuth: !!config.authentication.credentials,
        unifiedConversion: true
      });

      return new UnifiedConversionOpenAIClient(config, providerId, finalConfig.port);
      
    } catch (error) {
      logger.error('Failed to create unified conversion provider, falling back to legacy', {
        providerId,
        error: error instanceof Error ? error.message : String(error),
        fallbackEnabled: finalConfig.fallbackToLegacyClient
      });

      if (finalConfig.fallbackToLegacyClient) {
        return this.createLegacyProvider(config, providerId);
      } else {
        throw error;
      }
    }
  }

  /**
   * 批量创建多个provider
   */
  static createProviders(
    configs: { config: ProviderConfig; providerId: string }[],
    factoryConfig?: Partial<UnifiedProviderFactoryConfig>
  ): Provider[] {
    return configs.map(({ config, providerId }) => 
      this.createProvider(config, providerId, factoryConfig)
    );
  }

  /**
   * 获取支持的provider类型
   */
  static getSupportedTypes(): string[] {
    return [
      'openai',
      'openai-compatible',
      'modelscope',
      'lmstudio',
      'shuaihong',
      'huggingface'
    ];
  }

  /**
   * 检查是否支持统一转换
   */
  static supportsUnifiedConversion(providerType: string): boolean {
    return this.getSupportedTypes().includes(providerType.toLowerCase());
  }

  /**
   * 创建传统provider（fallback）
   */
  private static createLegacyProvider(config: ProviderConfig, providerId: string): Provider {
    // 动态导入传统client，避免循环依赖
    try {
      const { OpenAICompatibleClient } = require('./client');
      return new OpenAICompatibleClient(config, providerId);
    } catch (error) {
      logger.error('Failed to create legacy provider', {
        providerId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`Cannot create provider ${providerId}: both unified and legacy clients failed`);
    }
  }

  /**
   * 验证provider配置
   */
  static validateProviderConfig(config: ProviderConfig, providerId: string): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!config.endpoint) {
      issues.push('Missing endpoint configuration');
    }

    if (config.authentication.type !== 'none' && !config.authentication.credentials?.apiKey) {
      issues.push('Missing API key for authenticated provider');
    }

    try {
      new URL(config.endpoint);
    } catch {
      issues.push('Invalid endpoint URL format');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * 获取统一转换统计信息
   */
  static getConversionStats(): {
    unifiedProviders: number;
    legacyProviders: number;
    totalProviders: number;
    conversionRate: number;
  } {
    // 这里可以实现统计逻辑
    // 暂时返回模拟数据
    return {
      unifiedProviders: 0,
      legacyProviders: 0,
      totalProviders: 0,
      conversionRate: 0
    };
  }
}

/**
 * 便捷创建函数
 */
export function createUnifiedOpenAIProvider(
  config: ProviderConfig, 
  providerId: string,
  port?: number
): Provider {
  return UnifiedOpenAIProviderFactory.createProvider(config, providerId, { port });
}

/**
 * 检查是否应该使用统一转换
 */
export function shouldUseUnifiedConversion(): boolean {
  return process.env.RCC_UNIFIED_CONVERSION !== 'false';
}