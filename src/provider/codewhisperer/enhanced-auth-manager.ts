/**
 * CodeWhisperer 增强认证管理器
 * 整合多源凭据管理和智能重试机制
 * 基于 AIClient-2-API 的优秀架构设计
 * 项目所有者: Jason Zhang
 */

import * as path from 'path';
import * as os from 'os';
import axios, { AxiosResponse } from 'axios';
import { logger } from '@/utils/logger';
import { CredentialManager } from './credential-manager';
import { RetryManager, RetryableError } from './retry-manager';
import { 
  TokenData, 
  KiroAuthConfig, 
  RegionConfig, 
  AuthMethod,
  DEFAULT_REGION_CONFIG,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CREDENTIAL_CONFIG,
  KIRO_AUTH_TOKEN_FILE
} from './enhanced-auth-config';

export interface RefreshRequest {
  refreshToken: string;
  clientId?: string;
  clientSecret?: string;
  grantType?: string;
}

export interface RefreshResponse extends TokenData {}

export class EnhancedCodeWhispererAuth {
  private static instance: EnhancedCodeWhispererAuth;
  private tokenCache: TokenData | null = null;
  private lastTokenRead: number = 0;
  private readonly TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  private credentialManager: CredentialManager;
  private retryManager: RetryManager;
  private config: KiroAuthConfig;

  private constructor(config: Partial<KiroAuthConfig> = {}) {
    // 合并默认配置
    this.config = {
      credentials: { ...DEFAULT_CREDENTIAL_CONFIG, ...config.credentials },
      region: { ...DEFAULT_REGION_CONFIG, ...config.region },
      retry: { ...DEFAULT_RETRY_CONFIG, ...config.retry },
      authMethod: config.authMethod || AuthMethod.SOCIAL,
      userAgent: config.userAgent || 'CodeWhisperer-Router/2.7.0',
      enableDebugLog: config.enableDebugLog || false
    };

    // 初始化管理器
    this.credentialManager = new CredentialManager(this.config.credentials, logger);
    this.retryManager = new RetryManager(this.config.retry, logger);

    this.log('info', 'Enhanced CodeWhisperer Auth initialized', {
      region: this.config.region?.region,
      authMethod: this.config.authMethod,
      credentialSources: this.config.credentials.priorityOrder
    });
  }

  public static getInstance(config?: Partial<KiroAuthConfig>): EnhancedCodeWhispererAuth {
    if (!EnhancedCodeWhispererAuth.instance) {
      EnhancedCodeWhispererAuth.instance = new EnhancedCodeWhispererAuth(config);
    }
    return EnhancedCodeWhispererAuth.instance;
  }

  /**
   * 重新初始化实例（用于配置更新）
   */
  public static reinitialize(config: Partial<KiroAuthConfig>): EnhancedCodeWhispererAuth {
    EnhancedCodeWhispererAuth.instance = new EnhancedCodeWhispererAuth(config);
    return EnhancedCodeWhispererAuth.instance;
  }

  /**
   * 获取访问令牌
   */
  public async getToken(): Promise<string> {
    return this.retryManager.executeWithRetry(async () => {
      // 检查缓存是否有效
      const now = Date.now();
      if (this.tokenCache && (now - this.lastTokenRead) < this.TOKEN_CACHE_TTL) {
        return this.tokenCache.accessToken;
      }

      // 从多源加载凭据
      const credentials = await this.credentialManager.loadCredentials();
      if (!credentials) {
        throw new Error('无法从任何配置源加载凭据。请检查配置或安装 Kiro 并登录！');
      }

      if (!credentials.accessToken) {
        throw new Error('凭据中缺少 accessToken');
      }

      // 更新缓存
      this.tokenCache = credentials;
      this.lastTokenRead = now;

      this.log('debug', 'Token loaded successfully', {
        tokenLength: credentials.accessToken.length,
        hasRefreshToken: !!credentials.refreshToken,
        expiresAt: credentials.expiresAt,
        region: credentials.region
      });

      return credentials.accessToken;
    });
  }

  /**
   * 获取 ProfileArn
   */
  public async getProfileArn(): Promise<string> {
    return this.retryManager.executeWithRetry(async () => {
      // 先获取token以确保缓存更新
      await this.getToken();
      
      if (this.tokenCache?.profileArn) {
        return this.tokenCache.profileArn;
      }
      
      // 如果凭据中没有profileArn，使用默认值
      const defaultProfileArn = 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK';
      this.log('warn', 'ProfileArn not found in credentials, using default', { defaultProfileArn });
      return defaultProfileArn;
    });
  }

  /**
   * 刷新访问令牌
   */
  public async refreshToken(forceRefresh: boolean = false): Promise<void> {
    return this.retryManager.executeWithRetry(async () => {
      this.log('info', 'Starting token refresh...', { forceRefresh });
      
      // 加载当前凭据
      const currentCredentials = await this.credentialManager.loadCredentials();
      if (!currentCredentials?.refreshToken) {
        throw RetryManager.createRetryableError('No refresh token available', undefined, false);
      }

      // 构建刷新URL
      const refreshUrl = this.buildRefreshUrl();
      
      // 准备刷新请求
      const refreshReq: RefreshRequest = {
        refreshToken: currentCredentials.refreshToken,
      };

      // 根据认证方法添加额外参数
      if (this.config.authMethod !== AuthMethod.SOCIAL) {
        refreshReq.clientId = currentCredentials.clientId;
        refreshReq.clientSecret = currentCredentials.clientSecret;
        refreshReq.grantType = 'refresh_token';
      }

      this.log('debug', 'Sending token refresh request', {
        refreshUrl,
        authMethod: this.config.authMethod,
        hasClientId: !!refreshReq.clientId
      });

      try {
        // 发送刷新请求
        const response: AxiosResponse<RefreshResponse> = await axios.post(
          refreshUrl,
          refreshReq,
          {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': this.config.userAgent
            },
            timeout: this.config.retry?.timeoutMs || 120000,
          }
        );

        if (response.status !== 200) {
          throw RetryManager.createRetryableError(
            `Token refresh failed with status: ${response.status}`,
            response.status
          );
        }

        const newTokenData: TokenData = response.data;
        
        // 保留原有的配置信息
        const updatedTokenData: TokenData = {
          ...currentCredentials,
          ...newTokenData,
          // 确保保留区域和认证方法
          region: newTokenData.region || currentCredentials.region || this.config.region?.region,
          authMethod: newTokenData.authMethod || currentCredentials.authMethod || this.config.authMethod
        };

        // 保存更新的凭据到默认文件
        const defaultPath = path.join(os.homedir(), '.aws', 'sso', 'cache', KIRO_AUTH_TOKEN_FILE);
        await this.credentialManager.saveCredentialsToFile(defaultPath, updatedTokenData);

        // 更新缓存
        this.tokenCache = updatedTokenData;
        this.lastTokenRead = Date.now();

        this.log('info', 'Token refresh completed successfully', {
          newTokenLength: updatedTokenData.accessToken.length,
          expiresAt: updatedTokenData.expiresAt,
          region: updatedTokenData.region
        });

      } catch (error) {
        // 转换为 RetryableError
        const retryableError = RetryManager.createRetryableErrorFromResponse(
          error,
          'Token refresh request failed'
        );
        
        this.log('error', 'Token refresh failed', {
          error: error instanceof Error ? error.message : String(error),
          statusCode: retryableError.statusCode,
          isRetryable: retryableError.isRetryable
        });
        
        throw retryableError;
      }
    });
  }

  /**
   * 验证令牌有效性
   */
  public async validateToken(): Promise<boolean> {
    try {
      const token = await this.getToken();
      
      // 简单验证：检查token格式和长度
      if (!token || token.length < 10) {
        return false;
      }

      this.log('debug', 'Token validation passed', {
        tokenLength: token.length,
      });

      return true;
    } catch (error) {
      this.log('warn', 'Token validation failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /**
   * 构建刷新URL
   */
  private buildRefreshUrl(): string {
    const region = this.config.region?.region || 'us-east-1';
    
    if (this.config.authMethod === AuthMethod.SOCIAL) {
      // Social 认证使用 Kiro 刷新端点
      const template = this.config.region?.refreshUrl || DEFAULT_REGION_CONFIG.refreshUrl;
      return template?.replace('{{region}}', region) || '';
    } else {
      // IDC 认证使用 AWS OIDC 端点
      const template = this.config.region?.refreshIDCUrl || DEFAULT_REGION_CONFIG.refreshIDCUrl;
      return template?.replace('{{region}}', region) || '';
    }
  }

  /**
   * 获取当前配置
   */
  public getConfig(): KiroAuthConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<KiroAuthConfig>): void {
    this.config = {
      credentials: { ...this.config.credentials, ...newConfig.credentials },
      region: { 
        region: newConfig.region?.region || this.config.region?.region || 'us-east-1',
        refreshUrl: newConfig.region?.refreshUrl || this.config.region?.refreshUrl,
        refreshIDCUrl: newConfig.region?.refreshIDCUrl || this.config.region?.refreshIDCUrl,
        baseUrl: newConfig.region?.baseUrl || this.config.region?.baseUrl,
        amazonQUrl: newConfig.region?.amazonQUrl || this.config.region?.amazonQUrl
      },
      retry: {
        maxRetries: newConfig.retry?.maxRetries || this.config.retry?.maxRetries || 3,
        baseDelay: newConfig.retry?.baseDelay || this.config.retry?.baseDelay || 1000,
        backoffMultiplier: newConfig.retry?.backoffMultiplier || this.config.retry?.backoffMultiplier || 2,
        retryableStatuses: newConfig.retry?.retryableStatuses || this.config.retry?.retryableStatuses || [429, 500, 502, 503, 504],
        timeoutMs: newConfig.retry?.timeoutMs || this.config.retry?.timeoutMs || 120000
      },
      authMethod: newConfig.authMethod || this.config.authMethod,
      userAgent: newConfig.userAgent || this.config.userAgent,
      enableDebugLog: newConfig.enableDebugLog !== undefined ? newConfig.enableDebugLog : this.config.enableDebugLog
    };

    // 重新初始化管理器
    this.credentialManager = new CredentialManager(this.config.credentials, logger);
    this.retryManager = new RetryManager(this.config.retry, logger);

    // 清除缓存以强制重新加载
    this.clearCache();

    this.log('info', 'Configuration updated', {
      region: this.config.region?.region,
      authMethod: this.config.authMethod
    });
  }

  /**
   * 导出环境变量格式
   */
  public async exportEnvVars(baseUrl: string = 'http://localhost:3456'): Promise<string> {
    try {
      const token = await this.getToken();
      
      const isWindows = process.platform === 'win32';
      
      if (isWindows) {
        return [
          'REM CMD格式',
          `set ANTHROPIC_BASE_URL=${baseUrl}`,
          `set ANTHROPIC_API_KEY=${token}`,
          '',
          'REM PowerShell格式',
          `$env:ANTHROPIC_BASE_URL="${baseUrl}"`,
          `$env:ANTHROPIC_API_KEY="${token}"`,
        ].join('\n');
      } else {
        return [
          `export ANTHROPIC_BASE_URL=${baseUrl}`,
          `export ANTHROPIC_API_KEY="${token}"`,
        ].join('\n');
      }
    } catch (error) {
      this.log('error', 'Failed to export environment variables', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.tokenCache = null;
    this.lastTokenRead = 0;
    this.log('debug', 'Token cache cleared');
  }

  /**
   * 日志输出方法
   */
  private log(level: string, message: string, meta?: any): void {
    if (!this.config.enableDebugLog && level === 'debug') {
      return;
    }

    if (logger) {
      (logger as any)[level]?.(message, meta);
    } else {
      console.log(`[EnhancedCodeWhispererAuth] ${level.toUpperCase()}: ${message}`, meta || '');
    }
  }
}