/**
 * V3.0 OpenAI Client Factory - Pure API Communication
 * 基于demo3模式，专注于纯API通信
 *
 * Project owner: Jason Zhang
 */
import axios from 'axios';
import { getLogger } from '../../logging/index.js';
import { LMStudioOpenAIPreprocessor } from '../../preprocessor/lmstudio-openai-preprocessor.js';

const logger = getLogger();

export function createOpenAIClient(config, id) {
    logger.info(`🔧 V3 Creating OpenAI client for ${id}`, {
        endpoint: config.endpoint,
        models: config.models?.length || 0
    });

    // 处理endpoint - 从完整URL提取base URL
    const baseURL = config.endpoint.replace(/\/chat\/completions$/, '');
    
    // 检测是否为LM Studio并创建相应的预处理器
    const isLMStudio = config.endpoint.includes('localhost:1234') || config.endpoint.includes('127.0.0.1:1234');
    let preprocessor = null;
    if (isLMStudio) {
        preprocessor = new LMStudioOpenAIPreprocessor(config);
        logger.debug(`LM Studio preprocessor created for ${id}`);
    }
    
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
        id: id,
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

                // 如果有预处理器，先预处理请求
                let processedRequest = request;
                if (preprocessor) {
                    processedRequest = await preprocessor.processRequest(request, { 
                        providerId: id, 
                        config: config 
                    });
                    logger.debug(`Request preprocessed for LM Studio ${id}`, {
                        originalTools: request.tools?.length || 0,
                        processedTools: processedRequest.tools?.length || 0
                    });
                }

                const response = await axiosInstance.post('/chat/completions', processedRequest);
                
                // 如果有预处理器，后处理响应
                if (preprocessor) {
                    return await preprocessor.postprocessResponse(response.data, request, { 
                        providerId: id, 
                        config: config 
                    });
                }
                
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

        async *sendStreamRequest(request) {
            try {
                logger.debug(`OpenAI sendStreamRequest for ${id}`, {
                    model: request.model,
                    hasTools: !!(request.tools && request.tools.length > 0)
                });

                // 如果有预处理器，先预处理请求
                let processedRequest = { ...request, stream: false };
                if (preprocessor) {
                    processedRequest = await preprocessor.processRequest(processedRequest, { 
                        providerId: id, 
                        config: config 
                    });
                    logger.debug(`Stream request preprocessed for LM Studio ${id}`, {
                        originalTools: request.tools?.length || 0,
                        processedTools: processedRequest.tools?.length || 0
                    });
                }
                
                // Send non-streaming request to the actual provider
                const response = await axiosInstance.post('/chat/completions', processedRequest);
                let data = response.data;
                
                // 如果有预处理器，后处理响应
                if (preprocessor) {
                    data = await preprocessor.postprocessResponse(data, request, { 
                        providerId: id, 
                        config: config 
                    });
                    logger.debug(`Stream response postprocessed for LM Studio ${id}`, {
                        hasContent: !!(data.content && data.content.length > 0)
                    });
                }
                
                // 处理后处理器返回的Anthropic格式或原始OpenAI格式
                // 如果data是Anthropic格式(来自LM Studio preprocessor)，转换为适合流式的格式
                if (data.content && Array.isArray(data.content)) {
                    // Anthropic格式：直接流式处理content数组
                    yield {
                        type: 'message_start',
                        message: {
                            id: data.id || `msg-${Date.now()}`,
                            type: 'message',
                            role: 'assistant',
                            content: [],
                            model: request.model,
                            usage: {
                                input_tokens: data.usage?.input_tokens || 0,
                                output_tokens: 0
                            }
                        }
                    };

                    // 处理每个content项
                    for (let i = 0; i < data.content.length; i++) {
                        const contentItem = data.content[i];
                        
                        if (contentItem.type === 'text') {
                            // 文本内容
                            yield {
                                type: 'content_block_start',
                                index: i,
                                content_block: {
                                    type: 'text',
                                    text: ''
                                }
                            };

                            // 模拟流式输出
                            const words = contentItem.text.split(' ');
                            for (let j = 0; j < words.length; j++) {
                                const word = words[j] + (j < words.length - 1 ? ' ' : '');
                                yield {
                                    type: 'content_block_delta',
                                    index: i,
                                    delta: {
                                        type: 'text_delta',
                                        text: word
                                    }
                                };
                                await new Promise(resolve => setTimeout(resolve, 50));
                            }

                            yield {
                                type: 'content_block_stop',
                                index: i
                            };
                        } else if (contentItem.type === 'tool_use') {
                            // 工具调用
                            yield {
                                type: 'content_block_start',
                                index: i,
                                content_block: {
                                    type: 'tool_use',
                                    id: contentItem.id,
                                    name: contentItem.name,
                                    input: contentItem.input
                                }
                            };
                            
                            yield {
                                type: 'content_block_stop',
                                index: i
                            };
                        }
                    }

                    // 完成消息
                    yield {
                        type: 'message_delta',
                        delta: {
                            stop_reason: data.stop_reason || 'end_turn',
                            usage: {
                                output_tokens: data.usage?.output_tokens || 0
                            }
                        }
                    };
                    
                    yield {
                        type: 'message_stop'
                    };
                    
                } else if (data.choices?.[0]?.message?.content) {
                    // 原始OpenAI格式处理
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