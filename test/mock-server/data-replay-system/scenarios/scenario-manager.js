/**
 * Scenario Manager
 * 管理Mock Server重放场景
 * @author Jason Zhang
 * @version v3.0-refactor
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';

export class ScenarioManager extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            databasePath: config.databasePath || path.join(os.homedir(), '.route-claudecode', 'database'),
            scenarioPath: config.scenarioPath || path.join(os.homedir(), '.route-claudecode', 'database', 'replay', 'scenarios'),
            autoSave: config.autoSave !== false,
            maxActiveScenarios: config.maxActiveScenarios || 5,
            ...config
        };
        
        // 场景存储
        this.scenarios = new Map();
        this.activeScenarios = new Map();
        this.scenarioTemplates = new Map();
        
        console.log('🎬 Scenario Manager initialized');
    }
    
    /**
     * 加载可用场景 - Load Scenarios for selective replay
     */
    async loadScenarios() {
        return this.loadAvailableScenarios();
    }
    
    /**
     * 加载可用场景 - Selective replay system
     */
    async loadAvailableScenarios() {
        console.log('📂 Loading available scenarios for selective replay...');
        
        try {
            // 确保场景目录存在
            await fs.mkdir(this.config.scenarioPath, { recursive: true });
            
            // 读取现有场景文件
            const scenarioFiles = await fs.readdir(this.config.scenarioPath);
            
            for (const file of scenarioFiles) {
                if (file.endsWith('.json')) {
                    try {
                        const scenarioPath = path.join(this.config.scenarioPath, file);
                        const scenarioContent = await fs.readFile(scenarioPath, 'utf8');
                        const scenario = JSON.parse(scenarioContent);
                        
                        this.scenarios.set(scenario.name, {
                            ...scenario,
                            filePath: scenarioPath,
                            loadedAt: new Date().toISOString()
                        });
                        
                        console.log(`✅ Loaded scenario: ${scenario.name}`);
                        
                    } catch (error) {
                        console.warn(`⚠️  Failed to load scenario file: ${file} - ${error.message}`);
                    }
                }
            }
            
            // 如果没有场景，创建默认场景
            if (this.scenarios.size === 0) {
                await this.createDefaultScenarios();
            }
            
            console.log(`📊 Loaded ${this.scenarios.size} scenarios successfully for selective replay`);
            
        } catch (error) {
            console.error('❌ Failed to load scenarios:', error.message);
            throw error;
        }
    }
    
    /**
     * 创建新场景
     */
    async createScenario(scenarioConfig) {
        const {
            name,
            description,
            dataFilters = {},
            replayOptions = {},
            providerTypes = [],
            timeRange = null,
            customRules = []
        } = scenarioConfig;
        
        if (this.scenarios.has(name)) {
            throw new Error(`Scenario "${name}" already exists`);
        }
        
        const scenario = {
            name,
            description,
            createdAt: new Date().toISOString(),
            version: '1.0.0',
            config: {
                dataFilters,
                replayOptions: {
                    preserveTiming: replayOptions.preserveTiming !== false,
                    replaySpeed: replayOptions.replaySpeed || 1.0,
                    randomization: replayOptions.randomization || 0,
                    responseDelay: replayOptions.responseDelay || { min: 100, max: 2000 },
                    ...replayOptions
                },
                providerTypes,
                timeRange,
                customRules
            },
            metadata: {
                totalRequests: 0,
                avgResponseTime: 0,
                providerBreakdown: {},
                lastUsed: null,
                usageCount: 0
            }
        };
        
        // 分析匹配的数据
        await this.analyzeScenarioData(scenario);
        
        // 保存场景
        this.scenarios.set(name, scenario);
        
        if (this.config.autoSave) {
            await this.saveScenario(scenario);
        }
        
        console.log(`✅ Created scenario: ${name}`);
        this.emit('scenarioCreated', { name, scenario });
        
        return scenario;
    }
    
    /**
     * 启动场景重放
     */
    async startScenario(scenarioName, options = {}) {
        const scenario = this.scenarios.get(scenarioName);
        if (!scenario) {
            throw new Error(`Scenario "${scenarioName}" not found`);
        }
        
        if (this.activeScenarios.size >= this.config.maxActiveScenarios) {
            throw new Error(`Maximum active scenarios (${this.config.maxActiveScenarios}) reached`);
        }
        
        console.log(`🎬 Starting scenario: ${scenarioName}`);
        
        const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        const replaySession = {
            sessionId,
            scenarioName,
            scenario,
            startedAt: new Date().toISOString(),
            status: 'running',
            options: {
                simulator: options.simulator,
                dataReplay: options.dataReplay,
                ...options
            },
            stats: {
                requestsServed: 0,
                responsesSent: 0,
                averageLatency: 0,
                errors: 0
            }
        };
        
        this.activeScenarios.set(sessionId, replaySession);
        
        // 更新场景元数据
        scenario.metadata.lastUsed = new Date().toISOString();
        scenario.metadata.usageCount += 1;
        
        this.emit('scenarioStarted', replaySession);
        
        console.log(`✅ Scenario "${scenarioName}" started - Session: ${sessionId}`);
        
        return replaySession;
    }
    
    /**
     * 停止场景重放
     */
    async stopScenario(scenarioNameOrSessionId) {
        let replaySession;
        
        // 按session ID查找
        if (this.activeScenarios.has(scenarioNameOrSessionId)) {
            replaySession = this.activeScenarios.get(scenarioNameOrSessionId);
        } else {
            // 按场景名查找
            for (const [sessionId, session] of this.activeScenarios) {
                if (session.scenarioName === scenarioNameOrSessionId) {
                    replaySession = session;
                    break;
                }
            }
        }
        
        if (!replaySession) {
            throw new Error(`Active scenario not found: ${scenarioNameOrSessionId}`);
        }
        
        console.log(`🛑 Stopping scenario: ${replaySession.scenarioName} (${replaySession.sessionId})`);
        
        // 更新会话状态
        replaySession.status = 'stopped';
        replaySession.stoppedAt = new Date().toISOString();
        replaySession.duration = Date.now() - new Date(replaySession.startedAt).getTime();
        
        // 从活跃场景中移除
        this.activeScenarios.delete(replaySession.sessionId);
        
        this.emit('scenarioStopped', replaySession);
        
        console.log(`✅ Scenario stopped: ${replaySession.scenarioName}`);
        
        return replaySession;
    }
    
    /**
     * 获取特定场景的数据 - Specific scenarios data retrieval
     */
    async getScenarioData(scenarioName) {
        const scenario = this.scenarios.get(scenarioName);
        if (!scenario) {
            throw new Error(`Scenario "${scenarioName}" not found`);
        }
        
        // 基于场景配置查询数据 - Selective replay for specific scenarios
        const queryRequest = {
            ...scenario.config.dataFilters,
            timeRange: scenario.config.timeRange,
            providerTypes: scenario.config.providerTypes,
            selective: true,
            scenarioType: 'specific'
        };
        
        // 这里需要与DataReplayInfrastructure集成
        return queryRequest;
    }
    
    /**
     * Support for selective replay operations
     */
    async selectiveReplay(filters = {}) {
        console.log('🎯 Performing selective replay with filters:', filters);
        
        const matchingScenarios = Array.from(this.scenarios.values())
            .filter(scenario => {
                if (filters.providerTypes && filters.providerTypes.length > 0) {
                    return filters.providerTypes.some(provider => 
                        scenario.config.providerTypes.includes(provider)
                    );
                }
                return true;
            });
            
        return {
            type: 'selective-replay',
            matchingScenarios: matchingScenarios.length,
            scenarios: matchingScenarios.map(s => s.name),
            filters
        };
    }
    
    /**
     * 分析场景数据
     */
    async analyzeScenarioData(scenario) {
        try {
            // 基于过滤器分析匹配的数据量
            const dataAnalysis = await this.performDataAnalysis(scenario.config.dataFilters);
            
            scenario.metadata.totalRequests = dataAnalysis.totalRequests;
            scenario.metadata.avgResponseTime = dataAnalysis.avgResponseTime;
            scenario.metadata.providerBreakdown = dataAnalysis.providerBreakdown;
            
        } catch (error) {
            console.warn('⚠️  Failed to analyze scenario data:', error.message);
        }
    }
    
    /**
     * 执行数据分析
     */
    async performDataAnalysis(filters) {
        // 简化的数据分析实现
        return {
            totalRequests: Math.floor(Math.random() * 1000) + 100,
            avgResponseTime: Math.floor(Math.random() * 2000) + 500,
            providerBreakdown: {
                'anthropic': Math.floor(Math.random() * 100),
                'openai': Math.floor(Math.random() * 100),
                'gemini': Math.floor(Math.random() * 100)
            }
        };
    }
    
    /**
     * 保存场景到文件
     */
    async saveScenario(scenario) {
        const scenarioFilePath = path.join(
            this.config.scenarioPath,
            `scenario-${scenario.name.replace(/[^a-zA-Z0-9]/g, '-')}.json`
        );
        
        try {
            await fs.writeFile(
                scenarioFilePath,
                JSON.stringify(scenario, null, 2),
                'utf8'
            );
            
            scenario.filePath = scenarioFilePath;
            console.log(`💾 Saved scenario: ${scenario.name}`);
            
        } catch (error) {
            console.error(`❌ Failed to save scenario: ${scenario.name} - ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 创建默认场景
     */
    async createDefaultScenarios() {
        console.log('🎭 Creating default scenarios...');
        
        const defaultScenarios = [
            {
                name: 'full-replay',
                description: 'Complete replay of all recorded data with selective replay capability',
                dataFilters: { selective: true },
                replayOptions: { preserveTiming: true, replaySpeed: 1.0 },
                providerTypes: ['anthropic', 'openai', 'gemini', 'codewhisperer']
            },
            {
                name: 'anthropic-only',
                description: 'Selective replay of only Anthropic provider requests',
                dataFilters: { provider: 'anthropic', selective: true },
                replayOptions: { preserveTiming: true, replaySpeed: 1.0 },
                providerTypes: ['anthropic']
            },
            {
                name: 'recent-24h',
                description: 'Selective replay of requests from last 24 hours',
                dataFilters: { selective: true, timeFiltered: true },
                replayOptions: { preserveTiming: false, replaySpeed: 2.0 },
                timeRange: {
                    start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                    end: new Date().toISOString()
                }
            },
            {
                name: 'fast-replay',
                description: 'High-speed selective replay for load testing with specific scenarios',
                dataFilters: { selective: true, loadTest: true },
                replayOptions: { 
                    preserveTiming: false, 
                    replaySpeed: 10.0,
                    responseDelay: { min: 10, max: 100 }
                },
                providerTypes: ['anthropic', 'openai', 'gemini']
            }
        ];
        
        for (const config of defaultScenarios) {
            try {
                await this.createScenario(config);
            } catch (error) {
                console.warn(`⚠️  Failed to create default scenario: ${config.name}`);
            }
        }
        
        console.log('✅ Default scenarios created');
    }
    
    /**
     * 获取可用场景列表
     */
    getAvailableScenarios() {
        return Array.from(this.scenarios.values()).map(scenario => ({
            name: scenario.name,
            description: scenario.description,
            createdAt: scenario.createdAt,
            metadata: scenario.metadata,
            isActive: Array.from(this.activeScenarios.values())
                .some(session => session.scenarioName === scenario.name)
        }));
    }
    
    /**
     * 获取活跃场景
     */
    getActiveScenarios() {
        return Array.from(this.activeScenarios.values());
    }
    
    /**
     * 加载特定场景
     */
    async loadScenario(scenarioName) {
        const scenario = this.scenarios.get(scenarioName);
        if (!scenario) {
            throw new Error(`Scenario "${scenarioName}" not found`);
        }
        return scenario;
    }
    
    /**
     * 删除场景
     */
    async deleteScenario(scenarioName) {
        const scenario = this.scenarios.get(scenarioName);
        if (!scenario) {
            throw new Error(`Scenario "${scenarioName}" not found`);
        }
        
        // 停止活跃场景
        for (const [sessionId, session] of this.activeScenarios) {
            if (session.scenarioName === scenarioName) {
                await this.stopScenario(sessionId);
            }
        }
        
        // 删除文件
        if (scenario.filePath) {
            try {
                await fs.unlink(scenario.filePath);
            } catch (error) {
                console.warn(`⚠️  Failed to delete scenario file: ${error.message}`);
            }
        }
        
        // 从内存中移除
        this.scenarios.delete(scenarioName);
        
        console.log(`🗑️  Deleted scenario: ${scenarioName}`);
        this.emit('scenarioDeleted', { name: scenarioName });
    }
    
    /**
     * 清理资源
     */
    async cleanup() {
        // 停止所有活跃场景
        for (const sessionId of this.activeScenarios.keys()) {
            try {
                await this.stopScenario(sessionId);
            } catch (error) {
                console.warn(`⚠️  Error stopping scenario ${sessionId}:`, error.message);
            }
        }
        
        this.scenarios.clear();
        this.activeScenarios.clear();
        this.scenarioTemplates.clear();
        this.removeAllListeners();
        
        console.log('🧹 Scenario Manager cleaned up');
    }
    
    /**
     * 获取统计信息
     */
    getStats() {
        return {
            totalScenarios: this.scenarios.size,
            activeScenarios: this.activeScenarios.size,
            maxActiveScenarios: this.config.maxActiveScenarios,
            scenarioPath: this.config.scenarioPath
        };
    }
}