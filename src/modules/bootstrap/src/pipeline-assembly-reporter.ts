/**
 * Pipeline Assembly Reporter
 * 
 * 流水线组装报告器 - 生成详细的流水线组装报告和控制台输出
 * 
 * @author Claude Code Router v4.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  PipelineAssemblyReport, 
  IPipelineAssemblyReporter,
  PipelineAssemblyReporterConfig,
  PipelineAssemblyDetail,
  PipelineLayerDetail,
  ModuleRegistryStats,
  PerformanceMetrics,
  SelfInspectionResult,
  SelfInspectionCheck,
  PipelineValidationResult,
  ValidationCheck
} from './pipeline-assembly-reporter-types';
import { PipelineAssemblySelfInspection } from './pipeline-assembly-self-inspection';
import { secureLogger } from '../../error-handler/src/utils/secure-logger';

/**
 * 默认配置
 */
const DEFAULT_CONFIG: PipelineAssemblyReporterConfig = {
  outputDirectory: './debug-logs/pipeline-assembly',
  enableConsoleOutput: true,
  enableFileOutput: true,
  enableDetailedLogging: true,
  enableSelfInspection: true,
  consoleOutputFormat: 'detailed',
  reportRetentionCount: 10,
  maxReportFileSize: 50 * 1024 * 1024 // 50MB
};

/**
 * 流水线组装报告器实现
 */
export class PipelineAssemblyReporter implements IPipelineAssemblyReporter {
  private config: PipelineAssemblyReporterConfig;
  private reportId: string;
  private selfInspectionService: PipelineAssemblySelfInspection;

  constructor(config?: Partial<PipelineAssemblyReporterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 初始化自检服务
    this.selfInspectionService = new PipelineAssemblySelfInspection({
      enableComprehensiveChecks: this.config.enableSelfInspection,
      enableSecurityValidation: this.config.enableSelfInspection,
      enablePerformanceAnalysis: this.config.enableSelfInspection,
      enableConnectivityTesting: this.config.enableSelfInspection,
      failFastOnCritical: false,
      maxInspectionTimeMs: 5000
    });
    
    // 确保输出目录存在
    this.ensureOutputDirectory();
  }

  /**
   * 生成完整的流水线组装报告
   */
  async generateReport(
    routerResult: any,
    pipelineResult: any,
    configPath: string,
    serverPort: number
  ): Promise<PipelineAssemblyReport> {
    const startTime = Date.now();
    
    secureLogger.info('📊 Generating pipeline assembly report...', {
      configPath,
      serverPort,
      pipelineCount: pipelineResult?.allPipelines?.length || 0
    });

    // 1. 生成流水线详情
    const pipelineDetails = await this.generatePipelineDetails(pipelineResult);
    
    // 2. 生成模块注册统计
    const moduleRegistryStats = await this.generateModuleRegistryStats(pipelineResult);
    
    // 3. 生成性能指标
    const performanceMetrics = await this.generatePerformanceMetrics(pipelineResult);
    
    // 4. 生成自检结果
    const selfInspection = await this.generateSelfInspection(pipelineResult);
    
    // 5. 生成系统健康状态
    const systemHealth = this.generateSystemHealth(pipelineDetails, selfInspection);
    
    // 6. 生成原始输出文件路径
    const rawOutputFiles = this.generateRawOutputFilePaths();
    
    // 7. 生成升级路径
    const escalationPath = this.generateEscalationPath(pipelineDetails, selfInspection);

    const report: PipelineAssemblyReport = {
      reportType: 'pipeline-assembly-report',
      timestamp: new Date().toISOString(),
      sessionInfo: {
        configPath,
        serverPort,
        sessionId: this.generateSessionId(),
        reportId: this.reportId,
        environment: process.env.NODE_ENV || 'development'
      },
      assemblySummary: {
        totalPipelines: pipelineResult?.allPipelines?.length || 0,
        assembledPipelines: pipelineDetails.filter(p => p.assemblyStatus === 'assembled').length,
        failedPipelines: pipelineDetails.filter(p => p.assemblyStatus === 'failed').length,
        partialPipelines: pipelineDetails.filter(p => p.assemblyStatus === 'partial').length,
        assemblyTimeMs: pipelineResult?.stats?.assemblyTimeMs || 0,
        successRate: this.calculateSuccessRate(pipelineDetails)
      },
      pipelineDetails,
      moduleRegistryStats,
      performanceMetrics,
      selfInspection,
      systemHealth,
      rawOutputFiles,
      escalationPath
    };

    const generationTime = Date.now() - startTime;
    secureLogger.info('✅ Pipeline assembly report generated successfully', {
      generationTimeMs: generationTime,
      reportId: this.reportId,
      pipelineCount: report.assemblySummary.totalPipelines
    });

    return report;
  }

  /**
   * 生成控制台输出
   */
  generateConsoleOutput(report: PipelineAssemblyReport): string {
    const { assemblySummary, pipelineDetails, systemHealth, performanceMetrics } = report;
    
    let output = '\n';
    output += '='.repeat(80) + '\n';
    output += '🏭 RCC v4.0 流水线组装报告\n';
    output += '='.repeat(80) + '\n\n';
    
    // 基础信息
    output += '📋 组装摘要:\n';
    output += `   🎯 总流水线数量: ${assemblySummary.totalPipelines}\n`;
    output += `   ✅ 成功组装: ${assemblySummary.assembledPipelines}\n`;
    output += `   ❌ 组装失败: ${assemblySummary.failedPipelines}\n`;
    output += `   ⚠️  部分组装: ${assemblySummary.partialPipelines}\n`;
    output += `   📊 成功率: ${assemblySummary.successRate.toFixed(1)}%\n`;
    output += `   ⏱️  组装耗时: ${assemblySummary.assemblyTimeMs}ms\n\n`;
    
    // 系统健康状态
    output += this.generateHealthStatusOutput(systemHealth);
    
    // 流水线详情（表格形式）
    output += '🔧 流水线详情:\n';
    output += this.generatePipelineTable(pipelineDetails);
    
    // 性能指标
    output += '\n📈 性能指标:\n';
    output += `   🚀 平均组装时间: ${performanceMetrics.avgAssemblyTimeMs.toFixed(1)}ms\n`;
    output += `   📊 内存使用: ${performanceMetrics.memoryUsageMB.toFixed(1)}MB\n`;
    output += `   🏔️  峰值内存: ${performanceMetrics.peakMemoryUsageMB.toFixed(1)}MB\n`;
    output += `   ⚡ 启动时间: ${performanceMetrics.startupTimeMs.toFixed(1)}ms\n\n`;
    
    // 模块统计
    output += this.generateModuleStatsOutput(report.moduleRegistryStats);
    
    // 自检结果
    output += this.generateSelfInspectionOutput(report.selfInspection);
    
    // 升级路径
    if (report.escalationPath.errors.length > 0 || report.escalationPath.warnings.length > 0) {
      output += this.generateEscalationOutput(report.escalationPath);
    }
    
    output += '='.repeat(80) + '\n';
    output += `📄 详细的JSON报告已保存到: ${report.rawOutputFiles.pipelineConfigs}\n`;
    output += '='.repeat(80) + '\n';
    
    return output;
  }

  /**
   * 生成系统健康状态输出
   */
  private generateHealthStatusOutput(systemHealth: any): string {
    let output = '';
    output += '🏥 系统健康状态: ';
    const statusEmoji = {
      'healthy': '🟢',
      'warning': '🟡', 
      'unhealthy': '🔴'
    };
    output += `${statusEmoji[systemHealth.overallStatus]} ${systemHealth.overallStatus.toUpperCase()}\n\n`;
    
    if (systemHealth.criticalAlerts.length > 0) {
      output += '🚨 关键告警:\n';
      systemHealth.criticalAlerts.forEach(alert => {
        output += `   - ${alert}\n`;
      });
      output += '\n';
    }
    
    if (systemHealth.warnings.length > 0) {
      output += '⚠️  警告信息:\n';
      systemHealth.warnings.forEach(warning => {
        output += `   - ${warning}\n`;
      });
      output += '\n';
    }
    
    return output;
  }

  /**
   * 生成流水线表格
   */
  private generatePipelineTable(pipelineDetails: PipelineAssemblyDetail[]): string {
    let output = '';
    output += '   '.padEnd(50) + '状态'.padEnd(10) + '耗时'.padEnd(10) + '层数'.padEnd(8) + '模型\n';
    output += '   '.padEnd(50, '-') + '------'.padEnd(10, '-') + '----'.padEnd(10, '-') + '----'.padEnd(8, '-') + '------\n';
    
    pipelineDetails.forEach(pipeline => {
      const statusEmoji = {
        'assembled': '✅',
        'failed': '❌',
        'partial': '⚠️ '
      };
      const shortId = pipeline.pipelineId.length > 45 ? 
        pipeline.pipelineId.substring(0, 42) + '...' : 
        pipeline.pipelineId;
      
      const truncatedEndpoint = pipeline.endpoint.length > 30 ? 
        pipeline.endpoint.substring(0, 27) + '...' : 
        pipeline.endpoint;
      
      output += `   ${shortId.padEnd(45)} `;
      output += `${statusEmoji[pipeline.assemblyStatus].padEnd(10)} `;
      output += `${pipeline.assemblyTimeMs.toString().padEnd(10)} `;
      output += `${pipeline.layers.length.toString().padEnd(8)} `;
      output += `${pipeline.model} (${pipeline.provider})\n`;
    });
    
    output += '\n';
    return output;
  }

  /**
   * 生成模块统计输出
   */
  private generateModuleStatsOutput(moduleRegistryStats: ModuleRegistryStats): string {
    let output = '';
    output += '📦 模块注册统计:\n';
    output += `   🏗️  总模块数: ${moduleRegistryStats.totalModules}\n`;
    output += `   ✅ 活跃模块: ${moduleRegistryStats.activeModules}\n`;
    output += `   🌐 可用Provider: ${moduleRegistryStats.availableProviders.join(', ')}\n`;
    
    if (Object.keys(moduleRegistryStats.modulesByType).length > 0) {
      output += '   📂 模块类型分布:\n';
      Object.entries(moduleRegistryStats.modulesByType).forEach(([type, count]) => {
        output += `     - ${type}: ${count}\n`;
      });
    }
    
    output += '\n';
    return output;
  }

  /**
   * 生成自检输出
   */
  private generateSelfInspectionOutput(selfInspection: SelfInspectionResult): string {
    let output = '';
    output += '🔍 自检结果: ';
    const statusEmoji = {
      'passed': '✅',
      'failed': '❌',
      'warning': '⚠️ '
    };
    output += `${statusEmoji[selfInspection.status]} ${selfInspection.status.toUpperCase()}\n`;
    output += `   📊 综合评分: ${selfInspection.overallScore.toFixed(1)}/100\n`;
    
    if (selfInspection.criticalIssues.length > 0) {
      output += '   🚨 关键问题:\n';
      selfInspection.criticalIssues.forEach(issue => {
        output += `     - ${issue}\n`;
      });
    }
    
    if (selfInspection.recommendations.length > 0) {
      output += '   💡 改进建议:\n';
      selfInspection.recommendations.slice(0, 3).forEach(rec => {
        output += `     - ${rec}\n`;
      });
    }
    
    output += '\n';
    return output;
  }

  /**
   * 生成升级路径输出
   */
  private generateEscalationOutput(escalationPath: any): string {
    let output = '';
    output += '🚀 升级路径和建议:\n';
    
    if (escalationPath.errors.length > 0) {
      output += '   ❌ 错误处理:\n';
      escalationPath.errors.forEach(error => {
        output += `     - ${error}\n`;
      });
    }
    
    if (escalationPath.warnings.length > 0) {
      output += '   ⚠️  注意事项:\n';
      escalationPath.warnings.forEach(warning => {
        output += `     - ${warning}\n`;
      });
    }
    
    if (escalationPath.nextActions.length > 0) {
      output += '   🎯 后续行动:\n';
      escalationPath.nextActions.slice(0, 3).forEach(action => {
        output += `     - ${action}\n`;
      });
    }
    
    output += '\n';
    return output;
  }

  /**
   * 保存报告到文件
   */
  async saveReportToFile(report: PipelineAssemblyReport): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pipeline-assembly-report-${timestamp}.json`;
    const filePath = path.join(this.config.outputDirectory, filename);
    
    try {
      await fs.promises.writeFile(
        filePath, 
        JSON.stringify(report, null, 2), 
        'utf8'
      );
      
      secureLogger.info('✅ Pipeline assembly report saved to file', {
        filePath,
        fileSize: Buffer.byteLength(JSON.stringify(report, null, 2), 'utf8')
      });
      
      return filePath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      secureLogger.error('❌ Failed to save pipeline assembly report', { 
        filePath, 
        error: errorMessage 
      });
      throw error;
    }
  }

  /**
   * 生成自检报告
   */
  async generateSelfInspection(report: PipelineAssemblyReport): Promise<SelfInspectionResult> {
    // 使用专业的自检服务进行自检
    return await this.selfInspectionService.inspect(report);
  }

  /**
   * 验证报告完整性
   */
  validateReport(report: PipelineAssemblyReport): boolean {
    const requiredFields = [
      'reportType', 'timestamp', 'sessionInfo', 'assemblySummary',
      'pipelineDetails', 'moduleRegistryStats', 'performanceMetrics',
      'selfInspection', 'systemHealth'
    ];

    for (const field of requiredFields) {
      if (!report[field as keyof PipelineAssemblyReport]) {
        return false;
      }
    }

    // 验证数据一致性
    if (report.assemblySummary.totalPipelines !== report.pipelineDetails.length) {
      return false;
    }

    return true;
  }

  /**
   * 生成流水线详情
   */
  private async generatePipelineDetails(pipelineResult: any): Promise<PipelineAssemblyDetail[]> {
    const details: PipelineAssemblyDetail[] = [];

    if (!pipelineResult?.allPipelines) {
      return details;
    }

    for (const pipeline of pipelineResult.allPipelines) {
      const layers = await this.generateLayerDetails(pipeline);
      const validationResult = await this.validatePipeline(pipeline);
      
      details.push({
        pipelineId: pipeline.pipelineId,
        routeId: pipeline.routeId,
        routeName: pipeline.routeName || this.extractRouteName(pipeline.routeId),
        provider: pipeline.provider,
        model: pipeline.model,
        endpoint: pipeline.endpoint,
        assemblyStatus: pipeline.assemblyStatus || 'failed',
        assemblyTimeMs: pipeline.assemblyTime || 0,
        layers,
        moduleCount: pipeline.modules?.length || 0,
        errors: pipeline.assemblyErrors || [],
        warnings: [],
        healthStatus: this.calculateHealthStatus(pipeline, validationResult),
        validationResults: validationResult
      });
    }

    return details;
  }

  /**
   * 生成层详情
   */
  private async generateLayerDetails(pipeline: any): Promise<PipelineLayerDetail[]> {
    const layers: PipelineLayerDetail[] = [];

    if (!pipeline.modules) {
      return layers;
    }

    for (const module of pipeline.modules) {
      layers.push({
        name: module.name,
        type: module.type,
        order: module.order,
        moduleName: module.instance?.constructor?.name || 'Unknown',
        moduleType: module.type,
        assemblyTimeMs: module.initializationTime || 0,
        status: module.instance ? 'assembled' : 'failed',
        config: module.config || {},
        connections: this.extractConnections(module),
        healthStatus: module.instance?.getStatus?.().health || 'unknown',
        errors: module.errors || [],
        warnings: module.warnings || []
      });
    }

    return layers;
  }

  /**
   * 生成模块注册统计
   */
  private async generateModuleRegistryStats(pipelineResult: any): Promise<ModuleRegistryStats> {
    const stats = pipelineResult?.stats || {};
    
    return {
      totalModules: stats.totalModulesRegistered || 0,
      activeModules: stats.successfulAssemblies || 0,
      modulesByType: stats.modulesByType || {},
      availableProviders: this.extractAvailableProviders(pipelineResult),
      moduleHealthStatus: {} // 可以从流水线详情中提取
    };
  }

  /**
   * 生成性能指标
   */
  private async generatePerformanceMetrics(pipelineResult: any): Promise<PerformanceMetrics> {
    const stats = pipelineResult?.stats || {};
    const memoryUsage = process.memoryUsage();

    return {
      totalAssemblyTimeMs: stats.assemblyTimeMs || 0,
      avgAssemblyTimeMs: stats.averageAssemblyTime || 0,
      maxAssemblyTimeMs: stats.maxAssemblyTime || 0,
      minAssemblyTimeMs: stats.minAssemblyTime || 0,
      memoryUsageMB: memoryUsage.heapUsed / 1024 / 1024,
      peakMemoryUsageMB: memoryUsage.heapTotal / 1024 / 1024,
      startupTimeMs: stats.assemblyTimeMs || 0
    };
  }

  /**
   * 生成系统健康状态
   */
  private generateSystemHealth(pipelineDetails: PipelineAssemblyDetail[], selfInspection: SelfInspectionResult) {
    const failedPipelines = pipelineDetails.filter(p => p.assemblyStatus === 'failed').length;
    const criticalIssues = selfInspection.criticalIssues.length;

    let overallStatus: 'healthy' | 'warning' | 'unhealthy' = 'healthy';
    const criticalAlerts: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (failedPipelines > 0) {
      criticalAlerts.push(`${failedPipelines} pipeline(s) failed to assemble`);
      overallStatus = criticalIssues > 0 ? 'unhealthy' : 'warning';
    }

    if (selfInspection.overallScore < 50) {
      criticalAlerts.push('System self-inspection score is critically low');
      overallStatus = 'unhealthy';
    } else if (selfInspection.overallScore < 80) {
      warnings.push('System self-inspection score needs improvement');
      overallStatus = overallStatus === 'healthy' ? 'warning' : overallStatus;
    }

    return {
      overallStatus,
      criticalAlerts,
      warnings,
      recommendations: [...recommendations, ...selfInspection.recommendations]
    };
  }

  /**
   * 生成原始输出文件路径
   */
  private generateRawOutputFilePaths() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return {
      pipelineConfigs: path.join(this.config.outputDirectory, `pipeline-configs-${timestamp}.json`),
      assembledPipelines: path.join(this.config.outputDirectory, `assembled-pipelines-${timestamp}.json`),
      validationReport: path.join(this.config.outputDirectory, `validation-report-${timestamp}.json`),
      performanceReport: path.join(this.config.outputDirectory, `performance-report-${timestamp}.json`)
    };
  }

  /**
   * 生成升级路径
   */
  private generateEscalationPath(pipelineDetails: PipelineAssemblyDetail[], selfInspection: SelfInspectionResult) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const nextActions: string[] = [];

    // 错误处理
    const failedPipelines = pipelineDetails.filter(p => p.assemblyStatus === 'failed');
    if (failedPipelines.length > 0) {
      errors.push(`Failed to assemble ${failedPipelines.length} pipelines`);
      nextActions.push('Review failed pipeline configurations and module dependencies');
    }

    // 警告信息
    const partialPipelines = pipelineDetails.filter(p => p.assemblyStatus === 'partial');
    if (partialPipelines.length > 0) {
      warnings.push(`${partialPipelines.length} pipelines partially assembled`);
      nextActions.push('Complete partial pipeline assembly');
    }

    // 性能相关
    const slowPipelines = pipelineDetails.filter(p => p.assemblyTimeMs > 1000);
    if (slowPipelines.length > 0) {
      warnings.push(`${slowPipelines.length} pipelines have slow assembly time`);
      nextActions.push('Optimize slow-performing pipeline modules');
    }

    return {
      errors,
      warnings,
      nextActions
    };
  }

  /**
   * 计算成功率
   */
  private calculateSuccessRate(pipelineDetails: PipelineAssemblyDetail[]): number {
    if (pipelineDetails.length === 0) return 0;
    const successful = pipelineDetails.filter(p => p.assemblyStatus === 'assembled').length;
    return (successful / pipelineDetails.length) * 100;
  }

  /**
   * 提取路由名称
   */
  private extractRouteName(routeId: string): string {
    const parts = routeId.split('_');
    return parts.length >= 2 ? parts[1] : 'unknown';
  }

  /**
   * 提取连接信息
   */
  private extractConnections(module: any): string[] {
    const connections: string[] = [];
    
    if (module.previousModule) {
      connections.push(`prev:${module.previousModule.name}`);
    }
    
    if (module.nextModule) {
      connections.push(`next:${module.nextModule.name}`);
    }
    
    return connections;
  }

  /**
   * 提取可用Provider
   */
  private extractAvailableProviders(pipelineResult: any): string[] {
    const providers = new Set<string>();
    
    if (pipelineResult?.allPipelines) {
      pipelineResult.allPipelines.forEach((pipeline: any) => {
        if (pipeline.provider) {
          providers.add(pipeline.provider);
        }
      });
    }
    
    return Array.from(providers);
  }

  /**
   * 计算健康状态
   */
  private calculateHealthStatus(pipeline: any, validationResult?: PipelineValidationResult): 'healthy' | 'warning' | 'unhealthy' {
    if (pipeline.assemblyStatus === 'failed') {
      return 'unhealthy';
    }
    
    if (validationResult && !validationResult.isValid) {
      return 'warning';
    }
    
    return 'healthy';
  }

  /**
   * 验证流水线
   */
  private async validatePipeline(pipeline: any): Promise<PipelineValidationResult> {
    const checks: ValidationCheck[] = [];
    let isValid = true;

    // 基础配置检查
    checks.push({
      name: 'Basic Configuration',
      type: 'configuration',
      status: pipeline.pipelineId && pipeline.provider && pipeline.model ? 'passed' : 'failed',
      message: 'Pipeline has required basic configuration',
      score: pipeline.pipelineId && pipeline.provider && pipeline.model ? 100 : 0
    });

    // 模块检查
    const hasModules = pipeline.modules && pipeline.modules.length > 0;
    checks.push({
      name: 'Module Assembly',
      type: 'configuration',
      status: hasModules ? 'passed' : 'failed',
      message: hasModules ? `Pipeline has ${pipeline.modules.length} modules` : 'Pipeline has no modules',
      score: hasModules ? 100 : 0,
      details: { moduleCount: pipeline.modules?.length || 0 }
    });

    if (!hasModules) {
      isValid = false;
    }

    // 计算总体评分
    const rawScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
    const overallScore = Math.min(100, Math.max(0, rawScore));

    return {
      isValid,
      validationTimeMs: 0,
      checks,
      overallScore,
      recommendations: isValid ? [] : ['Review pipeline configuration and module assembly']
    };
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 确保输出目录存在
   */
  private ensureOutputDirectory(): void {
    try {
      if (!fs.existsSync(this.config.outputDirectory)) {
        fs.mkdirSync(this.config.outputDirectory, { recursive: true });
        secureLogger.info('✅ Created pipeline assembly report output directory', {
          directory: this.config.outputDirectory
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      secureLogger.error('❌ Failed to create output directory', {
        directory: this.config.outputDirectory,
        error: errorMessage
      });
      throw error;
    }
  }
}