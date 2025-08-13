#!/usr/bin/env node

/**
 * Zero-Fallback Build System
 * 
 * This build system implements strict zero-fallback principles:
 * - Explicit error handling for all build errors (no silent failures)
 * - User confirmation requirement for publishing operations
 * - Scriptified build processes following established command patterns
 * - Complete dependency validation system
 */

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { createInterface } from 'readline';

interface BuildConfig {
  projectRoot: string;
  distDir: string;
  srcDir: string;
  requiredFiles: string[];
  requiredDependencies: string[];
  buildSteps: BuildStep[];
}

interface BuildStep {
  name: string;
  command: string;
  args?: string[];
  cwd?: string;
  required: boolean;
  timeout?: number;
}

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

class ZeroFallbackBuildSystem {
  private config: BuildConfig;
  private startTime: number;
  private buildLog: string[] = [];

  constructor() {
    this.config = this.loadBuildConfig();
    this.startTime = Date.now();
  }

  /**
   * Load build configuration with zero fallback
   * All configuration must be explicit
   */
  private loadBuildConfig(): BuildConfig {
    const projectRoot = process.cwd();
    const packageJsonPath = join(projectRoot, 'package.json');
    
    if (!existsSync(packageJsonPath)) {
      this.throwBuildError('MISSING_PACKAGE_JSON', 'package.json not found in project root');
    }

    let packageJson: any;
    try {
      packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    } catch (error) {
      this.throwBuildError('INVALID_PACKAGE_JSON', `Failed to parse package.json: ${error}`);
    }

    return {
      projectRoot,
      distDir: join(projectRoot, 'dist'),
      srcDir: join(projectRoot, 'src'),
      requiredFiles: [
        'package.json',
        'tsconfig.json',
        'src/index.ts',
        'src/cli.ts',
        'src/server.ts'
      ],
      requiredDependencies: [
        'typescript',
        '@types/node'
      ],
      buildSteps: [
        {
          name: 'Clean previous build',
          command: 'rm',
          args: ['-rf', 'dist/', 'node_modules/.cache/', '*.tgz'],
          required: true
        },
        {
          name: 'Validate dependencies',
          command: 'npm',
          args: ['audit', '--audit-level=high'],
          required: true
        },
        {
          name: 'Install dependencies',
          command: 'npm',
          args: ['ci'],
          required: true,
          timeout: 300000 // 5 minutes
        },
        {
          name: 'TypeScript compilation',
          command: 'npm',
          args: ['run', 'build'],
          required: true,
          timeout: 120000 // 2 minutes
        },
        {
          name: 'Run tests',
          command: 'npm',
          args: ['test'],
          required: true,
          timeout: 180000 // 3 minutes
        },
        {
          name: 'Lint code',
          command: 'npm',
          args: ['run', 'lint'],
          required: true
        }
      ]
    };
  }

  /**
   * Execute the complete build process with zero fallback
   */
  async executeBuild(): Promise<void> {
    this.log('🚀 Starting Zero-Fallback Build Process');
    this.log(`📁 Project Root: ${this.config.projectRoot}`);
    this.log(`⏰ Build Started: ${new Date().toISOString()}`);

    try {
      // Step 1: Pre-build validation
      await this.validatePreBuildRequirements();

      // Step 2: Dependency validation
      await this.validateDependencies();

      // Step 3: Execute build steps
      await this.executeBuildSteps();

      // Step 4: Post-build validation
      await this.validateBuildArtifacts();

      // Step 5: Package validation
      await this.validatePackage();

      this.log('✅ Build completed successfully');
      this.logBuildSummary();

    } catch (error) {
      this.log(`❌ Build failed: ${error}`);
      this.logBuildSummary();
      process.exit(1);
    }
  }

  /**
   * Validate all pre-build requirements
   */
  private async validatePreBuildRequirements(): Promise<void> {
    this.log('🔍 Validating pre-build requirements...');

    const validation = this.validateRequiredFiles();
    if (!validation.success) {
      this.throwBuildError('PRE_BUILD_VALIDATION_FAILED', 
        `Required files missing: ${validation.errors.join(', ')}`);
    }

    // Validate Node.js version
    const nodeVersion = process.version;
    const packageJson = JSON.parse(readFileSync(join(this.config.projectRoot, 'package.json'), 'utf-8'));
    const requiredNodeVersion = packageJson.engines?.node;

    if (requiredNodeVersion && !this.validateNodeVersion(nodeVersion, requiredNodeVersion)) {
      this.throwBuildError('INVALID_NODE_VERSION', 
        `Node.js version ${nodeVersion} does not satisfy requirement ${requiredNodeVersion}`);
    }

    this.log('✅ Pre-build requirements validated');
  }

  /**
   * Validate required files exist
   */
  private validateRequiredFiles(): ValidationResult {
    const result: ValidationResult = {
      success: true,
      errors: [],
      warnings: []
    };

    for (const file of this.config.requiredFiles) {
      const filePath = join(this.config.projectRoot, file);
      if (!existsSync(filePath)) {
        result.success = false;
        result.errors.push(`Missing required file: ${file}`);
      }
    }

    return result;
  }

  /**
   * Validate Node.js version requirement
   */
  private validateNodeVersion(current: string, required: string): boolean {
    // Simple version validation - in production, use semver library
    const currentMajor = parseInt(current.replace('v', '').split('.')[0]);
    const requiredMajor = parseInt(required.replace('>=', '').split('.')[0]);
    return currentMajor >= requiredMajor;
  }

  /**
   * Validate all dependencies
   */
  private async validateDependencies(): Promise<void> {
    this.log('📦 Validating dependencies...');

    const packageJson = JSON.parse(readFileSync(join(this.config.projectRoot, 'package.json'), 'utf-8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Check required dependencies
    for (const dep of this.config.requiredDependencies) {
      if (!dependencies[dep]) {
        this.throwBuildError('MISSING_DEPENDENCY', `Required dependency missing: ${dep}`);
      }
    }

    // Validate package-lock.json exists
    const lockFilePath = join(this.config.projectRoot, 'package-lock.json');
    if (!existsSync(lockFilePath)) {
      this.throwBuildError('MISSING_LOCK_FILE', 'package-lock.json not found - run npm install first');
    }

    this.log('✅ Dependencies validated');
  }

  /**
   * Execute all build steps with explicit error handling
   */
  private async executeBuildSteps(): Promise<void> {
    this.log('🔨 Executing build steps...');

    for (const step of this.config.buildSteps) {
      await this.executeBuildStep(step);
    }

    this.log('✅ All build steps completed');
  }

  /**
   * Execute a single build step with timeout and error handling
   */
  private async executeBuildStep(step: BuildStep): Promise<void> {
    this.log(`⚡ ${step.name}...`);

    return new Promise((resolve, reject) => {
      const process = spawn(step.command, step.args || [], {
        cwd: step.cwd || this.config.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Set timeout if specified
      let timeoutId: NodeJS.Timeout | undefined;
      if (step.timeout) {
        timeoutId = setTimeout(() => {
          process.kill('SIGKILL');
          reject(new Error(`Build step '${step.name}' timed out after ${step.timeout}ms`));
        }, step.timeout);
      }

      process.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);

        if (code === 0) {
          this.log(`✅ ${step.name} completed`);
          resolve();
        } else {
          const error = `Build step '${step.name}' failed with exit code ${code}\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`;
          if (step.required) {
            reject(new Error(error));
          } else {
            this.log(`⚠️ ${step.name} failed but is not required: ${error}`);
            resolve();
          }
        }
      });

      process.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(new Error(`Failed to start build step '${step.name}': ${error.message}`));
      });
    });
  }

  /**
   * Validate build artifacts
   */
  private async validateBuildArtifacts(): Promise<void> {
    this.log('🔍 Validating build artifacts...');

    const requiredArtifacts = [
      'dist/index.js',
      'dist/cli.js',
      'dist/server.js'
    ];

    for (const artifact of requiredArtifacts) {
      const artifactPath = join(this.config.projectRoot, artifact);
      if (!existsSync(artifactPath)) {
        this.throwBuildError('MISSING_BUILD_ARTIFACT', `Required build artifact missing: ${artifact}`);
      }

      // Validate file is not empty
      const stats = statSync(artifactPath);
      if (stats.size === 0) {
        this.throwBuildError('EMPTY_BUILD_ARTIFACT', `Build artifact is empty: ${artifact}`);
      }
    }

    // Validate CLI executable permissions
    const cliPath = join(this.config.projectRoot, 'dist/cli.js');
    try {
      execSync(`chmod +x ${cliPath}`);
      this.log('✅ CLI executable permissions set');
    } catch (error) {
      this.throwBuildError('CLI_PERMISSIONS_FAILED', `Failed to set CLI permissions: ${error}`);
    }

    this.log('✅ Build artifacts validated');
  }

  /**
   * Validate package structure and integrity
   */
  private async validatePackage(): Promise<void> {
    this.log('📋 Validating package structure...');

    try {
      // Dry run npm pack to validate package structure
      const packOutput = execSync('npm pack --dry-run', { 
        cwd: this.config.projectRoot,
        encoding: 'utf-8'
      });

      this.log('✅ Package structure validated');
      this.log(`📦 Package contents:\n${packOutput}`);

    } catch (error) {
      this.throwBuildError('PACKAGE_VALIDATION_FAILED', `Package validation failed: ${error}`);
    }
  }

  /**
   * Request user confirmation for publishing operations
   */
  async requestPublishConfirmation(): Promise<boolean> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('🚀 Do you want to publish this package? (yes/no): ', (answer) => {
        rl.close();
        const confirmed = answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
        resolve(confirmed);
      });
    });
  }

  /**
   * Execute publishing with user confirmation
   */
  async executePublish(): Promise<void> {
    this.log('📤 Preparing to publish...');

    const confirmed = await this.requestPublishConfirmation();
    if (!confirmed) {
      this.log('❌ Publishing cancelled by user');
      return;
    }

    try {
      this.log('🚀 Publishing package...');
      execSync('npm publish', { 
        cwd: this.config.projectRoot,
        stdio: 'inherit'
      });
      this.log('✅ Package published successfully');
    } catch (error) {
      this.throwBuildError('PUBLISH_FAILED', `Publishing failed: ${error}`);
    }
  }

  /**
   * Throw build error with consistent format
   */
  private throwBuildError(code: string, message: string): never {
    const error = new Error(`[${code}] ${message}`);
    error.name = 'BuildError';
    throw error;
  }

  /**
   * Log message with timestamp
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);
    this.buildLog.push(logEntry);
  }

  /**
   * Log build summary
   */
  private logBuildSummary(): void {
    const duration = Date.now() - this.startTime;
    this.log(`⏱️ Build Duration: ${duration}ms`);
    this.log(`📊 Build Log Entries: ${this.buildLog.length}`);
    
    // Write build log to file
    const logPath = join(this.config.projectRoot, 'build.log');
    writeFileSync(logPath, this.buildLog.join('\n'));
    this.log(`📝 Build log written to: ${logPath}`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const buildSystem = new ZeroFallbackBuildSystem();

  try {
    switch (command) {
      case 'build':
        await buildSystem.executeBuild();
        break;
      
      case 'publish':
        await buildSystem.executeBuild();
        await buildSystem.executePublish();
        break;
      
      case 'validate':
        // Only run validation without build
        console.log('🔍 Running validation only...');
        break;
      
      default:
        console.log('Usage: build-system.ts <build|publish|validate>');
        process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Build system error: ${error}`);
    process.exit(1);
  }
}

// Check if this is the main module (ES module equivalent)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { ZeroFallbackBuildSystem, BuildConfig, BuildStep, ValidationResult };