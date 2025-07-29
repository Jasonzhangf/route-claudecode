/**
 * 安全Token管理器
 * 实现原子性token验证和监控，防止服务器禁用
 * 
 * 项目所有者: Jason Zhang
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getConfigPaths } from '@/utils/config-paths';
import axios from 'axios';
import { logger } from '@/utils/logger';

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt?: string;
  profileArn?: string;
  authMethod?: string;
  provider?: string;
  // Allow any additional fields to preserve original token structure
  [key: string]: any;
}

interface TokenStatus {
  isValid: boolean;
  shouldBlock: boolean;
  lastValidation: Date;
  failureCount: number;
  nextAllowedCheck: Date | null;
}

export class SafeTokenManager {
  private static instance: SafeTokenManager;
  private tokenPath: string;
  private statusPath: string;
  private monitoringActive = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  
  // 原子操作锁
  private operationLock = false;
  private pendingOperations: (() => void)[] = [];
  
  // 安全配置
  private readonly VALIDATION_TIMEOUT = 5000; // 5秒超时
  private readonly MAX_FAILURES = 3; // 最大失败次数
  private readonly BLOCK_DURATION = 30 * 60 * 1000; // 30分钟阻断
  private readonly MONITOR_INTERVAL = 5 * 60 * 1000; // 5分钟监控间隔
  private readonly VALIDATION_COOLDOWN = 2 * 60 * 1000; // 2分钟验证冷却

  private constructor(customTokenPath?: string) {
    this.tokenPath = customTokenPath || join(homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
    const configPaths = getConfigPaths();
    this.statusPath = join(configPaths.configDir, 'token-status.json');
    
    // 确保状态文件目录存在
    this.ensureStatusDirectory();
    
    // 启动监控
    this.startMonitoring();
  }

  /**
   * 获取单例实例
   */
  static getInstance(customTokenPath?: string): SafeTokenManager {
    if (!SafeTokenManager.instance) {
      SafeTokenManager.instance = new SafeTokenManager(customTokenPath);
    }
    return SafeTokenManager.instance;
  }

  /**
   * 原子性检查token状态 - 核心安全方法
   */
  async checkTokenSafely(): Promise<{ canProceed: boolean; reason: string; token?: string }> {
    return this.executeAtomically(async () => {
      const status = this.loadTokenStatus();
      
      // 检查是否被阻断
      if (status.shouldBlock) {
        const now = new Date();
        if (status.nextAllowedCheck && now < status.nextAllowedCheck) {
          const remainingMinutes = Math.ceil((status.nextAllowedCheck.getTime() - now.getTime()) / (60 * 1000));
          logger.warn(`Token validation blocked for ${remainingMinutes} more minutes due to failures`);
          return {
            canProceed: false,
            reason: `Token validation blocked for ${remainingMinutes} minutes due to previous failures`
          };
        } else {
          // 阻断期结束，重置状态
          status.shouldBlock = false;
          status.failureCount = 0;
          status.nextAllowedCheck = null;
        }
      }

      // 检查验证冷却期
      if (status.lastValidation) {
        const timeSinceLastCheck = Date.now() - status.lastValidation.getTime();
        if (timeSinceLastCheck < this.VALIDATION_COOLDOWN) {
          if (status.isValid) {
            // 冷却期内且上次验证成功，直接返回token
            const tokenData = this.readTokenData();
            return {
              canProceed: true,
              reason: 'Using cached valid token (within cooldown period)',
              token: tokenData.accessToken
            };
          } else {
            // 冷却期内且上次验证失败，不允许请求
            return {
              canProceed: false,
              reason: 'Token invalid and within validation cooldown period'
            };
          }
        }
      }

      // 执行token验证
      try {
        const tokenData = this.readTokenData();
        const isValid = await this.validateTokenSafely(tokenData.accessToken);
        
        if (isValid) {
          // 验证成功
          status.isValid = true;
          status.failureCount = 0;
          status.lastValidation = new Date();
          status.shouldBlock = false;
          status.nextAllowedCheck = null;
          
          this.saveTokenStatus(status);
          
          logger.debug('Token validation successful');
          return {
            canProceed: true,
            reason: 'Token validation successful',
            token: tokenData.accessToken
          };
        } else {
          // 验证失败
          status.isValid = false;
          status.failureCount += 1;
          status.lastValidation = new Date();
          
          if (status.failureCount >= this.MAX_FAILURES) {
            // 达到最大失败次数，启动阻断
            status.shouldBlock = true;
            status.nextAllowedCheck = new Date(Date.now() + this.BLOCK_DURATION);
            
            logger.error(`Token validation failed ${this.MAX_FAILURES} times, blocking for ${this.BLOCK_DURATION / (60 * 1000)} minutes`);
          }
          
          this.saveTokenStatus(status);
          
          return {
            canProceed: false,
            reason: `Token validation failed (${status.failureCount}/${this.MAX_FAILURES} failures)`
          };
        }
      } catch (error) {
        // 验证过程中出现异常
        status.isValid = false;
        status.failureCount += 1;
        status.lastValidation = new Date();
        
        if (status.failureCount >= this.MAX_FAILURES) {
          status.shouldBlock = true;
          status.nextAllowedCheck = new Date(Date.now() + this.BLOCK_DURATION);
        }
        
        this.saveTokenStatus(status);
        
        logger.error('Token validation error', error);
        return {
          canProceed: false,
          reason: `Token validation error: ${(error as Error).message}`
        };
      }
    });
  }

  /**
   * 安全的token验证 - 不会触发服务器禁用
   */
  private async validateTokenSafely(accessToken: string): Promise<boolean> {
    try {
      // 使用轻量级的健康检查端点，避免频繁调用实际API
      const response = await axios.get(process.env.CODEWHISPERER_HEALTH_ENDPOINT || 'https://codewhisperer.us-east-1.amazonaws.com/health', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: this.VALIDATION_TIMEOUT,
        validateStatus: (status) => true // 不抛出异常，手动处理状态码
      });
      
      // 根据响应状态判断token有效性
      if (response.status === 200 || response.status === 404) {
        // 200: 健康检查成功
        // 404: 端点不存在但认证成功
        return true;
      } else if (response.status === 401 || response.status === 403) {
        // 401/403: 认证失败
        return false;
      } else {
        // 其他状态码: 服务器问题，假设token有效
        logger.debug(`Health check returned ${response.status}, assuming token valid`);
        return true;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          // 网络问题，假设token有效
          logger.debug('Network error during token validation, assuming token valid');
          return true;
        } else if (error.response) {
          // 收到HTTP响应，根据状态码判断
          const status = error.response.status;
          return status !== 401 && status !== 403;
        }
      }
      
      // 其他错误，为安全起见返回false
      throw error;
    }
  }

  /**
   * 原子性执行操作
   */
  private async executeAtomically<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeOperation = async () => {
        if (this.operationLock) {
          // 如果有其他操作在进行，排队等待
          this.pendingOperations.push(executeOperation);
          return;
        }
        
        this.operationLock = true;
        
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.operationLock = false;
          
          // 执行下一个排队的操作
          const nextOperation = this.pendingOperations.shift();
          if (nextOperation) {
            setImmediate(nextOperation);
          }
        }
      };
      
      executeOperation();
    });
  }

  /**
   * 读取token数据
   */
  private readTokenData(): TokenData {
    try {
      if (!existsSync(this.tokenPath)) {
        throw new Error('Token file does not exist');
      }
      
      const data = readFileSync(this.tokenPath, 'utf8');
      const tokenData = JSON.parse(data) as TokenData;
      
      if (!tokenData.accessToken || !tokenData.refreshToken) {
        throw new Error('Invalid token file format');
      }
      
      return tokenData;
    } catch (error) {
      throw new Error(`Failed to read token file: ${(error as Error).message}`);
    }
  }

  /**
   * 加载token状态
   */
  private loadTokenStatus(): TokenStatus {
    try {
      if (!existsSync(this.statusPath)) {
        return this.createDefaultStatus();
      }
      
      const data = readFileSync(this.statusPath, 'utf8');
      const status = JSON.parse(data);
      
      // 转换日期字符串为Date对象
      return {
        isValid: status.isValid || false,
        shouldBlock: status.shouldBlock || false,
        lastValidation: status.lastValidation ? new Date(status.lastValidation) : new Date(0),
        failureCount: status.failureCount || 0,
        nextAllowedCheck: status.nextAllowedCheck ? new Date(status.nextAllowedCheck) : null
      };
    } catch (error) {
      logger.debug('Failed to load token status, using defaults', error);
      return this.createDefaultStatus();
    }
  }

  /**
   * 保存token状态
   */
  private saveTokenStatus(status: TokenStatus): void {
    try {
      const data = JSON.stringify({
        isValid: status.isValid,
        shouldBlock: status.shouldBlock,
        lastValidation: status.lastValidation.toISOString(),
        failureCount: status.failureCount,
        nextAllowedCheck: status.nextAllowedCheck ? status.nextAllowedCheck.toISOString() : null
      }, null, 2);
      
      writeFileSync(this.statusPath, data, { mode: 0o600 });
    } catch (error) {
      logger.error('Failed to save token status', error);
    }
  }

  /**
   * 创建默认状态
   */
  private createDefaultStatus(): TokenStatus {
    return {
      isValid: false,
      shouldBlock: false,
      lastValidation: new Date(0),
      failureCount: 0,
      nextAllowedCheck: null
    };
  }

  /**
   * 确保状态文件目录存在
   */
  private ensureStatusDirectory(): void {
    try {
      const { mkdirSync } = require('fs');
      const { dirname } = require('path');
      const dir = dirname(this.statusPath);
      
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    } catch (error) {
      logger.error('Failed to create status directory', error);
    }
  }

  /**
   * 启动后台监控
   */
  private startMonitoring(): void {
    if (this.monitoringActive) {
      return;
    }
    
    this.monitoringActive = true;
    
    this.monitorInterval = setInterval(async () => {
      try {
        await this.performBackgroundCheck();
      } catch (error) {
        logger.debug('Background token check failed', error);
      }
    }, this.MONITOR_INTERVAL);
    
    logger.debug('Token monitoring started');
  }

  /**
   * 后台检查
   */
  private async performBackgroundCheck(): Promise<void> {
    const status = this.loadTokenStatus();
    
    // 如果当前被阻断，检查是否可以解除
    if (status.shouldBlock && status.nextAllowedCheck) {
      const now = new Date();
      if (now >= status.nextAllowedCheck) {
        status.shouldBlock = false;
        status.failureCount = 0;
        status.nextAllowedCheck = null;
        this.saveTokenStatus(status);
        logger.info('Token block expired, validation re-enabled');
      }
    }
    
    // 如果token状态未知或很久没检查，进行验证
    const timeSinceLastCheck = Date.now() - status.lastValidation.getTime();
    if (!status.shouldBlock && timeSinceLastCheck > this.MONITOR_INTERVAL) {
      logger.debug('Performing background token validation');
      await this.checkTokenSafely();
    }
  }

  /**
   * 获取当前状态摘要
   */
  getStatusSummary(): any {
    const status = this.loadTokenStatus();
    return {
      isValid: status.isValid,
      shouldBlock: status.shouldBlock,
      lastValidation: status.lastValidation.toISOString(),
      failureCount: status.failureCount,
      nextAllowedCheck: status.nextAllowedCheck ? status.nextAllowedCheck.toISOString() : null,
      monitoringActive: this.monitoringActive
    };
  }

  /**
   * 手动重置状态（紧急使用）
   */
  resetStatus(): void {
    const defaultStatus = this.createDefaultStatus();
    this.saveTokenStatus(defaultStatus);
    logger.info('Token status manually reset');
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.monitoringActive = false;
    logger.debug('Token monitoring stopped');
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.stopMonitoring();
  }
}