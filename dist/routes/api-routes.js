"use strict";
/**
 * API路由定义
 *
 * 定义RCC v4.0的核心API端点
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupApiRoutes = setupApiRoutes;
const middleware_1 = require("../middleware");
/**
 * 配置API路由
 */
function setupApiRoutes(router) {
    // API v1路由组
    const apiV1Routes = {
        prefix: '/api/v1',
        middleware: [
            (0, middleware_1.cors)({
                origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
                methods: ['GET', 'POST', 'PUT', 'DELETE'],
                credentials: true
            }),
            (0, middleware_1.logger)({ level: 2, format: 'detailed' }),
            (0, middleware_1.rateLimit)({ maxRequests: 1000, windowMs: 60000 }) // 1000 req/min
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
                            'Pipeline management'
                        ],
                        endpoints: {
                            health: '/health',
                            status: '/status',
                            version: '/version',
                            providers: '/api/v1/providers',
                            pipelines: '/api/v1/pipelines',
                            config: '/api/v1/config'
                        }
                    };
                },
                name: 'api-info',
                description: 'Get API information'
            },
            // Provider管理
            {
                method: 'GET',
                path: '/providers',
                handler: async (req, res, params) => {
                    // TODO: 实现Provider列表查询
                    res.body = {
                        providers: [
                            {
                                id: 'anthropic',
                                name: 'Anthropic',
                                type: 'anthropic',
                                status: 'active',
                                models: ['claude-3-sonnet', 'claude-3-haiku'],
                                config: {
                                    endpoint: 'https://api.anthropic.com/v1/messages',
                                    version: '2023-06-01'
                                }
                            },
                            {
                                id: 'openai',
                                name: 'OpenAI',
                                type: 'openai',
                                status: 'active',
                                models: ['gpt-4', 'gpt-3.5-turbo'],
                                config: {
                                    endpoint: 'https://api.openai.com/v1/chat/completions'
                                }
                            }
                        ],
                        total: 2
                    };
                },
                name: 'list-providers',
                description: 'List all available providers'
            },
            {
                method: 'GET',
                path: '/providers/:id',
                handler: async (req, res, params) => {
                    const providerId = params.id;
                    // TODO: 实现Provider详情查询
                    if (providerId === 'anthropic') {
                        res.body = {
                            id: 'anthropic',
                            name: 'Anthropic',
                            type: 'anthropic',
                            status: 'active',
                            models: ['claude-3-sonnet', 'claude-3-haiku'],
                            config: {
                                endpoint: 'https://api.anthropic.com/v1/messages',
                                version: '2023-06-01'
                            },
                            stats: {
                                totalRequests: 1247,
                                successRate: 99.2,
                                avgResponseTime: 1250
                            }
                        };
                    }
                    else {
                        res.statusCode = 404;
                        res.body = { error: 'Provider not found' };
                    }
                },
                name: 'get-provider',
                description: 'Get provider details'
            },
            // Pipeline管理
            {
                method: 'GET',
                path: '/pipelines',
                handler: async (req, res, params) => {
                    // TODO: 实现Pipeline列表查询
                    res.body = {
                        pipelines: [
                            {
                                id: 'anthropic-claude-3-sonnet',
                                provider: 'anthropic',
                                model: 'claude-3-sonnet',
                                status: 'running',
                                activeRequests: 3,
                                totalProcessed: 856,
                                avgProcessingTime: 1200
                            },
                            {
                                id: 'openai-gpt-4',
                                provider: 'openai',
                                model: 'gpt-4',
                                status: 'running',
                                activeRequests: 1,
                                totalProcessed: 391,
                                avgProcessingTime: 2100
                            }
                        ],
                        total: 2
                    };
                },
                name: 'list-pipelines',
                description: 'List all active pipelines'
            },
            {
                method: 'GET',
                path: '/pipelines/:id',
                handler: async (req, res, params) => {
                    const pipelineId = params.id;
                    // TODO: 实现Pipeline详情查询
                    res.body = {
                        id: pipelineId,
                        provider: 'anthropic',
                        model: 'claude-3-sonnet',
                        status: 'running',
                        modules: [
                            { name: 'transformer', status: 'healthy', responseTime: 5 },
                            { name: 'protocol', status: 'healthy', responseTime: 12 },
                            { name: 'server-compatibility', status: 'healthy', responseTime: 8 },
                            { name: 'server', status: 'healthy', responseTime: 1180 }
                        ],
                        stats: {
                            activeRequests: 3,
                            totalProcessed: 856,
                            avgProcessingTime: 1200,
                            errorRate: 0.8
                        }
                    };
                },
                name: 'get-pipeline',
                description: 'Get pipeline details'
            },
            // 配置管理
            {
                method: 'GET',
                path: '/config',
                handler: async (req, res, params) => {
                    // TODO: 实现配置查询
                    res.body = {
                        server: {
                            port: 3456,
                            host: 'localhost',
                            debug: false
                        },
                        routing: {
                            defaultProvider: 'anthropic',
                            fallbackEnabled: false,
                            loadBalancing: 'round-robin'
                        },
                        rateLimit: {
                            maxRequests: 1000,
                            windowMs: 60000
                        },
                        auth: {
                            enabled: false,
                            type: 'apikey'
                        }
                    };
                },
                name: 'get-config',
                description: 'Get current configuration'
            },
            {
                method: 'PUT',
                path: '/config',
                handler: async (req, res, params) => {
                    // TODO: 实现配置更新
                    const config = req.body;
                    // 验证配置
                    if (!config) {
                        res.statusCode = 400;
                        res.body = { error: 'Configuration data required' };
                        return;
                    }
                    // 应用配置
                    res.body = {
                        message: 'Configuration updated successfully',
                        config
                    };
                },
                name: 'update-config',
                description: 'Update configuration'
            }
        ]
    };
    // 注册API路由组
    router.group(apiV1Routes);
    // 管理API路由组（需要认证）
    const adminRoutes = {
        prefix: '/api/admin',
        middleware: [
            (0, middleware_1.cors)({ origin: false }), // 仅允许同源请求
            (0, middleware_1.logger)({ level: 2, format: 'json' }),
            (0, middleware_1.rateLimit)({ maxRequests: 100, windowMs: 60000 }), // 更严格的限制
            (0, middleware_1.apiKeyAuth)(['admin-key-123']) // 需要管理员API密钥
        ],
        routes: [
            // 重启服务
            {
                method: 'POST',
                path: '/restart',
                handler: async (req, res, params) => {
                    // TODO: 实现服务重启
                    res.body = {
                        message: 'Server restart initiated',
                        estimatedDowntime: '5-10 seconds'
                    };
                },
                name: 'restart-server',
                description: 'Restart the server'
            },
            // 清除缓存
            {
                method: 'POST',
                path: '/cache/clear',
                handler: async (req, res, params) => {
                    // TODO: 实现缓存清除
                    res.body = {
                        message: 'Cache cleared successfully',
                        itemsCleared: 0
                    };
                },
                name: 'clear-cache',
                description: 'Clear all caches'
            },
            // 导出配置
            {
                method: 'GET',
                path: '/config/export',
                handler: async (req, res, params) => {
                    // TODO: 实现配置导出
                    res.headers['Content-Type'] = 'application/json';
                    res.headers['Content-Disposition'] = 'attachment; filename=\"rcc-config.json\"';
                    res.body = {
                        exportedAt: new Date().toISOString(),
                        version: '4.0.0-alpha.1',
                        config: {
                        // 配置数据
                        }
                    };
                },
                name: 'export-config',
                description: 'Export configuration as JSON'
            }
        ]
    };
    // 注册管理API路由组
    router.group(adminRoutes);
}
//# sourceMappingURL=api-routes.js.map