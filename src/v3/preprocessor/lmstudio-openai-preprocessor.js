/**
 * LM Studio OpenAI Compatible Preprocessor
 * 
 * Handles LM Studio specific preprocessing for OpenAI-compatible requests.
 * This enables LM Studio to be treated as a standard OpenAI provider 
 * with special message format handling.
 * 
 * @author Jason Zhang
 */

import { getLogger } from '../logging/index.js';

const logger = getLogger();

export class LMStudioOpenAIPreprocessor {
    constructor(config) {
        this.config = config;
        logger.debug('LMStudioOpenAIPreprocessor initialized', {
            endpoint: config.endpoint,
            models: config.models
        });
    }

    /**
     * Preprocess request for LM Studio compatibility
     */
    async processRequest(request, context) {
        logger.debug('LM Studio preprocessor processing request', {
            model: request.model,
            providerId: context.providerId,
            hasTools: !!(request.tools && request.tools.length > 0),
            messageCount: request.messages?.length || 0
        });

        let processedRequest = { ...request };

        // 1. Convert Anthropic messages to OpenAI format (for tool_result compatibility)
        processedRequest = this.convertAnthropicMessagesToOpenAI(processedRequest, context);

        // 2. Fix tool definitions for LM Studio
        processedRequest = this.fixToolDefinitionsForLMStudio(processedRequest, context);

        // 3. Apply LM Studio specific adjustments
        processedRequest = this.applyLMStudioAdjustments(processedRequest, context);

        logger.debug('LM Studio preprocessing completed', {
            providerId: context.providerId,
            convertedMessages: processedRequest.messages?.length || 0,
            toolsFixed: !!(processedRequest.tools && processedRequest.tools.length > 0)
        });

        return processedRequest;
    }

    /**
     * Convert Anthropic format messages to OpenAI format
     * This is the core logic that was previously in LMStudioClient
     */
    convertAnthropicMessagesToOpenAI(request, context) {
        if (!request.messages || !Array.isArray(request.messages)) {
            return request;
        }

        console.log('🔄 LM Studio Preprocessor: Converting Anthropic messages to OpenAI format');

        const convertedMessages = request.messages.map(message => {
            // Handle standard user/assistant messages
            if (typeof message.content === 'string') {
                return message;
            }

            // Handle messages with content array
            if (Array.isArray(message.content)) {
                // Check for tool_use content in assistant messages
                const hasToolUse = message.content.some((item) => item.type === 'tool_use');
                if (hasToolUse && message.role === 'assistant') {
                    // Convert Anthropic tool_use to OpenAI tool_calls format
                    const toolCalls = [];
                    let textContent = '';

                    for (const contentItem of message.content) {
                        if (contentItem.type === 'tool_use') {
                            toolCalls.push({
                                id: contentItem.id,
                                type: 'function',
                                function: {
                                    name: contentItem.name,
                                    arguments: JSON.stringify(contentItem.input)
                                }
                            });
                        } else if (contentItem.type === 'text') {
                            textContent += contentItem.text;
                        }
                    }

                    return {
                        ...message,
                        content: textContent || null,
                        tool_calls: toolCalls
                    };
                }

                // Check for tool_result content in user messages
                const hasToolResult = message.content.some((item) => item.type === 'tool_result');
                if (hasToolResult) {
                    // Convert tool_result to plain text for LM Studio compatibility
                    const textParts = [];
                    
                    for (const contentItem of message.content) {
                        if (contentItem.type === 'tool_result') {
                            textParts.push(`Tool result from ${contentItem.tool_use_id}:\n${contentItem.content}`);
                        } else if (contentItem.type === 'text') {
                            textParts.push(contentItem.text);
                        } else {
                            textParts.push(JSON.stringify(contentItem));
                        }
                    }

                    return {
                        ...message,
                        content: textParts.join('\n\n')
                    };
                }

                // Handle other content arrays (text, image_url, etc.)
                const textParts = [];
                for (const contentItem of message.content) {
                    if (contentItem.type === 'text') {
                        textParts.push(contentItem.text);
                    } else {
                        textParts.push(JSON.stringify(contentItem));
                    }
                }

                if (textParts.length > 0) {
                    return {
                        ...message,
                        content: textParts.join('\n\n')
                    };
                }

                return {
                    ...message,
                    content: message.content
                };
            }

            return message;
        });

        console.log('✅ LM Studio Preprocessor: Messages converted successfully');

        return {
            ...request,
            messages: convertedMessages
        };
    }

    /**
     * Fix tool definitions specifically for LM Studio requirements
     */
    fixToolDefinitionsForLMStudio(request, context) {
        if (!request.tools || request.tools.length === 0) {
            return request;
        }

        // LM Studio requires exact 'function' type and specific structure
        const fixedTools = request.tools.map(tool => ({
            type: 'function', // LM Studio requires this to be exactly 'function'
            function: {
                name: tool.name || tool.function?.name,
                description: tool.description || tool.function?.description,
                parameters: tool.input_schema || tool.function?.parameters || tool.parameters || {
                    type: 'object',
                    properties: {}
                }
            }
        }));

        logger.debug('Fixed tools for LM Studio', {
            originalToolCount: request.tools.length,
            fixedToolCount: fixedTools.length,
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