"use strict";
/**
 * 基础模块接口定义
 *
 * 所有模块必须实现的基础接口，确保模块间的一致性
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseModule = void 0;
/**
 * 基础模块抽象类
 */
class BaseModule {
    metrics = {
        processedRequests: 0,
        averageProcessingTime: 0,
        errorCount: 0
    };
    /**
     * 获取性能指标
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * 更新性能指标
     */
    updateMetrics(processingTime, hasError = false) {
        this.metrics.processedRequests++;
        // 计算平均处理时间
        const totalTime = this.metrics.averageProcessingTime * (this.metrics.processedRequests - 1);
        this.metrics.averageProcessingTime = (totalTime + processingTime) / this.metrics.processedRequests;
        if (hasError) {
            this.metrics.errorCount++;
        }
        this.metrics.lastProcessedAt = new Date();
    }
    /**
     * 模块初始化 - 可选实现
     */
    async initialize() {
        // 默认空实现
    }
    /**
     * 模块销毁 - 可选实现
     */
    async destroy() {
        // 默认空实现
    }
}
exports.BaseModule = BaseModule;
//# sourceMappingURL=base-module.js.map