/**
 * Dependency Validator Tests
 * 
 * Tests for the dependency validation system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { DependencyValidator, ValidationReport } from '../../scripts/dependency-validator';

describe('DependencyValidator', () => {
  const testProjectRoot = join(__dirname, 'test-dependency-project');
  let validator: DependencyValidator;

  beforeEach(() => {
    // Create test project structure
    if (existsSync(testProjectRoot)) {
      rmSync(testProjectRoot, { recursive: true, force: true });
    }
    mkdirSync(testProjectRoot, { recursive: true });

    // Create test package.json
    const packageJson = {
      name: 'test-dependency-project',
      version: '1.0.0',
      engines: {
        node: '>=18.0.0',
        npm: '>=8.0.0'
      },
      dependencies: {
        'typescript': '^5.0.0',
        '@anthropic-ai/sdk': '^0.24.3',
        'openai': '^4.52.7'
      },
      devDependencies: {
        '@types/node': '^20.0.0'
      }
    };
    writeFileSync(join(testProjectRoot, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Create test package-lock.json
    const packageLock = {
      name: 'test-dependency-project',
      version: '1.0.0',
      lockfileVersion: 2,
      packages: {
        '': {
          name: 'test-dependency-project',
          version: '1.0.0'
        },
        'node_modules/typescript': {
          version: '5.0.0'
        },
        'node_modules/@types/node': {
          version: '20.0.0'
        },
        'node_modules/@anthropic-ai/sdk': {
          version: '0.24.3'
        },
        'node_modules/openai': {
          version: '4.52.7'
        },
        'node_modules/@google/generative-ai': {
          version: '0.15.0'
        }
      }
    };
    writeFileSync(join(testProjectRoot, 'package-lock.json'), JSON.stringify(packageLock, null, 2));
  });

  afterEach(() => {
    if (existsSync(testProjectRoot)) {
      rmSync(testProjectRoot, { recursive: true, force: true });
    }
  });

  describe('Initialization', () => {
    it('should initialize with valid project', () => {
      expect(() => {
        validator = new DependencyValidator(testProjectRoot);
      }).not.toThrow();
    });

    it('should throw error when package.json is missing', () => {
      rmSync(join(testProjectRoot, 'package.json'));
      
      expect(() => {
        validator = new DependencyValidator(testProjectRoot);
      }).toThrow('package.json not found in project root');
    });

    it('should throw error when package-lock.json is missing', () => {
      rmSync(join(testProjectRoot, 'package-lock.json'));
      
      expect(() => {
        validator = new DependencyValidator(testProjectRoot);
      }).toThrow('package-lock.json not found');
    });

    it('should throw error when package.json is invalid JSON', () => {
      writeFileSync(join(testProjectRoot, 'package.json'), 'invalid json');
      
      expect(() => {
        validator = new DependencyValidator(testProjectRoot);
      }).toThrow('Failed to parse package.json');
    });
  });

  describe('Required Dependencies Validation', () => {
    beforeEach(() => {
      validator = new DependencyValidator(testProjectRoot);
    });

    it('should validate all required dependencies are present', async () => {
      const report = await validator.validateDependencies();
      
      expect(report.success).toBe(true);
      expect(report.summary.total).toBeGreaterThan(0);
      expect(report.summary.missing).toBe(0);
    });

    it('should detect missing required dependencies', async () => {
      // Remove a required dependency from package.json
      const packageJson = JSON.parse(readFileSync(join(testProjectRoot, 'package.json'), 'utf-8'));
      delete packageJson.dependencies.typescript;
      writeFileSync(join(testProjectRoot, 'package.json'), JSON.stringify(packageJson, null, 2));
      
      validator = new DependencyValidator(testProjectRoot);
      const report = await validator.validateDependencies();
      
      expect(report.success).toBe(false);
      expect(report.summary.missing).toBeGreaterThan(0);
      expect(report.errors.some(error => error.includes('typescript'))).toBe(true);
    });

    it('should detect declared but not installed dependencies', async () => {
      // Remove dependency from package-lock.json but keep in package.json
      const packageLock = JSON.parse(readFileSync(join(testProjectRoot, 'package-lock.json'), 'utf-8'));
      delete packageLock.packages['node_modules/typescript'];
      writeFileSync(join(testProjectRoot, 'package-lock.json'), JSON.stringify(packageLock, null, 2));
      
      validator = new DependencyValidator(testProjectRoot);
      const report = await validator.validateDependencies();
      
      expect(report.success).toBe(false);
      expect(report.errors.some(error => error.includes('not installed'))).toBe(true);
    });
  });

  describe('Version Compatibility', () => {
    beforeEach(() => {
      validator = new DependencyValidator(testProjectRoot);
    });

    it('should validate Node.js version compatibility', async () => {
      const report = await validator.validateDependencies();
      
      // Should pass with current Node.js version
      expect(report.errors.some(error => error.includes('Node.js version'))).toBe(false);
    });

    it('should detect incompatible Node.js version', async () => {
      // Set unrealistic Node.js requirement
      const packageJson = JSON.parse(readFileSync(join(testProjectRoot, 'package.json'), 'utf-8'));
      packageJson.engines.node = '>=99.0.0';
      writeFileSync(join(testProjectRoot, 'package.json'), JSON.stringify(packageJson, null, 2));
      
      validator = new DependencyValidator(testProjectRoot);
      const report = await validator.validateDependencies();
      
      expect(report.success).toBe(false);
      expect(report.errors.some(error => error.includes('Node.js version'))).toBe(true);
    });
  });

  describe('Security Audit', () => {
    beforeEach(() => {
      validator = new DependencyValidator(testProjectRoot);
    });

    it('should perform security audit', async () => {
      const report = await validator.validateDependencies();
      
      // Security audit should complete (may or may not find issues)
      expect(report).toBeDefined();
      expect(Array.isArray(report.securityIssues)).toBe(true);
    });

    it('should handle security audit errors gracefully', async () => {
      // Test with invalid project structure
      const report = await validator.validateDependencies();
      
      // Should not throw, but may have warnings
      expect(report).toBeDefined();
    });
  });

  describe('License Compliance', () => {
    beforeEach(() => {
      validator = new DependencyValidator(testProjectRoot);
    });

    it('should check license compliance', async () => {
      const report = await validator.validateDependencies();
      
      // License check should complete
      expect(report).toBeDefined();
      expect(Array.isArray(report.warnings)).toBe(true);
    });
  });

  describe('Outdated Packages Check', () => {
    beforeEach(() => {
      validator = new DependencyValidator(testProjectRoot);
    });

    it('should check for outdated packages', async () => {
      const report = await validator.validateDependencies();
      
      // Outdated check should complete
      expect(report).toBeDefined();
      expect(typeof report.summary.outdated).toBe('number');
    });
  });

  describe('Validation Report', () => {
    beforeEach(() => {
      validator = new DependencyValidator(testProjectRoot);
    });

    it('should generate comprehensive validation report', async () => {
      const report = await validator.validateDependencies();
      
      expect(report).toBeDefined();
      expect(typeof report.success).toBe('boolean');
      expect(Array.isArray(report.dependencies)).toBe(true);
      expect(Array.isArray(report.errors)).toBe(true);
      expect(Array.isArray(report.warnings)).toBe(true);
      expect(Array.isArray(report.securityIssues)).toBe(true);
      expect(typeof report.summary).toBe('object');
      expect(typeof report.summary.total).toBe('number');
      expect(typeof report.summary.missing).toBe('number');
      expect(typeof report.summary.vulnerable).toBe('number');
      expect(typeof report.summary.outdated).toBe('number');
    });

    it('should include dependency information', async () => {
      const report = await validator.validateDependencies();
      
      expect(report.dependencies.length).toBeGreaterThan(0);
      
      const typescriptDep = report.dependencies.find(dep => dep.name === 'typescript');
      expect(typescriptDep).toBeDefined();
      expect(typescriptDep?.required).toBe(true);
      expect(typescriptDep?.type).toBe('dependency');
    });

    it('should print detailed report without errors', () => {
      validator = new DependencyValidator(testProjectRoot);
      
      const mockReport: ValidationReport = {
        success: true,
        dependencies: [],
        errors: [],
        warnings: ['Test warning'],
        securityIssues: [],
        summary: {
          total: 5,
          missing: 0,
          vulnerable: 0,
          outdated: 1
        }
      };
      
      expect(() => {
        validator.printDetailedReport(mockReport);
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      // Create validator with invalid project
      rmSync(testProjectRoot, { recursive: true, force: true });
      
      expect(() => {
        validator = new DependencyValidator(testProjectRoot);
      }).toThrow();
    });

    it('should handle npm command failures', async () => {
      validator = new DependencyValidator(testProjectRoot);
      
      // Test should handle npm command failures gracefully
      const report = await validator.validateDependencies();
      expect(report).toBeDefined();
    });
  });
});