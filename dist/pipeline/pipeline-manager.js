"use strict";
/**
 * Pipeline管理器核心实现
 *
 * 负责Pipeline的创建、执行、监控和销毁
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineManager = void 0;
const events_1 = require("events");
/**
 * Pipeline管理器
 */
class PipelineManager extends events_1.EventEmitter {
    constructor(factory) {
        super();
        this.pipelines = new Map();
        this.activeExecutions = new Map();
        this.factory = factory;
    }
    /**
     * 创建Pipeline
     */
    async createPipeline(config) {
        try {
            const pipeline = await this.factory.createStandardPipeline(config);
            this.pipelines.set(config.id, pipeline);
            // 设置Pipeline事件监听
            this.setupPipelineEventListeners(pipeline, config.id);
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
            const result = await pipeline.execute(input, context);
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
        return pipeline.getExecutionHistory();
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
        pipeline.on('moduleExecutionStarted', (data) => {
            this.emit('moduleExecutionStarted', { pipelineId, ...data });
        });
        pipeline.on('moduleExecutionCompleted', (data) => {
            this.emit('moduleExecutionCompleted', { pipelineId, ...data });
        });
        pipeline.on('moduleExecutionFailed', (data) => {
            this.emit('moduleExecutionFailed', { pipelineId, ...data });
        });
        pipeline.on('statusChanged', (data) => {
            this.emit('pipelineStatusChanged', { pipelineId, ...data });
        });
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
                peak: 0, // TODO: 实现CPU使用率监控
                average: 0
            },
            throughput: totalTime > 0 ? 1000 / totalTime : 0,
            errorCount
        };
    }
}
exports.PipelineManager = PipelineManager;
//# sourceMappingURL=pipeline-manager.js.map