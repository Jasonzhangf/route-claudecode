/**
 * OpenAI Transformer
 * 处理Anthropic格式与OpenAI协议之间的双向转换
 * 
 * @author Jason Zhang
 * @version 3.1.0
 */

/**
 * OpenAI格式转换器
 * 负责Anthropic格式与标准OpenAI协议之间的双向转换
 */
export class OpenAITransformer {
    name = 'openai-transformer';
    version = '3.1.0';

    /**
     * 转换Anthropic格式到OpenAI格式
     * @param {Object} anthropicRequest - Anthropic格式请求
     * @param {Object} context - 转换上下文
     * @returns {Object} OpenAI格式请求
     */
    transformAnthropicToOpenAI(anthropicRequest, context) {
        const requestId = context?.requestId || 'unknown';
        console.log(`🔄 [${requestId}] Converting Anthropic to OpenAI format`);

        const openAIRequest = {
            model: anthropicRequest.model,
            messages: this.convertAnthropicMessages(anthropicRequest.messages, anthropicRequest.system),
            max_tokens: anthropicRequest.max_tokens,
            temperature: anthropicRequest.temperature,
            stream: anthropicRequest.stream || false
        };

        // 转换工具调用
        if (anthropicRequest.tools && Array.isArray(anthropicRequest.tools) && anthropicRequest.tools.length > 0) {
            openAIRequest.tools = this.convertAnthropicToolsToOpenAI(anthropicRequest.tools, requestId);
            openAIRequest.tool_choice = 'auto';
        }

        console.log(`✅ [${requestId}] Anthropic to OpenAI conversion completed`, {
            hasTools: !!openAIRequest.tools,
            toolCount: openAIRequest.tools?.length || 0,
            hasSystem: !!anthropicRequest.system
        });

        return openAIRequest;
    }

    /**
     * 转换OpenAI格式到Anthropic格式
     * @param {Object} openAIResponse - OpenAI格式响应
     * @param {Object} context - 转换上下文
     * @returns {Object} Anthropic格式响应
     */
    transformOpenAIToAnthropic(openAIResponse, context) {
        const requestId = context?.requestId || 'unknown';
        console.log(`🔄 [${requestId}] Converting OpenAI to Anthropic format`);

        if (!openAIResponse.choices || !Array.isArray(openAIResponse.choices) || openAIResponse.choices.length === 0) {
            console.error(`❌ [${requestId}] Invalid OpenAI response: no choices`);
            throw new Error('Invalid OpenAI response: no choices found');
        }

        const choice = openAIResponse.choices[0];
        const content = [];

        // 处理文本内容
        if (choice.message?.content) {
            content.push({
                type: 'text',
                text: choice.message.content
            });
        }

        // 处理工具调用
        if (choice.message?.tool_calls && Array.isArray(choice.message.tool_calls)) {
            for (const toolCall of choice.message.tool_calls) {
                try {
                    content.push({
                        type: 'tool_use',
                        id: toolCall.id,
                        name: toolCall.function.name,
                        input: JSON.parse(toolCall.function.arguments)
                    });
                } catch (error) {
                    console.error(`❌ [${requestId}] Error parsing tool call arguments:`, error);
                    content.push({
                        type: 'tool_use',
                        id: toolCall.id,
                        name: toolCall.function.name,
                        input: { error: 'Failed to parse arguments', raw: toolCall.function.arguments }
                    });
                }
            }
        }

        const anthropicResponse = {
            id: openAIResponse.id || `msg_${Date.now()}`,
            type: 'message',
            role: 'assistant',
            content: content.length > 0 ? content : [{ type: 'text', text: '' }],
            model: openAIResponse.model,
            stop_reason: this.mapFinishReasonToStopReason(choice.finish_reason),
            usage: {
                input_tokens: openAIResponse.usage?.prompt_tokens || 0,
                output_tokens: openAIResponse.usage?.completion_tokens || 0
            }
        };

        console.log(`✅ [${requestId}] OpenAI to Anthropic conversion completed`, {
            hasContent: content.length > 0,
            contentBlocks: content.length,
            stopReason: anthropicResponse.stop_reason
        });

        return anthropicResponse;
    }

    /**
     * 转换Anthropic消息格式到OpenAI格式
     * @param {Array} messages - Anthropic消息数组
     * @param {String|Array} system - 系统消息
     * @returns {Array} OpenAI消息数组
     */
    convertAnthropicMessages(messages, system) {
        const openAIMessages = [];

        // 添加系统消息
        if (system) {
            if (typeof system === 'string') {
                openAIMessages.push({
                    role: 'system',
                    content: system
                });
            } else if (Array.isArray(system)) {
                for (const systemMsg of system) {
                    openAIMessages.push({
                        role: 'system',
                        content: typeof systemMsg === 'string' ? systemMsg : systemMsg.text || ''
                    });
                }
            }
        }

        // 转换用户和助手消息
        for (const message of messages) {
            if (message.role === 'user') {
                openAIMessages.push({
                    role: 'user',
                    content: this.extractTextFromContent(message.content)
                });
            } else if (message.role === 'assistant') {
                openAIMessages.push({
                    role: 'assistant',
                    content: this.extractTextFromContent(message.content)
                });
            }
        }

        return openAIMessages;
    }

    /**
     * 转换Anthropic工具定义到OpenAI格式
     * @param {Array} tools - Anthropic工具数组
     * @param {String} requestId - 请求ID
     * @returns {Array} OpenAI工具数组
     */
    convertAnthropicToolsToOpenAI(tools, requestId) {
        const openAITools = [];

        for (const tool of tools) {
            try {
                const openAITool = {
                    type: 'function',
                    function: {
                        name: tool.name,
                        description: tool.description || `Execute ${tool.name}`,
                        parameters: this.convertParameterSchema(tool.input_schema)
                    }
                };
                openAITools.push(openAITool);

                console.log(`🔧 [${requestId}] Converted tool: ${tool.name}`);
            } catch (error) {
                console.error(`❌ [${requestId}] Error converting tool ${tool.name}:`, error);
                // 创建一个基本的工具定义作为fallback
                openAITools.push({
                    type: 'function',
                    function: {
                        name: tool.name || 'unknown_tool',
                        description: 'Tool conversion failed',
                        parameters: { type: 'object', properties: {}, required: [] }
                    }
                });
            }
        }

        console.log(`🔧 [${requestId}] Tool conversion completed: ${openAITools.length} tools`);
        return openAITools;
    }

    /**
     * 转换参数模式
     * @param {Object} inputSchema - Anthropic输入模式
     * @returns {Object} OpenAI参数模式
     */
    convertParameterSchema(inputSchema) {
        if (!inputSchema) {
            return { type: 'object', properties: {}, required: [] };
        }

        // 如果已经是OpenAI格式，直接返回
        if (inputSchema.type === 'object' && inputSchema.properties) {
            return inputSchema;
        }

        // 转换Anthropic格式到OpenAI格式
        return {
            type: 'object',
            properties: inputSchema.properties || {},
            required: inputSchema.required || []
        };
    }

    /**
     * 从内容中提取文本
     * @param {String|Array} content - 内容
     * @returns {String} 文本内容
     */
    extractTextFromContent(content) {
        if (typeof content === 'string') {
            return content;
        }

        if (Array.isArray(content)) {
            const textBlocks = content.filter(block => block.type === 'text');
            return textBlocks.map(block => block.text).join('\n');
        }

        return '';
    }

    /**
     * 映射finish_reason到stop_reason
     * @param {String} finishReason - OpenAI finish_reason
     * @returns {String} Anthropic stop_reason
     */
    mapFinishReasonToStopReason(finishReason) {
        switch (finishReason) {
            case 'stop':
                return 'end_turn';
            case 'length':
                return 'max_tokens';
            case 'tool_calls':
                return 'tool_use';
            case 'content_filter':
                return 'stop_sequence';
            default:
                return 'end_turn';
        }
    }

    /**
     * 获取转换器能力信息
     * @returns {Object} 能力信息
     */
    getCapabilities() {
        return {
            name: this.name,
            version: this.version,
            supportedFormats: ['anthropic', 'openai'],
            conversions: [
                'anthropic-request -> openai-request',
                'openai-response -> anthropic-response'
            ],
            features: [
                'tool-call-conversion',
                'system-message-handling',
                'parameter-schema-conversion',
                'finish-reason-mapping'
            ]
        };
    }
}

/**
 * 创建OpenAI转换器实例
 * @returns {OpenAITransformer} 转换器实例
 */
export function createOpenAITransformer() {
    return new OpenAITransformer();
}