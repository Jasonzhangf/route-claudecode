/**
 * Mock Server Configuration
 * Mock Server的配置管理
 * @author Jason Zhang
 * @version v3.0-refactor
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export class MockServerConfig {
    constructor(config = {}) {
        this.config = this.mergeWithDefaults(config);
        this.configPath = config.configPath || path.join(os.homedir(), '.route-claudecode', 'mock-server-config.json');
        
        console.log('⚙️  Mock Server Config initialized');
    }
    
    /**
     * 合并默认配置
     */
    mergeWithDefaults(userConfig) {
        const defaultConfig = {
            // 服务器配置
            server: {
                port: 3458,
                host: 'localhost',
                cors: true,
                maxRequestSize: 50 * 1024 * 1024, // 50MB
                timeout: 30000 // 30秒
            },
            
            // 数据库路径
            database: {
                basePath: path.join(os.homedir(), '.route-claudecode', 'database'),
                scenarioPath: path.join(os.homedir(), '.route-claudecode', 'database', 'replay', 'scenarios')
            },
            
            // 数据重放配置
            dataReplay: {
                cacheEnabled: true,
                maxCacheSize: 1000,
                compressionEnabled: false
            },
            
            // 场景管理配置
            scenarios: {
                autoSave: true,
                maxActiveScenarios: 5,
                defaultScenarios: [
                    'full-replay',
                    'anthropic-only',
                    'recent-24h',
                    'fast-replay'
                ]
            },
            
            // 响应模拟配置
            simulation: {
                defaultDelay: { min: 100, max: 2000 },
                preserveTiming: true,
                replaySpeed: 1.0,
                randomization: 0.1,
                errorInjectionRate: 0.02
            },
            
            // Provider模拟配置
            providers: {
                enabled: ['anthropic', 'openai', 'gemini', 'codewhisperer'],
                behaviors: {
                    anthropic: {
                        averageLatency: { min: 800, max: 3000 },
                        tokenEfficiency: 0.9,
                        errorRate: 0.01,
                        specialFeatures: ['tool_use', 'long_context', 'vision']
                    },
                    openai: {
                        averageLatency: { min: 500, max: 2500 },
                        tokenEfficiency: 0.85,
                        errorRate: 0.015,
                        specialFeatures: ['function_calling', 'code_interpreter', 'vision']
                    },
                    gemini: {
                        averageLatency: { min: 600, max: 2800 },
                        tokenEfficiency: 0.88,
                        errorRate: 0.02,
                        specialFeatures: ['multimodal', 'code_execution', 'search']
                    },
                    codewhisperer: {
                        averageLatency: { min: 300, max: 1500 },
                        tokenEfficiency: 0.95,
                        errorRate: 0.005,
                        specialFeatures: ['code_completion', 'security_scan', 'optimization']
                    }
                }
            },
            
            // 日志配置
            logging: {
                level: 'info',
                file: path.join(os.homedir(), '.route-claudecode', 'logs', 'mock-server.log'),
                console: true,
                json: false
            },
            
            // 监控配置
            monitoring: {
                enabled: true,
                metricsInterval: 60000, // 1分钟
                healthCheck: {
                    enabled: true,
                    interval: 30000 // 30秒
                }
            },
            
            // Web控制面板配置
            webControlPanel: {
                enabled: true,
                path: '/management',
                authRequired: false,
                refreshInterval: 5000
            }
        };
        
        return this.deepMerge(defaultConfig, userConfig);
    }
    
    /**
     * 深度合并配置对象
     */
    deepMerge(target, source) {
        const result = JSON.parse(JSON.stringify(target));
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }
    
    /**
     * 加载配置文件
     */
    async loadConfig() {
        try {
            const configContent = await fs.readFile(this.configPath, 'utf8');
            const fileConfig = JSON.parse(configContent);
            
            this.config = this.mergeWithDefaults(fileConfig);
            
            console.log(`✅ Loaded configuration from: ${this.configPath}`);
            return this.config;
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('ℹ️  No configuration file found, using defaults');
                await this.saveConfig(); // 创建默认配置文件
            } else {
                console.error('❌ Failed to load configuration:', error.message);
                throw error;
            }
            
            return this.config;
        }
    }
    
    /**
     * 保存配置文件
     */
    async saveConfig() {
        try {
            // 确保目录存在
            const configDir = path.dirname(this.configPath);
            await fs.mkdir(configDir, { recursive: true });
            
            // 保存配置
            await fs.writeFile(
                this.configPath,
                JSON.stringify(this.config, null, 2),
                'utf8'
            );
            
            console.log(`💾 Saved configuration to: ${this.configPath}`);
            
        } catch (error) {
            console.error('❌ Failed to save configuration:', error.message);
            throw error;
        }
    }
    
    /**
     * 更新配置
     */
    async updateConfig(updates) {
        this.config = this.deepMerge(this.config, updates);
        
        try {
            await this.saveConfig();
            console.log('🔄 Configuration updated successfully');
            return this.config;
        } catch (error) {
            console.error('❌ Failed to update configuration:', error.message);
            throw error;
        }
    }
    
    /**
     * 获取配置值
     */
    get(keyPath, defaultValue = null) {
        const keys = keyPath.split('.');
        let current = this.config;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }
        
        return current;
    }
    
    /**
     * 设置配置值
     */
    set(keyPath, value) {
        const keys = keyPath.split('.');
        const lastKey = keys.pop();
        let current = this.config;
        
        for (const key of keys) {
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[lastKey] = value;
    }
    
    /**
     * 获取服务器配置
     */
    getServerConfig() {
        return this.config.server;
    }
    
    /**
     * 获取数据库配置
     */
    getDatabaseConfig() {
        return this.config.database;
    }
    
    /**
     * 获取数据重放配置
     */
    getDataReplayConfig() {
        return this.config.dataReplay;
    }
    
    /**
     * 获取场景配置
     */
    getScenarioConfig() {
        return this.config.scenarios;
    }
    
    /**
     * 获取模拟配置
     */
    getSimulationConfig() {
        return this.config.simulation;
    }
    
    /**
     * 获取Provider配置
     */
    getProviderConfig() {
        return this.config.providers;
    }
    
    /**
     * 获取特定Provider的配置
     */
    getProviderBehavior(providerType) {
        return this.config.providers.behaviors[providerType] || null;
    }
    
    /**
     * 获取日志配置
     */
    getLoggingConfig() {
        return this.config.logging;
    }
    
    /**
     * 获取监控配置
     */
    getMonitoringConfig() {
        return this.config.monitoring;
    }
    
    /**
     * 获取Web控制面板配置
     */
    getWebControlPanelConfig() {
        return this.config.webControlPanel;
    }
    
    /**
     * 验证配置
     */
    validateConfig() {
        const errors = [];
        
        // 验证必需的配置
        const requiredPaths = [
            'server.port',
            'server.host',
            'database.basePath',
            'providers.enabled'
        ];
        
        for (const path of requiredPaths) {
            if (this.get(path) === null) {
                errors.push(`Missing required configuration: ${path}`);
            }
        }
        
        // 验证端口范围
        const port = this.get('server.port');
        if (port && (port < 1024 || port > 65535)) {
            errors.push('Server port must be between 1024 and 65535');
        }
        
        // 验证Provider配置
        const enabledProviders = this.get('providers.enabled', []);
        const availableProviders = Object.keys(this.get('providers.behaviors', {}));
        
        for (const provider of enabledProviders) {
            if (!availableProviders.includes(provider)) {
                errors.push(`Provider "${provider}" is enabled but not configured`);
            }
        }
        
        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\\n${errors.join('\\n')}`);
        }
        
        console.log('✅ Configuration validation passed');
        return true;
    }
    
    /**
     * 重置为默认配置
     */
    resetToDefaults() {
        this.config = this.mergeWithDefaults({});
        console.log('🔄 Configuration reset to defaults');
    }
    
    /**
     * 获取完整配置
     */
    getAllConfig() {
        return JSON.parse(JSON.stringify(this.config));
    }
    
    /**
     * 导出配置为JSON
     */
    exportConfig(filePath) {
        return fs.writeFile(filePath, JSON.stringify(this.config, null, 2), 'utf8');
    }
    
    /**
     * 从JSON文件导入配置
     */
    async importConfig(filePath) {
        try {
            const configContent = await fs.readFile(filePath, 'utf8');
            const importedConfig = JSON.parse(configContent);
            
            this.config = this.mergeWithDefaults(importedConfig);
            
            console.log(`📥 Imported configuration from: ${filePath}`);
            return this.config;
            
        } catch (error) {
            console.error('❌ Failed to import configuration:', error.message);
            throw error;
        }
    }
    
    /**
     * 创建环境特定配置
     */
    createEnvironmentConfig(environment = 'development') {
        const envConfig = JSON.parse(JSON.stringify(this.config));
        
        switch (environment) {
            case 'development':
                envConfig.server.port = 3458;
                envConfig.simulation.errorInjectionRate = 0.05;
                envConfig.logging.level = 'debug';
                break;
                
            case 'testing':
                envConfig.server.port = 3459;
                envConfig.simulation.replaySpeed = 10.0;
                envConfig.simulation.errorInjectionRate = 0.1;
                envConfig.logging.level = 'warn';
                break;
                
            case 'production':
                envConfig.server.port = 3457;
                envConfig.simulation.errorInjectionRate = 0.0;
                envConfig.logging.level = 'error';
                break;
        }
        
        return envConfig;
    }
    
    /**
     * 获取配置摘要
     */
    getConfigSummary() {
        return {
            server: {
                address: `http://${this.config.server.host}:${this.config.server.port}`,
                cors: this.config.server.cors
            },
            database: this.config.database.basePath,
            enabledProviders: this.config.providers.enabled,
            activeScenarios: this.config.scenarios.maxActiveScenarios,
            cacheEnabled: this.config.dataReplay.cacheEnabled,
            loggingLevel: this.config.logging.level
        };
    }
}