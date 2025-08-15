"use strict";
/**
 * 基础模块实现
 *
 * 提供ModuleInterface的标准实现基类
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseModule = void 0;
const events_1 = require("events");
/**
 * 基础模块抽象类
 */
class BaseModule extends events_1.EventEmitter {
    id;
    name;
    type;
    version;
    status = 'stopped';
    config = {};
    metrics = {
        requestsProcessed: 0,
        averageProcessingTime: 0,
        errorRate: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        lastProcessedAt: undefined
    };
    processingTimes = [];
    errors = [];
    constructor(id, name, type, version = '1.0.0') {
        super();
        this.id = id;
        this.name = name;
        this.type = type;
        this.version = version;
    }
    /**
     * 获取模块ID
     */
    getId() {
        return this.id;
    }
    /**
     * 获取模块名称
     */
    getName() {
        return this.name;
    }
    /**
     * 获取模块类型
     */
    getType() {
        return this.type;
    }
    /**
     * 获取模块版本
     */
    getVersion() {
        return this.version;
    }
    /**
     * 获取模块状态
     */
    getStatus() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            status: this.status,
            health: this.calculateHealthStatus(),
            lastActivity: this.metrics.lastProcessedAt,
            error: this.errors.length > 0 ? this.errors[this.errors.length - 1] : undefined
        };
    }
    /**
     * 获取模块指标
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * 配置模块
     */
    async configure(config) {
        this.config = { ...this.config, ...config };
        await this.onConfigure(config);
        this.emit('configured', { config });
    }
    /**
     * 启动模块
     */
    async start() {
        if (this.status === 'running') {
            return;
        }
        try {
            this.status = 'starting';
            this.emit('statusChanged', { status: this.status });
            await this.onStart();
            this.status = 'running';
            this.emit('statusChanged', { status: this.status });
            this.emit('started');
        }
        catch (error) {
            this.status = 'error';
            this.recordError(error);
            this.emit('statusChanged', { status: this.status });
            throw error;
        }
    }
    /**
     * 停止模块
     */
    async stop() {
        if (this.status === 'stopped') {
            return;
        }
        try {
            this.status = 'stopping';
            this.emit('statusChanged', { status: this.status });
            await this.onStop();
            this.status = 'stopped';
            this.emit('statusChanged', { status: this.status });
            this.emit('stopped');
        }
        catch (error) {
            this.status = 'error';
            this.recordError(error);
            this.emit('statusChanged', { status: this.status });
            throw error;
        }
    }
    /**
     * 处理输入
     */
    async process(input) {
        if (this.status !== 'running') {
            throw new Error(`Module ${this.id} is not running (status: ${this.status})`);
        }
        const startTime = Date.now();
        try {
            this.emit('processingStarted', { input });
            const result = await this.onProcess(input);
            const processingTime = Date.now() - startTime;
            this.recordProcessingTime(processingTime);
            this.emit('processingCompleted', { input, result, processingTime });
            return result;
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.recordError(error);
            this.recordProcessingTime(processingTime);
            this.emit('processingFailed', { input, error, processingTime });
            throw error;
        }
    }
    /**
     * 重置模块
     */
    async reset() {
        try {
            await this.onReset();
            // 重置指标
            this.metrics = {
                requestsProcessed: 0,
                averageProcessingTime: 0,
                errorRate: 0,
                memoryUsage: 0,
                cpuUsage: 0,
                lastProcessedAt: undefined
            };
            this.processingTimes = [];
            this.errors = [];
            this.emit('reset');
        }
        catch (error) {
            this.recordError(error);
            throw error;
        }
    }
    /**
     * 清理资源
     */
    async cleanup() {
        try {
            await this.onCleanup();
            this.removeAllListeners();
            this.emit('cleanedUp');
        }
        catch (error) {
            this.recordError(error);
            throw error;
        }
    }
    /**
     * 健康检查
     */
    async healthCheck() {
        try {
            const details = await this.onHealthCheck();
            const healthy = this.status === 'running' && this.calculateHealthStatus() === 'healthy';
            return { healthy, details };
        }
        catch (error) {
            this.recordError(error);
            return {
                healthy: false,
                details: { error: error instanceof Error ? error.message : String(error) }
            };
        }
    }
    // 抽象方法 - 子类必须实现
    /**
     * 配置处理 - 子类可重写
     */
    async onConfigure(config) {
        // 默认实现：无操作
    }
    /**
     * 启动处理 - 子类可重写
     */
    async onStart() {
        // 默认实现：无操作
    }
    /**
     * 停止处理 - 子类可重写
     */
    async onStop() {
        // 默认实现：无操作
    }
    /**
     * 重置处理 - 子类可重写
     */
    async onReset() {
        // 默认实现：无操作
    }
    /**
     * 清理处理 - 子类可重写
     */
    async onCleanup() {
        // 默认实现：无操作
    }
    /**
     * 健康检查处理 - 子类可重写
     */
    async onHealthCheck() {
        return {
            status: this.status,
            metrics: this.metrics,
            config: this.config
        };
    }
    // 私有方法
    /**
     * 记录处理时间
     */
    recordProcessingTime(time) {
        this.processingTimes.push(time);
        this.metrics.requestsProcessed++;
        this.metrics.lastProcessedAt = new Date();
        // 保持最近100次的处理时间
        if (this.processingTimes.length > 100) {
            this.processingTimes = this.processingTimes.slice(-100);
        }
        // 更新平均处理时间
        this.metrics.averageProcessingTime =
            this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
        // 更新错误率
        this.updateErrorRate();
    }
    /**
     * 记录错误
     */
    recordError(error) {
        this.errors.push(error);
        // 保持最近50个错误
        if (this.errors.length > 50) {
            this.errors = this.errors.slice(-50);
        }
        this.updateErrorRate();
        this.emit('error', { error });
    }
    /**
     * 更新错误率
     */
    updateErrorRate() {
        if (this.metrics.requestsProcessed === 0) {
            this.metrics.errorRate = 0;
        }
        else {
            // 计算最近请求的错误率
            const recentRequests = Math.min(100, this.metrics.requestsProcessed);
            const recentErrors = Math.min(this.errors.length, recentRequests);
            this.metrics.errorRate = recentErrors / recentRequests;
        }
    }
    /**
     * 计算健康状态
     */
    calculateHealthStatus() {
        if (this.status === 'error') {
            return 'unhealthy';
        }
        if (this.status !== 'running') {
            return 'degraded';
        }
        // 基于错误率判断健康状态
        if (this.metrics.errorRate > 0.1) { // 错误率超过10%
            return 'unhealthy';
        }
        else if (this.metrics.errorRate > 0.05) { // 错误率超过5%
            return 'degraded';
        }
        return 'healthy';
    }
}
exports.BaseModule = BaseModule;
//# sourceMappingURL=base-module-impl.js.map