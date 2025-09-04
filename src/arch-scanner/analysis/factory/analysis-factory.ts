/**
 * Analysis Module Factory
 * 
 * 创建分析相关组件的工厂
 * 
 * @author RCC v4.0 Architecture Scanner
 */

import type { ModuleAnalyzerInterface } from '../../core/interfaces/scanner-interface';
import type { ArchScannerConfig } from '../../types/config-types';
import { TypeScriptModuleAnalyzer } from '../internal/typescript-module-analyzer';

/**
 * 分析模块工厂
 */
export class AnalysisModuleFactory {
  /**
   * 创建模块分析器
   */
  static createModuleAnalyzer(config: ArchScannerConfig): ModuleAnalyzerInterface {
    return new TypeScriptModuleAnalyzer(config);
  }
}