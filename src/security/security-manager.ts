/**
 * 安全管理器
 * 
 * 提供统一的安全验证、权限控制和审计日志功能
 * 
 * @author Jason Zhang
 */

import * as crypto from 'crypto';
import { DEFAULT_SECURITY_CONFIG } from '../config/default-config';

/**
 * 安全上下文
 */
export interface SecurityContext {
  userId?: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

/**
 * 审计日志条目
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  userId?: string;
  ipAddress: string;
  success: boolean;
  details?: Record<string, any>;
  risk: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 安全管理器实现
 */
export class SecurityManager {
  private auditLogs: AuditLogEntry[] = [];
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  private blacklistedIPs = new Set<string>();
  private suspiciousActivities = new Map<string, number>();

  constructor(private readonly config = DEFAULT_SECURITY_CONFIG) {}

  /**
   * 验证权限
   */
  async validatePermission(context: SecurityContext, requiredPermission: string): Promise<boolean> {
    try {
      // 检查IP黑名单
      if (this.blacklistedIPs.has(context.ipAddress)) {
        await this.logSecurityEvent({
          action: 'permission_check_blocked',
          userId: context.userId,
          ipAddress: context.ipAddress,
          success: false,
          risk: 'high',
          details: { permission: requiredPermission, reason: 'blacklisted_ip' }
        });
        return false;
      }

      // 检查权限
      const hasPermission = context.permissions.includes(requiredPermission) || 
                           context.roles.includes('admin');

      await this.logSecurityEvent({
        action: 'permission_check',
        userId: context.userId,
        ipAddress: context.ipAddress,
        success: hasPermission,
        risk: hasPermission ? 'low' : 'medium',
        details: { permission: requiredPermission }
      });

      return hasPermission;
    } catch (error) {
      await this.logSecurityEvent({
        action: 'permission_check_error',
        userId: context.userId,
        ipAddress: context.ipAddress,
        success: false,
        risk: 'high',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      return false;
    }
  }

  /**
   * 验证速率限制
   */
  async checkRateLimit(identifier: string): Promise<boolean> {
    if (!this.config.rateLimit.enabled) {
      return true;
    }

    const now = Date.now();
    const windowMs = this.config.rateLimit.windowMs;
    const maxRequests = this.config.rateLimit.maxRequests;

    const record = this.rateLimitMap.get(identifier);
    
    if (!record || now > record.resetTime) {
      // 新的时间窗口
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + windowMs
      });
      return true;
    }

    if (record.count >= maxRequests) {
      // 超过限制
      await this.logSecurityEvent({
        action: 'rate_limit_exceeded',
        ipAddress: identifier,
        success: false,
        risk: 'medium',
        details: { count: record.count, limit: maxRequests }
      });
      
      // 增加可疑活动计数
      this.trackSuspiciousActivity(identifier);
      return false;
    }

    // 增加计数
    record.count++;
    return true;
  }

  /**
   * 验证输入安全性
   */
  validateInput(input: any, type: 'string' | 'number' | 'object' | 'array'): boolean {
    try {
      if (input === null || input === undefined) {
        return false;
      }

      switch (type) {
        case 'string':
          if (typeof input !== 'string') return false;
          // 检查SQL注入、XSS等
          return this.validateStringInput(input);
          
        case 'number':
          return typeof input === 'number' && !isNaN(input);
          
        case 'object':
          return typeof input === 'object' && !Array.isArray(input);
          
        case 'array':
          return Array.isArray(input);
          
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证字符串输入
   */
  private validateStringInput(input: string): boolean {
    // 检查长度
    if (input.length > 10000) {
      return false;
    }

    // 检查SQL注入模式
    const sqlInjectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(;|\||&|\$|\*|--|\#)/,
      /('|(\\x27)|(\\x2D\\x2D))/
    ];

    for (const pattern of sqlInjectionPatterns) {
      if (pattern.test(input)) {
        return false;
      }
    }

    // 检查XSS模式
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(input)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 生成安全的会话ID
   */
  generateSecureSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 生成安全的令牌
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * 哈希密码
   */
  async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * 验证密码
   */
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      const [salt, hash] = hashedPassword.split(':');
      const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
      return hash === verifyHash;
    } catch (error) {
      return false;
    }
  }

  /**
   * 跟踪可疑活动
   */
  private trackSuspiciousActivity(identifier: string): void {
    const count = this.suspiciousActivities.get(identifier) || 0;
    this.suspiciousActivities.set(identifier, count + 1);

    // 如果可疑活动超过阈值，加入黑名单
    if (count + 1 >= 10) {
      this.blacklistedIPs.add(identifier);
      this.logSecurityEvent({
        action: 'ip_blacklisted',
        ipAddress: identifier,
        success: true,
        risk: 'critical',
        details: { suspicious_count: count + 1 }
      });
    }
  }

  /**
   * 记录安全事件
   */
  private async logSecurityEvent(event: Partial<AuditLogEntry>): Promise<void> {
    const logEntry: AuditLogEntry = {
      id: this.generateAuditId(),
      timestamp: new Date(),
      action: event.action || 'unknown',
      userId: event.userId,
      ipAddress: event.ipAddress || 'unknown',
      success: event.success || false,
      risk: event.risk || 'low',
      details: event.details
    };

    this.auditLogs.push(logEntry);

    // 保持日志数量在合理范围内
    if (this.auditLogs.length > 10000) {
      this.auditLogs.splice(0, this.auditLogs.length - 10000);
    }

    // 如果是高风险事件，立即输出警告
    if (logEntry.risk === 'high' || logEntry.risk === 'critical') {
      console.warn(`🚨 Security Alert: ${logEntry.action}`, {
        userId: logEntry.userId,
        ipAddress: logEntry.ipAddress,
        details: logEntry.details
      });
    }
  }

  /**
   * 获取审计日志
   */
  getAuditLogs(limit: number = 100): AuditLogEntry[] {
    return this.auditLogs
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * 获取安全统计
   */
  getSecurityStats(): {
    totalEvents: number;
    riskLevels: Record<string, number>;
    blacklistedIPs: number;
    suspiciousActivities: number;
    rateLimitViolations: number;
  } {
    const riskLevels = { low: 0, medium: 0, high: 0, critical: 0 };
    let rateLimitViolations = 0;

    for (const log of this.auditLogs) {
      riskLevels[log.risk]++;
      if (log.action === 'rate_limit_exceeded') {
        rateLimitViolations++;
      }
    }

    return {
      totalEvents: this.auditLogs.length,
      riskLevels,
      blacklistedIPs: this.blacklistedIPs.size,
      suspiciousActivities: this.suspiciousActivities.size,
      rateLimitViolations
    };
  }

  /**
   * 清理过期数据
   */
  cleanup(): void {
    const now = Date.now();
    
    // 清理过期的速率限制记录
    for (const [key, record] of this.rateLimitMap.entries()) {
      if (now > record.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }

    // 清理旧的审计日志（保留最近7天）
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    this.auditLogs = this.auditLogs.filter(log => log.timestamp.getTime() > sevenDaysAgo);
  }

  /**
   * 生成审计ID
   */
  private generateAuditId(): string {
    return `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }
}