/**
 * Architecture Scanner - Main Entry Point
 * 
 * 架构扫描系统的主入口，提供统一的门面接口
 * 遵循零接口暴露设计原则，只暴露必要的公共接口
 * 
 * @author RCC v4.0 Architecture Scanner
 */

import { ArchScannerMainFactory } from './internal/main-factory';
import type { ArchScannerConfig } from './types/config-types';
import type { 
  ArchitectureComplianceReport, 
  ModuleComplianceReport, 
  ReportFormat 
} from './types/scan-result';

/**
 * 架构扫描器接口
 * 
 * 这是唯一对外暴露的主接口，封装了所有架构扫描功能
 */
export interface ArchScannerInterface {
  /**
   * 扫描整个项目的架构合规性
   */
  scanProject(): Promise<ArchitectureComplianceReport>;

  /**
   * 扫描指定模块的架构合规性
   */
  scanModule(moduleName: string): Promise<ModuleComplianceReport>;

  /**
   * 生成指定格式的报告
   */
  generateReport(format?: ReportFormat): Promise<string>;

  /**
   * 验证项目架构是否符合规范
   */
  validateArchitecture(): Promise<boolean>;

  /**
   * 获取扫描器配置信息
   */
  getConfig(): ArchScannerConfig;

  /**
   * 获取扫描器状态
   */
  getStatus(): {
    ready: boolean;
    lastScanTime?: Date;
    totalViolations: number;
    criticalViolations: number;
  };
}

/**
 * 创建架构扫描器实例
 * 
 * 这是唯一的公共工厂函数，内部实现完全隐藏
 * 
 * @param config 可选的配置参数
 * @returns 架构扫描器实例
 */
export function createArchScanner(config?: ArchScannerConfig): ArchScannerInterface {
  return ArchScannerMainFactory.create(config);
}

// 重新导出必要的类型定义（不暴露内部实现）
export type { ArchScannerConfig } from './types/config-types';
export type { 
  ArchitectureComplianceReport, 
  ModuleComplianceReport,
  ViolationReport,
  RecommendationReport,
  ViolationSeverity,
  ViolationCategory,
  ReportFormat
} from './types/scan-result';