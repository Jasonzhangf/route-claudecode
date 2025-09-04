/**
 * Rule-Based Violation Detector
 * 
 * 基于规则的违规检测器实现
 * 
 * @author RCC v4.0 Architecture Scanner
 */

import type { ViolationDetectorInterface, ModuleInfo, ViolationInfo } from '../../core/interfaces/scanner-interface';
import type { ArchScannerConfig } from '../../types/config-types';

export class RuleBasedViolationDetector implements ViolationDetectorInterface {
  private readonly config: ArchScannerConfig;

  constructor(config: ArchScannerConfig) {
    this.config = config;
  }

  async detectViolations(moduleInfo: ModuleInfo): Promise<ViolationInfo[]> {
    return [];
  }

  async detectProjectViolations(modules: ModuleInfo[]): Promise<ViolationInfo[]> {
    return [];
  }
}