/**
 * CodeWhisperer Authentication - Demo2 Style
 * 完全模仿Demo2的简单直接token管理方式：错了马上刷新，无复杂限制
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import axios from 'axios';
import { logger } from '@/utils/logger';

// Demo2完全一致的数据结构
export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export class CodeWhispererAuthDemo2 {
  private tokenPath: string;
  private configProfileArn?: string;

  constructor(customTokenPath?: string, profileArn?: string) {
    this.configProfileArn = profileArn;
    this.tokenPath = customTokenPath ? this.expandPath(customTokenPath) : this.getTokenFilePath();
  }

  /**
   * Demo2风格: 简单路径扩展
   */
  private expandPath(path: string): string {
    if (path.startsWith('~')) {
      return path.replace('~', homedir());
    }
    return path;
  }

  /**
   * Demo2风格: 获取token文件路径
   */
  private getTokenFilePath(): string {
    return `${homedir()}/.kiro2cc/auth_files/kiro-auth-token.json`;
  }

  /**
   * Demo2风格: 直接读取token文件
   */
  private readTokenFromFile(): TokenData {
    if (!existsSync(this.tokenPath)) {
      throw new Error(`Token file not found: ${this.tokenPath}`);
    }

    try {
      const tokenContent = readFileSync(this.tokenPath, 'utf8');
      const tokenData: TokenData = JSON.parse(tokenContent);
      
      if (!tokenData.accessToken || !tokenData.refreshToken) {
        throw new Error('Invalid token file: missing required fields');
      }
      
      return tokenData;
    } catch (error) {
      throw new Error(`Failed to read token file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Demo2风格: 检查token是否过期 (简单检查)
   */
  private isTokenExpired(tokenData: TokenData): boolean {
    if (!tokenData.expiresAt) {
      return true; // 没有过期时间就认为过期
    }
    
    const expiresAt = new Date(tokenData.expiresAt);
    const now = new Date();
    
    // Demo2风格: 提前5分钟就认为过期
    const bufferTime = 5 * 60 * 1000; // 5分钟缓冲
    return (expiresAt.getTime() - now.getTime()) < bufferTime;
  }

  /**
   * Demo2风格: 刷新单个token - 错了马上刷新，无限制
   */
  private async refreshToken(currentToken: TokenData): Promise<TokenData> {
    logger.info('🔄 Demo2风格刷新token - 错了马上刷新');

    const refreshRequest: RefreshRequest = {
      refreshToken: currentToken.refreshToken
    };

    try {
      const response = await axios.post(
        'https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken',
        refreshRequest,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000 // Demo2风格: 10秒超时
        }
      );

      if (response.status !== 200) {
        throw new Error(`Token refresh failed with status ${response.status}`);
      }

      // Demo2风格: 直接使用响应数据，保持原有字段
      const newTokenData: TokenData = {
        ...currentToken, // 保持所有现有字段
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        expiresAt: response.data.expiresAt
      };

      // Demo2风格: 立即写入文件
      this.writeTokenToFile(newTokenData);
      
      logger.info('✅ Token刷新成功 (Demo2风格)');
      return newTokenData;

    } catch (error) {
      logger.error('❌ Token刷新失败', error);
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Demo2风格: 写入token文件
   */
  private writeTokenToFile(tokenData: TokenData): void {
    try {
      const tokenContent = JSON.stringify(tokenData, null, 2);
      writeFileSync(this.tokenPath, tokenContent, { mode: 0o600 });
      logger.debug('Token已写入文件');
    } catch (error) {
      throw new Error(`Failed to write token file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Demo2风格: 获取token - 过期了马上刷新
   */
  async getToken(requestId?: string): Promise<string> {
    try {
      // 1. 读取token
      let tokenData = this.readTokenFromFile();
      
      // 2. Demo2风格: 过期了马上刷新，无任何限制
      if (this.isTokenExpired(tokenData)) {
        logger.info('🕐 Token过期，马上刷新 (Demo2风格)');
        tokenData = await this.refreshToken(tokenData);
      }
      
      logger.debug('✅ 获取token成功', {
        tokenPath: this.tokenPath,
        expiresAt: tokenData.expiresAt,
        requestId
      });
      
      return tokenData.accessToken;

    } catch (error) {
      logger.error('❌ 获取token失败', error);
      throw new Error(`CodeWhisperer authentication failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Demo2风格: 处理认证错误 - 马上刷新，无限制
   */
  async handleAuthError(requestId?: string): Promise<string> {
    logger.warn('🚨 认证错误，马上刷新token (Demo2风格)');
    
    try {
      const tokenData = this.readTokenFromFile();
      const refreshedToken = await this.refreshToken(tokenData);
      
      logger.info('✅ 认证错误处理完成，token已刷新');
      return refreshedToken.accessToken;
      
    } catch (error) {
      logger.error('❌ 认证错误处理失败', error);
      throw new Error(`Authentication error handling failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Demo2风格: 获取ProfileArn
   */
  getProfileArn(): string | undefined {
    if (this.configProfileArn) {
      return this.configProfileArn;
    }

    try {
      const tokenData = this.readTokenFromFile();
      return (tokenData as any).profileArn;
    } catch (error) {
      logger.debug('无法从token文件获取profileArn', error);
      return undefined;
    }
  }

  /**
   * Demo2风格: 启动时验证token
   */
  async validateAndRefreshOnStartup(): Promise<void> {
    try {
      logger.info('🚀 启动时验证token (Demo2风格)');
      
      const tokenData = this.readTokenFromFile();
      
      if (this.isTokenExpired(tokenData)) {
        logger.info('启动时发现token过期，马上刷新');
        await this.refreshToken(tokenData);
        logger.info('启动时token刷新完成');
      } else {
        logger.info('启动时token验证通过');
      }
    } catch (error) {
      logger.error('启动时token验证失败', error);
      // Demo2风格: 不阻塞启动，运行时再处理
    }
  }

  /**
   * Demo2风格: 重置失败计数 (简化版)
   */
  resetFailureCount(): void {
    // Demo2风格: 无复杂的失败计数机制
    logger.debug('重置失败计数 (Demo2风格)');
  }

  /**
   * Demo2风格: 检查token是否被阻塞 (移除保护机制)
   */
  isTokenBlocked(): boolean {
    // Demo2风格: 永远不阻塞token，错了马上重试
    return false;
  }

  /**
   * 清理资源
   */
  destroy(): void {
    logger.debug('清理认证资源 (Demo2风格)');
  }
}