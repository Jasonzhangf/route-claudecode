/**
 * Gemini Transformer with Replay System Integration
 * 集成回放系统的Gemini转换器，支持完整的数据捕获和回放
 * @author Jason Zhang
 */

import { GeminiTransformer } from './gemini-transformer.js';
import { getLogger } from '../logging/index.js';

const logger = getLogger();

export class GeminiTransformerWithReplay extends GeminiTransformer {
    constructor() {
        super();
        this.name = 'gemini-transformer-with-replay';
        this.replayIntegration = true;
        
        logger.debug('Gemini transformer with replay system initialized');
    }

    /**
     * 增强的Anthropic → Gemini 请求转换（带回放记录）
     */
    transformAnthropicToGemini(anthropicRequest, context = {}) {
        const requestId = context.requestId || `transform_${Date.now()}`;
        
        logger.debug('Transforming Anthropic to Gemini with replay recording', {
            requestId,
            model: anthropicRequest.model,
            messageCount: anthropicRequest.messages?.length || 0
        });

        // 记录转换输入到回放系统
        this.recordTransformationInput('anthropic-to-gemini', anthropicRequest, context);

        try {
            // 执行基础转换
            const geminiRequest = super.transformAnthropicToGemini(anthropicRequest);

            // 添加转换元数据
            geminiRequest.transformationMetadata = {
                transformerId: this.name,
                transformationType: 'anthropic-to-gemini',
                requestId,
                transformedAt: Date.now(),
                originalModel: anthropicRequest.model,
                targetModel: geminiRequest.model
            };

            // 记录转换输出到回放系统
            this.recordTransformationOutput('anthropic-to-gemini', geminiRequest, context);

            logger.debug('Anthropic → Gemini transformation completed with replay', {
                requestId,
                originalModel: anthropicRequest.model,
                transformedModel: geminiRequest.model,
                hasMetadata: !!geminiRequest.transformationMetadata
            });

            return geminiRequest;

        } catch (error) {
            logger.error('Anthropic → Gemini transformation failed', {
                requestId,
                error: error.message,
                stack: error.stack
            });

            // 记录转换错误到回放系统
            this.recordTransformationError('anthropic-to-gemini', error, context);
            
            throw error;
        }
    }

    /**
     * 增强的Gemini → Anthropic 响应转换（带回放记录）
     */
    transformGeminiToAnthropic(geminiResponse, originalRequest, context = {}) {
        const requestId = context.requestId || `transform_${Date.now()}`;
        
        logger.debug('Transforming Gemini to Anthropic with replay recording', {
            requestId,
            hasCandidates: !!(geminiResponse.candidates && geminiResponse.candidates.length > 0),
            originalModel: originalRequest.model
        });

        // 记录转换输入到回放系统
        this.recordTransformationInput('gemini-to-anthropic', {
            geminiResponse,
            originalRequest
        }, context);

        try {
            // 执行基础转换
            const anthropicResponse = super.transformGeminiToAnthropic(geminiResponse, originalRequest);

            // 添加转换元数据
            anthropicResponse.transformationMetadata = {
                transformerId: this.name,
                transformationType: 'gemini-to-anthropic',
                requestId,
                transformedAt: Date.now(),
                originalProvider: 'gemini',
                targetFormat: 'anthropic'
            };

            // 记录转换输出到回放系统
            this.recordTransformationOutput('gemini-to-anthropic', anthropicResponse, context);

            logger.debug('Gemini → Anthropic transformation completed with replay', {
                requestId,
                contentCount: anthropicResponse.content?.length || 0,
                stopReason: anthropicResponse.stop_reason,
                hasMetadata: !!anthropicResponse.transformationMetadata
            });

            return anthropicResponse;

        } catch (error) {
            logger.error('Gemini → Anthropic transformation failed', {
                requestId,
                error: error.message,
                stack: error.stack
            });

            // 记录转换错误到回放系统
            this.recordTransformationError('gemini-to-anthropic', error, context);
            
            throw error;
        }
    }

    /**
     * 增强的流式响应转换（带回放记录）
     */
    transformGeminiStreamToAnthropicStream(geminiStream, originalRequest, context = {}) {
        const requestId = context.requestId || `stream_transform_${Date.now()}`;
        
        logger.debug('Setting up Gemini → Anthropic stream transformation with replay', {
            requestId,
            originalModel: originalRequest.model
        });

        // 记录流式转换开始到回放系统
        this.recordStreamTransformationStart(geminiStream, originalRequest, context);

        const transformer = this;

        return new ReadableStream({
            async start(controller) {
                try {
                    let chunkCount = 0;
                    let accumulatedContent = '';
                    let toolCalls = [];

                    // 发送初始消息开始事件
                    const messageStart = {
                        type: 'message_start',
                        message: {
                            id: transformer.generateResponseId(),
                            type: 'message',
                            role: 'assistant',
                            model: originalRequest.model || 'gemini-2.0-flash-exp',
                            content: [],
                            usage: { input_tokens: 0, output_tokens: 0 }
                        }
                    };

                    controller.enqueue(new TextEncoder().encode('event: message_start\n'));
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(messageStart)}\n\n`));

                    // 记录流式事件到回放系统
                    transformer.recordStreamEvent('message_start', messageStart, context, chunkCount++);

                    for await (const chunk of geminiStream) {
                        const candidate = chunk.candidates?.[0];
                        if (!candidate) continue;

                        // 记录原始流式块到回放系统
                        transformer.recordStreamChunk(chunk, context, chunkCount);

                        // 处理文本内容
                        if (candidate.content?.parts) {
                            for (const part of candidate.content.parts) {
                                if (part.text) {
                                    const delta = part.text.slice(accumulatedContent.length);
                                    if (delta) {
                                        accumulatedContent += delta;
                                        
                                        const contentDelta = {
                                            type: 'content_block_delta',
                                            index: 0,
                                            delta: { type: 'text_delta', text: delta }
                                        };

                                        controller.enqueue(new TextEncoder().encode('event: content_block_delta\n'));
                                        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(contentDelta)}\n\n`));

                                        // 记录内容增量到回放系统
                                        transformer.recordStreamEvent('content_block_delta', contentDelta, context, chunkCount++);
                                    }
                                }

                                // 处理函数调用
                                if (part.functionCall) {
                                    const toolCall = {
                                        type: 'tool_use',
                                        id: transformer.generateToolUseId(),
                                        name: part.functionCall.name,
                                        input: part.functionCall.args || {}
                                    };
                                    toolCalls.push(toolCall);

                                    // 记录工具调用到回放系统
                                    transformer.recordStreamEvent('tool_call', toolCall, context, chunkCount++);
                                }
                            }
                        }
                    }

                    // 发送工具调用（如果有）
                    for (const toolCall of toolCalls) {
                        const toolStart = {
                            type: 'content_block_start',
                            index: toolCalls.indexOf(toolCall) + 1,
                            content_block: toolCall
                        };

                        controller.enqueue(new TextEncoder().encode('event: content_block_start\n'));
                        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(toolStart)}\n\n`));

                        // 记录工具调用开始到回放系统
                        transformer.recordStreamEvent('content_block_start', toolStart, context, chunkCount++);
                    }

                    // 发送消息结束事件
                    const messageDelta = {
                        type: 'message_delta',
                        delta: { stop_reason: toolCalls.length > 0 ? 'tool_use' : 'end_turn' },
                        usage: { output_tokens: accumulatedContent.length }
                    };

                    controller.enqueue(new TextEncoder().encode('event: message_delta\n'));
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(messageDelta)}\n\n`));

                    const messageStop = { type: 'message_stop' };
                    controller.enqueue(new TextEncoder().encode('event: message_stop\n'));
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(messageStop)}\n\n`));

                    // 记录流式完成到回放系统
                    transformer.recordStreamEvent('message_delta', messageDelta, context, chunkCount++);
                    transformer.recordStreamEvent('message_stop', messageStop, context, chunkCount++);

                    // 记录流式转换完成到回放系统
                    transformer.recordStreamTransformationComplete(context, chunkCount, accumulatedContent.length, toolCalls.length);

                } catch (error) {
                    logger.error('Error in Gemini stream transformation with replay', {
                        requestId,
                        error: error.message,
                        stack: error.stack
                    });

                    // 记录流式转换错误到回放系统
                    transformer.recordStreamTransformationError(error, context);
                    
                    controller.error(error);
                } finally {
                    controller.close();
                }
            }
        });
    }

    /**
     * 记录转换输入到回放系统
     */
    recordTransformationInput(transformationType, input, context) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('transformer', `${transformationType}-input`, {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    transformerId: this.name,
                    transformationType,
                    inputSize: JSON.stringify(input).length,
                    input: JSON.parse(JSON.stringify(input))
                });
            }
        } catch (error) {
            logger.warn('Failed to record transformation input to replay system', error);
        }
    }

    /**
     * 记录转换输出到回放系统
     */
    recordTransformationOutput(transformationType, output, context) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('transformer', `${transformationType}-output`, {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    transformerId: this.name,
                    transformationType,
                    outputSize: JSON.stringify(output).length,
                    hasMetadata: !!output.transformationMetadata,
                    output: JSON.parse(JSON.stringify(output))
                });
            }
        } catch (error) {
            logger.warn('Failed to record transformation output to replay system', error);
        }
    }

    /**
     * 记录转换错误到回放系统
     */
    recordTransformationError(transformationType, error, context) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('transformer', `${transformationType}-error`, {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    transformerId: this.name,
                    transformationType,
                    error: {
                        message: error.message,
                        name: error.name,
                        stack: error.stack
                    }
                });
            }
        } catch (recordError) {
            logger.warn('Failed to record transformation error to replay system', recordError);
        }
    }

    /**
     * 记录流式转换开始到回放系统
     */
    recordStreamTransformationStart(stream, originalRequest, context) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('transformer', 'gemini-stream-transformation-start', {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    transformerId: this.name,
                    originalModel: originalRequest.model,
                    streamType: typeof stream
                });
            }
        } catch (error) {
            logger.warn('Failed to record stream transformation start to replay system', error);
        }
    }

    /**
     * 记录流式事件到回放系统
     */
    recordStreamEvent(eventType, eventData, context, chunkIndex) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('transformer', `gemini-stream-event-${eventType}`, {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    transformerId: this.name,
                    eventType,
                    chunkIndex,
                    eventSize: JSON.stringify(eventData).length,
                    eventData: JSON.parse(JSON.stringify(eventData))
                });
            }
        } catch (error) {
            logger.warn('Failed to record stream event to replay system', error);
        }
    }

    /**
     * 记录流式数据块到回放系统
     */
    recordStreamChunk(chunk, context, chunkIndex) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('transformer', 'gemini-stream-chunk', {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    transformerId: this.name,
                    chunkIndex,
                    candidateCount: chunk.candidates?.length || 0,
                    chunkSize: JSON.stringify(chunk).length,
                    chunk: JSON.parse(JSON.stringify(chunk))
                });
            }
        } catch (error) {
            logger.warn('Failed to record stream chunk to replay system', error);
        }
    }

    /**
     * 记录流式转换完成到回放系统
     */
    recordStreamTransformationComplete(context, totalChunks, totalTokens, toolCallCount) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('transformer', 'gemini-stream-transformation-complete', {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    transformerId: this.name,
                    totalChunks,
                    totalTokens,
                    toolCallCount
                });
            }
        } catch (error) {
            logger.warn('Failed to record stream transformation completion to replay system', error);
        }
    }

    /**
     * 记录流式转换错误到回放系统
     */
    recordStreamTransformationError(error, context) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('transformer', 'gemini-stream-transformation-error', {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    transformerId: this.name,
                    error: {
                        message: error.message,
                        name: error.name,
                        stack: error.stack
                    }
                });
            }
        } catch (recordError) {
            logger.warn('Failed to record stream transformation error to replay system', recordError);
        }
    }

    /**
     * 获取回放系统集成信息
     */
    getReplayIntegrationInfo() {
        return {
            transformerId: this.name,
            replaySupport: true,
            recordedEvents: [
                'anthropic-to-gemini-input',
                'anthropic-to-gemini-output',
                'gemini-to-anthropic-input', 
                'gemini-to-anthropic-output',
                'stream-transformation-start',
                'stream-events',
                'stream-chunks',
                'stream-transformation-complete',
                'transformation-errors'
            ],
            features: [
                'complete_data_capture',
                'error_recording',
                'stream_event_tracking',
                'metadata_injection',
                'replay_compatibility'
            ]
        };
    }
}