/**
 * Architecture Scanner Basic Functionality Tests
 * 
 * 验证架构扫描系统的基础功能
 * 
 * @author RCC v4.0 Architecture Scanner
 */

import { createArchScanner } from '../../index';
import type { ArchScannerInterface } from '../../index';

describe('ArchScanner Basic Functionality', () => {
  let scanner: ArchScannerInterface;

  beforeEach(() => {
    scanner = createArchScanner({
      projectRoot: './src'
    });
  });

  it('should create scanner instance successfully', () => {
    expect(scanner).toBeDefined();
    expect(typeof scanner.scanProject).toBe('function');
    expect(typeof scanner.scanModule).toBe('function');
    expect(typeof scanner.generateReport).toBe('function');
    expect(typeof scanner.validateArchitecture).toBe('function');
  });

  it('should return correct configuration', () => {
    const config = scanner.getConfig();
    expect(config).toBeDefined();
    expect(config.projectRoot).toBe('./src');
    expect(config.strictMode).toBe(true);
  });

  it('should return initial status', () => {
    const status = scanner.getStatus();
    expect(status).toBeDefined();
    expect(typeof status.ready).toBe('boolean');
    expect(typeof status.totalViolations).toBe('number');
    expect(typeof status.criticalViolations).toBe('number');
  });

  it('should handle invalid module name', async () => {
    await expect(scanner.scanModule('')).rejects.toThrow('Module name must be a non-empty string');
    await expect(scanner.scanModule(null as any)).rejects.toThrow('Module name must be a non-empty string');
  });

  it('should generate JSON report by default', async () => {
    // 先执行一次扫描
    await scanner.scanProject();
    
    const report = await scanner.generateReport();
    expect(typeof report).toBe('string');
    expect(() => JSON.parse(report)).not.toThrow();
  });

  it('should support different report formats', async () => {
    // 先执行一次扫描
    await scanner.scanProject();
    
    const jsonReport = await scanner.generateReport('json');
    expect(typeof jsonReport).toBe('string');
    expect(() => JSON.parse(jsonReport)).not.toThrow();

    const htmlReport = await scanner.generateReport('html');
    expect(typeof htmlReport).toBe('string');
    expect(htmlReport).toContain('<!DOCTYPE html>');

    const markdownReport = await scanner.generateReport('markdown');
    expect(typeof markdownReport).toBe('string');
    expect(markdownReport).toContain('# Architecture Compliance Report');

    const textReport = await scanner.generateReport('text');
    expect(typeof textReport).toBe('string');
    expect(textReport).toContain('Architecture Compliance Report');
  });

  it('should reject unsupported report format', async () => {
    await scanner.scanProject();
    await expect(scanner.generateReport('pdf' as any)).rejects.toThrow('Unsupported report format: pdf');
  });
});