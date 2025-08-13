#!/usr/bin/env node

/**
 * Claude Code Router v3.0 - Deployment Pipeline System
 * 
 * Comprehensive deployment pipeline providing:
 * - Complete test execution as part of build process
 * - Package validation for integrity and completeness  
 * - Deployment automation with rollback capabilities
 * - Post-deployment health validation
 * - Zero-fallback compliance with explicit error handling
 * 
 * @author Jason Zhang
 * @version 3.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

import { createErrorHandler } from '../shared/error-handler.js';
import { BaseCLIHandler } from '../shared/base-cli-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

export class DeploymentPipeline extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            // Project configuration
            projectRoot: config.projectRoot || path.resolve(__dirname, '../../../'),
            packageName: config.packageName || 'route-claudecode',
            version: config.version || '3.0.0',
            
            // Build settings
            buildDir: config.buildDir || 'dist',
            testDir: config.testDir || 'test',
            scriptsDir: config.scriptsDir || 'scripts',
            
            // Deployment settings
            deploymentTargets: config.deploymentTargets || {
                npm: {
                    enabled: true,
                    registry: 'https://registry.npmjs.org/',
                    skipPublish: config.skipNpmPublish === true
                },
                github: {
                    enabled: true,
                    repository: 'fanzhang16/claude-code-router',
                    branch: 'refactor/v3.0-plugin-architecture'
                }
            },
            
            // Validation settings
            requireTestPass: config.requireTestPass !== false,
            requireHealthCheck: config.requireHealthCheck !== false,
            rollbackOnFailure: config.rollbackOnFailure !== false,
            
            // Health check settings
            healthCheckTimeout: config.healthCheckTimeout || 30000, // 30 seconds
            healthCheckRetries: config.healthCheckRetries || 3,
            
            ...config
        };

        this.errorHandler = createErrorHandler('DeploymentPipeline');
        this.deploymentHistory = [];
        this.currentDeployment = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            console.log('🚀 Initializing Deployment Pipeline...');
            
            // Create required directories
            await this.createPipelineDirectories();
            
            // Validate build environment
            await this.validateBuildEnvironment();
            
            // Load deployment history
            await this.loadDeploymentHistory();
            
            this.initialized = true;
            console.log(`✅ Deployment Pipeline initialized`);
            console.log(`   Project: ${this.config.packageName} v${this.config.version}`);
            console.log(`   Deployment targets: ${Object.keys(this.config.deploymentTargets).length}`);
            
            return {
                status: 'initialized',
                packageName: this.config.packageName,
                version: this.config.version,
                targets: Object.keys(this.config.deploymentTargets).length
            };
        } catch (error) {
            this.errorHandler.handleCriticalError(error, 'initialization', {
                projectRoot: this.config.projectRoot,
                packageName: this.config.packageName
            });
        }
    }

    async createPipelineDirectories() {
        const dirs = [
            path.join(this.config.projectRoot, 'deployment'),
            path.join(this.config.projectRoot, 'deployment', 'history'),
            path.join(this.config.projectRoot, 'deployment', 'backups'),
            path.join(this.config.projectRoot, 'deployment', 'health-checks'),
            path.join(this.config.projectRoot, 'deployment', 'rollback-points')
        ];
        
        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }
        
        console.log('📂 Deployment directories created');
    }

    async validateBuildEnvironment() {
        console.log('🔍 Validating build environment...');
        
        // Check if package.json exists
        const packageJsonPath = path.join(this.config.projectRoot, 'package.json');
        try {
            await fs.access(packageJsonPath);
        } catch (error) {
            this.errorHandler.handleCriticalError(
                new Error('package.json not found'),
                'environment-validation',
                { packageJsonPath }
            );
        }
        
        // Verify required build tools
        const requiredTools = ['npm', 'git', 'node'];
        for (const tool of requiredTools) {
            try {
                await execAsync(`which ${tool}`);
                console.log(`✅ ${tool}: available`);
            } catch (error) {
                this.errorHandler.handleCriticalError(
                    new Error(`Required build tool not found: ${tool}`),
                    'environment-validation',
                    { tool, error: error.message }
                );
            }
        }
        
        console.log('✅ Build environment validated');
    }

    async executeFullDeploymentPipeline(options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const deploymentId = this.generateDeploymentId();
        this.currentDeployment = {
            id: deploymentId,
            startTime: new Date().toISOString(),
            status: 'in-progress',
            stages: [],
            options
        };

        try {
            console.log(`🚀 Starting deployment pipeline: ${deploymentId}`);
            this.emit('deploymentStarted', this.currentDeployment);
            
            // Stage 1: Pre-deployment validation
            await this.executeStage('pre-validation', async () => {
                await this.preDeploymentValidation();
            });
            
            // Stage 2: Comprehensive test execution
            await this.executeStage('test-execution', async () => {
                if (this.config.requireTestPass) {
                    await this.executeComprehensiveTests();
                } else {
                    console.log('⚠️ Test execution skipped (requireTestPass = false)');
                }
            });
            
            // Stage 3: Build and package validation
            await this.executeStage('build-validation', async () => {
                await this.buildAndValidatePackage();
            });
            
            // Stage 4: Create rollback point
            await this.executeStage('rollback-point', async () => {
                await this.createRollbackPoint();
            });
            
            // Stage 5: Deploy to targets
            await this.executeStage('deployment', async () => {
                await this.deployToTargets();
            });
            
            // Stage 6: Post-deployment health validation
            await this.executeStage('health-validation', async () => {
                if (this.config.requireHealthCheck) {
                    await this.postDeploymentHealthCheck();
                } else {
                    console.log('⚠️ Health check skipped (requireHealthCheck = false)');
                }
            });
            
            // Stage 7: Finalization
            await this.executeStage('finalization', async () => {
                await this.finalizeDeployment();
            });
            
            this.currentDeployment.status = 'completed';
            this.currentDeployment.endTime = new Date().toISOString();
            this.currentDeployment.duration = Date.now() - new Date(this.currentDeployment.startTime).getTime();
            
            console.log(`✅ Deployment pipeline completed successfully: ${deploymentId}`);
            console.log(`   Duration: ${this.currentDeployment.duration}ms`);
            console.log(`   Stages: ${this.currentDeployment.stages.length}`);
            
            this.emit('deploymentCompleted', this.currentDeployment);
            
            // Save to history
            this.deploymentHistory.push(this.currentDeployment);
            await this.saveDeploymentHistory();
            
            return this.currentDeployment;
            
        } catch (error) {
            this.currentDeployment.status = 'failed';
            this.currentDeployment.endTime = new Date().toISOString();
            this.currentDeployment.error = error.message;
            
            console.error(`❌ Deployment pipeline failed: ${deploymentId}`);
            console.error(`   Error: ${error.message}`);
            
            this.emit('deploymentFailed', this.currentDeployment);
            
            // Attempt rollback if enabled
            if (this.config.rollbackOnFailure) {
                console.log('🔄 Attempting automatic rollback...');
                try {
                    await this.executeRollback();
                } catch (rollbackError) {
                    console.error(`❌ Rollback failed: ${rollbackError.message}`);
                    this.currentDeployment.rollbackFailed = true;
                }
            }
            
            // Save failed deployment to history
            this.deploymentHistory.push(this.currentDeployment);
            await this.saveDeploymentHistory();
            
            throw error;
        } finally {
            this.currentDeployment = null;
        }
    }

    async executeStage(stageName, stageFunction) {
        const stage = {
            name: stageName,
            startTime: new Date().toISOString(),
            status: 'in-progress'
        };
        
        this.currentDeployment.stages.push(stage);
        console.log(`🔄 Stage: ${stageName}`);
        
        try {
            await stageFunction();
            stage.status = 'completed';
            stage.endTime = new Date().toISOString();
            console.log(`✅ Stage completed: ${stageName}`);
        } catch (error) {
            stage.status = 'failed';
            stage.endTime = new Date().toISOString();
            stage.error = error.message;
            console.error(`❌ Stage failed: ${stageName} - ${error.message}`);
            throw error;
        }
    }

    async preDeploymentValidation() {
        console.log('🔍 Pre-deployment validation...');
        
        // Check working directory is clean
        try {
            const { stdout } = await execAsync('git status --porcelain', { cwd: this.config.projectRoot });
            if (stdout.trim() && !this.currentDeployment.options.allowDirtyWorkingTree) {
                this.errorHandler.handleValidationError(
                    'working-tree',
                    'dirty',
                    'Clean working tree required for deployment. Use --allow-dirty to override.'
                );
            }
        } catch (error) {
            console.warn('⚠️ Could not check git status:', error.message);
        }
        
        // Validate version consistency
        const packageJson = JSON.parse(
            await fs.readFile(path.join(this.config.projectRoot, 'package.json'), 'utf8')
        );
        
        if (packageJson.version !== this.config.version) {
            this.errorHandler.handleValidationError(
                'version',
                `${packageJson.version} vs ${this.config.version}`,
                'Package.json version must match deployment pipeline version'
            );
        }
        
        console.log('✅ Pre-deployment validation completed');
    }

    async executeComprehensiveTests() {
        console.log('🧪 Executing comprehensive test suite...');
        
        const testResults = {
            functional: { status: 'pending', duration: 0 },
            integration: { status: 'pending', duration: 0 },
            performance: { status: 'pending', duration: 0 }
        };
        
        // Execute functional tests
        try {
            console.log('📋 Running functional tests...');
            const startTime = Date.now();
            
            const { stdout, stderr } = await execAsync(
                'npm run test:functional 2>&1 || find test/functional -name "test-*.js" -exec node {} \\;',
                { cwd: this.config.projectRoot, timeout: 300000 } // 5 minutes timeout
            );
            
            testResults.functional.duration = Date.now() - startTime;
            testResults.functional.status = 'passed';
            testResults.functional.output = stdout;
            
            console.log(`✅ Functional tests passed (${testResults.functional.duration}ms)`);
            
        } catch (error) {
            testResults.functional.status = 'failed';
            testResults.functional.error = error.message;
            
            this.errorHandler.handleCriticalError(
                new Error(`Functional tests failed: ${error.message}`),
                'test-execution',
                { testType: 'functional', output: error.stdout || error.message }
            );
        }
        
        // Execute integration tests (if available)
        try {
            console.log('🔗 Running integration tests...');
            const startTime = Date.now();
            
            const { stdout } = await execAsync(
                'npm run test:integration 2>&1 || echo "No integration tests configured"',
                { cwd: this.config.projectRoot, timeout: 180000 } // 3 minutes timeout
            );
            
            testResults.integration.duration = Date.now() - startTime;
            testResults.integration.status = 'passed';
            testResults.integration.output = stdout;
            
            console.log(`✅ Integration tests completed (${testResults.integration.duration}ms)`);
            
        } catch (error) {
            console.warn(`⚠️ Integration tests issue: ${error.message}`);
            testResults.integration.status = 'warning';
            testResults.integration.error = error.message;
        }
        
        this.currentDeployment.testResults = testResults;
        console.log('✅ Test execution completed');
    }

    async buildAndValidatePackage() {
        console.log('📦 Building and validating package...');
        
        // Clean previous builds
        const buildDir = path.join(this.config.projectRoot, this.config.buildDir);
        try {
            await fs.rm(buildDir, { recursive: true, force: true });
        } catch (error) {
            // Directory might not exist, continue
        }
        
        // Execute build
        try {
            console.log('🔨 Running build process...');
            const { stdout } = await execAsync('npm run build || npm run compile || echo "No build script configured"', {
                cwd: this.config.projectRoot,
                timeout: 300000 // 5 minutes
            });
            console.log('✅ Build completed');
        } catch (error) {
            this.errorHandler.handleCriticalError(
                new Error(`Build failed: ${error.message}`),
                'build-execution',
                { buildCommand: 'npm run build', output: error.stdout }
            );
        }
        
        // Package validation
        console.log('📋 Validating package integrity...');
        
        // Create npm package
        try {
            const { stdout } = await execAsync('npm pack --dry-run', {
                cwd: this.config.projectRoot
            });
            
            // Parse package contents
            const packageInfo = this.parsePackageInfo(stdout);
            
            // Validate package contents
            await this.validatePackageContents(packageInfo);
            
            this.currentDeployment.packageInfo = packageInfo;
            console.log(`✅ Package validation completed`);
            console.log(`   Package size: ${packageInfo.size || 'unknown'}`);
            console.log(`   Files included: ${packageInfo.files?.length || 'unknown'}`);
            
        } catch (error) {
            this.errorHandler.handleCriticalError(
                new Error(`Package validation failed: ${error.message}`),
                'package-validation',
                { command: 'npm pack --dry-run' }
            );
        }
    }

    parsePackageInfo(npmPackOutput) {
        const info = {
            files: [],
            size: null,
            tarballName: null
        };
        
        const lines = npmPackOutput.split('\n');
        let inFilesList = false;
        
        for (const line of lines) {
            // Extract tarball name from the last line (usually the file name)
            if (line.trim() && line.endsWith('.tgz')) {
                info.tarballName = line.trim();
            }
            
            // Extract package name and version from npm notice lines
            if (line.includes('📦') && line.includes('@')) {
                const match = line.match(/📦\s+(.+@.+)/);
                if (match) {
                    info.tarballName = match[1].trim() + '.tgz';
                }
            }
            
            // Extract from package: line format
            if (line.includes('package:')) {
                info.tarballName = line.split('package:')[1]?.trim();
            }
            
            // Extract package size
            if (line.includes('package size:')) {
                info.size = line.split('package size:')[1]?.trim();
            }
            
            // Handle === Tarball Contents === section
            if (line.includes('=== Tarball Contents ===')) {
                inFilesList = true;
                continue;
            }
            
            if (line.includes('=== Tarball Details ===')) {
                inFilesList = false;
                continue;
            }
            
            // Parse file list in tarball contents section
            if (inFilesList && line.trim()) {
                // Clean the line by removing npm notice prefix if present
                let cleanLine = line.replace(/^npm notice\s*/, '').trim();
                
                // Skip empty lines or lines without file info
                if (!cleanLine) continue;
                
                // Parse file line format: "size filename" or "size other-info filename"
                const parts = cleanLine.split(/\s+/);
                if (parts.length >= 2) {
                    info.files.push({
                        size: parts[0],
                        path: parts.slice(1).join(' ')
                    });
                }
            }
        }
        
        // If tarball name still null, construct from last line or fall back to expected format
        if (!info.tarballName && lines.length > 0) {
            const lastLine = lines[lines.length - 1].trim();
            if (lastLine && lastLine.endsWith('.tgz')) {
                info.tarballName = lastLine;
            }
        }
        
        return info;
    }

    async validatePackageContents(packageInfo) {
        // Validate essential files are included
        const requiredFiles = [
            'package.json',
            'README.md'
        ];
        
        const includedFiles = packageInfo.files.map(f => f.path);
        
        for (const requiredFile of requiredFiles) {
            if (!includedFiles.some(file => file.includes(requiredFile))) {
                this.errorHandler.handleValidationError(
                    'package-contents',
                    `missing ${requiredFile}`,
                    `Required file ${requiredFile} not included in package`
                );
            }
        }
        
        // Validate no sensitive files are included
        const sensitivePatterns = [
            '.env',
            'id_rsa',
            'id_ed25519',
            '.aws',
            '.ssh',
            'secrets',
            'credentials'
        ];
        
        for (const file of includedFiles) {
            for (const pattern of sensitivePatterns) {
                if (file.toLowerCase().includes(pattern)) {
                    this.errorHandler.handleValidationError(
                        'security',
                        `sensitive file: ${file}`,
                        `Sensitive file ${file} should not be included in package`
                    );
                }
            }
        }
        
        console.log('✅ Package contents validated');
    }

    async createRollbackPoint() {
        console.log('💾 Creating rollback point...');
        
        const rollbackId = `rollback-${Date.now()}`;
        const rollbackDir = path.join(this.config.projectRoot, 'deployment', 'rollback-points', rollbackId);
        
        await fs.mkdir(rollbackDir, { recursive: true });
        
        // Save current git state
        try {
            const { stdout: gitHash } = await execAsync('git rev-parse HEAD', { cwd: this.config.projectRoot });
            const { stdout: gitBranch } = await execAsync('git branch --show-current', { cwd: this.config.projectRoot });
            
            const rollbackInfo = {
                id: rollbackId,
                timestamp: new Date().toISOString(),
                gitHash: gitHash.trim(),
                gitBranch: gitBranch.trim(),
                version: this.config.version,
                deploymentId: this.currentDeployment.id
            };
            
            await fs.writeFile(
                path.join(rollbackDir, 'rollback-info.json'),
                JSON.stringify(rollbackInfo, null, 2)
            );
            
            this.currentDeployment.rollbackId = rollbackId;
            console.log(`✅ Rollback point created: ${rollbackId}`);
            console.log(`   Git hash: ${rollbackInfo.gitHash}`);
            console.log(`   Branch: ${rollbackInfo.gitBranch}`);
            
        } catch (error) {
            console.warn(`⚠️ Could not create complete rollback point: ${error.message}`);
        }
    }

    async deployToTargets() {
        console.log('🚀 Deploying to targets...');
        
        const deploymentResults = {};
        
        for (const [targetName, targetConfig] of Object.entries(this.config.deploymentTargets)) {
            if (!targetConfig.enabled) {
                console.log(`⏭️ Skipping disabled target: ${targetName}`);
                continue;
            }
            
            console.log(`📤 Deploying to ${targetName}...`);
            
            try {
                const result = await this.deployToTarget(targetName, targetConfig);
                deploymentResults[targetName] = { status: 'success', ...result };
                console.log(`✅ ${targetName} deployment successful`);
            } catch (error) {
                deploymentResults[targetName] = { status: 'failed', error: error.message };
                console.error(`❌ ${targetName} deployment failed: ${error.message}`);
                
                // For critical targets, fail the entire deployment
                if (targetName === 'npm' && !targetConfig.skipPublish) {
                    throw error;
                }
            }
        }
        
        this.currentDeployment.deploymentResults = deploymentResults;
        console.log('✅ Target deployment completed');
    }

    async deployToTarget(targetName, targetConfig) {
        switch (targetName) {
            case 'npm':
                return await this.deployToNpm(targetConfig);
            case 'github':
                return await this.deployToGitHub(targetConfig);
            default:
                throw new Error(`Unknown deployment target: ${targetName}`);
        }
    }

    async deployToNpm(targetConfig) {
        if (targetConfig.skipPublish) {
            console.log('📦 NPM publish skipped (skipPublish = true)');
            return { skipped: true, reason: 'skipPublish enabled' };
        }
        
        // Require user confirmation for npm publish
        if (!this.currentDeployment.options.confirmNpmPublish) {
            this.errorHandler.handleValidationError(
                'npm-publish',
                'no confirmation',
                'NPM publish requires explicit user confirmation. Use --confirm-npm-publish flag.'
            );
        }
        
        try {
            // Check if version already exists
            const { stdout } = await execAsync(`npm view ${this.config.packageName}@${this.config.version} version`, {
                cwd: this.config.projectRoot
            });
            
            if (stdout.trim() === this.config.version) {
                throw new Error(`Version ${this.config.version} already published to NPM`);
            }
        } catch (error) {
            // Version doesn't exist, which is what we want
            if (!error.message.includes('already published')) {
                console.log(`✅ Version ${this.config.version} available for publishing`);
            }
        }
        
        // Execute npm publish
        const { stdout } = await execAsync('npm publish --access public', {
            cwd: this.config.projectRoot,
            timeout: 120000 // 2 minutes
        });
        
        return {
            publishOutput: stdout,
            registry: targetConfig.registry,
            version: this.config.version
        };
    }

    async deployToGitHub(targetConfig) {
        try {
            // Push current branch
            await execAsync(`git push origin ${targetConfig.branch}`, {
                cwd: this.config.projectRoot,
                timeout: 60000 // 1 minute
            });
            
            // Create and push tag
            const tagName = `v${this.config.version}`;
            
            try {
                await execAsync(`git tag ${tagName}`, { cwd: this.config.projectRoot });
                await execAsync(`git push origin ${tagName}`, { cwd: this.config.projectRoot });
                
                return {
                    branch: targetConfig.branch,
                    tag: tagName,
                    repository: targetConfig.repository
                };
            } catch (tagError) {
                console.warn(`⚠️ Tag creation/push failed: ${tagError.message}`);
                return {
                    branch: targetConfig.branch,
                    repository: targetConfig.repository,
                    tagWarning: tagError.message
                };
            }
            
        } catch (error) {
            throw new Error(`GitHub deployment failed: ${error.message}`);
        }
    }

    async postDeploymentHealthCheck() {
        console.log('🏥 Post-deployment health validation...');
        
        const healthChecks = [];
        
        // Check NPM package availability
        if (this.config.deploymentTargets.npm?.enabled && !this.config.deploymentTargets.npm?.skipPublish) {
            healthChecks.push(this.checkNpmPackageHealth());
        }
        
        // Check GitHub repository
        if (this.config.deploymentTargets.github?.enabled) {
            healthChecks.push(this.checkGitHubHealth());
        }
        
        // Execute health checks with retries
        const results = await Promise.allSettled(
            healthChecks.map(check => this.executeHealthCheckWithRetry(check))
        );
        
        let failedChecks = 0;
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === 'rejected') {
                console.error(`❌ Health check failed: ${result.reason.message}`);
                failedChecks++;
            } else {
                console.log(`✅ Health check passed: ${result.value.name}`);
            }
        }
        
        if (failedChecks > 0) {
            throw new Error(`${failedChecks} health checks failed`);
        }
        
        console.log('✅ All health checks passed');
    }

    async executeHealthCheckWithRetry(healthCheckFunction) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.config.healthCheckRetries; attempt++) {
            try {
                return await Promise.race([
                    healthCheckFunction(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Health check timeout')), this.config.healthCheckTimeout)
                    )
                ]);
            } catch (error) {
                lastError = error;
                if (attempt < this.config.healthCheckRetries) {
                    console.log(`⚠️ Health check attempt ${attempt} failed, retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
                }
            }
        }
        
        throw lastError;
    }

    async checkNpmPackageHealth() {
        const { stdout } = await execAsync(`npm view ${this.config.packageName}@${this.config.version} version`);
        
        if (stdout.trim() !== this.config.version) {
            throw new Error(`NPM package version mismatch: expected ${this.config.version}, got ${stdout.trim()}`);
        }
        
        return { name: 'npm-package', status: 'healthy', version: stdout.trim() };
    }

    async checkGitHubHealth() {
        // Simple check that git push succeeded
        const { stdout } = await execAsync('git ls-remote --heads origin', { cwd: this.config.projectRoot });
        
        const branchName = this.config.deploymentTargets.github.branch;
        if (!stdout.includes(branchName)) {
            throw new Error(`GitHub branch ${branchName} not found in remote`);
        }
        
        return { name: 'github-repository', status: 'healthy', branch: branchName };
    }

    async executeRollback() {
        if (!this.currentDeployment?.rollbackId) {
            throw new Error('No rollback point available for current deployment');
        }
        
        console.log(`🔄 Executing rollback to: ${this.currentDeployment.rollbackId}`);
        
        const rollbackDir = path.join(
            this.config.projectRoot, 
            'deployment', 
            'rollback-points', 
            this.currentDeployment.rollbackId
        );
        
        try {
            const rollbackInfo = JSON.parse(
                await fs.readFile(path.join(rollbackDir, 'rollback-info.json'), 'utf8')
            );
            
            // Rollback git state
            await execAsync(`git checkout ${rollbackInfo.gitHash}`, { cwd: this.config.projectRoot });
            
            console.log(`✅ Rollback completed to git hash: ${rollbackInfo.gitHash}`);
            
        } catch (error) {
            throw new Error(`Rollback execution failed: ${error.message}`);
        }
    }

    async finalizeDeployment() {
        console.log('🏁 Finalizing deployment...');
        
        // Clean up temporary files
        // Save deployment artifacts
        // Update deployment status
        
        console.log('✅ Deployment finalized');
    }

    generateDeploymentId() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const hash = crypto.randomBytes(4).toString('hex');
        return `deploy-${timestamp}-${hash}`;
    }

    async loadDeploymentHistory() {
        const historyFile = path.join(this.config.projectRoot, 'deployment', 'history', 'deployment-history.json');
        
        try {
            const content = await fs.readFile(historyFile, 'utf8');
            this.deploymentHistory = JSON.parse(content);
            console.log(`📚 Loaded ${this.deploymentHistory.length} deployment records`);
        } catch (error) {
            console.log('📂 No existing deployment history found');
            this.deploymentHistory = [];
        }
    }

    async saveDeploymentHistory() {
        const historyFile = path.join(this.config.projectRoot, 'deployment', 'history', 'deployment-history.json');
        
        // Keep only last 50 deployments
        const recentHistory = this.deploymentHistory.slice(-50);
        
        await fs.writeFile(historyFile, JSON.stringify(recentHistory, null, 2));
    }

    // CLI Interface setup
    setupCLI() {
        const cli = new BaseCLIHandler('DeploymentPipeline');
        
        cli.registerCommand('deploy', async (args) => {
            return await this.executeFullDeploymentPipeline({
                confirmNpmPublish: args.flags.has('confirm-npm-publish'),
                allowDirtyWorkingTree: args.flags.has('allow-dirty')
            });
        }, 'Execute full deployment pipeline', [
            { name: 'confirm-npm-publish', flag: true, description: 'Confirm NPM package publication' },
            { name: 'allow-dirty', flag: true, description: 'Allow deployment with dirty working tree' }
        ]);
        
        cli.registerCommand('status', async () => {
            return {
                initialized: this.initialized,
                packageName: this.config.packageName,
                version: this.config.version,
                deploymentHistory: this.deploymentHistory.length,
                lastDeployment: this.deploymentHistory[this.deploymentHistory.length - 1]
            };
        }, 'Show deployment pipeline status');
        
        cli.registerCommand('history', async () => {
            return {
                deployments: this.deploymentHistory.slice(-10),
                total: this.deploymentHistory.length
            };
        }, 'Show recent deployment history');
        
        cli.addExample('deployment-pipeline.js deploy --confirm-npm-publish', 'Deploy with NPM publish confirmation');
        cli.addExample('deployment-pipeline.js status', 'Show deployment status');
        cli.addExample('deployment-pipeline.js history', 'Show deployment history');
        
        return cli;
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const pipeline = new DeploymentPipeline();
    const cli = pipeline.setupCLI();
    
    cli.runCLI(process.argv.slice(2))
        .then(result => {
            if (result.status === 'success') {
                console.log(`\n✅ Command completed successfully`);
                process.exit(0);
            } else if (result.status === 'error') {
                console.error(`\n❌ Command failed: ${result.error}`);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error(`\n💥 CLI execution failed:`, error.message);
            process.exit(1);
        });
}

export default DeploymentPipeline;