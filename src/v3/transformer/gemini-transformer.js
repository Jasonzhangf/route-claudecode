/**
 * Gemini Transformer - Anthropic ↔ Gemini 双向协议转换
 * 负责Anthropic API格式与Gemini API格式的完整双向转换
 * @author Jason Zhang
 */

import { getLogger } from '../logging/index.js';

const logger = getLogger();

export class GeminiTransformer {
    constructor() {
        this.name = 'gemini-transformer';
        this.supportedFormats = ['anthropic', 'gemini'];
        this.bidirectional = true;
        this.features = [
            'anthropic_to_gemini',
            'gemini_to_anthropic',
            'stream_transformation',
            'tool_calls',
            'system_instructions'
        ];
    }

    /**
     * Anthropic → Gemini 请求转换
     */
    transformAnthropicToGemini(anthropicRequest) {
        logger.debug('Transforming Anthropic request to Gemini format', {
            model: anthropicRequest.model,
            messageCount: anthropicRequest.messages?.length || 0,
            hasTools: !!(anthropicRequest.tools && anthropicRequest.tools.length > 0)
        });

        const geminiRequest = {
            model: this.mapAnthropicModelToGemini(anthropicRequest.model),
            generationConfig: {
                maxOutputTokens: anthropicRequest.max_tokens || 4096,
                temperature: anthropicRequest.temperature || 0.7,
                topP: anthropicRequest.top_p || 0.95,
                topK: anthropicRequest.top_k || 40
            },
            contents: this.transformMessages(anthropicRequest.messages || []),
            safetySettings: this.getDefaultSafetySettings()
        };

        // 处理工具调用
        if (anthropicRequest.tools && anthropicRequest.tools.length > 0) {
            geminiRequest.tools = this.transformAnthropicToolsToGemini(anthropicRequest.tools);
        }

        // 处理系统消息
        const systemMessage = anthropicRequest.messages?.find(msg => msg.role === 'system');
        if (systemMessage) {
            geminiRequest.systemInstruction = {
                role: 'model',
                parts: [{ text: systemMessage.content }]
            };
        }

        logger.debug('Anthropic → Gemini transformation completed', {
            originalModel: anthropicRequest.model,
            geminiModel: geminiRequest.model,
            contentCount: geminiRequest.contents?.length || 0,
            hasTools: !!(geminiRequest.tools && geminiRequest.tools.length > 0)
        });

        return geminiRequest;
    }

    /**
     * Gemini → Anthropic 响应转换
     */
    transformGeminiToAnthropic(geminiResponse, originalRequest) {
        logger.debug('Transforming Gemini response to Anthropic format', {
            hasCandidates: !!(geminiResponse.candidates && geminiResponse.candidates.length > 0),
            responseType: typeof geminiResponse
        });

        // 处理候选响应
        const candidate = geminiResponse.candidates?.[0];
        if (!candidate) {
            throw new Error('No valid candidate in Gemini response');
        }

        const anthropicResponse = {
            id: this.generateResponseId(),
            type: 'message',
            role: 'assistant',
            model: originalRequest.model || 'gemini-2.0-flash-exp',
            content: [],
            stop_reason: this.mapGeminiFinishReasonToAnthropic(candidate.finishReason),
            usage: {
                input_tokens: geminiResponse.usageMetadata?.promptTokenCount || 0,
                output_tokens: geminiResponse.usageMetadata?.candidatesTokenCount || 0
            }
        };

        // 处理内容部分
        if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
                if (part.text) {
                    anthropicResponse.content.push({
                        type: 'text',
                        text: part.text
                    });
                }

                // 处理函数调用
                if (part.functionCall) {
                    anthropicResponse.content.push({
                        type: 'tool_use',
                        id: this.generateToolUseId(),
                        name: part.functionCall.name,
                        input: part.functionCall.args || {}
                    });
                    anthropicResponse.stop_reason = 'tool_use';
                }
            }
        }

        logger.debug('Gemini → Anthropic transformation completed', {
            contentCount: anthropicResponse.content.length,
            stopReason: anthropicResponse.stop_reason,
            inputTokens: anthropicResponse.usage.input_tokens,
            outputTokens: anthropicResponse.usage.output_tokens
        });

        return anthropicResponse;
    }

    /**
     * 处理流式响应转换
     */
    transformGeminiStreamToAnthropicStream(geminiStream, originalRequest) {
        logger.debug('Setting up Gemini → Anthropic stream transformation');

        return new ReadableStream({
            async start(controller) {
                try {
                    // 发送初始消息开始事件
                    controller.enqueue(new TextEncoder().encode('event: message_start\n'));
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
                        type: 'message_start',
                        message: {
                            id: this.generateResponseId(),
                            type: 'message',
                            role: 'assistant',
                            model: originalRequest.model || 'gemini-2.0-flash-exp',
                            content: [],
                            usage: { input_tokens: 0, output_tokens: 0 }
                        }
                    })}\n\n`));

                    let accumulatedContent = '';
                    let toolCalls = [];

                    for await (const chunk of geminiStream) {
                        const candidate = chunk.candidates?.[0];
                        if (!candidate) continue;

                        // 处理文本内容
                        if (candidate.content?.parts) {
                            for (const part of candidate.content.parts) {
                                if (part.text) {
                                    const delta = part.text.slice(accumulatedContent.length);
                                    if (delta) {
                                        accumulatedContent += delta;
                                        
                                        // 发送内容增量事件
                                        controller.enqueue(new TextEncoder().encode('event: content_block_delta\n'));
                                        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
                                            type: 'content_block_delta',
                                            index: 0,
                                            delta: { type: 'text_delta', text: delta }
                                        })}\n\n`));
                                    }
                                }

                                // 处理函数调用
                                if (part.functionCall) {
                                    toolCalls.push({
                                        type: 'tool_use',
                                        id: this.generateToolUseId(),
                                        name: part.functionCall.name,
                                        input: part.functionCall.args || {}
                                    });
                                }
                            }
                        }
                    }

                    // 发送工具调用（如果有）
                    for (const toolCall of toolCalls) {
                        controller.enqueue(new TextEncoder().encode('event: content_block_start\n'));
                        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
                            type: 'content_block_start',
                            index: toolCalls.indexOf(toolCall) + 1,
                            content_block: toolCall
                        })}\n\n`));
                    }

                    // 发送消息结束事件
                    controller.enqueue(new TextEncoder().encode('event: message_delta\n'));
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
                        type: 'message_delta',
                        delta: { stop_reason: toolCalls.length > 0 ? 'tool_use' : 'end_turn' },
                        usage: { output_tokens: accumulatedContent.length }
                    })}\n\n`));

                    controller.enqueue(new TextEncoder().encode('event: message_stop\n'));
                    controller.enqueue(new TextEncoder().encode('data: {\"type\":\"message_stop\"}\n\n'));

                } catch (error) {
                    logger.error('Error in Gemini stream transformation', error);
                    controller.error(error);
                } finally {
                    controller.close();
                }
            }
        });
    }

    /**
     * 转换消息格式
     */
    transformMessages(anthropicMessages) {
        const geminiContents = [];
        
        for (const message of anthropicMessages) {
            // 跳过系统消息（单独处理）
            if (message.role === 'system') {
                continue;
            }

            const content = {
                role: message.role === 'assistant' ? 'model' : 'user',
                parts: []
            };

            // 处理文本内容
            if (typeof message.content === 'string') {
                content.parts.push({ text: message.content });
            } else if (Array.isArray(message.content)) {
                for (const block of message.content) {
                    if (block.type === 'text') {
                        content.parts.push({ text: block.text });
                    } else if (block.type === 'tool_use') {
                        content.parts.push({
                            functionCall: {
                                name: block.name,
                                args: block.input || {}
                            }
                        });
                    } else if (block.type === 'tool_result') {
                        content.parts.push({
                            functionResponse: {
                                name: block.tool_use_id,
                                response: { result: block.content }
                            }
                        });
                    }
                }
            }

            if (content.parts.length > 0) {
                geminiContents.push(content);
            }
        }

        return geminiContents;
    }

    /**
     * 转换工具定义
     */
    transformAnthropicToolsToGemini(anthropicTools) {
        return [{
            functionDeclarations: anthropicTools.map(tool => ({
                name: tool.name,
                description: tool.description,
                parameters: tool.input_schema || {
                    type: 'object',
                    properties: {}
                }
            }))
        }];
    }

    /**
     * 模型名称映射
     */
    mapAnthropicModelToGemini(anthropicModel) {
        const modelMappings = {
            'claude-3-5-sonnet-20241022': 'gemini-2.0-flash-exp',
            'claude-3-5-sonnet-20240620': 'gemini-1.5-pro-latest',
            'claude-3-5-haiku-20241022': 'gemini-1.5-flash',
            'claude-3-opus-20240229': 'gemini-1.5-pro-latest',
            'claude-3-sonnet-20240229': 'gemini-1.5-pro-latest',
            'claude-3-haiku-20240307': 'gemini-1.5-flash'
        };

        return modelMappings[anthropicModel] || 'gemini-1.5-pro-latest';
    }

    /**
     * 完成原因映射
     */
    mapGeminiFinishReasonToAnthropic(geminiFinishReason) {
        const reasonMappings = {
            'STOP': 'end_turn',
            'MAX_TOKENS': 'max_tokens',
            'SAFETY': 'stop_sequence',
            'RECITATION': 'stop_sequence',
            'LANGUAGE': 'stop_sequence',
            'OTHER': 'end_turn'
        };

        return reasonMappings[geminiFinishReason] || 'end_turn';
    }

    /**
     * 获取默认安全设置
     */
    getDefaultSafetySettings() {
        return [
            {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
        ];
    }

    /**
     * 生成响应ID
     */
    generateResponseId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 生成工具使用ID
     */
    generateToolUseId() {
        return `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 获取流式转换器映射
     */
    getStreamTransformers() {
        return {
            'gemini_to_anthropic_stream': this.transformGeminiStreamToAnthropicStream.bind(this),
            'anthropic_to_gemini_stream': this.transformAnthropicStreamToGeminiStream.bind(this)
        };
    }

    /**
     * Gemini流式响应转换为Anthropic流式格式
     */
    transformGeminiStreamToAnthropicStream(geminiStreamChunk) {
        // 转换Gemini SSE格式到Anthropic SSE格式
        return {
            type: 'content_block_delta',
            index: 0,
            delta: {
                type: 'text_delta',
                text: geminiStreamChunk.text || ''
            }
        };
    }

    /**
     * Anthropic流式请求转换为Gemini流式格式
     */
    transformAnthropicStreamToGeminiStream(anthropicStreamChunk) {
        // 转换Anthropic流式格式到Gemini流式格式
        return {
            text: anthropicStreamChunk.delta?.text || '',
            finishReason: anthropicStreamChunk.stop_reason || null
        };
    }
}