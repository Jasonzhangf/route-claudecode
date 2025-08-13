/**
 * V3.0 Transformers Manager
 * 负责不同格式之间的转换（Anthropic ↔ OpenAI ↔ Gemini）
 * @author Jason Zhang
 */
import { getLogger } from '../logging/index.js';

const logger = getLogger();

/**
 * 格式转换器
 */
class FormatTransformer {
    /**
     * 将Anthropic格式转换为OpenAI格式
     */
    static anthropicToOpenAI(anthropicRequest) {
        const openaiRequest = {
            model: anthropicRequest.model,
            messages: [],
            stream: anthropicRequest.stream || false
        };

        // 转换消息格式
        if (anthropicRequest.messages) {
            for (const message of anthropicRequest.messages) {
                if (message.role === 'system') {
                    openaiRequest.messages.push({
                        role: 'system',
                        content: typeof message.content === 'string' ? message.content : 
                                message.content.map(c => c.text).join('')
                    });
                } else if (message.role === 'user') {
                    openaiRequest.messages.push({
                        role: 'user', 
                        content: typeof message.content === 'string' ? message.content :
                                message.content.map(c => c.text || JSON.stringify(c)).join('')
                    });
                } else if (message.role === 'assistant') {
                    const content = typeof message.content === 'string' ? message.content :
                                   message.content.map(c => c.text || JSON.stringify(c)).join('');
                    openaiRequest.messages.push({
                        role: 'assistant',
                        content: content
                    });
                }
            }
        }

        // 转换工具定义
        if (anthropicRequest.tools) {
            openaiRequest.tools = anthropicRequest.tools.map(tool => ({
                type: 'function',
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.input_schema
                }
            }));
            openaiRequest.tool_choice = 'auto';
        }

        // 其他参数
        if (anthropicRequest.max_tokens) {
            openaiRequest.max_tokens = anthropicRequest.max_tokens;
        }
        if (anthropicRequest.temperature !== undefined) {
            openaiRequest.temperature = anthropicRequest.temperature;
        }
        if (anthropicRequest.top_p !== undefined) {
            openaiRequest.top_p = anthropicRequest.top_p;
        }

        logger.debug('Anthropic → OpenAI transformation', {
            originalMessages: anthropicRequest.messages?.length || 0,
            transformedMessages: openaiRequest.messages.length,
            hasTools: !!(anthropicRequest.tools && anthropicRequest.tools.length > 0)
        });

        return openaiRequest;
    }

    /**
     * 将OpenAI响应转换为Anthropic格式
     */
    static openaiToAnthropic(openaiResponse) {
        const choice = openaiResponse.choices?.[0];
        if (!choice) {
            throw new Error('No choices in OpenAI response');
        }

        const content = [];
        
        // 处理文本内容
        if (choice.message?.content) {
            content.push({
                type: 'text',
                text: choice.message.content
            });
        }

        // 处理工具调用
        if (choice.message?.tool_calls) {
            for (const toolCall of choice.message.tool_calls) {
                content.push({
                    type: 'tool_use',
                    id: toolCall.id,
                    name: toolCall.function.name,
                    input: JSON.parse(toolCall.function.arguments || '{}')
                });
            }
        }

        return {
            id: openaiResponse.id,
            type: 'message',
            role: 'assistant',
            content: content,
            model: openaiResponse.model,
            stop_reason: this.mapOpenAIFinishReason(choice.finish_reason),
            usage: {
                input_tokens: openaiResponse.usage?.prompt_tokens || 0,
                output_tokens: openaiResponse.usage?.completion_tokens || 0
            }
        };
    }

    /**
     * 映射OpenAI的finish_reason到Anthropic格式
     */
    static mapOpenAIFinishReason(finishReason) {
        switch (finishReason) {
            case 'stop': return 'end_turn';
            case 'length': return 'max_tokens';
            case 'tool_calls': return 'tool_use';
            case 'content_filter': return 'stop_sequence';
            default: return 'end_turn';
        }
    }

    /**
     * 处理OpenAI流式响应并转换为Anthropic格式
     */
    static async* processOpenAIStreamToAnthropic(stream, providerId) {
        const messageId = `msg_${Date.now()}`;
        
        // 发送message_start事件
        yield {
            event: 'message_start',
            data: {
                type: 'message_start',
                message: {
                    id: messageId,
                    type: 'message',
                    role: 'assistant',
                    content: [],
                    model: 'unknown',
                    stop_reason: null,
                    usage: { input_tokens: 0, output_tokens: 0 }
                }
            }
        };

        let contentIndex = 0;
        const contentBlocks = new Map();
        let buffer = '';

        try {
            for await (const chunk of stream) {
                buffer += chunk.toString();
                let newlineIndex;
                
                while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.substring(0, newlineIndex).trim();
                    buffer = buffer.substring(newlineIndex + 1);

                    if (line.startsWith('data: ')) {
                        const jsonData = line.substring(6).trim();
                        if (jsonData === '[DONE]') {
                            break;
                        }
                        
                        try {
                            const parsedChunk = JSON.parse(jsonData);
                            const delta = parsedChunk.choices?.[0]?.delta;
                            
                            if (delta) {
                                // 处理文本内容
                                if (delta.content) {
                                    if (!contentBlocks.has('text')) {
                                        yield {
                                            event: 'content_block_start',
                                            data: {
                                                type: 'content_block_start',
                                                index: contentIndex,
                                                content_block: { type: 'text', text: '' }
                                            }
                                        };
                                        contentBlocks.set('text', contentIndex++);
                                    }
                                    
                                    yield {
                                        event: 'content_block_delta',
                                        data: {
                                            type: 'content_block_delta',
                                            index: contentBlocks.get('text'),
                                            delta: { type: 'text_delta', text: delta.content }
                                        }
                                    };
                                }
                                
                                // 处理工具调用
                                if (delta.tool_calls) {
                                    for (const toolCall of delta.tool_calls) {
                                        const toolKey = `tool_${toolCall.index}`;
                                        
                                        if (!contentBlocks.has(toolKey)) {
                                            yield {
                                                event: 'content_block_start',
                                                data: {
                                                    type: 'content_block_start',
                                                    index: contentIndex,
                                                    content_block: {
                                                        type: 'tool_use',
                                                        id: toolCall.id,
                                                        name: toolCall.function?.name,
                                                        input: {}
                                                    }
                                                }
                                            };
                                            contentBlocks.set(toolKey, contentIndex++);
                                        }
                                        
                                        if (toolCall.function?.arguments) {
                                            yield {
                                                event: 'content_block_delta',
                                                data: {
                                                    type: 'content_block_delta',
                                                    index: contentBlocks.get(toolKey),
                                                    delta: {
                                                        type: 'input_json_delta',
                                                        partial_json: toolCall.function.arguments
                                                    }
                                                }
                                            };
                                        }
                                    }
                                }
                            }
                            
                            // 检查完成状态
                            const finishReason = parsedChunk.choices?.[0]?.finish_reason;
                            if (finishReason) {
                                // 发送所有content_block_stop
                                for (const index of contentBlocks.values()) {
                                    yield {
                                        event: 'content_block_stop',
                                        data: { type: 'content_block_stop', index: index }
                                    };
                                }
                                
                                // 发送message_delta
                                yield {
                                    event: 'message_delta',
                                    data: {
                                        type: 'message_delta',
                                        delta: {
                                            stop_reason: this.mapOpenAIFinishReason(finishReason),
                                            stop_sequence: null
                                        },
                                        usage: { output_tokens: parsedChunk.usage?.completion_tokens || 0 }
                                    }
                                };
                                
                                // 如果不是工具调用，发送message_stop
                                if (finishReason !== 'tool_calls') {
                                    yield {
                                        event: 'message_stop',
                                        data: { type: 'message_stop' }
                                    };
                                }
                                break;
                            }
                        } catch (e) {
                            logger.warn(`Failed to parse OpenAI stream chunk`, {
                                error: e.message,
                                jsonData: jsonData.substring(0, 200)
                            });
                        }
                    }
                }
            }
        } catch (error) {
            logger.error(`OpenAI stream processing error`, { error: error.message, providerId });
            throw error;
        }
    }
}

export const transformationManager = {
    /**
     * 主要转换方法
     */
    transform: (data, context) => {
        const { sourceFormat, targetFormat, direction } = context;
        
        logger.debug(`🔄 Transforming ${sourceFormat} → ${targetFormat}`, {
            direction,
            hasTools: !!(data.tools && data.tools.length > 0)
        });

        if (direction === 'request') {
            // 请求转换
            if (sourceFormat === 'anthropic' && targetFormat === 'openai') {
                return FormatTransformer.anthropicToOpenAI(data);
            }
            // 其他格式转换可以在这里添加
            return data;
        } else if (direction === 'response') {
            // 响应转换
            if (sourceFormat === 'openai' && targetFormat === 'anthropic') {
                return FormatTransformer.openaiToAnthropic(data);
            }
            // 其他格式转换可以在这里添加
            return data;
        }
        
        return data;
    },
    
    /**
     * 流式响应转换
     */
    transformStream: (stream, context) => {
        const { sourceFormat, targetFormat } = context;
        
        if (sourceFormat === 'openai' && targetFormat === 'anthropic') {
            return FormatTransformer.processOpenAIStreamToAnthropic(stream, context.providerId);
        }
        
        // 其他流式转换
        return stream;
    },
    
    getTransformers: () => ['anthropic-to-openai', 'openai-to-anthropic'],
    
    registerTransformer: (name, transformer) => {
        logger.info(`📝 Registered transformer: ${name}`);
    }
};

export { FormatTransformer };