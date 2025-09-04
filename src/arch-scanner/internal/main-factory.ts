/**
 * Architecture Scanner Main Factory
 * 
 * 架构扫描系统的主工厂，负责创建和组装所有内部组件
 * 实现依赖注入和模块化架构
 * 
 * @author RCC v4.0 Architecture Scanner
 */

import type { ArchScannerInterface } from '../index';
import type { ArchScannerConfig } from '../types/config-types';
import type { ScannerDependencies, ScannerInterface } from '../core/interfaces/scanner-interface';

// 导入各模块工厂
import { ConfigModuleFactory } from '../config/factory/config-factory';
import { AnalysisModuleFactory } from '../analysis/factory/analysis-factory';
import { DetectionModuleFactory } from '../detection/factory/detection-factory';
import { ReportingModuleFactory } from '../reporting/factory/reporting-factory';
import { CoreScannerFactory } from '../core/factory/core-scanner-factory';
import { ArchScannerFacade } from './scanner-facade';

/**
 * 架构扫描器主工厂类
 * 
 * 职责：
 * 1. 解析和验证配置
 * 2. 创建所有依赖组件
 * 3. 组装完整的扫描器实例
 * 4. 确保零接口暴露原则
 */
export class ArchScannerMainFactory {
  
  /**
   * 创建架构扫描器实例
   * 
   * @param config 可选的配置参数
   * @returns 架构扫描器实例
   */
  static create(config?: ArchScannerConfig): ArchScannerInterface {
    // Phase 1: 配置解析和验证
    const configManager = ConfigModuleFactory.createConfigManager();
    const resolvedConfig = configManager.resolveConfig(config);
    
    // 验证配置
    const validationResult = configManager.validateConfig(resolvedConfig);
    if (!validationResult.valid) {
      throw new TypeError(`Invalid configuration: ${validationResult.errors.join(', ')}`);
    }
    
    // Phase 2: 创建核心依赖组件
    const moduleAnalyzer = AnalysisModuleFactory.createModuleAnalyzer(resolvedConfig);
    const violationDetector = DetectionModuleFactory.createViolationDetector(resolvedConfig);
    const reportGenerator = ReportingModuleFactory.createReportGenerator(resolvedConfig);
    
    // Phase 3: 组装扫描器依赖
    const dependencies: ScannerDependencies = {
      moduleAnalyzer,
      violationDetector,
      reportGenerator,
      configManager
    };
    
    // Phase 4: 创建核心扫描器
    const coreScanner = CoreScannerFactory.createScanner(dependencies);
    
    // Phase 5: 返回门面接口（确保内部实现完全隐藏）
    return new ArchScannerFacade(coreScanner, resolvedConfig);
  }

  /**
   * 创建用于开发环境的扫描器实例
   * 
   * @param config 开发环境配置
   * @returns 开发环境扫描器实例
   */
  static createForDevelopment(config?: ArchScannerConfig): ArchScannerInterface {
    // 创建开发环境特定配置
    const devConfig: ArchScannerConfig = {
      projectRoot: config?.projectRoot || process.cwd(),
      strictMode: false,
      enableCache: false,
      reportFormats: ['json', 'html'],
      ...config
    };

    return this.create(devConfig);
  }

  /**
   * 创建用于生产环境的扫描器实例
   * 
   * @param config 生产环境配置
   * @returns 生产环境扫描器实例
   */
  static createForProduction(config: ArchScannerConfig): ArchScannerInterface {
    // 生产环境强制严格模式
    const prodConfig: ArchScannerConfig = {
      ...config,
      strictMode: true,
      enableCache: true,
      parallel: true
    };

    // 验证生产环境必需配置
    if (!prodConfig.projectRoot) {
      throw new TypeError('Production environment requires projectRoot configuration');
    }

    return this.create(prodConfig);
  }

  /**
   * 验证工厂配置
   * 
   * @param config 配置对象
   * @returns 验证结果
   */
  private static validateFactoryConfig(config: ArchScannerConfig): boolean {
    // 基本验证逻辑
    if (!config.projectRoot) {
      return false;
    }
    
    if (config.maxWorkers && config.maxWorkers < 1) {
      return false;
    }
    
    return true;
  }
}