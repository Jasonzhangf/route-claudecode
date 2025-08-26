"use strict";
/**
 * Pipeline管理器核心实现
 *
 * 负责Pipeline的创建、执行、监控和销毁
 *
 * RCC v4.0 架构更新:
 * - 初始化时创建所有流水线 (Provider.Model.APIKey组合)
 * - 每条流水线在初始化时完成握手连接
 * - Runtime状态管理和零Fallback策略
 *
 * @author Jason Zhang
 * @author RCC v4.0
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineManager = void 0;
const events_1 = require("events");
const secure_logger_1 = require("../utils/secure-logger");
const jq_json_handler_1 = require("../utils/jq-json-handler");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * Pipeline管理器
 */
class PipelineManager extends events_1.EventEmitter {
    constructor(factory, systemConfig) {
        super();
        this.pipelines = new Map();
        this.activeExecutions = new Map();
        this.isInitialized = false;
        this.configName = '';
        this.configFile = '';
        this.port = 0;
        this.factory = factory;
        this.systemConfig = systemConfig;
    }
    /**
     * 初始化流水线系统 - 从Routing Table创建所有流水线 (RCC v4.0)
     */
    async initializeFromRoutingTable(routingTable, configInfo) {
        secure_logger_1.secureLogger.info('🔧 Initializing all pipelines from routing table...');
        if (this.isInitialized) {
            secure_logger_1.secureLogger.warn('⚠️  Pipeline Manager already initialized');
            return;
        }
        // 验证路由表
        if (!routingTable || !routingTable.routes) {
            throw new Error('Invalid routing table: routes property is missing or undefined');
        }
        // 设置配置信息
        if (configInfo) {
            this.configName = configInfo.name;
            this.configFile = configInfo.file;
            this.port = configInfo.port || 0;
        }
        const createdPipelines = [];
        const seenProviderModels = new Set();
        try {
            for (const [virtualModel, routes] of Object.entries(routingTable.routes)) {
                for (const route of routes) {
                    // 从pipelineId中解析targetModel信息
                    // pipelineId格式: provider-targetModel-keyN
                    const pipelineIdParts = route.pipelineId.split('-');
                    const targetModel = pipelineIdParts.length >= 2 ? pipelineIdParts.slice(1, -1).join('-') : 'unknown';
                    const providerModel = `${route.provider}-${targetModel}`;
                    // 避免重复创建相同的Provider.Model流水线
                    if (seenProviderModels.has(providerModel)) {
                        continue;
                    }
                    seenProviderModels.add(providerModel);
                    if (!this.systemConfig?.providerTypes?.[route.provider]) {
                        throw new Error(`Provider type '${route.provider}' not found in system config`);
                    }
                    const providerType = this.systemConfig.providerTypes[route.provider];
                    // 新架构中每个PipelineRoute对应一个流水线（已包含apiKeyIndex）
                    const pipelineId = route.pipelineId;
                    secure_logger_1.secureLogger.info(`  🔨 Creating pipeline: ${pipelineId}`);
                    secure_logger_1.secureLogger.info(`     - Virtual Model: ${virtualModel}`);
                    secure_logger_1.secureLogger.info(`     - Provider: ${route.provider}`);
                    secure_logger_1.secureLogger.info(`     - Target Model: ${targetModel}`);
                    secure_logger_1.secureLogger.info(`     - API Key Index: ${route.apiKeyIndex}`);
                    // 创建完整的4层流水线
                    const completePipeline = await this.createCompletePipeline({
                        pipelineId,
                        virtualModel,
                        provider: route.provider,
                        targetModel: targetModel,
                        apiKey: `api-key-${route.apiKeyIndex}`, // 从配置中获取实际的API key
                        // 🐛 关键修复：必须使用用户配置的apiBaseUrl，确保所有provider内容来自配置文件
                        endpoint: route.apiBaseUrl || (() => {
                            throw new Error(`Missing api_base_url for provider ${route.provider}. All endpoint information must come from user config.`);
                        })(),
                        transformer: providerType.transformer,
                        protocol: providerType.protocol,
                        // 🐛 关键修复：使用路由中的实际serverCompatibility而不是系统默认值
                        serverCompatibility: route.serverCompatibility || providerType.serverCompatibility
                    });
                    // 执行握手连接
                    secure_logger_1.secureLogger.info(`  🤝 Handshaking pipeline: ${pipelineId}`);
                    await completePipeline.handshake();
                    // 标记为runtime状态
                    completePipeline.status = 'runtime';
                    this.pipelines.set(pipelineId, completePipeline);
                    createdPipelines.push(pipelineId);
                    secure_logger_1.secureLogger.info(`  ✅ Pipeline ready: ${pipelineId}`);
                }
            }
            this.isInitialized = true;
            secure_logger_1.secureLogger.info(`🎉 All ${this.pipelines.size} pipelines initialized and ready`);
            // 保存流水线表到generated目录
            try {
                await this.savePipelineTableToGenerated();
                secure_logger_1.secureLogger.info('✅ Pipeline table saved to generated directory');
            }
            catch (error) {
                secure_logger_1.secureLogger.error('❌ Failed to save pipeline table:', { error: error.message });
            }
            // 保存流水线表到debug-logs目录 (用于调试)
            try {
                await this.savePipelineTableToDebugLogs();
                secure_logger_1.secureLogger.info('✅ Pipeline table saved to debug-logs directory');
            }
            catch (error) {
                secure_logger_1.secureLogger.error('❌ Failed to save pipeline table to debug-logs:', { error: error.message });
            }
            this.emit('pipelineSystemInitialized', {
                totalPipelines: this.pipelines.size,
                createdPipelines,
                timestamp: new Date()
            });
        }
        catch (error) {
            secure_logger_1.secureLogger.error('❌ Pipeline system initialization failed:', { error: error.message });
            // 清理已创建的流水线
            for (const pipelineId of createdPipelines) {
                await this.destroyPipeline(pipelineId).catch(() => { }); // 忽略清理错误
            }
            this.emit('pipelineSystemInitializationFailed', { error: error.message, timestamp: new Date() });
            throw error;
        }
    }
    /**
     * 创建完整流水线 (Provider.Model.APIKey组合)
     */
    async createCompletePipeline(config) {
        secure_logger_1.secureLogger.info(`🏗️  Creating complete pipeline: ${config.pipelineId}`);
        // 根据Provider类型创建对应的流水线
        let standardPipeline;
        if (config.provider === 'lmstudio') {
            standardPipeline = await this.factory.createLMStudioPipeline(config.targetModel);
        }
        else if (config.provider === 'openai') {
            standardPipeline = await this.factory.createOpenAIPipeline(config.targetModel);
        }
        else if (config.provider === 'anthropic') {
            standardPipeline = await this.factory.createAnthropicPipeline(config.targetModel);
        }
        else {
            // 使用通用方法创建
            const pipelineConfig = {
                id: config.pipelineId,
                name: `${config.provider} Pipeline - ${config.targetModel}`,
                description: `Complete pipeline for ${config.provider}.${config.targetModel}`,
                provider: config.provider,
                model: config.targetModel,
                modules: [], // 模块将由factory根据provider类型填充
                settings: {
                    parallel: false,
                    failFast: true,
                    timeout: 60000,
                    retryPolicy: {
                        enabled: true,
                        maxRetries: 3,
                        backoffMultiplier: 2,
                        initialDelay: 1000,
                        maxDelay: 10000,
                        retryableErrors: ['TIMEOUT', 'CONNECTION_ERROR', 'RATE_LIMIT']
                    },
                    errorHandling: {
                        stopOnFirstError: true,
                        allowPartialSuccess: false,
                        errorRecovery: false,
                        fallbackStrategies: []
                    },
                    logging: {
                        enabled: true,
                        level: 'info',
                        includeInput: false,
                        includeOutput: false,
                        maskSensitiveData: true,
                        maxLogSize: 1024 * 1024
                    },
                    monitoring: {
                        enabled: true,
                        collectMetrics: true,
                        performanceTracking: true,
                        alerting: {
                            enabled: false,
                            thresholds: {
                                errorRate: 0.1,
                                responseTime: 5000,
                                throughput: 10
                            },
                            channels: []
                        }
                    }
                }
            };
            standardPipeline = await this.factory.createStandardPipeline(pipelineConfig);
        }
        // 包装成CompletePipeline接口
        const completePipeline = {
            pipelineId: config.pipelineId,
            virtualModel: config.virtualModel,
            provider: config.provider,
            targetModel: config.targetModel,
            apiKey: config.apiKey,
            transformer: standardPipeline.getModule('transformer') || standardPipeline.getAllModules()[0],
            protocol: standardPipeline.getModule('protocol') || standardPipeline.getAllModules()[1],
            serverCompatibility: standardPipeline.getModule('serverCompatibility') || standardPipeline.getAllModules()[2],
            server: standardPipeline.getModule('server') || standardPipeline.getAllModules()[3],
            // 🐛 关键修复：存储实际使用的配置信息
            serverCompatibilityName: config.serverCompatibility,
            transformerName: config.transformer,
            protocolName: config.protocol,
            endpoint: config.endpoint,
            status: 'initializing',
            lastHandshakeTime: new Date(),
            async execute(request) {
                secure_logger_1.secureLogger.info(`🔄 Pipeline ${this.pipelineId} executing request`);
                try {
                    // 使用StandardPipeline的execute方法，它已经实现了完整的4层处理
                    const response = await standardPipeline.execute(request, {
                        metadata: {
                            requestId: `req_${Date.now()}`,
                            pipelineId: this.pipelineId,
                            provider: this.provider,
                            model: this.targetModel,
                            priority: 'normal'
                        }
                    });
                    secure_logger_1.secureLogger.info(`  ✅ Pipeline ${this.pipelineId} execution completed`);
                    return response;
                }
                catch (error) {
                    secure_logger_1.secureLogger.error(`  ❌ Pipeline ${this.pipelineId} execution failed:`, { error: error.message });
                    throw error;
                }
            },
            async handshake() {
                secure_logger_1.secureLogger.info(`🤝 Handshaking pipeline ${this.pipelineId}`);
                try {
                    // 启动StandardPipeline，这会初始化所有模块
                    await standardPipeline.start();
                    // 验证连接
                    const healthCheck = await this.healthCheck();
                    if (!healthCheck) {
                        throw new Error(`Pipeline ${this.pipelineId} handshake failed`);
                    }
                    this.lastHandshakeTime = new Date();
                    secure_logger_1.secureLogger.info(`✅ Pipeline ${this.pipelineId} handshake completed`);
                }
                catch (error) {
                    secure_logger_1.secureLogger.error(`❌ Pipeline ${this.pipelineId} handshake failed:`, { error: error.message });
                    this.status = 'error';
                    throw error;
                }
            },
            async healthCheck() {
                try {
                    // 使用StandardPipeline的状态检查
                    const status = standardPipeline.getStatus();
                    return status.status === 'running';
                }
                catch (error) {
                    secure_logger_1.secureLogger.error(`Health check failed for pipeline ${this.pipelineId}:`, { error: error.message });
                    return false;
                }
            },
            getStatus() {
                // 使用StandardPipeline的状态，转换为CompletePipeline需要的格式
                const baseStatus = standardPipeline.getStatus();
                return {
                    id: this.pipelineId,
                    name: this.pipelineId,
                    status: baseStatus.status,
                    modules: {}, // 简化模块状态
                    uptime: Date.now() - this.lastHandshakeTime.getTime(),
                    performance: {
                        requestsProcessed: baseStatus.totalRequests,
                        averageProcessingTime: baseStatus.averageResponseTime,
                        errorRate: baseStatus.totalRequests > 0 ? baseStatus.errorRequests / baseStatus.totalRequests : 0,
                        throughput: baseStatus.totalRequests
                    }
                };
            },
            async stop() {
                secure_logger_1.secureLogger.info(`🛑 Stopping pipeline ${this.pipelineId}`);
                try {
                    await standardPipeline.stop();
                    this.status = 'stopped';
                    secure_logger_1.secureLogger.info(`✅ Pipeline ${this.pipelineId} stopped`);
                }
                catch (error) {
                    secure_logger_1.secureLogger.error(`❌ Pipeline ${this.pipelineId} stop failed:`, { error: error.message });
                    this.status = 'error';
                    throw error;
                }
            }
        };
        return completePipeline;
    }
    /**
     * 检查系统是否已初始化
     */
    isSystemInitialized() {
        return this.isInitialized;
    }
    /**
     * 创建Pipeline (传统方法，保留向后兼容)
     */
    async createPipeline(config) {
        try {
            const pipeline = await this.factory.createStandardPipeline(config);
            // 创建一个临时的CompletePipeline包装器以保持类型一致性
            const completePipelineWrapper = {
                pipelineId: config.id,
                virtualModel: 'legacy',
                provider: config.provider,
                targetModel: config.model,
                apiKey: 'legacy-key',
                transformer: pipeline.getAllModules()[0],
                protocol: pipeline.getAllModules()[1] || pipeline.getAllModules()[0],
                serverCompatibility: pipeline.getAllModules()[2] || pipeline.getAllModules()[0],
                server: pipeline.getAllModules()[3] || pipeline.getAllModules()[0],
                // 配置信息（legacy默认值）
                serverCompatibilityName: 'generic',
                transformerName: 'legacy-transformer',
                protocolName: 'legacy-protocol',
                endpoint: 'legacy-endpoint',
                status: 'runtime',
                lastHandshakeTime: new Date(),
                async execute(request) {
                    return await pipeline.execute(request);
                },
                async handshake() {
                    await pipeline.start();
                },
                async healthCheck() {
                    const status = pipeline.getStatus();
                    return status.status === 'running';
                },
                getStatus() {
                    const baseStatus = pipeline.getStatus();
                    return {
                        id: config.id,
                        name: config.name,
                        status: baseStatus.status,
                        modules: {},
                        uptime: 0,
                        performance: {
                            requestsProcessed: baseStatus.totalRequests,
                            averageProcessingTime: baseStatus.averageResponseTime,
                            errorRate: 0,
                            throughput: 0
                        }
                    };
                },
                async stop() {
                    await pipeline.stop();
                }
            };
            this.pipelines.set(config.id, completePipelineWrapper);
            this.emit('pipelineCreated', { pipelineId: config.id, config });
            return config.id;
        }
        catch (error) {
            this.emit('pipelineCreationFailed', { config, error });
            throw error;
        }
    }
    /**
     * 销毁Pipeline
     */
    async destroyPipeline(pipelineId) {
        const pipeline = this.pipelines.get(pipelineId);
        if (!pipeline) {
            return false;
        }
        try {
            // 取消所有活跃的执行
            const activeExecutions = Array.from(this.activeExecutions.values())
                .filter(execution => execution.pipelineId === pipelineId);
            for (const execution of activeExecutions) {
                await this.cancelExecution(execution.id);
            }
            // 停止Pipeline
            await pipeline.stop();
            // 清理资源
            this.pipelines.delete(pipelineId);
            this.emit('pipelineDestroyed', { pipelineId });
            return true;
        }
        catch (error) {
            this.emit('pipelineDestructionFailed', { pipelineId, error });
            throw error;
        }
    }
    /**
     * 获取Pipeline
     */
    getPipeline(pipelineId) {
        return this.pipelines.get(pipelineId) || null;
    }
    /**
     * 获取所有Pipeline
     */
    getAllPipelines() {
        return new Map(this.pipelines);
    }
    /**
     * 执行Pipeline
     */
    async executePipeline(pipelineId, input, context) {
        const pipeline = this.pipelines.get(pipelineId);
        if (!pipeline) {
            throw new Error(`Pipeline ${pipelineId} not found`);
        }
        const executionId = this.generateExecutionId();
        const executionRecord = {
            id: executionId,
            pipelineId,
            requestId: context.requestId,
            startTime: new Date(),
            status: 'running',
            moduleExecutions: []
        };
        this.activeExecutions.set(executionId, executionRecord);
        try {
            this.emit('executionStarted', { executionId, pipelineId, context });
            const result = await pipeline.execute(input);
            executionRecord.endTime = new Date();
            executionRecord.status = 'completed';
            executionRecord.totalTime = executionRecord.endTime.getTime() - executionRecord.startTime.getTime();
            const executionResult = {
                executionId,
                status: 'success',
                result,
                executionRecord,
                performance: this.calculatePerformanceMetrics(executionRecord)
            };
            this.emit('executionCompleted', { executionResult });
            this.activeExecutions.delete(executionId);
            return executionResult;
        }
        catch (error) {
            executionRecord.endTime = new Date();
            executionRecord.status = 'failed';
            executionRecord.error = error;
            executionRecord.totalTime = executionRecord.endTime.getTime() - executionRecord.startTime.getTime();
            const executionResult = {
                executionId,
                status: 'failure',
                error: error,
                executionRecord,
                performance: this.calculatePerformanceMetrics(executionRecord)
            };
            this.emit('executionFailed', { executionResult });
            this.activeExecutions.delete(executionId);
            throw error;
        }
    }
    /**
     * 取消执行
     */
    async cancelExecution(executionId) {
        const execution = this.activeExecutions.get(executionId);
        if (!execution) {
            return false;
        }
        const pipeline = this.pipelines.get(execution.pipelineId);
        if (!pipeline) {
            return false;
        }
        try {
            execution.status = 'cancelled';
            execution.endTime = new Date();
            execution.totalTime = execution.endTime.getTime() - execution.startTime.getTime();
            this.emit('executionCancelled', { executionId });
            this.activeExecutions.delete(executionId);
            return true;
        }
        catch (error) {
            this.emit('executionCancellationFailed', { executionId, error });
            return false;
        }
    }
    /**
     * 获取Pipeline状态
     */
    getPipelineStatus(pipelineId) {
        const pipeline = this.pipelines.get(pipelineId);
        if (!pipeline) {
            return null;
        }
        return pipeline.getStatus();
    }
    /**
     * 获取所有Pipeline状态
     */
    getAllPipelineStatus() {
        const status = {};
        for (const [pipelineId, pipeline] of this.pipelines) {
            status[pipelineId] = pipeline.getStatus();
        }
        return status;
    }
    /**
     * 获取活跃执行
     */
    getActiveExecutions() {
        return Array.from(this.activeExecutions.values());
    }
    /**
     * 获取Pipeline执行历史
     */
    getExecutionHistory(pipelineId) {
        const pipeline = this.pipelines.get(pipelineId);
        if (!pipeline) {
            return [];
        }
        // CompletePipeline接口没有getExecutionHistory方法，返回空数组
        // 实际的执行历史记录由PipelineManager在activeExecutions中维护
        return [];
    }
    /**
     * 健康检查
     */
    async healthCheck() {
        const issues = [];
        let healthyPipelines = 0;
        for (const [pipelineId, pipeline] of this.pipelines) {
            try {
                const status = pipeline.getStatus();
                if (status.status === 'running') {
                    healthyPipelines++;
                }
                else {
                    issues.push(`Pipeline ${pipelineId} is in ${status.status} status`);
                }
            }
            catch (error) {
                issues.push(`Pipeline ${pipelineId} health check failed: ${error}`);
            }
        }
        return {
            healthy: issues.length === 0,
            pipelines: this.pipelines.size,
            activeExecutions: this.activeExecutions.size,
            issues
        };
    }
    /**
     * 设置Pipeline事件监听器
     */
    setupPipelineEventListeners(pipeline, pipelineId) {
        // CompletePipeline wrapper不需要事件监听器设置
        // 事件将由StandardPipeline内部处理
    }
    /**
     * 生成执行ID
     */
    generateExecutionId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * 计算性能指标
     */
    calculatePerformanceMetrics(execution) {
        const modulesTiming = {};
        let totalTime = execution.totalTime || 0;
        let errorCount = 0;
        for (const moduleExecution of execution.moduleExecutions) {
            if (moduleExecution.processingTime) {
                modulesTiming[moduleExecution.moduleId] = moduleExecution.processingTime;
            }
            if (moduleExecution.status === 'failed') {
                errorCount++;
            }
        }
        return {
            totalTime,
            modulesTiming,
            memoryUsage: {
                peak: process.memoryUsage().heapUsed,
                average: process.memoryUsage().heapUsed
            },
            cpuUsage: {
                peak: process.cpuUsage().system / 1000000, // 转换为毫秒
                average: process.cpuUsage().user / 1000000 // 转换为毫秒
            },
            throughput: totalTime > 0 ? 1000 / totalTime : 0,
            errorCount
        };
    }
    /**
     * 保存流水线表到generated目录
     */
    async savePipelineTableToGenerated() {
        const generatedDir = path.join(os.homedir(), '.route-claudecode', 'config', 'generated');
        // 确保generated目录存在
        if (!fs.existsSync(generatedDir)) {
            fs.mkdirSync(generatedDir, { recursive: true });
        }
        // 生成流水线表数据
        const pipelineTableData = this.generatePipelineTableData();
        // 保存文件路径：configName-pipeline-table.json
        const fileName = this.configName
            ? `${this.configName}-pipeline-table.json`
            : `default-pipeline-table.json`;
        const filePath = path.join(generatedDir, fileName);
        // 写入文件
        fs.writeFileSync(filePath, jq_json_handler_1.JQJsonHandler.stringifyJson(pipelineTableData, false), 'utf8');
        secure_logger_1.secureLogger.info('📋 Pipeline table saved', {
            file: filePath,
            totalPipelines: pipelineTableData.totalPipelines,
            configName: this.configName
        });
    }
    /**
     * 生成流水线表数据
     */
    generatePipelineTableData() {
        const allPipelines = [];
        const pipelinesGroupedByModel = {};
        for (const [pipelineId, pipeline] of this.pipelines) {
            const entry = {
                pipelineId,
                virtualModel: pipeline.virtualModel,
                provider: pipeline.provider,
                targetModel: pipeline.targetModel,
                apiKeyIndex: this.extractApiKeyIndex(pipelineId),
                endpoint: this.extractEndpoint(pipeline),
                status: pipeline.status,
                createdAt: pipeline.lastHandshakeTime.toISOString(),
                handshakeTime: pipeline.lastHandshakeTime ? Date.now() - pipeline.lastHandshakeTime.getTime() : undefined,
                // 添加4层架构详细信息
                architecture: this.extractArchitectureDetails(pipeline)
            };
            allPipelines.push(entry);
            // 按模型分组
            if (!pipelinesGroupedByModel[pipeline.virtualModel]) {
                pipelinesGroupedByModel[pipeline.virtualModel] = [];
            }
            pipelinesGroupedByModel[pipeline.virtualModel].push(entry);
        }
        return {
            configName: this.configName,
            configFile: this.configFile,
            generatedAt: new Date().toISOString(),
            totalPipelines: allPipelines.length,
            pipelinesGroupedByVirtualModel: pipelinesGroupedByModel,
            allPipelines
        };
    }
    /**
     * 从流水线ID提取API Key索引
     */
    extractApiKeyIndex(pipelineId) {
        const match = pipelineId.match(/-key(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
    }
    /**
     * 从流水线提取endpoint信息
     */
    extractEndpoint(pipeline) {
        // 从系统配置中获取endpoint信息
        const providerType = this.systemConfig?.providerTypes?.[pipeline.provider];
        return providerType?.endpoint || 'unknown';
    }
    /**
     * 提取4层架构详细信息
     */
    extractArchitectureDetails(pipeline) {
        // 辅助函数：将模块状态转换为字符串
        const getModuleStatusString = (module) => {
            if (!module || !module.getStatus) {
                return 'runtime';
            }
            try {
                const status = module.getStatus();
                // 如果status是对象，提取status字段；如果是字符串/枚举，直接使用
                if (typeof status === 'object' && status.status) {
                    return String(status.status);
                }
                else {
                    return String(status);
                }
            }
            catch (error) {
                return 'runtime';
            }
        };
        return {
            transformer: {
                id: pipeline.transformer?.getId?.() || `${pipeline.provider}-transformer`,
                // 🐛 关键修复：使用存储在pipeline中的实际transformer名称
                name: pipeline.transformerName || 'anthropic-to-openai-transformer',
                type: 'transformer',
                status: getModuleStatusString(pipeline.transformer)
            },
            protocol: {
                id: pipeline.protocol?.getId?.() || `${pipeline.provider}-protocol`,
                // 🐛 关键修复：使用存储在pipeline中的实际protocol名称
                name: pipeline.protocolName || 'openai-protocol-handler',
                type: 'protocol',
                status: getModuleStatusString(pipeline.protocol)
            },
            serverCompatibility: {
                id: pipeline.serverCompatibility?.getId?.() || `${pipeline.provider}-compatibility`,
                // 🐛 关键修复：使用存储在pipeline中的实际serverCompatibility名称
                name: pipeline.serverCompatibilityName || `${pipeline.provider}-compatibility-handler`,
                type: 'serverCompatibility',
                status: getModuleStatusString(pipeline.serverCompatibility)
            },
            server: {
                id: pipeline.server?.getId?.() || `${pipeline.provider}-server`,
                name: `${pipeline.provider}-server`,
                type: 'server',
                status: getModuleStatusString(pipeline.server),
                // 🐛 关键修复：使用存储在pipeline中的实际endpoint
                endpoint: pipeline.endpoint
            }
        };
    }
    /**
     * 保存流水线表到debug-logs目录 (按端口分组)
     */
    async savePipelineTableToDebugLogs() {
        if (!this.port) {
            secure_logger_1.secureLogger.warn('⚠️  No port specified, skipping debug-logs save');
            return;
        }
        const debugLogsDir = path.join(os.homedir(), '.route-claudecode', 'debug-logs', `port-${this.port}`);
        // 确保debug-logs目录存在
        if (!fs.existsSync(debugLogsDir)) {
            fs.mkdirSync(debugLogsDir, { recursive: true });
        }
        // 生成debug版本的流水线表数据 (包含更多调试信息)
        const debugPipelineTableData = this.generateDebugPipelineTableData();
        // 保存文件路径：时间+配置名称格式
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
        const fileName = this.configName
            ? `${timestamp}_${this.configName}-pipeline-table.json`
            : `${timestamp}_default-pipeline-table.json`;
        const filePath = path.join(debugLogsDir, fileName);
        // 写入文件
        fs.writeFileSync(filePath, jq_json_handler_1.JQJsonHandler.stringifyJson(debugPipelineTableData, false), 'utf8');
        secure_logger_1.secureLogger.info('🐛 Debug pipeline table saved', {
            file: filePath,
            port: this.port,
            totalPipelines: debugPipelineTableData.totalPipelines,
            configName: this.configName
        });
    }
    /**
     * 生成debug版本的流水线表数据 (包含更多调试信息)
     */
    generateDebugPipelineTableData() {
        const basicData = this.generatePipelineTableData();
        // 计算总握手时间
        const totalHandshakeTime = Array.from(this.pipelines.values())
            .reduce((total, pipeline) => {
            const handshakeTime = pipeline.lastHandshakeTime ? Date.now() - pipeline.lastHandshakeTime.getTime() : 0;
            return total + handshakeTime;
        }, 0);
        return {
            ...basicData,
            debugInfo: {
                port: this.port,
                initializationStartTime: new Date().toISOString(),
                initializationEndTime: new Date().toISOString(),
                initializationDuration: 0, // 将在实际使用时计算
                systemConfig: {
                    providerTypes: Object.keys(this.systemConfig?.providerTypes || {}),
                    transformersCount: Object.keys(this.systemConfig?.transformers || {}).length,
                    serverCompatibilityModulesCount: Object.keys(this.systemConfig?.serverCompatibilityModules || {}).length
                },
                totalHandshakeTime
            }
        };
    }
}
exports.PipelineManager = PipelineManager;
//# sourceMappingURL=pipeline-manager.js.map