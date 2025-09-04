/**
 * Reporting Module Factory
 * 
 * 创建报告生成相关组件的工厂
 * 
 * @author RCC v4.0 Architecture Scanner
 */

import type { ReportGeneratorInterface } from '../../core/interfaces/scanner-interface';
import type { ArchScannerConfig } from '../../types/config-types';
import { MultiFormatReportGenerator } from '../internal/multi-format-report-generator';

/**
 * 报告模块工厂
 */
export class ReportingModuleFactory {
  /**
   * 创建报告生成器
   */
  static createReportGenerator(config: ArchScannerConfig): ReportGeneratorInterface {
    return new MultiFormatReportGenerator(config);
  }
}