"use strict";
/**
 * Provider管理器
 *
 * 统一管理Provider实例的生命周期、路由和负载均衡
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderManager = void 0;
const provider_factory_1 = require("./provider-factory");
const debug_integration_1 = require("../logging/src/debug-integration");
/**
 * Provider管理器
 */
class ProviderManager {
    constructor(config = {}) {
        this.debugIntegration = new debug_integration_1.ModuleDebugIntegration({
            moduleId: 'providers',
            moduleName: 'ProviderManager',
            enabled: true,
            captureLevel: 'full'
        });
        this.config = {
            routingStrategy: 'round-robin',
            healthCheckInterval: 30000, // 30秒
            maxRetries: 3,
            debug: false,
            strictErrorReporting: true,
            ...config,
        };
        this.factory = provider_factory_1.ProviderFactory.getInstance();
        this.providers = new Map();
        this.routeInfos = new Map();
        this.roundRobinIndex = 0;
    }
    /**
     * 初始化管理器
     */
    async initialize(providerConfigs) {
        try {
            if (this.config.debug) {
                console.log(`[ProviderManager] Initializing with ${providerConfigs.length} provider configs`);
            }
            // 验证所有Provider配置
            const validationResults = providerConfigs.map(config => ({
                config,
                validation: this.factory.validateProviderConfig(config),
            }));
            const invalidConfigs = validationResults.filter(result => !result.validation.valid);
            if (invalidConfigs.length > 0) {
                const errors = invalidConfigs
                    .map(result => `${result.config.id}: ${result.validation.errors.join(', ')}`)
                    .join('; ');
                throw new Error(`Invalid provider configurations: ${errors}`);
            }
            // 创建Provider实例
            const providers = this.factory.createProviders(providerConfigs, this.config.debug);
            // 注册Provider
            for (const provider of providers) {
                await this.registerProvider(provider);
            }
            // 启动健康检查
            this.startHealthCheck();
            if (this.config.debug) {
                console.log(`[ProviderManager] Initialized successfully with ${this.providers.size} providers`);
            }
        }
        catch (error) {
            if (this.config.debug) {
                console.error('[ProviderManager] Initialization failed:', error);
            }
            throw error;
        }
    }
    /**
     * 注册Provider
     */
    async registerProvider(provider) {
        const providerId = provider.getId();
        try {
            // 启动Provider
            await provider.start();
            // 添加到管理列表
            this.providers.set(providerId, provider);
            // 初始化路由信息
            this.routeInfos.set(providerId, {
                id: providerId,
                type: this.getProviderType(provider),
                priority: 1,
                weight: 1,
                healthy: true,
                currentLoad: 0,
            });
            if (this.config.debug) {
                console.log(`[ProviderManager] Registered provider: ${providerId}`);
            }
        }
        catch (error) {
            if (this.config.debug) {
                console.error(`[ProviderManager] Failed to register provider ${providerId}:`, error);
            }
            throw error;
        }
    }
    /**
     * 注销Provider
     */
    async unregisterProvider(providerId) {
        const provider = this.providers.get(providerId);
        if (!provider) {
            return false;
        }
        try {
            // 停止Provider
            await provider.stop();
            // 从管理列表移除
            this.providers.delete(providerId);
            this.routeInfos.delete(providerId);
            if (this.config.debug) {
                console.log(`[ProviderManager] Unregistered provider: ${providerId}`);
            }
            return true;
        }
        catch (error) {
            if (this.config.debug) {
                console.error(`[ProviderManager] Failed to unregister provider ${providerId}:`, error);
            }
            return false;
        }
    }
    /**
     * 路由请求到合适的Provider
     */
    async routeRequest(request) {
        const routeResult = this.selectProvider(request);
        if (!routeResult) {
            throw new Error('No healthy provider available for request');
        }
        const { provider, info, reason } = routeResult;
        if (this.config.debug) {
            console.log(`[ProviderManager] Routing request to ${info.id} (${reason})`);
        }
        let lastError = null;
        let retryCount = 0;
        // 带重试的请求处理
        while (retryCount <= this.config.maxRetries) {
            try {
                // 更新负载计数
                this.updateProviderLoad(info.id, 1);
                // 处理请求
                const response = await provider.process(request);
                // 更新负载计数
                this.updateProviderLoad(info.id, -1);
                if (this.config.debug) {
                    console.log(`[ProviderManager] Request processed successfully by ${info.id}`);
                }
                return response;
            }
            catch (error) {
                lastError = error;
                retryCount++;
                // 更新负载计数
                this.updateProviderLoad(info.id, -1);
                // 标记Provider为不健康（仅用于监控，不影响路由）
                if (this.config.strictErrorReporting) {
                    this.markProviderUnhealthy(info.id);
                }
                if (this.config.debug) {
                    console.warn(`[ProviderManager] Request failed on ${info.id}, attempt ${retryCount}:`, error);
                }
                // 🚨 RCC v4.0 Zero Fallback Policy: 不允许故障转移，直接报告错误
                // 记录失败信息用于监控和调试
                const errorDetails = {
                    providerId: info.id,
                    attempt: retryCount,
                    maxRetries: this.config.maxRetries,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                };
                if (this.config.debug) {
                    console.error(`[ProviderManager] Provider ${info.id} failed (attempt ${retryCount}/${this.config.maxRetries}):`, errorDetails);
                }
                // 不进行fallback，让错误向上传播以保持透明度
            }
        }
        throw lastError || new Error('Request failed after all retry attempts');
    }
    /**
     * 选择Provider
     */
    selectProvider(request, excludeIds = []) {
        const availableProviders = Array.from(this.providers.entries()).filter(([id, provider]) => {
            const routeInfo = this.routeInfos.get(id);
            return routeInfo && routeInfo.healthy && !excludeIds.includes(id) && this.isProviderCompatible(provider, request);
        });
        if (availableProviders.length === 0) {
            return null;
        }
        const [selectedId, selectedProvider] = this.applyRoutingStrategy(availableProviders);
        const routeInfo = this.routeInfos.get(selectedId);
        return {
            provider: selectedProvider,
            info: routeInfo,
            reason: `Selected by ${this.config.routingStrategy} strategy`,
        };
    }
    /**
     * 应用路由策略
     */
    applyRoutingStrategy(providers) {
        if (providers.length === 0) {
            throw new Error('No providers available for routing');
        }
        switch (this.config.routingStrategy) {
            case 'round-robin':
                const selected = providers[this.roundRobinIndex % providers.length];
                this.roundRobinIndex++;
                return selected;
            case 'least-loaded':
                return providers.reduce((least, current) => {
                    const leastInfo = this.routeInfos.get(least[0]);
                    const currentInfo = this.routeInfos.get(current[0]);
                    return currentInfo.currentLoad < leastInfo.currentLoad ? current : least;
                });
            case 'random':
                return providers[Math.floor(Math.random() * providers.length)];
            case 'priority':
                return providers.reduce((highest, current) => {
                    const highestInfo = this.routeInfos.get(highest[0]);
                    const currentInfo = this.routeInfos.get(current[0]);
                    return currentInfo.priority > highestInfo.priority ? current : highest;
                });
            default:
                return providers[0];
        }
    }
    /**
     * 检查Provider兼容性
     */
    isProviderCompatible(provider, request) {
        // 基础检查：Provider必须在运行状态
        const status = provider.getStatus();
        if (status.status !== 'running') {
            return false;
        }
        // TODO: 可以添加更多兼容性检查
        // 例如：模型支持、工具调用支持等
        return true;
    }
    /**
     * 更新Provider负载
     */
    updateProviderLoad(providerId, delta) {
        const routeInfo = this.routeInfos.get(providerId);
        if (routeInfo) {
            routeInfo.currentLoad = Math.max(0, routeInfo.currentLoad + delta);
        }
    }
    /**
     * 标记Provider为不健康
     */
    markProviderUnhealthy(providerId) {
        const routeInfo = this.routeInfos.get(providerId);
        if (routeInfo) {
            routeInfo.healthy = false;
        }
    }
    /**
     * 启动健康检查
     */
    startHealthCheck() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
        this.healthCheckTimer = setInterval(async () => {
            await this.performHealthCheck();
        }, this.config.healthCheckInterval);
        if (this.config.debug) {
            console.log(`[ProviderManager] Started health check with ${this.config.healthCheckInterval}ms interval`);
        }
    }
    /**
     * 执行健康检查
     */
    async performHealthCheck() {
        const healthPromises = Array.from(this.providers.entries()).map(async ([id, provider]) => {
            try {
                const healthResult = await provider.healthCheck();
                const routeInfo = this.routeInfos.get(id);
                if (routeInfo) {
                    const wasHealthy = routeInfo.healthy;
                    routeInfo.healthy = healthResult.healthy;
                    // 记录健康状态变化
                    if (wasHealthy !== healthResult.healthy) {
                        const status = healthResult.healthy ? 'healthy' : 'unhealthy';
                        if (this.config.debug) {
                            console.log(`[ProviderManager] Provider ${id} status changed to ${status}`);
                        }
                    }
                }
            }
            catch (error) {
                const routeInfo = this.routeInfos.get(id);
                if (routeInfo) {
                    routeInfo.healthy = false;
                }
                if (this.config.debug) {
                    console.warn(`[ProviderManager] Health check failed for provider ${id}:`, error);
                }
            }
        });
        await Promise.all(healthPromises);
    }
    /**
     * 获取Provider类型
     */
    getProviderType(provider) {
        const name = provider.getName().toLowerCase();
        if (name.includes('openai')) {
            return 'openai';
        }
        else if (name.includes('anthropic')) {
            return 'anthropic';
        }
        else if (name.includes('gemini')) {
            return 'gemini';
        }
        return 'openai'; // 默认
    }
    /**
     * 获取所有Provider状态
     */
    getProviderStatuses() {
        return Array.from(this.providers.entries()).map(([id, provider]) => {
            const status = provider.getStatus();
            const routeInfo = this.routeInfos.get(id);
            return {
                ...status,
                routeInfo,
            };
        });
    }
    /**
     * 获取健康的Provider数量
     */
    getHealthyProviderCount() {
        return Array.from(this.routeInfos.values()).filter(info => info.healthy).length;
    }
    /**
     * 获取管理器统计信息
     */
    getManagerStats() {
        const providers = this.getProviderStatuses();
        const healthy = providers.filter(p => p.routeInfo.healthy).length;
        const unhealthy = providers.length - healthy;
        return {
            totalProviders: providers.length,
            healthyProviders: healthy,
            unhealthyProviders: unhealthy,
            routingStrategy: this.config.routingStrategy,
            strictErrorReporting: this.config.strictErrorReporting,
            healthCheckInterval: this.config.healthCheckInterval,
            providers: providers.map(p => ({
                id: p.routeInfo.id,
                type: p.routeInfo.type,
                healthy: p.routeInfo.healthy,
                currentLoad: p.routeInfo.currentLoad,
                status: p.status,
            })),
        };
    }
    /**
     * 停止管理器
     */
    async stop() {
        // 停止健康检查
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = undefined;
        }
        // 停止所有Provider
        const stopPromises = Array.from(this.providers.keys()).map(id => this.unregisterProvider(id));
        await Promise.all(stopPromises);
        if (this.config.debug) {
            console.log('[ProviderManager] Stopped successfully');
        }
    }
}
exports.ProviderManager = ProviderManager;
//# sourceMappingURL=provider-manager.js.map