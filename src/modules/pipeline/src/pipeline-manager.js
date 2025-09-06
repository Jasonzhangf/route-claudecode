"use strict";
/**
 * Pipeline管理器
 *
 * 管理已组装流水线的生命周期、健康检查和执行调度
 *
 * @author Claude Code Router v4.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pipelineManager = exports.PipelineManager = void 0;
const secure_logger_1 = require("../../error-handler/src/utils/secure-logger");
const jq_json_handler_1 = require("../../error-handler/src/utils/jq-json-handler");
/**
 * Pipeline管理器
 */
class PipelineManager {
    constructor(config) {
        this.pipelines = new Map();
        this.pipelineStatus = new Map();
        this.isDestroyed = false;
        this.healthCheckIntervalId = null;
        this.cleanupIntervalId = null;
        this.totalExecutions = 0;
        this.totalErrors = 0;
        this.totalResponseTime = 0;
        this.config = {
            healthCheckInterval: 60000, // 1分钟
            cleanupInterval: 300000, // 5分钟
            maxInactiveTime: 3600000, // 1小时
            enableAutoScaling: true,
            maxPipelines: 100,
            ...config
        };
        this.startTime = new Date();
        // 启动健康检查和清理任务
        this.startHealthChecks();
        this.startCleanupTask();
    }
    /**
     * 添加流水线
     */
    addPipeline(pipeline) {
        if (this.isDestroyed) {
            secure_logger_1.secureLogger.warn('Cannot add pipeline to destroyed manager', { pipelineId: pipeline.pipelineId });
            return false;
        }
        if (this.pipelines.size >= (this.config.maxPipelines || 100)) {
            secure_logger_1.secureLogger.warn('Pipeline limit reached, cannot add new pipeline', {
                pipelineId: pipeline.pipelineId,
                currentCount: this.pipelines.size,
                maxCount: this.config.maxPipelines
            });
            return false;
        }
        this.pipelines.set(pipeline.pipelineId, pipeline);
        // 初始化状态信息
        this.pipelineStatus.set(pipeline.pipelineId, {
            pipelineId: pipeline.pipelineId,
            status: 'active',
            health: pipeline.health,
            executionCount: 0,
            errorCount: 0,
            averageResponseTime: 0
        });
        secure_logger_1.secureLogger.info('Pipeline added to manager', { pipelineId: pipeline.pipelineId });
        return true;
    }
    /**
     * 获取流水线
     */
    getPipeline(pipelineId) {
        return this.pipelines.get(pipelineId);
    }
    /**
     * 移除流水线
     */
    removePipeline(pipelineId) {
        const pipeline = this.pipelines.get(pipelineId);
        if (!pipeline) {
            return false;
        }
        // 清理流水线资源
        this.cleanupPipeline(pipeline);
        this.pipelines.delete(pipelineId);
        this.pipelineStatus.delete(pipelineId);
        secure_logger_1.secureLogger.info('Pipeline removed from manager', { pipelineId });
        return true;
    }
    /**
     * 销毁流水线
     */
    async destroyPipeline(pipelineId) {
        const pipeline = this.pipelines.get(pipelineId);
        if (!pipeline) {
            return false;
        }
        try {
            // 停止流水线中的所有模块
            for (const module of pipeline.modules) {
                if (module.instance && module.isInitialized) {
                    try {
                        await module.instance.stop();
                        await module.instance.cleanup();
                    }
                    catch (error) {
                        secure_logger_1.secureLogger.warn('Failed to stop/cleanup module', {
                            moduleName: module.name,
                            error: error.message || 'Unknown error'
                        });
                    }
                }
            }
            // 更新状态
            pipeline.assemblyStatus = 'failed';
            pipeline.isActive = false;
            pipeline.health = 'unhealthy';
            // 从管理器中移除
            this.removePipeline(pipelineId);
            secure_logger_1.secureLogger.info('Pipeline destroyed successfully', { pipelineId });
            return true;
        }
        catch (error) {
            secure_logger_1.secureLogger.error('Failed to destroy pipeline', {
                pipelineId,
                error: error.message || 'Unknown error'
            });
            return false;
        }
    }
    /**
     * 获取所有流水线
     */
    getAllPipelines() {
        return new Map(this.pipelines);
    }
    /**
     * 获取流水线状态
     */
    getPipelineStatus(pipelineId) {
        return this.pipelineStatus.get(pipelineId);
    }
    /**
     * 获取所有流水线状态
     */
    getAllPipelineStatus() {
        const status = {};
        for (const [pipelineId, pipelineStatus] of this.pipelineStatus) {
            status[pipelineId] = { ...pipelineStatus };
        }
        return status;
    }
    /**
     * 更新流水线健康状态
     */
    updatePipelineHealth(pipelineId, health) {
        const status = this.pipelineStatus.get(pipelineId);
        if (!status) {
            return false;
        }
        status.health = health;
        // 更新对应的流水线对象
        const pipeline = this.pipelines.get(pipelineId);
        if (pipeline) {
            pipeline.health = health;
        }
        secure_logger_1.secureLogger.debug('Pipeline health updated', { pipelineId, health });
        return true;
    }
    /**
     * 记录流水线执行
     */
    recordPipelineExecution(pipelineId, success, responseTime) {
        const status = this.pipelineStatus.get(pipelineId);
        if (!status) {
            return false;
        }
        status.lastUsed = new Date();
        status.executionCount++;
        this.totalExecutions++;
        if (success) {
            // 更新平均响应时间
            const totalTime = status.averageResponseTime * (status.executionCount - 1) + responseTime;
            status.averageResponseTime = totalTime / status.executionCount;
            // 更新总平均响应时间
            this.totalResponseTime += responseTime;
        }
        else {
            status.errorCount++;
            this.totalErrors++;
        }
        return true;
    }
    /**
     * 执行流水线
     */
    async executePipeline(pipelineId, request) {
        const pipeline = this.pipelines.get(pipelineId);
        if (!pipeline) {
            const errorMsg = `Pipeline not found: ${pipelineId}`;
            secure_logger_1.secureLogger.error(errorMsg, { pipelineId });
            return { error: errorMsg };
        }
        if (pipeline.assemblyStatus !== 'assembled') {
            const errorMsg = `Pipeline not assembled: ${pipelineId}`;
            secure_logger_1.secureLogger.error(errorMsg, { pipelineId, status: pipeline.assemblyStatus });
            return { error: errorMsg };
        }
        const startTime = Date.now();
        let success = false;
        try {
            // 执行流水线的第一个模块（通常是Transformer）
            const firstModule = pipeline.modules[0];
            if (!firstModule || !firstModule.instance) {
                const errorMsg = 'No modules available in pipeline';
                secure_logger_1.secureLogger.error(errorMsg, { pipelineId });
                return { error: errorMsg };
            }
            const result = await firstModule.instance.process(request);
            success = true;
            return result;
        }
        finally {
            const responseTime = Date.now() - startTime;
            this.recordPipelineExecution(pipelineId, success, responseTime);
        }
    }
    /**
     * 健康检查所有流水线
     */
    async healthCheckAllPipelines() {
        if (this.isDestroyed) {
            return;
        }
        const healthChecks = [];
        for (const [pipelineId, pipeline] of this.pipelines) {
            try {
                const startTime = Date.now();
                const healthResult = await this.checkPipelineHealth(pipeline);
                const responseTime = Date.now() - startTime;
                healthChecks.push({
                    pipelineId,
                    healthy: healthResult.healthy,
                    responseTime
                });
                // 更新健康状态
                this.updatePipelineHealth(pipelineId, healthResult.healthy ? 'healthy' : 'unhealthy');
            }
            catch (error) {
                secure_logger_1.secureLogger.error('Pipeline health check failed', {
                    pipelineId,
                    error: error.message || 'Unknown error'
                });
                this.updatePipelineHealth(pipelineId, 'unhealthy');
            }
        }
        secure_logger_1.secureLogger.debug('Health check completed for all pipelines', {
            total: healthChecks.length,
            healthy: healthChecks.filter(check => check.healthy).length
        });
    }
    /**
     * 检查单个流水线健康状态
     */
    async checkPipelineHealth(pipeline) {
        // 检查流水线状态
        if (pipeline.assemblyStatus !== 'assembled') {
            return { healthy: false, details: `Pipeline not assembled: ${pipeline.assemblyStatus}` };
        }
        // 检查每个模块的健康状态
        for (const module of pipeline.modules) {
            try {
                const healthResult = await module.instance.healthCheck();
                if (!healthResult.healthy) {
                    return {
                        healthy: false,
                        details: `Module ${module.name} unhealthy: ${jq_json_handler_1.JQJsonHandler.stringifyJson(healthResult.details)}`
                    };
                }
            }
            catch (error) {
                return {
                    healthy: false,
                    details: `Module ${module.name} health check failed: ${error.message || 'Unknown error'}`
                };
            }
        }
        return { healthy: true };
    }
    /**
     * 获取管理器统计信息
     */
    getStatistics() {
        const totalPipelines = this.pipelines.size;
        let activePipelines = 0;
        let healthyPipelines = 0;
        let totalExecutionCount = 0;
        let totalErrorCount = 0;
        let totalAvgResponseTime = 0;
        for (const status of this.pipelineStatus.values()) {
            if (status.status === 'active') {
                activePipelines++;
            }
            if (status.health === 'healthy') {
                healthyPipelines++;
            }
            totalExecutionCount += status.executionCount;
            totalErrorCount += status.errorCount;
            totalAvgResponseTime += status.averageResponseTime;
        }
        const uptime = Date.now() - this.startTime.getTime();
        const averageResponseTime = totalPipelines > 0 ? totalAvgResponseTime / totalPipelines : 0;
        return {
            totalPipelines,
            activePipelines,
            healthyPipelines,
            totalExecutions: this.totalExecutions,
            totalErrors: this.totalErrors,
            averageResponseTime,
            uptime
        };
    }
    /**
     * 启动健康检查任务
     */
    startHealthChecks() {
        if (this.config.healthCheckInterval && this.config.healthCheckInterval > 0) {
            this.healthCheckIntervalId = setInterval(() => {
                this.healthCheckAllPipelines().catch(error => {
                    secure_logger_1.secureLogger.error('Health check task failed', { error: error.message || 'Unknown error' });
                });
            }, this.config.healthCheckInterval);
        }
    }
    /**
     * 启动清理任务
     */
    startCleanupTask() {
        if (this.config.cleanupInterval && this.config.cleanupInterval > 0) {
            this.cleanupIntervalId = setInterval(() => {
                this.cleanupInactivePipelines().catch(error => {
                    secure_logger_1.secureLogger.error('Cleanup task failed', { error: error.message || 'Unknown error' });
                });
            }, this.config.cleanupInterval);
        }
    }
    /**
     * 清理不活跃的流水线
     */
    async cleanupInactivePipelines() {
        if (!this.config.maxInactiveTime) {
            return;
        }
        const now = Date.now();
        const cutoffTime = now - this.config.maxInactiveTime;
        const toRemove = [];
        for (const [pipelineId, status] of this.pipelineStatus) {
            if (status.lastUsed && status.lastUsed.getTime() < cutoffTime) {
                toRemove.push(pipelineId);
            }
        }
        for (const pipelineId of toRemove) {
            secure_logger_1.secureLogger.info('Cleaning up inactive pipeline', { pipelineId });
            await this.destroyPipeline(pipelineId);
        }
    }
    /**
     * 清理流水线资源
     */
    async cleanupPipeline(pipeline) {
        try {
            // 停止并清理所有模块
            for (const module of pipeline.modules) {
                if (module.instance && module.isInitialized) {
                    try {
                        await module.instance.stop();
                        await module.instance.cleanup();
                    }
                    catch (error) {
                        secure_logger_1.secureLogger.warn('Failed to cleanup module', {
                            moduleName: module.name,
                            error: error.message || 'Unknown error'
                        });
                    }
                }
            }
        }
        catch (error) {
            secure_logger_1.secureLogger.error('Failed to cleanup pipeline', {
                pipelineId: pipeline.pipelineId,
                error: error.message || 'Unknown error'
            });
        }
    }
    /**
     * 销毁管理器
     */
    async destroy() {
        if (this.isDestroyed) {
            return;
        }
        // 清理定时任务
        if (this.healthCheckIntervalId) {
            clearInterval(this.healthCheckIntervalId);
            this.healthCheckIntervalId = null;
        }
        if (this.cleanupIntervalId) {
            clearInterval(this.cleanupIntervalId);
            this.cleanupIntervalId = null;
        }
        // 销毁所有流水线
        const pipelineIds = Array.from(this.pipelines.keys());
        for (const pipelineId of pipelineIds) {
            await this.destroyPipeline(pipelineId);
        }
        this.isDestroyed = true;
        secure_logger_1.secureLogger.info('Pipeline manager destroyed');
    }
    /**
     * 重置管理器状态
     */
    async reset() {
        await this.destroy();
        this.pipelines.clear();
        this.pipelineStatus.clear();
        this.isDestroyed = false;
        this.totalExecutions = 0;
        this.totalErrors = 0;
        this.totalResponseTime = 0;
        this.startTime = new Date();
        // 重新启动任务
        this.startHealthChecks();
        this.startCleanupTask();
        secure_logger_1.secureLogger.info('Pipeline manager reset');
    }
}
exports.PipelineManager = PipelineManager;
// 导出默认实例管理器
exports.pipelineManager = new PipelineManager();
//# sourceMappingURL=pipeline-manager.js.map