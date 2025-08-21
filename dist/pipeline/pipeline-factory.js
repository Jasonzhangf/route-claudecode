"use strict";
/**
 * Pipeline工厂
 *
 * 负责创建各种类型的CompletePipeline实例
 * 封装了复杂的Pipeline创建逻辑
 *
 * @author RCC v4.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandardPipelineFactoryImpl = exports.PipelineFactory = void 0;
const secure_logger_1 = require("../utils/secure-logger");
const standard_pipeline_1 = require("./standard-pipeline");
class PipelineFactory {
    constructor(factory, systemConfig) {
        this.factory = factory;
        this.systemConfig = systemConfig;
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
                settings: this.createDefaultPipelineSettings()
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
     * 创建用于向后兼容的Legacy Pipeline包装器
     */
    async createLegacyPipelineWrapper(config) {
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
        return completePipelineWrapper;
    }
    /**
     * 创建默认的Pipeline设置
     */
    createDefaultPipelineSettings() {
        return {
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
        };
    }
}
exports.PipelineFactory = PipelineFactory;
/**
 * 标准流水线工厂实现
 * 实现StandardPipelineFactory接口，提供向后兼容
 */
class StandardPipelineFactoryImpl {
    constructor(moduleRegistry) {
        this.moduleRegistry = moduleRegistry;
    }
    createDefaultPipelineSettings() {
        return {
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
        };
    }
    /**
     * 创建标准流水线
     */
    async createStandardPipeline(config) {
        // 创建StandardPipeline实例
        const pipeline = new standard_pipeline_1.StandardPipeline(config);
        // 启动流水线
        await pipeline.start();
        return pipeline;
    }
    /**
     * 创建LM Studio流水线
     */
    async createLMStudioPipeline(model) {
        const config = {
            id: `lmstudio-${model}`,
            name: `LM Studio Pipeline - ${model}`,
            provider: 'lmstudio',
            model: model,
            modules: [],
            settings: this.createDefaultPipelineSettings()
        };
        return this.createStandardPipeline(config);
    }
    /**
     * 创建OpenAI流水线
     */
    async createOpenAIPipeline(model) {
        const config = {
            id: `openai-${model}`,
            name: `OpenAI Pipeline - ${model}`,
            provider: 'openai',
            model: model,
            modules: [],
            settings: this.createDefaultPipelineSettings()
        };
        return this.createStandardPipeline(config);
    }
    /**
     * 创建Anthropic流水线
     */
    async createAnthropicPipeline(model) {
        const config = {
            id: `anthropic-${model}`,
            name: `Anthropic Pipeline - ${model}`,
            provider: 'anthropic',
            model: model,
            modules: [],
            settings: this.createDefaultPipelineSettings()
        };
        return this.createStandardPipeline(config);
    }
    /**
     * 从规范创建流水线
     */
    async createFromSpec(spec) {
        // 将PipelineSpec转换为PipelineConfig
        const config = {
            id: spec.id,
            name: spec.name,
            provider: spec.provider || 'unknown',
            model: spec.model || 'unknown',
            modules: spec.modules || [],
            settings: this.createDefaultPipelineSettings()
        };
        return this.createStandardPipeline(config);
    }
    /**
     * 克隆流水线
     */
    async clonePipeline(sourceId, newId) {
        // 创建基于源流水线ID的新配置
        const config = {
            id: newId,
            name: `Cloned Pipeline - ${newId}`,
            provider: 'unknown',
            model: 'unknown',
            modules: [],
            settings: this.createDefaultPipelineSettings()
        };
        return this.createStandardPipeline(config);
    }
}
exports.StandardPipelineFactoryImpl = StandardPipelineFactoryImpl;
//# sourceMappingURL=pipeline-factory.js.map