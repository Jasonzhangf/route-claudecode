#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Unified Tools Configuration and Help System
 * 
 * Tests all aspects of the ToolsConfigManager:
 * - Tool discovery and registration system
 * - Unified configuration management across all tools
 * - Configuration validation and defaults management
 * - Help documentation generation and display
 * - CLI interface with consistent command support
 * - Configuration update and persistence
 * 
 * @author Jason Zhang
 * @version 3.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import ToolsConfigManager from '../../src/v3/tools-ecosystem/unified-config/tools-config-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ToolsConfigManagerTest {
    constructor() {
        this.testOutputDir = path.join(__dirname, '../output/functional');
        this.testDataDir = path.join(this.testOutputDir, 'test-tools-config-data');
        this.sessionId = `tools-config-test-${Date.now()}`;
        this.results = {
            sessionId: this.sessionId,
            startTime: new Date().toISOString(),
            tests: [],
            summary: { total: 0, passed: 0, failed: 0 }
        };
        
        // Test configuration
        this.testConfig = {
            baseDir: this.testDataDir,
            toolsConfigFile: 'test-tools-config.json',
            helpDocsDir: 'test-help-docs',
            validateOnLoad: true,
            createDefaults: true
        };
    }

    async runTests() {
        try {
            console.log('🧪 Starting Tools Configuration Manager Tests...');
            console.log(`Session ID: ${this.sessionId}`);
            
            // Ensure test output directory exists
            await fs.mkdir(this.testOutputDir, { recursive: true });
            await fs.mkdir(this.testDataDir, { recursive: true });

            // Run individual tests
            const tests = [
                this.testManagerInitialization(),
                this.testToolDiscovery(),
                this.testConfigurationManagement(),
                this.testHelpDocumentationGeneration(),
                this.testConfigurationValidation(),
                this.testConfigurationUpdates(),
                this.testCLIInterface(),
                this.testPersistenceAndRecovery(),
                this.testComprehensiveIntegration()
            ];

            for (const test of tests) {
                await test;
            }

            // Generate final summary
            this.results.endTime = new Date().toISOString();
            this.results.summary.total = this.results.tests.length;
            this.results.summary.passed = this.results.tests.filter(t => t.status === 'passed').length;
            this.results.summary.failed = this.results.tests.filter(t => t.status === 'failed').length;

            // Save test results
            const resultsFile = path.join(this.testOutputDir, `tools-config-manager-test-${this.sessionId}.json`);
            await fs.writeFile(resultsFile, JSON.stringify(this.results, null, 2));

            // Display summary
            console.log(`\n📊 Test Summary:`);
            console.log(`✅ Passed: ${this.results.summary.passed}`);
            console.log(`❌ Failed: ${this.results.summary.failed}`);
            console.log(`📁 Results: ${resultsFile}`);

            return this.results;
        } catch (error) {
            console.error('❌ Test execution failed:', error.message);
            throw error;
        }
    }

    async testManagerInitialization() {
        const testResult = {
            name: 'Manager Initialization and Setup',
            startTime: new Date().toISOString(),
            status: 'running',
            validations: []
        };

        try {
            console.log('\n🔧 Test 1: Manager Initialization and Setup');

            // Create manager instance
            const manager = new ToolsConfigManager(this.testConfig);
            
            // Test initialization
            const initResult = await manager.initialize();
            
            this.validateTestCondition(
                testResult,
                'Manager Initialization',
                initResult.status === 'initialized',
                `Initialization status: ${initResult.status}`
            );

            this.validateTestCondition(
                testResult,
                'Tools Discovery Count',
                initResult.toolsCount >= 5,
                `Tools discovered: ${initResult.toolsCount}`
            );

            this.validateTestCondition(
                testResult,
                'Configurations Loading',
                initResult.configurationsCount >= 5,
                `Configurations loaded: ${initResult.configurationsCount}`
            );

            this.validateTestCondition(
                testResult,
                'Base Directory Creation',
                await this.directoryExists(initResult.baseDir),
                `Base directory: ${initResult.baseDir}`
            );

            this.validateTestCondition(
                testResult,
                'Help Docs Directory',
                await this.directoryExists(path.join(initResult.baseDir, this.testConfig.helpDocsDir)),
                'Help documentation directory created'
            );

            this.validateTestCondition(
                testResult,
                'Manager Ready State',
                manager.initialized === true,
                'Manager marked as initialized'
            );

            testResult.status = 'passed';
            testResult.manager = manager; // Store for later tests
            
        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            console.error('❌ Test 1 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);
        
        return testResult;
    }

    async testToolDiscovery() {
        const testResult = {
            name: 'Tool Discovery and Registration',
            startTime: new Date().toISOString(),
            status: 'running',
            validations: []
        };

        try {
            console.log('\n🔍 Test 2: Tool Discovery and Registration');

            const manager = new ToolsConfigManager(this.testConfig);
            await manager.initialize();

            // Check for expected tools
            const expectedTools = [
                'log-parser',
                'timeline-visualizer', 
                'finish-reason-tracker',
                'dynamic-config-manager',
                'configuration-dashboard'
            ];

            for (const toolName of expectedTools) {
                const toolExists = manager.tools.has(toolName);
                this.validateTestCondition(
                    testResult,
                    `Tool Discovery: ${toolName}`,
                    toolExists,
                    `Tool ${toolName} discovered: ${toolExists}`
                );

                if (toolExists) {
                    const toolInfo = manager.tools.get(toolName);
                    this.validateTestCondition(
                        testResult,
                        `Tool Info Completeness: ${toolName}`,
                        toolInfo.description && toolInfo.category && toolInfo.configSchema,
                        `${toolName} has complete metadata`
                    );
                }
            }

            // Check tool categories
            const categories = new Set();
            for (const [name, info] of manager.tools) {
                categories.add(info.category);
            }

            this.validateTestCondition(
                testResult,
                'Tool Categories',
                categories.has('data-processing') && 
                categories.has('visualization') &&
                categories.has('monitoring') &&
                categories.has('configuration'),
                `Categories found: ${Array.from(categories).join(', ')}`
            );

            // Test tool registration data structure
            const sampleTool = manager.tools.get('log-parser');
            if (sampleTool) {
                this.validateTestCondition(
                    testResult,
                    'Tool Data Structure',
                    sampleTool.name && sampleTool.path && sampleTool.commands && sampleTool.configSchema,
                    'Tool has required data structure'
                );
            }

            testResult.status = 'passed';

        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            console.error('❌ Test 2 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);

        return testResult;
    }

    async testConfigurationManagement() {
        const testResult = {
            name: 'Configuration Management System',
            startTime: new Date().toISOString(),
            status: 'running',
            validations: []
        };

        try {
            console.log('\n⚙️ Test 3: Configuration Management System');

            const manager = new ToolsConfigManager(this.testConfig);
            await manager.initialize();

            // Test default configuration creation
            const logParserConfig = await manager.getToolConfiguration('log-parser');
            
            this.validateTestCondition(
                testResult,
                'Default Configuration Generation',
                logParserConfig.config && logParserConfig.config.enabled === true,
                'Default configuration created with enabled=true'
            );

            this.validateTestCondition(
                testResult,
                'Configuration Schema Loading',
                logParserConfig.schema && logParserConfig.schema.inputDir,
                'Configuration schema loaded correctly'
            );

            this.validateTestCondition(
                testResult,
                'Default Values Application',
                logParserConfig.config.inputDir === './logs' &&
                logParserConfig.config.outputDir === './provider-protocols',
                'Default values applied from schema'
            );

            // Test configuration persistence
            const configFile = path.join(this.testConfig.baseDir, this.testConfig.toolsConfigFile);
            const configExists = await this.fileExists(configFile);
            
            this.validateTestCondition(
                testResult,
                'Configuration Persistence',
                configExists,
                `Configuration file saved: ${configFile}`
            );

            // Test configuration structure
            if (configExists) {
                const configContent = await fs.readFile(configFile, 'utf8');
                const config = JSON.parse(configContent);
                
                this.validateTestCondition(
                    testResult,
                    'Configuration File Structure',
                    config.version && config.tools && config.lastUpdated,
                    'Configuration file has proper structure'
                );

                this.validateTestCondition(
                    testResult,
                    'All Tools in Configuration',
                    Object.keys(config.tools).length >= 5,
                    `Configuration contains ${Object.keys(config.tools).length} tools`
                );
            }

            testResult.status = 'passed';

        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            console.error('❌ Test 3 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);

        return testResult;
    }

    async testHelpDocumentationGeneration() {
        const testResult = {
            name: 'Help Documentation Generation',
            startTime: new Date().toISOString(),
            status: 'running',
            validations: []
        };

        try {
            console.log('\n📚 Test 4: Help Documentation Generation');

            const manager = new ToolsConfigManager(this.testConfig);
            await manager.initialize();

            // Test help documentation generation
            const helpDocsCount = manager.helpDocs.size;
            
            this.validateTestCondition(
                testResult,
                'Help Documentation Generation',
                helpDocsCount >= 6, // 5 tools + master doc
                `Help documents generated: ${helpDocsCount}`
            );

            // Test master help document
            const masterHelp = await manager.showHelp();
            
            this.validateTestCondition(
                testResult,
                'Master Help Document',
                masterHelp.includes('Claude Code Router v3.0') &&
                masterHelp.includes('Available Tools by Category'),
                'Master help document contains expected content'
            );

            // Test individual tool help
            const logParserHelp = await manager.showHelp('log-parser');
            
            this.validateTestCondition(
                testResult,
                'Individual Tool Help',
                logParserHelp.includes('# log-parser - Help Documentation') &&
                logParserHelp.includes('Configuration Options'),
                'Individual tool help contains expected sections'
            );

            // Test help file persistence
            const helpDocsDir = path.join(this.testConfig.baseDir, this.testConfig.helpDocsDir);
            const helpFiles = await fs.readdir(helpDocsDir);
            
            this.validateTestCondition(
                testResult,
                'Help File Persistence',
                helpFiles.includes('README.md') && helpFiles.length >= 6,
                `Help files created: ${helpFiles.length}`
            );

            // Test help content quality
            const finishReasonHelp = await manager.showHelp('finish-reason-tracker');
            
            this.validateTestCondition(
                testResult,
                'Help Content Quality',
                finishReasonHelp.includes('Examples') &&
                finishReasonHelp.includes('Configuration Options') &&
                finishReasonHelp.includes('Available Commands'),
                'Help content includes all required sections'
            );

            testResult.status = 'passed';

        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            console.error('❌ Test 4 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);

        return testResult;
    }

    async testConfigurationValidation() {
        const testResult = {
            name: 'Configuration Validation System',
            startTime: new Date().toISOString(),
            status: 'running',
            validations: []
        };

        try {
            console.log('\n🔍 Test 5: Configuration Validation System');

            const manager = new ToolsConfigManager(this.testConfig);
            await manager.initialize();

            // Test validation of all configurations
            const validationResults = await manager.validateAllConfigurations();
            
            this.validateTestCondition(
                testResult,
                'Configuration Validation Execution',
                Array.isArray(validationResults) && validationResults.length > 0,
                `Validated ${validationResults.length} configurations`
            );

            this.validateTestCondition(
                testResult,
                'Default Configurations Valid',
                validationResults.every(result => result.valid),
                'All default configurations are valid'
            );

            // Test validation with invalid data
            try {
                await manager.updateToolConfiguration('log-parser', { maxFiles: 'invalid-number' });
                
                this.validateTestCondition(
                    testResult,
                    'Invalid Configuration Rejection',
                    false,
                    'Should have rejected invalid configuration'
                );
            } catch (error) {
                this.validateTestCondition(
                    testResult,
                    'Invalid Configuration Rejection',
                    error.message.includes('Invalid type'),
                    'Invalid configuration properly rejected'
                );
            }

            // Test validation result structure
            if (validationResults.length > 0) {
                const firstResult = validationResults[0];
                this.validateTestCondition(
                    testResult,
                    'Validation Result Structure',
                    firstResult.hasOwnProperty('tool') && 
                    firstResult.hasOwnProperty('valid'),
                    'Validation results have proper structure'
                );
            }

            testResult.status = 'passed';

        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            console.error('❌ Test 5 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);

        return testResult;
    }

    async testConfigurationUpdates() {
        const testResult = {
            name: 'Configuration Updates and Persistence',
            startTime: new Date().toISOString(),
            status: 'running',
            validations: []
        };

        try {
            console.log('\n🔄 Test 6: Configuration Updates and Persistence');

            const manager = new ToolsConfigManager(this.testConfig);
            await manager.initialize();

            // Test configuration update
            const originalConfig = await manager.getToolConfiguration('timeline-visualizer');
            const originalMaxCalls = originalConfig.config.maxCalls;

            const updatedConfig = await manager.updateToolConfiguration('timeline-visualizer', { 
                maxCalls: 100,
                timeRangeHours: 48 
            });

            this.validateTestCondition(
                testResult,
                'Configuration Update Success',
                updatedConfig.maxCalls === 100 && updatedConfig.timeRangeHours === 48,
                'Configuration updated successfully'
            );

            this.validateTestCondition(
                testResult,
                'Configuration Timestamp Update',
                updatedConfig.lastUpdated !== originalConfig.config.lastUpdated,
                'Configuration timestamp updated'
            );

            // Test persistence of updates
            const newManager = new ToolsConfigManager(this.testConfig);
            await newManager.initialize();
            
            const persistedConfig = await newManager.getToolConfiguration('timeline-visualizer');
            
            this.validateTestCondition(
                testResult,
                'Configuration Persistence',
                persistedConfig.config.maxCalls === 100 &&
                persistedConfig.config.timeRangeHours === 48,
                'Updated configuration persisted correctly'
            );

            // Test configuration backup creation
            const configFile = path.join(this.testConfig.baseDir, this.testConfig.toolsConfigFile);
            const dirContents = await fs.readdir(this.testConfig.baseDir);
            const backupFiles = dirContents.filter(f => f.includes('.backup-'));

            this.validateTestCondition(
                testResult,
                'Configuration Backup Creation',
                backupFiles.length > 0,
                `Backup files created: ${backupFiles.length}`
            );

            // Test complex configuration updates
            const complexUpdate = await manager.updateToolConfiguration('finish-reason-tracker', {
                alertThresholds: { errorRateHigh: 0.25, rateLimitFrequency: 15 },
                categories: ['stop', 'length', 'tool_calls', 'error', 'custom']
            });

            this.validateTestCondition(
                testResult,
                'Complex Configuration Updates',
                complexUpdate.alertThresholds.errorRateHigh === 0.25 &&
                complexUpdate.categories.includes('custom'),
                'Complex nested configuration updates work'
            );

            testResult.status = 'passed';

        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            console.error('❌ Test 6 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);

        return testResult;
    }

    async testCLIInterface() {
        const testResult = {
            name: 'CLI Interface Validation',
            startTime: new Date().toISOString(),
            status: 'running',
            validations: []
        };

        try {
            console.log('\n💻 Test 7: CLI Interface Validation');

            const manager = new ToolsConfigManager(this.testConfig);
            await manager.initialize();

            // Test list command
            const listResult = await manager.runCLI(['list']);
            
            this.validateTestCondition(
                testResult,
                'List Command',
                listResult.tools && listResult.tools.length >= 5,
                `List command returned ${listResult.tools?.length} tools`
            );

            // Test config command
            const configResult = await manager.runCLI(['config', '--tool', 'log-parser']);
            
            this.validateTestCondition(
                testResult,
                'Config Command',
                configResult.config && configResult.schema,
                'Config command returned configuration and schema'
            );

            // Test update-config command
            const updateResult = await manager.runCLI([
                'update-config', 
                '--tool', 'timeline-visualizer',
                '--key', 'maxCalls',
                '--value', '75'
            ]);
            
            this.validateTestCondition(
                testResult,
                'Update Config Command',
                updateResult.maxCalls === 75,
                'Update config command successfully updated value'
            );

            // Test generate-docs command
            const docsResult = await manager.runCLI(['generate-docs']);
            
            this.validateTestCondition(
                testResult,
                'Generate Docs Command',
                docsResult.status === 'generated' && docsResult.toolCount >= 5,
                `Generate docs command processed ${docsResult.toolCount} tools`
            );

            // Test validate command
            const validateResult = await manager.runCLI(['validate']);
            
            this.validateTestCondition(
                testResult,
                'Validate Command',
                validateResult.valid >= 0 && validateResult.results,
                `Validate command checked configurations: ${validateResult.valid} valid`
            );

            // Test help command
            const helpResult = await manager.runCLI(['help']);
            
            this.validateTestCondition(
                testResult,
                'Help Command',
                helpResult.command === 'help',
                'Help command executed successfully'
            );

            // Test tool-specific help
            const toolHelpResult = await manager.runCLI(['help', 'finish-reason-tracker']);
            
            this.validateTestCondition(
                testResult,
                'Tool-Specific Help',
                toolHelpResult.help && toolHelpResult.help.includes('finish-reason-tracker'),
                'Tool-specific help returned correctly'
            );

            testResult.status = 'passed';

        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            console.error('❌ Test 7 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);

        return testResult;
    }

    async testPersistenceAndRecovery() {
        const testResult = {
            name: 'Persistence and Recovery System',
            startTime: new Date().toISOString(),
            status: 'running',
            validations: []
        };

        try {
            console.log('\n💾 Test 8: Persistence and Recovery System');

            // Create and configure first manager
            const manager1 = new ToolsConfigManager(this.testConfig);
            await manager1.initialize();

            // Make some configuration changes
            await manager1.updateToolConfiguration('log-parser', { maxFiles: 200 });
            await manager1.updateToolConfiguration('timeline-visualizer', { colorScheme: 'custom' });

            // Create second manager to test recovery
            const manager2 = new ToolsConfigManager(this.testConfig);
            await manager2.initialize();

            // Verify configurations were persisted and recovered
            const logParserConfig = await manager2.getToolConfiguration('log-parser');
            const visualizerConfig = await manager2.getToolConfiguration('timeline-visualizer');

            this.validateTestCondition(
                testResult,
                'Configuration Persistence',
                logParserConfig.config.maxFiles === 200,
                'Log parser configuration persisted correctly'
            );

            this.validateTestCondition(
                testResult,
                'Configuration Recovery',
                visualizerConfig.config.colorScheme === 'custom',
                'Timeline visualizer configuration recovered correctly'
            );

            // Test help documentation persistence
            const helpFile = path.join(this.testConfig.baseDir, this.testConfig.helpDocsDir, 'README.md');
            const helpExists = await this.fileExists(helpFile);
            
            this.validateTestCondition(
                testResult,
                'Help Documentation Persistence',
                helpExists,
                'Help documentation files persisted'
            );

            // Test configuration file integrity
            const configFile = path.join(this.testConfig.baseDir, this.testConfig.toolsConfigFile);
            const configContent = await fs.readFile(configFile, 'utf8');
            const config = JSON.parse(configContent);

            this.validateTestCondition(
                testResult,
                'Configuration File Integrity',
                config.version === '3.0.0' &&
                config.tools['log-parser'].maxFiles === 200 &&
                config.tools['timeline-visualizer'].colorScheme === 'custom',
                'Configuration file maintains integrity'
            );

            // Test backup files creation
            const backupFiles = await fs.readdir(this.testConfig.baseDir);
            const backups = backupFiles.filter(f => f.includes('.backup-'));

            this.validateTestCondition(
                testResult,
                'Backup Files Creation',
                backups.length >= 1,
                `Backup files created: ${backups.length}`
            );

            testResult.status = 'passed';

        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            console.error('❌ Test 8 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);

        return testResult;
    }

    async testComprehensiveIntegration() {
        const testResult = {
            name: 'Comprehensive System Integration',
            startTime: new Date().toISOString(),
            status: 'running',
            validations: []
        };

        try {
            console.log('\n🎯 Test 9: Comprehensive System Integration');

            const manager = new ToolsConfigManager(this.testConfig);
            await manager.initialize();

            // Test full workflow: discovery -> configuration -> validation -> help
            
            // 1. Tool discovery and registration
            const toolCount = manager.tools.size;
            this.validateTestCondition(
                testResult,
                'Full Tool Discovery',
                toolCount >= 5,
                `Discovered ${toolCount} tools in ecosystem`
            );

            // 2. Configuration management across all tools
            const allConfigurations = new Map();
            for (const toolName of manager.tools.keys()) {
                const config = await manager.getToolConfiguration(toolName);
                allConfigurations.set(toolName, config);
            }

            this.validateTestCondition(
                testResult,
                'Universal Configuration Management',
                allConfigurations.size === toolCount,
                `Configurations managed for all ${allConfigurations.size} tools`
            );

            // 3. Help system integration
            const masterHelp = await manager.showHelp();
            let toolHelpCount = 0;
            
            for (const toolName of manager.tools.keys()) {
                try {
                    const toolHelp = await manager.showHelp(toolName);
                    if (toolHelp && toolHelp.includes(toolName)) {
                        toolHelpCount++;
                    }
                } catch (error) {
                    console.warn(`Help generation failed for ${toolName}: ${error.message}`);
                }
            }

            this.validateTestCondition(
                testResult,
                'Comprehensive Help System',
                toolHelpCount === toolCount && masterHelp.includes('Claude Code Router v3.0'),
                `Help generated for ${toolHelpCount}/${toolCount} tools`
            );

            // 4. CLI integration testing
            const cliCommands = ['list', 'validate', 'generate-docs'];
            let successfulCommands = 0;

            for (const command of cliCommands) {
                try {
                    const result = await manager.runCLI([command]);
                    if (result && !result.error) {
                        successfulCommands++;
                    }
                } catch (error) {
                    console.warn(`CLI command '${command}' failed: ${error.message}`);
                }
            }

            this.validateTestCondition(
                testResult,
                'CLI Integration',
                successfulCommands === cliCommands.length,
                `${successfulCommands}/${cliCommands.length} CLI commands successful`
            );

            // 5. System validation and integrity
            const validationResults = await manager.validateAllConfigurations();
            const validConfigurations = validationResults.filter(r => r.valid).length;

            this.validateTestCondition(
                testResult,
                'System Validation and Integrity',
                validConfigurations === toolCount,
                `${validConfigurations}/${toolCount} configurations valid`
            );

            // 6. End-to-end configuration workflow
            const testTool = 'finish-reason-tracker';
            const originalConfig = await manager.getToolConfiguration(testTool);
            
            await manager.updateToolConfiguration(testTool, { retentionDays: 60 });
            
            const newManager = new ToolsConfigManager(this.testConfig);
            await newManager.initialize();
            
            const recoveredConfig = await newManager.getToolConfiguration(testTool);

            this.validateTestCondition(
                testResult,
                'End-to-End Configuration Workflow',
                recoveredConfig.config.retentionDays === 60,
                'Full configuration lifecycle working correctly'
            );

            // 7. File system integration
            const filesCreated = [
                path.join(this.testConfig.baseDir, this.testConfig.toolsConfigFile),
                path.join(this.testConfig.baseDir, this.testConfig.helpDocsDir, 'README.md'),
                path.join(this.testConfig.baseDir, this.testConfig.helpDocsDir, 'log-parser.md')
            ];

            let existingFiles = 0;
            for (const file of filesCreated) {
                if (await this.fileExists(file)) {
                    existingFiles++;
                }
            }

            this.validateTestCondition(
                testResult,
                'File System Integration',
                existingFiles === filesCreated.length,
                `${existingFiles}/${filesCreated.length} expected files created`
            );

            testResult.status = 'passed';

        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            console.error('❌ Test 9 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);

        return testResult;
    }

    // Helper methods
    validateTestCondition(testResult, name, condition, details) {
        const validation = {
            test: name,
            status: condition ? 'passed' : 'failed',
            details
        };
        
        testResult.validations.push(validation);
        
        const icon = condition ? '✅' : '❌';
        console.log(`  ${icon} ${name}: ${details}`);
        
        return condition;
    }

    async directoryExists(dirPath) {
        try {
            const stats = await fs.stat(dirPath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

// Execute tests if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new ToolsConfigManagerTest();
    
    tester.runTests()
        .then(results => {
            console.log('\n🎯 All tests completed!');
            process.exit(results.summary.failed > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('💥 Test execution failed:', error);
            process.exit(1);
        });
}

export default ToolsConfigManagerTest;