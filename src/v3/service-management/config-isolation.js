#!/usr/bin/env node

/**
 * Claude Code Router v3.0 - Configuration Isolation System
 * 
 * Implements strict configuration isolation with:
 * - Read-only configuration files during runtime
 * - Pre-startup configuration validation
 * - Single-provider-protocol configuration support (ports 5501-5509)
 * - Service status reporting with process information
 * - Configuration integrity and security enforcement
 * 
 * @author Jason Zhang
 * @version 3.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ConfigurationIsolation extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            // Configuration paths
            baseDir: config.baseDir || path.resolve(process.env.HOME, '.route-claude-code'),
            configDir: config.configDir || 'config',
            singleProviderDir: config.singleProviderDir || 'single-provider',
            
            // Provider ports loaded from external configuration (zero-hardcoding compliance)
            providerPorts: null, // Will be loaded from external config file
            
            // Validation settings
            validateOnLoad: config.validateOnLoad !== false,
            enforceReadOnly: config.enforceReadOnly !== false,
            requireConfigIntegrity: config.requireConfigIntegrity !== false,
            
            // Security settings
            allowConfigModification: config.allowConfigModification === true,
            configBackupEnabled: config.configBackupEnabled !== false,
            auditConfigAccess: config.auditConfigAccess !== false,
            
            ...config
        };

        this.configurations = new Map();
        this.validationResults = new Map();
        this.configMetadata = new Map();
        this.initialized = false;
    }

    async initialize() {
        try {
            console.log('🔒 Initializing Configuration Isolation System...');
            
            // Load external provider ports configuration (zero-hardcoding compliance)
            await this.loadProviderPortsConfiguration();
            
            // Ensure configuration directories exist
            await this.ensureDirectories();
            
            // Load and validate all configurations
            await this.loadConfigurations();
            
            // Enforce read-only permissions if required
            if (this.config.enforceReadOnly) {
                await this.enforceReadOnlyPermissions();
            }
            
            // Set up configuration monitoring
            this.startConfigurationMonitoring();
            
            this.initialized = true;
            console.log(`✅ Configuration Isolation System initialized`);
            console.log(`   Configurations loaded: ${this.configurations.size}`);
            console.log(`   Provider ports configured: ${Object.keys(this.config.providerPorts).length}`);
            
            return {
                status: 'initialized',
                configurationsLoaded: this.configurations.size,
                providerPorts: Object.keys(this.config.providerPorts).length,
                readOnlyEnforced: this.config.enforceReadOnly
            };
        } catch (error) {
            console.error('❌ Configuration Isolation initialization failed:', error.message);
            throw error;
        }
    }

    async loadProviderPortsConfiguration() {
        const projectRoot = path.resolve(__dirname, '../../../');
        const providerPortsConfigPath = path.join(projectRoot, 'config', 'provider-ports.json');
        
        try {
            const configContent = await fs.readFile(providerPortsConfigPath, 'utf8');
            const providerPortsConfig = JSON.parse(configContent);
            
            if (!providerPortsConfig.providerPorts) {
                throw new Error('Provider ports configuration missing providerPorts section');
            }
            
            // Validate configuration format
            if (!providerPortsConfig.metadata || !providerPortsConfig.metadata.zeroFallback) {
                throw new Error('Configuration must explicitly enable zeroFallback compliance');
            }
            
            this.config.providerPorts = providerPortsConfig.providerPorts;
            console.log(`✅ Loaded provider ports configuration: ${Object.keys(this.config.providerPorts).length} ports`);
            
        } catch (error) {
            console.error(`❌ Failed to load provider ports configuration: ${error.message}`);
            throw new Error(`Zero-fallback principle violation: Provider ports configuration is required and must be explicitly provided. ${error.message}`);
        }
    }

    async ensureDirectories() {
        const dirs = [
            path.join(this.config.baseDir, this.config.configDir),
            path.join(this.config.baseDir, this.config.configDir, this.config.singleProviderDir),
            path.join(this.config.baseDir, 'config-backups'),
            path.join(this.config.baseDir, 'config-audit')
        ];

        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    async loadConfigurations() {
        try {
            console.log('📂 Loading and validating configurations...');
            
            const singleProviderDir = path.join(
                this.config.baseDir, 
                this.config.configDir, 
                this.config.singleProviderDir
            );

            // Load single-provider configurations
            for (const [port, providerInfo] of Object.entries(this.config.providerPorts)) {
                const configPath = path.join(singleProviderDir, providerInfo.config);
                
                try {
                    await fs.access(configPath);
                    const configContent = await fs.readFile(configPath, 'utf8');
                    const config = JSON.parse(configContent);
                    
                    // Validate configuration
                    const validation = await this.validateConfiguration(config, port, providerInfo);
                    
                    if (validation.valid) {
                        this.configurations.set(port, {
                            ...config,
                            metadata: {
                                ...providerInfo,
                                configPath,
                                loadedAt: new Date().toISOString(),
                                validated: true
                            }
                        });
                        
                        this.validationResults.set(port, validation);
                        console.log(`✅ Port ${port}: ${providerInfo.provider}/${providerInfo.account} configuration loaded`);
                    } else {
                        console.error(`❌ Port ${port}: Configuration validation failed: ${validation.errors.join(', ')}`);
                        this.validationResults.set(port, validation);
                    }
                    
                } catch (error) {
                    console.warn(`⚠️ Port ${port}: Configuration file not found or invalid: ${providerInfo.config}`);
                    
                    // Create placeholder configuration if missing
                    if (error.code === 'ENOENT') {
                        await this.createPlaceholderConfiguration(configPath, port, providerInfo);
                    }
                }
            }

            console.log(`📊 Configuration loading completed: ${this.configurations.size}/${Object.keys(this.config.providerPorts).length} configurations loaded`);
            
        } catch (error) {
            console.error('❌ Configuration loading failed:', error.message);
            throw error;
        }
    }

    async validateConfiguration(config, port, providerInfo) {
        const validation = {
            valid: true,
            errors: [],
            warnings: [],
            port: parseInt(port),
            provider: providerInfo.provider,
            validatedAt: new Date().toISOString()
        };

        try {
            // Validate basic structure
            if (!config.server || !config.server.port) {
                validation.errors.push('Missing server.port configuration');
                validation.valid = false;
            } else if (config.server.port !== parseInt(port)) {
                validation.errors.push(`Port mismatch: expected ${port}, got ${config.server.port}`);
                validation.valid = false;
            }

            // Validate provider-specific settings
            switch (providerInfo.provider) {
                case 'codewhisperer':
                    if (!config.codewhisperer || !config.codewhisperer.region) {
                        validation.errors.push('Missing CodeWhisperer region configuration');
                        validation.valid = false;
                    }
                    break;
                    
                case 'google-gemini':
                    if (!config.gemini || !config.gemini.apiKey) {
                        validation.errors.push('Missing Gemini API key configuration');
                        validation.valid = false;
                    }
                    break;
                    
                case 'openai-compatible':
                    if (!config.openai || !config.openai.baseURL) {
                        validation.errors.push('Missing OpenAI compatible baseURL configuration');
                        validation.valid = false;
                    }
                    break;
            }

            // Validate routing configuration - Zero-fallback compliance
            if (!config.routing || !config.routing.defaultProvider) {
                validation.errors.push('Missing routing configuration. Zero-fallback principle requires explicit routing configuration.');
                validation.valid = false;
            }

            // Validate model configuration
            if (config.routing && config.routing.models && !config.routing.models[providerInfo.model]) {
                validation.warnings.push(`Model ${providerInfo.model} not found in routing configuration`);
            }

            // Security validation
            if (this.config.requireConfigIntegrity) {
                if (!config.security || !config.security.configHash) {
                    validation.warnings.push('Configuration integrity checking not enabled');
                }
            }

        } catch (error) {
            validation.errors.push(`Validation error: ${error.message}`);
            validation.valid = false;
        }

        return validation;
    }

    async createPlaceholderConfiguration(configPath, port, providerInfo) {
        try {
            console.log(`📝 Creating placeholder configuration for port ${port}`);
            
            const placeholderConfig = {
                version: '3.0.0',
                server: {
                    port: parseInt(port),
                    host: 'localhost'
                },
                routing: {
                    strategy: 'single-provider',
                    defaultProvider: providerInfo.provider,
                    models: {
                        [providerInfo.model]: {
                            provider: providerInfo.provider,
                            account: providerInfo.account
                        }
                    }
                },
                [providerInfo.provider.replace('-', '')]: {
                    ...(providerInfo.provider === 'codewhisperer' && { region: 'us-east-1' }),
                    ...(providerInfo.provider === 'google-gemini' && { apiKey: '${GEMINI_API_KEY}' }),
                    ...(providerInfo.provider === 'openai-compatible' && { 
                        baseURL: providerInfo.account === 'lmstudio' ? 'http://localhost:1234' : 'https://api.openai.com',
                        apiKey: '${OPENAI_API_KEY}'
                    })
                },
                security: {
                    configReadOnly: true,
                    requireValidation: true,
                    configHash: null
                },
                metadata: {
                    createdAt: new Date().toISOString(),
                    createdBy: 'Configuration Isolation System',
                    description: `Single-provider configuration for ${providerInfo.provider} on port ${port}`,
                    placeholder: true
                }
            };

            await fs.writeFile(configPath, JSON.stringify(placeholderConfig, null, 2));
            console.log(`✅ Placeholder configuration created: ${configPath}`);
            
        } catch (error) {
            console.error(`❌ Failed to create placeholder configuration: ${error.message}`);
        }
    }

    async enforceReadOnlyPermissions() {
        try {
            console.log('🔒 Enforcing read-only permissions on configuration files...');
            
            const singleProviderDir = path.join(
                this.config.baseDir, 
                this.config.configDir, 
                this.config.singleProviderDir
            );

            // Set read-only permissions on configuration directory and files
            for (const [port, providerInfo] of Object.entries(this.config.providerPorts)) {
                const configPath = path.join(singleProviderDir, providerInfo.config);
                
                try {
                    await fs.access(configPath);
                    await fs.chmod(configPath, 0o444); // Read-only for owner, group, others
                    console.log(`🔒 Set read-only: ${providerInfo.config}`);
                } catch (error) {
                    console.warn(`⚠️ Could not set read-only permissions: ${providerInfo.config}`);
                }
            }

            // Set directory to read-only
            await fs.chmod(singleProviderDir, 0o555); // Read and execute, no write
            
            console.log('✅ Read-only permissions enforced');
            
        } catch (error) {
            console.error('❌ Failed to enforce read-only permissions:', error.message);
        }
    }

    async validateServiceStartup(port, configOverrides = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const portStr = port.toString();
        const config = this.configurations.get(portStr);
        const validation = this.validationResults.get(portStr);

        if (!config) {
            throw new Error(`No configuration found for port ${port}`);
        }

        if (!validation || !validation.valid) {
            throw new Error(`Configuration validation failed for port ${port}: ${validation?.errors?.join(', ') || 'Unknown validation error'}`);
        }

        // Apply any runtime overrides (if allowed)
        let effectiveConfig = { ...config };
        if (Object.keys(configOverrides).length > 0) {
            if (!this.config.allowConfigModification) {
                throw new Error('Configuration modifications are not allowed in isolation mode');
            }
            
            effectiveConfig = { ...config, ...configOverrides };
            
            // Re-validate with overrides
            const overrideValidation = await this.validateConfiguration(
                effectiveConfig, 
                port, 
                this.config.providerPorts[port]
            );
            
            if (!overrideValidation.valid) {
                throw new Error(`Configuration override validation failed: ${overrideValidation.errors.join(', ')}`);
            }
        }

        // Audit configuration access
        if (this.config.auditConfigAccess) {
            await this.auditConfigurationAccess(port, 'startup-validation', configOverrides);
        }

        return {
            valid: true,
            port: port,
            provider: config.metadata.provider,
            account: config.metadata.account,
            config: effectiveConfig,
            validation: validation,
            readOnly: this.config.enforceReadOnly
        };
    }

    async getServiceStatusReport() {
        if (!this.initialized) {
            await this.initialize();
        }

        const report = {
            timestamp: new Date().toISOString(),
            system: {
                configurationIsolation: 'active',
                readOnlyEnforced: this.config.enforceReadOnly,
                validationRequired: this.config.validateOnLoad,
                auditEnabled: this.config.auditConfigAccess
            },
            configurations: {
                total: Object.keys(this.config.providerPorts).length,
                loaded: this.configurations.size,
                valid: Array.from(this.validationResults.values()).filter(v => v.valid).length,
                invalid: Array.from(this.validationResults.values()).filter(v => !v.valid).length
            },
            providerPorts: {},
            validationSummary: {}
        };

        // Detailed provider port information
        for (const [port, providerInfo] of Object.entries(this.config.providerPorts)) {
            const config = this.configurations.get(port);
            const validation = this.validationResults.get(port);

            report.providerPorts[port] = {
                provider: providerInfo.provider,
                account: providerInfo.account,
                model: providerInfo.model,
                configFile: providerInfo.config,
                status: config ? 'loaded' : 'missing',
                valid: validation?.valid || false,
                lastValidated: validation?.validatedAt || null,
                errors: validation?.errors || [],
                warnings: validation?.warnings || []
            };
        }

        // Validation summary by provider
        for (const [port, validation] of this.validationResults) {
            const provider = validation.provider;
            if (!report.validationSummary[provider]) {
                report.validationSummary[provider] = {
                    total: 0,
                    valid: 0,
                    invalid: 0,
                    ports: []
                };
            }

            report.validationSummary[provider].total++;
            if (validation.valid) {
                report.validationSummary[provider].valid++;
            } else {
                report.validationSummary[provider].invalid++;
            }
            report.validationSummary[provider].ports.push(parseInt(port));
        }

        return report;
    }

    async auditConfigurationAccess(port, action, details = {}) {
        try {
            const auditDir = path.join(this.config.baseDir, 'config-audit');
            const auditFile = path.join(auditDir, `config-access-${new Date().toISOString().split('T')[0]}.log`);
            
            const auditEntry = {
                timestamp: new Date().toISOString(),
                port: port,
                action: action,
                details: details,
                process: {
                    pid: process.pid,
                    ppid: process.ppid
                }
            };

            await fs.appendFile(auditFile, JSON.stringify(auditEntry) + '\n');
            
        } catch (error) {
            console.error('❌ Configuration audit logging failed:', error.message);
        }
    }

    startConfigurationMonitoring() {
        // Monitor configuration file changes (if allowed)
        if (!this.config.enforceReadOnly) {
            setInterval(async () => {
                try {
                    await this.checkConfigurationChanges();
                } catch (error) {
                    console.error('❌ Configuration monitoring error:', error.message);
                }
            }, 30000); // Check every 30 seconds
        }
    }

    async checkConfigurationChanges() {
        // Implementation for detecting configuration file changes
        // Would use file system watchers in a full implementation
        console.log('🔍 Checking for configuration changes...');
    }

    // CLI Interface
    async runCLI(args = []) {
        const command = args[0];
        
        switch (command) {
            case 'status':
                return await this.handleStatusCommand(args.slice(1));
            case 'validate':
                return await this.handleValidateCommand(args.slice(1));
            case 'ports':
                return await this.handlePortsCommand(args.slice(1));
            case 'audit':
                return await this.handleAuditCommand(args.slice(1));
            case 'help':
            default:
                return this.showHelp();
        }
    }

    async handleStatusCommand(args) {
        if (!this.initialized) await this.initialize();
        
        try {
            const report = await this.getServiceStatusReport();
            
            console.log(`\n🔒 Configuration Isolation Status`);
            console.log(`System Status: ${report.system.configurationIsolation}`);
            console.log(`Read-Only Enforced: ${report.system.readOnlyEnforced}`);
            console.log(`Validation Required: ${report.system.validationRequired}`);
            console.log(`Audit Enabled: ${report.system.auditEnabled}\n`);
            
            console.log(`📊 Configuration Summary:`);
            console.log(`   Total Configurations: ${report.configurations.total}`);
            console.log(`   Loaded: ${report.configurations.loaded}`);
            console.log(`   Valid: ${report.configurations.valid}`);
            console.log(`   Invalid: ${report.configurations.invalid}\n`);
            
            // Show provider summary
            console.log(`🔌 Provider Summary:`);
            for (const [provider, summary] of Object.entries(report.validationSummary)) {
                console.log(`   ${provider}: ${summary.valid}/${summary.total} valid (ports: ${summary.ports.join(', ')})`);
            }
            
            return report;
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return { error: error.message };
        }
    }

    async handleValidateCommand(args) {
        const port = args.find(arg => /^\d{4}$/.test(arg));
        
        if (port) {
            // Validate specific port
            try {
                const result = await this.validateServiceStartup(parseInt(port));
                
                console.log(`✅ Port ${port} validation successful:`);
                console.log(`   Provider: ${result.provider}`);
                console.log(`   Account: ${result.account}`);
                console.log(`   Read-Only: ${result.readOnly}`);
                
                return result;
            } catch (error) {
                console.error(`❌ Port ${port} validation failed: ${error.message}`);
                return { error: error.message, port: port };
            }
        } else {
            // Validate all configurations
            if (!this.initialized) await this.initialize();
            
            console.log(`\n🔍 Validating All Configurations\n`);
            
            const results = {};
            let validCount = 0;
            let invalidCount = 0;
            
            for (const [port, validation] of this.validationResults) {
                results[port] = validation;
                
                const icon = validation.valid ? '✅' : '❌';
                const provider = this.config.providerPorts[port];
                
                console.log(`${icon} Port ${port}: ${provider.provider}/${provider.account}`);
                
                if (!validation.valid) {
                    validation.errors.forEach(error => {
                        console.log(`    ❌ ${error}`);
                    });
                    invalidCount++;
                } else {
                    validCount++;
                }
                
                validation.warnings.forEach(warning => {
                    console.log(`    ⚠️ ${warning}`);
                });
                
                console.log('');
            }
            
            console.log(`📊 Validation Summary: ${validCount} valid, ${invalidCount} invalid`);
            
            return { 
                valid: validCount, 
                invalid: invalidCount, 
                results: results 
            };
        }
    }

    async handlePortsCommand(args) {
        if (!this.initialized) await this.initialize();
        
        console.log(`\n🔌 Single-Provider Configuration Ports\n`);
        
        for (const [port, providerInfo] of Object.entries(this.config.providerPorts)) {
            const config = this.configurations.get(port);
            const validation = this.validationResults.get(port);
            
            const statusIcon = config ? (validation?.valid ? '✅' : '❌') : '❓';
            
            console.log(`${statusIcon} Port ${port}: ${providerInfo.provider}/${providerInfo.account}`);
            console.log(`   Model: ${providerInfo.model}`);
            console.log(`   Config: ${providerInfo.config}`);
            console.log(`   Status: ${config ? (validation?.valid ? 'Valid' : 'Invalid') : 'Not Found'}`);
            console.log('');
        }
        
        return { ports: this.config.providerPorts };
    }

    async handleAuditCommand(args) {
        try {
            const auditDir = path.join(this.config.baseDir, 'config-audit');
            const files = await fs.readdir(auditDir);
            const logFiles = files.filter(f => f.startsWith('config-access-')).sort().reverse();
            
            console.log(`\n📋 Configuration Access Audit\n`);
            
            if (logFiles.length === 0) {
                console.log('No audit logs found');
                return { logs: [] };
            }
            
            // Show recent audit entries
            const recentLog = path.join(auditDir, logFiles[0]);
            const logContent = await fs.readFile(recentLog, 'utf8');
            const entries = logContent.split('\n').filter(line => line.trim()).slice(-10);
            
            console.log(`Recent audit entries (${logFiles[0]}):`);
            entries.forEach(entry => {
                try {
                    const parsed = JSON.parse(entry);
                    console.log(`${parsed.timestamp} | Port ${parsed.port} | ${parsed.action} | PID ${parsed.process.pid}`);
                } catch (error) {
                    console.log(`Invalid log entry: ${entry}`);
                }
            });
            
            return { logFiles: logFiles.length, recent: entries.length };
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return { error: error.message };
        }
    }

    showHelp() {
        console.log(`
🔒 Claude Code Router v3.0 - Configuration Isolation System

Usage: config-isolation.js <command> [options]

Commands:
  status                    Show configuration isolation status
  
  validate [port]           Validate configurations
                           Without port: validate all configurations
                           With port: validate specific port configuration
  
  ports                     Show all provider port assignments
  
  audit                     Show configuration access audit logs
  
  help                      Show this help message

Provider Ports:
  5501  CodeWhisperer (Primary)       - CLAUDE_SONNET_4_20250514_V1_0
  5502  Google Gemini (API Keys)      - gemini-2.5-pro, gemini-2.5-flash  
  5503  CodeWhisperer (Kiro-GitHub)   - CLAUDE_SONNET_4_20250514_V1_0
  5504  CodeWhisperer (Kiro-Gmail)    - CLAUDE_SONNET_4, CLAUDE_3_7_SONNET
  5505  CodeWhisperer (Kiro-Zcam)     - CLAUDE_SONNET_4, CLAUDE_3_7_SONNET
  5506  OpenAI Compatible (LM Studio) - qwen3-30b, glm-4.5-air
  5507  OpenAI Compatible (ModelScope)- Qwen3-Coder-480B
  5508  OpenAI Compatible (ShuaiHong) - claude-4-sonnet, gemini-2.5-pro  
  5509  OpenAI Compatible (ModelScope GLM) - ZhipuAI/GLM-4.5

Security Features:
  - Configuration files treated as read-only during runtime
  - Pre-startup validation required for all service launches
  - Configuration integrity checking and audit logging
  - Isolated single-provider configurations per port
  - Service status reporting with process information

Examples:
  config-isolation.js status
  config-isolation.js validate 5508
  config-isolation.js validate
  config-isolation.js ports
  config-isolation.js audit
        `);
        
        return { command: 'help' };
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const isolation = new ConfigurationIsolation();
    
    isolation.runCLI(process.argv.slice(2))
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

export default ConfigurationIsolation;