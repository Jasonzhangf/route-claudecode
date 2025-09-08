#!/usr/bin/env node

/**
 * 架构扫描测试脚本
 * 
 * 用于验证架构修复效果
 */

import { createArchScanner } from './src/arch-scanner/index';
import { secureLogger } from './src/utils/secure-logger';

async function runArchitectureScan() {
  secureLogger.info('🚀 开始架构合规性扫描...');
  
  try {
    // 创建架构扫描器实例
    const scanner = createArchScanner({
      projectRoot: process.cwd(),
      strictMode: true,
      enableCache: false,
      reportFormats: ['json', 'text']
    });
    
    // 验证架构
    secureLogger.info('🔍 验证项目架构...');
    const isValid = await scanner.validateArchitecture();
    secureLogger.info(`✅ 架构验证结果: ${isValid ? '合规' : '不合规'}`);
    
    // 获取扫描器状态
    const status = scanner.getStatus();
    secureLogger.info('📊 扫描器状态:', {
      ready: status.ready,
      lastScanTime: status.lastScanTime,
      totalViolations: status.totalViolations,
      criticalViolations: status.criticalViolations
    });
    
    // 扫描项目
    secureLogger.info('🔎 扫描项目架构...');
    const report = await scanner.scanProject();
    
    secureLogger.info('📋 扫描报告摘要:', {
      complianceScore: report.summary.complianceScore,
      totalModules: report.summary.totalModules,
      violatingModules: report.summary.violatingModules,
      criticalViolations: report.summary.criticalViolations,
      warningViolations: report.summary.warningViolations
    });
    
    // 检查ModuleInterface违规
    const moduleInterfaceViolations = report.violations.filter(
      v => v.message.includes('MODULE_INTERFACE_REQUIRED') || 
           v.message.includes('ModuleInterface') ||
           v.description.includes('ModuleInterface')
    );
    
    if (moduleInterfaceViolations.length === 0) {
      secureLogger.info('🔧 ModuleInterface违规检查: ✅ 未发现ModuleInterface实现问题');
    } else {
      secureLogger.warn('🔧 ModuleInterface违规检查:', {
        violationCount: moduleInterfaceViolations.length,
        violations: moduleInterfaceViolations.map(v => `${v.module}: ${v.message}`)
      });
    }
    
    // 检查接口暴露违规
    const interfaceExposureViolations = report.violations.filter(
      v => v.message.includes('ZERO_INTERFACE_EXPOSURE') || 
           v.message.includes('interface exposure') ||
           v.description.includes('exposure')
    );
    
    if (interfaceExposureViolations.length === 0) {
      secureLogger.info('📤 接口暴露违规检查: ✅ 未发现接口暴露问题');
    } else {
      secureLogger.warn('📤 接口暴露违规检查:', {
        violationCount: interfaceExposureViolations.length,
        violations: interfaceExposureViolations.map(v => `${v.module}: ${v.message}`)
      });
    }
    
    return report;
    
  } catch (error) {
    secureLogger.error('❌ 架构扫描失败:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

// 运行扫描
if (require.main === module) {
  runArchitectureScan()
    .then(() => {
      secureLogger.info('✅ 架构扫描完成');
      process.exit(0);
    })
    .catch(error => {
      secureLogger.error('❌ 架构扫描出错:', {
        error: error instanceof Error ? error.message : String(error)
      });
      process.exit(1);
    });
}

export { runArchitectureScan };