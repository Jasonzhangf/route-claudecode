"use strict";
/**
 * 标准Pipeline实现
 *
 * 实现PipelineFramework接口，提供完整的Pipeline执行功能
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandardPipeline = void 0;
const events_1 = require("events");
/**
 * 标准Pipeline实现
 */
class StandardPipeline extends events_1.EventEmitter {
    id;
    name;
    config;
    modules = new Map();
    moduleOrder = [];
    status = 'stopped';
    executionHistory = [];
    currentExecution;
    constructor(config) {
        super();
        this.id = config.id;
        this.name = config.name;
        this.config = config;
        // 初始化模块顺序
        this.moduleOrder = config.modules
            .sort((a, b) => a.order - b.order)
            .map(m => m.moduleId);
    }
    /**
     * 获取Pipeline ID
     */
    getId() {
        return this.id;
    }
    /**
     * 获取Pipeline名称
     */
    getName() {
        return this.name;
    }
    /**
     * 获取Pipeline状态
     */
    getStatus() {
        const moduleStatuses = {};
        for (const [moduleId, module] of this.modules) {
            moduleStatuses[moduleId] = module.getStatus();
        }
        return {
            id: this.id,
            name: this.name,
            status: this.status,
            modules: moduleStatuses,
            lastExecution: this.executionHistory.length > 0 ?
                this.executionHistory[this.executionHistory.length - 1] : undefined,
            uptime: 0, // TODO: 实现运行时间计算
            performance: {
                requestsProcessed: this.executionHistory.length,
                averageProcessingTime: this.calculateAverageProcessingTime(),
                errorRate: this.calculateErrorRate(),
                throughput: this.calculateThroughput()
            }
        };
    }
    /**
     * 启动Pipeline
     */
    async start() {
        if (this.status === 'running') {
            throw new Error(`Pipeline ${this.id} is already running`);
        }
        try {
            this.status = 'starting';
            this.emit('statusChanged', { status: this.status });
            // 启动所有模块
            for (const [moduleId, module] of this.modules) {
                await module.start();
            }
            this.status = 'running';
            this.emit('statusChanged', { status: this.status });
            this.emit('started');
        }
        catch (error) {
            this.status = 'error';
            this.emit('statusChanged', { status: this.status });
            throw new Error(`Failed to start pipeline ${this.id}: ${error}`);
        }
    }
    /**
     * 停止Pipeline
     */
    async stop() {
        if (this.status === 'stopped') {
            return;
        }
        try {
            this.status = 'stopping';
            this.emit('statusChanged', { status: this.status });
            // 停止所有模块
            for (const [moduleId, module] of this.modules) {
                await module.stop();
            }
            this.status = 'stopped';
            this.emit('statusChanged', { status: this.status });
            this.emit('stopped');
        }
        catch (error) {
            this.status = 'error';
            this.emit('statusChanged', { status: this.status });
            throw new Error(`Failed to stop pipeline ${this.id}: ${error}`);
        }
    }
    /**
     * 执行Pipeline
     */
    async execute(input, context) {
        if (this.status !== 'running') {
            throw new Error(`Pipeline ${this.id} is not running (status: ${this.status})`);
        }
        const executionId = this.generateExecutionId();
        const executionRecord = {
            id: executionId,
            pipelineId: this.id,
            requestId: context?.requestId || executionId,
            startTime: new Date(),
            status: 'running',
            moduleExecutions: []
        };
        this.currentExecution = executionRecord;
        this.emit('executionStarted', { executionRecord });
        try {
            let currentInput = input;
            // 按顺序执行所有模块
            for (const moduleId of this.moduleOrder) {
                const module = this.modules.get(moduleId);
                if (!module) {
                    throw new Error(`Module ${moduleId} not found in pipeline ${this.id}`);
                }
                const moduleExecution = await this.executeModule(moduleId, currentInput, executionRecord);
                executionRecord.moduleExecutions.push(moduleExecution);
                // 如果模块执行失败且配置为快速失败，则抛出错误
                if (moduleExecution.status === 'failed' && this.config.settings.failFast) {
                    throw moduleExecution.error || new Error(`Module ${moduleId} execution failed`);
                }
                // 更新输入为模块的输出
                if (moduleExecution.output !== undefined) {
                    currentInput = moduleExecution.output;
                }
            }
            executionRecord.endTime = new Date();
            executionRecord.status = 'completed';
            executionRecord.totalTime =
                executionRecord.endTime.getTime() - executionRecord.startTime.getTime();
            this.executionHistory.push(executionRecord);
            this.currentExecution = undefined;
            this.emit('executionCompleted', { executionRecord });
            return currentInput;
        }
        catch (error) {
            executionRecord.endTime = new Date();
            executionRecord.status = 'failed';
            executionRecord.error = error;
            executionRecord.totalTime =
                executionRecord.endTime.getTime() - executionRecord.startTime.getTime();
            this.executionHistory.push(executionRecord);
            this.currentExecution = undefined;
            this.emit('executionFailed', { executionRecord, error });
            throw error;
        }
    }
    /**
     * 添加模块到流水线
     */
    addModule(module) {
        this.modules.set(module.getId(), module);
        // 设置模块事件监听
        this.setupModuleEventListeners(module);
        this.emit('moduleAdded', { moduleId: module.getId() });
    }
    /**
     * 移除模块
     */
    removeModule(moduleId) {
        const module = this.modules.get(moduleId);
        if (module) {
            this.modules.delete(moduleId);
            this.moduleOrder = this.moduleOrder.filter(id => id !== moduleId);
            // 移除事件监听
            module.removeAllListeners();
            this.emit('moduleRemoved', { moduleId });
        }
    }
    /**
     * 获取模块
     */
    getModule(moduleId) {
        return this.modules.get(moduleId) || null;
    }
    /**
     * 获取所有模块
     */
    getAllModules() {
        return Array.from(this.modules.values());
    }
    /**
     * 设置模块顺序
     */
    setModuleOrder(moduleIds) {
        // 验证所有模块ID都存在
        for (const moduleId of moduleIds) {
            if (!this.modules.has(moduleId)) {
                throw new Error(`Module ${moduleId} not found in pipeline`);
            }
        }
        this.moduleOrder = [...moduleIds];
        this.emit('moduleOrderChanged', { moduleOrder: this.moduleOrder });
    }
    /**
     * 执行单个模块
     */
    async executeModule(moduleId, input) {
        const module = this.modules.get(moduleId);
        if (!module) {
            throw new Error(`Module ${moduleId} not found`);
        }
        return await module.process(input);
    }
    /**
     * 获取执行历史
     */
    getExecutionHistory() {
        return [...this.executionHistory];
    }
    /**
     * 重置流水线状态
     */
    async reset() {
        this.executionHistory = [];
        this.currentExecution = undefined;
        // 重置所有模块
        for (const [moduleId, module] of this.modules) {
            await module.reset();
        }
        this.emit('reset');
    }
    /**
     * 执行单个模块（内部方法）
     */
    async executeModule(moduleId, input, executionRecord) {
        const module = this.modules.get(moduleId);
        if (!module) {
            throw new Error(`Module ${moduleId} not found`);
        }
        const moduleExecution = {
            moduleId,
            moduleName: module.getName(),
            startTime: new Date(),
            status: 'running',
            input
        };
        this.emit('moduleExecutionStarted', { moduleExecution });
        try {
            const output = await module.process(input);
            moduleExecution.endTime = new Date();
            moduleExecution.status = 'completed';
            moduleExecution.output = output;
            moduleExecution.processingTime =
                moduleExecution.endTime.getTime() - moduleExecution.startTime.getTime();
            this.emit('moduleExecutionCompleted', { moduleExecution });
            return moduleExecution;
        }
        catch (error) {
            moduleExecution.endTime = new Date();
            moduleExecution.status = 'failed';
            moduleExecution.error = error;
            moduleExecution.processingTime =
                moduleExecution.endTime.getTime() - moduleExecution.startTime.getTime();
            this.emit('moduleExecutionFailed', { moduleExecution, error });
            return moduleExecution;
        }
    }
    /**
     * 设置模块事件监听器
     */
    setupModuleEventListeners(module) {
        module.on('statusChanged', (data) => {
            this.emit('moduleStatusChanged', {
                moduleId: module.getId(),
                ...data
            });
        });
        module.on('error', (data) => {
            this.emit('moduleError', {
                moduleId: module.getId(),
                ...data
            });
        });
    }
    /**
     * 生成执行ID
     */
    generateExecutionId() {
        return `${this.id}_exec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
    /**
     * 计算平均处理时间
     */
    calculateAverageProcessingTime() {
        if (this.executionHistory.length === 0) {
            return 0;
        }
        const totalTime = this.executionHistory.reduce((sum, record) => {
            return sum + (record.totalTime || 0);
        }, 0);
        return totalTime / this.executionHistory.length;
    }
    /**
     * 计算错误率
     */
    calculateErrorRate() {
        if (this.executionHistory.length === 0) {
            return 0;
        }
        const failedCount = this.executionHistory.filter(record => record.status === 'failed').length;
        return failedCount / this.executionHistory.length;
    }
    /**
     * 计算吞吐量
     */
    calculateThroughput() {
        const averageTime = this.calculateAverageProcessingTime();
        return averageTime > 0 ? 1000 / averageTime : 0;
    }
}
exports.StandardPipeline = StandardPipeline;
//# sourceMappingURL=standard-pipeline.js.map