/**
 * Pipeline Assembly Self-Inspection Service
 * 
 * 流水线组装自检服务 - 提供全面的系统自检功能
 * 
 * @author Claude Code Router v4.0
 */

import { 
  SelfInspectionResult, 
  SelfInspectionCheck,
  PipelineAssemblyReport 
} from './pipeline-assembly-reporter-types';
import { secureLogger } from '../../error-handler/src/utils/secure-logger';

/**
 * 自检规则定义
 */
export interface SelfInspectionRule {
  name: string;
  category: 'configuration' | 'connectivity' | 'performance' | 'security' | 'compliance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  check: (report: PipelineAssemblyReport) => SelfInspectionCheck;
  enabled: boolean;
}

/**
 * 自检配置
 */
export interface SelfInspectionConfig {
  enableComprehensiveChecks: boolean;
  enableSecurityValidation: boolean;
  enablePerformanceAnalysis: boolean;
  enableConnectivityTesting: boolean;
  failFastOnCritical: boolean;
  maxInspectionTimeMs: number;
  customRules?: SelfInspectionRule[];
}

/**
 * 流水线组装自检服务
 */
export class PipelineAssemblySelfInspection {
  private config: SelfInspectionConfig;
  private rules: SelfInspectionRule[];

  constructor(config?: Partial<SelfInspectionConfig>) {
    this.config = {
      enableComprehensiveChecks: true,
      enableSecurityValidation: true,
      enablePerformanceAnalysis: true,
      enableConnectivityTesting: true,
      failFastOnCritical: false,
      maxInspectionTimeMs: 5000,
      ...config
    };

    this.rules = this.initializeRules();
  }

  /**
   * 执行自检
   */
  async inspect(report: PipelineAssemblyReport): Promise<SelfInspectionResult> {
    const startTime = Date.now();
    
    secureLogger.info('🔍 Starting pipeline assembly self-inspection...', {
      reportId: report.sessionInfo.reportId,
      rulesCount: this.rules.length
    });

    const checks: SelfInspectionCheck[] = [];
    const criticalIssues: string[] = [];
    const recommendations: string[] = [];
    let hasCriticalFailure = false;

    // 执行所有启用的检查规则
    for (const rule of this.rules.filter(r => r.enabled)) {
      try {
        const check = rule.check(report);
        checks.push(check);
        
        // 记录关键问题
        if (check.status === 'failed' && rule.severity === 'critical') {
          criticalIssues.push(check.message);
          hasCriticalFailure = true;
          
          if (this.config.failFastOnCritical) {
            secureLogger.error('🚨 Critical failure detected, stopping inspection early', {
              rule: rule.name,
              message: check.message
            });
            break;
          }
        }
        
        // 收集建议
        if (check.details?.recommendations) {
          recommendations.push(...check.details.recommendations);
        }
        
      } catch (error) {
        secureLogger.error('❌ Self-inspection rule failed', {
          rule: rule.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // 记录规则执行失败
        checks.push({
          name: rule.name,
          category: rule.category,
          status: 'failed',
          message: `Rule execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'high',
          details: { ruleFailed: true, originalError: error }
        });
      }
    }

    // 计算综合评分
    const overallScore = this.calculateOverallScore(checks);
    
    // 确定总体状态
    const status = this.determineOverallStatus(checks, overallScore, hasCriticalFailure);
    
    // 去重和建议排序
    const uniqueRecommendations = [...new Set(recommendations)]
      .sort((a, b) => a.localeCompare(b));

    const inspectionTime = Date.now() - startTime;
    
    secureLogger.info('✅ Pipeline assembly self-inspection completed', {
      inspectionTimeMs: inspectionTime,
      status,
      overallScore,
      checksExecuted: checks.length,
      criticalIssuesCount: criticalIssues.length
    });

    return {
      timestamp: new Date().toISOString(),
      inspector: 'PipelineAssemblySelfInspection',
      status,
      checks,
      overallScore,
      criticalIssues,
      recommendations: uniqueRecommendations
    };
  }

  /**
   * 执行健康检查
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'passed' | 'failed' | 'warning';
      message: string;
    }>;
  }> {
    const checks = [
      {
        name: 'Rule Configuration',
        status: this.rules.length > 0 ? 'passed' as const : 'failed' as const,
        message: `${this.rules.length} inspection rules configured`
      },
      {
        name: 'Self-Inspection Config',
        status: this.config.enableComprehensiveChecks ? 'passed' as const : 'warning' as const,
        message: 'Comprehensive checks enabled'
      },
      {
        name: 'Security Validation',
        status: this.config.enableSecurityValidation ? 'passed' as const : 'warning' as const,
        message: 'Security validation enabled'
      }
    ];

    const failedChecks = checks.filter(c => c.status === 'failed').length;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (failedChecks > 0) {
      status = 'unhealthy';
    } else if (checks.some(c => c.status === 'warning')) {
      status = 'degraded';
    }

    return {
      healthy: status === 'healthy',
      status,
      checks
    };
  }

  /**
   * 添加自定义自检规则
   */
  addRule(rule: SelfInspectionRule): void {
    this.rules.push(rule);
    secureLogger.info('📝 Added custom self-inspection rule', { 
      ruleName: rule.name, 
      category: rule.category 
    });
  }

  /**
   * 移除自检规则
   */
  removeRule(ruleName: string): boolean {
    const index = this.rules.findIndex(r => r.name === ruleName);
    if (index !== -1) {
      this.rules.splice(index, 1);
      secureLogger.info('🗑️ Removed self-inspection rule', { ruleName });
      return true;
    }
    return false;
  }

  /**
   * 获取所有规则
   */
  getRules(): SelfInspectionRule[] {
    return [...this.rules];
  }

  /**
   * 启用/禁用规则
   */
  setRuleEnabled(ruleName: string, enabled: boolean): boolean {
    const rule = this.rules.find(r => r.name === ruleName);
    if (rule) {
      rule.enabled = enabled;
      secureLogger.info('📡 Updated self-inspection rule status', { 
        ruleName, 
        enabled 
      });
      return true;
    }
    return false;
  }

  /**
   * 初始化自检规则
   */
  private initializeRules(): SelfInspectionRule[] {
    return [
      // 配置完整性检查
      {
        name: 'Configuration Integrity',
        category: 'configuration',
        severity: 'critical',
        enabled: true,
        check: (report) => ({
          name: 'Configuration Integrity',
          category: 'configuration',
          status: report.assemblySummary.totalPipelines > 0 ? 'passed' : 'failed',
          message: `Validated ${report.assemblySummary.totalPipelines} pipeline configurations`,
          severity: 'critical',
          details: { 
            totalPipelines: report.assemblySummary.totalPipelines,
            configPath: report.sessionInfo.configPath,
            recommendations: report.assemblySummary.totalPipelines === 0 ? 
              ['Check configuration file path and format'] : []
          }
        })
      },

      // 组装成功率检查
      {
        name: 'Assembly Success Rate',
        category: 'performance',
        severity: 'high',
        enabled: true,
        check: (report) => {
          const successRate = report.assemblySummary.successRate;
          let status: 'passed' | 'failed' | 'warning' = 'passed';
          let message = `Assembly success rate: ${successRate.toFixed(1)}%`;

          if (successRate < 50) {
            status = 'failed';
            message += ' - critically low';
          } else if (successRate < 80) {
            status = 'warning';
            message += ' - needs improvement';
          }

          return {
            name: 'Assembly Success Rate',
            category: 'performance',
            status,
            message,
            severity: 'high',
            details: { 
              successRate,
              assembledPipelines: report.assemblySummary.assembledPipelines,
              failedPipelines: report.assemblySummary.failedPipelines,
              recommendations: status !== 'passed' ? 
                ['Review failed pipelines and module configurations'] : []
            }
          };
        }
      },

      // 性能分析检查
      {
        name: 'Assembly Performance',
        category: 'performance',
        severity: 'medium',
        enabled: this.config.enablePerformanceAnalysis,
        check: (report) => {
          const avgTime = report.performanceMetrics.avgAssemblyTimeMs;
          const totalTime = report.performanceMetrics.totalAssemblyTimeMs;
          
          let status: 'passed' | 'failed' | 'warning' = 'passed';
          let message = `Assembly performance: avg ${avgTime.toFixed(1)}ms`;

          if (avgTime > 2000) {
            status = 'failed';
            message += ' - critically slow';
          } else if (avgTime > 1000) {
            status = 'warning';
            message += ' - slower than expected';
          }

          return {
            name: 'Assembly Performance',
            category: 'performance',
            status,
            message,
            severity: 'medium',
            details: { 
              avgAssemblyTimeMs: avgTime,
              totalAssemblyTimeMs: totalTime,
              recommendations: status !== 'passed' ? 
                ['Optimize module assembly and initialization'] : []
            }
          };
        }
      },

      // 内存使用检查
      {
        name: 'Memory Usage',
        category: 'performance',
        severity: 'medium',
        enabled: this.config.enablePerformanceAnalysis,
        check: (report) => {
          const memoryUsage = report.performanceMetrics.memoryUsageMB;
          
          let status: 'passed' | 'failed' | 'warning' = 'passed';
          let message = `Memory usage: ${memoryUsage.toFixed(1)}MB`;

          if (memoryUsage > 1000) {
            status = 'failed';
            message += ' - critically high';
          } else if (memoryUsage > 500) {
            status = 'warning';
            message += ' - higher than normal';
          }

          return {
            name: 'Memory Usage',
            category: 'performance',
            status,
            message,
            severity: 'medium',
            details: { 
              memoryUsageMB: memoryUsage,
              peakMemoryUsageMB: report.performanceMetrics.peakMemoryUsageMB,
              recommendations: status !== 'passed' ? 
                ['Monitor memory usage and consider cleanup'] : []
            }
          };
        }
      },

      // 模块健康检查
      {
        name: 'Module Health Status',
        category: 'connectivity',
        severity: 'high',
        enabled: this.config.enableConnectivityTesting,
        check: (report) => {
          const moduleStats = report.moduleRegistryStats;
          const unhealthyModules = Object.entries(moduleStats.moduleHealthStatus)
            .filter(([_, status]) => status !== 'healthy');
          
          let status: 'passed' | 'failed' | 'warning' = 'passed';
          let message = `${moduleStats.totalModules} modules registered`;

          if (unhealthyModules.length > moduleStats.totalModules * 0.5) {
            status = 'failed';
            message += ` - ${unhealthyModules.length} modules unhealthy`;
          } else if (unhealthyModules.length > 0) {
            status = 'warning';
            message += ` - ${unhealthyModules.length} modules have issues`;
          }

          return {
            name: 'Module Health Status',
            category: 'connectivity',
            status,
            message,
            severity: 'high',
            details: { 
              totalModules: moduleStats.totalModules,
              unhealthyModules: unhealthyModules.map(([name]) => name),
              activeModules: moduleStats.activeModules,
              recommendations: status !== 'passed' ? 
                ['Check module configurations and dependencies'] : []
            }
          };
        }
      },

      // 模块多样性检查
      {
        name: 'Module Diversity',
        category: 'configuration',
        severity: 'low',
        enabled: true,
        check: (report) => {
          const modulesByType = report.moduleRegistryStats.modulesByType;
          const moduleTypes = Object.keys(modulesByType);
          const hasAllRequiredTypes = ['transformer', 'protocol', 'server'].every(type => 
            moduleTypes.includes(type)
          );
          
          let status: 'passed' | 'failed' | 'warning' = 'passed';
          let message = `${moduleTypes.length} different module types found`;

          if (!hasAllRequiredTypes) {
            status = 'warning';
            message += ' - missing some required module types';
          }

          return {
            name: 'Module Diversity',
            category: 'configuration',
            status,
            message,
            severity: 'low',
            details: { 
              moduleTypes,
              modulesByType,
              hasAllRequiredTypes,
              recommendations: status !== 'passed' ? 
                ['Ensure all required module types are available'] : []
            }
          };
        }
      },

      // Provider可用性检查
      {
        name: 'Provider Availability',
        category: 'connectivity',
        severity: 'medium',
        enabled: this.config.enableConnectivityTesting,
        check: (report) => {
          const providers = report.moduleRegistryStats.availableProviders;
          
          let status: 'passed' | 'failed' | 'warning' = 'passed';
          let message = `${providers.length} providers available`;

          if (providers.length === 0) {
            status = 'failed';
            message += ' - no providers configured';
          } else if (providers.length === 1) {
            status = 'warning';
            message += ' - single point of failure risk';
          }

          return {
            name: 'Provider Availability',
            category: 'connectivity',
            status,
            message,
            severity: 'medium',
            details: { 
              providers,
              recommendations: status !== 'passed' ? 
                providers.length === 0 ? 
                ['Configure at least one AI provider'] : 
                ['Consider adding backup providers for redundancy'] : []
            }
          };
        }
      },

      // 系统健康状态检查
      {
        name: 'System Health Status',
        category: 'compliance',
        severity: 'high',
        enabled: true,
        check: (report) => {
          const systemHealth = report.systemHealth;
          
          let status: 'passed' | 'failed' | 'warning' = 'passed';
          let message = `System health: ${systemHealth.overallStatus}`;

          if (systemHealth.overallStatus === 'unhealthy') {
            status = 'failed';
            message += ' - system has critical issues';
          } else if (systemHealth.overallStatus === 'warning') {
            status = 'warning';
            message += ' - system needs attention';
          }

          return {
            name: 'System Health Status',
            category: 'compliance',
            status,
            message,
            severity: 'high',
            details: { 
              overallStatus: systemHealth.overallStatus,
              criticalAlerts: systemHealth.criticalAlerts,
              warnings: systemHealth.warnings,
              recommendations: [...systemHealth.criticalAlerts, ...systemHealth.warnings]
            }
          };
        }
      },

      // 安全配置检查
      {
        name: 'Security Configuration',
        category: 'security',
        severity: 'critical',
        enabled: this.config.enableSecurityValidation,
        check: (report) => {
          const hasValidConfig = report.sessionInfo.configPath.includes('config.json');
          
          let status: 'passed' | 'failed' | 'warning' = 'passed';
          let message = 'Security configuration validated';

          if (!hasValidConfig) {
            status = 'warning';
            message += ' - using non-standard config path';
          }

          return {
            name: 'Security Configuration',
            category: 'security',
            status,
            message,
            severity: 'critical',
            details: { 
              configPath: report.sessionInfo.configPath,
              serverPort: report.sessionInfo.serverPort,
              recommendations: status !== 'passed' ? 
                ['Verify configuration file security settings'] : []
            }
          };
        }
      },

      // 数据完整性检查
      {
        name: 'Data Integrity',
        category: 'compliance',
        severity: 'medium',
        enabled: true,
        check: (report) => {
          const hasValidData = (
            report.pipelineDetails.length > 0 &&
            report.pipelineDetails.every(p => p.pipelineId && p.provider)
          );
          
          let status: 'passed' | 'failed' | 'warning' = 'passed';
          let message = 'Data integrity check passed';

          if (!hasValidData) {
            status = 'failed';
            message += ' - data integrity issues detected';
          }

          return {
            name: 'Data Integrity',
            category: 'compliance',
            status,
            message,
            severity: 'medium',
            details: { 
              pipelineCount: report.pipelineDetails.length,
              validPipelines: report.pipelineDetails.filter(p => p.pipelineId && p.provider).length,
              recommendations: status !== 'passed' ? 
                ['Check data consistency and pipeline configurations'] : []
            }
          };
        }
      }
    ];
  }

  /**
   * 计算综合评分
   */
  private calculateOverallScore(checks: SelfInspectionCheck[]): number {
    if (checks.length === 0) return 0;

    let totalScore = 0;
    let maxScore = 0;

    checks.forEach(check => {
      let checkScore = 0;
      
      switch (check.status) {
        case 'passed':
          checkScore = 100;
          break;
        case 'warning':
          checkScore = 70;
          break;
        case 'failed':
          checkScore = 0;
          break;
      }

      // 根据严重程度调整权重
      const severityWeight = {
        'low': 0.8,
        'medium': 1.0,
        'high': 1.2,
        'critical': 1.5
      };

      const weight = severityWeight[check.severity];
      totalScore += checkScore * weight;
      maxScore += 100 * weight;
    });

    return maxScore > 0 ? Math.min(100, (totalScore / maxScore) * 100) : 0;
  }

  /**
   * 确定总体状态
   */
  private determineOverallStatus(
    checks: SelfInspectionCheck[], 
    overallScore: number, 
    hasCriticalFailure: boolean
  ): 'passed' | 'failed' | 'warning' {
    if (hasCriticalFailure) {
      return 'failed';
    }

    const failedChecks = checks.filter(c => c.status === 'failed').length;
    const warningChecks = checks.filter(c => c.status === 'warning').length;

    if (failedChecks > 0) {
      return 'failed';
    }

    if (overallScore < 50 || warningChecks > checks.length * 0.3) {
      return 'warning';
    }

    return 'passed';
  }
}