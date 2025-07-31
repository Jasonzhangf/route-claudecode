/**
 * CodeWhisperer Token Rotation Manager
 * 管理多个CodeWhisperer tokens的轮询使用，自动刷新和故障切换
 */

import { logger } from '@/utils/logger';
import { CodeWhispererAuthDemo2 } from './auth-demo2-style';

export interface TokenState {
  tokenPath: string;
  index: number;
  description?: string;
  profileArn?: string;
  isActive?: boolean;
  totalRequests?: number;
  successfulRequests?: number;
  consecutiveErrors?: number;
  refreshFailures?: number;
  lastUsed?: Date;
  tempDisabledUntil?: Date;
}

export interface TokenRotationConfig {
  strategy: 'round_robin' | 'health_based' | 'least_used';
  cooldownMs?: number;
  maxRetriesPerToken?: number;
  tempDisableCooldownMs?: number;
  maxRefreshFailures?: number;
  refreshRetryIntervalMs?: number;
}

export class CodeWhispererTokenRotationManager {
  private tokens: TokenState[] = [];
  private currentIndex = 0;
  private providerId: string;
  private authManagers: Map<string, CodeWhispererAuthDemo2> = new Map();

  constructor(
    tokenConfigs: Array<{path: string, profileArn?: string, description?: string}> | string[],
    providerId: string,
    config: Partial<TokenRotationConfig> = {}
  ) {
    this.providerId = providerId;

    // 初始化token配置
    this.initializeTokens(tokenConfigs);

    logger.info('CodeWhisperer token rotation manager initialized (Demo2 style)', {
      providerId: this.providerId,
      tokenCount: this.tokens.length
    });
  }

  private initializeTokens(tokenConfigs: Array<{path: string, profileArn?: string, description?: string}> | string[]) {
    // 处理兼容性：支持字符串数组或对象数组
    const configs = tokenConfigs.map((config, index) => {
      if (typeof config === 'string') {
        return { path: config, description: `Token ${index + 1}` };
      }
      return { ...config, description: config.description || `Token ${index + 1}` };
    });

    this.tokens = configs.map((config, index) => ({
      tokenPath: config.path.trim(),
      index,
      description: config.description,
      profileArn: config.profileArn,
      isActive: true,
      totalRequests: 0,
      successfulRequests: 0,
      consecutiveErrors: 0,
      refreshFailures: 0,
      lastUsed: new Date(),
      tempDisabledUntil: undefined
    }));

    // 为每个token初始化认证管理器
    for (const tokenState of this.tokens) {
      try {
        // 注意：这里使用了新的认证类，需要确认是否应该使用 CodeWhispererAuthDemo2
        const auth = new CodeWhispererAuthDemo2(tokenState.tokenPath, tokenState.profileArn);
        this.authManagers.set(tokenState.tokenPath, auth);
        
        logger.debug('Initialized auth manager for token (Demo2 style)', {
          tokenPath: tokenState.tokenPath,
          description: tokenState.description
        });
      } catch (error) {
        logger.error('Failed to initialize auth manager for token', {
          tokenPath: tokenState.tokenPath,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * 获取下一个可用的token (Demo2风格：简单轮询)
   */
  async getNextToken(requestId?: string): Promise<{ token: string; tokenPath: string }> {
    // 简单轮询选择
    this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
    const selectedToken = this.tokens[this.currentIndex];
    
    const auth = this.authManagers.get(selectedToken.tokenPath);
    if (!auth) {
      throw new Error(`Auth manager not found for token: ${selectedToken.tokenPath}`);
    }

    try {
      // 尝试获取token，如果过期会自动刷新
      const token = await auth.getToken(requestId || 'token-rotation');
      
      logger.debug('Selected token for request (Demo2 style)', {
        tokenPath: selectedToken.tokenPath,
        description: selectedToken.description,
        requestId
      });
      
      return { token, tokenPath: selectedToken.tokenPath };
    } catch (error) {
      logger.error('Failed to get token from selected auth manager', {
        tokenPath: selectedToken.tokenPath,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Demo2风格：错了马上刷新，无限制
      // 直接尝试刷新token
      try {
        const refreshedToken = await auth.handleAuthError(requestId || 'token-rotation');
        logger.info('✅ Token刷新成功，重试请求', {
          tokenPath: selectedToken.tokenPath
        });
        return { token: refreshedToken, tokenPath: selectedToken.tokenPath };
      } catch (refreshError) {
        logger.error('❌ Token刷新失败', {
          tokenPath: selectedToken.tokenPath,
          error: refreshError instanceof Error ? refreshError.message : String(refreshError)
        });
        
        // 如果刷新失败，尝试下一个token
        return this.getNextToken(requestId);
      }
    }
  }

  /**
   * 报告token使用成功 (Demo2风格：简化处理)
   */
  reportTokenSuccess(tokenPath: string, requestId?: string): void {
    logger.debug('Token success reported (Demo2 style)', {
      tokenPath,
      requestId
    });
    // Demo2风格：无复杂的状态跟踪
  }

  /**
   * 报告token使用失败 (Demo2风格：简化处理)
   */
  reportTokenFailure(tokenPath: string, error: any, statusCode?: number): void {
    logger.warn('Token failure reported (Demo2 style)', {
      tokenPath,
      statusCode,
      error: error instanceof Error ? error.message : String(error)
    });
    // Demo2风格：无复杂的失败处理，错了马上刷新
  }

  /**
   * 获取token状态信息 (Demo2风格：简化版本)
   */
  getTokenStats(): Array<{
    tokenPath: string;
    description: string;
    isActive: boolean;
    totalRequests: number;
    successfulRequests: number;
    successRate: number;
    consecutiveErrors: number;
    refreshFailures: number;
    lastUsed: string;
    tempDisabledUntil?: string;
  }> {
    return this.tokens.map(token => ({
      tokenPath: token.tokenPath,
      description: token.description || 'Unknown',
      isActive: token.isActive || false,
      totalRequests: token.totalRequests || 0,
      successfulRequests: token.successfulRequests || 0,
      successRate: token.totalRequests && token.totalRequests > 0 ?
        Math.round((token.successfulRequests! / token.totalRequests!) * 100) / 100 : 0,
      consecutiveErrors: token.consecutiveErrors || 0,
      refreshFailures: token.refreshFailures || 0,
      lastUsed: token.lastUsed?.toISOString() || new Date().toISOString(),
      tempDisabledUntil: token.tempDisabledUntil?.toISOString()
    }));
  }

  /**
   * 清理资源
   */
  destroy(): void {
    const authValues = Array.from(this.authManagers.values());
    for (const auth of authValues) {
      auth.destroy();
    }
    this.authManagers.clear();
  }
}