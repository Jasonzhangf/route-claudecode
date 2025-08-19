"use strict";
/**
 * Provider工厂
 *
 * 统一创建和管理各种Protocol处理器实例
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderFactory = void 0;
const openai_protocol_handler_1 = require("./openai-protocol-handler");
const anthropic_protocol_handler_1 = require("./anthropic-protocol-handler");
/**
 * Provider工厂类
 */
class ProviderFactory {
    constructor() {
        this.createdProviders = new Map();
    }
    /**
     * 获取工厂单例
     */
    static getInstance() {
        if (!ProviderFactory.instance) {
            ProviderFactory.instance = new ProviderFactory();
        }
        return ProviderFactory.instance;
    }
    /**
     * 创建Provider实例
     */
    createProvider(options) {
        const { id, type, config, debug = false } = options;
        // 检查是否已经创建过相同ID的Provider
        if (this.createdProviders.has(id)) {
            throw new Error(`Provider with ID '${id}' already exists`);
        }
        let provider;
        try {
            switch (type) {
                case 'openai':
                    provider = new openai_protocol_handler_1.OpenAIProtocolHandler(id, {
                        ...config,
                        debug,
                    });
                    break;
                case 'anthropic':
                    provider = new anthropic_protocol_handler_1.AnthropicProtocolHandler(id, {
                        ...config,
                        debug,
                    });
                    break;
                case 'gemini':
                    // TODO: 实现Gemini Protocol处理器
                    throw new Error('Gemini Protocol handler not implemented yet');
                default:
                    throw new Error(`Unsupported provider protocol type: ${type}`);
            }
            // 缓存已创建的Provider
            this.createdProviders.set(id, provider);
            if (debug) {
                console.log(`[ProviderFactory] Created ${type} provider with ID: ${id}`);
            }
            return provider;
        }
        catch (error) {
            if (debug) {
                console.error(`[ProviderFactory] Failed to create ${type} provider with ID: ${id}`, error);
            }
            throw error;
        }
    }
    /**
     * 批量创建Provider实例
     */
    createProviders(configs, debug = false) {
        const providers = [];
        const errors = [];
        for (const providerConfig of configs) {
            if (!providerConfig.enabled) {
                if (debug) {
                    console.log(`[ProviderFactory] Skipping disabled provider: ${providerConfig.id}`);
                }
                continue;
            }
            try {
                const provider = this.createProvider({
                    id: providerConfig.id,
                    type: providerConfig.type,
                    config: providerConfig.config,
                    debug,
                });
                providers.push(provider);
            }
            catch (error) {
                const errorInfo = {
                    id: providerConfig.id,
                    error: error,
                };
                errors.push(errorInfo);
                if (debug) {
                    console.error(`[ProviderFactory] Failed to create provider ${providerConfig.id}:`, error);
                }
            }
        }
        // 如果有错误，记录但不阻止其他Provider的创建
        if (errors.length > 0) {
            console.warn(`[ProviderFactory] Created ${providers.length} providers, failed to create ${errors.length} providers`);
            // 可以选择抛出聚合错误或只是警告
            if (providers.length === 0) {
                throw new Error(`Failed to create any providers. Errors: ${errors.map(e => `${e.id}: ${e.error.message}`).join(', ')}`);
            }
        }
        return providers;
    }
    /**
     * 获取已创建的Provider
     */
    getProvider(id) {
        return this.createdProviders.get(id);
    }
    /**
     * 获取所有已创建的Provider
     */
    getAllProviders() {
        return Array.from(this.createdProviders.values());
    }
    /**
     * 检查Provider是否存在
     */
    hasProvider(id) {
        return this.createdProviders.has(id);
    }
    /**
     * 销毁Provider实例
     */
    async destroyProvider(id) {
        const provider = this.createdProviders.get(id);
        if (!provider) {
            return false;
        }
        try {
            // 停止Provider
            await provider.stop();
            // 从缓存中移除
            this.createdProviders.delete(id);
            console.log(`[ProviderFactory] Destroyed provider: ${id}`);
            return true;
        }
        catch (error) {
            console.error(`[ProviderFactory] Failed to destroy provider ${id}:`, error);
            return false;
        }
    }
    /**
     * 销毁所有Provider实例
     */
    async destroyAllProviders() {
        const destroyPromises = Array.from(this.createdProviders.keys()).map(id => this.destroyProvider(id));
        await Promise.all(destroyPromises);
        console.log(`[ProviderFactory] Destroyed all providers`);
    }
    /**
     * 获取支持的Provider Protocol类型
     */
    getSupportedTypes() {
        return ['openai', 'anthropic']; // 'gemini' 将在后续实现
    }
    /**
     * 验证Provider配置
     */
    validateProviderConfig(config) {
        const errors = [];
        // 基础字段验证
        if (!config.id || typeof config.id !== 'string') {
            errors.push('Provider ID is required and must be a string');
        }
        if (!config.type || !this.getSupportedTypes().includes(config.type)) {
            errors.push(`Provider type must be one of: ${this.getSupportedTypes().join(', ')}`);
        }
        if (typeof config.enabled !== 'boolean') {
            errors.push('Provider enabled field must be a boolean');
        }
        if (!config.config || typeof config.config !== 'object') {
            errors.push('Provider config is required and must be an object');
        }
        // 特定协议配置验证
        if (config.type === 'openai' || config.type === 'anthropic') {
            const protocolConfig = config.config;
            if (!protocolConfig.apiKey) {
                errors.push(`${config.type} provider requires apiKey in config`);
            }
            if (!protocolConfig.defaultModel) {
                errors.push(`${config.type} provider requires defaultModel in config`);
            }
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    /**
     * 获取工厂状态信息
     */
    getFactoryStatus() {
        const providers = this.getAllProviders();
        return {
            totalProviders: providers.length,
            providerIds: providers.map(p => p.getId()),
            supportedTypes: this.getSupportedTypes(),
            createdAt: new Date().toISOString(),
        };
    }
}
exports.ProviderFactory = ProviderFactory;
//# sourceMappingURL=provider-factory.js.map