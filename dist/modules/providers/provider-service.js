"use strict";
/**
 * Provider服务
 *
 * 统一的Provider服务入口点，整合工厂、管理器和配置加载
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderService = void 0;
const provider_manager_1 = require("./provider-manager");
const provider_factory_1 = require("./provider-factory");
const config_loader_1 = require("./config-loader");
/**
 * Provider服务
 */
class ProviderService {
    config;
    manager;
    factory;
    status;
    startedAt;
    stats;
    requestTimes;
    constructor(config) {
        this.config = {
            autoStart: true,
            debug: false,
            ...config
        };
        this.manager = new provider_manager_1.ProviderManager(this.config.manager);
        this.factory = provider_factory_1.ProviderFactory.getInstance();
        this.status = 'stopped';
        this.requestTimes = [];
        this.stats = {
            status: this.status,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            providerStats: {}
        };
        if (this.config.debug) {
            console.log('[ProviderService] Service initialized');
        }
    }
    /**
     * 启动服务
     */
    async start() {
        if (this.status === 'running') {
            if (this.config.debug) {
                console.log('[ProviderService] Service is already running');
            }
            return;
        }
        this.status = 'starting';
        try {
            if (this.config.debug) {
                console.log('[ProviderService] Starting Provider service...');
            }
            // 加载配置
            const providerConfigs = await this.loadProviderConfigs();
            if (providerConfigs.length === 0) {
                throw new Error('No provider configurations found');
            }
            // 初始化管理器
            await this.manager.initialize(providerConfigs);
            // 更新状态
            this.status = 'running';
            this.startedAt = new Date();
            this.stats.status = this.status;
            this.stats.startedAt = this.startedAt;
            if (this.config.debug) {
                console.log(`[ProviderService] Service started successfully with ${providerConfigs.length} providers`);
            }
        }
        catch (error) {
            this.status = 'error';
            this.stats.status = this.status;
            if (this.config.debug) {
                console.error('[ProviderService] Failed to start service:', error);
            }
            throw error;
        }
    }
    /**
     * 停止服务
     */
    async stop() {
        if (this.status === 'stopped') {
            if (this.config.debug) {
                console.log('[ProviderService] Service is already stopped');
            }
            return;
        }
        this.status = 'stopping';
        try {
            if (this.config.debug) {
                console.log('[ProviderService] Stopping Provider service...');
            }
            // 停止管理器
            await this.manager.stop();
            // 更新状态
            this.status = 'stopped';
            this.stats.status = this.status;
            this.startedAt = undefined;
            if (this.config.debug) {
                console.log('[ProviderService] Service stopped successfully');
            }
        }
        catch (error) {
            this.status = 'error';
            this.stats.status = this.status;
            if (this.config.debug) {
                console.error('[ProviderService] Failed to stop service:', error);
            }
            throw error;
        }
    }
    /**
     * 重启服务
     */
    async restart() {
        if (this.config.debug) {
            console.log('[ProviderService] Restarting service...');
        }
        await this.stop();
        await this.start();
    }
    /**
     * 处理请求
     */
    async processRequest(request) {
        if (this.status !== 'running') {
            throw new Error(`Provider service is not running (status: ${this.status})`);
        }
        const startTime = Date.now();
        try {
            // 更新统计
            this.stats.totalRequests++;
            // 路由请求
            const response = await this.manager.routeRequest(request);
            // 更新成功统计
            this.stats.successfulRequests++;
            // 记录响应时间
            const responseTime = Date.now() - startTime;
            this.updateResponseTime(responseTime);
            if (this.config.debug) {
                console.log(`[ProviderService] Request processed successfully in ${responseTime}ms`);
            }
            return response;
        }
        catch (error) {
            // 更新失败统计
            this.stats.failedRequests++;
            const responseTime = Date.now() - startTime;
            this.updateResponseTime(responseTime);
            if (this.config.debug) {
                console.error(`[ProviderService] Request failed after ${responseTime}ms:`, error);
            }
            throw error;
        }
    }
    /**
     * 加载Provider配置
     */
    async loadProviderConfigs() {
        let providerConfigs = [];
        // 从配置文件加载
        if (this.config.configLoader) {
            try {
                const configFile = await config_loader_1.ConfigLoader.loadConfig({
                    ...this.config.configLoader,
                    debug: this.config.debug
                });
                providerConfigs = configFile.providers;
                // 应用全局调试设置
                if (configFile.global?.debug !== undefined) {
                    this.config.debug = configFile.global.debug;
                }
            }
            catch (error) {
                if (this.config.debug) {
                    console.error('[ProviderService] Failed to load configuration file:', error);
                }
                throw error;
            }
        }
        // 从直接配置加载
        if (this.config.providers && this.config.providers.length > 0) {
            providerConfigs = [...providerConfigs, ...this.config.providers];
        }
        // 过滤启用的Provider
        const enabledProviders = providerConfigs.filter(config => config.enabled);
        if (this.config.debug) {
            console.log(`[ProviderService] Loaded ${enabledProviders.length} enabled providers (${providerConfigs.length} total)`);
        }
        return enabledProviders;
    }
    /**
     * 更新响应时间统计
     */
    updateResponseTime(responseTime) {
        this.requestTimes.push(responseTime);
        // 保持最近1000次请求的时间记录
        if (this.requestTimes.length > 1000) {
            this.requestTimes = this.requestTimes.slice(-1000);
        }
        // 计算平均响应时间
        this.stats.averageResponseTime =
            this.requestTimes.reduce((sum, time) => sum + time, 0) / this.requestTimes.length;
    }
    /**
     * 获取服务状态
     */
    getStatus() {
        return this.status;
    }
    /**
     * 获取服务统计信息
     */
    getStats() {
        const stats = { ...this.stats };
        // 计算运行时间
        if (this.startedAt) {
            stats.uptime = Date.now() - this.startedAt.getTime();
        }
        // 获取Provider统计
        stats.providerStats = this.manager.getManagerStats();
        return stats;
    }
    /**
     * 获取所有Provider状态
     */
    getProviderStatuses() {
        return this.manager.getProviderStatuses();
    }
    /**
     * 获取健康的Provider数量
     */
    getHealthyProviderCount() {
        return this.manager.getHealthyProviderCount();
    }
    /**
     * 检查服务健康状态
     */
    async healthCheck() {
        if (this.status !== 'running') {
            return {
                healthy: false,
                details: { error: `Service is not running (status: ${this.status})` }
            };
        }
        const healthyProviders = this.getHealthyProviderCount();
        const totalProviders = this.getProviderStatuses().length;
        // 如果至少有一个健康的Provider，服务就是健康的
        const healthy = healthyProviders > 0;
        return {
            healthy,
            details: {
                status: this.status,
                healthyProviders,
                totalProviders,
                uptime: this.startedAt ? Date.now() - this.startedAt.getTime() : 0,
                totalRequests: this.stats.totalRequests,
                successRate: this.stats.totalRequests > 0
                    ? this.stats.successfulRequests / this.stats.totalRequests
                    : 0,
                averageResponseTime: this.stats.averageResponseTime
            }
        };
    }
    /**
     * 重新加载配置
     */
    async reloadConfig() {
        if (this.config.debug) {
            console.log('[ProviderService] Reloading configuration...');
        }
        // 重启服务以应用新配置
        await this.restart();
    }
    /**
     * 创建服务实例
     */
    static create(config) {
        const service = new ProviderService(config);
        if (config.autoStart) {
            // 异步启动
            service.start().catch(error => {
                if (config.debug) {
                    console.error('[ProviderService] Auto-start failed:', error);
                }
            });
        }
        return service;
    }
    /**
     * 创建带配置文件的服务实例
     */
    static createFromConfigFile(configFilePath, managerConfig) {
        return ProviderService.create({
            manager: managerConfig || {},
            configLoader: {
                filePath: configFilePath,
                validate: true,
                debug: true
            },
            autoStart: true,
            debug: true
        });
    }
}
exports.ProviderService = ProviderService;
//# sourceMappingURL=provider-service.js.map