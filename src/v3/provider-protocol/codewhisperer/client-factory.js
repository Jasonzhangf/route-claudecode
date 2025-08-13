/**
 * CodeWhisperer Client Factory - V3.0 Six-Layer Architecture
 * 统一的CodeWhisperer客户端创建和验证工厂
 * 
 * Project owner: Jason Zhang
 */

import { CodewhispererClient } from './codewhisperer-client.js';

export class CodewhispererClientFactory {
    /**
     * 创建并验证CodeWhisperer客户端
     * @param {Object} config - 客户端配置
     * @param {string} id - 客户端ID
     * @returns {CodewhispererClient} 验证过的客户端实例
     */
    static createValidatedClient(config, id = 'default') {
        // 验证必需的配置
        if (!config) {
            throw new Error('CodeWhisperer client config is required');
        }

        // 设置默认配置
        const clientConfig = {
            type: 'codewhisperer',
            endpoint: config.endpoint || 'https://codewhisperer.us-east-1.amazonaws.com',
            timeout: config.timeout || 120000,
            retryDelays: config.retryDelays || [1000, 2000, 4000],
            
            // 认证配置
            authentication: {
                type: config.authentication?.type || 'bearer',
                credPath: config.authentication?.credPath,
                credsBase64: config.authentication?.credsBase64,
                credsFilePath: config.authentication?.credsFilePath,
                region: config.authentication?.region || 'us-east-1'
            },

            // 模型配置
            defaultModel: config.defaultModel || 'CLAUDE_SONNET_4_20250514_V1_0',
            models: config.models || [
                'CLAUDE_SONNET_4_20250514_V1_0',
                'CLAUDE_3_7_SONNET_20250219_V1_0'
            ],

            // 其他配置
            ...config
        };

        // 验证认证配置
        const authConfig = clientConfig.authentication;
        if (!authConfig.credsBase64 && !authConfig.credsFilePath && !authConfig.credPath) {
            console.warn(`[CodewhispererClientFactory] No authentication credentials configured for client ${id}`);
        }

        // 创建客户端实例
        try {
            const client = new CodewhispererClient(clientConfig, id);
            
            console.log(`[CodewhispererClientFactory] Created CodeWhisperer client: ${id}`, {
                endpoint: clientConfig.endpoint,
                region: authConfig.region,
                models: clientConfig.models.length
            });

            return client;
        } catch (error) {
            console.error(`[CodewhispererClientFactory] Failed to create CodeWhisperer client ${id}:`, error.message);
            throw new Error(`Failed to create CodeWhisperer client: ${error.message}`);
        }
    }

    /**
     * 验证CodeWhisperer配置
     * @param {Object} config - 配置对象
     * @returns {Object} 验证结果
     */
    static validateConfig(config) {
        const errors = [];
        const warnings = [];

        if (!config) {
            errors.push('Config is required');
            return { valid: false, errors, warnings };
        }

        // 检查认证配置
        const authConfig = config.authentication;
        if (!authConfig) {
            warnings.push('No authentication config provided');
        } else {
            if (!authConfig.credsBase64 && !authConfig.credsFilePath && !authConfig.credPath) {
                warnings.push('No authentication credentials configured');
            }

            if (authConfig.region && !authConfig.region.match(/^[a-z]+-[a-z]+-\d+$/)) {
                warnings.push(`Invalid region format: ${authConfig.region}`);
            }
        }

        // 检查端点配置
        if (config.endpoint) {
            try {
                new URL(config.endpoint);
            } catch (error) {
                errors.push(`Invalid endpoint URL: ${config.endpoint}`);
            }
        }

        // 检查超时配置
        if (config.timeout && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
            errors.push('Timeout must be a positive number');
        }

        // 检查重试延迟配置
        if (config.retryDelays && !Array.isArray(config.retryDelays)) {
            errors.push('retryDelays must be an array');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * 创建多个CodeWhisperer客户端实例
     * @param {Object} configs - 配置对象映射 {id: config}
     * @returns {Object} 客户端实例映射 {id: client}
     */
    static createMultipleClients(configs) {
        const clients = {};
        const errors = [];

        for (const [id, config] of Object.entries(configs)) {
            try {
                clients[id] = this.createValidatedClient(config, id);
            } catch (error) {
                errors.push(`Failed to create client ${id}: ${error.message}`);
            }
        }

        if (errors.length > 0) {
            console.warn('[CodewhispererClientFactory] Some clients failed to create:', errors);
        }

        return clients;
    }

    /**
     * 获取默认配置模板
     * @returns {Object} 默认配置
     */
    static getDefaultConfig() {
        return {
            type: 'codewhisperer',
            endpoint: 'https://codewhisperer.us-east-1.amazonaws.com',
            timeout: 120000,
            retryDelays: [1000, 2000, 4000],
            
            authentication: {
                type: 'bearer',
                region: 'us-east-1',
                credPath: null, // 用户需要配置
                credsBase64: null, // 或者配置Base64编码的凭证
                credsFilePath: null // 或者配置具体文件路径
            },

            defaultModel: 'CLAUDE_SONNET_4_20250514_V1_0',
            models: [
                'CLAUDE_SONNET_4_20250514_V1_0',
                'CLAUDE_3_7_SONNET_20250219_V1_0'
            ]
        };
    }

    /**
     * 检查客户端健康状态
     * @param {CodewhispererClient} client - 客户端实例
     * @returns {Object} 健康检查结果
     */
    static async checkClientHealth(client) {
        try {
            return await client.healthCheck();
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}