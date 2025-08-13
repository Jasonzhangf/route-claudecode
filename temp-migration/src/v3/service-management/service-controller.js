#!/usr/bin/env node

/**
 * Claude Code Router v3.0 - Service Management and Process Control System
 * 
 * Comprehensive service management with clear distinction between:
 * - API Server Services (`rcc start`) - Can be safely managed/restarted
 * - Client Session Services (`rcc code`) - Must be preserved and protected
 * 
 * Features:
 * - Service type distinction and safe control mechanisms
 * - Service status monitoring and health checks
 * - Graceful shutdown procedures for all services
 * - Process isolation and protection for client sessions
 * - Comprehensive service lifecycle management
 * 
 * @author Jason Zhang
 * @version 3.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

export class ServiceController extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            // Service management paths
            baseDir: config.baseDir || path.resolve(process.env.HOME, '.route-claude-code'),
            servicesDir: config.servicesDir || 'services',
            pidFile: config.pidFile || 'service-pids.json',
            statusFile: config.statusFile || 'service-status.json',
            
            // Service type definitions
            serviceTypes: {
                'api-server': {
                    pattern: 'rcc start',
                    manageable: true,
                    description: 'API Server - Can be safely managed/restarted',
                    healthCheckPath: '/health',
                    gracefulShutdownTimeout: 10000
                },
                'client-session': {
                    pattern: 'rcc code',
                    manageable: false,
                    description: 'Client Session - Must be preserved and protected',
                    healthCheckPath: null,
                    gracefulShutdownTimeout: null
                },
                'dashboard': {
                    pattern: 'configuration-dashboard',
                    manageable: true,
                    description: 'Configuration Dashboard - Web interface service',
                    healthCheckPath: '/status',
                    gracefulShutdownTimeout: 5000
                },
                'tools': {
                    pattern: 'tools-ecosystem',
                    manageable: true,
                    description: 'Tools Ecosystem Services - Data processing services',
                    healthCheckPath: null,
                    gracefulShutdownTimeout: 3000
                }
            },
            
            // Monitoring settings
            healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
            statusUpdateInterval: config.statusUpdateInterval || 5000,  // 5 seconds
            processDiscoveryInterval: config.processDiscoveryInterval || 60000, // 1 minute
            
            // Safety settings
            protectedProcesses: config.protectedProcesses || ['rcc code'],
            requireConfirmation: config.requireConfirmation !== false,
            dryRun: config.dryRun || false,
            
            ...config
        };

        this.services = new Map();
        this.healthChecks = new Map();
        this.statusReporting = new Map();
        this.initialized = false;
    }

    async initialize() {
        try {
            console.log('🔧 Initializing Service Controller...');
            
            // Ensure directories exist
            await fs.mkdir(this.config.baseDir, { recursive: true });
            await fs.mkdir(path.join(this.config.baseDir, this.config.servicesDir), { recursive: true });
            
            // Discover existing services
            await this.discoverServices();
            
            // Load service status
            await this.loadServiceStatus();
            
            // Start monitoring
            this.startMonitoring();
            
            this.initialized = true;
            console.log(`✅ Service Controller initialized`);
            console.log(`   Services discovered: ${this.services.size}`);
            console.log(`   Monitoring active: ${this.healthChecks.size} health checks`);
            
            return {
                status: 'initialized',
                servicesCount: this.services.size,
                healthChecksActive: this.healthChecks.size,
                baseDir: this.config.baseDir
            };
        } catch (error) {
            console.error('❌ Service Controller initialization failed:', error.message);
            throw error;
        }
    }

    async discoverServices() {
        try {
            console.log('🔍 Discovering running services...');
            
            // Get all processes
            const { stdout } = await execAsync('ps aux');
            const processes = stdout.split('\n').slice(1); // Skip header
            
            // Clear existing services
            this.services.clear();
            
            // Analyze each process
            for (const processLine of processes) {
                if (!processLine.trim()) continue;
                
                const parts = processLine.trim().split(/\s+/);
                if (parts.length < 11) continue;
                
                const pid = parts[1];
                const cpu = parts[2];
                const memory = parts[3];
                const command = parts.slice(10).join(' ');
                
                // Check if this is a relevant service
                const serviceType = this.identifyServiceType(command);
                if (serviceType) {
                    const service = {
                        pid: parseInt(pid),
                        type: serviceType,
                        command,
                        cpu: parseFloat(cpu),
                        memory: parseFloat(memory),
                        startTime: new Date().toISOString(), // Approximation
                        status: 'running',
                        manageable: this.config.serviceTypes[serviceType].manageable,
                        lastHealthCheck: null,
                        healthStatus: 'unknown'
                    };
                    
                    this.services.set(pid, service);
                    
                    // Start health checking for manageable services
                    if (service.manageable && this.config.serviceTypes[serviceType].healthCheckPath) {
                        this.startHealthCheck(service);
                    }
                }
            }
            
            console.log(`🔍 Discovered ${this.services.size} relevant services`);
            
            // Save current service state
            await this.saveServiceStatus();
            
            return this.services.size;
        } catch (error) {
            console.error('❌ Service discovery failed:', error.message);
            throw error;
        }
    }

    identifyServiceType(command) {
        for (const [type, config] of Object.entries(this.config.serviceTypes)) {
            if (command.includes(config.pattern)) {
                return type;
            }
        }
        return null;
    }

    async getServiceStatus(serviceId = null) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (serviceId) {
            const service = this.services.get(serviceId);
            if (!service) {
                throw new Error(`Service '${serviceId}' not found`);
            }
            
            // Update service status
            const isRunning = await this.checkProcessRunning(service.pid);
            service.status = isRunning ? 'running' : 'stopped';
            
            return service;
        } else {
            // Return all services
            const allServices = {};
            
            for (const [id, service] of this.services) {
                // Update status for all services
                const isRunning = await this.checkProcessRunning(service.pid);
                service.status = isRunning ? 'running' : 'stopped';
                
                allServices[id] = service;
            }
            
            return {
                services: allServices,
                summary: {
                    total: this.services.size,
                    running: Object.values(allServices).filter(s => s.status === 'running').length,
                    manageable: Object.values(allServices).filter(s => s.manageable).length,
                    protected: Object.values(allServices).filter(s => !s.manageable).length
                }
            };
        }
    }

    async stopService(serviceId, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const service = this.services.get(serviceId);
        if (!service) {
            throw new Error(`Service '${serviceId}' not found`);
        }

        // Safety check: Don't stop protected services
        if (!service.manageable) {
            const error = `Cannot stop protected service type '${service.type}' (PID: ${service.pid})`;
            console.error(`🚫 ${error}`);
            throw new Error(error);
        }

        // Confirmation check
        if (this.config.requireConfirmation && !options.confirmed) {
            console.log(`⚠️ Service stop requires confirmation:`);
            console.log(`   Service: ${service.type} (PID: ${service.pid})`);
            console.log(`   Command: ${service.command}`);
            throw new Error('Service stop requires confirmation. Use { confirmed: true } option.');
        }

        try {
            console.log(`🛑 Stopping ${service.type} service (PID: ${service.pid})`);
            
            if (this.config.dryRun) {
                console.log(`🧪 DRY RUN: Would stop service ${service.pid}`);
                return { status: 'dry-run', pid: service.pid, type: service.type };
            }

            // Attempt graceful shutdown first
            const gracefulTimeout = this.config.serviceTypes[service.type].gracefulShutdownTimeout;
            
            if (gracefulTimeout) {
                console.log(`🕐 Attempting graceful shutdown (${gracefulTimeout}ms timeout)`);
                
                // Send SIGTERM for graceful shutdown
                process.kill(service.pid, 'SIGTERM');
                
                // Wait for graceful shutdown
                const shutdownPromise = this.waitForProcessExit(service.pid, gracefulTimeout);
                const gracefulShutdown = await shutdownPromise;
                
                if (gracefulShutdown) {
                    console.log(`✅ Service ${service.pid} shut down gracefully`);
                    service.status = 'stopped';
                    this.emit('servicesStopped', { pid: service.pid, method: 'graceful' });
                    return { status: 'stopped', pid: service.pid, method: 'graceful' };
                }
            }

            // Force shutdown if graceful failed
            console.log(`💥 Force stopping service ${service.pid}`);
            process.kill(service.pid, 'SIGKILL');
            
            // Wait a moment and verify
            await new Promise(resolve => setTimeout(resolve, 1000));
            const isStillRunning = await this.checkProcessRunning(service.pid);
            
            if (!isStillRunning) {
                console.log(`✅ Service ${service.pid} force stopped`);
                service.status = 'stopped';
                this.emit('serviceStopped', { pid: service.pid, method: 'force' });
                return { status: 'stopped', pid: service.pid, method: 'force' };
            } else {
                throw new Error(`Failed to stop service ${service.pid}`);
            }
            
        } catch (error) {
            console.error(`❌ Failed to stop service ${service.pid}:`, error.message);
            throw error;
        }
    }

    async restartService(serviceId, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const service = this.services.get(serviceId);
        if (!service) {
            throw new Error(`Service '${serviceId}' not found`);
        }

        if (!service.manageable) {
            throw new Error(`Cannot restart protected service type '${service.type}'`);
        }

        try {
            console.log(`🔄 Restarting ${service.type} service (PID: ${service.pid})`);
            
            // Stop the service
            await this.stopService(serviceId, { ...options, confirmed: true });
            
            // Wait a moment before restart
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Start the service (would need service start command stored)
            // For now, just report that manual restart is needed
            console.log(`📋 Service stopped. Manual restart required with original command:`);
            console.log(`   ${service.command}`);
            
            return {
                status: 'restart-required',
                pid: service.pid,
                command: service.command,
                message: 'Service stopped. Manual restart required.'
            };
            
        } catch (error) {
            console.error(`❌ Failed to restart service ${service.pid}:`, error.message);
            throw error;
        }
    }

    async checkProcessRunning(pid) {
        try {
            // Check if process exists and we can access it
            process.kill(pid, 0);
            return true;
        } catch (error) {
            if (error.code === 'ESRCH') {
                // Process doesn't exist
                return false;
            } else if (error.code === 'EPERM') {
                // Process exists but we don't have permission (still running)
                return true;
            }
            return false;
        }
    }

    async waitForProcessExit(pid, timeout) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const checkExit = setInterval(() => {
                this.checkProcessRunning(pid).then(isRunning => {
                    if (!isRunning) {
                        clearInterval(checkExit);
                        resolve(true);
                    } else if (Date.now() - startTime > timeout) {
                        clearInterval(checkExit);
                        resolve(false);
                    }
                });
            }, 100);
        });
    }

    startHealthCheck(service) {
        const serviceType = this.config.serviceTypes[service.type];
        if (!serviceType.healthCheckPath) return;

        const healthCheckId = `health-${service.pid}`;
        
        const healthCheck = setInterval(async () => {
            try {
                // Extract port from service command (simple pattern matching)
                const portMatch = service.command.match(/--port\s+(\d+)|:(\d+)/);
                const port = portMatch ? (portMatch[1] || portMatch[2]) : '3456';
                
                const healthUrl = `http://localhost:${port}${serviceType.healthCheckPath}`;
                
                // Simple health check (would use http module in real implementation)
                const isHealthy = await this.performHealthCheck(healthUrl);
                
                service.lastHealthCheck = new Date().toISOString();
                service.healthStatus = isHealthy ? 'healthy' : 'unhealthy';
                
                if (!isHealthy) {
                    console.warn(`⚠️ Health check failed for service ${service.pid}`);
                    this.emit('serviceUnhealthy', { pid: service.pid, type: service.type });
                }
                
            } catch (error) {
                console.error(`❌ Health check error for service ${service.pid}:`, error.message);
                service.healthStatus = 'error';
            }
        }, this.config.healthCheckInterval);

        this.healthChecks.set(healthCheckId, healthCheck);
    }

    async performHealthCheck(url) {
        // Simplified health check - in real implementation would use http module
        try {
            const { stdout } = await execAsync(`curl -s -o /dev/null -w "%{http_code}" ${url}`);
            const statusCode = parseInt(stdout.trim());
            return statusCode >= 200 && statusCode < 300;
        } catch (error) {
            return false;
        }
    }

    startMonitoring() {
        // Periodic service discovery
        setInterval(async () => {
            try {
                await this.discoverServices();
            } catch (error) {
                console.error('❌ Periodic service discovery failed:', error.message);
            }
        }, this.config.processDiscoveryInterval);

        // Status reporting updates
        setInterval(async () => {
            try {
                await this.saveServiceStatus();
            } catch (error) {
                console.error('❌ Status update failed:', error.message);
            }
        }, this.config.statusUpdateInterval);
    }

    async saveServiceStatus() {
        try {
            const statusFile = path.join(this.config.baseDir, this.config.statusFile);
            
            const status = {
                timestamp: new Date().toISOString(),
                services: {},
                summary: {
                    total: this.services.size,
                    byType: {},
                    byStatus: {}
                }
            };

            // Convert services Map to object and calculate summaries
            for (const [pid, service] of this.services) {
                status.services[pid] = service;
                
                // Count by type
                status.summary.byType[service.type] = (status.summary.byType[service.type] || 0) + 1;
                
                // Count by status
                status.summary.byStatus[service.status] = (status.summary.byStatus[service.status] || 0) + 1;
            }

            await fs.writeFile(statusFile, JSON.stringify(status, null, 2));
            
            this.emit('statusSaved', { file: statusFile, serviceCount: this.services.size });
            
        } catch (error) {
            console.error('❌ Failed to save service status:', error.message);
        }
    }

    async loadServiceStatus() {
        try {
            const statusFile = path.join(this.config.baseDir, this.config.statusFile);
            
            try {
                const content = await fs.readFile(statusFile, 'utf8');
                const savedStatus = JSON.parse(content);
                
                console.log(`📊 Loaded previous service status from ${savedStatus.timestamp}`);
                return savedStatus;
            } catch (error) {
                console.log('📁 No previous service status found');
                return null;
            }
        } catch (error) {
            console.error('❌ Failed to load service status:', error.message);
            return null;
        }
    }

    // CLI Interface
    async runCLI(args = []) {
        const command = args[0];
        
        switch (command) {
            case 'status':
                return await this.handleStatusCommand(args.slice(1));
            case 'stop':
                return await this.handleStopCommand(args.slice(1));
            case 'restart':
                return await this.handleRestartCommand(args.slice(1));
            case 'discover':
                return await this.handleDiscoverCommand(args.slice(1));
            case 'health':
                return await this.handleHealthCommand(args.slice(1));
            case 'help':
            default:
                return this.showHelp();
        }
    }

    async handleStatusCommand(args) {
        if (!this.initialized) await this.initialize();
        
        const serviceId = args.find(arg => !arg.startsWith('--'));
        const detailed = args.includes('--detailed');
        
        try {
            const status = await this.getServiceStatus(serviceId);
            
            if (serviceId) {
                // Single service status
                console.log(`\n🔧 Service Status: ${serviceId}`);
                console.log(`Type: ${status.type}`);
                console.log(`Status: ${status.status}`);
                console.log(`Manageable: ${status.manageable ? 'Yes' : 'No (Protected)'}`);
                console.log(`CPU: ${status.cpu}%`);
                console.log(`Memory: ${status.memory}%`);
                console.log(`Command: ${status.command}`);
                
                if (status.lastHealthCheck) {
                    console.log(`Health: ${status.healthStatus} (checked: ${status.lastHealthCheck})`);
                }
            } else {
                // All services status
                console.log(`\n🔧 All Services Status`);
                console.log(`Total: ${status.summary.total}`);
                console.log(`Running: ${status.summary.running}`);
                console.log(`Manageable: ${status.summary.manageable}`);
                console.log(`Protected: ${status.summary.protected}\n`);
                
                // Group by type
                const byType = {};
                Object.values(status.services).forEach(service => {
                    if (!byType[service.type]) byType[service.type] = [];
                    byType[service.type].push(service);
                });
                
                for (const [type, services] of Object.entries(byType)) {
                    console.log(`📁 ${type.toUpperCase()}`);
                    services.forEach(service => {
                        const icon = service.manageable ? '⚙️' : '🔒';
                        const statusIcon = service.status === 'running' ? '✅' : '❌';
                        console.log(`   ${icon}${statusIcon} PID ${service.pid.toString().padEnd(8)} ${service.status.padEnd(8)} CPU: ${service.cpu}% MEM: ${service.memory}%`);
                        
                        if (detailed) {
                            console.log(`       Command: ${service.command}`);
                        }
                    });
                    console.log('');
                }
            }
            
            return status;
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return { error: error.message };
        }
    }

    async handleStopCommand(args) {
        const serviceId = args.find(arg => !arg.startsWith('--'));
        const confirmed = args.includes('--confirm');
        const force = args.includes('--force');
        
        if (!serviceId) {
            console.log('Usage: stop <service-pid> [--confirm] [--force]');
            return { error: 'Service PID required' };
        }
        
        try {
            const options = { 
                confirmed: confirmed || force,
                force: force 
            };
            
            const result = await this.stopService(serviceId, options);
            
            console.log(`✅ Service ${serviceId} stop result: ${result.status}`);
            return result;
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return { error: error.message };
        }
    }

    async handleRestartCommand(args) {
        const serviceId = args.find(arg => !arg.startsWith('--'));
        const confirmed = args.includes('--confirm');
        
        if (!serviceId) {
            console.log('Usage: restart <service-pid> [--confirm]');
            return { error: 'Service PID required' };
        }
        
        try {
            const result = await this.restartService(serviceId, { confirmed });
            
            console.log(`🔄 Service ${serviceId} restart result: ${result.status}`);
            if (result.command) {
                console.log(`Command to restart: ${result.command}`);
            }
            return result;
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return { error: error.message };
        }
    }

    async handleDiscoverCommand(args) {
        try {
            if (!this.initialized) await this.initialize();
            
            const count = await this.discoverServices();
            console.log(`🔍 Discovery completed: ${count} services found`);
            return { discovered: count };
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return { error: error.message };
        }
    }

    async handleHealthCommand(args) {
        if (!this.initialized) await this.initialize();
        
        console.log(`\n💊 Service Health Status\n`);
        
        let healthyCount = 0;
        let unhealthyCount = 0;
        let unknownCount = 0;
        
        for (const [pid, service] of this.services) {
            if (!service.manageable || !this.config.serviceTypes[service.type].healthCheckPath) continue;
            
            const healthIcon = {
                'healthy': '✅',
                'unhealthy': '❌', 
                'error': '💥',
                'unknown': '❓'
            }[service.healthStatus] || '❓';
            
            console.log(`${healthIcon} PID ${pid.padEnd(8)} ${service.type.padEnd(15)} ${service.healthStatus}`);
            
            if (service.lastHealthCheck) {
                console.log(`    Last check: ${service.lastHealthCheck}`);
            }
            
            switch (service.healthStatus) {
                case 'healthy': healthyCount++; break;
                case 'unhealthy': 
                case 'error': unhealthyCount++; break;
                default: unknownCount++; break;
            }
            
            console.log('');
        }
        
        console.log(`📊 Health Summary:`);
        console.log(`   Healthy: ${healthyCount}`);
        console.log(`   Unhealthy: ${unhealthyCount}`);
        console.log(`   Unknown: ${unknownCount}`);
        
        return {
            healthy: healthyCount,
            unhealthy: unhealthyCount,
            unknown: unknownCount
        };
    }

    showHelp() {
        console.log(`
🔧 Claude Code Router v3.0 - Service Controller

Usage: service-controller.js <command> [options]

Commands:
  status [service-pid]      Show service status
    --detailed              Show detailed information
  
  stop <service-pid>        Stop a manageable service
    --confirm               Skip confirmation prompt
    --force                 Force stop without graceful shutdown
  
  restart <service-pid>     Restart a manageable service
    --confirm               Skip confirmation prompt
  
  discover                  Discover and refresh service list
  
  health                    Show health status of all services
  
  help                      Show this help message

Service Types:
  🔒 client-session        Protected - Cannot be managed (rcc code)
  ⚙️ api-server            Manageable - Can be stopped/restarted (rcc start)
  ⚙️ dashboard             Manageable - Web interface services
  ⚙️ tools                 Manageable - Tool ecosystem services

Safety Features:
  - Protected services (client sessions) cannot be stopped
  - Graceful shutdown with configurable timeouts
  - Confirmation required for destructive operations
  - Health monitoring for manageable services
  - Service type distinction and isolation

Examples:
  service-controller.js status
  service-controller.js status 12345 --detailed
  service-controller.js stop 12345 --confirm
  service-controller.js restart 12345 --confirm
  service-controller.js health
        `);
        
        return { command: 'help' };
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const controller = new ServiceController();
    
    controller.runCLI(process.argv.slice(2))
        .then(result => {
            if (result.status) {
                console.log(`\n✅ Command completed: ${result.status}`);
            }
        })
        .catch(error => {
            console.error(`\n❌ Command failed:`, error.message);
            process.exit(1);
        });
}

export default ServiceController;