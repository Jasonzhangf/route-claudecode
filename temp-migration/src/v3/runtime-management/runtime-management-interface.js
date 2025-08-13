#!/usr/bin/env node

/**
 * Runtime Management Interface - Integrated System
 * 
 * Combined interface integrating Configuration Dashboard and Dynamic Configuration Manager
 * for comprehensive runtime management of Claude Code Router v3.0 architecture.
 * 
 * REAL IMPLEMENTATION - PRODUCTION READY
 * This implements complete Task 9 requirements with integrated real-time
 * monitoring, configuration management, and dynamic updates.
 * 
 * @author Jason Zhang
 * @version v3.0-production
 * @requires Node.js >= 16
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { ConfigurationDashboard } from './dashboard/configuration-dashboard.js';
import { DynamicConfigManager } from './configuration/dynamic-config-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Runtime Management Interface - Complete Implementation
 * Integrates all runtime management capabilities
 */
class RuntimeManagementInterface extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            dashboard: {
                port: options.dashboardPort || 3458,
                host: options.dashboardHost || 'localhost',
                refreshInterval: options.refreshInterval || 1000
            },
            configuration: {
                configPath: options.configPath || path.resolve(process.env.HOME, '.route-claude-code/config'),
                auditPath: options.auditPath || path.resolve(process.env.HOME, '.route-claude-code/audit'),
                maxBackups: options.maxBackups || 10,
                validationTimeout: options.validationTimeout || 5000
            }
        };
        
        this.dashboard = null;
        this.configManager = null;
        this.isRunning = false;
        this.startTime = null;
        
        console.log('🖥️ [REAL-IMPL] Runtime Management Interface Initialized');
        console.log(`📊 Dashboard Port: ${this.options.dashboard.port}`);
        console.log(`🔧 Config Management: Enabled`);
    }

    /**
     * Start the complete runtime management interface
     * @returns {Promise<void>}
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Runtime Management Interface already running');
            return;
        }

        try {
            console.log('🚀 [REAL-IMPL] Starting Runtime Management Interface...');
            this.startTime = new Date();
            
            // Initialize Configuration Manager
            console.log('🔧 Initializing Dynamic Configuration Manager...');
            this.configManager = new DynamicConfigManager(this.options.configuration);
            await this.configManager.initialize();
            
            // Initialize Configuration Dashboard
            console.log('📊 Initializing Configuration Dashboard...');
            this.dashboard = new ConfigurationDashboard(this.options.dashboard);
            await this.dashboard.start();
            
            // Set up integration between components
            await this.setupComponentIntegration();
            
            this.isRunning = true;
            
            console.log('\\n🎉 [REAL-IMPL] Runtime Management Interface Started Successfully!');
            console.log('\\n📋 Available Services:');
            console.log(`  🖥️  Dashboard: http://${this.options.dashboard.host}:${this.options.dashboard.port}`);
            console.log(`  📡 Status API: http://${this.options.dashboard.host}:${this.options.dashboard.port}/api/status`);
            console.log(`  🔧 Config API: http://${this.options.dashboard.host}:${this.options.dashboard.port}/api/config/`);
            console.log(`  📋 Health Check: http://${this.options.dashboard.host}:${this.options.dashboard.port}/api/health`);
            
            console.log('\\n🎯 Runtime Management Features:');
            console.log('  ✅ Real-time configuration monitoring');
            console.log('  ✅ Provider-protocol health tracking');
            console.log('  ✅ Dynamic configuration updates');
            console.log('  ✅ Automatic backup and rollback');
            console.log('  ✅ Complete audit trail logging');
            console.log('  ✅ Live pipeline visualization');
            
            this.emit('interface-started', {
                timestamp: this.startTime.toISOString(),
                dashboardPort: this.options.dashboard.port,
                configPath: this.options.configuration.configPath
            });
            
        } catch (error) {
            console.error('❌ Failed to start Runtime Management Interface:', error.message);
            await this.cleanup();
            throw error;
        }
    }

    /**
     * Stop the runtime management interface
     * @returns {Promise<void>}
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        try {
            console.log('🛑 Stopping Runtime Management Interface...');
            
            await this.cleanup();
            
            this.isRunning = false;
            const stopTime = new Date();
            const uptime = stopTime - this.startTime;
            
            console.log(`✅ Runtime Management Interface stopped (uptime: ${Math.floor(uptime / 1000)}s)`);
            
            this.emit('interface-stopped', {
                timestamp: stopTime.toISOString(),
                uptime: Math.floor(uptime / 1000)
            });
            
        } catch (error) {
            console.error('❌ Error stopping interface:', error.message);
            throw error;
        }
    }

    /**
     * Get comprehensive status of runtime management interface
     * @returns {Promise<Object>} Complete status information
     */
    async getStatus() {
        const now = new Date();
        const uptime = this.startTime ? Math.floor((now - this.startTime) / 1000) : 0;
        
        const status = {
            interface: {
                running: this.isRunning,
                startTime: this.startTime?.toISOString(),
                uptime,
                version: 'v3.0-production'
            },
            dashboard: this.dashboard ? {
                running: this.dashboard.isRunning,
                port: this.options.dashboard.port,
                host: this.options.dashboard.host,
                url: `http://${this.options.dashboard.host}:${this.options.dashboard.port}`
            } : null,
            configManager: this.configManager ? this.configManager.getStatus() : null,
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                architecture: process.arch,
                memory: process.memoryUsage(),
                pid: process.pid
            },
            timestamp: now.toISOString()
        };

        return status;
    }

    /**
     * Update configuration through integrated interface
     * @param {string} configName - Configuration name
     * @param {Object} newConfig - New configuration
     * @param {Object} options - Update options
     * @returns {Promise<Object>} Update result
     */
    async updateConfiguration(configName, newConfig, options = {}) {
        if (!this.configManager) {
            throw new Error('Configuration manager not initialized');
        }

        try {
            const result = await this.configManager.updateConfiguration(configName, newConfig, {
                ...options,
                source: 'runtime-interface'
            });

            // Trigger dashboard refresh to show updated configuration
            if (this.dashboard) {
                this.dashboard.emit('configuration-changed', {
                    configName,
                    updateId: result.updateId,
                    timestamp: result.timestamp
                });
            }

            return result;

        } catch (error) {
            console.error(`❌ Configuration update failed through interface: ${error.message}`);
            throw error;
        }
    }

    /**
     * Rollback configuration through integrated interface
     * @param {string} updateId - Update ID to rollback
     * @returns {Promise<Object>} Rollback result
     */
    async rollbackConfiguration(updateId) {
        if (!this.configManager) {
            throw new Error('Configuration manager not initialized');
        }

        try {
            const result = await this.configManager.rollbackConfiguration(updateId);

            // Trigger dashboard refresh to show rolled back configuration
            if (this.dashboard) {
                this.dashboard.emit('configuration-rolled-back', {
                    updateId,
                    configName: result.configName,
                    timestamp: result.timestamp
                });
            }

            return result;

        } catch (error) {
            console.error(`❌ Configuration rollback failed through interface: ${error.message}`);
            throw error;
        }
    }

    /**
     * Setup integration between dashboard and configuration manager
     * @returns {Promise<void>}
     */
    async setupComponentIntegration() {
        if (!this.dashboard || !this.configManager) {
            return;
        }

        // Forward configuration manager events to dashboard
        this.configManager.on('configuration-updated', (event) => {
            this.dashboard.emit('configuration-updated', event);
            this.emit('configuration-updated', event);
        });

        this.configManager.on('configuration-rolled-back', (event) => {
            this.dashboard.emit('configuration-rolled-back', event);
            this.emit('configuration-rolled-back', event);
        });

        this.configManager.on('configuration-update-failed', (event) => {
            this.dashboard.emit('configuration-update-failed', event);
            this.emit('configuration-update-failed', event);
        });

        // Forward dashboard events to interface
        this.dashboard.on('data-updated', (event) => {
            this.emit('dashboard-data-updated', event);
        });

        console.log('🔗 Component integration setup completed');
    }

    /**
     * Cleanup resources
     * @returns {Promise<void>}
     */
    async cleanup() {
        const cleanupTasks = [];

        if (this.dashboard && this.dashboard.isRunning) {
            cleanupTasks.push(this.dashboard.stop());
        }

        // Configuration manager cleanup would go here
        // Currently it doesn't have persistent resources to clean up

        await Promise.all(cleanupTasks);
    }

    /**
     * Test the complete runtime management system
     * @returns {Promise<Object>} Test results
     */
    async runSystemTest() {
        console.log('🧪 [REAL-IMPL] Running Runtime Management System Test...');
        
        const testResults = {
            timestamp: new Date().toISOString(),
            tests: [],
            summary: { passed: 0, failed: 0, total: 0 }
        };

        // Test 1: Dashboard accessibility
        try {
            const dashboardUrl = `http://${this.options.dashboard.host}:${this.options.dashboard.port}/api/health`;
            const response = await fetch(dashboardUrl);
            const healthData = await response.json();
            
            testResults.tests.push({
                name: 'Dashboard Health Check',
                status: healthData.status === 'healthy' ? 'passed' : 'failed',
                details: healthData
            });
            
            if (healthData.status === 'healthy') testResults.summary.passed++;
            else testResults.summary.failed++;
            
        } catch (error) {
            testResults.tests.push({
                name: 'Dashboard Health Check',
                status: 'failed',
                error: error.message
            });
            testResults.summary.failed++;
        }
        testResults.summary.total++;

        // Test 2: Configuration Manager Status
        try {
            const configStatus = this.configManager?.getStatus();
            testResults.tests.push({
                name: 'Configuration Manager Status',
                status: configStatus && configStatus.initialized ? 'passed' : 'failed',
                details: configStatus
            });
            
            if (configStatus && configStatus.initialized) testResults.summary.passed++;
            else testResults.summary.failed++;
            
        } catch (error) {
            testResults.tests.push({
                name: 'Configuration Manager Status',
                status: 'failed',
                error: error.message
            });
            testResults.summary.failed++;
        }
        testResults.summary.total++;

        // Test 3: Test Configuration Update
        try {
            const testConfig = {
                test: true,
                timestamp: new Date().toISOString(),
                providers: {
                    'test-provider': {
                        type: 'openai',
                        endpoint: 'https://api.test.example.com/v1/chat/completions'
                    }
                }
            };
            
            const updateResult = await this.updateConfiguration('system-test', testConfig, {
                user: 'system-test',
                description: 'System test configuration update'
            });
            
            testResults.tests.push({
                name: 'Configuration Update Test',
                status: updateResult.success ? 'passed' : 'failed',
                details: updateResult
            });
            
            if (updateResult.success) testResults.summary.passed++;
            else testResults.summary.failed++;
            
        } catch (error) {
            testResults.tests.push({
                name: 'Configuration Update Test',
                status: 'failed',
                error: error.message
            });
            testResults.summary.failed++;
        }
        testResults.summary.total++;

        console.log(`\\n📊 System Test Results: ${testResults.summary.passed}/${testResults.summary.total} passed`);
        
        return testResults;
    }
}

/**
 * CLI Interface for Runtime Management Interface
 */
async function main() {
    console.log('🎯 Runtime Management Interface - Task 9 Complete Implementation');
    console.log('📋 Implementing Requirements: 6.1, 6.2, 6.3, 6.4, 6.5');
    console.log('🏗️ Integrating Configuration Dashboard + Dynamic Config Manager');
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0];
    const dashboardPort = args.find(arg => arg.startsWith('--port='))?.split('=')[1] || 3458;
    
    try {
        const runtimeInterface = new RuntimeManagementInterface({
            dashboardPort: parseInt(dashboardPort)
        });
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\\n🛑 Shutting down Runtime Management Interface...');
            await runtimeInterface.stop();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            await runtimeInterface.stop();
            process.exit(0);
        });
        
        if (command === 'test') {
            // Run system test
            await runtimeInterface.start();
            const testResults = await runtimeInterface.runSystemTest();
            console.log('\\n🧪 System Test Complete:', JSON.stringify(testResults, null, 2));
            await runtimeInterface.stop();
        } else if (command === 'status') {
            // Just check status without starting
            console.log('\\n📊 Runtime Management Interface Status:');
            console.log(JSON.stringify(await runtimeInterface.getStatus(), null, 2));
        } else {
            // Start full interface
            await runtimeInterface.start();
            console.log('\\n⚡ Runtime Management Interface is running...');
            console.log('Press Ctrl+C to stop');
        }
        
    } catch (error) {
        console.error('❌ Runtime Management Interface error:', error.message);
        process.exit(1);
    }
}

// Export for integration
export { RuntimeManagementInterface };

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}