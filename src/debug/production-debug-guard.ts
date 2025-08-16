/**
 * 生产环境调试保护器
 * 
 * 确保生产环境中调试信息不会暴露敏感数据
 * 
 * @author Jason Zhang
 */

import { SecurityManager } from '../security/security-manager';

/**
 * 环境类型
 */
export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * 调试级别
 */
export type DebugLevel = 'none' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * 敏感数据过滤配置
 */
export interface SensitiveDataFilter {
  patterns: RegExp[];
  replacement: string;
  enabled: boolean;
}

/**
 * 生产调试配置
 */
export interface ProductionDebugConfig {
  environment: Environment;
  allowedDebugLevel: DebugLevel;
  sensitiveDataFilter: SensitiveDataFilter;
  enableDebugAccess: boolean;
  debugAccessTokens: string[];
  maxDebugSessions: number;
  debugSessionTimeout: number; // milliseconds
}

/**
 * 调试输出类型
 */
export interface DebugOutput {
  level: DebugLevel;
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  source: string;
}

/**
 * 生产环境调试保护器实现
 */
export class ProductionDebugGuard {
  private config: ProductionDebugConfig;
  private securityManager: SecurityManager;
  private activeSessions = new Set<string>();
  private sessionTimers = new Map<string, NodeJS.Timeout>();

  constructor(config: ProductionDebugConfig) {
    this.config = config;
    this.securityManager = new SecurityManager();
    this.setupDefaultFilters();
  }

  /**
   * 检查是否允许调试输出
   */
  isDebugAllowed(level: DebugLevel, source: string): boolean {
    // 生产环境严格限制
    if (this.config.environment === 'production') {
      if (!this.config.enableDebugAccess) {
        return false;
      }

      // 只允许错误和警告级别
      const allowedLevels: DebugLevel[] = ['error', 'warn'];
      if (!allowedLevels.includes(level)) {
        return false;
      }
    }

    // 检查调试级别权限
    return this.isLevelAllowed(level);
  }

  /**
   * 过滤敏感调试信息
   */
  async filterDebugOutput(output: DebugOutput): Promise<DebugOutput> {
    if (!this.isDebugAllowed(output.level, output.source)) {
      return {
        ...output,
        message: '[Debug output filtered in production]',
        metadata: undefined
      };
    }

    // 过滤敏感数据
    const filteredMessage = this.filterSensitiveData(output.message);
    const filteredMetadata = output.metadata ? this.filterSensitiveMetadata(output.metadata) : undefined;

    // 记录调试访问事件
    await this.securityManager.logSecurityEvent({
      action: 'debug_output_filtered',
      ipAddress: 'system',
      success: true,
      risk: 'low',
      details: {
        level: output.level,
        source: output.source,
        environment: this.config.environment,
        originalLength: output.message.length,
        filteredLength: filteredMessage.length
      }
    });

    return {
      ...output,
      message: filteredMessage,
      metadata: filteredMetadata
    };
  }

  /**
   * 验证调试访问权限
   */
  async validateDebugAccess(token?: string, ipAddress?: string): Promise<boolean> {
    if (this.config.environment === 'production') {
      // 生产环境需要有效的访问令牌
      if (!token || !this.config.debugAccessTokens.includes(token)) {
        await this.securityManager.logSecurityEvent({
          action: 'debug_access_denied',
          ipAddress: ipAddress || 'unknown',
          success: false,
          risk: 'medium',
          details: {
            reason: 'invalid_or_missing_token',
            environment: this.config.environment
          }
        });
        return false;
      }

      // 检查会话限制
      if (this.activeSessions.size >= this.config.maxDebugSessions) {
        await this.securityManager.logSecurityEvent({
          action: 'debug_access_denied',
          ipAddress: ipAddress || 'unknown',
          success: false,
          risk: 'medium',
          details: {
            reason: 'max_sessions_exceeded',
            activeSessions: this.activeSessions.size,
            maxSessions: this.config.maxDebugSessions
          }
        });
        return false;
      }
    }

    return true;
  }

  /**
   * 创建调试会话
   */
  async createDebugSession(token?: string, ipAddress?: string): Promise<string | null> {
    const accessGranted = await this.validateDebugAccess(token, ipAddress);
    if (!accessGranted) {
      return null;
    }

    const sessionId = this.generateSessionId();
    this.activeSessions.add(sessionId);

    // 设置会话超时
    const timer = setTimeout(() => {
      this.destroyDebugSession(sessionId);
    }, this.config.debugSessionTimeout);

    this.sessionTimers.set(sessionId, timer);

    await this.securityManager.logSecurityEvent({
      action: 'debug_session_created',
      ipAddress: ipAddress || 'unknown',
      success: true,
      risk: 'low',
      details: {
        sessionId,
        environment: this.config.environment,
        timeout: this.config.debugSessionTimeout
      }
    });

    return sessionId;
  }

  /**
   * 销毁调试会话
   */
  async destroyDebugSession(sessionId: string): Promise<void> {
    const timer = this.sessionTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.sessionTimers.delete(sessionId);
    }

    this.activeSessions.delete(sessionId);

    await this.securityManager.logSecurityEvent({
      action: 'debug_session_destroyed',
      ipAddress: 'system',
      success: true,
      risk: 'low',
      details: {
        sessionId,
        environment: this.config.environment
      }
    });
  }

  /**
   * 获取调试统计信息
   */
  getDebugStats(): {
    environment: Environment;
    activeSessions: number;
    maxSessions: number;
    allowedLevel: DebugLevel;
    debugEnabled: boolean;
  } {
    return {
      environment: this.config.environment,
      activeSessions: this.activeSessions.size,
      maxSessions: this.config.maxDebugSessions,
      allowedLevel: this.config.allowedDebugLevel,
      debugEnabled: this.config.enableDebugAccess
    };
  }

  /**
   * 安全的控制台日志替换
   */
  createSecureLogger() {
    const originalConsole = {
      log: console.log,
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error
    };

    return {
      log: (...args: any[]) => this.secureLog('info', args, originalConsole.log),
      debug: (...args: any[]) => this.secureLog('debug', args, originalConsole.debug),
      info: (...args: any[]) => this.secureLog('info', args, originalConsole.info),
      warn: (...args: any[]) => this.secureLog('warn', args, originalConsole.warn),
      error: (...args: any[]) => this.secureLog('error', args, originalConsole.error)
    };
  }

  /**
   * 安全日志输出
   */
  private async secureLog(level: DebugLevel, args: any[], originalMethod: Function): Promise<void> {
    if (!this.isLevelAllowed(level)) {
      return; // 不输出
    }

    // 过滤所有参数中的敏感信息
    const filteredArgs = args.map(arg => {
      if (typeof arg === 'string') {
        return this.filterSensitiveData(arg);
      } else if (typeof arg === 'object' && arg !== null) {
        return this.filterSensitiveMetadata(arg);
      }
      return arg;
    });

    // 在生产环境添加安全前缀
    if (this.config.environment === 'production') {
      filteredArgs.unshift(`[PROD-${level.toUpperCase()}]`);
    }

    originalMethod.apply(console, filteredArgs);
  }

  /**
   * 检查调试级别是否允许
   */
  private isLevelAllowed(level: DebugLevel): boolean {
    const levels: DebugLevel[] = ['none', 'error', 'warn', 'info', 'debug', 'trace'];
    const currentIndex = levels.indexOf(this.config.allowedDebugLevel);
    const requestedIndex = levels.indexOf(level);
    
    return requestedIndex <= currentIndex;
  }

  /**
   * 过滤敏感数据
   */
  private filterSensitiveData(text: string): string {
    if (!this.config.sensitiveDataFilter.enabled) {
      return text;
    }

    let filtered = text;
    for (const pattern of this.config.sensitiveDataFilter.patterns) {
      filtered = filtered.replace(pattern, this.config.sensitiveDataFilter.replacement);
    }

    return filtered;
  }

  /**
   * 过滤敏感元数据
   */
  private filterSensitiveMetadata(obj: Record<string, any>): Record<string, any> {
    if (!this.config.sensitiveDataFilter.enabled) {
      return obj;
    }

    const filtered: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // 检查键名是否敏感
      const isSensitiveKey = this.config.sensitiveDataFilter.patterns.some(pattern => 
        pattern.test(key)
      );

      if (isSensitiveKey) {
        filtered[key] = this.config.sensitiveDataFilter.replacement;
      } else if (typeof value === 'string') {
        filtered[key] = this.filterSensitiveData(value);
      } else if (typeof value === 'object' && value !== null) {
        filtered[key] = this.filterSensitiveMetadata(value);
      } else {
        filtered[key] = value;
      }
    }

    return filtered;
  }

  /**
   * 设置默认敏感数据过滤器
   */
  private setupDefaultFilters(): void {
    if (!this.config.sensitiveDataFilter.patterns.length) {
      this.config.sensitiveDataFilter.patterns = [
        /password\s*[=:]\s*[^\s,}]+/gi,
        /secret\s*[=:]\s*[^\s,}]+/gi,
        /token\s*[=:]\s*[^\s,}]+/gi,
        /key\s*[=:]\s*[^\s,}]+/gi,
        /api[_-]?key\s*[=:]\s*[^\s,}]+/gi,
        /auth[_-]?token\s*[=:]\s*[^\s,}]+/gi,
        /bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
        /basic\s+[a-zA-Z0-9+/=]+/gi,
        /\b[a-zA-Z0-9]{32,}\b/g, // 长字符串可能是密钥
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi // UUID
      ];
    }
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    const random = Math.random().toString(36).substr(2, 9);
    return `debug_session_${Date.now()}_${random}`;
  }
}

/**
 * 创建生产安全的调试保护器
 */
export function createProductionDebugGuard(environment: Environment = 'production'): ProductionDebugGuard {
  const config: ProductionDebugConfig = {
    environment,
    allowedDebugLevel: environment === 'production' ? 'warn' : 'debug',
    sensitiveDataFilter: {
      patterns: [],
      replacement: '[FILTERED]',
      enabled: true
    },
    enableDebugAccess: environment !== 'production',
    debugAccessTokens: [], // 在生产环境中应该通过环境变量设置
    maxDebugSessions: environment === 'production' ? 2 : 10,
    debugSessionTimeout: environment === 'production' ? 300000 : 3600000 // 5分钟 vs 1小时
  };

  return new ProductionDebugGuard(config);
}