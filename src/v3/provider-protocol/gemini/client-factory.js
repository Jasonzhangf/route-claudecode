/**
 * Gemini Client Factory
 * 创建和管理Gemini API客户端实例，基于官方Google Generative AI SDK
 * @author Jason Zhang
 */

import { GeminiClient } from './gemini-client.js';
import { getLogger } from '../../logging/index.js';

const logger = getLogger();

export class GeminiClientFactory {
    static createClient(config) {
        logger.debug('Creating Gemini client', {
            hasApiKey: !!(config.apiKey),
            endpoint: config.endpoint || 'Official Gemini API',
            models: config.models || ['gemini-1.5-pro-latest']
        });

        // 验证配置
        if (!config.apiKey) {
            throw new Error('Gemini API key is required for client creation');
        }

        // 创建Gemini客户端实例
        const client = new GeminiClient(config);

        // 返回标准化的客户端接口
        return {
            type: 'gemini',
            provider: 'gemini',
            endpoint: config.endpoint || 'https://generativelanguage.googleapis.com',
            
            // 非流式请求
            sendRequest: async (request, context) => {
                return await client.sendRequest(request, context);
            },

            // 流式请求
            sendStreamRequest: async (request, context) => {
                return client.sendStreamRequest(request, context);
            },

            // 健康检查
            healthCheck: async () => {
                return await client.healthCheck();
            },

            // 获取支持的模型
            getSupportedModels: () => {
                return config.models || [
                    'gemini-2.0-flash-exp',
                    'gemini-1.5-pro-latest',
                    'gemini-1.5-flash',
                    'gemini-1.5-flash-8b'
                ];
            },

            // 客户端配置信息
            getConfig: () => {
                return {
                    type: 'gemini',
                    timeout: config.timeout || 30000,
                    maxRetries: config.maxRetries || 3,
                    retryDelay: config.retryDelay || 1000
                };
            }
        };
    }

    /**
     * 验证Gemini配置
     */
    static validateConfig(config) {
        const errors = [];

        if (!config.apiKey) {
            errors.push('Missing required field: apiKey');
        }

        if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
            errors.push('Timeout must be between 1000ms and 300000ms');
        }

        if (config.maxRetries && (config.maxRetries < 0 || config.maxRetries > 10)) {
            errors.push('MaxRetries must be between 0 and 10');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * 创建带验证的客户端
     */
    static createValidatedClient(config) {
        const validation = this.validateConfig(config);
        
        if (!validation.valid) {
            const errorMessage = `Invalid Gemini configuration: ${validation.errors.join(', ')}`;
            logger.error(errorMessage);
            throw new Error(errorMessage);
        }

        return this.createClient(config);
    }
}

/**
 * 保持向后兼容的工厂函数
 */
export function createGeminiClient(config, id) {
    logger.debug(`Creating Gemini client using legacy interface for ${id}`);
    
    // 转换配置格式
    const standardConfig = {
        apiKey: config.apiKey || config.authentication?.credentials?.apiKey,
        models: config.models,
        timeout: config.timeout || 60000,
        maxRetries: config.maxRetries || 3,
        retryDelay: config.retryDelay || 1000
    };

    // 处理多API密钥
    if (config.authentication?.credentials?.apiKeys) {
        const keys = config.authentication.credentials.apiKeys;
        standardConfig.apiKey = keys[Math.floor(Math.random() * keys.length)];
    }

    const client = GeminiClientFactory.createValidatedClient(standardConfig);

    // 返回向后兼容的接口
    return {
        name: config.name || `Gemini ${id}`,
        
        async isHealthy() {
            try {
                const health = await client.healthCheck();
                return health.healthy;
            } catch (error) {
                logger.warn(`Health check failed for ${id}`, error);
                return false;
            }
        },

        async sendRequest(request) {
            const context = { requestId: `legacy_${Date.now()}`, providerId: id };
            return await client.sendRequest(request, context);
        },

        async sendStreamRequest(request) {
            const context = { requestId: `legacy_stream_${Date.now()}`, providerId: id };
            return client.sendStreamRequest(request, context);
        }
    };
}