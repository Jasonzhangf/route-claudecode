"use strict";
/**
 * RCC v4.0 Router Preprocessor
 *
 * 一次性路由器预处理器 - 零接口暴露设计
 *
 * 设计理念：
 * - 只在系统初始化时运行一次
 * - 唯一的公开方法：preprocess()
 * - 所有内部方法使用下划线前缀，外部无法访问
 * - 输入：配置文件，输出：路由表和流水线配置
 * - 生命周期结束后即销毁，不保留任何引用
 *
 * @author Claude
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouterPreprocessor = void 0;
/**
 * 路由预处理错误类
 */
class _RouterPreprocessError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'RouterPreprocessError';
    }
}
/**
 * 路由器预处理器 - 静态类，零接口暴露
 *
 * 外部只能访问preprocess()方法
 * 所有内部逻辑使用下划线前缀，完全封装
 */
class RouterPreprocessor {
    /**
     * 路由器预处理主方法 - 唯一的公开接口
     *
     * @param routingTable 来自ConfigPreprocessor的路由表
     * @returns 预处理结果，包含路由表和流水线配置
     */
    static async preprocess(routingTable) {
        const startTime = Date.now();
        // Router preprocessing started
        try {
            // 1. 验证输入
            this._validateInput(routingTable);
            // 2. 生成内部路由表
            const internalRoutingTable = this._generateInternalRoutingTable(routingTable);
            // 3. 生成流水线配置
            const pipelineConfigs = this._generatePipelineConfigs(routingTable);
            // 4. 验证生成结果
            const validationErrors = this._validateResults(internalRoutingTable, pipelineConfigs);
            // 5. 计算处理统计
            const processingTimeMs = Date.now() - startTime;
            const stats = {
                routesCount: Object.keys(internalRoutingTable.routes).length,
                pipelinesCount: pipelineConfigs.length,
                processingTimeMs
            };
            // Router preprocessing completed
            return {
                success: validationErrors.length === 0,
                routingTable: validationErrors.length === 0 ? internalRoutingTable : undefined,
                pipelineConfigs: validationErrors.length === 0 ? pipelineConfigs : undefined,
                errors: validationErrors,
                warnings: [],
                stats
            };
        }
        catch (err) {
            const processingTimeMs = Date.now() - startTime;
            const error = err;
            // Router preprocessing failed
            return {
                success: false,
                errors: [error.message],
                warnings: [],
                stats: {
                    routesCount: 0,
                    pipelinesCount: 0,
                    processingTimeMs
                }
            };
        }
    }
    /**
     * 验证输入参数（内部方法）
     */
    static _validateInput(routingTable) {
        if (!routingTable) {
            throw new _RouterPreprocessError('路由表不能为空', 'INVALID_INPUT');
        }
        if (!routingTable.providers || routingTable.providers.length === 0) {
            throw new _RouterPreprocessError('路由表中没有Provider配置', 'NO_PROVIDERS');
        }
        if (!routingTable.routes || Object.keys(routingTable.routes).length === 0) {
            throw new _RouterPreprocessError('路由表中没有路由配置', 'NO_ROUTES');
        }
    }
    /**
     * 生成内部路由表（内部方法）
     */
    static _generateInternalRoutingTable(routingTable) {
        const routes = {};
        // 为每个路由生成流水线路由
        for (const [routeName, routeSpec] of Object.entries(routingTable.routes)) {
            // 解析路由规格："provider,model"
            const [provider, model] = routeSpec.split(',');
            const targetModel = routeName; // 路由名称作为目标模型
            const pipelineRoute = {
                routeId: `route_${routeName}_${provider}`,
                routeName: routeName,
                virtualModel: targetModel,
                provider: provider.trim(),
                apiKeyIndex: 0, // 默认使用第一个API密钥
                pipelineId: `pipeline_${provider.trim()}_${model.trim()}`,
                isActive: true,
                health: 'healthy'
            };
            if (!routes[targetModel]) {
                routes[targetModel] = [];
            }
            routes[targetModel].push(pipelineRoute);
        }
        // 按Provider优先级排序
        for (const targetModel in routes) {
            routes[targetModel].sort((a, b) => {
                const providerA = routingTable.providers.find(p => p.name === a.provider);
                const providerB = routingTable.providers.find(p => p.name === b.provider);
                return (providerB?.priority || 0) - (providerA?.priority || 0);
            });
        }
        return {
            routes,
            defaultRoute: 'default', // 默认路由名称
            metadata: {
                configSource: 'ConfigPreprocessor',
                generatedAt: new Date().toISOString(),
                preprocessorVersion: this._VERSION
            }
        };
    }
    /**
     * 生成流水线配置（内部方法）
     */
    static _generatePipelineConfigs(routingTable) {
        const pipelineConfigs = [];
        for (const [routeName, routeSpec] of Object.entries(routingTable.routes)) {
            // 解析路由规格："provider,model"
            const [providerName, modelName] = routeSpec.split(',');
            const provider = routingTable.providers.find(p => p.name === providerName.trim());
            if (!provider) {
                // Provider not found for route
                continue;
            }
            const pipelineConfig = {
                pipelineId: `pipeline_${providerName.trim()}_${modelName.trim()}`,
                routeId: `route_${routeName}_${providerName.trim()}`,
                provider: providerName.trim(),
                model: modelName.trim(),
                endpoint: provider.api_base_url,
                apiKey: provider.api_key,
                timeout: 60000, // 默认超时
                maxRetries: 3, // 默认重试次数
                layers: this._generateLayerConfigs(provider, { routeName, providerName: providerName.trim(), modelName: modelName.trim() })
            };
            pipelineConfigs.push(pipelineConfig);
        }
        return pipelineConfigs;
    }
    /**
     * 生成层配置（内部方法）
     */
    static _generateLayerConfigs(provider, route) {
        return this._DEFAULT_LAYERS.map(layer => ({
            ...layer,
            config: {
                ...layer.config,
                provider: provider.name,
                model: route.modelName,
                endpoint: provider.api_base_url,
                apiKey: provider.api_key,
                timeout: 60000
            }
        }));
    }
    /**
     * 验证生成结果（内部方法）
     */
    static _validateResults(routingTable, pipelineConfigs) {
        const errors = [];
        // 验证路由表
        if (!routingTable.routes || Object.keys(routingTable.routes).length === 0) {
            errors.push('生成的路由表为空');
        }
        if (!routingTable.defaultRoute) {
            errors.push('缺少默认路由');
        }
        // 验证流水线配置
        if (!pipelineConfigs || pipelineConfigs.length === 0) {
            errors.push('没有生成流水线配置');
        }
        // 验证流水线配置完整性
        for (const config of pipelineConfigs) {
            if (!config.pipelineId) {
                errors.push(`流水线配置缺少ID: ${config.provider}-${config.model}`);
            }
            if (!config.endpoint) {
                errors.push(`流水线配置缺少端点: ${config.pipelineId}`);
            }
            if (!config.layers || config.layers.length === 0) {
                errors.push(`流水线配置缺少层定义: ${config.pipelineId}`);
            }
        }
        return errors;
    }
}
exports.RouterPreprocessor = RouterPreprocessor;
/**
 * 预处理器版本（内部）
 */
RouterPreprocessor._VERSION = '4.1.0';
/**
 * 默认流水线层配置（内部）
 */
RouterPreprocessor._DEFAULT_LAYERS = [
    { name: 'client', type: 'client', order: 1, config: {} },
    { name: 'router', type: 'router', order: 2, config: {} },
    { name: 'transformer', type: 'transformer', order: 3, config: {} },
    { name: 'protocol', type: 'protocol', order: 4, config: {} },
    { name: 'server-compatibility', type: 'server-compatibility', order: 5, config: {} },
    { name: 'server', type: 'server', order: 6, config: {} }
];
//# sourceMappingURL=router-preprocessor.js.map