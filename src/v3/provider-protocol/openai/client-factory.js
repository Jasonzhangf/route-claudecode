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
            // Return an AsyncIterable that implements Symbol.asyncIterator
            return {
                async *[Symbol.asyncIterator]() {
            try {
                logger.debug(`OpenAI sendStreamRequest for ${id}`, {
                    model: request.model,
                    hasTools: !!(request.tools && request.tools.length > 0)
                });

                // 根据用户要求：强制转化为非流式请求到预处理器，然后模拟流式响应返回
                // Convert streaming request to non-streaming request to provider
                const nonStreamRequest = { ...request, stream: false };
                
                // Send non-streaming request to the actual provider
                const response = await axiosInstance.post('/chat/completions', nonStreamRequest);
                const data = response.data;
                
                // Simulate streaming response by chunking the response
                if (data.choices?.[0]?.message?.content) {
                    const content = data.choices[0].message.content;
                    const words = content.split(' ');
                    
                    // Yield message start
                    yield {
                        type: 'message_start',
                        message: {
                            id: data.id || `msg-openai-${Date.now()}`,
                            type: 'message',
                            role: 'assistant',
                            content: [],
                            model: request.model,
                            usage: {
                                input_tokens: data.usage?.prompt_tokens || 0,
                                output_tokens: 0
                            }
                        }
                    };
                    
                    // Yield content block start
                    yield {
                        type: 'content_block_start',
                        index: 0,
                        content_block: {
                            type: 'text',
                            text: ''
                        }
                    };
                    
                    // Yield content deltas (word by word to simulate streaming)
                    for (let i = 0; i < words.length; i++) {
                        const word = words[i] + (i < words.length - 1 ? ' ' : '');
                        yield {
                            type: 'content_block_delta',
                            index: 0,
                            delta: {
                                type: 'text_delta',
                                text: word
                            }
                        };
                        
                        // Small delay to simulate streaming
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                    
                    // Yield content block stop
                    yield {
                        type: 'content_block_stop',
                        index: 0
                    };
                    
                    // Handle tool calls if present
                    if (data.choices[0].message.tool_calls) {
                        for (const toolCall of data.choices[0].message.tool_calls) {
                            yield {
                                type: 'content_block_start',
                                index: 1,
                                content_block: {
                                    type: 'tool_use',
                                    id: toolCall.id,
                                    name: toolCall.function.name,
                                    input: JSON.parse(toolCall.function.arguments)
                                }
                            };
                            
                            yield {
                                type: 'content_block_stop',
                                index: 1
                            };
                        }
                    }
                    
                    // Yield message delta with stop reason and usage
                    yield {
                        type: 'message_delta',
                        delta: {
                            stop_reason: mapFinishReason(data.choices[0].finish_reason),
                            usage: {
                                output_tokens: data.usage?.completion_tokens || 0
                            }
                        }
                    };
                    
                    // Yield message stop
                    yield {
                        type: 'message_stop'
                    };
                } else {
                    // Fallback for empty response
                    yield {
                        type: 'error',
                        error: {
                            type: 'invalid_request_error',
                            message: 'No content in provider response'
                        }
                    };
                }
                
            } catch (error) {
                logger.error(`OpenAI sendStreamRequest failed for ${id}`, {
                    error: error.message,
                    status: error.response?.status,
                    model: request.model
                });
                
                // Yield error event
                yield {
                    type: 'error',
                    error: {
                        type: 'api_error',
                        message: error.message
                    }
                };
            }
                }
            };
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

/**
 * Map OpenAI finish reason to Anthropic format
 */
function mapFinishReason(openAIReason) {
    switch (openAIReason) {
        case 'stop': return 'end_turn';
        case 'length': return 'max_tokens';
        case 'tool_calls': return 'tool_use';
        default: return 'end_turn';
    }
}