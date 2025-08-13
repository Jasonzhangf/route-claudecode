/**
 * Mock Server System - Entry Point
 * Comprehensive mock server for replaying recorded scenarios
 * @author Jason Zhang
 * @version v3.0-refactor
 */

import { EventEmitter } from 'events';
import { MockServerCore } from './core/mock-server-core.js';
import { DataReplayInfrastructure } from './replay/data-replay-infrastructure.js';
import { ScenarioManager } from './scenarios/scenario-manager.js';
import { ResponseSimulator } from './simulation/response-simulator.js';
import { ProviderSimulation } from './providers/provider-simulation.js';
import { WebControlPanel } from './management/web-control-panel.js';
import { MockServerConfig } from './config/mock-server-config.js';

export class MockServer extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = new MockServerConfig(config);
        this.sessionId = this.generateSessionId();
        
        // 初始化核心组件
        this.core = new MockServerCore(this.config);
        this.dataReplay = new DataReplayInfrastructure(this.config);
        this.scenarioManager = new ScenarioManager(this.config);
        this.responseSimulator = new ResponseSimulator(this.config);
        this.providerSimulation = new ProviderSimulation(this.config);
        this.webControlPanel = new WebControlPanel(this, this.config.get('webControlPanel', {}));
        
        this.isRunning = false;
        this.currentScenario = null;
        this.startTime = null;
        this.isInitialized = false;
        
        console.log(`📡 Mock Server initialized - Session: ${this.sessionId}`);
    }
    
    /**
     * 初始化Mock Server - Required management method
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('⚠️  Mock Server already initialized');
            return;
        }
        
        console.log('🔧 Initializing Mock Server...');
        
        try {
            // 1. 初始化数据重放基础设施
            await this.dataReplay.initialize();
            
            // 2. 加载可用场景
            await this.scenarioManager.loadAvailableScenarios();
            
            // 3. 初始化Provider模拟
            await this.providerSimulation.initialize();
            
            // 4. 初始化Web控制面板
            await this.webControlPanel.initialize();
            
            this.isInitialized = true;
            
            console.log('✅ Mock Server initialized successfully');
            
            return {
                sessionId: this.sessionId,
                initialized: true,
                scenarios: this.scenarioManager.getAvailableScenarios().length,
                status: 'initialized'
            };
            
        } catch (error) {
            console.error('❌ Failed to initialize Mock Server:', error.message);
            throw error;
        }
    }
    
    /**
     * 启动Mock Server - Enhanced management method
     */
    async start(options = {}) {
        if (this.isRunning) {
            throw new Error('Mock Server is already running');
        }
        
        console.log('🚀 Starting Mock Server...');
        
        try {
            // 1. 初始化数据重放基础设施
            await this.dataReplay.initialize();
            
            // 2. 加载可用场景
            await this.scenarioManager.loadAvailableScenarios();
            
            // 3. 初始化Provider模拟
            await this.providerSimulation.initialize();
            
            // 4. 启动核心服务器
            await this.core.start({
                port: options.port || this.config.get('server.port'),
                host: options.host || this.config.get('server.host')
            });
            
            // 5. 初始化Web控制面板
            await this.webControlPanel.initialize();
            
            this.isRunning = true;
            this.startTime = Date.now();
            
            console.log(`✅ Mock Server started successfully`);
            console.log(`   📍 Address: http://${this.core.host}:${this.core.port}`);
            console.log(`   🎭 Available scenarios: ${this.scenarioManager.getAvailableScenarios().length}`);
            console.log(`   🎛️ Control Panel: http://${this.core.host}:${this.core.port}/management`);
            
            return {
                sessionId: this.sessionId,
                address: `http://${this.core.host}:${this.core.port}`,
                scenarios: this.scenarioManager.getAvailableScenarios().length,
                status: 'running'
            };
            
        } catch (error) {
            console.error('❌ Failed to start Mock Server:', error.message);
            throw error;
        }
    }
    
    /**
     * 停止Mock Server
     */
    async stop() {
        if (!this.isRunning) {
            console.log('⚠️  Mock Server is not running');
            return;
        }
        
        console.log('🛑 Stopping Mock Server...');
        
        try {
            // 1. 停止当前场景重放
            if (this.currentScenario) {
                await this.scenarioManager.stopScenario(this.currentScenario);
            }
            
            // 2. 停止核心服务器
            await this.core.stop();
            
            // 3. 清理资源
            await this.cleanup();
            
            this.isRunning = false;
            this.currentScenario = null;
            this.startTime = null;
            
            console.log('✅ Mock Server stopped successfully');
            
            return {
                sessionId: this.sessionId,
                stopped: true,
                status: 'stopped'
            };
            
        } catch (error) {
            console.error('❌ Error stopping Mock Server:', error.message);
            throw error;
        }
    }
    
    /**
     * 启动场景重放
     */
    async startScenario(scenarioName, options = {}) {
        if (!this.isRunning) {
            throw new Error('Mock Server must be running to start scenarios');
        }
        
        console.log(`🎬 Starting scenario: ${scenarioName}`);
        
        try {
            const scenario = await this.scenarioManager.loadScenario(scenarioName);
            
            // 配置响应模拟器
            this.responseSimulator.configureForScenario(scenario, options);
            
            // 启动场景
            const replaySession = await this.scenarioManager.startScenario(scenario, {
                simulator: this.responseSimulator,
                dataReplay: this.dataReplay,
                ...options
            });
            
            this.currentScenario = scenarioName;
            
            console.log(`✅ Scenario "${scenarioName}" started - Session: ${replaySession.sessionId}`);
            
            return replaySession;
            
        } catch (error) {
            console.error(`❌ Failed to start scenario "${scenarioName}":`, error.message);
            throw error;
        }
    }
    
    /**
     * 获取Mock Server状态 - Enhanced management method
     */
    getStatus() {
        return {
            sessionId: this.sessionId,
            isRunning: this.isRunning,
            isInitialized: this.isInitialized,
            currentScenario: this.currentScenario,
            address: this.isRunning ? `http://${this.core.host}:${this.core.port}` : null,
            scenarios: {
                available: this.scenarioManager.getAvailableScenarios().length,
                current: this.currentScenario
            },
            uptime: this.isRunning && this.startTime ? Date.now() - this.startTime : 0,
            webControlPanel: this.webControlPanel.getStatus(),
            managementCapabilities: {
                initialize: typeof this.initialize === 'function',
                start: typeof this.start === 'function', 
                stop: typeof this.stop === 'function',
                getStatus: typeof this.getStatus === 'function'
            }
        };
    }
    
    /**
     * 清理资源
     */
    async cleanup() {
        await this.webControlPanel.cleanup();
        await this.dataReplay.cleanup();
        await this.scenarioManager.cleanup();
        await this.responseSimulator.cleanup();
        await this.providerSimulation.cleanup();
    }
    
    /**
     * 生成会话ID
     */
    generateSessionId() {
        return `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// 导出主要类和工厂函数
export { MockServerCore } from './core/mock-server-core.js';
export { DataReplayInfrastructure } from './replay/data-replay-infrastructure.js';
export { ScenarioManager } from './scenarios/scenario-manager.js';
export { ResponseSimulator } from './simulation/response-simulator.js';
export { ProviderSimulation } from './providers/provider-simulation.js';
export { WebControlPanel } from './management/web-control-panel.js';
export { MockServerConfig } from './config/mock-server-config.js';

/**
 * 创建Mock Server实例的便捷函数
 */
export function createMockServer(config = {}) {
    return new MockServer(config);
}