/**
 * CodeWhisperer Authentication Manager
 * 完全基于demo2 Go代码移植的认证管理
 * 项目所有者: Jason Zhang
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { logger } from '@/utils/logger';
import { TokenData, RefreshRequest, RefreshResponse } from './types';

export class CodeWhispererAuth {
  private static instance: CodeWhispererAuth;
  private tokenCache: TokenData | null = null;
  private lastTokenRead: number = 0;
  private readonly TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  private constructor() {}

  public static getInstance(): CodeWhispererAuth {
    if (!CodeWhispererAuth.instance) {
      CodeWhispererAuth.instance = new CodeWhispererAuth();
    }
    return CodeWhispererAuth.instance;
  }

  /**
   * 获取跨平台的token文件路径 (完全基于demo2的getTokenFilePath)
   */
  private getTokenFilePath(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, '.aws', 'sso', 'cache', 'kiro-auth-token.json');
  }

  /**
   * 获取ProfileArn (基于demo2的token.ProfileArn)
   */
  public async getProfileArn(): Promise<string> {
    try {
      // 先获取token以确保缓存更新
      await this.getToken();
      
      if (this.tokenCache?.profileArn) {
        return this.tokenCache.profileArn;
      }
      
      // 如果token文件中没有profileArn，使用默认值
      const defaultProfileArn = 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK';
      logger.warn('Token文件中未找到profileArn，使用默认值', { defaultProfileArn });
      return defaultProfileArn;
    } catch (error) {
      logger.error('获取ProfileArn失败', error);
      throw error;
    }
  }

  /**
   * 读取token信息 (基于demo2的readToken逻辑)
   */
  public async getToken(): Promise<string> {
    try {
      // 检查缓存是否有效
      const now = Date.now();
      if (this.tokenCache && (now - this.lastTokenRead) < this.TOKEN_CACHE_TTL) {
        return this.tokenCache.accessToken;
      }

      const tokenPath = this.getTokenFilePath();
      
      if (!fs.existsSync(tokenPath)) {
        throw new Error(`Token文件不存在: ${tokenPath}. 请先安装Kiro并登录！`);
      }

      const data = fs.readFileSync(tokenPath, 'utf8');
      const token: TokenData = JSON.parse(data);

      if (!token.accessToken) {
        throw new Error('Token文件中缺少accessToken');
      }

      // 更新缓存
      this.tokenCache = token;
      this.lastTokenRead = now;

      logger.debug('Token读取成功', {
        tokenLength: token.accessToken.length,
        hasRefreshToken: !!token.refreshToken,
        expiresAt: token.expiresAt,
      });

      return token.accessToken;
    } catch (error) {
      logger.error('读取token失败', error);
      throw error;
    }
  }

  /**
   * 刷新token (完全基于demo2的refreshToken)
   */
  public async refreshToken(): Promise<void> {
    try {
      logger.info('开始刷新token...');
      
      const tokenPath = this.getTokenFilePath();
      
      // 读取当前token
      const data = fs.readFileSync(tokenPath, 'utf8');
      const currentToken: TokenData = JSON.parse(data);

      if (!currentToken.refreshToken) {
        throw new Error('当前token中缺少refreshToken，无法刷新');
      }

      // 准备刷新请求 (基于demo2的RefreshRequest)
      const refreshReq: RefreshRequest = {
        refreshToken: currentToken.refreshToken,
      };

      logger.debug('发送token刷新请求', {
        refreshTokenLength: currentToken.refreshToken.length,
      });

      // 发送刷新请求 (基于demo2的HTTP请求)
      const response = await axios.post<RefreshResponse>(
        'https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken',
        refreshReq,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      if (response.status !== 200) {
        throw new Error(`刷新token失败，状态码: ${response.status}`);
      }

      // 更新token文件 (基于demo2的写入逻辑)
      const newToken: TokenData = response.data;
      
      fs.writeFileSync(tokenPath, JSON.stringify(newToken, null, 2), { mode: 0o600 });

      // 更新缓存
      this.tokenCache = newToken;
      this.lastTokenRead = Date.now();

      logger.info('Token刷新成功', {
        newTokenLength: newToken.accessToken.length,
        expiresAt: newToken.expiresAt,
      });

    } catch (error) {
      logger.error('刷新token失败', error);
      // 清除缓存以强制重新读取
      this.tokenCache = null;
      throw error;
    }
  }

  /**
   * 验证token是否有效 (基于demo2的启动时验证逻辑)
   */
  public async validateToken(): Promise<boolean> {
    try {
      const token = await this.getToken();
      
      // 简单验证：检查token格式和长度
      if (!token || token.length < 10) {
        return false;
      }

      logger.debug('Token验证通过', {
        tokenLength: token.length,
      });

      return true;
    } catch (error) {
      logger.warn('Token验证失败', error);
      return false;
    }
  }

  /**
   * 导出环境变量格式 (基于demo2的exportEnvVars)
   */
  public async exportEnvVars(): Promise<string> {
    try {
      const token = await this.getToken();
      
      const isWindows = process.platform === 'win32';
      
      if (isWindows) {
        return [
          'REM CMD格式',
          'set ANTHROPIC_BASE_URL=http://localhost:8080',
          `set ANTHROPIC_API_KEY=${token}`,
          '',
          'REM PowerShell格式',
          '$env:ANTHROPIC_BASE_URL="http://localhost:8080"',
          `$env:ANTHROPIC_API_KEY="${token}"`,
        ].join('\n');
      } else {
        return [
          'export ANTHROPIC_BASE_URL=http://localhost:8080',
          `export ANTHROPIC_API_KEY="${token}"`,
        ].join('\n');
      }
    } catch (error) {
      logger.error('导出环境变量失败', error);
      throw error;
    }
  }

  /**
   * 清除token缓存
   */
  public clearCache(): void {
    this.tokenCache = null;
    this.lastTokenRead = 0;
    logger.debug('Token缓存已清除');
  }
}