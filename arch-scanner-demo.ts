#!/usr/bin/env npx ts-node
/**
 * Architecture Scanner Demo
 * 
 * 演示架构扫描系统的功能
 * 
 * @author RCC v4.0 Architecture Scanner
 */

import { createArchScanner } from './src/arch-scanner';
import { secureLogger } from './src/utils/secure-logger';

async function main() {
  secureLogger.info('🔍 RCC v4.0 Architecture Scanner Demo Started');
  
  // 创建架构扫描器实例
  const scanner = createArchScanner({
    projectRoot: process.cwd(),
    strictMode: true,
    reportFormats: ['json', 'html', 'markdown']
  });
  
  secureLogger.info('📊 Scanner Configuration', scanner.getConfig());
  
  secureLogger.info('🔍 Scanning Project Architecture...');
  const report = await scanner.scanProject();
  
  secureLogger.info('📈 Scan Results', {
    totalModules: report.summary.totalModules,
    complianceScore: report.summary.complianceScore,
    violatingModules: report.summary.violatingModules,
    criticalViolations: report.summary.criticalViolations,
    warningViolations: report.summary.warningViolations,
    infoViolations: report.summary.infoViolations
  });
  
  secureLogger.info('🎯 Architecture Validation');
  const isValid = await scanner.validateArchitecture();
  secureLogger.info('Architecture Validation Result', { isValid });
  
  if (report.violations.length > 0) {
    secureLogger.info('⚠️ Violations Found', { violations: report.violations });
  }
  
  if (report.recommendations.length > 0) {
    secureLogger.info('💡 Recommendations', { recommendations: report.recommendations });
  }
  
  secureLogger.info('📝 Generating Reports...');
  
  // 生成各种格式报告
  const jsonReport = await scanner.generateReport('json');
  const htmlReport = await scanner.generateReport('html');
  const markdownReport = await scanner.generateReport('markdown');
  
  secureLogger.info('Reports Generated Successfully', {
    jsonLength: jsonReport.length,
    htmlLength: htmlReport.length,
    markdownLength: markdownReport.length
  });
  
  secureLogger.info('🔍 Module Scan Example');
  const moduleReport = await scanner.scanModule('arch-scanner');
  secureLogger.info('Module Scan Result', {
    moduleName: moduleReport.moduleName,
    complianceScore: moduleReport.complianceScore,
    violationsCount: moduleReport.violations.length
  });
  
  secureLogger.info('📊 Scanner Status', scanner.getStatus());
  
  secureLogger.info('🎉 Architecture Scanner Demo Complete', {
    phase1Features: [
      'Modular architecture with zero interface exposure',
      'Complete factory pattern and dependency injection',
      'Multi-format report generation (JSON, HTML, Markdown)',
      'Comprehensive test coverage',
      'TypeScript strict mode compliance'
    ],
    nextPhase: 'Phase 2: Advanced violation detection and rule engine implementation'
  });
  
  return {
    success: true,
    report,
    scanner,
    demonstrationComplete: true
  };
}

// 运行演示
if (require.main === module) {
  main().then(result => {
    secureLogger.info('Demo execution completed', result);
  });
}

export { main };