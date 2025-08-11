/**
 * CodeWhisperer 配置迁移工具
 * 确保从传统配置到增强配置的平滑迁移
 * 项目所有者: Jason Zhang
 */

import * as path from 'path';
import * as os from 'os';
import { logger } from '@/utils/logger';
import { 
  KiroAuthConfig, 
  CredentialSource, 
  AuthMethod, 
  DEFAULT_CREDENTIAL_CONFIG,
  DEFAULT_REGION_CONFIG,
  DEFAULT_RETRY_CONFIG,
  KIRO_AUTH_TOKEN_FILE
} from './enhanced-auth-config';

export interface LegacyCodeWhispererConfig {
  // 传统配置格式
  tokenPath?: string;
  region?: string;
  profileArn?: string;
  refreshUrl?: string;
  timeout?: number;
  maxRetries?: number;
  enableDebug?: boolean;
}

export class CodeWhispererConfigMigrator {
  /**
   * 从传统配置迁移到增强配置
   */
  public static migrateFromLegacy(legacyConfig?: LegacyCodeWhispererConfig): KiroAuthConfig {
    if (!legacyConfig) {
      return this.getDefaultEnhancedConfig();
    }

    logger.info('Migrating CodeWhisperer configuration from legacy format', {
      hasTokenPath: !!legacyConfig.tokenPath,
      region: legacyConfig.region,
      timeout: legacyConfig.timeout,
      maxRetries: legacyConfig.maxRetries
    });

    // 构建增强配置
    const enhancedConfig: KiroAuthConfig = {
      credentials: {
        ...DEFAULT_CREDENTIAL_CONFIG,
        // 如果指定了 tokenPath，优先使用文件路径源
        credsFilePath: legacyConfig.tokenPath,
        priorityOrder: legacyConfig.tokenPath 
          ? [CredentialSource.FILE_PATH, CredentialSource.DEFAULT_PATH, CredentialSource.DIRECTORY_SCAN]
          : DEFAULT_CREDENTIAL_CONFIG.priorityOrder
      },
      region: {
        ...DEFAULT_REGION_CONFIG,
        region: legacyConfig.region || DEFAULT_REGION_CONFIG.region,
        refreshUrl: legacyConfig.refreshUrl || DEFAULT_REGION_CONFIG.refreshUrl
      },
      retry: {
        ...DEFAULT_RETRY_CONFIG,
        maxRetries: legacyConfig.maxRetries || DEFAULT_RETRY_CONFIG.maxRetries,
        timeoutMs: legacyConfig.timeout || DEFAULT_RETRY_CONFIG.timeoutMs
      },
      authMethod: AuthMethod.SOCIAL, // 默认使用 Social 认证
      enableDebugLog: legacyConfig.enableDebug || false,
      userAgent: 'CodeWhisperer-Router/2.7.0'
    };

    logger.info('Configuration migration completed', {
      credentialSources: enhancedConfig.credentials.priorityOrder,
      region: enhancedConfig.region?.region,
      retryConfig: enhancedConfig.retry,
      authMethod: enhancedConfig.authMethod
    });

    return enhancedConfig;
  }

  /**
   * 自动检测现有配置并迁移
   */
  public static autoMigrateFromEnvironment(): KiroAuthConfig {
    logger.info('Auto-detecting existing CodeWhisperer configuration');

    const detectedConfig: LegacyCodeWhispererConfig = {};

    // 检测环境变量
    if (process.env.CODEWHISPERER_TOKEN_PATH) {
      detectedConfig.tokenPath = process.env.CODEWHISPERER_TOKEN_PATH;
    }
    
    if (process.env.CODEWHISPERER_REGION) {
      detectedConfig.region = process.env.CODEWHISPERER_REGION;
    }

    if (process.env.CODEWHISPERER_TIMEOUT) {
      detectedConfig.timeout = parseInt(process.env.CODEWHISPERER_TIMEOUT, 10);
    }

    if (process.env.CODEWHISPERER_MAX_RETRIES) {
      detectedConfig.maxRetries = parseInt(process.env.CODEWHISPERER_MAX_RETRIES, 10);
    }

    if (process.env.CODEWHISPERER_DEBUG) {
      detectedConfig.enableDebug = process.env.CODEWHISPERER_DEBUG === 'true';
    }

    // 检测默认 token 文件位置
    const defaultTokenPath = path.join(os.homedir(), '.aws', 'sso', 'cache', KIRO_AUTH_TOKEN_FILE);
    if (!detectedConfig.tokenPath) {
      detectedConfig.tokenPath = defaultTokenPath;
    }

    logger.info('Environment detection completed', {
      detectedTokenPath: detectedConfig.tokenPath,
      detectedRegion: detectedConfig.region,
      detectedTimeout: detectedConfig.timeout,
      detectedMaxRetries: detectedConfig.maxRetries,
      detectedDebug: detectedConfig.enableDebug
    });

    return this.migrateFromLegacy(detectedConfig);
  }

  /**
   * 创建基于多源凭据的配置
   */
  public static createMultiSourceConfig(options: {
    base64Creds?: string;
    credsFilePath?: string;
    credsDirPath?: string;
    region?: string;
    authMethod?: AuthMethod;
    enableDebugLog?: boolean;
  }): KiroAuthConfig {
    logger.info('Creating multi-source CodeWhisperer configuration', {
      hasBase64Creds: !!options.base64Creds,
      hasCredsFilePath: !!options.credsFilePath,
      hasCredsDirPath: !!options.credsDirPath,
      region: options.region,
      authMethod: options.authMethod
    });

    // 根据提供的选项确定优先级顺序
    const priorityOrder: CredentialSource[] = [];
    
    if (options.base64Creds) {
      priorityOrder.push(CredentialSource.BASE64);
    }
    
    if (options.credsFilePath) {
      priorityOrder.push(CredentialSource.FILE_PATH);
    }
    
    if (options.credsDirPath) {
      priorityOrder.push(CredentialSource.DIRECTORY_SCAN);
    }
    
    // 始终包含环境变量和默认路径作为后备
    priorityOrder.push(CredentialSource.ENVIRONMENT, CredentialSource.DEFAULT_PATH);

    const config: KiroAuthConfig = {
      credentials: {
        ...DEFAULT_CREDENTIAL_CONFIG,
        base64Creds: options.base64Creds,
        credsFilePath: options.credsFilePath,
        credsDirPath: options.credsDirPath,
        priorityOrder
      },
      region: {
        ...DEFAULT_REGION_CONFIG,
        region: options.region || DEFAULT_REGION_CONFIG.region
      },
      retry: DEFAULT_RETRY_CONFIG,
      authMethod: options.authMethod || AuthMethod.SOCIAL,
      enableDebugLog: options.enableDebugLog || false,
      userAgent: 'CodeWhisperer-Router/2.7.0'
    };

    logger.info('Multi-source configuration created', {
      priorityOrder: config.credentials.priorityOrder,
      region: config.region?.region,
      authMethod: config.authMethod
    });

    return config;
  }

  /**
   * 获取默认增强配置
   */
  public static getDefaultEnhancedConfig(): KiroAuthConfig {
    logger.info('Creating default enhanced CodeWhisperer configuration');

    return {
      credentials: DEFAULT_CREDENTIAL_CONFIG,
      region: DEFAULT_REGION_CONFIG,
      retry: DEFAULT_RETRY_CONFIG,
      authMethod: AuthMethod.SOCIAL,
      enableDebugLog: false,
      userAgent: 'CodeWhisperer-Router/2.7.0'
    };
  }

  /**
   * 验证配置有效性
   */
  public static validateConfig(config: KiroAuthConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证凭据配置
    if (!config.credentials) {
      errors.push('Credentials configuration is required');
    } else {
      if (!config.credentials.priorityOrder || config.credentials.priorityOrder.length === 0) {
        errors.push('At least one credential source must be specified');
      }
    }

    // 验证区域配置
    if (!config.region?.region) {
      errors.push('Region is required');
    }

    // 验证重试配置
    if (config.retry) {
      if (config.retry.maxRetries < 0) {
        errors.push('Max retries cannot be negative');
      }
      if (config.retry.baseDelay < 0) {
        errors.push('Base delay cannot be negative');
      }
      if (config.retry.timeoutMs < 1000) {
        errors.push('Timeout must be at least 1000ms');
      }
    }

    // 验证认证方法
    if (config.authMethod && !Object.values(AuthMethod).includes(config.authMethod)) {
      errors.push('Invalid authentication method');
    }

    const isValid = errors.length === 0;

    if (isValid) {
      logger.info('Configuration validation passed');
    } else {
      logger.error('Configuration validation failed', { errors });
    }

    return { isValid, errors };
  }

  /**
   * 比较两个配置的差异
   */
  public static compareConfigs(oldConfig: KiroAuthConfig, newConfig: KiroAuthConfig): {
    hasChanges: boolean;
    changes: string[];
  } {
    const changes: string[] = [];

    // 比较凭据配置
    if (JSON.stringify(oldConfig.credentials) !== JSON.stringify(newConfig.credentials)) {
      changes.push('credentials configuration changed');
    }

    // 比较区域配置
    if (oldConfig.region?.region !== newConfig.region?.region) {
      changes.push(`region changed from ${oldConfig.region?.region} to ${newConfig.region?.region}`);
    }

    // 比较重试配置
    if (JSON.stringify(oldConfig.retry) !== JSON.stringify(newConfig.retry)) {
      changes.push('retry configuration changed');
    }

    // 比较认证方法
    if (oldConfig.authMethod !== newConfig.authMethod) {
      changes.push(`auth method changed from ${oldConfig.authMethod} to ${newConfig.authMethod}`);
    }

    // 比较调试设置
    if (oldConfig.enableDebugLog !== newConfig.enableDebugLog) {
      changes.push(`debug logging ${newConfig.enableDebugLog ? 'enabled' : 'disabled'}`);
    }

    const hasChanges = changes.length > 0;

    logger.info('Configuration comparison completed', {
      hasChanges,
      changeCount: changes.length,
      changes: hasChanges ? changes : 'no changes detected'
    });

    return { hasChanges, changes };
  }
}