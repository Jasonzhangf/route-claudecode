/**
 * 配置安全验证器
 * 
 * 提供配置文件的安全验证、业务规则检查和配置审计功能
 * 
 * @author Jason Zhang
 */

import { SecurityManager } from '../security/security-manager';

/**
 * 配置安全规则
 */
export interface ConfigSecurityRule {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  validator: (config: any, context: ConfigValidationContext) => Promise<SecurityViolation[]>;
}

/**
 * 配置验证上下文
 */
export interface ConfigValidationContext {
  configPath: string;
  environment: 'development' | 'staging' | 'production';
  timestamp: Date;
  previousConfig?: any;
}

/**
 * 安全违规记录
 */
export interface SecurityViolation {
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  path: string;
  value?: any;
  recommendation: string;
}

/**
 * 配置安全验证结果
 */
export interface ConfigSecurityValidationResult {
  isValid: boolean;
  violations: SecurityViolation[];
  score: number; // 0-100
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recommendations: string[];
}

/**
 * 配置安全验证器实现
 */
export class ConfigSecurityValidator {
  private securityRules: Map<string, ConfigSecurityRule> = new Map();
  private securityManager: SecurityManager;

  constructor() {
    this.securityManager = new SecurityManager();
    this.initializeSecurityRules();
  }

  /**
   * 验证配置安全性
   */
  async validateConfigSecurity(
    config: any, 
    context: ConfigValidationContext
  ): Promise<ConfigSecurityValidationResult> {
    const violations: SecurityViolation[] = [];
    const recommendations: string[] = [];

    // 执行所有安全规则检查
    for (const [ruleId, rule] of this.securityRules) {
      try {
        const ruleViolations = await rule.validator(config, context);
        violations.push(...ruleViolations);
      } catch (error) {
        console.error(`Security rule ${ruleId} validation failed:`, error);
        violations.push({
          ruleId,
          severity: 'medium',
          message: `Security validation rule failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          path: 'root',
          recommendation: 'Check security rule implementation and configuration structure'
        });
      }
    }

    // 计算安全分数
    const score = this.calculateSecurityScore(violations);

    // 生成违规摘要
    const summary = this.generateViolationSummary(violations);

    // 生成建议
    recommendations.push(...this.generateRecommendations(violations));

    // 记录安全事件
    await this.securityManager.logSecurityEvent({
      action: 'config_security_validation',
      ipAddress: 'system',
      success: violations.length === 0,
      risk: violations.some(v => v.severity === 'critical') ? 'critical' : 
            violations.some(v => v.severity === 'high') ? 'high' : 'low',
      details: {
        configPath: context.configPath,
        environment: context.environment,
        violationCount: violations.length,
        score
      }
    });

    return {
      isValid: violations.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0,
      violations,
      score,
      summary,
      recommendations
    };
  }

  /**
   * 注册自定义安全规则
   */
  registerSecurityRule(rule: ConfigSecurityRule): void {
    this.securityRules.set(rule.id, rule);
  }

  /**
   * 初始化安全规则
   */
  private initializeSecurityRules(): void {
    // 密钥和敏感信息检查
    this.registerSecurityRule({
      id: 'no-hardcoded-secrets',
      name: '禁止硬编码密钥',
      description: '检查配置中是否包含硬编码的密钥、密码或敏感信息',
      severity: 'critical',
      validator: async (config: any) => {
        const violations: SecurityViolation[] = [];
        const sensitivePatterns = [
          /password/i,
          /secret/i,
          /key/i,
          /token/i,
          /api_key/i,
          /access_key/i,
          /private_key/i
        ];

        this.scanForSensitiveData(config, '', sensitivePatterns, violations);
        return violations;
      }
    });

    // 网络安全配置检查
    this.registerSecurityRule({
      id: 'secure-network-config',
      name: '网络安全配置',
      description: '检查网络配置的安全性，包括HTTPS使用、端口配置等',
      severity: 'high',
      validator: async (config: any) => {
        const violations: SecurityViolation[] = [];

        // 检查HTTP vs HTTPS
        if (config.server?.protocol === 'http' && config.environment === 'production') {
          violations.push({
            ruleId: 'secure-network-config',
            severity: 'high',
            message: 'Production environment should use HTTPS protocol',
            path: 'server.protocol',
            value: config.server.protocol,
            recommendation: 'Change protocol to "https" for production environments'
          });
        }

        // 检查危险端口
        const dangerousPorts = [80, 8080, 3000, 5000];
        if (config.server?.port && dangerousPorts.includes(config.server.port) && config.environment === 'production') {
          violations.push({
            ruleId: 'secure-network-config',
            severity: 'medium',
            message: 'Production environment using commonly exposed port',
            path: 'server.port',
            value: config.server.port,
            recommendation: 'Consider using a non-standard port for production'
          });
        }

        return violations;
      }
    });

    // 生产环境配置检查
    this.registerSecurityRule({
      id: 'production-security',
      name: '生产环境安全配置',
      description: '检查生产环境特定的安全配置要求',
      severity: 'high',
      validator: async (config: any, context: ConfigValidationContext) => {
        const violations: SecurityViolation[] = [];

        if (context.environment === 'production') {
          // 检查debug模式
          if (config.debug === true || config.server?.debug === true) {
            violations.push({
              ruleId: 'production-security',
              severity: 'high',
              message: 'Debug mode enabled in production environment',
              path: 'debug',
              value: config.debug,
              recommendation: 'Disable debug mode in production'
            });
          }

          // 检查日志级别
          if (config.logging?.level === 'debug' || config.logging?.level === 'trace') {
            violations.push({
              ruleId: 'production-security',
              severity: 'medium',
              message: 'Verbose logging enabled in production',
              path: 'logging.level',
              value: config.logging.level,
              recommendation: 'Use "info" or "warn" log level in production'
            });
          }

          // 检查CORS配置
          if (config.cors?.origin === '*') {
            violations.push({
              ruleId: 'production-security',
              severity: 'high',
              message: 'CORS wildcard origin in production',
              path: 'cors.origin',
              value: config.cors.origin,
              recommendation: 'Specify explicit allowed origins instead of wildcard'
            });
          }
        }

        return violations;
      }
    });

    // 配置完整性检查
    this.registerSecurityRule({
      id: 'config-integrity',
      name: '配置完整性检查',
      description: '检查配置文件的完整性和必需字段',
      severity: 'medium',
      validator: async (config: any) => {
        const violations: SecurityViolation[] = [];

        // 检查必需字段
        const requiredFields = ['server', 'providers'];
        for (const field of requiredFields) {
          if (!config[field]) {
            violations.push({
              ruleId: 'config-integrity',
              severity: 'medium',
              message: `Required configuration field missing: ${field}`,
              path: field,
              recommendation: `Add required field "${field}" to configuration`
            });
          }
        }

        // 检查空值和无效值
        if (config.server?.port && (config.server.port < 1 || config.server.port > 65535)) {
          violations.push({
            ruleId: 'config-integrity',
            severity: 'medium',
            message: 'Invalid port number',
            path: 'server.port',
            value: config.server.port,
            recommendation: 'Use a valid port number between 1 and 65535'
          });
        }

        return violations;
      }
    });

    // 权限和访问控制检查
    this.registerSecurityRule({
      id: 'access-control',
      name: '访问控制配置',
      description: '检查访问控制和权限配置的安全性',
      severity: 'high',
      validator: async (config: any) => {
        const violations: SecurityViolation[] = [];

        // 检查认证配置
        if (!config.auth && !config.authentication && !config.security?.auth) {
          violations.push({
            ruleId: 'access-control',
            severity: 'high',
            message: 'No authentication configuration found',
            path: 'auth',
            recommendation: 'Add authentication configuration to secure the service'
          });
        }

        // 检查默认凭据
        if (config.auth?.username === 'admin' && config.auth?.password === 'admin') {
          violations.push({
            ruleId: 'access-control',
            severity: 'critical',
            message: 'Default credentials detected',
            path: 'auth',
            recommendation: 'Change default username and password immediately'
          });
        }

        return violations;
      }
    });
  }

  /**
   * 扫描敏感数据
   */
  private scanForSensitiveData(
    obj: any, 
    path: string, 
    patterns: RegExp[], 
    violations: SecurityViolation[]
  ): void {
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        // 检查键名是否包含敏感信息
        for (const pattern of patterns) {
          if (pattern.test(key) && typeof value === 'string' && value.length > 0) {
            violations.push({
              ruleId: 'no-hardcoded-secrets',
              severity: 'critical',
              message: `Potential hardcoded sensitive information: ${key}`,
              path: currentPath,
              recommendation: 'Use environment variables or secure secret management instead'
            });
          }
        }

        // 递归检查嵌套对象
        if (typeof value === 'object' && value !== null) {
          this.scanForSensitiveData(value, currentPath, patterns, violations);
        }
      }
    }
  }

  /**
   * 计算安全分数
   */
  private calculateSecurityScore(violations: SecurityViolation[]): number {
    let score = 100;
    
    for (const violation of violations) {
      switch (violation.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 8;
          break;
        case 'low':
          score -= 3;
          break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * 生成违规摘要
   */
  private generateViolationSummary(violations: SecurityViolation[]) {
    const summary = {
      total: violations.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const violation of violations) {
      summary[violation.severity]++;
    }

    return summary;
  }

  /**
   * 生成建议
   */
  private generateRecommendations(violations: SecurityViolation[]): string[] {
    const recommendations = new Set<string>();
    
    for (const violation of violations) {
      recommendations.add(violation.recommendation);
    }

    // 添加通用建议
    if (violations.length > 0) {
      recommendations.add('Review and update configuration security policies');
      recommendations.add('Implement configuration change auditing');
    }

    if (violations.some(v => v.severity === 'critical')) {
      recommendations.add('Address critical security violations immediately');
    }

    return Array.from(recommendations);
  }
}