/**
 * CodeWhisperer Transformer - V3.0 Six-Layer Architecture
 * 实现Anthropic ↔ CodeWhisperer双向协议转换
 * 基于demo3的Kiro API实现，支持完整的工具调用和流式响应
 * 
 * Project owner: Jason Zhang
 */

import { v4 as uuidv4 } from 'uuid';

export class CodewhispererTransformer {
    constructor() {
        this.name = 'CodewhispererTransformer';
        this.version = 'v3.0.0';
        this.bidirectional = true;
        this.features = [
            'anthropic-to-codewhisperer',
            'codewhisperer-to-anthropic', 
            'tool-calls',
            'streaming',
            'system-prompt',
            'conversation-history'
        ];

        // CodeWhisperer模型映射表 (基于demo3)
        this.modelMapping = {
            "claude-sonnet-4-20250514": "CLAUDE_SONNET_4_20250514_V1_0",
            "claude-3-7-sonnet-20250219": "CLAUDE_3_7_SONNET_20250219_V1_0",
            "amazonq-claude-sonnet-4-20250514": "CLAUDE_SONNET_4_20250514_V1_0",
            "amazonq-claude-3-7-sonnet-20250219": "CLAUDE_3_7_SONNET_20250219_V1_0"
        };

        console.log(`🔄 Initialized ${this.name} v${this.version} - Anthropic ↔ CodeWhisperer bidirectional transformer`);
    }

    /**
     * 提取消息内容的辅助方法
     */
    getContentText(message) {
        if (message == null) {
            return "";
        }
        if (Array.isArray(message)) {
            return message
                .filter(part => part.type === 'text' && part.text)
                .map(part => part.text)
                .join('');
        } else if (typeof message.content === 'string') {
            return message.content;
        } else if (Array.isArray(message.content)) {
            return message.content
                .filter(part => part.type === 'text' && part.text)
                .map(part => part.text)
                .join('');
        }
        return String(message.content || message);
    }

    /**
     * 转换Anthropic请求到CodeWhisperer格式
     * 基于demo3的buildCodewhispererRequest实现
     * @param {Object} anthropicRequest - Anthropic格式的请求
     * @returns {Object} CodeWhisperer格式的请求
     */
    transformAnthropicToCodewhisperer(anthropicRequest) {
        console.log(`🔄 [CodeWhisperer] Transforming Anthropic → CodeWhisperer format`);

        const { messages, model, tools, system, max_tokens = 4000 } = anthropicRequest;
        const conversationId = uuidv4();

        // 获取CodeWhisperer模型名 - 零硬编码，零fallback原则
        const codewhispererModel = this.modelMapping[model];
        if (!codewhispererModel) {
            throw new Error(`Unsupported model: ${model}. Available models: ${Object.keys(this.modelMapping).join(', ')}`);
        }
        
        let systemPrompt = this.getContentText(system);
        const processedMessages = messages || [];

        if (processedMessages.length === 0) {
            throw new Error('No user messages found');
        }

        // 构建工具上下文
        let toolsContext = {};
        if (tools && Array.isArray(tools) && tools.length > 0) {
            toolsContext = {
                tools: tools.map(tool => ({
                    toolSpecification: {
                        name: tool.name,
                        description: tool.description || "",
                        inputSchema: { json: tool.input_schema || {} }
                    }
                }))
            };
        }

        const history = [];
        let startIndex = 0;

        // 处理系统提示
        if (systemPrompt) {
            if (processedMessages[0].role === 'user') {
                let firstUserContent = this.getContentText(processedMessages[0]);
                history.push({
                    userInputMessage: {
                        content: `${systemPrompt}\n\n${firstUserContent}`,
                        modelId: codewhispererModel,
                        origin: 'AI_EDITOR',
                    }
                });
                startIndex = 1;
            } else {
                history.push({
                    userInputMessage: {
                        content: systemPrompt,
                        modelId: codewhispererModel,
                        origin: 'AI_EDITOR',
                    }
                });
            }
        }

        // 添加历史消息到history
        for (let i = startIndex; i < processedMessages.length - 1; i++) {
            const message = processedMessages[i];
            if (message.role === 'user') {
                let userInputMessage = {
                    content: '',
                    modelId: codewhispererModel,
                    origin: 'AI_EDITOR',
                    userInputMessageContext: {}
                };

                if (Array.isArray(message.content)) {
                    userInputMessage.images = [];
                    for (const part of message.content) {
                        if (part.type === 'text') {
                            userInputMessage.content += part.text;
                        } else if (part.type === 'tool_result') {
                            if (!userInputMessage.userInputMessageContext.toolResults) {
                                userInputMessage.userInputMessageContext.toolResults = [];
                            }
                            userInputMessage.userInputMessageContext.toolResults.push({
                                content: [{ text: this.getContentText(part.content) }],
                                status: 'success',
                                toolUseId: part.tool_use_id
                            });
                        } else if (part.type === 'image') {
                            userInputMessage.images.push({
                                format: part.source.media_type.split('/')[1],
                                source: {
                                    bytes: part.source.data
                                }
                            });
                        }
                    }
                } else {
                    userInputMessage.content = this.getContentText(message);
                }
                history.push({ userInputMessage });
            } else if (message.role === 'assistant') {
                let assistantResponseMessage = {
                    content: '',
                    toolUses: []
                };

                if (Array.isArray(message.content)) {
                    for (const part of message.content) {
                        if (part.type === 'text') {
                            assistantResponseMessage.content += part.text;
                        } else if (part.type === 'tool_use') {
                            assistantResponseMessage.toolUses.push({
                                input: part.input,
                                name: part.name,
                                toolUseId: part.id
                            });
                        }
                    }
                } else {
                    assistantResponseMessage.content = this.getContentText(message);
                }
                history.push({ assistantResponseMessage });
            }
        }

        // 构建当前消息
        const currentMessage = processedMessages[processedMessages.length - 1];
        let currentContent = '';
        let currentToolResults = [];
        let currentToolUses = [];
        let currentImages = [];

        if (Array.isArray(currentMessage.content)) {
            for (const part of currentMessage.content) {
                if (part.type === 'text') {
                    currentContent += part.text;
                } else if (part.type === 'tool_result') {
                    currentToolResults.push({
                        content: [{ text: this.getContentText(part.content) }],
                        status: 'success',
                        toolUseId: part.tool_use_id
                    });
                } else if (part.type === 'tool_use') {
                    currentToolUses.push({
                        input: part.input,
                        name: part.name,
                        toolUseId: part.id
                    });
                } else if (part.type === 'image') {
                    currentImages.push({
                        format: part.source.media_type.split('/')[1],
                        source: {
                            bytes: part.source.data
                        }
                    });
                }
            }
        } else {
            currentContent = this.getContentText(currentMessage);
        }

        if (!currentContent && currentToolResults.length === 0 && currentToolUses.length === 0) {
            currentContent = 'Continue';
        }

        const request = {
            conversationState: {
                chatTriggerType: 'MANUAL',
                conversationId: conversationId,
                currentMessage: {},
                history: history
            }
        };

        // 详细记录转换后的请求用于调试
        console.log(`✅ [CodeWhisperer] DEBUG - Transformed Request:`, JSON.stringify(request, null, 2));

        if (currentMessage.role === 'user') {
            request.conversationState.currentMessage.userInputMessage = {
                content: currentContent,
                modelId: codewhispererModel,
                origin: 'AI_EDITOR',
                images: currentImages && currentImages.length > 0 ? currentImages : null,
                userInputMessageContext: {
                    toolResults: currentToolResults.length > 0 ? currentToolResults : null,
                    tools: Object.keys(toolsContext).length > 0 ? toolsContext.tools : null
                }
            };
        } else if (currentMessage.role === 'assistant') {
            request.conversationState.currentMessage.assistantResponseMessage = {
                content: currentContent,
                toolUses: currentToolUses.length > 0 ? currentToolUses : undefined
            };
        }

        console.log(`✅ [CodeWhisperer] Transformed to CodeWhisperer format - Model: ${codewhispererModel}, ConversationId: ${conversationId}`);
        return request;
    }

    /**
     * 转换CodeWhisperer响应到Anthropic格式
     * @param {Object} codewhispererResponse - CodeWhisperer格式的响应
     * @param {Object} originalRequest - 原始Anthropic请求（用于模型信息）
     * @returns {Object} Anthropic格式的响应
     */
    transformCodewhispererToAnthropic(codewhispererResponse, originalRequest = {}) {
        console.log(`🔄 [CodeWhisperer] Transforming CodeWhisperer → Anthropic format`);

        const messageId = `msg_${uuidv4().replace(/-/g, '').substring(0, 8)}`;
        const model = originalRequest.model || 'claude-sonnet-4-20250514';

        // 解析CodeWhisperer响应
        const { responseText, toolCalls } = this._processCodewhispererResponse(codewhispererResponse);

        const contentArray = [];
        let stopReason = "end_turn";
        let outputTokens = 0;

        // 估算token数量的简单方法
        const estimateTokens = (text) => Math.ceil((text || '').length / 4);

        // 添加工具调用
        if (toolCalls && toolCalls.length > 0) {
            for (const tc of toolCalls) {
                let inputObject;
                try {
                    inputObject = typeof tc.function.arguments === 'string' 
                        ? JSON.parse(tc.function.arguments)
                        : tc.function.arguments;
                } catch (e) {
                    console.warn(`[CodeWhisperer] Invalid JSON for tool call arguments. Using raw string. Error: ${e.message}`);
                    inputObject = { "raw_arguments": tc.function.arguments };
                }

                contentArray.push({
                    type: "tool_use",
                    id: tc.id,
                    name: tc.function.name,
                    input: inputObject
                });
                outputTokens += estimateTokens(JSON.stringify(inputObject));
            }
            stopReason = "tool_use";
        }

        // 添加文本内容
        if (responseText) {
            contentArray.push({
                type: "text",
                text: responseText
            });
            outputTokens += estimateTokens(responseText);
        }

        const response = {
            id: messageId,
            type: "message",
            role: "assistant",
            model: model,
            stop_reason: stopReason,
            stop_sequence: null,
            usage: {
                input_tokens: 0, // CodeWhisperer API不提供这个信息
                output_tokens: outputTokens
            },
            content: contentArray
        };

        console.log(`✅ [CodeWhisperer] Transformed to Anthropic format - ${contentArray.length} content blocks, stop_reason: ${stopReason}`);
        return response;
    }

    /**
     * 处理CodeWhisperer流式响应转换为Anthropic流式格式
     * @param {Object} chunk - CodeWhisperer流式响应块
     * @returns {Object} Anthropic流式响应块
     */
    transformCodewhispererStreamToAnthropicStream(chunk) {
        console.log(`🔄 [CodeWhisperer] Transforming stream chunk`);

        // CodeWhisperer实际上不是真正的流式，它返回完整响应
        // 这里我们模拟Anthropic的流式格式
        const messageId = `msg_${uuidv4().replace(/-/g, '').substring(0, 8)}`;
        
        if (chunk.type === 'message_start') {
            return {
                type: "message_start",
                message: {
                    id: messageId,
                    type: "message",
                    role: "assistant",
                    model: chunk.message?.model || 'claude-sonnet-4-20250514',
                    usage: {
                        input_tokens: 0,
                        output_tokens: 0
                    },
                    content: []
                }
            };
        }

        if (chunk.type === 'content_block_start') {
            return {
                type: "content_block_start",
                index: chunk.index,
                content_block: chunk.content_block
            };
        }

        if (chunk.type === 'content_block_delta') {
            return {
                type: "content_block_delta",
                index: chunk.index,
                delta: chunk.delta
            };
        }

        if (chunk.type === 'content_block_stop') {
            return {
                type: "content_block_stop",
                index: chunk.index
            };
        }

        if (chunk.type === 'message_delta') {
            return {
                type: "message_delta",
                delta: chunk.delta,
                usage: chunk.usage
            };
        }

        if (chunk.type === 'message_stop') {
            return {
                type: "message_stop"
            };
        }

        // 默认透传
        return chunk;
    }

    /**
     * 处理CodeWhisperer响应的私有方法
     * 基于demo3的_processApiResponse实现
     * @param {Object} response - 原始CodeWhisperer响应
     * @returns {Object} 包含responseText和toolCalls的对象
     */
    _processCodewhispererResponse(response) {
        const rawResponseText = Buffer.isBuffer(response.data) ? response.data.toString('utf8') : String(response.data);
        
        // 解析事件流和工具调用
        const parsedFromEvents = this._parseEventStreamChunk(rawResponseText);
        let fullResponseText = parsedFromEvents.content;
        let allToolCalls = [...parsedFromEvents.toolCalls];

        // 解析bracket格式的工具调用
        const rawBracketToolCalls = this._parseBracketToolCalls(rawResponseText);
        if (rawBracketToolCalls) {
            allToolCalls.push(...rawBracketToolCalls);
        }

        // 去重工具调用
        const uniqueToolCalls = this._deduplicateToolCalls(allToolCalls);

        // 清理响应文本，移除工具调用语法
        if (uniqueToolCalls.length > 0) {
            for (const tc of uniqueToolCalls) {
                const funcName = tc.function.name;
                const escapedName = funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = new RegExp(`\\[Called\\s+${escapedName}\\s+with\\s+args:\\s*\\{[^}]*(?:\\{[^}]*\\}[^}]*)*\\}\\]`, 'gs');
                fullResponseText = fullResponseText.replace(pattern, '');
            }
            fullResponseText = fullResponseText.replace(/\s+/g, ' ').trim();
        }

        return { responseText: fullResponseText, toolCalls: uniqueToolCalls };
    }

    /**
     * 解析事件流数据
     */
    _parseEventStreamChunk(rawData) {
        const rawStr = Buffer.isBuffer(rawData) ? rawData.toString('utf8') : String(rawData);
        let fullContent = '';
        const toolCalls = [];
        let currentToolCallDict = null;

        const eventBlockRegex = /event({.*?(?=event{|$))/gs;

        for (const match of rawStr.matchAll(eventBlockRegex)) {
            const potentialJsonBlock = match[1];
            let searchPos = 0;
            while ((searchPos = potentialJsonBlock.indexOf('}', searchPos + 1)) !== -1) {
                const jsonCandidate = potentialJsonBlock.substring(0, searchPos + 1);
                try {
                    const eventData = JSON.parse(jsonCandidate);

                    if (eventData.name && eventData.toolUseId) {
                        if (!currentToolCallDict) {
                            currentToolCallDict = {
                                id: eventData.toolUseId,
                                type: "function",
                                function: {
                                    name: eventData.name,
                                    arguments: ""
                                }
                            };
                        }
                        if (eventData.input) {
                            currentToolCallDict.function.arguments += eventData.input;
                        }
                        if (eventData.stop) {
                            try {
                                const args = JSON.parse(currentToolCallDict.function.arguments);
                                currentToolCallDict.function.arguments = JSON.stringify(args);
                            } catch (e) {
                                console.warn(`Tool call arguments not valid JSON: ${currentToolCallDict.function.arguments}`);
                            }
                            toolCalls.push(currentToolCallDict);
                            currentToolCallDict = null;
                        }
                    } else if (!eventData.followupPrompt && eventData.content) {
                        const decodedContent = eventData.content.replace(/\\n/g, '\n');
                        fullContent += decodedContent;
                    }
                    break;
                } catch (e) {
                    // 解析失败，继续寻找下一个'}'
                }
            }
        }
        
        if (currentToolCallDict) {
            toolCalls.push(currentToolCallDict);
        }

        return { content: fullContent || '', toolCalls: toolCalls };
    }

    /**
     * 解析bracket格式的工具调用
     */
    _parseBracketToolCalls(responseText) {
        if (!responseText || !responseText.includes("[Called")) {
            return null;
        }

        const toolCalls = [];
        const callPositions = [];
        let start = 0;
        while (true) {
            const pos = responseText.indexOf("[Called", start);
            if (pos === -1) {
                break;
            }
            callPositions.push(pos);
            start = pos + 1;
        }

        for (let i = 0; i < callPositions.length; i++) {
            const startPos = callPositions[i];
            let endSearchLimit;
            if (i + 1 < callPositions.length) {
                endSearchLimit = callPositions[i + 1];
            } else {
                endSearchLimit = responseText.length;
            }

            const segment = responseText.substring(startPos, endSearchLimit);
            const bracketEnd = this._findMatchingBracket(segment, 0);

            let toolCallText;
            if (bracketEnd !== -1) {
                toolCallText = segment.substring(0, bracketEnd + 1);
            } else {
                const lastBracket = segment.lastIndexOf(']');
                if (lastBracket !== -1) {
                    toolCallText = segment.substring(0, lastBracket + 1);
                } else {
                    continue;
                }
            }
            
            const parsedCall = this._parseSingleToolCall(toolCallText);
            if (parsedCall) {
                toolCalls.push(parsedCall);
            }
        }
        return toolCalls.length > 0 ? toolCalls : null;
    }

    /**
     * 查找匹配的括号
     */
    _findMatchingBracket(text, startPos) {
        if (!text || startPos >= text.length || text[startPos] !== '[') {
            return -1;
        }

        let bracketCount = 1;
        let inString = false;
        let escapeNext = false;

        for (let i = startPos + 1; i < text.length; i++) {
            const char = text[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\' && inString) {
                escapeNext = true;
                continue;
            }

            if (char === '"' && !escapeNext) {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '[') {
                    bracketCount++;
                } else if (char === ']') {
                    bracketCount--;
                    if (bracketCount === 0) {
                        return i;
                    }
                }
            }
        }
        return -1;
    }

    /**
     * 解析单个工具调用
     */
    _parseSingleToolCall(toolCallText) {
        const namePattern = /\[Called\s+(\w+)\s+with\s+args:/i;
        const nameMatch = toolCallText.match(namePattern);

        if (!nameMatch) {
            return null;
        }

        const functionName = nameMatch[1].trim();
        const argsStartMarker = "with args:";
        const argsStartPos = toolCallText.toLowerCase().indexOf(argsStartMarker.toLowerCase());

        if (argsStartPos === -1) {
            return null;
        }

        const argsStart = argsStartPos + argsStartMarker.length;
        const argsEnd = toolCallText.lastIndexOf(']');

        if (argsEnd <= argsStart) {
            return null;
        }

        const jsonCandidate = toolCallText.substring(argsStart, argsEnd).trim();

        try {
            // 简单的JSON修复
            let repairedJson = jsonCandidate;
            repairedJson = repairedJson.replace(/,\s*([}\]])/g, '$1');
            repairedJson = repairedJson.replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":');
            repairedJson = repairedJson.replace(/:\s*([a-zA-Z0-9_]+)(?=[,\}\]])/g, ':"$1"');

            const argumentsObj = JSON.parse(repairedJson);

            if (typeof argumentsObj !== 'object' || argumentsObj === null) {
                return null;
            }

            const toolCallId = `call_${uuidv4().replace(/-/g, '').substring(0, 8)}`;
            return {
                id: toolCallId,
                type: "function",
                function: {
                    name: functionName,
                    arguments: JSON.stringify(argumentsObj)
                }
            };
        } catch (e) {
            console.error(`Failed to parse tool call arguments: ${e.message}`, jsonCandidate);
            return null;
        }
    }

    /**
     * 去重工具调用
     */
    _deduplicateToolCalls(toolCalls) {
        const seen = new Set();
        const uniqueToolCalls = [];

        for (const tc of toolCalls) {
            const key = `${tc.function.name}-${tc.function.arguments}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueToolCalls.push(tc);
            } else {
                console.log(`Skipping duplicate tool call: ${tc.function.name}`);
            }
        }
        return uniqueToolCalls;
    }

    /**
     * 获取流式转换器方法
     * @returns {Object} 包含流式转换方法的对象
     */
    getStreamTransformers() {
        return {
            transformCodewhispererStreamToAnthropicStream: this.transformCodewhispererStreamToAnthropicStream.bind(this)
        };
    }

    /**
     * 获取支持的功能列表
     * @returns {Array} 功能列表
     */
    getSupportedFeatures() {
        return this.features;
    }

    /**
     * 检查是否支持某个模型
     * @param {string} model - 模型名称
     * @returns {boolean} 是否支持
     */
    supportsModel(model) {
        return this.modelMapping.hasOwnProperty(model);
    }

    /**
     * 获取CodeWhisperer模型名
     * @param {string} anthropicModel - Anthropic模型名
     * @returns {string} CodeWhisperer模型名
     */
    getCodewhispererModel(anthropicModel) {
        return this.modelMapping[anthropicModel] || this.modelMapping["claude-sonnet-4-20250514"];
    }
}