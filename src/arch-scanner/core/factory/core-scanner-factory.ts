/**
 * Core Scanner Factory
 * 
 * 创建核心扫描器组件的工厂
 * 
 * @author RCC v4.0 Architecture Scanner
 */

import type { ScannerInterface, ScannerDependencies } from '../interfaces/scanner-interface';
import { ComprehensiveArchScanner } from '../internal/comprehensive-arch-scanner';

/**
 * 核心扫描器工厂
 */
export class CoreScannerFactory {
  /**
   * 创建核心扫描器
   */
  static createScanner(dependencies: ScannerDependencies): ScannerInterface {
    return new ComprehensiveArchScanner(dependencies);
  }
}