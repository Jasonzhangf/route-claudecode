"use strict";
/**
 * API路由定义
 *
 * 定义RCC v4.0的核心API端点
 *
 * @author Jason Zhang
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupApiRoutes = setupApiRoutes;
const constants_1 = require("../constants");
/**
 * 配置API路由
 */
function setupApiRoutes(router, middlewareManager) {
    // API v1路由组
    const apiV1Routes = {
        prefix: '/api/v1',
        middleware: [
            middlewareManager.createCors({
                origin: (0, constants_1.getCorsConfig)().origin,
                methods: ['GET', 'POST', 'PUT', 'DELETE'],
                credentials: true,
            }),
            middlewareManager.createLogger({ level: 2, format: 'detailed' }),
            middlewareManager.createRateLimit({ maxRequests: 1000, windowMs: 60000 }), // 1000 req/min
        ],
        routes: [
            // 系统信息
            {
                method: 'GET',
                path: '/info',
                handler: async (req, res, params) => {
                    res.body = {
                        name: 'RCC (Route Claude Code)',
                        version: '4.0.0-alpha.1',
                        description: 'Modular AI routing proxy system',
                        features: [
                            'Multi-provider routing',
                            'Request transformation',
                            'Rate limiting',
                            'Authentication',
                            'Debug system',
                            'Pipeline management',
                        ],
                        endpoints: {
                            health: '/health',
                            status: '/status',
                            version: '/version',
                            providers: '/api/v1/providers',
                            pipelines: '/api/v1/pipelines',
                            config: '/api/v1/config',
                        },
                    };
                },
                name: 'api-info',
                description: 'Get API information',
            },
            // Provider管理
            {
                method: 'GET',
                path: '/providers',
                handler: async (req, res, params) => {
                    try {
                        // 从全局服务获取Provider管理器
                        const { getGlobalProviderManager } = await Promise.resolve().then(() => __importStar(require('../services/global-service-registry')));
                        const providerManager = getGlobalProviderManager();
                        if (!providerManager) {
                            res.statusCode = 503;
                            res.body = {
                                error: 'Service Unavailable',
                                message: 'Provider manager not initialized',
                            };
                            return;
                        }
                        const providerStatuses = providerManager.getProviderStatuses();
                        const providers = providerStatuses.map(status => ({
                            id: status.routeInfo.id,
                            name: status.name,
                            type: status.routeInfo.type,
                            status: status.status,
                            healthy: status.routeInfo.healthy,
                            currentLoad: status.routeInfo.currentLoad,
                            priority: status.routeInfo.priority,
                            weight: status.routeInfo.weight,
                            uptime: status.uptime || 0,
                            lastUpdated: status.lastUpdated || new Date(),
                        }));
                        res.body = {
                            providers,
                            total: providers.length,
                            healthy: providers.filter(p => p.healthy).length,
                            unhealthy: providers.filter(p => !p.healthy).length,
                        };
                    }
                    catch (error) {
                        console.error('Failed to get providers:', error);
                        res.statusCode = 500;
                        res.body = {
                            error: 'Internal Server Error',
                            message: 'Failed to retrieve provider list',
                        };
                    }
                },
                name: 'list-providers',
                description: 'List all available providers',
            },
            {
                method: 'GET',
                path: '/providers/:id',
                handler: async (req, res, params) => {
                    const providerId = params.id;
                    if (!providerId) {
                        res.statusCode = 400;
                        res.body = {
                            error: 'Bad Request',
                            message: 'Provider ID is required',
                        };
                        return;
                    }
                    try {
                        const { getGlobalProviderManager } = await Promise.resolve().then(() => __importStar(require('../services/global-service-registry')));
                        const providerManager = getGlobalProviderManager();
                        if (!providerManager) {
                            res.statusCode = 503;
                            res.body = {
                                error: 'Service Unavailable',
                                message: 'Provider manager not initialized',
                            };
                            return;
                        }
                        const providerStatuses = providerManager.getProviderStatuses();
                        const providerStatus = providerStatuses.find(s => s.routeInfo.id === providerId);
                        if (!providerStatus) {
                            res.statusCode = 404;
                            res.body = {
                                error: 'Not Found',
                                message: `Provider '${providerId}' not found`,
                            };
                            return;
                        }
                        res.body = {
                            id: providerStatus.routeInfo.id,
                            name: providerStatus.name,
                            type: providerStatus.routeInfo.type,
                            status: providerStatus.status,
                            healthy: providerStatus.routeInfo.healthy,
                            currentLoad: providerStatus.routeInfo.currentLoad,
                            priority: providerStatus.routeInfo.priority,
                            weight: providerStatus.routeInfo.weight,
                            uptime: providerStatus.uptime || 0,
                            lastUpdated: providerStatus.lastUpdated || new Date(),
                            stats: {
                                memoryUsage: providerStatus.memoryUsage || 0,
                                cpuUsage: providerStatus.cpuUsage || 0,
                            },
                        };
                    }
                    catch (error) {
                        console.error(`Failed to get provider ${providerId}:`, error);
                        res.statusCode = 500;
                        res.body = {
                            error: 'Internal Server Error',
                            message: 'Failed to retrieve provider details',
                        };
                    }
                },
                name: 'get-provider',
                description: 'Get provider details',
            },
            // Pipeline管理
            {
                method: 'GET',
                path: '/pipelines',
                handler: async (req, res, params) => {
                    try {
                        const { getGlobalPipelineManager } = await Promise.resolve().then(() => __importStar(require('../services/global-service-registry')));
                        const pipelineManager = getGlobalPipelineManager();
                        if (!pipelineManager) {
                            res.statusCode = 503;
                            res.body = {
                                error: 'Service Unavailable',
                                message: 'Pipeline manager not initialized',
                            };
                            return;
                        }
                        const allPipelineStatus = pipelineManager.getAllPipelineStatus();
                        const activeExecutions = pipelineManager.getActiveExecutions();
                        const pipelines = Object.entries(allPipelineStatus).map(([id, status]) => {
                            const pipelineActiveExecutions = activeExecutions.filter(exec => exec.pipelineId === id);
                            const executionHistory = pipelineManager.getExecutionHistory(id);
                            // 计算统计信息
                            const completedExecutions = executionHistory.filter(exec => exec.status === 'completed');
                            const avgProcessingTime = completedExecutions.length > 0
                                ? Math.round(completedExecutions.reduce((sum, exec) => sum + (exec.totalTime || 0), 0) /
                                    completedExecutions.length)
                                : 0;
                            return {
                                id,
                                status: status.status,
                                moduleCount: status.moduleCount || 0,
                                activeRequests: pipelineActiveExecutions.length,
                                totalProcessed: executionHistory.length,
                                avgProcessingTime,
                                lastExecuted: executionHistory.length > 0 ? executionHistory[executionHistory.length - 1].startTime : null,
                                errorRate: executionHistory.length > 0
                                    ? Math.round((executionHistory.filter(exec => exec.status === 'failed').length / executionHistory.length) *
                                        100 *
                                        100) / 100
                                    : 0,
                            };
                        });
                        res.body = {
                            pipelines,
                            total: pipelines.length,
                            running: pipelines.filter(p => p.status === 'running').length,
                            stopped: pipelines.filter(p => p.status === 'stopped').length,
                            totalActiveRequests: pipelines.reduce((sum, p) => sum + p.activeRequests, 0),
                        };
                    }
                    catch (error) {
                        console.error('Failed to get pipelines:', error);
                        res.statusCode = 500;
                        res.body = {
                            error: 'Internal Server Error',
                            message: 'Failed to retrieve pipeline list',
                        };
                    }
                },
                name: 'list-pipelines',
                description: 'List all active pipelines',
            },
            {
                method: 'GET',
                path: '/pipelines/:id',
                handler: async (req, res, params) => {
                    const pipelineId = params.id;
                    if (!pipelineId) {
                        res.statusCode = 400;
                        res.body = {
                            error: 'Bad Request',
                            message: 'Pipeline ID is required',
                        };
                        return;
                    }
                    try {
                        const { getGlobalPipelineManager } = await Promise.resolve().then(() => __importStar(require('../services/global-service-registry')));
                        const pipelineManager = getGlobalPipelineManager();
                        if (!pipelineManager) {
                            res.statusCode = 503;
                            res.body = {
                                error: 'Service Unavailable',
                                message: 'Pipeline manager not initialized',
                            };
                            return;
                        }
                        const pipeline = pipelineManager.getPipeline(pipelineId);
                        if (!pipeline) {
                            res.statusCode = 404;
                            res.body = {
                                error: 'Not Found',
                                message: `Pipeline '${pipelineId}' not found`,
                            };
                            return;
                        }
                        const status = pipelineManager.getPipelineStatus(pipelineId);
                        const activeExecutions = pipelineManager
                            .getActiveExecutions()
                            .filter(exec => exec.pipelineId === pipelineId);
                        const executionHistory = pipelineManager.getExecutionHistory(pipelineId);
                        // 获取模块状态信息
                        const modules = status?.modules?.map((module) => ({
                            name: module.name,
                            id: module.id,
                            type: module.type,
                            status: module.status,
                            version: module.version,
                            uptime: module.uptime,
                        })) || [];
                        // 计算统计信息
                        const completedExecutions = executionHistory.filter(exec => exec.status === 'completed');
                        const failedExecutions = executionHistory.filter(exec => exec.status === 'failed');
                        const avgProcessingTime = completedExecutions.length > 0
                            ? Math.round(completedExecutions.reduce((sum, exec) => sum + (exec.totalTime || 0), 0) /
                                completedExecutions.length)
                            : 0;
                        res.body = {
                            id: pipelineId,
                            status: status?.status || 'unknown',
                            moduleCount: status?.moduleCount || 0,
                            modules,
                            stats: {
                                activeRequests: activeExecutions.length,
                                totalProcessed: executionHistory.length,
                                successfulRequests: completedExecutions.length,
                                failedRequests: failedExecutions.length,
                                avgProcessingTime,
                                errorRate: executionHistory.length > 0
                                    ? Math.round((failedExecutions.length / executionHistory.length) * 100 * 100) / 100
                                    : 0,
                                lastExecuted: executionHistory.length > 0 ? executionHistory[executionHistory.length - 1].startTime : null,
                            },
                        };
                    }
                    catch (error) {
                        console.error(`Failed to get pipeline ${pipelineId}:`, error);
                        res.statusCode = 500;
                        res.body = {
                            error: 'Internal Server Error',
                            message: 'Failed to retrieve pipeline details',
                        };
                    }
                },
                name: 'get-pipeline',
                description: 'Get pipeline details',
            },
            // 配置管理
            {
                method: 'GET',
                path: '/config',
                handler: async (req, res, params) => {
                    try {
                        const { getGlobalConfigManager } = await Promise.resolve().then(() => __importStar(require('../services/global-service-registry')));
                        const configManager = getGlobalConfigManager();
                        if (!configManager) {
                            res.statusCode = 503;
                            res.body = {
                                error: 'Service Unavailable',
                                message: 'Configuration manager not initialized',
                            };
                            return;
                        }
                        const config = await configManager.getCurrentConfig();
                        // 过滤敏感信息（如API密钥）
                        const safeConfig = {
                            server: {
                                port: config.server?.port || constants_1.SERVER_DEFAULTS.HTTP.PORT,
                                host: config.server?.host || constants_1.SERVER_DEFAULTS.HTTP.HOST,
                                debug: config.server?.debug || false,
                                maxRequestSize: config.server?.maxRequestSize,
                                timeout: config.server?.timeout,
                            },
                            routing: {
                                defaultStrategy: config.routing?.defaultStrategy,
                                loadBalancing: config.routing?.loadBalancing,
                                healthCheckInterval: config.routing?.healthCheckInterval,
                                maxRetries: config.routing?.maxRetries,
                                strictErrorReporting: config.routing?.strictErrorReporting,
                            },
                            middleware: {
                                rateLimit: {
                                    enabled: config.middleware?.rateLimit?.enabled,
                                    maxRequests: config.middleware?.rateLimit?.maxRequests,
                                    windowMs: config.middleware?.rateLimit?.windowMs,
                                },
                                cors: {
                                    enabled: config.middleware?.cors?.enabled,
                                    origin: config.middleware?.cors?.origin,
                                    credentials: config.middleware?.cors?.credentials,
                                },
                                auth: {
                                    enabled: config.middleware?.auth?.enabled,
                                    type: config.middleware?.auth?.type,
                                    // 不返回实际的密钥
                                },
                            },
                            providers: Object.keys(config.providers || {}),
                            pipelines: Object.keys(config.pipelines || {}),
                        };
                        res.body = safeConfig;
                    }
                    catch (error) {
                        console.error('Failed to get configuration:', error);
                        res.statusCode = 500;
                        res.body = {
                            error: 'Internal Server Error',
                            message: 'Failed to retrieve configuration',
                        };
                    }
                },
                name: 'get-config',
                description: 'Get current configuration',
            },
            {
                method: 'PUT',
                path: '/config',
                handler: async (req, res, params) => {
                    const newConfig = req.body;
                    if (!newConfig) {
                        res.statusCode = 400;
                        res.body = {
                            error: 'Bad Request',
                            message: 'Configuration data required',
                        };
                        return;
                    }
                    try {
                        const { getGlobalConfigManager } = await Promise.resolve().then(() => __importStar(require('../services/global-service-registry')));
                        const configManager = getGlobalConfigManager();
                        if (!configManager) {
                            res.statusCode = 503;
                            res.body = {
                                error: 'Service Unavailable',
                                message: 'Configuration manager not initialized',
                            };
                            return;
                        }
                        // 验证配置格式
                        const validationResult = await configManager.validateConfig(newConfig);
                        if (!validationResult.valid) {
                            res.statusCode = 400;
                            res.body = {
                                error: 'Bad Request',
                                message: 'Invalid configuration',
                                details: validationResult.errors,
                            };
                            return;
                        }
                        // 应用配置更新
                        await configManager.updateConfig(newConfig);
                        res.body = {
                            success: true,
                            message: 'Configuration updated successfully',
                            timestamp: new Date().toISOString(),
                        };
                    }
                    catch (error) {
                        console.error('Failed to update configuration:', error);
                        res.statusCode = 500;
                        res.body = {
                            error: 'Internal Server Error',
                            message: error instanceof Error ? error.message : 'Failed to update configuration',
                        };
                    }
                },
                name: 'update-config',
                description: 'Update configuration',
            },
        ],
    };
    // 注册API路由组
    router.group(apiV1Routes);
    // 管理API路由组（需要认证）
    const adminRoutes = {
        prefix: '/api/admin',
        middleware: [
            middlewareManager.createCors({ origin: false }), // 仅允许同源请求
            middlewareManager.createLogger({ level: 2, format: 'json' }),
            middlewareManager.createRateLimit({ maxRequests: 100, windowMs: 60000 }), // 更严格的限制
            middlewareManager.createAuth({ required: true }), // 需要管理员API密钥
        ],
        routes: [
            // 重启服务
            {
                method: 'POST',
                path: '/restart',
                handler: async (req, res, params) => {
                    try {
                        const { getGlobalServerManager } = await Promise.resolve().then(() => __importStar(require('../services/global-service-registry')));
                        const serverManager = getGlobalServerManager();
                        if (!serverManager) {
                            res.statusCode = 503;
                            res.body = {
                                error: 'Service Unavailable',
                                message: 'Server manager not initialized',
                            };
                            return;
                        }
                        // 执行服务重启
                        const restartResult = await serverManager.restart();
                        res.body = {
                            success: true,
                            message: 'Server restart initiated successfully',
                            restartId: restartResult.restartId,
                            estimatedDowntime: restartResult.estimatedDowntime,
                            timestamp: new Date().toISOString(),
                        };
                    }
                    catch (error) {
                        console.error('Failed to restart server:', error);
                        res.statusCode = 500;
                        res.body = {
                            error: 'Internal Server Error',
                            message: error instanceof Error ? error.message : 'Failed to restart server',
                        };
                    }
                },
                name: 'restart-server',
                description: 'Restart the server',
            },
            // 清除缓存
            {
                method: 'POST',
                path: '/cache/clear',
                handler: async (req, res, params) => {
                    try {
                        const { getGlobalCacheManager } = await Promise.resolve().then(() => __importStar(require('../services/global-service-registry')));
                        const cacheManager = getGlobalCacheManager();
                        if (!cacheManager) {
                            res.statusCode = 503;
                            res.body = {
                                error: 'Service Unavailable',
                                message: 'Cache manager not initialized',
                            };
                            return;
                        }
                        // 执行缓存清除
                        const clearResult = await cacheManager.clearAll();
                        res.body = {
                            success: true,
                            message: 'Cache cleared successfully',
                            itemsCleared: clearResult.itemsCleared,
                            cacheTypes: clearResult.cacheTypes,
                            timestamp: new Date().toISOString(),
                        };
                    }
                    catch (error) {
                        console.error('Failed to clear cache:', error);
                        res.statusCode = 500;
                        res.body = {
                            error: 'Internal Server Error',
                            message: error instanceof Error ? error.message : 'Failed to clear cache',
                        };
                    }
                },
                name: 'clear-cache',
                description: 'Clear all caches',
            },
            // 导出配置
            {
                method: 'GET',
                path: '/config/export',
                handler: async (req, res, params) => {
                    try {
                        const { getGlobalConfigManager } = await Promise.resolve().then(() => __importStar(require('../services/global-service-registry')));
                        const configManager = getGlobalConfigManager();
                        if (!configManager) {
                            res.statusCode = 503;
                            res.body = {
                                error: 'Service Unavailable',
                                message: 'Configuration manager not initialized',
                            };
                            return;
                        }
                        // 导出完整配置
                        const fullConfig = await configManager.exportConfig();
                        const exportData = {
                            exportedAt: new Date().toISOString(),
                            version: '4.0.0-alpha.1',
                            exportType: 'full',
                            config: fullConfig,
                        };
                        res.headers['Content-Type'] = 'application/json';
                        res.headers['Content-Disposition'] =
                            `attachment; filename="rcc-config-${new Date().toISOString().split('T')[0]}.json"`;
                        res.body = exportData;
                    }
                    catch (error) {
                        console.error('Failed to export configuration:', error);
                        res.statusCode = 500;
                        res.body = {
                            error: 'Internal Server Error',
                            message: error instanceof Error ? error.message : 'Failed to export configuration',
                        };
                    }
                },
                name: 'export-config',
                description: 'Export configuration as JSON',
            },
        ],
    };
    // 注册管理API路由组
    router.group(adminRoutes);
}
//# sourceMappingURL=api-routes.js.map