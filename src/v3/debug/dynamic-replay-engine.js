/**
 * 🎭 Dynamic Data-Driven Replay Engine - v3.0 Architecture
 * 
 * 完全基于录制数据库数据的动态回放引擎
 * 不包含任何写死内容，完全从实际录制的数据文件中动态加载和回放
 * 
 * Features:
 * - 100%基于真实录制数据的动态加载
 * - 完整的六层架构数据流重现
 * - 工具调用真实结果动态匹配
 * - 客户端行为基于实际录制时序
 * - 支持断点续传和部分回放
 * 
 * @author Jason Zhang
 * @version v3.0-dynamic
 * @created 2025-08-13
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

/**
 * 动态数据驱动回放引擎
 * 完全基于数据库录制数据的回放系统
 */
export class DynamicReplayEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.replayId = uuidv4();
        this.databasePath = path.join(os.homedir(), '.route-claudecode', 'database');
        this.outputPath = path.join(this.databasePath, 'replay', 'dynamic-output');
        
        // 回放状态
        this.state = 'idle';
        this.currentSessionId = null;
        this.currentStep = 0;
        this.totalSteps = 0;
        this.replaySpeed = 1.0;
        
        // 动态数据管理
        this.dataLoader = new DatabaseDataLoader(this.databasePath);
        this.sessionData = null;
        this.layerRecords = new Map(); // 层级记录映射
        this.toolCallResults = new Map(); // 工具调用结果映射
        this.interactionTimeline = []; // 交互时间线
        
        // 配置选项
        this.options = {
            strictDataMode: true, // 严格数据模式，只使用录制数据
            preserveTimestamp: true, // 保持原始时间戳
            replayFromStep: options.replayFromStep || 0, // 从指定步骤开始回放
            onlyReplayLayers: options.onlyReplayLayers || null, // 只回放指定层级
            ...options
        };
        
        this.initializeEngine();
    }
    
    /**
     * 初始化动态回放引擎
     */
    initializeEngine() {
        console.log(`🎭 初始化动态数据驱动回放引擎`);
        console.log(`   数据库路径: ${this.databasePath}`);
        console.log(`   严格数据模式: ${this.options.strictDataMode}`);
        
        // 确保输出目录存在
        if (!fs.existsSync(this.outputPath)) {
            fs.mkdirSync(this.outputPath, { recursive: true });
        }
        
        // 初始化数据加载器
        this.dataLoader.initialize();
    }
    
    /**
     * 开始动态数据回放
     * @param {string} sessionId - 会话ID
     * @param {object} config - 回放配置
     */
    async startDynamicReplay(sessionId, config = {}) {
        try {
            console.log(`🎬 开始动态数据回放: ${sessionId}`);
            
            this.state = 'running';
            this.currentSessionId = sessionId;
            this.emit('replayStarted', { sessionId, replayId: this.replayId });
            
            // 1. 动态加载会话数据
            console.log(`📚 步骤1: 动态加载会话数据`);
            this.sessionData = await this.dataLoader.loadSessionData(sessionId);
            if (!this.sessionData) {
                throw new Error(`未找到会话数据: ${sessionId}`);
            }
            
            // 2. 构建数据映射和时间线
            console.log(`🗺️ 步骤2: 构建数据映射和交互时间线`);
            await this.buildDataMappingsFromRecords();
            
            // 3. 执行动态回放
            console.log(`▶️ 步骤3: 执行基于真实数据的动态回放`);
            const replayResult = await this.executeDynamicReplay(config);
            
            this.state = 'completed';
            this.emit('replayCompleted', replayResult);
            
            console.log(`✅ 动态数据回放完成`);
            console.log(`   会话: ${sessionId}`);
            console.log(`   总交互: ${replayResult.totalInteractions}`);
            console.log(`   数据覆盖率: ${replayResult.dataCoverageRate}%`);
            
            return replayResult;
            
        } catch (error) {
            this.state = 'error';
            this.emit('replayError', { error: error.message, sessionId });
            console.error(`❌ 动态回放失败:`, error);
            throw error;
        }
    }
    
    /**
     * 从录制数据构建数据映射和时间线
     */
    async buildDataMappingsFromRecords() {
        const records = this.sessionData.records;
        console.log(`🔍 分析 ${records.length} 条录制记录`);
        
        // 清空映射
        this.layerRecords.clear();
        this.toolCallResults.clear();
        this.interactionTimeline = [];
        
        // 加载每个记录的详细数据
        for (const record of records) {
            const detailData = await this.dataLoader.loadRecordDetail(record);
            if (!detailData) {
                console.warn(`⚠️ 跳过无法加载的记录: ${record.recordId}`);
                continue;
            }
            
            // 构建层级记录映射
            const layerKey = `${record.layer}-${record.operation}`;
            if (!this.layerRecords.has(layerKey)) {
                this.layerRecords.set(layerKey, []);
            }
            this.layerRecords.get(layerKey).push({
                ...record,
                detailData
            });
            
            // 提取和注册工具调用结果
            await this.extractAndRegisterToolCalls(record, detailData);
            
            // 构建时间线
            this.interactionTimeline.push({
                timestamp: detailData.timestamp || record.timestamp || new Date().toISOString(),
                recordId: record.recordId,
                layer: record.layer,
                operation: record.operation,
                data: detailData.data,
                metadata: detailData.metadata
            });
        }
        
        // 按时间戳排序时间线
        this.interactionTimeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        this.totalSteps = this.interactionTimeline.length;
        
        console.log(`✅ 数据映射构建完成`);
        console.log(`   层级映射: ${this.layerRecords.size} 个层级`);
        console.log(`   工具调用: ${this.toolCallResults.size} 个`);
        console.log(`   时间线: ${this.interactionTimeline.length} 个交互`);
    }
    
    /**
     * 提取和注册工具调用
     * @param {object} record - 记录元信息
     * @param {object} detailData - 详细数据
     */
    async extractAndRegisterToolCalls(record, detailData) {
        if (!detailData.data) return;
        
        // 查找工具调用
        const toolCalls = this.findToolCallsInData(detailData.data);
        for (const toolCall of toolCalls) {
            console.log(`🔧 发现工具调用: ${toolCall.name} (${toolCall.id})`);
            
            // 查找对应的工具调用结果
            const toolResult = await this.dataLoader.findToolCallResult(toolCall.id, toolCall.name);
            
            this.toolCallResults.set(toolCall.id, {
                toolCall,
                result: toolResult,
                recordId: record.recordId,
                timestamp: detailData.timestamp,
                hasRealResult: !!toolResult
            });
            
            if (toolResult) {
                console.log(`   ✅ 找到真实结果: ${toolCall.name}`);
            } else {
                console.log(`   ⚠️ 缺少结果数据: ${toolCall.name}`);
            }
        }
        
        // 查找工具调用结果（单独的结果记录）
        const toolResults = this.findToolResultsInData(detailData.data);
        for (const result of toolResults) {
            const toolCallId = result.tool_call_id || result.id;
            if (toolCallId && this.toolCallResults.has(toolCallId)) {
                const existing = this.toolCallResults.get(toolCallId);
                existing.result = result;
                existing.hasRealResult = true;
                console.log(`   ✅ 匹配工具调用结果: ${toolCallId}`);
            }
        }
    }
    
    /**
     * 在数据中查找工具调用
     * @param {object} data - 数据对象
     */
    findToolCallsInData(data) {
        const toolCalls = [];
        
        if (!data || typeof data !== 'object') return toolCalls;
        
        // 递归查找工具调用
        const searchFields = ['tool_calls', 'toolCalls', 'tools', 'function_calls'];
        
        function searchRecursively(obj) {
            if (!obj || typeof obj !== 'object') return;
            
            for (const field of searchFields) {
                if (obj[field] && Array.isArray(obj[field])) {
                    obj[field].forEach((call, index) => {
                        if (call && (call.name || call.function?.name)) {
                            toolCalls.push({
                                id: call.id || `tool-${Date.now()}-${index}`,
                                name: call.name || call.function?.name,
                                args: call.args || call.function?.arguments || call.parameters || {},
                                type: call.type || 'function'
                            });
                        }
                    });
                }
            }
            
            // 递归搜索子对象
            for (const key in obj) {
                if (obj[key] && typeof obj[key] === 'object') {
                    searchRecursively(obj[key]);
                }
            }
        }
        
        searchRecursively(data);
        return toolCalls;
    }
    
    /**
     * 在数据中查找工具调用结果
     * @param {object} data - 数据对象
     */
    findToolResultsInData(data) {
        const results = [];
        
        if (!data || typeof data !== 'object') return results;
        
        const resultFields = ['tool_results', 'toolResults', 'results', 'tool_call_results'];
        
        for (const field of resultFields) {
            if (data[field] && Array.isArray(data[field])) {
                results.push(...data[field]);
            }
        }
        
        return results;
    }
    
    /**
     * 执行动态回放
     * @param {object} config - 回放配置
     */
    async executeDynamicReplay(config) {
        const startTime = Date.now();
        const results = {
            replayId: this.replayId,
            sessionId: this.currentSessionId,
            startTime: new Date().toISOString(),
            totalInteractions: this.interactionTimeline.length,
            completedInteractions: 0,
            dynamicDataLoaded: this.layerRecords.size,
            toolCallsReplayed: 0,
            dataCoverageRate: 0,
            executionDetails: [],
            errors: []
        };
        
        console.log(`🎭 开始执行动态回放`);
        console.log(`   总交互数: ${this.interactionTimeline.length}`);
        console.log(`   回放模式: 基于真实录制数据`);
        
        // 执行每个交互
        for (let i = this.options.replayFromStep; i < this.interactionTimeline.length; i++) {
            if (this.state !== 'running') break;
            
            const interaction = this.interactionTimeline[i];
            this.currentStep = i + 1;
            
            // 检查层级过滤
            if (this.options.onlyReplayLayers && 
                !this.options.onlyReplayLayers.includes(interaction.layer)) {
                continue;
            }
            
            try {
                console.log(`🔄 [${this.currentStep}/${this.totalSteps}] ${interaction.layer}-${interaction.operation}`);
                
                const executionResult = await this.executeInteractionWithRealData(interaction);
                
                results.executionDetails.push(executionResult);
                results.completedInteractions++;
                
                if (executionResult.toolCallsReplayed > 0) {
                    results.toolCallsReplayed += executionResult.toolCallsReplayed;
                }
                
                // 保持原始时序（如果启用）
                if (this.options.preserveTimestamp && i < this.interactionTimeline.length - 1) {
                    const nextInteraction = this.interactionTimeline[i + 1];
                    const delay = this.calculateTimingDelay(interaction, nextInteraction);
                    if (delay > 0) {
                        await this.delay(delay / this.replaySpeed);
                    }
                }
                
                this.emit('interactionReplayed', {
                    interaction,
                    result: executionResult,
                    progress: (this.currentStep / this.totalSteps) * 100
                });
                
            } catch (error) {
                console.error(`❌ [${this.currentStep}] 交互回放失败:`, error.message);
                results.errors.push({
                    step: this.currentStep,
                    interaction: interaction.recordId,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        // 计算数据覆盖率
        const dataWithResults = results.executionDetails.filter(d => d.hasRealData);
        results.dataCoverageRate = results.completedInteractions > 0 
            ? (dataWithResults.length / results.completedInteractions) * 100 
            : 0;
        
        results.endTime = new Date().toISOString();
        results.totalDuration = Date.now() - startTime;
        
        // 保存回放结果
        await this.saveReplayResults(results);
        
        return results;
    }
    
    /**
     * 使用真实数据执行交互
     * @param {object} interaction - 交互对象
     */
    async executeInteractionWithRealData(interaction) {
        const executionResult = {
            recordId: interaction.recordId,
            layer: interaction.layer,
            operation: interaction.operation,
            timestamp: interaction.timestamp,
            hasRealData: !!interaction.data,
            toolCallsReplayed: 0,
            realDataUsed: true,
            executionDetails: {}
        };
        
        console.log(`   📁 使用真实录制数据: ${interaction.layer}-${interaction.operation}`);
        
        // 处理工具调用（如果有）
        if (interaction.data) {
            const toolCalls = this.findToolCallsInData(interaction.data);
            for (const toolCall of toolCalls) {
                const toolCallData = this.toolCallResults.get(toolCall.id);
                if (toolCallData && toolCallData.hasRealResult) {
                    console.log(`   🔧 重现工具调用: ${toolCall.name} -> 使用真实结果`);
                    executionResult.toolCallsReplayed++;
                    
                    if (!executionResult.executionDetails.toolCalls) {
                        executionResult.executionDetails.toolCalls = [];
                    }
                    executionResult.executionDetails.toolCalls.push({
                        toolCallId: toolCall.id,
                        toolName: toolCall.name,
                        resultSource: 'recorded-database',
                        result: toolCallData.result
                    });
                } else {
                    console.log(`   ⚠️ 工具调用缺少结果数据: ${toolCall.name}`);
                }
            }
        }
        
        // 记录原始数据信息
        executionResult.executionDetails.originalData = {
            size: JSON.stringify(interaction.data || {}).length,
            hasMetadata: !!interaction.metadata,
            dataSource: 'database-recorded'
        };
        
        return executionResult;
    }
    
    /**
     * 计算时序延迟
     * @param {object} current - 当前交互
     * @param {object} next - 下一个交互
     */
    calculateTimingDelay(current, next) {
        try {
            const currentTime = new Date(current.timestamp).getTime();
            const nextTime = new Date(next.timestamp).getTime();
            return Math.max(0, nextTime - currentTime);
        } catch (error) {
            return 0; // 如果时间戳解析失败，使用0延迟
        }
    }
    
    /**
     * 保存回放结果
     * @param {object} results - 回放结果
     */
    async saveReplayResults(results) {
        const resultsFile = path.join(
            this.outputPath,
            `dynamic-replay-${this.replayId}-${Date.now()}.json`
        );
        
        try {
            fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
            console.log(`💾 动态回放结果已保存: ${resultsFile}`);
        } catch (error) {
            console.error(`❌ 保存回放结果失败:`, error);
        }
    }
    
    /**
     * 延迟函数
     * @param {number} ms - 延迟毫秒数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 获取回放状态
     */
    getReplayStatus() {
        return {
            replayId: this.replayId,
            state: this.state,
            currentSessionId: this.currentSessionId,
            currentStep: this.currentStep,
            totalSteps: this.totalSteps,
            progress: this.totalSteps > 0 ? (this.currentStep / this.totalSteps) * 100 : 0,
            layerRecords: this.layerRecords.size,
            toolCallResults: this.toolCallResults.size,
            options: this.options
        };
    }
    
    // 控制方法
    pause() {
        if (this.state === 'running') {
            this.state = 'paused';
            this.emit('replayPaused', { replayId: this.replayId });
        }
    }
    
    resume() {
        if (this.state === 'paused') {
            this.state = 'running';
            this.emit('replayResumed', { replayId: this.replayId });
        }
    }
    
    stop() {
        this.state = 'stopped';
        this.emit('replayStopped', { replayId: this.replayId });
    }
    
    setSpeed(speed) {
        this.replaySpeed = Math.max(0.1, Math.min(10.0, speed));
    }
}

/**
 * 数据库数据加载器
 * 负责从录制数据库加载真实数据
 */
export class DatabaseDataLoader {
    constructor(databasePath) {
        this.databasePath = databasePath;
        this.layersPath = path.join(databasePath, 'layers');
        this.replayPath = path.join(databasePath, 'replay');
        this.auditPath = path.join(databasePath, 'audit');
    }
    
    /**
     * 初始化数据加载器
     */
    initialize() {
        console.log(`🔄 初始化数据库数据加载器`);
        console.log(`   数据库路径: ${this.databasePath}`);
        console.log(`   层级数据: ${this.layersPath}`);
        console.log(`   回放数据: ${this.replayPath}`);
        
        // 验证关键目录
        const dirs = [this.layersPath, this.replayPath];
        for (const dir of dirs) {
            if (fs.existsSync(dir)) {
                const fileCount = fs.readdirSync(dir).length;
                console.log(`   ✅ ${path.basename(dir)}: ${fileCount} 个文件`);
            } else {
                console.warn(`   ⚠️ 目录不存在: ${dir}`);
            }
        }
    }
    
    /**
     * 加载会话数据
     * @param {string} sessionId - 会话ID
     */
    async loadSessionData(sessionId) {
        console.log(`📚 从数据库加载会话: ${sessionId}`);
        
        const scenarioFiles = fs.readdirSync(this.replayPath)
            .filter(file => file.startsWith('scenario-') && file.endsWith('.json'));
        
        for (const file of scenarioFiles) {
            try {
                const scenarioPath = path.join(this.replayPath, file);
                const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
                
                if (scenario.sessionId === sessionId) {
                    console.log(`✅ 找到会话场景: ${file}`);
                    console.log(`   记录数: ${scenario.records?.length || 0}`);
                    return scenario;
                }
            } catch (error) {
                console.warn(`跳过损坏场景文件 ${file}:`, error.message);
            }
        }
        
        return null;
    }
    
    /**
     * 加载记录详细数据
     * @param {object} record - 记录元信息
     */
    async loadRecordDetail(record) {
        if (!record.filePath) {
            console.warn(`记录缺少文件路径: ${record.recordId}`);
            return null;
        }
        
        try {
            if (fs.existsSync(record.filePath)) {
                const detailData = JSON.parse(fs.readFileSync(record.filePath, 'utf8'));
                return detailData;
            } else {
                console.warn(`记录文件不存在: ${record.filePath}`);
                return null;
            }
        } catch (error) {
            console.warn(`加载记录详细数据失败 ${record.recordId}:`, error.message);
            return null;
        }
    }
    
    /**
     * 查找工具调用结果
     * @param {string} toolCallId - 工具调用ID
     * @param {string} toolCallName - 工具调用名称
     */
    async findToolCallResult(toolCallId, toolCallName) {
        const layerFiles = fs.readdirSync(this.layersPath);
        
        for (const file of layerFiles) {
            try {
                const filePath = path.join(this.layersPath, file);
                const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                if (fileContent.data) {
                    const results = this.findToolResultsInFileData(fileContent.data);
                    
                    for (const result of results) {
                        if ((result.tool_call_id === toolCallId) ||
                            (result.id === toolCallId) ||
                            (result.name === toolCallName)) {
                            return {
                                ...result,
                                sourceFile: file,
                                timestamp: fileContent.timestamp
                            };
                        }
                    }
                }
            } catch (error) {
                // 跳过无法解析的文件
                continue;
            }
        }
        
        return null;
    }
    
    /**
     * 在文件数据中查找工具调用结果
     * @param {object} data - 文件数据
     */
    findToolResultsInFileData(data) {
        const results = [];
        
        if (!data || typeof data !== 'object') return results;
        
        const resultFields = ['tool_results', 'toolResults', 'results', 'tool_call_results'];
        
        function searchRecursively(obj) {
            if (!obj || typeof obj !== 'object') return;
            
            for (const field of resultFields) {
                if (obj[field] && Array.isArray(obj[field])) {
                    results.push(...obj[field]);
                }
            }
            
            for (const key in obj) {
                if (obj[key] && typeof obj[key] === 'object') {
                    searchRecursively(obj[key]);
                }
            }
        }
        
        searchRecursively(data);
        return results;
    }
}

export default DynamicReplayEngine;