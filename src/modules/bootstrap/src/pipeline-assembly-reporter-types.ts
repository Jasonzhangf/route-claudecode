/**
 * Pipeline Assembly Reporting Interface
 * 
 * 定义流水线组装报告的数据结构和接口
 * 
 * @author Claude Code Router v4.0
 */

/**
 * 流水线组装报告中的单个流水线详情
 */
export interface PipelineAssemblyDetail {
  pipelineId: string;
  routeId: string;
  routeName: string;
  provider: string;
  model: string;
  endpoint: string;
  assemblyStatus: 'assembled' | 'failed' | 'partial';
  assemblyTimeMs: number;
  layers: PipelineLayerDetail[];
  moduleCount: number;
  errors: string[];
  warnings: string[];
  healthStatus: 'healthy' | 'warning' | 'unhealthy';
  validationResults?: PipelineValidationResult;
}

/**
 * 流水线层详情
 */
export interface PipelineLayerDetail {
  name: string;
  type: string;
  order: number;
  moduleName?: string;
  moduleType?: string;
  assemblyTimeMs: number;
  status: 'assembled' | 'failed' | 'skipped';
  config: Record<string, any>;
  connections: string[];
  healthStatus: 'healthy' | 'warning' | 'unhealthy';
  errors: string[];
  warnings: string[];
}

/**
 * 流水线验证结果
 */
export interface PipelineValidationResult {
  isValid: boolean;
  validationTimeMs: number;
  checks: ValidationCheck[];
  overallScore: number;
  recommendations: string[];
}

/**
 * 单个验证检查
 */
export interface ValidationCheck {
  name: string;
  type: 'connectivity' | 'configuration' | 'health' | 'performance' | 'security';
  status: 'passed' | 'failed' | 'warning';
  message: string;
  details?: Record<string, any>;
  score: number;
}

/**
 * 模块注册统计
 */
export interface ModuleRegistryStats {
  totalModules: number;
  activeModules: number;
  modulesByType: Record<string, number>;
  availableProviders: string[];
  moduleHealthStatus: Record<string, 'healthy' | 'warning' | 'unhealthy'>;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  totalAssemblyTimeMs: number;
  avgAssemblyTimeMs: number;
  maxAssemblyTimeMs: number;
  minAssemblyTimeMs: number;
  memoryUsageMB: number;
  peakMemoryUsageMB: number;
  cpuUsagePercent?: number;
  startupTimeMs: number;
}

/**
 * 自检结果
 */
export interface SelfInspectionResult {
  timestamp: string;
  inspector: string;
  status: 'passed' | 'failed' | 'warning';
  checks: SelfInspectionCheck[];
  overallScore: number;
  criticalIssues: string[];
  recommendations: string[];
}

/**
 * 自检检查项
 */
export interface SelfInspectionCheck {
  name: string;
  category: 'configuration' | 'connectivity' | 'performance' | 'security' | 'compliance';
  status: 'passed' | 'failed' | 'warning';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, any>;
}

/**
 * 完整的流水线组装报告
 */
export interface PipelineAssemblyReport {
  reportType: 'pipeline-assembly-report';
  timestamp: string;
  sessionInfo: {
    configPath: string;
    serverPort: number;
    sessionId: string;
    reportId: string;
    environment: string;
  };
  assemblySummary: {
    totalPipelines: number;
    assembledPipelines: number;
    failedPipelines: number;
    partialPipelines: number;
    assemblyTimeMs: number;
    successRate: number;
  };
  pipelineDetails: PipelineAssemblyDetail[];
  moduleRegistryStats: ModuleRegistryStats;
  performanceMetrics: PerformanceMetrics;
  selfInspection: SelfInspectionResult;
  systemHealth: {
    overallStatus: 'healthy' | 'warning' | 'unhealthy';
    criticalAlerts: string[];
    warnings: string[];
    recommendations: string[];
  };
  rawOutputFiles: {
    pipelineConfigs: string;
    assembledPipelines: string;
    validationReport: string;
    performanceReport: string;
  };
  escalationPath: {
    errors: string[];
    warnings: string[];
    nextActions: string[];
  };
}

/**
 * 流水线组装报告器接口
 */
export interface IPipelineAssemblyReporter {
  /**
   * 生成完整的流水线组装报告
   */
  generateReport(
    routerResult: any,
    pipelineResult: any,
    configPath: string,
    serverPort: number
  ): Promise<PipelineAssemblyReport>;

  /**
   * 生成控制台输出
   */
  generateConsoleOutput(report: PipelineAssemblyReport): string;

  /**
   * 保存报告到文件
   */
  saveReportToFile(report: PipelineAssemblyReport): Promise<string>;

  /**
   * 生成自检报告
   */
  generateSelfInspection(report: PipelineAssemblyReport): Promise<SelfInspectionResult>;

  /**
   * 验证报告完整性
   */
  validateReport(report: PipelineAssemblyReport): boolean;
}

/**
 * 流水线组装事件
 */
export interface PipelineAssemblyEvent {
  timestamp: string;
  eventType: 'assembly-started' | 'pipeline-assembling' | 'pipeline-assembled' | 'assembly-completed' | 'assembly-failed';
  pipelineId?: string;
  data: Record<string, any>;
}

/**
 * 流水线组装事件监听器
 */
export interface IPipelineAssemblyEventListener {
  onEvent(event: PipelineAssemblyEvent): Promise<void>;
}

/**
 * 配置项
 */
export interface PipelineAssemblyReporterConfig {
  outputDirectory: string;
  enableConsoleOutput: boolean;
  enableFileOutput: boolean;
  enableDetailedLogging: boolean;
  enableSelfInspection: boolean;
  consoleOutputFormat: 'simple' | 'detailed' | 'json';
  reportRetentionCount: number;
  maxReportFileSize: number;
}