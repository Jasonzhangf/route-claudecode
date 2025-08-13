/**
 * V3.0 OpenAI Client Factory - Pure API Communication
 * 基于demo3模式，专注于纯API通信
 *
 * Project owner: Jason Zhang
 */
import axios from 'axios';
import { getLogger } from '../../logging/index.js';

const logger = getLogger();

export function createOpenAIClient(config, id) {
    logger.info(`🔧 V3 Creating OpenAI client for ${id}`, {
        endpoint: config.endpoint,
        models: config.models?.length || 0
    });

    // 处理endpoint - 从完整URL提取base URL
    const baseURL = config.endpoint.replace(/\/chat\/completions$/, '');
    
    // 创建axios实例
    const axiosInstance = axios.create({
        baseURL: baseURL,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getApiKey(config)}`
        },
        timeout: config.timeout || 60000
    });

    return {
        name: config.name || `OpenAI ${id}`,
        
        async isHealthy() {
            try {
                // 简单的健康检查
                const response = await axiosInstance.get('/models', { timeout: 5000 });
                return response.status === 200;
            } catch (error) {
                logger.warn(`Health check failed for ${id}`, {
                    error: error.message,
                    status: error.response?.status
                });
                return false;
            }
        },

        async sendRequest(request) {
            try {
                logger.debug(`OpenAI sendRequest for ${id}`, {
                    model: request.model,
                    hasTools: !!(request.tools && request.tools.length > 0)
                });

                const response = await axiosInstance.post('/chat/completions', request);
                return response.data;
                
            } catch (error) {
                logger.error(`OpenAI sendRequest failed for ${id}`, {
                    error: error.message,
                    status: error.response?.status,
                    model: request.model
                });
                throw error;
            }
        },

        async sendStreamRequest(request) {
            try {
                logger.debug(`OpenAI sendStreamRequest for ${id}`, {
                    model: request.model,
                    hasTools: !!(request.tools && request.tools.length > 0)
                });

                // 设置流式请求
                const streamRequest = { ...request, stream: true };
                const response = await axiosInstance.post('/chat/completions', streamRequest, {
                    responseType: 'stream'
                });

                return response.data; // 直接返回stream，让transformer处理
                
            } catch (error) {
                logger.error(`OpenAI sendStreamRequest failed for ${id}`, {
                    error: error.message,
                    status: error.response?.status,
                    model: request.model
                });
                throw error;
            }
        }
    };
}

/**
 * 获取API密钥（支持多密钥轮询）
 */
function getApiKey(config) {
    if (config.authentication?.credentials?.apiKeys) {
        const keys = config.authentication.credentials.apiKeys;
        // 简单轮询选择
        return keys[Math.floor(Math.random() * keys.length)];
    }
    return config.apiKey || config.authentication?.credentials?.apiKey;
}