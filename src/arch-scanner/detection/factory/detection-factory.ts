/**
 * Detection Module Factory
 * 
 * 创建违规检测相关组件的工厂
 * 
 * @author RCC v4.0 Architecture Scanner
 */

import type { ViolationDetectorInterface } from '../../core/interfaces/scanner-interface';
import type { ArchScannerConfig } from '../../types/config-types';
import { RuleBasedViolationDetector } from '../internal/rule-based-violation-detector';

/**
 * 检测模块工厂
 */
export class DetectionModuleFactory {
  /**
   * 创建违规检测器
   */
  static createViolationDetector(config: ArchScannerConfig): ViolationDetectorInterface {
    return new RuleBasedViolationDetector(config);
  }
}