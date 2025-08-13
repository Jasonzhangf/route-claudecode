/**
 * V3.0 Gemini Client Factory - Real API Implementation
 * 基于demo3模式，实现Gemini API真实通信
 *
 * Project owner: Jason Zhang
 */
import axios from 'axios';
import { getLogger } from '../../logging/index.js';

const logger = getLogger();

export function createGeminiClient(config, id) {
    logger.info(`🔧 V3 Creating Gemini client for ${id}`, {
        endpoint: config.endpoint,
        models: config.models?.length || 0
    });

    // 处理Gemini endpoint
    const baseURL = config.endpoint || 'https://generativelanguage.googleapis.com';
    
    // 创建axios实例
    const axiosInstance = axios.create({
        baseURL: baseURL,
        headers: {
            'Content-Type': 'application/json'
        },
        timeout: config.timeout || 60000
    });

    return {
        name: config.name || `Gemini ${id}`,
        
        async isHealthy() {
            try {
                // Gemini健康检查 - 尝试列出模型
                const apiKey = getApiKey(config);
                const response = await axiosInstance.get(`/v1beta/models?key=${apiKey}`, { 
                    timeout: 5000 
                });
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
                logger.debug(`Gemini sendRequest for ${id}`, {
                    model: request.model,
                    hasTools: !!(request.tools && request.tools.length > 0)
                });

                // 转换为Gemini格式
                const geminiRequest = convertToGeminiFormat(request);
                const apiKey = getApiKey(config);
                
                const response = await axiosInstance.post(
                    `/v1beta/models/${request.model}:generateContent?key=${apiKey}`,
                    geminiRequest
                );
                
                return response.data;
                
            } catch (error) {
                logger.error(`Gemini sendRequest failed for ${id}`, {
                    error: error.message,
                    status: error.response?.status,
                    model: request.model
                });
                throw error;
            }
        },

        async sendStreamRequest(request) {
            try {
                logger.debug(`Gemini sendStreamRequest for ${id}`, {
                    model: request.model,
                    hasTools: !!(request.tools && request.tools.length > 0)
                });

                // Gemini流式请求
                const geminiRequest = convertToGeminiFormat(request);
                const apiKey = getApiKey(config);
                
                const response = await axiosInstance.post(
                    `/v1beta/models/${request.model}:streamGenerateContent?key=${apiKey}`,
                    geminiRequest,
                    { responseType: 'stream' }
                );

                return response.data; // 直接返回stream，让transformer处理
                
            } catch (error) {
                logger.error(`Gemini sendStreamRequest failed for ${id}`, {
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
 * 获取API密钥
 */
function getApiKey(config) {
    if (config.authentication?.credentials?.apiKeys) {
        const keys = config.authentication.credentials.apiKeys;
        return keys[Math.floor(Math.random() * keys.length)];
    }
    return config.apiKey || config.authentication?.credentials?.apiKey;
}

/**
 * 将请求转换为Gemini格式
 */
function convertToGeminiFormat(request) {
    const geminiRequest = {
        contents: [],
        generationConfig: {}
    };

    // 转换messages
    if (request.messages) {
        for (const message of request.messages) {
            if (message.role === 'system') {
                // Gemini的system instruction需要特殊处理
                continue; // 暂时跳过system messages
            } else if (message.role === 'user') {
                geminiRequest.contents.push({
                    role: 'user',
                    parts: [{ text: message.content }]
                });
            } else if (message.role === 'assistant') {
                geminiRequest.contents.push({
                    role: 'model',
                    parts: [{ text: message.content }]
                });
            }
        }
    }

    // 转换参数
    if (request.max_tokens) {
        geminiRequest.generationConfig.maxOutputTokens = request.max_tokens;
    }
    if (request.temperature !== undefined) {
        geminiRequest.generationConfig.temperature = request.temperature;
    }
    if (request.top_p !== undefined) {
        geminiRequest.generationConfig.topP = request.top_p;
    }

    // 工具调用支持（简化版本）
    if (request.tools && request.tools.length > 0) {
        geminiRequest.tools = request.tools.map(tool => ({
            functionDeclarations: [{
                name: tool.name || tool.function?.name,
                description: tool.description || tool.function?.description,
                parameters: tool.input_schema || tool.function?.parameters
            }]
        }));
    }

    return geminiRequest;
}