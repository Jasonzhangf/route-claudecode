/**
 * CodeWhisperer Token Rotation Manager
 * 管理多个CodeWhisperer tokens的轮询使用，自动刷新和故障切换
 */

import { logger } from '@/utils/logger';
import { CodeWhispererAuth, TokenData } from './auth';

export interface TokenState {
  tokenPath: string;
  index: number;
  isActive: boolean;
  lastUsed: Date;
  consecutiveErrors: number;
  tempDisabledUntil?: Date;
  totalRequests: number;
  successfulRequests: number;
  lastRefreshAttempt?: Date;
  refreshFailures: number;
  profileArn?: string;
  description?: string;
}

export interface TokenRotationConfig {
  strategy: 'round_robin' | 'health_based' | 'least_used';
  cooldownMs: number;
  maxRetriesPerToken: number;
  tempDisableCooldownMs: number;
  maxRefreshFailures: number;
  refreshRetryIntervalMs: number;
}

export class CodeWhispererTokenRotationManager {
  private tokens: TokenState[] = [];
  private currentIndex = 0;
  private config: TokenRotationConfig;
  private providerId: string;
  private authManagers: Map<string, CodeWhispererAuth> = new Map();

  constructor(
    tokenConfigs: Array<{path: string, profileArn?: string, description?: string}> | string[],
    providerId: string,
    config: Partial<TokenRotationConfig> = {}
  ) {
    this.providerId = providerId;
    this.config = {
      strategy: config.strategy || 'health_based',
      cooldownMs: config.cooldownMs || 5000,
      maxRetriesPerToken: config.maxRetriesPerToken || 2,
      tempDisableCooldownMs: config.tempDisableCooldownMs || 300000, // 5分钟临时禁用
      maxRefreshFailures: config.maxRefreshFailures || 3,
      refreshRetryIntervalMs: config.refreshRetryIntervalMs || 60000, // 1分钟重试间隔
      ...config
    };

    // 初始化token配置
    this.initializeTokens(tokenConfigs);

    logger.info('CodeWhisperer token rotation manager initialized', {
      providerId: this.providerId,
      tokenCount: this.tokens.length,
      strategy: this.config.strategy,
      cooldownMs: this.config.cooldownMs
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
      isActive: true,
      lastUsed: new Date(0),
      consecutiveErrors: 0,
      totalRequests: 0,
      successfulRequests: 0,
      refreshFailures: 0,
      profileArn: config.profileArn,
      description: config.description
    }));

    // 为每个token初始化认证管理器
    for (const tokenState of this.tokens) {
      try {
        const auth = new CodeWhispererAuth(tokenState.tokenPath, tokenState.profileArn);
        this.authManagers.set(tokenState.tokenPath, auth);
        
        logger.debug('Initialized auth manager for token', {
          tokenPath: tokenState.tokenPath,
          description: tokenState.description,
          hasProfileArn: !!tokenState.profileArn
        });
      } catch (error) {
        logger.error('Failed to initialize auth manager for token', {
          tokenPath: tokenState.tokenPath,
          error: error instanceof Error ? error.message : String(error)
        });
        tokenState.isActive = false;
      }
    }
  }

  /**
   * 获取下一个可用的token
   */
  async getNextToken(requestId?: string): Promise<{ token: string; tokenPath: string; auth: CodeWhispererAuth }> {
    const availableTokenState = this.selectBestToken();
    
    if (!availableTokenState) {
      // 尝试重置错误状态并重试
      this.resetErrorStates();
      const fallbackTokenState = this.selectBestToken();
      
      if (!fallbackTokenState) {
        throw new Error(`No CodeWhisperer tokens available for provider ${this.providerId}`);
      }
      
      return this.getTokenFromState(fallbackTokenState, requestId);
    }
    
    return this.getTokenFromState(availableTokenState, requestId);
  }

  private async getTokenFromState(tokenState: TokenState, requestId?: string): Promise<{ token: string; tokenPath: string; auth: CodeWhispererAuth }> {
    const auth = this.authManagers.get(tokenState.tokenPath);
    if (!auth) {
      throw new Error(`Auth manager not found for token: ${tokenState.tokenPath}`);
    }

    try {
      // 尝试获取token，如果过期会自动刷新
      const token = await auth.getToken(requestId || 'token-rotation');
      
      // 更新使用统计
      tokenState.lastUsed = new Date();
      tokenState.totalRequests++;
      
      logger.debug('Selected token for request', {
        tokenPath: tokenState.tokenPath,
        description: tokenState.description,
        totalRequests: tokenState.totalRequests,
        requestId
      });
      
      return { token, tokenPath: tokenState.tokenPath, auth };
    } catch (error) {
      logger.error('Failed to get token from selected auth manager', {
        tokenPath: tokenState.tokenPath,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // 标记此token为失败
      this.reportTokenFailure(tokenState.tokenPath, error);
      
      // 递归尝试下一个token
      return this.getNextToken(requestId);
    }
  }

  private selectBestToken(): TokenState | null {
    const now = new Date();
    
    // 过滤可用的tokens
    const availableTokens = this.tokens.filter(token => {
      // 检查是否临时禁用
      if (token.tempDisabledUntil && now < token.tempDisabledUntil) {
        return false;
      }
      
      // 检查是否因为刷新失败而禁用
      if (!token.isActive) {
        return false;
      }
      
      return true;
    });

    if (availableTokens.length === 0) {
      return null;
    }

    switch (this.config.strategy) {
      case 'round_robin':
        return this.selectRoundRobin(availableTokens);
      
      case 'health_based':
        return this.selectHealthBased(availableTokens);
      
      case 'least_used':
        return this.selectLeastUsed(availableTokens);
      
      default:
        return availableTokens[0];
    }
  }

  private selectRoundRobin(availableTokens: TokenState[]): TokenState {
    // 简单轮询选择
    this.currentIndex = (this.currentIndex + 1) % availableTokens.length;
    return availableTokens[this.currentIndex];
  }

  private selectHealthBased(availableTokens: TokenState[]): TokenState {
    // 根据健康状态选择最佳token
    return availableTokens.sort((a, b) => {
      // 优先级：错误次数最少，使用最久，成功率最高
      const aErrorScore = a.consecutiveErrors * 10;
      const bErrorScore = b.consecutiveErrors * 10;
      
      const aSuccessRate = a.totalRequests > 0 ? a.successfulRequests / a.totalRequests : 1;
      const bSuccessRate = b.totalRequests > 0 ? b.successfulRequests / b.totalRequests : 1;
      
      const aTimeSinceUsed = Date.now() - a.lastUsed.getTime();
      const bTimeSinceUsed = Date.now() - b.lastUsed.getTime();
      
      const aScore = aErrorScore - (aSuccessRate * 5) + (aTimeSinceUsed / 60000); // 时间差转分钟
      const bScore = bErrorScore - (bSuccessRate * 5) + (bTimeSinceUsed / 60000);
      
      return aScore - bScore;
    })[0];
  }

  private selectLeastUsed(availableTokens: TokenState[]): TokenState {
    // 选择使用次数最少的token
    return availableTokens.sort((a, b) => a.totalRequests - b.totalRequests)[0];
  }

  /**
   * 报告token使用成功
   */
  reportTokenSuccess(tokenPath: string, requestId?: string): void {
    const tokenState = this.tokens.find(t => t.tokenPath === tokenPath);
    if (!tokenState) return;

    tokenState.consecutiveErrors = 0;
    tokenState.successfulRequests++;
    tokenState.refreshFailures = 0;
    tokenState.tempDisabledUntil = undefined;
    
    if (!tokenState.isActive) {
      tokenState.isActive = true;
      logger.info('Token re-enabled after successful request', {
        tokenPath,
        description: tokenState.description,
        requestId
      });
    }

    logger.debug('Token success reported', {
      tokenPath,
      description: tokenState.description,
      successfulRequests: tokenState.successfulRequests,
      totalRequests: tokenState.totalRequests,
      requestId
    });
  }

  /**
   * 报告token使用失败
   */
  reportTokenFailure(tokenPath: string, error: any, statusCode?: number): void {
    const tokenState = this.tokens.find(t => t.tokenPath === tokenPath);
    if (!tokenState) return;

    tokenState.consecutiveErrors++;
    
    logger.warn('Token failure reported', {
      tokenPath,
      description: tokenState.description,
      consecutiveErrors: tokenState.consecutiveErrors,
      statusCode,
      error: error instanceof Error ? error.message : String(error)
    });

    // 如果是认证错误，尝试刷新token
    if (statusCode === 401 || statusCode === 403) {
      this.attemptTokenRefresh(tokenState);
    }

    // 连续错误达到阈值时临时禁用
    if (tokenState.consecutiveErrors >= this.config.maxRetriesPerToken) {
      this.temporarilyDisableToken(tokenState);
    }
  }

  private async attemptTokenRefresh(tokenState: TokenState): Promise<void> {
    const auth = this.authManagers.get(tokenState.tokenPath);
    if (!auth) return;

    const now = new Date();
    
    // 检查是否过于频繁地尝试刷新
    if (tokenState.lastRefreshAttempt && 
        (now.getTime() - tokenState.lastRefreshAttempt.getTime()) < this.config.refreshRetryIntervalMs) {
      logger.debug('Skipping token refresh - too soon since last attempt', {
        tokenPath: tokenState.tokenPath
      });
      return;
    }

    tokenState.lastRefreshAttempt = now;

    try {
      logger.info('Attempting token refresh', {
        tokenPath: tokenState.tokenPath,
        description: tokenState.description
      });

      // 尝试刷新token
      await auth.handleAuthError('token-rotation-refresh');
      
      // 刷新成功，重置失败计数
      tokenState.refreshFailures = 0;
      tokenState.consecutiveErrors = 0;
      
      logger.info('Token refresh successful', {
        tokenPath: tokenState.tokenPath,
        description: tokenState.description
      });
      
    } catch (error) {
      tokenState.refreshFailures++;
      
      logger.error('Token refresh failed', {
        tokenPath: tokenState.tokenPath,
        description: tokenState.description,
        refreshFailures: tokenState.refreshFailures,
        error: error instanceof Error ? error.message : String(error)
      });

      // 刷新失败次数过多时禁用token
      if (tokenState.refreshFailures >= this.config.maxRefreshFailures) {
        tokenState.isActive = false;
        logger.warn('Token disabled due to repeated refresh failures', {
          tokenPath: tokenState.tokenPath,
          description: tokenState.description,
          refreshFailures: tokenState.refreshFailures
        });
      }
    }
  }

  private temporarilyDisableToken(tokenState: TokenState): void {
    const disableUntil = new Date(Date.now() + this.config.tempDisableCooldownMs);
    tokenState.tempDisabledUntil = disableUntil;
    
    logger.warn('Token temporarily disabled', {
      tokenPath: tokenState.tokenPath,
      description: tokenState.description,
      consecutiveErrors: tokenState.consecutiveErrors,
      disabledUntil: disableUntil.toISOString(),
      cooldownMinutes: this.config.tempDisableCooldownMs / 60000
    });
  }

  /**
   * 重置所有token的错误状态（紧急情况下使用）
   */
  private resetErrorStates(): void {
    logger.warn('Resetting all token error states', {
      providerId: this.providerId
    });
    
    for (const token of this.tokens) {
      token.consecutiveErrors = 0;
      token.tempDisabledUntil = undefined;
      if (!token.isActive && token.refreshFailures < this.config.maxRefreshFailures) {
        token.isActive = true;
      }
    }
  }

  /**
   * 获取token状态信息
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
      isActive: token.isActive,
      totalRequests: token.totalRequests,
      successfulRequests: token.successfulRequests,
      successRate: token.totalRequests > 0 ? 
        Math.round((token.successfulRequests / token.totalRequests) * 100) / 100 : 0,
      consecutiveErrors: token.consecutiveErrors,
      refreshFailures: token.refreshFailures,
      lastUsed: token.lastUsed.toISOString(),
      tempDisabledUntil: token.tempDisabledUntil?.toISOString()
    }));
  }

  /**
   * 清理资源
   */
  destroy(): void {
    for (const auth of this.authManagers.values()) {
      auth.destroy();
    }
    this.authManagers.clear();
  }
}