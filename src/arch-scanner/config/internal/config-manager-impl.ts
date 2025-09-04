/**
 * Configuration Manager Implementation
 * 
 * 配置管理器的具体实现
 * 
 * @author RCC v4.0 Architecture Scanner
 */

import type { ConfigManagerInterface, ValidationResult } from '../../core/interfaces/scanner-interface';
import type { ArchScannerConfig } from '../../types/config-types';
import * as path from 'path';
import * as os from 'os';

/**
 * 配置管理器实现类
 */
export class ConfigManagerImpl implements ConfigManagerInterface {
  
  /**
   * 解析配置
   */
  resolveConfig(config?: ArchScannerConfig): ArchScannerConfig {
    const defaultConfig = this.getDefaultConfig();
    
    if (!config) {
      return defaultConfig;
    }

    // 解析项目根路径
    const resolvedProjectRoot = config.projectRoot 
      ? path.resolve(config.projectRoot)
      : defaultConfig.projectRoot;

    // 解析输出目录
    const resolvedOutputDir = config.outputDir
      ? path.resolve(config.outputDir)
      : path.join(resolvedProjectRoot, 'arch-scan-reports');

    // 解析缓存目录
    const resolvedCacheDir = config.cacheDir
      ? path.resolve(config.cacheDir)
      : path.join(os.tmpdir(), 'arch-scanner-cache');

    return {
      projectRoot: resolvedProjectRoot,
      outputDir: resolvedOutputDir,
      strictMode: config.strictMode ?? defaultConfig.strictMode,
      customRules: config.customRules ?? defaultConfig.customRules,
      excludePatterns: config.excludePatterns ?? defaultConfig.excludePatterns,
      includePatterns: config.includePatterns ?? defaultConfig.includePatterns,
      reportFormats: config.reportFormats ?? defaultConfig.reportFormats,
      enableCache: config.enableCache ?? defaultConfig.enableCache,
      cacheDir: resolvedCacheDir,
      parallel: config.parallel ?? defaultConfig.parallel,
      maxWorkers: config.maxWorkers ?? defaultConfig.maxWorkers
    };
  }

  /**
   * 验证配置
   */
  validateConfig(config: ArchScannerConfig): ValidationResult {
    const validationErrors: string[] = [];
    const validationWarnings: string[] = [];

    // 验证项目根路径
    if (!config.projectRoot) {
      validationErrors.push('Project root path is required');
    }

    if (typeof config.projectRoot !== 'string') {
      validationErrors.push('Project root path must be a string');
    }

    // 验证最大工作线程数
    if (config.maxWorkers !== undefined) {
      if (typeof config.maxWorkers !== 'number' || config.maxWorkers < 1) {
        validationErrors.push('Max workers must be a positive number');
      }
      
      if (config.maxWorkers > os.cpus().length * 2) {
        validationWarnings.push(`Max workers (${config.maxWorkers}) exceeds recommended limit (${os.cpus().length * 2})`);
      }
    }

    // 验证报告格式
    if (config.reportFormats) {
      const supportedFormats = ['html', 'json', 'markdown'];
      for (const format of config.reportFormats) {
        if (!supportedFormats.includes(format)) {
          validationErrors.push(`Unsupported report format: ${format}`);
        }
      }
    }

    // 验证排除模式
    if (config.excludePatterns) {
      for (const pattern of config.excludePatterns) {
        if (typeof pattern !== 'string') {
          validationErrors.push('Exclude patterns must be strings');
          break;
        }
      }
    }

    // 验证包含模式
    if (config.includePatterns) {
      for (const pattern of config.includePatterns) {
        if (typeof pattern !== 'string') {
          validationErrors.push('Include patterns must be strings');
          break;
        }
      }
    }

    // 验证自定义规则路径
    if (config.customRules) {
      for (const rulePath of config.customRules) {
        if (typeof rulePath !== 'string') {
          validationErrors.push('Custom rule paths must be strings');
          break;
        }
      }
    }

    return {
      valid: validationErrors.length === 0,
      errors: validationErrors,
      warnings: validationWarnings
    };
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): ArchScannerConfig {
    return {
      projectRoot: process.cwd(),
      outputDir: path.join(process.cwd(), 'arch-scan-reports'),
      strictMode: true,
      customRules: [],
      excludePatterns: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'coverage/**',
        '.git/**'
      ],
      includePatterns: [
        'src/**/*.ts',
        'src/**/*.tsx'
      ],
      reportFormats: ['json', 'html'],
      enableCache: true,
      cacheDir: path.join(os.tmpdir(), 'arch-scanner-cache'),
      parallel: true,
      maxWorkers: Math.max(1, Math.floor(os.cpus().length / 2))
    };
  }
}