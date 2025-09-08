/**
 * Authentication Module Implementation
 *
 * 实现完整的三阶段认证处理(req_in, req_process, req_out, response_in, response_process, response_out)
 * 支持多种认证方式(api_key, bearer, oauth2, file_based)
 *
 * @author Claude Code Assistant
 * @version 1.0.0
 */

import { BaseModule } from '../base-module-impl';
import { ModuleType } from '../interfaces/module/base-module';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';
import { secureLogger } from '../utils';
import { RCCError, RCCErrorCode } from '../types/src/index';

// Define auth-specific error classes
class ValidationError extends RCCError {
  constructor(message: string, context?: any) {
    super(message, RCCErrorCode.VALIDATION_ERROR, 'AUTH', context);
    this.name = 'ValidationError';
  }
}

class AuthError extends RCCError {
  constructor(message: string, context?: any) {
    super(message, RCCErrorCode.PROVIDER_AUTH_FAILED, 'AUTH', context);
    this.name = 'AuthError';
  }
}

// 为OAuth2 token响应定义接口
interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface OAuth2IntrospectResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  token_type?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  sub?: string;
  aud?: string;
  iss?: string;
  jti?: string;
}

/**
 * 认证类型枚举
 */
export enum AuthType {
  API_KEY = 'api_key',
  BEARER = 'bearer',
  OAUTH2 = 'oauth2',
  FILE_BASED = 'file_based',
}

/**
 * 认证配置接口
 */
export interface AuthConfig {
  type: AuthType;
  apiKey?: string;
  bearerToken?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthTokenUrl?: string;
  tokenFile?: string;
  headerName?: string;
  requireAuth?: boolean;
  cacheTTL?: number; // 缓存过期时间（毫秒）
  permissions?: Record<string, string[]>; // 用户权限映射
}

/**
 * 认证结果接口
 */
export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  error?: string;
  token?: string;
  expiresAt?: Date;
}

/**
 * Token缓存项
 */
interface TokenCacheItem {
  token: string;
  userId: string;
  expiresAt: Date;
  refreshToken?: string;
}

// 强制刷新和重建相关接口
interface RefreshResult {
  success: boolean;
  refreshedTokens: string[];
  failedTokens: string[];
  error?: string;
}

interface RebuildResult {
  success: boolean;
  rebuiltPipelines: string[];
  failedPipelines: string[];
  error?: string;
}

interface AuthMaintenanceStatus {
  maintenanceMode: boolean;
  activeRefresh: boolean;
  activeRebuild: boolean;
  lastRefreshAt?: Date;
  lastRebuildAt?: Date;
}

/**
 * 认证模块实现
 */
export class AuthenticationModule extends BaseModule {
  protected config: AuthConfig;
  private tokenCache: Map<string, TokenCacheItem> = new Map();
  private cacheTTL: number;
  
  // 鉴权维护相关属性
  private activeRefresh: boolean = false;
  private activeRebuild: boolean = false;
  private lastRefreshAt: Date | null = null;
  private lastRebuildAt: Date | null = null;

  constructor(config: AuthConfig) {
    super(
      `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      'AuthenticationModule',
      ModuleType.VALIDATION,
      '1.0.0'
    );
    
    this.validateConfig(config);
    this.config = { ...config, requireAuth: config.requireAuth ?? true };
    this.cacheTTL = config.cacheTTL || 3600000; // 默认1小时
  }

  /**
   * 验证配置
   */
  private validateConfig(config: AuthConfig): void {
    if (!config.type) {
      throw new ValidationError('Authentication type is required', { module: this.getName() });
    }

    switch (config.type) {
      case AuthType.API_KEY:
        if (!config.apiKey && !config.headerName) {
          throw new ValidationError('API key or header name is required for API key authentication', { module: this.getName() });
        }
        break;
      case AuthType.BEARER:
        if (!config.bearerToken) {
          throw new ValidationError('Bearer token is required for bearer authentication', { module: this.getName() });
        }
        break;
      case AuthType.OAUTH2:
        if (!config.oauthClientId || !config.oauthClientSecret || !config.oauthTokenUrl) {
          throw new ValidationError('OAuth2 client credentials and token URL are required', { module: this.getName() });
        }
        break;
      case AuthType.FILE_BASED:
        if (!config.tokenFile) {
          throw new ValidationError('Token file path is required for file-based authentication', { module: this.getName() });
        }
        break;
      default:
        throw new ValidationError(`Unsupported authentication type: ${config.type}`, { module: this.getName(), type: config.type });
    }
  }

  /**
   * 配置处理
   */
  protected async onConfigure(config: any): Promise<void> {
    this.validateConfig(config);
    this.config = { ...this.config, ...config };
    this.cacheTTL = config.cacheTTL || this.cacheTTL;
  }

  /**
   * 启动处理
   */
  protected async onStart(): Promise<void> {
    // 初始化token缓存
    await this.initializeTokenCache();
  }

  /**
   * 停止处理
   */
  protected async onStop(): Promise<void> {
    // 清理资源
    this.tokenCache.clear();
    this.resetMaintenanceStatus();
  }

  /**
   * 处理逻辑
   */
  protected async onProcess(input: any): Promise<any> {
    // 根据输入类型进行不同的处理
    if (input.stage === 'req_in') {
      return await this.handleRequestIn(input);
    } else if (input.stage === 'req_process') {
      return await this.handleRequestProcess(input);
    } else if (input.stage === 'req_out') {
      return await this.handleRequestOut(input);
    } else if (input.stage === 'response_in') {
      return await this.handleResponseIn(input);
    } else if (input.stage === 'response_process') {
      return await this.handleResponseProcess(input);
    } else if (input.stage === 'response_out') {
      return await this.handleResponseOut(input);
    } else {
      // 默认处理请求认证
      return await this.authenticateRequest(input);
    }
  }

  /**
   * 重置处理
   */
  protected async onReset(): Promise<void> {
    this.tokenCache.clear();
    this.resetMaintenanceStatus();
  }

  /**
   * 健康检查处理
   */
  protected async onHealthCheck(): Promise<any> {
    const baseHealth = await super.onHealthCheck();
    
    // 计算缓存统计信息
    const now = new Date();
    let expiredTokens = 0;
    for (const cacheItem of this.tokenCache.values()) {
      if (cacheItem.expiresAt < now) {
        expiredTokens++;
      }
    }
    
    return {
      ...baseHealth,
      cacheSize: this.tokenCache.size,
      expiredTokens,
      configType: this.config.type,
      cacheTTL: this.cacheTTL,
      hasPermissions: !!this.config.permissions,
      // 鉴权维护状态信息
      authMaintenance: this.getAuthMaintenanceStatus(),
    };
  }

  /**
   * 处理请求进入阶段
   */
  private async handleRequestIn(input: any): Promise<any> {
    // 验证认证信息
    const authResult = await this.authenticateRequest(input.request);
    
    if (!authResult.authenticated && this.config.requireAuth) {
      throw new AuthError(`Authentication failed: ${authResult.error || 'Invalid credentials'}`, { 
        module: this.getName(),
        userId: authResult.userId
      });
    }

    return {
      ...input,
      auth: authResult,
      metadata: {
        ...input.metadata,
        authenticated: authResult.authenticated,
        userId: authResult.userId,
      }
    };
  }

  /**
   * 处理请求处理阶段
   */
  private async handleRequestProcess(input: any): Promise<any> {
    // 在处理阶段可以添加额外的权限检查
    if (input.auth && input.auth.authenticated) {
      // 可以在这里添加基于用户的角色权限检查
      const hasPermission = await this.checkPermissions(input.auth.userId, input.request);
      
      if (!hasPermission) {
        throw new AuthError('Insufficient permissions', { 
          module: this.getName(),
          userId: input.auth.userId
        });
      }
    }
    
    return input;
  }

  /**
   * 处理请求输出阶段
   */
  private async handleRequestOut(input: any): Promise<any> {
    // 在请求发送前可以添加认证头
    if (input.auth && input.auth.authenticated) {
      const headers = await this.getAuthHeaders();
      return {
        ...input,
        request: {
          ...input.request,
          headers: {
            ...input.request.headers,
            ...headers,
          }
        }
      };
    }
    
    return input;
  }

  /**
   * 处理响应进入阶段
   */
  private async handleResponseIn(input: any): Promise<any> {
    // 验证响应中的认证相关信息
    if (input.response && input.response.headers) {
      // 检查是否需要刷新token
      const authHeader = input.response.headers['www-authenticate'] || 
                         input.response.headers['WWW-Authenticate'];
      
      if (authHeader && authHeader.includes('Bearer') && this.config.type === AuthType.BEARER) {
        // Token可能已过期，需要刷新
        await this.refreshToken();
      }
    }
    
    return input;
  }

  /**
   * 处理响应处理阶段
   */
  private async handleResponseProcess(input: any): Promise<any> {
    // 处理响应中的认证相关信息
    if (input.auth && input.auth.authenticated && input.response) {
      // 可以在这里更新token缓存
      if (input.response.headers && input.response.headers['authorization']) {
        const newToken = input.response.headers['authorization'];
        if (newToken.startsWith('Bearer ')) {
          const token = newToken.substring(7);
          await this.updateTokenCache(token, input.auth.userId);
        }
      }
    }
    
    return input;
  }

  /**
   * 处理响应输出阶段
   */
  private async handleResponseOut(input: any): Promise<any> {
    // 在响应返回前可以移除敏感的认证信息
    if (input.response && input.response.headers) {
      const cleanedHeaders = { ...input.response.headers };
      
      // 移除敏感的认证头
      delete cleanedHeaders['authorization'];
      delete cleanedHeaders['Authorization'];
      delete cleanedHeaders['www-authenticate'];
      delete cleanedHeaders['WWW-Authenticate'];
      
      return {
        ...input,
        response: {
          ...input.response,
          headers: cleanedHeaders,
        }
      };
    }
    
    return input;
  }

  /**
   * 认证请求
   */
  private async authenticateRequest(request: any): Promise<AuthResult> {
    switch (this.config.type) {
      case AuthType.API_KEY:
        return await this.authenticateApiKey(request);
      case AuthType.BEARER:
        return await this.authenticateBearer(request);
      case AuthType.OAUTH2:
        return await this.authenticateOAuth2(request);
      case AuthType.FILE_BASED:
        return await this.authenticateFileBased(request);
      default:
        return { authenticated: false, error: 'Unsupported authentication type' };
    }
  }

  /**
   * API Key认证
   */
  private async authenticateApiKey(request: any): Promise<AuthResult> {
    const headerName = this.config.headerName || 'Authorization';
    const authHeader = request.headers?.[headerName] || request.headers?.[headerName.toLowerCase()];
    
    if (!authHeader) {
      return { authenticated: false, error: 'Missing API key' };
    }

    const expectedKey = this.config.apiKey;
    if (!expectedKey) {
      return { authenticated: false, error: 'API key not configured' };
    }

    // 支持Bearer和直接API Key两种格式
    let providedKey = authHeader;
    if (authHeader.startsWith('Bearer ')) {
      providedKey = authHeader.substring(7);
    }

    if (providedKey === expectedKey) {
      return { 
        authenticated: true, 
        userId: 'api-user',
        token: providedKey
      };
    }

    return { authenticated: false, error: 'Invalid API key' };
  }

  /**
   * Bearer Token认证
   */
  private async authenticateBearer(request: any): Promise<AuthResult> {
    const authHeader = request.headers?.['Authorization'] || request.headers?.['authorization'];
    
    if (!authHeader) {
      return { authenticated: false, error: 'Missing authorization header' };
    }

    if (!authHeader.startsWith('Bearer ')) {
      return { authenticated: false, error: 'Invalid authorization format' };
    }

    const token = authHeader.substring(7);
    
    // 检查缓存
    const cached = this.tokenCache.get(token);
    if (cached && cached.expiresAt > new Date()) {
      return { 
        authenticated: true, 
        userId: cached.userId,
        token: token,
        expiresAt: cached.expiresAt
      };
    }

    // 验证token
    const expectedToken = this.config.bearerToken;
    if (!expectedToken) {
      return { authenticated: false, error: 'Bearer token not configured' };
    }

    if (token === expectedToken) {
      const result = { 
        authenticated: true, 
        userId: 'bearer-user',
        token: token,
        expiresAt: new Date(Date.now() + this.cacheTTL)
      };
      
      // 缓存token
      this.tokenCache.set(token, {
        token: token,
        userId: result.userId,
        expiresAt: result.expiresAt
      });
      
      return result;
    }

    return { authenticated: false, error: 'Invalid bearer token' };
  }

  /**
   * OAuth2认证
   */
  private async authenticateOAuth2(request: any): Promise<AuthResult> {
    const authHeader = request.headers?.['Authorization'] || request.headers?.['authorization'];
    
    if (!authHeader) {
      return { authenticated: false, error: 'Missing authorization header' };
    }

    if (!authHeader.startsWith('Bearer ')) {
      return { authenticated: false, error: 'Invalid authorization format' };
    }

    const token = authHeader.substring(7);
    
    // 检查缓存
    const cached = this.tokenCache.get(token);
    if (cached && cached.expiresAt > new Date()) {
      return { 
        authenticated: true, 
        userId: cached.userId,
        token: token,
        expiresAt: cached.expiresAt
      };
    }

    // 验证OAuth2 token
    const isValid = await this.validateOAuth2Token(token);
    
    if (isValid) {
      const result = { 
        authenticated: true, 
        userId: 'oauth2-user',
        token: token,
        expiresAt: new Date(Date.now() + this.cacheTTL)
      };
      
      // 缓存token
      this.tokenCache.set(token, {
        token: token,
        userId: result.userId,
        expiresAt: result.expiresAt
      });
      
      return result;
    }

    return { authenticated: false, error: 'Invalid OAuth2 token' };
  }

  /**
   * 验证OAuth2 token
   */
  private async validateOAuth2Token(token: string): Promise<boolean> {
    try {
      // 调用OAuth2服务器的token introspection端点
      const response = await axios.post<OAuth2IntrospectResponse>(
        this.config.oauthTokenUrl! + '/introspect',
        new URLSearchParams({
          token: token,
          client_id: this.config.oauthClientId,
          client_secret: this.config.oauthClientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return response.data.active === true;
    } catch (error) {
      secureLogger.error('OAuth2 token validation failed', {
        error: error instanceof Error ? error.message : String(error),
        module: this.getName(),
        tokenId: token.substring(0, 8) + '...'
      });
      return false;
    }
  }

  /**
   * 基于文件的认证
   */
  private async authenticateFileBased(request: any): Promise<AuthResult> {
    const authHeader = request.headers?.['Authorization'] || request.headers?.['authorization'];
    
    if (!authHeader) {
      return { authenticated: false, error: 'Missing authorization header' };
    }

    if (!authHeader.startsWith('Bearer ')) {
      return { authenticated: false, error: 'Invalid authorization format' };
    }

    const token = authHeader.substring(7);
    
    // 检查缓存
    const cached = this.tokenCache.get(token);
    if (cached && cached.expiresAt > new Date()) {
      return { 
        authenticated: true, 
        userId: cached.userId,
        token: token,
        expiresAt: cached.expiresAt
      };
    }

    // 从文件读取有效的token
    const validTokens = await this.readValidTokensFromFile();
    
    if (validTokens.includes(token)) {
      const result = { 
        authenticated: true, 
        userId: 'file-user',
        token: token,
        expiresAt: new Date(Date.now() + this.cacheTTL)
      };
      
      // 缓存token
      this.tokenCache.set(token, {
        token: token,
        userId: result.userId,
        expiresAt: result.expiresAt
      });
      
      return result;
    }

    return { authenticated: false, error: 'Invalid token' };
  }

  /**
   * 从文件读取有效token
   */
  private async readValidTokensFromFile(): Promise<string[]> {
    try {
      const filePath = path.resolve(this.config.tokenFile!);
      const content = await fs.readFile(filePath, 'utf8');
      return content.split('\n').filter(line => line.trim().length > 0);
    } catch (error) {
      secureLogger.error('Failed to read token file', {
        error: error instanceof Error ? error.message : String(error),
        module: this.getName(),
        filePath: this.config.tokenFile
      });
      return [];
    }
  }

  /**
   * 获取认证头
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    switch (this.config.type) {
      case AuthType.API_KEY:
        return {
          [this.config.headerName || 'Authorization']: `Bearer ${this.config.apiKey}`
        };
      case AuthType.BEARER:
        return {
          'Authorization': `Bearer ${this.config.bearerToken}`
        };
      case AuthType.OAUTH2:
        // 获取OAuth2访问token
        const oauthToken = await this.getOAuth2AccessToken();
        return {
          'Authorization': `Bearer ${oauthToken}`
        };
      case AuthType.FILE_BASED:
        // 文件认证通常不需要在请求中添加头
        return {};
      default:
        return {};
    }
  }

  /**
   * 获取OAuth2访问token
   */
  private async getOAuth2AccessToken(): Promise<string> {
    try {
      const response = await axios.post<OAuth2TokenResponse>(
        this.config.oauthTokenUrl!,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.oauthClientId,
          client_secret: this.config.oauthClientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return response.data.access_token;
    } catch (error) {
      secureLogger.error('Failed to get OAuth2 access token', {
        error: error instanceof Error ? error.message : String(error),
        module: this.getName(),
        clientId: this.config.oauthClientId
      });
      return '';
    }
  }

  /**
   * 刷新token
   */
  private async refreshToken(): Promise<void> {
    // 对于不同的认证类型，刷新逻辑不同
    switch (this.config.type) {
      case AuthType.BEARER:
        // Bearer token通常不需要刷新
        break;
      case AuthType.OAUTH2:
        await this.refreshOAuth2Token();
        break;
      default:
        // 其他类型不需要刷新
        break;
    }
  }

  /**
   * 刷新OAuth2 token
   */
  private async refreshOAuth2Token(): Promise<void> {
    // OAuth2 token刷新逻辑
    try {
      // 查找需要刷新的token
      for (const [token, cacheItem] of this.tokenCache.entries()) {
        if (cacheItem.expiresAt < new Date() && cacheItem.refreshToken) {
          // 使用refresh token获取新的access token
          const response = await axios.post<OAuth2TokenResponse>(
            this.config.oauthTokenUrl!,
            new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: cacheItem.refreshToken,
              client_id: this.config.oauthClientId,
              client_secret: this.config.oauthClientSecret
            }),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            }
          );
          
          // 更新缓存
          this.tokenCache.set(token, {
            token: response.data.access_token,
            userId: cacheItem.userId,
            expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
            refreshToken: response.data.refresh_token || cacheItem.refreshToken
          });
          
          secureLogger.info('OAuth2 token refreshed successfully', {
            module: this.getName(),
            userId: cacheItem.userId
          });
        }
      }
    } catch (error) {
      secureLogger.error('Failed to refresh OAuth2 token', {
        error: error instanceof Error ? error.message : String(error),
        module: this.getName()
      });
    }
  }

  /**
   * 更新token缓存
   */
  private async updateTokenCache(token: string, userId: string | undefined): Promise<void> {
    this.tokenCache.set(token, {
      token: token,
      userId: userId || 'unknown',
      expiresAt: new Date(Date.now() + this.cacheTTL),
    });
  }

  /**
   * 检查权限
   */
  /**
   * 检查权限
   */
  private async checkPermissions(userId: string | undefined, request: any): Promise<boolean> {
    // 实现权限检查逻辑
    // 这里可以根据用户ID和请求内容检查权限
    if (!userId) {
      return false;
    }
    
    // 如果配置了权限规则，则进行检查
    if (this.config.permissions) {
      const userPermissions = this.config.permissions[userId] || [];
      const requiredPermission = this.getRequiredPermission(request);
      
      // 检查用户是否具有必需的权限
      return userPermissions.includes(requiredPermission) || userPermissions.includes('admin');
    }
    
    // 默认情况下，认证用户具有权限
    return true;
  }

  /**
   * 获取请求所需的权限
   */
  private getRequiredPermission(request: any): string {
    const method = request.method?.toUpperCase() || 'GET';
    const url = request.url || '';
    
    // 根据HTTP方法和URL路径确定所需权限
    if (method === 'DELETE' || url.includes('/admin')) {
      return 'admin';
    } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      return 'write';
    } else {
      return 'read';
    }
  }

  /**
   * 初始化token缓存
   */
  private async initializeTokenCache(): Promise<void> {
    // 预加载配置中的token到缓存
    if (this.config.bearerToken) {
      this.tokenCache.set(this.config.bearerToken, {
        token: this.config.bearerToken,
        userId: 'configured-user',
        expiresAt: new Date(Date.now() + this.cacheTTL),
      });
    }
    
    secureLogger.info('Authentication module initialized', {
      module: this.getName(),
      configType: this.config.type,
      cacheSize: this.tokenCache.size
    });
  }

  // ===== 强制刷新和重建功能 =====

  /**
   * 强制刷新所有token（增强版本）
   * @param provider 可选：指定的提供商名称
   * @param options 可选参数
   * @returns Promise<RefreshResult> 刷新结果
   */
  async forceRefreshTokens(
    provider?: string, 
    options?: {
      force?: boolean;
      skipValidation?: boolean;
      refreshExpiredOnly?: boolean;
      maxConcurrent?: number;
    }
  ): Promise<RefreshResult> {
    if (this.activeRefresh && !options?.force) {
      return {
        success: false,
        refreshedTokens: [],
        failedTokens: [],
        error: 'Refresh operation already in progress'
      };
    }

    this.activeRefresh = true;
    const refreshedTokens: string[] = [];
    const failedTokens: string[] = [];
    const maxConcurrent = options?.maxConcurrent || 5;

    try {
      secureLogger.info('Starting force token refresh', {
        provider: provider || 'all',
        totalTokens: this.tokenCache.size,
        options
      });

      const now = new Date();
      const tokensToRefresh: string[] = [];

      // 收集需要刷新的token
      for (const [token, cacheItem] of this.tokenCache.entries()) {
        // 如果指定了提供商，只刷新该提供商的token
        if (!provider || this.doesTokenBelongToProvider(token, provider)) {
          
          // 如果只刷新过期的token
          if (options?.refreshExpiredOnly) {
            if (cacheItem.expiresAt <= now) {
              tokensToRefresh.push(token);
            }
          } else {
            tokensToRefresh.push(token);
          }
        }
      }

      // 并发控制刷新操作
      const refreshBatches: string[][] = [];
      for (let i = 0; i < tokensToRefresh.length; i += maxConcurrent) {
        refreshBatches.push(tokensToRefresh.slice(i, i + maxConcurrent));
      }

      for (const batch of refreshBatches) {
        const refreshPromises = batch.map(async (token) => {
          try {
            const refreshSuccess = await this.forceRefreshSingleToken(token, options);
            if (refreshSuccess) {
              refreshedTokens.push(token);
            } else {
              failedTokens.push(token);
            }
          } catch (error) {
            failedTokens.push(token);
            secureLogger.error('Failed to refresh token', {
              error: error instanceof Error ? error.message : String(error),
              tokenSubstr: token.substring(0, 8) + '...'
            });
          }
        });

        await Promise.all(refreshPromises);
      }

      this.lastRefreshAt = now;

      // 发送刷新完成事件
      this.emit('token-refresh-completed', {
        provider: provider || 'all',
        refreshedTokens: refreshedTokens.length,
        failedTokens: failedTokens.length,
        timestamp: now
      });

      secureLogger.info('Force token refresh completed', {
        provider: provider || 'all',
        refreshedTokens: refreshedTokens.length,
        failedTokens: failedTokens.length
      });

      return {
        success: failedTokens.length === 0,
        refreshedTokens,
        failedTokens
      };
    } catch (error) {
      secureLogger.error('Force token refresh failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: provider || 'all'
      });

      return {
        success: false,
        refreshedTokens,
        failedTokens,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.activeRefresh = false;
    }
  }

  /**
   * 预检查refresh操作
   * @param provider 可选：指定的提供商名称
   * @returns Promise<{canRefresh: boolean; reason?: string; tokensToRefresh: number}>
   */
  async canPerformRefresh(provider?: string): Promise<{
    canRefresh: boolean;
    reason?: string;
    tokensToRefresh: number;
    estimatedTime: number;
  }> {
    if (this.activeRefresh) {
      return {
        canRefresh: false,
        reason: 'Refresh operation already in progress',
        tokensToRefresh: 0,
        estimatedTime: 0
      };
    }

    if (this.activeRebuild) {
      return {
        canRefresh: false,
        reason: 'Rebuild operation in progress',
        tokensToRefresh: 0,
        estimatedTime: 0
      };
    }

    let tokensToRefresh = 0;
    for (const [token, cacheItem] of this.tokenCache.entries()) {
      if (!provider || this.doesTokenBelongToProvider(token, provider)) {
        tokensToRefresh++;
      }
    }

    if (tokensToRefresh === 0) {
      return {
        canRefresh: false,
        reason: 'No tokens to refresh',
        tokensToRefresh: 0,
        estimatedTime: 0
      };
    }

    // 估算时间：每个token大约需要500ms
    const estimatedTime = tokensToRefresh * 500;

    return {
      canRefresh: true,
      tokensToRefresh,
      estimatedTime
    };
  }

  /**
   * 强制重建认证配置（增强版本）
   * @param provider 可选：指定的提供商名称
   * @param options 可选参数
   * @returns Promise<RebuildResult> 重建结果
   */
  async forceRebuildAuth(
    provider?: string, 
    options?: {
      force?: boolean;
      preserveCache?: boolean;
      rebuildConnections?: boolean;
      validateAfterRebuild?: boolean;
    }
  ): Promise<RebuildResult> {
    if (this.activeRebuild && !options?.force) {
      return {
        success: false,
        rebuiltPipelines: [],
        failedPipelines: [],
        error: 'Rebuild operation already in progress'
      };
    }

    this.activeRebuild = true;
    const rebuiltPipelines: string[] = [];
    const failedPipelines: string[] = [];

    try {
      secureLogger.info('Starting force auth rebuild', {
        provider: provider || 'all',
        authType: this.config.type,
        options
      });

      const now = new Date();
      const oldCacheSize = this.tokenCache.size;

      // 1. 备份现有缓存（如果需要保留）
      const cacheBackup = options?.preserveCache ? new Map(this.tokenCache) : null;

      // 2. 清空现有token缓存
      this.tokenCache.clear();

      // 3. 重新初始化缓存
      await this.initializeTokenCache();

      // 4. 重新验证配置
      try {
        this.validateConfig(this.config);
      } catch (configError) {
        // 如果配置验证失败，恢复缓存
        if (cacheBackup) {
          this.tokenCache = cacheBackup;
        }
        throw configError;
      }

      // 5. 根据认证类型执行特定的重建逻辑
      switch (this.config.type) {
        case AuthType.OAUTH2:
          await this.rebuildOAuth2Auth();
          break;
        case AuthType.FILE_BASED:
          await this.rebuildFileBasedAuth();
          break;
        default:
          // 对于其他类型，token缓存重建就足够了
          break;
      }

      this.lastRebuildAt = now;

      // 6. 获取受影响的流水线（实际实现中需要与PipelineManager集成）
      const affectedPipelines = this.getAffectedPipelinesForProvider(provider);
      affectedPipelines.forEach(pipelineId => {
        rebuiltPipelines.push(pipelineId);
      });

      // 7. 如果有备份且需要合并，合并新旧缓存
      if (cacheBackup && options?.preserveCache) {
        await this.mergeCacheAfterRebuild(cacheBackup);
      }

      // 8. 重建后验证（如果需要）
      if (options?.validateAfterRebuild) {
        const validationResult = await this.validateAfterRebuild();
        if (!validationResult.success) {
          failedPipelines.push(...rebuiltPipelines);
          rebuiltPipelines.length = 0;
          
          return {
            success: false,
            rebuiltPipelines,
            failedPipelines,
            error: validationResult.error || 'Validation failed after rebuild'
          };
        }
      }

      // 发送重建完成事件
      this.emit('auth-rebuild-completed', {
        provider: provider || 'all',
        rebuiltPipelines: rebuiltPipelines.length,
        oldCacheSize,
        newCacheSize: this.tokenCache.size,
        timestamp: now
      });

      secureLogger.info('Force auth rebuild completed', {
        provider: provider || 'all',
        rebuiltPipelines: rebuiltPipelines.length,
        oldCacheSize,
        newCacheSize: this.tokenCache.size
      });

      return {
        success: failedPipelines.length === 0,
        rebuiltPipelines,
        failedPipelines
      };
    } catch (error) {
      secureLogger.error('Force auth rebuild failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: provider || 'all'
      });

      return {
        success: false,
        rebuiltPipelines,
        failedPipelines,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.activeRebuild = false;
    }
  }

  /**
   * 预检查rebuild操作
   * @param provider 可选：指定的提供商名称
   * @returns Promise<{canRebuild: boolean; reason?: string; estimatedFailures: number}>
   */
  async canPerformRebuild(provider?: string): Promise<{
    canRebuild: boolean;
    reason?: string;
    estimatedFailures: number;
    estimatedTime: number;
  }> {
    if (this.activeRebuild) {
      return {
        canRebuild: false,
        reason: 'Rebuild operation already in progress',
        estimatedFailures: 0,
        estimatedTime: 0
      };
    }

    if (this.activeRefresh) {
      return {
        canRebuild: false,
        reason: 'Refresh operation in progress',
        estimatedFailures: 0,
        estimatedTime: 0
      };
    }

    // 估算潜在失败数量
    let estimatedFailures = 0;
    const totalTokens = this.tokenCache.size;
    
    // 根据认证类型估算失败率
    switch (this.config.type) {
      case AuthType.OAUTH2:
        estimatedFailures = Math.floor(totalTokens * 0.1); // 10% 失败率
        break;
      case AuthType.FILE_BASED:
        estimatedFailures = Math.floor(totalTokens * 0.05); // 5% 失败率
        break;
      default:
        estimatedFailures = Math.floor(totalTokens * 0.02); // 2% 失败率
    }

    // 估算时间：重建操作需要更长时间
    const estimatedTime = totalTokens * 1000 + 5000; // 每个token 1秒 + 5秒基础时间

    return {
      canRebuild: true,
      estimatedFailures,
      estimatedTime
    };
  }

  /**
   * 合并缓存用于恢复重建
   * @param backupCache 备份的缓存
   */
  private async mergeCacheAfterRebuild(backupCache: Map<string, TokenCacheItem>): Promise<void> {
    try {
      for (const [token, cacheItem] of backupCache.entries()) {
        // 如果新缓存中没有，且token仍然有效，则重新添加
        if (!this.tokenCache.has(token) && cacheItem.expiresAt > new Date()) {
          this.tokenCache.set(token, cacheItem);
        }
      }
      
      secureLogger.info('Cache merge completed', {
        backupSize: backupCache.size,
        mergedSize: backupCache.size - this.tokenCache.size
      });
    } catch (error) {
      secureLogger.error('Failed to merge cache after rebuild', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 重建后验证
   * @returns Promise<{success: boolean; error?: string}>
   */
  private async validateAfterRebuild(): Promise<{success: boolean; error?: string}> {
    try {
      // 验证配置
      this.validateConfig(this.config);
      
      // 验证缓存不为空
      if (this.tokenCache.size === 0) {
        return {
          success: false,
          error: 'Token cache is empty after rebuild'
        };
      }
      
      // 验证token格式（简单检查）
      for (const [token, cacheItem] of this.tokenCache.entries()) {
        if (!token || token.length < 10) {
          return {
            success: false,
            error: `Invalid token format in cache: ${token.substring(0, 8)}...`
          };
        }
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // ===== 强制刷新和重建相关方法 =====

  
  
  /**
   * 获取鉴权维护状态
   * @returns Promise<AuthMaintenanceStatus>
   */
  async getAuthMaintenanceStatus(): Promise<AuthMaintenanceStatus> {
    return {
      maintenanceMode: this.activeRefresh || this.activeRebuild,
      activeRefresh: this.activeRefresh,
      activeRebuild: this.activeRebuild,
      lastRefreshAt: this.lastRefreshAt || undefined,
      lastRebuildAt: this.lastRebuildAt || undefined
    };
  }

  /**
   * 强制刷新单个token（增强版本）
   */
  private async forceRefreshSingleToken(
    token: string, 
    options?: {
      skipValidation?: boolean;
      force?: boolean;
    }
  ): Promise<boolean> {
    try {
      const cacheItem = this.tokenCache.get(token);
      if (!cacheItem) {
        secureLogger.warn('Token not found in cache for refresh', {
          tokenSubstr: token.substring(0, 8) + '...'
        });
        return false;
      }

      // 检查token是否仍然有效（如果需要验证）
      if (!options?.skipValidation && cacheItem.expiresAt > new Date()) {
        secureLogger.debug('Token is still valid, skipping refresh', {
          tokenSubstr: token.substring(0, 8) + '...',
          expiresAt: cacheItem.expiresAt.toISOString()
        });
        return true;
      }

      // 根据认证类型执行刷新逻辑
      switch (this.config.type) {
        case AuthType.OAUTH2:
          return await this.forceRefreshOAuth2Token(token, cacheItem, options);
        case AuthType.BEARER:
          return await this.forceRefreshBearerToken(token, cacheItem, options);
        case AuthType.FILE_BASED:
          return await this.forceRefreshFileBasedToken(token, cacheItem, options);
        case AuthType.API_KEY:
          return await this.forceRefreshApiKeyToken(token, cacheItem, options);
        default:
          // 其他类型不需要主动刷新
          secureLogger.debug('No refresh needed for auth type', {
            authType: this.config.type,
            tokenSubstr: token.substring(0, 8) + '...'
          });
          return true;
      }
    } catch (error) {
      secureLogger.error('Failed to refresh single token', {
        error: error instanceof Error ? error.message : String(error),
        tokenSubstr: token.substring(0, 8) + '...',
        authType: this.config.type
      });
      return false;
    }
  }

  /**
   * 强制刷新OAuth2 token
   */
  private async forceRefreshOAuth2Token(
    token: string, 
    cacheItem: TokenCacheItem,
    options?: {
      skipValidation?: boolean;
      force?: boolean;
    }
  ): Promise<boolean> {
    try {
      if (!cacheItem.refreshToken && !options?.force) {
        // 没有refresh token，重新获取
        secureLogger.debug('No refresh token available, getting new access token', {
          tokenSubstr: token.substring(0, 8) + '...'
        });
        return await this.getNewOAuth2AccessToken(token, cacheItem);
      }

      // 使用refresh token获取新token
      const response = await axios.post<OAuth2TokenResponse>(
        this.config.oauthTokenUrl!,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: cacheItem.refreshToken || '',
          client_id: this.config.oauthClientId!,
          client_secret: this.config.oauthClientSecret!
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000 // 10秒超时
        }
      );

      // 更新缓存
      this.tokenCache.delete(token);
      const newToken = response.data.access_token;
      this.tokenCache.set(newToken, {
        token: newToken,
        userId: cacheItem.userId,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
        refreshToken: response.data.refresh_token || cacheItem.refreshToken
      });

      secureLogger.info('OAuth2 token refreshed successfully', {
        oldTokenSubstr: token.substring(0, 8) + '...',
        newTokenSubstr: newToken.substring(0, 8) + '...',
        userId: cacheItem.userId,
        expiresIn: response.data.expires_in
      });

      return true;
    } catch (error) {
      // 如果refresh失败，尝试获取新的access token
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        secureLogger.warn('Refresh token invalid, getting new access token', {
          tokenSubstr: token.substring(0, 8) + '...',
          error: error.response.data
        });
        return await this.getNewOAuth2AccessToken(token, cacheItem);
      }
      
      secureLogger.error('Failed to refresh OAuth2 token', {
        error: error instanceof Error ? error.message : String(error),
        tokenSubstr: token.substring(0, 8) + '...'
      });
      return false;
    }
  }

  /**
   * 获取新的OAuth2访问token
   */
  private async getNewOAuth2AccessToken(token: string, cacheItem: TokenCacheItem): Promise<boolean> {
    try {
      const newToken = await this.getOAuth2AccessToken();
      if (newToken) {
        this.tokenCache.delete(token);
        this.tokenCache.set(newToken, {
          token: newToken,
          userId: cacheItem.userId,
          expiresAt: new Date(Date.now() + this.cacheTTL),
          refreshToken: cacheItem.refreshToken
        });
        
        secureLogger.info('New OAuth2 access token obtained', {
          oldTokenSubstr: token.substring(0, 8) + '...',
          newTokenSubstr: newToken.substring(0, 8) + '...'
        });
        
        return true;
      }
      return false;
    } catch (error) {
      secureLogger.error('Failed to get new OAuth2 access token', {
        error: error instanceof Error ? error.message : String(error),
        userId: cacheItem.userId
      });
      return false;
    }
  }

  /**
   * 强制刷新Bearer token
   */
  private async forceRefreshBearerToken(
    token: string, 
    cacheItem: TokenCacheItem,
    options?: {
      skipValidation?: boolean;
      force?: boolean;
    }
  ): Promise<boolean> {
    try {
      // Bearer token通常不会过期，所以只是更新过期时间
      const newExpiresAt = new Date(Date.now() + this.cacheTTL);
      cacheItem.expiresAt = newExpiresAt;
      this.tokenCache.set(token, cacheItem);
      
      secureLogger.debug('Bearer token expiry extended', {
        tokenSubstr: token.substring(0, 8) + '...',
        newExpiresAt: newExpiresAt.toISOString(),
        userId: cacheItem.userId
      });
      
      return true;
    } catch (error) {
      secureLogger.error('Failed to refresh Bearer token', {
        error: error instanceof Error ? error.message : String(error),
        tokenSubstr: token.substring(0, 8) + '...'
      });
      return false;
    }
  }

  /**
   * 强制刷新基于文件的token
   */
  private async forceRefreshFileBasedToken(
    token: string, 
    cacheItem: TokenCacheItem,
    options?: {
      skipValidation?: boolean;
      force?: boolean;
    }
  ): Promise<boolean> {
    try {
      // 重新从文件读取有效token
      const validTokens = await this.readValidTokensFromFile();
      
      // 检查token是否仍然在文件中
      if (!validTokens.includes(token)) {
        // token不在文件中，从缓存中移除
        this.tokenCache.delete(token);
        
        secureLogger.info('Token removed from cache (no longer in file)', {
          tokenSubstr: token.substring(0, 8) + '...',
          userId: cacheItem.userId
        });
        
        return false; // token已被移除
      }
      
      // token仍然有效，更新过期时间
      cacheItem.expiresAt = new Date(Date.now() + this.cacheTTL);
      this.tokenCache.set(token, cacheItem);
      
      secureLogger.debug('File-based token expiry extended', {
        tokenSubstr: token.substring(0, 8) + '...',
        newExpiresAt: cacheItem.expiresAt.toISOString(),
        userId: cacheItem.userId
      });
      
      return true;
    } catch (error) {
      secureLogger.error('Failed to refresh file-based token', {
        error: error instanceof Error ? error.message : String(error),
        tokenSubstr: token.substring(0, 8) + '...',
        tokenFile: this.config.tokenFile
      });
      return false;
    }
  }

  /**
   * 强制刷新API密钥token
   */
  private async forceRefreshApiKeyToken(
    token: string, 
    cacheItem: TokenCacheItem,
    options?: {
      skipValidation?: boolean;
      force?: boolean;
    }
  ): Promise<boolean> {
    try {
      // API密钥通常不会过期，只需要重新验证
      const isValid = await this.verifyApiKeyForRefresh(token, cacheItem);
      
      if (isValid) {
        // 更新过期时间
        cacheItem.expiresAt = new Date(Date.now() + this.cacheTTL);
        this.tokenCache.set(token, cacheItem);
        
        secureLogger.debug('API key token validated and extended', {
          tokenSubstr: token.substring(0, 8) + '...',
          newExpiresAt: cacheItem.expiresAt.toISOString(),
          userId: cacheItem.userId
        });
        
        return true;
      } else {
        // API密钥无效，从缓存中移除
        this.tokenCache.delete(token);
        
        secureLogger.warn('API key token removed (validation failed)', {
          tokenSubstr: token.substring(0, 8) + '...',
          userId: cacheItem.userId
        });
        
        return false;
      }
    } catch (error) {
      secureLogger.error('Failed to refresh API key token', {
        error: error instanceof Error ? error.message : String(error),
        tokenSubstr: token.substring(0, 8) + '...'
      });
      return false;
    }
  }

  /**
   * 为刷新验证API密钥
   */
  private async verifyApiKeyForRefresh(token: string, cacheItem: TokenCacheItem): Promise<boolean> {
    try {
      // 根据提供商验证API密钥
      switch (this.extractProviderFromToken(token)) {
        case 'iflow':
          return this.verifyIflowApiKeyInternal(token);
        case 'qwen':
          return this.verifyQwenApiKeyInternal(token);
        default:
          return this.verifyGenericApiKeyInternal(token);
      }
    } catch (error) {
      secureLogger.error('Failed to verify API key for refresh', {
        error: error instanceof Error ? error.message : String(error),
        tokenSubstr: token.substring(0, 8) + '...'
      });
      return false;
    }
  }

  /**
   * 验证Iflow API密钥（内部实现）
   */
  private verifyIflowApiKeyInternal(apiKey: string): boolean {
    // iflow API密钥格式验证
    return typeof apiKey === 'string' && 
           apiKey.startsWith('sk-') && 
           apiKey.length >= 32 &&
           /^[a-zA-Z0-9\-_]+$/.test(apiKey);
  }

  /**
   * 验证Qwen API密钥（内部实现）
   */
  private verifyQwenApiKeyInternal(apiKey: string): boolean {
    // Qwen API密钥格式验证
    return typeof apiKey === 'string' && 
           (apiKey.startsWith('qwen-') || apiKey.length >= 20) &&
           /^[a-zA-Z0-9\-_]+$/.test(apiKey);
  }

  /**
   * 通用API密钥验证（内部实现）
   */
  private verifyGenericApiKeyInternal(apiKey: string): boolean {
    // 通用API密钥验证
    return typeof apiKey === 'string' && 
           apiKey.length >= 10 &&
           /^[a-zA-Z0-9\-_]+$/.test(apiKey);
  }

  /**
   * 从token中提取提供商信息
   */
  private extractProviderFromToken(token: string): string {
    // 这里根据token的格式来提取提供商信息
    // 实际实现中需要根据业务逻辑调整
    if (token.startsWith('sk-')) {
      return 'iflow';
    } else if (token.startsWith('qwen-')) {
      return 'qwen';
    } else if (token.includes('lmstudio')) {
      return 'lmstudio';
    }
    return 'unknown';
  }

  
  /**
   * 重建OAuth2认证
   */
  private async rebuildOAuth2Auth(): Promise<void> {
    try {
      // 获取新的访问token
      const newToken = await this.getOAuth2AccessToken();
      if (newToken) {
        this.tokenCache.set(newToken, {
          token: newToken,
          userId: 'oauth2-user',
          expiresAt: new Date(Date.now() + this.cacheTTL)
        });
      }
    } catch (error) {
      secureLogger.error('Failed to rebuild OAuth2 auth', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 重建基于文件的认证
   */
  private async rebuildFileBasedAuth(): Promise<void> {
    try {
      // 重新从文件读取有效token
      const validTokens = await this.readValidTokensFromFile();
      
      // 重新缓存token
      this.tokenCache.clear();
      for (const token of validTokens) {
        this.tokenCache.set(token, {
          token: token,
          userId: 'file-user',
          expiresAt: new Date(Date.now() + this.cacheTTL)
        });
      }
    } catch (error) {
      secureLogger.error('Failed to rebuild file-based auth', {
        error: error instanceof Error ? error.message : String(error),
        tokenFile: this.config.tokenFile
      });
      throw error;
    }
  }

  /**
   * 判断token是否属于指定提供商
   */
  private doesTokenBelongToProvider(token: string, provider: string): boolean {
    // 这里需要根据实际的token结构来判断
    // 当前实现只返回true，实际使用时需要根据业务逻辑实现
    return true;
  }

  /**
   * 获取受影响的流水线列表
   */
  private getAffectedPipelinesForProvider(provider?: string): string[] {
    // 这里需要与PipelineManager集成，获取受影响的流水线
    // 当前实现返回流水线ID占位符，实际使用时需要连接真实的PipelineManager
    return [
      `pipeline-${provider || 'unknown'}-1`,
      `pipeline-${provider || 'unknown'}-2`
    ];
  }

  /**
   * 重置维护状态
   */
  private resetMaintenanceStatus(): void {
    this.activeRefresh = false;
    this.activeRebuild = false;
    this.lastRefreshAt = null;
    this.lastRebuildAt = null;
  }

  // ===== Qwen Device Flow 实现 =====

  /**
   * 检查和获取Auth模块的refreshAuthFile方法
   * @param authFile auth文件名
   * @returns Promise<{success: boolean; newToken?: any; error?: string}>
   */
  async refreshAuthFile(authFile: string): Promise<{success: boolean; newToken?: any; error?: string}> {
    try {
      // 检查当前token状态
      const currentStatus = await this.checkCurrentTokenStatus(authFile);
      if (currentStatus.valid && !currentStatus.expiringSoon) {
        return {
          success: true,
          newToken: currentStatus.tokenData
        };
      }

      secureLogger.info('Token expired or expiring soon, starting refresh', {
        authFile,
        expired: !currentStatus.valid,
        expiringSoon: currentStatus.expiringSoon
      });

      // 启动完整的Device Flow
      return await this.startQwenDeviceFlow(authFile);
    } catch (error) {
      secureLogger.error('Auth file refresh failed', {
        authFile,
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 检查当前token状态
   * @param authFile auth文件名
   * @returns Promise<{valid: boolean; expiringSoon: boolean; tokenData?: any}>
   */
  private async checkCurrentTokenStatus(authFile: string): Promise<{valid: boolean; expiringSoon: boolean; tokenData?: any}> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const authDirectory = path.join(process.env.HOME || process.env.USERPROFILE || '', '.route-claudecode', 'auth');
      const authFilePath = path.join(authDirectory, authFile + (authFile.endsWith('.json') ? '' : '.json'));
      
      if (!fs.existsSync(authFilePath)) {
        return { valid: false, expiringSoon: false };
      }
      
      const authData = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));
      const now = Date.now();
      const expiresAt = authData.expires_at || 0;
      const oneHourFromNow = now + (60 * 60 * 1000); // 1小时
      
      return {
        valid: expiresAt > now,
        expiringSoon: expiresAt <= oneHourFromNow && expiresAt > now,
        tokenData: authData
      };
    } catch (error) {
      secureLogger.error('Failed to check token status', {
        authFile,
        error: error instanceof Error ? error.message : String(error)
      });
      return { valid: false, expiringSoon: false };
    }
  }

  /**
   * 启动Qwen Device Flow完整流程
   * @param authFile auth文件名
   * @returns Promise<{success: boolean; newToken?: any; error?: string}>
   */
  async startQwenDeviceFlow(authFile: string): Promise<{success: boolean; newToken?: any; error?: string}> {
    try {
      secureLogger.info('Starting complete Qwen Device Flow', { authFile });

      // Step 1: 发起Device Flow获取用户代码
      const deviceFlowResponse = await this.initiateQwenDeviceFlow();
      if (!deviceFlowResponse.success) {
        return {
          success: false,
          error: `Device Flow initiation failed: ${deviceFlowResponse.error}`
        };
      }

      const { device_code, user_code, verification_uri_complete, expires_in } = deviceFlowResponse.data;
      
      // Step 2: 打开浏览器让用户授权
      await this.openBrowserForQwenAuth(verification_uri_complete, user_code);

      // Step 3: 轮询获取token（增强版本，包含code_verifier）
      const tokenResult = await this.pollForQwenToken(device_code, expires_in, deviceFlowResponse.data.code_verifier);
      if (!tokenResult.success) {
        return {
          success: false,
          error: `Token polling failed: ${tokenResult.error}`
        };
      }

      // Step 4: 保存新token到auth文件
      const saveResult = await this.saveQwenTokenToFile(authFile, tokenResult.data);
      if (!saveResult.success) {
        return {
          success: false,
          error: `Token save failed: ${saveResult.error}`
        };
      }

      // Step 5: 验证新token有效性
      const isValid = await this.verifyQwenTokenValidity(tokenResult.data.access_token);
      if (!isValid) {
        return {
          success: false,
          error: 'New token validation failed'
        };
      }

      secureLogger.info('Qwen Device Flow completed successfully', { 
        authFile,
        tokenPreview: tokenResult.data.access_token.substring(0, 20) + '...'
      });

      return {
        success: true,
        newToken: tokenResult.data
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      secureLogger.error('Qwen Device Flow failed', {
        error: errorMessage,
        authFile
      });
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 发起Qwen Device Flow请求
   */
  private async initiateQwenDeviceFlow(): Promise<{success: boolean, data?: any, error?: string}> {
    try {
      const https = require('https');
      const { URL } = require('url');
      
      const deviceCodeEndpoint = 'https://chat.qwen.ai/api/v1/oauth2/device/code';
      const clientId = 'f0304373b74a44d2b584a3fb70ca9e56';
      const scope = 'openid profile email model.completion';
      
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);
      
      const postData = new URLSearchParams({
        client_id: clientId,
        scope: scope,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      }).toString();
      
      const url = new URL(deviceCodeEndpoint);
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      return new Promise((resolve) => {
        const req = https.request(options, (res: any) => {
          let data = '';
          
          res.on('data', (chunk: any) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                const response = JSON.parse(data);
                // 保存code_verifier用于后续轮询
                response.code_verifier = codeVerifier;
                resolve({
                  success: true,
                  data: response
                });
              } else {
                resolve({
                  success: false,
                  error: `HTTP ${res.statusCode}: ${data}`
                });
              }
            } catch (error) {
              resolve({
                success: false,
                error: `JSON parse error: ${error instanceof Error ? error.message : String(error)}`
              });
            }
          });
        });
        
        req.on('error', (error: any) => {
          resolve({
            success: false,
            error: `Request error: ${error.message}`
          });
        });
        
        req.write(postData);
        req.end();
      });
      
    } catch (error) {
      return {
        success: false,
        error: `Device flow initiation error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 打开浏览器进行Qwen授权
   */
  private async openBrowserForQwenAuth(verificationUrl: string, userCode: string): Promise<void> {
    try {
      const { exec } = require('child_process');
      
      console.log('\n' + '='.repeat(80));
      console.log('🔐 Qwen Device Flow授权');
      console.log('='.repeat(80));
      console.log(`📋 用户代码: ${userCode}`);
      console.log(`🔗 授权地址: ${verificationUrl}`);
      console.log('\n🚀 正在打开浏览器进行授权...');
      
      // 构建完整的授权URL
      const fullAuthUrl = verificationUrl || `https://chat.qwen.ai/authorize?user_code=${userCode}&client=qwen-code`;
      
      // 打开浏览器
      let command = '';
      if (process.platform === 'darwin') {
        command = `open "${fullAuthUrl}"`;
      } else if (process.platform === 'win32') {
        command = `start "${fullAuthUrl}"`;
      } else {
        command = `xdg-open "${fullAuthUrl}"`;
      }
      
      exec(command, (error: any) => {
        if (error) {
          console.log('❌ 无法自动打开浏览器，请手动访问:');
          console.log(`🔗 ${fullAuthUrl}`);
          secureLogger.warn('Failed to open browser automatically', {
            error: error.message,
            url: fullAuthUrl
          });
        } else {
          console.log('✅ 浏览器已打开授权页面');
          secureLogger.info('Browser opened for Qwen authorization', {
            url: fullAuthUrl,
            userCode: userCode
          });
        }
      });
      
      console.log('\n💡 授权步骤:');
      console.log(`   1. 在打开的页面中确认用户代码: ${userCode}`);
      console.log('   2. 点击授权按钮完成授权');
      console.log('   3. 系统将自动获取访问令牌');
      console.log('='.repeat(80) + '\n');
      
    } catch (error) {
      secureLogger.error('Failed to open browser for Qwen auth', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 轮询获取Qwen token（增强版本）
   */
  private async pollForQwenToken(deviceCode: string, expiresIn: number, codeVerifier?: string): Promise<{success: boolean, data?: any, error?: string}> {
    try {
      const pollInterval = 5000; // 5秒间隔
      const maxAttempts = Math.floor(expiresIn / 5); // 根据过期时间计算最大尝试次数
      const tokenEndpoint = 'https://chat.qwen.ai/api/v1/oauth2/token';
      const clientId = 'f0304373b74a44d2b584a3fb70ca9e56';

      secureLogger.info('Starting token polling', {
        deviceCode: deviceCode.substring(0, 20) + '...',
        maxAttempts,
        pollInterval
      });

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`🔄 轮询Token (${attempt}/${maxAttempts})...`);

        const tokenResult = await this.pollQwenTokenEndpoint(tokenEndpoint, clientId, deviceCode, codeVerifier);
        
        if (tokenResult.success) {
          console.log('✅ Token获取成功!');
          return tokenResult;
        }

        // 处理OAuth2标准错误
        if (tokenResult.error === 'authorization_pending') {
          console.log('⏳ 等待用户授权...');
          await this.sleep(pollInterval);
          continue;
        } else if (tokenResult.error === 'slow_down') {
          console.log('⚠️ 请求过于频繁，增加间隔...');
          await this.sleep(pollInterval * 2);
          continue;
        } else if (tokenResult.error === 'expired_token') {
          return {
            success: false,
            error: 'Device code expired, please restart authorization'
          };
        } else if (tokenResult.error === 'access_denied') {
          return {
            success: false,
            error: 'User denied authorization'
          };
        } else {
          // 其他错误继续尝试
          console.log(`⚠️ 轮询错误: ${tokenResult.error}`);
          await this.sleep(pollInterval);
          continue;
        }
      }

      return {
        success: false,
        error: 'Authorization timeout - please try again'
      };

    } catch (error) {
      return {
        success: false,
        error: `Token polling error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 轮询token端点（增强版本）
   */
  private async pollQwenTokenEndpoint(tokenEndpoint: string, clientId: string, deviceCode: string, codeVerifier?: string): Promise<{success: boolean, data?: any, error?: string}> {
    return new Promise((resolve) => {
      const https = require('https');
      const { URL } = require('url');
      
      const postData = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: clientId,
        device_code: deviceCode,
        ...(codeVerifier && { code_verifier: codeVerifier })
      }).toString();
      
      const url = new URL(tokenEndpoint);
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = https.request(options, (res: any) => {
        let data = '';
        
        res.on('data', (chunk: any) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (res.statusCode === 200) {
              resolve({
                success: true,
                data: response
              });
            } else {
              // OAuth2标准错误处理
              resolve({
                success: false,
                error: response.error || `HTTP ${res.statusCode}`
              });
            }
          } catch (error) {
            resolve({
              success: false,
              error: 'Response parse error'
            });
          }
        });
      });
      
      req.on('error', (error: any) => {
        resolve({
          success: false,
          error: `Network error: ${error.message}`
        });
      });
      
      req.write(postData);
      req.end();
    });
  }

  /**
   * 保存Qwen token到文件
   */
  private async saveQwenTokenToFile(authFile: string, tokenData: any): Promise<{success: boolean, error?: string}> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const authDirectory = path.join(process.env.HOME || process.env.USERPROFILE || '', '.route-claudecode', 'auth');
      const authFilePath = path.join(authDirectory, authFile + (authFile.endsWith('.json') ? '' : '.json'));
      
      // 确保目录存在
      if (!fs.existsSync(authDirectory)) {
        fs.mkdirSync(authDirectory, { recursive: true });
      }
      
      const newAuthData = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        resource_url: 'chat.qwen.ai',
        expires_at: Date.now() + (tokenData.expires_in * 1000),
        created_at: new Date().toISOString(),
        account_index: 1,
        token_type: tokenData.token_type || 'Bearer',
        scope: tokenData.scope || 'openid profile email model.completion'
      };
      
      fs.writeFileSync(authFilePath, JSON.stringify(newAuthData, null, '\t'));
      
      secureLogger.info('Qwen token saved successfully', {
        authFile: authFilePath,
        expiresAt: new Date(newAuthData.expires_at).toISOString()
      });
      
      return { success: true };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      secureLogger.error('Failed to save Qwen token', {
        error: errorMessage,
        authFile
      });
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 验证Qwen token有效性
   */
  private async verifyQwenTokenValidity(accessToken: string): Promise<boolean> {
    try {
      const https = require('https');
      
      const postData = JSON.stringify({
        model: 'qwen-turbo',
        input: {
          messages: [{ role: 'user', content: 'Test' }]
        },
        parameters: {
          max_tokens: 5,
          temperature: 0.1
        }
      });
      
      return new Promise((resolve) => {
        const options = {
          hostname: 'dashscope.aliyuncs.com',
          port: 443,
          path: '/api/v1/services/aigc/text-generation/generation',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };
        
        const req = https.request(options, (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => data += chunk);
          res.on('end', () => {
            resolve(res.statusCode === 200);
          });
        });
        
        req.on('error', () => resolve(false));
        req.write(postData);
        req.end();
      });
      
    } catch (error) {
      secureLogger.error('Failed to verify Qwen token', {
        error: error instanceof Error ? error.message : String(error),
        tokenPreview: accessToken.substring(0, 20) + '...'
      });
      return false;
    }
  }

  /**
   * 生成PKCE code verifier
   */
  private generateCodeVerifier(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * 生成PKCE code challenge
   */
  private generateCodeChallenge(codeVerifier: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}