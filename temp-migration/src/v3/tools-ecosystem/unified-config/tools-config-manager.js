#!/usr/bin/env node

/**
 * Claude Code Router v3.0 - Unified Tools Configuration and Help System
 * 
 * Central configuration management and help system for all tools in the ecosystem:
 * - Unified configuration management across all tools
 * - Standardized command-line interface with consistent --help support
 * - Tool discovery and registration system
 * - Configuration validation and defaults management
 * - Interactive configuration wizard
 * - Help documentation generation and display
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

export class ToolsConfigManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            // Default configuration paths
            baseDir: config.baseDir || path.resolve(process.env.HOME, '.route-claude-code'),
            toolsConfigFile: config.toolsConfigFile || 'tools-config.json',
            helpDocsDir: config.helpDocsDir || 'help-docs',
            
            // Tool discovery settings
            toolsDirectory: config.toolsDirectory || path.join(__dirname, '..'),
            toolPattern: config.toolPattern || '**/*-*.js',
            
            // Configuration validation
            validateOnLoad: config.validateOnLoad !== false,
            createDefaults: config.createDefaults !== false,
            backupConfigs: config.backupConfigs !== false,
            
            // Help system settings
            helpFormat: config.helpFormat || 'markdown',
            includeExamples: config.includeExamples !== false,
            generateManPages: config.generateManPages || false,
            
            ...config
        };

        this.tools = new Map();
        this.configurations = new Map();
        this.helpDocs = new Map();
        this.initialized = false;
    }

    async initialize() {
        try {
            console.log('🔧 Initializing Tools Configuration Manager...');
            
            // Ensure directories exist
            await fs.mkdir(this.config.baseDir, { recursive: true });
            await fs.mkdir(path.join(this.config.baseDir, this.config.helpDocsDir), { recursive: true });
            
            // Discover available tools
            await this.discoverTools();
            
            // Load existing configurations
            await this.loadConfigurations();
            
            // Generate help documentation
            await this.generateHelpDocumentation();
            
            // Validate configurations
            if (this.config.validateOnLoad) {
                await this.validateAllConfigurations();
            }
            
            this.initialized = true;
            console.log(`✅ Tools Configuration Manager initialized`);
            console.log(`   Tools discovered: ${this.tools.size}`);
            console.log(`   Configurations loaded: ${this.configurations.size}`);
            
            return {
                status: 'initialized',
                toolsCount: this.tools.size,
                configurationsCount: this.configurations.size,
                baseDir: this.config.baseDir
            };
        } catch (error) {
            console.error('❌ Tools Configuration Manager initialization failed:', error.message);
            throw error;
        }
    }

    async discoverTools() {
        try {
            const toolsDir = this.config.toolsDirectory;
            
            // Define known tools and their configurations
            const knownTools = [
                {
                    name: 'log-parser',
                    path: 'data-extraction/log-parser.js',
                    description: 'Provider-protocol-classified data extraction from logs',
                    category: 'data-processing',
                    configSchema: {
                        inputDir: { type: 'string', default: './logs', description: 'Input logs directory' },
                        outputDir: { type: 'string', default: './provider-protocols', description: 'Output directory' },
                        maxFiles: { type: 'number', default: 100, description: 'Maximum files to process' },
                        providerProtocols: { 
                            type: 'array', 
                            default: ['anthropic', 'openai', 'gemini', 'codewhisperer'], 
                            description: 'Supported provider protocols' 
                        }
                    },
                    commands: ['parse', 'extract', 'classify', 'help']
                },
                {
                    name: 'timeline-visualizer',
                    path: 'visualization/api-timeline-visualizer.js', 
                    description: 'Interactive API timeline visualization with multi-provider support',
                    category: 'visualization',
                    configSchema: {
                        inputPath: { type: 'string', default: './provider-protocols', description: 'Provider protocol data path' },
                        outputPath: { type: 'string', default: './timeline-output', description: 'Timeline output path' },
                        maxCalls: { type: 'number', default: 50, description: 'Maximum API calls to display' },
                        timeRangeHours: { type: 'number', default: 24, description: 'Time range in hours' },
                        colorScheme: { type: 'string', default: 'default', description: 'Color scheme (default/custom)' }
                    },
                    commands: ['visualize', 'generate', 'export', 'help']
                },
                {
                    name: 'finish-reason-tracker',
                    path: 'finish-reason/finish-reason-tracker.js',
                    description: 'Comprehensive finish reason logging and pattern analysis',
                    category: 'monitoring',
                    configSchema: {
                        baseDir: { type: 'string', default: '~/.route-claude-code/finish-reasons', description: 'Base storage directory' },
                        alertThresholds: {
                            type: 'object',
                            default: { errorRateHigh: 0.15, rateLimitFrequency: 10 },
                            description: 'Alert threshold configuration'
                        },
                        retentionDays: { type: 'number', default: 30, description: 'Data retention period' },
                        categories: {
                            type: 'array',
                            default: ['stop', 'length', 'tool_calls', 'error', 'timeout', 'rate_limit', 'content_filter', 'unknown'],
                            description: 'Finish reason categories'
                        }
                    },
                    commands: ['query', 'report', 'export', 'alerts', 'help']
                },
                {
                    name: 'dynamic-config-manager',
                    path: '../runtime-management/dynamic-configuration/dynamic-config-manager.js',
                    description: 'Real-time configuration management with validation and rollback',
                    category: 'configuration',
                    configSchema: {
                        configPath: { type: 'string', default: './config', description: 'Configuration directory' },
                        backupEnabled: { type: 'boolean', default: true, description: 'Enable configuration backups' },
                        validationStrict: { type: 'boolean', default: true, description: 'Enable strict validation' },
                        auditLog: { type: 'boolean', default: true, description: 'Enable audit logging' }
                    },
                    commands: ['update', 'rollback', 'validate', 'backup', 'help']
                },
                {
                    name: 'configuration-dashboard',
                    path: '../runtime-management/dashboard/configuration-dashboard.js',
                    description: 'Web-based real-time configuration monitoring dashboard',
                    category: 'monitoring', 
                    configSchema: {
                        port: { type: 'number', default: 3458, description: 'Dashboard web server port' },
                        enableMetrics: { type: 'boolean', default: true, description: 'Enable system metrics' },
                        refreshInterval: { type: 'number', default: 5000, description: 'Data refresh interval (ms)' },
                        theme: { type: 'string', default: 'dark', description: 'Dashboard theme (dark/light)' }
                    },
                    commands: ['start', 'stop', 'status', 'help']
                }
            ];

            // Register known tools
            for (const tool of knownTools) {
                this.tools.set(tool.name, {
                    ...tool,
                    fullPath: path.join(toolsDir, tool.path),
                    discovered: true,
                    lastModified: new Date().toISOString()
                });
            }

            console.log(`🔍 Discovered ${this.tools.size} tools in ecosystem`);
            
            return Array.from(this.tools.keys());
        } catch (error) {
            console.error('❌ Tool discovery failed:', error.message);
            throw error;
        }
    }

    async loadConfigurations() {
        try {
            const configFile = path.join(this.config.baseDir, this.config.toolsConfigFile);
            
            let existingConfig = {};
            try {
                const content = await fs.readFile(configFile, 'utf8');
                existingConfig = JSON.parse(content);
            } catch (error) {
                console.log('📁 No existing configuration found, creating defaults');
            }

            // Load or create default configurations for each tool
            for (const [toolName, toolInfo] of this.tools) {
                const toolConfig = existingConfig[toolName] || this.createDefaultConfig(toolInfo);
                
                // Merge with any existing user configuration
                if (existingConfig[toolName]) {
                    Object.assign(toolConfig, existingConfig[toolName]);
                }
                
                this.configurations.set(toolName, {
                    ...toolConfig,
                    lastUpdated: new Date().toISOString(),
                    version: toolInfo.version || '3.0.0'
                });
            }

            // Save updated configuration
            await this.saveConfiguration();
            
            console.log(`📊 Loaded configurations for ${this.configurations.size} tools`);
            
            return this.configurations.size;
        } catch (error) {
            console.error('❌ Configuration loading failed:', error.message);
            throw error;
        }
    }

    createDefaultConfig(toolInfo) {
        const defaults = {};
        
        if (toolInfo.configSchema) {
            for (const [key, schema] of Object.entries(toolInfo.configSchema)) {
                if (schema.default !== undefined) {
                    defaults[key] = schema.default;
                }
            }
        }
        
        return {
            enabled: true,
            ...defaults,
            metadata: {
                category: toolInfo.category,
                description: toolInfo.description,
                lastConfigured: new Date().toISOString()
            }
        };
    }

    async saveConfiguration() {
        try {
            const configFile = path.join(this.config.baseDir, this.config.toolsConfigFile);
            
            // Convert Map to object for JSON serialization
            const configObject = {};
            for (const [toolName, config] of this.configurations) {
                configObject[toolName] = config;
            }
            
            // Add metadata
            const fullConfig = {
                version: '3.0.0',
                lastUpdated: new Date().toISOString(),
                tools: configObject
            };
            
            // Backup existing configuration if requested
            if (this.config.backupConfigs) {
                try {
                    await fs.access(configFile);
                    const backupFile = `${configFile}.backup-${Date.now()}`;
                    await fs.copyFile(configFile, backupFile);
                } catch (error) {
                    // No existing file to backup
                }
            }
            
            await fs.writeFile(configFile, JSON.stringify(fullConfig, null, 2));
            
            this.emit('configurationSaved', { file: configFile, toolCount: this.configurations.size });
            
            return configFile;
        } catch (error) {
            console.error('❌ Configuration save failed:', error.message);
            throw error;
        }
    }

    async generateHelpDocumentation() {
        try {
            console.log('📚 Generating help documentation...');
            
            for (const [toolName, toolInfo] of this.tools) {
                const helpDoc = this.createHelpDocument(toolName, toolInfo);
                this.helpDocs.set(toolName, helpDoc);
                
                // Save help document to file
                const helpFile = path.join(this.config.baseDir, this.config.helpDocsDir, `${toolName}.md`);
                await fs.writeFile(helpFile, helpDoc);
            }
            
            // Generate master help index
            const masterHelp = this.createMasterHelpDocument();
            this.helpDocs.set('master', masterHelp);
            
            const masterFile = path.join(this.config.baseDir, this.config.helpDocsDir, 'README.md');
            await fs.writeFile(masterFile, masterHelp);
            
            console.log(`📖 Generated help documentation for ${this.helpDocs.size - 1} tools`);
            
            return this.helpDocs.size;
        } catch (error) {
            console.error('❌ Help documentation generation failed:', error.message);
            throw error;
        }
    }

    createHelpDocument(toolName, toolInfo) {
        const config = this.configurations.get(toolName) || {};
        
        return `# ${toolName} - Help Documentation

## Description
${toolInfo.description}

## Category
${toolInfo.category}

## Usage
\`\`\`bash
node ${toolInfo.fullPath} [command] [options]
\`\`\`

## Available Commands
${toolInfo.commands ? toolInfo.commands.map(cmd => `- **${cmd}**: ${this.getCommandDescription(cmd)}`).join('\n') : '- help: Show this help message'}

## Configuration Options
${toolInfo.configSchema ? this.generateConfigHelp(toolInfo.configSchema) : 'No configuration options available.'}

## Current Configuration
\`\`\`json
${JSON.stringify(config, null, 2)}
\`\`\`

## Examples
${this.generateExamples(toolName, toolInfo)}

## Related Tools
${this.getRelatedTools(toolInfo.category)}

---
*Generated by Tools Configuration Manager v3.0.0*
*Last updated: ${new Date().toISOString()}*
`;
    }

    generateConfigHelp(configSchema) {
        return Object.entries(configSchema)
            .map(([key, schema]) => {
                const type = schema.type || 'string';
                const defaultVal = schema.default !== undefined ? ` (default: ${JSON.stringify(schema.default)})` : '';
                const description = schema.description || 'No description available';
                
                return `- **${key}** (${type})${defaultVal}: ${description}`;
            })
            .join('\n');
    }

    generateExamples(toolName, toolInfo) {
        const examples = {
            'log-parser': [
                `node ${toolInfo.fullPath} parse --input ./logs --output ./processed`,
                `node ${toolInfo.fullPath} extract --provider anthropic --limit 100`,
                `node ${toolInfo.fullPath} help`
            ],
            'timeline-visualizer': [
                `node ${toolInfo.fullPath} visualize --input ./provider-protocols --max-calls 50`,
                `node ${toolInfo.fullPath} generate --time-range 24 --output ./timeline.html`,
                `node ${toolInfo.fullPath} help`
            ],
            'finish-reason-tracker': [
                `node ${toolInfo.fullPath} query --provider anthropic --hours 24`,
                `node ${toolInfo.fullPath} report --hours 12`,
                `node ${toolInfo.fullPath} export --format csv --provider openai`,
                `node ${toolInfo.fullPath} alerts`
            ],
            'dynamic-config-manager': [
                `node ${toolInfo.fullPath} update --key routing.strategy --value round-robin`,
                `node ${toolInfo.fullPath} validate --config ./routing-config.json`,
                `node ${toolInfo.fullPath} rollback --backup-id 12345`
            ],
            'configuration-dashboard': [
                `node ${toolInfo.fullPath} start --port 3458`,
                `node ${toolInfo.fullPath} status`,
                `node ${toolInfo.fullPath} stop`
            ]
        };

        const toolExamples = examples[toolName] || [`node ${toolInfo.fullPath} help`];
        
        return toolExamples.map(example => `\`\`\`bash\n${example}\n\`\`\``).join('\n\n');
    }

    getCommandDescription(command) {
        const descriptions = {
            'parse': 'Parse and extract data from log files',
            'extract': 'Extract specific provider protocol data',
            'classify': 'Classify log entries by provider protocol',
            'visualize': 'Generate interactive timeline visualization',
            'generate': 'Generate visualization output files',
            'export': 'Export data in various formats',
            'query': 'Query and filter data',
            'report': 'Generate analysis reports',
            'alerts': 'Show active alerts',
            'update': 'Update configuration settings',
            'rollback': 'Rollback to previous configuration',
            'validate': 'Validate configuration files',
            'backup': 'Create configuration backups',
            'start': 'Start the service or dashboard',
            'stop': 'Stop the running service',
            'status': 'Show service status',
            'help': 'Show help information'
        };
        
        return descriptions[command] || 'Command description not available';
    }

    getRelatedTools(category) {
        const related = Array.from(this.tools.entries())
            .filter(([name, info]) => info.category === category)
            .map(([name]) => `- ${name}`)
            .join('\n');
            
        return related || 'No related tools found';
    }

    createMasterHelpDocument() {
        const toolsByCategory = {};
        
        for (const [toolName, toolInfo] of this.tools) {
            if (!toolsByCategory[toolInfo.category]) {
                toolsByCategory[toolInfo.category] = [];
            }
            toolsByCategory[toolInfo.category].push({ name: toolName, ...toolInfo });
        }
        
        return `# Claude Code Router v3.0 - Tools Ecosystem Help

## Overview
Comprehensive tools ecosystem for Claude Code Router v3.0 with ${this.tools.size} integrated tools providing data processing, visualization, monitoring, and configuration management capabilities.

## Available Tools by Category

${Object.entries(toolsByCategory).map(([category, tools]) => `
### ${category.charAt(0).toUpperCase() + category.slice(1)}
${tools.map(tool => `- **${tool.name}**: ${tool.description}`).join('\n')}
`).join('\n')}

## Global Configuration
Configuration file location: \`${path.join(this.config.baseDir, this.config.toolsConfigFile)}\`

## Quick Start
\`\`\`bash
# Show help for any tool
node <tool-path> help

# List all available tools
node tools-config-manager.js list

# Get tool-specific configuration
node tools-config-manager.js config --tool <tool-name>

# Generate fresh help documentation
node tools-config-manager.js generate-docs
\`\`\`

## Tool Categories

### Data Processing
Tools for log parsing, data extraction, and classification
- Supports multiple provider protocols (Anthropic, OpenAI, Gemini, CodeWhisperer)
- JSON standardization and metadata generation
- Comprehensive data organization and storage

### Visualization  
Interactive visualization tools for API timelines and data analysis
- Multi-colored timeline displays with provider-specific color schemes
- Configurable quantity limits and time range filtering
- Export capabilities (HTML, JSON, CSV)

### Monitoring
Real-time monitoring and alerting systems
- Finish reason tracking and pattern analysis
- Configurable alert thresholds and notification systems
- Historical trend analysis and distribution reporting

### Configuration
Dynamic configuration management and dashboard interfaces
- Real-time configuration updates without service restart
- Web-based monitoring dashboards with system metrics
- Configuration validation, backup, and rollback capabilities

## Configuration Management

All tools share a unified configuration system:
- Central configuration file: \`tools-config.json\`  
- Environment-specific overrides supported
- Configuration validation and default value management
- Automatic backup and rollback capabilities

## Help System

Each tool provides comprehensive help documentation:
- Command-line \`--help\` flag support
- Detailed usage examples and configuration options
- Generated markdown documentation files
- Interactive help system with tool discovery

## Support

For tool-specific help:
\`\`\`bash
node <tool-path> help
\`\`\`

For configuration management:
\`\`\`bash  
node tools-config-manager.js help
\`\`\`

---
*Claude Code Router v3.0 Tools Ecosystem*  
*Generated: ${new Date().toISOString()}*  
*Tools: ${this.tools.size} | Categories: ${Object.keys(toolsByCategory).length}*
`;
    }

    async getToolConfiguration(toolName) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        const config = this.configurations.get(toolName);
        const toolInfo = this.tools.get(toolName);
        
        if (!config || !toolInfo) {
            throw new Error(`Tool '${toolName}' not found`);
        }
        
        return {
            tool: toolName,
            config,
            schema: toolInfo.configSchema,
            info: toolInfo
        };
    }

    async updateToolConfiguration(toolName, updates) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        const currentConfig = this.configurations.get(toolName);
        if (!currentConfig) {
            throw new Error(`Tool '${toolName}' not found`);
        }
        
        // Validate updates against schema
        const toolInfo = this.tools.get(toolName);
        if (toolInfo.configSchema) {
            this.validateConfigUpdates(updates, toolInfo.configSchema);
        }
        
        // Apply updates
        const updatedConfig = { ...currentConfig, ...updates };
        updatedConfig.lastUpdated = new Date().toISOString();
        
        this.configurations.set(toolName, updatedConfig);
        
        // Save to disk
        await this.saveConfiguration();
        
        this.emit('configurationUpdated', { tool: toolName, updates });
        
        return updatedConfig;
    }

    validateConfigUpdates(updates, schema) {
        for (const [key, value] of Object.entries(updates)) {
            if (schema[key]) {
                const expectedType = schema[key].type;
                const actualType = Array.isArray(value) ? 'array' : typeof value;
                
                if (expectedType !== actualType) {
                    throw new Error(`Invalid type for ${key}: expected ${expectedType}, got ${actualType}`);
                }
            }
        }
    }

    async validateAllConfigurations() {
        const results = [];
        
        for (const [toolName, config] of this.configurations) {
            try {
                const toolInfo = this.tools.get(toolName);
                if (toolInfo.configSchema) {
                    this.validateConfigUpdates(config, toolInfo.configSchema);
                }
                results.push({ tool: toolName, valid: true });
            } catch (error) {
                results.push({ tool: toolName, valid: false, error: error.message });
            }
        }
        
        return results;
    }

    async showHelp(toolName = null) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        if (toolName) {
            const helpDoc = this.helpDocs.get(toolName);
            if (!helpDoc) {
                throw new Error(`Help documentation for '${toolName}' not found`);
            }
            return helpDoc;
        } else {
            return this.helpDocs.get('master');
        }
    }

    // CLI Interface  
    async runCLI(args = []) {
        const command = args[0];
        
        switch (command) {
            case 'list':
                return await this.handleListCommand(args.slice(1));
            case 'config':
                return await this.handleConfigCommand(args.slice(1));
            case 'update-config':
                return await this.handleUpdateConfigCommand(args.slice(1));
            case 'generate-docs':
                return await this.handleGenerateDocsCommand(args.slice(1));
            case 'validate':
                return await this.handleValidateCommand(args.slice(1));
            case 'help':
            default:
                return await this.handleHelpCommand(args.slice(1));
        }
    }

    async handleListCommand(args) {
        if (!this.initialized) await this.initialize();
        
        console.log(`\n🔧 Claude Code Router v3.0 - Available Tools (${this.tools.size})\n`);
        
        const categories = {};
        for (const [name, info] of this.tools) {
            if (!categories[info.category]) {
                categories[info.category] = [];
            }
            categories[info.category].push({ name, ...info });
        }
        
        for (const [category, tools] of Object.entries(categories)) {
            console.log(`📁 ${category.toUpperCase()}`);
            tools.forEach(tool => {
                const enabled = this.configurations.get(tool.name)?.enabled ? '✅' : '❌';
                console.log(`   ${enabled} ${tool.name.padEnd(25)} ${tool.description}`);
            });
            console.log('');
        }
        
        return { tools: Array.from(this.tools.keys()), categories: Object.keys(categories) };
    }

    async handleConfigCommand(args) {
        const toolName = args[args.indexOf('--tool') + 1] || null;
        
        if (!toolName) {
            console.log('Usage: config --tool <tool-name>');
            return { error: 'Tool name required' };
        }
        
        try {
            const config = await this.getToolConfiguration(toolName);
            
            console.log(`\n⚙️ Configuration for ${toolName}\n`);
            console.log(JSON.stringify(config.config, null, 2));
            
            if (config.schema) {
                console.log(`\n📋 Configuration Schema:\n`);
                for (const [key, schema] of Object.entries(config.schema)) {
                    console.log(`${key} (${schema.type}): ${schema.description}`);
                    if (schema.default !== undefined) {
                        console.log(`   Default: ${JSON.stringify(schema.default)}`);
                    }
                    console.log('');
                }
            }
            
            return config;
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return { error: error.message };
        }
    }

    async handleUpdateConfigCommand(args) {
        const toolName = args[args.indexOf('--tool') + 1] || null;
        const key = args[args.indexOf('--key') + 1] || null;
        const value = args[args.indexOf('--value') + 1] || null;
        
        if (!toolName || !key || value === null) {
            console.log('Usage: update-config --tool <tool-name> --key <config-key> --value <config-value>');
            return { error: 'Missing required parameters' };
        }
        
        try {
            let parsedValue = value;
            
            // Try to parse as JSON for complex values
            try {
                parsedValue = JSON.parse(value);
            } catch {
                // Use string value if JSON parsing fails
            }
            
            const result = await this.updateToolConfiguration(toolName, { [key]: parsedValue });
            
            console.log(`✅ Updated ${toolName} configuration:`);
            console.log(`   ${key} = ${JSON.stringify(parsedValue)}`);
            
            return result;
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return { error: error.message };
        }
    }

    async handleGenerateDocsCommand(args) {
        try {
            await this.generateHelpDocumentation();
            
            console.log(`✅ Help documentation regenerated for ${this.tools.size} tools`);
            console.log(`📍 Location: ${path.join(this.config.baseDir, this.config.helpDocsDir)}`);
            
            return { 
                status: 'generated', 
                toolCount: this.tools.size,
                location: path.join(this.config.baseDir, this.config.helpDocsDir)
            };
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return { error: error.message };
        }
    }

    async handleValidateCommand(args) {
        try {
            const results = await this.validateAllConfigurations();
            
            console.log(`\n🔍 Configuration Validation Results\n`);
            
            const valid = results.filter(r => r.valid);
            const invalid = results.filter(r => !r.valid);
            
            if (valid.length > 0) {
                console.log(`✅ Valid Configurations (${valid.length}):`);
                valid.forEach(result => {
                    console.log(`   ✅ ${result.tool}`);
                });
            }
            
            if (invalid.length > 0) {
                console.log(`\n❌ Invalid Configurations (${invalid.length}):`);
                invalid.forEach(result => {
                    console.log(`   ❌ ${result.tool}: ${result.error}`);
                });
            }
            
            console.log(`\n📊 Summary: ${valid.length}/${results.length} configurations valid`);
            
            return { valid: valid.length, invalid: invalid.length, results };
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return { error: error.message };
        }
    }

    async handleHelpCommand(args) {
        const toolName = args[0] || null;
        
        try {
            const helpContent = await this.showHelp(toolName);
            console.log(helpContent);
            return { help: helpContent };
        } catch (error) {
            console.log(`
🔧 Claude Code Router v3.0 - Tools Configuration Manager

Usage: tools-config-manager.js <command> [options]

Commands:
  list                    List all available tools
  config --tool <name>    Show configuration for a specific tool
  update-config           Update tool configuration
    --tool <name>         Tool name
    --key <key>           Configuration key
    --value <value>       Configuration value
  generate-docs           Regenerate help documentation
  validate                Validate all tool configurations
  help [tool-name]        Show help (optionally for specific tool)

Examples:
  tools-config-manager.js list
  tools-config-manager.js config --tool log-parser
  tools-config-manager.js update-config --tool timeline-visualizer --key maxCalls --value 100
  tools-config-manager.js generate-docs
  tools-config-manager.js validate
  tools-config-manager.js help finish-reason-tracker
            `);
            return { command: 'help' };
        }
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const manager = new ToolsConfigManager();
    
    manager.runCLI(process.argv.slice(2))
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

export default ToolsConfigManager;