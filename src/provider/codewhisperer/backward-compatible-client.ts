/**
 * CodeWhisperer 向后兼容客户端
 * 保持现有 API 接口不变，内部使用增强功能
 * 确保平滑升级和无缝迁移
 * 项目所有者: Jason Zhang
 */

import { logger } from '@/utils/logger';
import { EnhancedCodeWhispererClient } from './enhanced-client';
import { CodeWhispererConfigMigrator, LegacyCodeWhispererConfig } from './config-migration';
import { ICodeWhispererClient } from './client-interface';
import { AnthropicRequest } from './types';
import { KiroAuthConfig } from './enhanced-auth-config';

export class BackwardCompatibleCodeWhispererClient implements ICodeWhispererClient {
  private enhancedClient: EnhancedCodeWhispererClient;
  private migrationApplied: boolean = false;

  constructor(legacyConfig?: LegacyCodeWhispererConfig) {
    // 自动迁移配置
    const enhancedConfig = legacyConfig 
      ? CodeWhispererConfigMigrator.migrateFromLegacy(legacyConfig)
      : CodeWhispererConfigMigrator.autoMigrateFromEnvironment();

    // 验证配置
    const validation = CodeWhispererConfigMigrator.validateConfig(enhancedConfig);
    if (!validation.isValid) {
      logger.warn('Configuration validation warnings', { errors: validation.errors });
      // 使用默认配置作为后备
      const defaultConfig = CodeWhispererConfigMigrator.getDefaultEnhancedConfig();
      this.enhancedClient = new EnhancedCodeWhispererClient(defaultConfig);
    } else {
      this.enhancedClient = new EnhancedCodeWhispererClient(enhancedConfig);
    }

    this.migrationApplied = !!legacyConfig;

    logger.info('Backward compatible CodeWhisperer client initialized', {
      migrationApplied: this.migrationApplied,
      clientType: this.enhancedClient.getClientType(),
      configValidation: validation.isValid
    });
  }

  /**
   * 处理流式请求 - 保持原有接口
   */
  public async handleStreamRequest(
    anthropicReq: AnthropicRequest,
    writeSSE: (event: string, data: any) => void,
    onError: (message: string, error: Error) => void
  ): Promise<void> {
    // 直接委托给增强客户端
    return this.enhancedClient.handleStreamRequest(anthropicReq, writeSSE, onError);
  }

  /**
   * 处理非流式请求 - 保持原有接口
   */
  public async handleNonStreamRequest(anthropicReq: AnthropicRequest): Promise<any> {
    // 直接委托给增强客户端
    return this.enhancedClient.handleNonStreamRequest(anthropicReq);
  }

  /**
   * 健康检查 - 保持原有接口
   */
  public async healthCheck(): Promise<{ healthy: boolean; type: string; message?: string }> {
    return this.enhancedClient.healthCheck();
  }

  /**
   * 获取客户端类型 - 保持原有接口
   */
  public getClientType(): 'buffered' | 'realtime' {
    return this.enhancedClient.getClientType();
  }

  /**
   * 更新配置 - 支持传统配置格式
   */
  public updateLegacyConfig(legacyConfig: LegacyCodeWhispererConfig): void {
    const enhancedConfig = CodeWhispererConfigMigrator.migrateFromLegacy(legacyConfig);
    
    // 验证新配置
    const validation = CodeWhispererConfigMigrator.validateConfig(enhancedConfig);
    if (!validation.isValid) {
      logger.error('Invalid configuration provided', { errors: validation.errors });
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    this.enhancedClient.updateConfig(enhancedConfig);
    
    logger.info('Legacy configuration updated successfully', {
      configSource: 'legacy',
      validationPassed: true
    });
  }

  /**
   * 更新增强配置 - 支持新配置格式
   */
  public updateEnhancedConfig(enhancedConfig: Partial<KiroAuthConfig>): void {
    // 获取当前配置并合并
    const currentConfig = this.enhancedClient.getConfig();
    const mergedConfig: KiroAuthConfig = {
      credentials: { ...currentConfig.credentials, ...enhancedConfig.credentials },
      region: {
        region: enhancedConfig.region?.region || currentConfig.region?.region || 'us-east-1',
        refreshUrl: enhancedConfig.region?.refreshUrl || currentConfig.region?.refreshUrl,
        refreshIDCUrl: enhancedConfig.region?.refreshIDCUrl || currentConfig.region?.refreshIDCUrl,
        baseUrl: enhancedConfig.region?.baseUrl || currentConfig.region?.baseUrl,
        amazonQUrl: enhancedConfig.region?.amazonQUrl || currentConfig.region?.amazonQUrl
      },
      retry: {
        maxRetries: enhancedConfig.retry?.maxRetries || currentConfig.retry?.maxRetries || 3,
        baseDelay: enhancedConfig.retry?.baseDelay || currentConfig.retry?.baseDelay || 1000,
        backoffMultiplier: enhancedConfig.retry?.backoffMultiplier || currentConfig.retry?.backoffMultiplier || 2,
        retryableStatuses: enhancedConfig.retry?.retryableStatuses || currentConfig.retry?.retryableStatuses || [429, 500, 502, 503, 504],
        timeoutMs: enhancedConfig.retry?.timeoutMs || currentConfig.retry?.timeoutMs || 120000
      },
      authMethod: enhancedConfig.authMethod || currentConfig.authMethod,
      userAgent: enhancedConfig.userAgent || currentConfig.userAgent,
      enableDebugLog: enhancedConfig.enableDebugLog !== undefined 
        ? enhancedConfig.enableDebugLog 
        : currentConfig.enableDebugLog
    };

    // 验证合并后的配置
    const validation = CodeWhispererConfigMigrator.validateConfig(mergedConfig);
    if (!validation.isValid) {
      logger.error('Invalid enhanced configuration provided', { errors: validation.errors });
      throw new Error(`Enhanced configuration validation failed: ${validation.errors.join(', ')}`);
    }

    this.enhancedClient.updateConfig(mergedConfig);
    
    logger.info('Enhanced configuration updated successfully', {
      configSource: 'enhanced',
      validationPassed: true
    });
  }

  /**
   * 获取当前配置（增强格式）
   */
  public getEnhancedConfig(): KiroAuthConfig {
    return this.enhancedClient.getConfig();
  }

  /**
   * 获取迁移状态
   */
  public getMigrationStatus(): {
    migrationApplied: boolean;
    clientType: string;
    configValid: boolean;
  } {
    const config = this.enhancedClient.getConfig();
    const validation = CodeWhispererConfigMigrator.validateConfig(config);

    return {
      migrationApplied: this.migrationApplied,
      clientType: this.getClientType(),
      configValid: validation.isValid
    };
  }

  /**
   * 重置为默认配置
   */
  public resetToDefaults(): void {
    const defaultConfig = CodeWhispererConfigMigrator.getDefaultEnhancedConfig();
    this.enhancedClient.updateConfig(defaultConfig);
    this.migrationApplied = false;

    logger.info('Configuration reset to defaults completed');
  }

  /**
   * 诊断配置问题
   */
  public diagnoseConfiguration(): {
    status: 'healthy' | 'warning' | 'error';
    issues: string[];
    recommendations: string[];
  } {
    const config = this.enhancedClient.getConfig();
    const validation = CodeWhispererConfigMigrator.validateConfig(config);
    
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 检查配置有效性
    if (!validation.isValid) {
      issues.push(...validation.errors);
      recommendations.push('Fix configuration validation errors');
    }

    // 检查凭据源配置
    if (!config.credentials.priorityOrder || config.credentials.priorityOrder.length === 0) {
      issues.push('No credential sources configured');
      recommendations.push('Configure at least one credential source');
    }

    // 检查重试配置合理性
    if (config.retry && config.retry.maxRetries > 10) {
      issues.push('Max retries set too high');
      recommendations.push('Consider reducing max retries to avoid excessive delays');
    }

    // 检查超时配置
    if (config.retry && config.retry.timeoutMs < 30000) {
      issues.push('Timeout may be too short for CodeWhisperer API');
      recommendations.push('Consider increasing timeout to at least 30 seconds');
    }

    // 确定状态
    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    if (issues.length > 0) {
      status = validation.isValid ? 'warning' : 'error';
    }

    logger.info('Configuration diagnosis completed', {
      status,
      issueCount: issues.length,
      recommendationCount: recommendations.length
    });

    return { status, issues, recommendations };
  }

  /**
   * 获取内部增强客户端（用于高级用例）
   */
  public getEnhancedClient(): EnhancedCodeWhispererClient {
    logger.debug('Providing access to enhanced client');
    return this.enhancedClient;
  }
}