/**
 * Architecture Scanner Integration Test
 * 
 * 验证架构扫描系统的完整功能
 * 
 * @author RCC v4.0 Architecture Scanner
 */

import { createArchScanner } from '../../index';
import type { ArchScannerInterface, ArchitectureComplianceReport } from '../../index';

describe('ArchScanner Integration Test', () => {
  let scanner: ArchScannerInterface;
  let scanResult: ArchitectureComplianceReport;

  beforeAll(async () => {
    // 创建针对实际项目的扫描器
    scanner = createArchScanner({
      projectRoot: process.cwd(),
      strictMode: true,
      reportFormats: ['json', 'html', 'markdown']
    });
  });

  it('should scan the RCC v4.0 project successfully', async () => {
    scanResult = await scanner.scanProject();
    
    expect(scanResult).toBeDefined();
    expect(scanResult.summary).toBeDefined();
    expect(scanResult.violations).toBeInstanceOf(Array);
    expect(scanResult.recommendations).toBeInstanceOf(Array);
    expect(scanResult.timestamp).toBeInstanceOf(Date);
  });

  it('should return correct compliance summary', async () => {
    expect(scanResult.summary.totalModules).toBeGreaterThan(100); // Real project has many modules
    expect(scanResult.summary.complianceScore).toBeGreaterThanOrEqual(0);
    expect(scanResult.summary.complianceScore).toBeLessThanOrEqual(100);
    expect(typeof scanResult.summary.violatingModules).toBe('number');
    expect(typeof scanResult.summary.criticalViolations).toBe('number');
  });

  it('should validate architecture successfully', async () => {
    const isValid = await scanner.validateArchitecture();
    expect(typeof isValid).toBe('boolean');
    
    // 在Phase 1，应该返回true（没有检测到关键违规）
    expect(isValid).toBe(true);
  });

  it('should generate reports in all formats', async () => {
    const jsonReport = await scanner.generateReport('json');
    expect(typeof jsonReport).toBe('string');
    expect(() => JSON.parse(jsonReport)).not.toThrow();
    
    const htmlReport = await scanner.generateReport('html');
    expect(typeof htmlReport).toBe('string');
    expect(htmlReport).toContain('<!DOCTYPE html>');
    expect(htmlReport).toContain('Architecture Compliance Report');
    
    const markdownReport = await scanner.generateReport('markdown');
    expect(typeof markdownReport).toBe('string');
    expect(markdownReport).toContain('# Architecture Compliance Report');
    expect(markdownReport).toContain('Compliance Score');
  });

  it('should provide system status', () => {
    const status = scanner.getStatus();
    
    expect(status.ready).toBe(true);
    expect(typeof status.totalViolations).toBe('number');
    expect(typeof status.criticalViolations).toBe('number');
    expect(status.lastScanTime).toBeInstanceOf(Date);
  });
});