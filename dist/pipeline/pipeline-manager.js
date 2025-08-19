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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineManager = void 0;
const events_1 = require("events");
const secure_logger_1 = require("../utils/secure-logger");
/**
 * Pipeline管理器
 */
class PipelineManager extends events_1.EventEmitter {
    constructor(factory, systemConfig) {
        super();
        this.pipelines = new Map();
        this.activeExecutions = new Map();
        this.isInitialized = false;
        this.factory = factory;
        this.systemConfig = systemConfig;
    }
    /**
     * 初始化流水线系统 - 从Routing Table创建所有流水线 (RCC v4.0)
     */
    async initializeFromRoutingTable(routingTable) {
        secure_logger_1.secureLogger.info('🔧 Initializing all pipelines from routing table...');
        if (this.isInitialized) {
            secure_logger_1.secureLogger.warn('⚠️  Pipeline Manager already initialized');
            return;
        }
        const createdPipelines = [];
        const seenProviderModels = new Set();
        try {
            for (const [virtualModel, routes] of Object.entries(routingTable.routes)) {
                for (const route of routes) {
                    const providerModel = `${route.provider}-${route.targetModel}`;
                    // 避免重复创建相同的Provider.Model流水线
                    if (seenProviderModels.has(providerModel)) {
                        continue;
                    }
                    seenProviderModels.add(providerModel);
                    if (!this.systemConfig?.providerTypes?.[route.provider]) {
                        throw new Error(`Provider type '${route.provider}' not found in system config`);
                    }
                    const providerType = this.systemConfig.providerTypes[route.provider];
                    // 为每个APIKey创建一条独立流水线
                    for (let keyIndex = 0; keyIndex < route.apiKeys.length; keyIndex++) {
                        const pipelineId = `${route.provider}-${route.targetModel}-key${keyIndex}`;
                        secure_logger_1.secureLogger.info(`  🔨 Creating pipeline: ${pipelineId}`);
                        secure_logger_1.secureLogger.info(`     - Virtual Model: ${virtualModel}`);
                        secure_logger_1.secureLogger.info(`     - Provider: ${route.provider}`);
                        secure_logger_1.secureLogger.info(`     - Target Model: ${route.targetModel}`);
                        secure_logger_1.secureLogger.info(`     - API Key Index: ${keyIndex}`);
                        // 创建完整的4层流水线
                        const completePipeline = await this.createCompletePipeline({
                            pipelineId,
                            virtualModel,
                            provider: route.provider,
                            targetModel: route.targetModel,
                            apiKey: route.apiKeys[keyIndex],
                            endpoint: providerType.endpoint,
                            transformer: providerType.transformer,
                            protocol: providerType.protocol,
                            serverCompatibility: providerType.serverCompatibility
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
            }
            this.isInitialized = true;
            secure_logger_1.secureLogger.info(`🎉 All ${this.pipelines.size} pipelines initialized and ready`);
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
            status: 'initializing',
            lastHandshakeTime: new Date(),
            async execute(request) {
                secure_logger_1.secureLogger.info(`🔄 Pipeline ${this.pipelineId} executing request`);
                try {
                    // 使用StandardPipeline的execute方法，它已经实现了完整的4层处理
                    const response = await standardPipeline.execute(request, {
                        requestId: `req_${Date.now()}`,
                        priority: 'normal',
                        metadata: {
                            pipelineId: this.pipelineId,
                            provider: this.provider,
                            model: this.targetModel
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
}
exports.PipelineManager = PipelineManager;
//# sourceMappingURL=pipeline-manager.js.map