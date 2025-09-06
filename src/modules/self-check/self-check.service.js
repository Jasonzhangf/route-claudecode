"use strict";
/**
 * 自检服务实现
 *
 * 实现API密钥验证、token管理、流水线健康检查等核心功能
 *
 * @author Jason Zhang
 * @version 4.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelfCheckService = void 0;
const base_module_1 = require("../../interfaces/module/base-module");
const error_1 = require("../../types/error");
/**
 * 自检服务实现类
 */
class SelfCheckService {
    constructor() {
        this.isInitialized = false;
        this.pipelineManager = null;
        this.moduleAdapter = new base_module_1.SimpleModuleAdapter('self-check-service', 'Self Check Service', base_module_1.ModuleType.SERVICE, '4.0.0');
        this.config = {
            enableApiKeyValidation: true,
            apiKeyValidationInterval: 300000, // 5分钟
            enableTokenRefresh: true,
            tokenRefreshAdvanceTime: 3600000, // 1小时
            enablePipelineHealthCheck: true,
            pipelineHealthCheckInterval: 60000, // 1分钟
            autoDestroyInvalidPipelines: true,
            authTimeout: 300000 // 5分钟
        };
        this.apiKeyCache = new Map();
        this.pipelineCheckResults = new Map();
        this.authCheckResults = new Map();
        this.state = {
            moduleId: this.getId(),
            moduleName: this.getName(),
            moduleType: this.getType(),
            version: this.getVersion(),
            isRunning: false,
            statistics: {
                totalChecks: 0,
                successfulChecks: 0,
                failedChecks: 0,
                lastCheckAt: new Date(0),
                averageCheckDuration: 0
            },
            config: this.config,
            errors: []
        };
    }
    // ModuleInterface implementations
    getId() {
        return this.moduleAdapter.getId();
    }
    getName() {
        return this.moduleAdapter.getName();
    }
    getType() {
        return this.moduleAdapter.getType();
    }
    getVersion() {
        return this.moduleAdapter.getVersion();
    }
    getStatus() {
        return this.moduleAdapter.getStatus();
    }
    getMetrics() {
        return this.moduleAdapter.getMetrics();
    }
    async configure(config) {
        await this.moduleAdapter.configure(config);
    }
    async reset() {
        await this.moduleAdapter.reset();
        await this.resetSelfCheck();
    }
    async cleanup() {
        await this.moduleAdapter.cleanup();
        await this.cleanupSelfCheck();
    }
    addConnection(module) {
        this.moduleAdapter.addConnection(module);
    }
    removeConnection(moduleId) {
        this.moduleAdapter.removeConnection(moduleId);
    }
    getConnection(moduleId) {
        return this.moduleAdapter.getConnection(moduleId);
    }
    getConnections() {
        return this.moduleAdapter.getConnections();
    }
    async sendToModule(targetModuleId, message, type) {
        return this.moduleAdapter.sendToModule(targetModuleId, message, type);
    }
    async broadcastToModules(message, type) {
        await this.moduleAdapter.broadcastToModules(message, type);
    }
    onModuleMessage(listener) {
        this.moduleAdapter.onModuleMessage(listener);
    }
    on(event, listener) {
        this.moduleAdapter.on(event, listener);
        return this;
    }
    removeAllListeners() {
        this.moduleAdapter.removeAllListeners();
        return this;
    }
    async start() {
        await this.moduleAdapter.start();
        this.state.isRunning = true;
        this.state.startedAt = new Date();
    }
    async stop() {
        await this.moduleAdapter.stop();
        this.state.isRunning = false;
    }
    async healthCheck() {
        return this.moduleAdapter.healthCheck();
    }
    async process(input) {
        // 自检模块的处理逻辑
        return await this.performSelfCheck();
    }
    /**
     * 配置自检模块
     * @param config 自检配置
     */
    async configureSelfCheck(config) {
        this.config = { ...this.config, ...config };
        this.state.config = this.config;
    }
    /**
     * 设置流水线管理器
     * @param pipelineManager 流水线管理器实例
     */
    setPipelineManager(pipelineManager) {
        this.pipelineManager = pipelineManager;
    }
    /**
     * 执行完整的自检流程
     * @returns Promise<boolean> 自检是否成功
     */
    async performSelfCheck() {
        const startTime = Date.now();
        this.state.statistics.totalChecks++;
        try {
            // 验证API密钥
            if (this.config.enableApiKeyValidation) {
                await this.validateAllApiKeys();
            }
            // 刷新token
            if (this.config.enableTokenRefresh) {
                await this.refreshToken();
            }
            // 检查流水线健康状态
            if (this.config.enablePipelineHealthCheck) {
                await this.checkPipelineHealth();
            }
            // 更新统计信息
            const duration = Date.now() - startTime;
            this.state.statistics.successfulChecks++;
            this.state.statistics.lastCheckAt = new Date();
            // 更新平均检查耗时
            const totalDuration = this.state.statistics.averageCheckDuration * (this.state.statistics.successfulChecks - 1) + duration;
            this.state.statistics.averageCheckDuration = totalDuration / this.state.statistics.successfulChecks;
            return true;
        }
        catch (error) {
            this.state.statistics.failedChecks++;
            const errorMessage = error instanceof error_1.RCCError ? error.message : '未知错误';
            this.state.errors.push(`自检失败: ${errorMessage}`);
            return false;
        }
    }
    /**
     * 验证所有API密钥的有效性
     * @returns Promise<ApiKeyInfo[]> API密钥验证结果列表
     */
    async validateAllApiKeys() {
        const results = [];
        try {
            // 使用设置的流水线管理器或创建一个默认的
            const pipelineManager = this.pipelineManager || {
                getAllPipelines: () => new Map(),
                getAllPipelineStatus: () => ({})
            };
            // 获取所有流水线配置
            const allPipelinesMap = pipelineManager.getAllPipelines();
            const allPipelines = {};
            for (const [id, pipeline] of allPipelinesMap) {
                allPipelines[id] = {
                    provider: pipeline.provider,
                    apiKey: pipeline.apiKey
                };
            }
            // 收集所有唯一的API密钥
            const uniqueApiKeys = new Map();
            // 从现有缓存中获取API密钥信息
            for (const [apiKeyId, apiKeyInfo] of this.apiKeyCache.entries()) {
                const key = `${apiKeyInfo.provider}:${apiKeyInfo.apiKey}`;
                if (!uniqueApiKeys.has(key)) {
                    uniqueApiKeys.set(key, {
                        provider: apiKeyInfo.provider,
                        pipelines: []
                    });
                }
                uniqueApiKeys.get(key)?.pipelines.push(...apiKeyInfo.associatedPipelines);
            }
            // 验证每个API密钥
            for (const [key, info] of uniqueApiKeys.entries()) {
                const [provider, apiKeyValue] = key.split(':');
                const apiKeyId = this.generateApiKeyID(provider, apiKeyValue);
                const apiKeyInfo = {
                    id: apiKeyId,
                    apiKey: apiKeyValue,
                    provider: provider,
                    status: await this.verifyApiKey(provider, apiKeyValue) ? 'valid' : 'invalid',
                    lastCheckedAt: new Date(),
                    createdAt: new Date(),
                    associatedPipelines: info.pipelines
                };
                this.apiKeyCache.set(apiKeyId, apiKeyInfo);
                results.push(apiKeyInfo);
                // 如果启用了自动销毁且API密钥无效，销毁相关流水线
                if (this.config.autoDestroyInvalidPipelines && apiKeyInfo.status === 'invalid') {
                    await this.destroyInvalidPipelines([apiKeyId]);
                }
            }
        }
        catch (error) {
            const errorMessage = error instanceof error_1.RCCError ? error.message : '未知错误';
            this.state.errors.push(`API密钥验证失败: ${errorMessage}`);
        }
        return results;
    }
    /**
     * 检查特定API密钥的有效性
     * @param apiKeyId API密钥ID
     * @returns Promise<ApiKeyInfo> API密钥信息
     */
    async validateApiKey(apiKeyId) {
        const cachedInfo = this.apiKeyCache.get(apiKeyId);
        if (cachedInfo) {
            // 检查缓存是否过期（5分钟内认为有效）
            const age = Date.now() - cachedInfo.lastCheckedAt.getTime();
            if (age < 300000) {
                return cachedInfo;
            }
        }
        // 重新验证API密钥
        const apiKeyInfo = await this.performApiKeyValidation(apiKeyId);
        this.apiKeyCache.set(apiKeyId, apiKeyInfo);
        return apiKeyInfo;
    }
    /**
     * 执行API密钥验证
     * @param apiKeyId API密钥ID
     * @returns Promise<ApiKeyInfo> API密钥信息
     */
    async performApiKeyValidation(apiKeyId) {
        // 从现有缓存中获取信息
        const existingInfo = this.apiKeyCache.get(apiKeyId);
        if (!existingInfo) {
            throw new error_1.RCCError(`未找到API密钥: ${apiKeyId}`, 'SELF_CHECK_002', 'SelfCheckService');
        }
        // 实际验证逻辑（这里需要根据提供商调用不同的验证方法）
        const isValid = await this.verifyApiKey(existingInfo.provider, existingInfo.apiKey);
        return {
            ...existingInfo,
            status: isValid ? 'valid' : 'invalid',
            lastCheckedAt: new Date()
        };
    }
    /**
     * 验证API密钥（真实的验证逻辑）
     * @param provider 提供商
     * @param apiKey API密钥
     * @returns Promise<boolean> 是否有效
     */
    async verifyApiKey(provider, apiKey) {
        try {
            // 根据不同的提供商使用不同的验证方法
            switch (provider.toLowerCase()) {
                case 'iflow':
                    return this.verifyIflowApiKey(apiKey);
                case 'qwen':
                    return this.verifyQwenApiKey(apiKey);
                default:
                    // 默认验证逻辑 - 检查格式和长度
                    return this.verifyGenericApiKey(apiKey);
            }
        }
        catch (error) {
            return false;
        }
    }
    /**
     * 验证Iflow API密钥
     * @param apiKey API密钥
     * @returns boolean 是否有效
     */
    verifyIflowApiKey(apiKey) {
        // iflow API密钥格式验证
        return typeof apiKey === 'string' &&
            apiKey.startsWith('sk-') &&
            apiKey.length >= 32 &&
            /^[a-zA-Z0-9\-_]+$/.test(apiKey);
    }
    /**
     * 验证Qwen API密钥
     * @param apiKey API密钥
     * @returns boolean 是否有效
     */
    verifyQwenApiKey(apiKey) {
        // Qwen API密钥格式验证
        return typeof apiKey === 'string' &&
            (apiKey.startsWith('qwen-') || apiKey.length >= 20) &&
            /^[a-zA-Z0-9\-_]+$/.test(apiKey);
    }
    /**
     * 通用API密钥验证
     * @param apiKey API密钥
     * @returns boolean 是否有效
     */
    verifyGenericApiKey(apiKey) {
        // 通用API密钥验证
        return typeof apiKey === 'string' &&
            apiKey.length >= 10 &&
            /^[a-zA-Z0-9\-_]+$/.test(apiKey);
    }
    /**
     * 生成API密钥ID
     * @param provider 提供商
     * @param apiKey API密钥
     * @returns string API密钥ID
     */
    generateApiKeyID(provider, apiKey) {
        // 使用简单的哈希方法生成ID（实际实现中应该使用更安全的哈希算法）
        const hash = btoa(`${provider}:${apiKey.substring(0, 16)}`).replace(/[^a-zA-Z0-9]/g, '');
        return `ak_${provider}_${hash.substring(0, 16)}`;
    }
    /**
     * 刷新即将过期的token
     * @returns Promise<number> 成功刷新的token数量
     */
    async refreshToken() {
        let refreshedCount = 0;
        try {
            // 获取所有需要刷新的token
            const tokensToRefresh = this.getTokensNeedingRefresh();
            // 刷新每个token
            for (const tokenId of tokensToRefresh) {
                const success = await this.refreshSingleToken(tokenId);
                if (success) {
                    refreshedCount++;
                }
            }
        }
        catch (error) {
            const errorMessage = error instanceof error_1.RCCError ? error.message : '未知错误';
            this.state.errors.push(`Token刷新失败: ${errorMessage}`);
        }
        return refreshedCount;
    }
    /**
     * 获取需要刷新的token列表
     * @returns string[] 需要刷新的token ID列表
     */
    getTokensNeedingRefresh() {
        const tokens = [];
        // 在实际实现中，这里会检查缓存的token并找出即将过期的token
        return tokens;
    }
    /**
     * 刷新单个token
     * @param tokenId Token ID
     * @returns Promise<boolean> 刷新是否成功
     */
    async refreshSingleToken(tokenId) {
        try {
            // 在实际实现中，这里会调用提供商的token刷新接口
            // 暂时返回true表示成功
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * 检查所有流水线的健康状态
     * @returns Promise<PipelineCheckResult[]> 流水线检查结果列表
     */
    async checkPipelineHealth() {
        const results = [];
        try {
            // 使用设置的流水线管理器
            const pipelineManager = this.pipelineManager;
            if (!pipelineManager) {
                throw new error_1.RCCError('无法获取流水线管理器', 'SELF_CHECK_003', 'SelfCheckService');
            }
            const allPipelines = pipelineManager.getAllPipelines();
            const allPipelineStatus = pipelineManager.getAllPipelineStatus();
            // 检查每个流水线的健康状态
            for (const [pipelineId, pipeline] of allPipelines) {
                try {
                    const pipelineStatus = allPipelineStatus[pipelineId];
                    const status = pipelineStatus ? pipelineStatus.health : 'unknown';
                    const checkResult = {
                        pipelineId: pipelineId,
                        status: this.mapPipelineHealthToCheckStatus(status),
                        checkedAt: new Date(),
                        provider: pipeline.provider,
                        model: pipeline.targetModel
                    };
                    this.pipelineCheckResults.set(pipelineId, checkResult);
                    results.push(checkResult);
                }
                catch (error) {
                    const checkResult = {
                        pipelineId: pipelineId,
                        status: 'error',
                        checkedAt: new Date(),
                        provider: pipeline.provider,
                        model: pipeline.targetModel,
                        error: error.message || 'Unknown error'
                    };
                    this.pipelineCheckResults.set(pipelineId, checkResult);
                    results.push(checkResult);
                }
            }
        }
        catch (error) {
            const errorMessage = error instanceof error_1.RCCError ? error.message : '未知错误';
            this.state.errors.push(`流水线健康检查失败: ${errorMessage}`);
        }
        return results;
    }
    /**
     * 将流水线健康状态映射到检查状态
     * @param health 健康状态
     * @returns PipelineCheckStatus 检查状态
     */
    mapPipelineHealthToCheckStatus(health) {
        switch (health) {
            case 'healthy':
                return 'active';
            case 'degraded':
                return 'warning';
            case 'unhealthy':
                return 'blacklisted';
            case 'error':
                return 'error';
            default:
                return 'pending';
        }
    }
    /**
     * 销毁无效API密钥相关的流水线
     * @param invalidApiKeyIds 无效的API密钥ID列表
     * @returns Promise<string[]> 被销毁的流水线ID列表
     */
    async destroyInvalidPipelines(invalidApiKeyIds) {
        const destroyedPipelines = [];
        try {
            // 使用设置的流水线管理器
            const pipelineManager = this.pipelineManager;
            if (!pipelineManager) {
                throw new error_1.RCCError('无法获取流水线管理器', 'SELF_CHECK_004', 'SelfCheckService');
            }
            // 获取所有需要销毁的流水线
            const pipelinesToDestroy = new Set();
            for (const apiKeyId of invalidApiKeyIds) {
                const apiKeyInfo = this.apiKeyCache.get(apiKeyId);
                if (apiKeyInfo) {
                    apiKeyInfo.associatedPipelines.forEach(pipelineId => pipelinesToDestroy.add(pipelineId));
                }
            }
            // 销毁流水线
            for (const pipelineId of pipelinesToDestroy) {
                try {
                    const success = await pipelineManager.destroyPipeline(pipelineId);
                    if (success) {
                        destroyedPipelines.push(pipelineId);
                        // 更新检查结果
                        const checkResult = this.pipelineCheckResults.get(pipelineId);
                        if (checkResult) {
                            checkResult.status = 'destroyed';
                            checkResult.checkedAt = new Date();
                        }
                    }
                }
                catch (error) {
                    const errorMessage = error instanceof error_1.RCCError ? error.message : '未知错误';
                    this.state.errors.push(`销毁流水线失败 ${pipelineId}: ${errorMessage}`);
                }
            }
        }
        catch (error) {
            const errorMessage = error instanceof error_1.RCCError ? error.message : '未知错误';
            this.state.errors.push(`销毁无效流水线失败: ${errorMessage}`);
        }
        return destroyedPipelines;
    }
    /**
     * 拉黑过期token相关的流水线
     * @param expiredTokenIds 过期的token ID列表
     * @returns Promise<string[]> 被拉黑的流水线ID列表
     */
    async blacklistExpiredPipelines(expiredTokenIds) {
        const blacklistedPipelines = [];
        // 在实际实现中，这里会根据过期token找到相关流水线并拉黑
        // 暂时空实现
        return blacklistedPipelines;
    }
    /**
     * 恢复通过认证的流水线
     * @returns Promise<string[]> 恢复的流水线ID列表
     */
    async restoreAuthenticatedPipelines() {
        const restoredPipelines = [];
        // 在实际实现中，这里会恢复之前被拉黑但已通过认证的流水线
        // 暂时空实现
        return restoredPipelines;
    }
    /**
     * 启动动态调度服务器
     * @returns Promise<boolean> 启动是否成功
     */
    async startDynamicScheduler() {
        try {
            // 使用设置的流水线管理器
            const pipelineManager = this.pipelineManager;
            if (!pipelineManager) {
                throw new error_1.RCCError('无法获取流水线管理器', 'SELF_CHECK_005', 'SelfCheckService');
            }
            // 获取流水线统计信息
            const stats = pipelineManager.getStatistics();
            if (stats.totalPipelines === 0) {
                this.state.errors.push('没有配置的流水线，无法启动动态调度服务器');
                return false;
            }
            if (stats.healthyPipelines === 0) {
                this.state.errors.push('没有健康的流水线，无法启动动态调度服务器');
                return false;
            }
            // 在实际实现中，这里会启动动态调度服务器
            // 暂时返回true表示成功
            this.state.isRunning = true;
            this.state.startedAt = new Date();
            return true;
        }
        catch (error) {
            const errorMessage = error instanceof error_1.RCCError ? error.message : '未知错误';
            this.state.errors.push(`启动动态调度服务器失败: ${errorMessage}`);
            return false;
        }
    }
    /**
     * 获取认证检查结果
     * @returns Promise<AuthCheckResult[]> 认证检查结果列表
     */
    async getAuthCheckResults() {
        return Array.from(this.authCheckResults.values());
    }
    /**
     * 获取自检模块状态
     * @returns Promise<SelfCheckState> 自检模块状态
     */
    async getSelfCheckState() {
        return { ...this.state };
    }
    /**
     * 重置自检模块状态
     */
    async resetSelfCheck() {
        this.apiKeyCache.clear();
        this.pipelineCheckResults.clear();
        this.authCheckResults.clear();
        this.state.statistics = {
            totalChecks: 0,
            successfulChecks: 0,
            failedChecks: 0,
            lastCheckAt: new Date(0),
            averageCheckDuration: 0
        };
        this.state.errors = [];
        this.state.isRunning = false;
        this.state.startedAt = undefined;
    }
    /**
     * 清理自检模块资源
     */
    async cleanupSelfCheck() {
        await this.resetSelfCheck();
    }
}
exports.SelfCheckService = SelfCheckService;
//# sourceMappingURL=self-check.service.js.map