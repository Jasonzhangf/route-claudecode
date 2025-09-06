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
import { RCCError, RCCErrorCode } from '../types/src';

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

/**
 * 认证模块实现
 */
export class AuthenticationModule extends BaseModule {
  protected config: AuthConfig;
  private tokenCache: Map<string, TokenCacheItem> = new Map();
  private cacheTTL: number;

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
}