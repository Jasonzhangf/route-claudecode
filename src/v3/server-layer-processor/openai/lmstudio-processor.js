/**
 * LM Studio Server-Layer Processor
 * 
 * 处理OpenAI Protocol与LM Studio之间的双向转换:
 * - Request: OpenAI Protocol → LM Studio Protocol  
 * - Response: LM Studio Response → OpenAI Protocol
 * 
 * 职责范围: 只处理协议层面的转换，不处理Anthropic格式
 * 
 * @author Jason Zhang
 */

import { getLogger } from '../../logging/index.js';

const logger = getLogger();

export class LMStudioProcessor {
    constructor(config) {
        this.config = config;
        logger.debug('LMStudioProcessor initialized', {
            endpoint: config.endpoint,
            models: config.models
        });
    }

    /**
     * 处理OpenAI Protocol请求到LM Studio格式
     * 输入: 标准OpenAI格式请求 (已经由Transformer层转换过)
     * 输出: LM Studio兼容的请求格式
     */
    async processRequest(request, context) {
        console.log('🚨 DEBUG: LM Studio processor called!!!', {
            model: request.model,
            providerId: context.providerId,
            hasTools: !!(request.tools && request.tools.length > 0),
            messageCount: request.messages?.length || 0,
            toolCount: request.tools?.length || 0
        });
        
        logger.debug('LM Studio preprocessor processing request', {
            model: request.model,
            providerId: context.providerId,
            hasTools: !!(request.tools && request.tools.length > 0),
            messageCount: request.messages?.length || 0
        });

        let processedRequest = { ...request };

        // 注意: 输入应该已经是OpenAI格式 (由Transformer层转换)
        // 这里只做LM Studio特定的协议调整
        
        // 1. 转换消息格式为LM Studio要求的对象数组格式
        processedRequest = this.convertMessagesForLMStudio(processedRequest, context);

        // 2. 验证并调整工具定义格式 (确保符合LM Studio要求)
        processedRequest = this.fixToolDefinitionsForLMStudio(processedRequest, context);

        // 3. 应用LM Studio特定调整
        processedRequest = this.applyLMStudioAdjustments(processedRequest, context);

        logger.debug('LM Studio server-layer processing completed', {
            providerId: context.providerId,
            processedMessages: processedRequest.messages?.length || 0,
            toolsCount: processedRequest.tools?.length || 0
        });

        return processedRequest;
    }

    /**
     * 转换OpenAI消息格式为LM Studio要求的对象数组格式
     * 注意: 输入应该已经是OpenAI格式 (由Transformer层转换过)
     * LM Studio特殊要求: content字段必须是对象数组格式而不是字符串
     */
    convertMessagesForLMStudio(request, context) {
        if (!request.messages || !Array.isArray(request.messages)) {
            return request;
        }

        console.log('🔄 LM Studio Server-Layer: Converting OpenAI string content to object array format');

        const convertedMessages = request.messages.map(message => {
            // LM Studio requires content to be object array format instead of string
            if (typeof message.content === 'string' && message.content) {
                return {
                    ...message,
                    content: [
                        {
                            type: 'text',
                            text: message.content
                        }
                    ]
                };
            }

            // If content is already an array or other format, keep as-is
            // (Assumes transformer has already handled Anthropic -> OpenAI conversion)
            return message;
        });

        console.log('✅ LM Studio Server-Layer: Message format conversion completed');

        return {
            ...request,
            messages: convertedMessages
        };
    }

    /**
     * 验证OpenAI工具定义是否符合LM Studio要求
     * 注意: 输入应该已经是OpenAI格式 (由Transformer层转换过)
     * 只做LM Studio特定的格式验证和微调
     */
    fixToolDefinitionsForLMStudio(request, context) {
        if (!request.tools || request.tools.length === 0) {
            return request;
        }

        // LM Studio requires exact 'function' type and specific structure
        const fixedTools = request.tools.map(tool => {
            // Assume input is already OpenAI format from transformer
            // Only validate and fix LM Studio specific issues
            if (tool.type === 'function' && tool.function) {
                // Already in correct format, just validate
                return {
                    type: 'function',
                    function: {
                        name: tool.function.name,
                        description: tool.function.description || '',
                        parameters: tool.function.parameters || {
                            type: 'object',
                            properties: {}
                        }
                    }
                };
            }
            
            // If somehow still in wrong format, fix it
            logger.warn('Tool not in expected OpenAI format, applying emergency conversion', {
                toolFormat: tool,
                providerId: context.providerId
            });
            
            return {
                type: 'function',
                function: {
                    name: tool.name || tool.function?.name,
                    description: tool.description || tool.function?.description || '',
                    parameters: tool.input_schema || tool.function?.parameters || tool.parameters || {
                        type: 'object',
                        properties: {}
                    }
                }
            };
        });

        logger.debug('Validated tools for LM Studio', {
            originalToolCount: request.tools.length,
            validatedToolCount: fixedTools.length,
            providerId: context.providerId
        });

        return {
            ...request,
            tools: fixedTools
        };
    }

    /**
     * Apply LM Studio specific adjustments
     */
    applyLMStudioAdjustments(request, context) {
        let adjusted = { ...request };

        // Force non-streaming for regular requests (streaming handled separately)
        if (!adjusted.hasOwnProperty('stream')) {
            adjusted.stream = false;
        }

        // Set model to target model from routing
        if (context.targetModel) {
            adjusted.model = context.targetModel;
        }

        // LM Studio specific tool choice
        if (adjusted.tools && adjusted.tools.length > 0 && !adjusted.tool_choice) {
            adjusted.tool_choice = 'auto';
        }

        logger.debug('Applied LM Studio adjustments', {
            model: adjusted.model,
            stream: adjusted.stream,
            toolChoice: adjusted.tool_choice,
            providerId: context.providerId
        });

        return adjusted;
    }

    /**
     * Post-process response from LM Studio
     * Only fixes LM Studio specific issues, keeps OpenAI format for Transformer layer
     */
    async postprocessResponse(response, originalRequest, context) {
        if (!response) {
            return response;
        }

        logger.debug('LM Studio postprocessing response (format fixing only)', {
            responseType: typeof response,
            hasChoices: !!(response.choices && response.choices.length > 0),
            providerId: context.providerId
        });

        // Only handle LM Studio specific format fixes
        if (response.choices && response.choices.length > 0) {
            const choice = response.choices[0];
            const message = choice?.message;
            
            // Fix LM Studio specific issues but keep OpenAI format
            if (message) {
                // Handle reasoning field specific to LM Studio
                if (message.reasoning && !message.content) {
                    message.content = message.reasoning;
                    delete message.reasoning;
                }
                
                // Fix tool call arguments parsing issues
                if (message.tool_calls && Array.isArray(message.tool_calls)) {
                    console.log(`🔧 LM Studio returned ${message.tool_calls.length} tool calls`);
                    
                    for (const toolCall of message.tool_calls) {
                        if (toolCall.function?.arguments && typeof toolCall.function.arguments === 'string') {
                            // Ensure arguments are valid JSON
                            try {
                                JSON.parse(toolCall.function.arguments);
                            } catch (error) {
                                // Try to fix common malformed JSON cases
                                const cleaned = toolCall.function.arguments.trim()
                                    .replace(/,\s*}/g, '}')
                                    .replace(/,\s*]/g, ']');
                                try {
                                    JSON.parse(cleaned);
                                    toolCall.function.arguments = cleaned;
                                } catch (secondError) {
                                    // If still can't parse, wrap in object
                                    toolCall.function.arguments = JSON.stringify({ 
                                        raw_arguments: toolCall.function.arguments 
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // Return fixed OpenAI format response (NOT Anthropic format)
        // Format conversion will be handled by Transformer layer
        return response;
    }

    /**
     * Parse tool arguments with error handling
     */
    parseToolArguments(argumentsStr) {
        if (!argumentsStr) {
            return {};
        }
        
        try {
            return JSON.parse(argumentsStr);
        } catch (error) {
            console.warn(`⚠️  Failed to parse tool arguments: ${argumentsStr}`);
            // Try to handle common malformed JSON cases
            try {
                const cleaned = argumentsStr.trim()
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']');
                return JSON.parse(cleaned);
            } catch (secondError) {
                console.error(`❌ Cannot parse tool arguments as JSON: ${argumentsStr}`);
                return { raw_arguments: argumentsStr };
            }
        }
    }

    /**
     * Map OpenAI finish_reason to Anthropic format
     */
    mapFinishReason(openAIReason) {
        switch (openAIReason) {
            case 'stop': return 'end_turn';
            case 'length': return 'max_tokens';
            case 'tool_calls': return 'tool_use';
            default: return 'end_turn';
        }
    }
}