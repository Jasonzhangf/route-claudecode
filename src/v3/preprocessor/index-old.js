/**
 * Preprocessor Layer - Six-Layer Architecture
 * 负责请求预处理：认证、头部设置、模型特定调整等
 * @author Jason Zhang
 */
import { getLogger } from '../logging/index.js';
import { LMStudioOpenAIPreprocessor } from './lmstudio-openai-preprocessor.js';
import { OpenAICompatiblePreprocessor } from './openai-compatible-preprocessor.js';

const logger = getLogger();

// 导出新的模块化预处理器
export { OpenAICompatiblePreprocessor } from './openai-compatible-preprocessor.js';
export { FeatureDetector } from './feature-detector.js';
export { TextToolParser } from './text-tool-parser.js';
export { JSONToolFixer } from './json-tool-fixer.js';
export { StandardToolFixer } from './standard-tool-fixer.js';

/**
 * 保持向后兼容的旧OpenAI预处理器类
 * @deprecated 请使用新的模块化 OpenAICompatiblePreprocessor
 */
class LegacyOpenAICompatiblePreprocessor {
    constructor(config) {
        this.config = config;
        // 内部使用新的预处理器
        this.newPreprocessor = new OpenAICompatiblePreprocessor(config);
    }

    async processRequest(request, context) {
        return this.newPreprocessor.processRequest(request, context);
    }

    async postprocessResponse(response, originalRequest, context) {
        return this.newPreprocessor.postprocessResponse(response, originalRequest, context);
    }
}

    /**
     * 预处理请求
     */
    async processRequest(request, context) {
        logger.debug('OpenAI preprocessor processing request', {
            model: request.model,
            providerId: context.providerId
        });

        let processedRequest = { ...request };

        // 1. 认证处理
        processedRequest = this.addAuthentication(processedRequest, context);

        // 2. 头部标准化
        processedRequest = this.standardizeHeaders(processedRequest, context);

        // 3. 模型特定调整
        processedRequest = this.applyModelSpecificAdjustments(processedRequest, context);

        // 4. 工具调用格式修正
        processedRequest = this.fixToolCallFormat(processedRequest, context);

        return processedRequest;
    }

    /**
     * 添加认证信息
     */
    addAuthentication(request, context) {
        // 认证信息通常在HTTP头部处理，这里可以做一些特殊的认证预处理
        const { config } = context;
        
        if (config.authentication?.type === 'bearer') {
            // 可以在这里添加特殊的认证处理逻辑
            logger.debug('Bearer authentication configured', {
                providerId: context.providerId
            });
        }

        return request;
    }

    /**
     * 标准化请求头部
     */
    standardizeHeaders(request, context) {
        // 标准化请求格式
        const standardized = { ...request };

        // 确保必要字段存在
        if (!standardized.messages) {
            standardized.messages = [];
        }

        return standardized;
    }

    /**
     * 应用模型特定调整
     */
    applyModelSpecificAdjustments(request, context) {
        const { config } = context;
        let adjusted = { ...request };

        // 基于特征的文本工具调用模型处理（如GLM系列）
        if (this.needsTextBasedToolCallParsing(request, context)) {
            logger.debug('Applying text-based tool call processing adjustments', {
                model: request.model,
                endpoint: context.config?.endpoint
            });
            
            // 文本工具调用模型通常需要更高的温度来保持创造性
            adjusted.temperature = 0.8;
            
            // 增强工具描述，帮助模型理解工具用途
            if (request.tools) {
                adjusted.tool_choice = 'auto';
                
                adjusted.tools = request.tools.map(tool => ({
                    ...tool,
                    function: {
                        ...tool.function,
                        description: tool.function?.description || `Execute ${tool.function?.name || 'function'}`,
                        parameters: {
                            type: 'object',
                            properties: tool.function?.parameters?.properties || {},
                            required: tool.function?.parameters?.required || []
                        }
                    }
                }));
            }
        }

        // 基于特征的增强JSON格式处理（如Qwen/Coder系列）  
        if (this.needsEnhancedJSONFormat(request, context)) {
            logger.debug('Applying enhanced JSON format adjustments', {
                model: request.model,
                endpoint: context.config?.endpoint
            });
            
            // 编码模型通常需要较低温度保持准确性
            adjusted.temperature = 0.7;
            
            // 为Coder类模型添加结构化提示
            if (adjusted.messages && adjusted.messages.length > 0) {
                const systemMessage = adjusted.messages.find(msg => msg.role === 'system');
                if (systemMessage && request.tools) {
                    systemMessage.content = `${systemMessage.content}\n\nIMPORTANT: When using tools, ensure all arguments are properly structured JSON format.`;
                }
            }
            
            // 工具调用严格JSON schema
            if (request.tools) {
                adjusted.tool_choice = 'auto';
                
                adjusted.tools = request.tools.map(tool => ({
                    ...tool,
                    function: {
                        ...tool.function,
                        parameters: {
                            type: 'object',
                            properties: tool.function?.parameters?.properties || {},
                            required: tool.function?.parameters?.required || [],
                            additionalProperties: false
                        }
                    }
                }));
            }
        }

        // 基于特征的标准OpenAI格式处理
        if (this.needsStandardOpenAIFormat(request, context)) {
            logger.debug('Applying standard OpenAI format adjustments', {
                model: request.model,
                endpoint: context.config?.endpoint
            });
            
            // 标准OpenAI兼容服务的通用优化
            if (!adjusted.temperature) {
                adjusted.temperature = 0.7;
            }
            
            // 工具调用格式标准化为OpenAI规范
            if (request.tools) {
                adjusted.tool_choice = 'auto';
                
                adjusted.tools = request.tools.map(tool => ({
                    type: 'function',
                    function: {
                        name: tool.name || tool.function?.name,
                        description: tool.description || tool.function?.description || `Execute ${tool.name || 'function'}`,
                        parameters: tool.input_schema || tool.function?.parameters || {
                            type: 'object',
                            properties: {}
                        }
                    }
                }));
            }
        }

        return adjusted;
    }

    /**
     * 修正工具调用格式
     */
    fixToolCallFormat(request, context) {
        if (!request.tools || request.tools.length === 0) {
            return request;
        }

        const fixed = { ...request };

        // 确保工具格式正确
        fixed.tools = request.tools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name || tool.function?.name,
                description: tool.description || tool.function?.description,
                parameters: tool.input_schema || tool.function?.parameters || {}
            }
        }));

        // 设置tool_choice
        if (!fixed.tool_choice) {
            fixed.tool_choice = 'auto';
        }

        logger.debug('Tool call format fixed', {
            toolCount: fixed.tools.length,
            toolChoice: fixed.tool_choice
        });

        return fixed;
    }

    /**
     * 基于特征检测GLM类型模型（需要文本工具调用解析）
     */
    needsTextBasedToolCallParsing(request, context) {
        // 特征1: 配置明确标注需要文本工具调用处理
        if (context.config?.modelSpecific?.['GLM-4.5']?.toolCallFormat === 'text-based') {
            return true;
        }
        
        // 特征2: ModelScope端点 + GLM相关模型名
        const hasModelScopeEndpoint = context.config?.endpoint?.includes('modelscope.cn');
        const hasGLMModel = request.model?.includes('GLM') || request.model?.includes('ZhipuAI');
        
        return hasModelScopeEndpoint && hasGLMModel;
    }

    /**
     * 基于特征检测需要增强JSON格式的模型（如Qwen）
     */
    needsEnhancedJSONFormat(request, context) {
        // 特征1: Qwen系列模型通常需要严格的JSON格式
        const hasQwenModel = request.model?.includes('Qwen') || request.model?.includes('qwen');
        
        // 特征2: 大模型编码相关的模型通常需要结构化处理
        const isCoderModel = request.model?.includes('Coder') || request.model?.includes('Code');
        
        // 特征3: 配置明确要求特殊处理
        const requiresSpecialHandling = context.config?.modelSpecific?.Qwen?.requiresSpecialHandling;
        
        return hasQwenModel || isCoderModel || requiresSpecialHandling;
    }

    /**
     * 基于特征检测需要标准OpenAI格式处理的provider
     */
    needsStandardOpenAIFormat(request, context) {
        // 特征1: 配置中明确声明为OpenAI兼容
        if (context.config?.type === 'openai') {
            return true;
        }
        
        // 特征2: 端点路径包含标准OpenAI格式
        const hasOpenAIEndpoint = context.config?.endpoint?.includes('/v1/chat/completions');
        
        // 特征3: 非官方OpenAI但兼容OpenAI格式的服务
        const isThirdPartyOpenAI = hasOpenAIEndpoint && !context.config?.endpoint?.includes('api.openai.com');
        
        return isThirdPartyOpenAI;
    }

    /**
     * 双向工具响应转换 - 核心功能
     * 处理不同provider的工具调用响应格式差异
     */
    async postprocessResponse(response, originalRequest, context) {
        if (!response) {
            return response;
        }

        logger.debug('OpenAI preprocessor postprocessing response', {
            providerId: context.providerId,
            hasChoices: !!(response.choices && response.choices.length > 0)
        });

        // 基于响应内容特征检测文本格式工具调用
        if (this.hasTextBasedToolCallsInResponse(response)) {
            return this.parseTextBasedToolCallResponse(response, originalRequest, context);
        }

        // 基于响应特征检测需要JSON修复的工具调用
        if (this.hasmalformedJSONToolCalls(response)) {
            return this.parseAndFixJSONToolCallResponse(response, originalRequest, context);
        }

        // 基于响应特征检测标准OpenAI工具调用但需要ID修复
        if (this.needsToolCallIDFix(response)) {
            return this.fixStandardToolCallResponse(response, originalRequest, context);
        }

        return response;
    }

    /**
     * 检测响应中是否包含文本格式的工具调用
     */
    hasTextBasedToolCallsInResponse(response) {
        if (!response?.choices?.[0]?.message?.content) {
            return false;
        }

        const content = response.choices[0].message.content;
        if (typeof content !== 'string') {
            return false;
        }

        // 检测常见的文本工具调用格式
        const textToolCallPatterns = [
            /Tool call:\s*\w+\s*\([^)]*\)/i,     // GLM: Tool call: FunctionName(...)
            /function_call:\s*\w+\s*\([^)]*\)/i, // 其他: function_call: FunctionName(...)
            /调用工具:\s*\w+\s*\([^)]*\)/i,        // 中文: 调用工具: FunctionName(...)
            /\[TOOL_CALL\]\s*\w+\s*\([^)]*\)/i   // 标记格式: [TOOL_CALL] FunctionName(...)
        ];

        return textToolCallPatterns.some(pattern => pattern.test(content));
    }

    /**
     * 检测响应中是否有格式错误的JSON工具调用
     */
    hasmalformedJSONToolCalls(response) {
        if (!response?.choices?.[0]?.message?.tool_calls) {
            return false;
        }

        const toolCalls = response.choices[0].message.tool_calls;
        return toolCalls.some(toolCall => {
            const args = toolCall.function?.arguments;
            if (typeof args !== 'string') {
                return false;
            }

            try {
                JSON.parse(args);
                return false; // JSON格式正确
            } catch (error) {
                return true; // JSON格式错误
            }
        });
    }

    /**
     * 检测工具调用是否缺少ID
     */
    needsToolCallIDFix(response) {
        if (!response?.choices?.[0]?.message?.tool_calls) {
            return false;
        }

        const toolCalls = response.choices[0].message.tool_calls;
        return toolCalls.some(toolCall => !toolCall.id);
    }

    /**
     * 解析文本格式的工具调用（支持多种文本格式）
     */
    parseTextBasedToolCallResponse(response, originalRequest, context) {
        if (!response.choices || response.choices.length === 0) {
            return response;
        }

        const choice = response.choices[0];
        const message = choice?.message;

        if (message && message.content && typeof message.content === 'string') {
            const content = message.content;
            let allMatches = [];
            
            // 支持多种文本工具调用格式
            const patterns = [
                { pattern: /Tool call:\s*(\w+)\s*\(([^)]*)\)/gi, name: 'GLM-style' },
                { pattern: /function_call:\s*(\w+)\s*\(([^)]*)\)/gi, name: 'function_call-style' },
                { pattern: /调用工具:\s*(\w+)\s*\(([^)]*)\)/gi, name: 'Chinese-style' },
                { pattern: /\[TOOL_CALL\]\s*(\w+)\s*\(([^)]*)\)/gi, name: 'bracketed-style' }
            ];

            // 尝试所有模式
            for (const {pattern, name} of patterns) {
                const matches = [...content.matchAll(pattern)];
                if (matches.length > 0) {
                    logger.debug(`Detected ${name} text-based tool calls`, {
                        count: matches.length,
                        endpoint: context.config?.endpoint
                    });
                    allMatches.push(...matches.map(match => ({match, pattern})));
                    break; // 找到匹配的模式就停止
                }
            }

            if (allMatches.length > 0) {
                const toolCalls = allMatches.map(({match}, index) => {
                    const functionName = match[1];
                    let args = match[2];
                    
                    // 智能参数解析
                    let parsedArgs;
                    try {
                        // 尝试直接解析JSON
                        if (args.trim().startsWith('{') && args.trim().endsWith('}')) {
                            parsedArgs = JSON.parse(args);
                        } else if (args.trim()) {
                            // 尝试包装成对象
                            parsedArgs = JSON.parse(`{${args}}`);
                        } else {
                            parsedArgs = {};
                        }
                    } catch (error) {
                        // 解析失败，使用智能推断
                        parsedArgs = this.inferArgumentsFromText(args, functionName);
                    }
                    
                    return {
                        id: `call_${Date.now()}_${index}`,
                        type: 'function',
                        function: {
                            name: functionName,
                            arguments: JSON.stringify(parsedArgs)
                        }
                    };
                });

                // 移除文本中的工具调用模式
                let cleanContent = content;
                for (const {pattern} of patterns) {
                    cleanContent = cleanContent.replace(pattern, '');
                }
                
                message.tool_calls = toolCalls;
                message.content = cleanContent.trim() || null;
                choice.finish_reason = 'tool_calls';
            }
        }

        return response;
    }

    /**
     * 从文本推断工具参数
     */
    inferArgumentsFromText(argsText, functionName) {
        if (!argsText || !argsText.trim()) {
            return {};
        }

        // 简单的参数推断逻辑
        const text = argsText.trim();
        
        // 检查是否像键值对
        const keyValuePairs = text.split(',').map(pair => pair.trim());
        const inferredArgs = {};
        
        for (const pair of keyValuePairs) {
            const colonIndex = pair.indexOf(':');
            const equalIndex = pair.indexOf('=');
            
            if (colonIndex > 0) {
                const key = pair.substring(0, colonIndex).trim().replace(/"/g, '');
                const value = pair.substring(colonIndex + 1).trim().replace(/"/g, '');
                inferredArgs[key] = value;
            } else if (equalIndex > 0) {
                const key = pair.substring(0, equalIndex).trim().replace(/"/g, '');
                const value = pair.substring(equalIndex + 1).trim().replace(/"/g, '');
                inferredArgs[key] = value;
            }
        }

        // 如果没有找到键值对，使用默认策略
        if (Object.keys(inferredArgs).length === 0) {
            inferredArgs.input = text;
        }

        return inferredArgs;
    }

    /**
     * 解析和修复格式错误的JSON工具调用
     */
    parseAndFixJSONToolCallResponse(response, originalRequest, context) {
        if (!response.choices || response.choices.length === 0) {
            return response;
        }

        const choice = response.choices[0];
        const message = choice?.message;

        if (message && message.tool_calls) {
            logger.debug('Fixing malformed JSON in tool calls', {
                toolCallCount: message.tool_calls.length,
                endpoint: context.config?.endpoint
            });

            // 修复格式错误的tool_calls
            message.tool_calls = message.tool_calls.map((toolCall, index) => {
                const args = toolCall.function?.arguments;
                if (typeof args === 'string') {
                    try {
                        JSON.parse(args);
                        return toolCall; // JSON正确，无需修复
                    } catch (error) {
                        logger.warn('Fixing malformed JSON tool arguments', {
                            functionName: toolCall.function?.name,
                            originalArgs: args,
                            error: error.message
                        });
                        
                        // 尝试多种修复策略
                        const fixedArgs = this.fixMalformedJSON(args);
                        
                        return {
                            ...toolCall,
                            id: toolCall.id || `call_${Date.now()}_${index}`,
                            function: {
                                ...toolCall.function,
                                arguments: JSON.stringify(fixedArgs)
                            }
                        };
                    }
                }
                
                // 确保ID存在
                if (!toolCall.id) {
                    toolCall.id = `call_${Date.now()}_${index}`;
                }
                
                return toolCall;
            });

            choice.finish_reason = 'tool_calls';
        }

        return response;
    }

    /**
     * 修复格式错误的JSON字符串
     */
    fixMalformedJSON(jsonString) {
        if (!jsonString) {
            return {};
        }

        let fixed = jsonString.trim();
        
        try {
            // 常见修复策略
            fixed = fixed
                .replace(/,\s*}/g, '}')           // 移除尾随逗号
                .replace(/,\s*]/g, ']')           // 移除数组尾随逗号
                .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // 给键加引号
                .replace(/:\s*([^",{\[}\]]+)(?=[,}])/g, ': "$1"') // 给字符串值加引号
                .replace(/:\s*'([^']*)'(?=[,}])/g, ': "$1"'); // 单引号改双引号

            return JSON.parse(fixed);
        } catch (secondError) {
            logger.warn('Could not fix malformed JSON, using fallback', {
                original: jsonString,
                attempted: fixed
            });
            
            // 最终回退策略：解析为简单文本参数
            return this.parseAsSimpleArguments(jsonString);
        }
    }

    /**
     * 将复杂参数解析为简单键值对
     */
    parseAsSimpleArguments(argsString) {
        const args = {};
        
        // 尝试提取看起来像参数的内容
        const paramPattern = /(\w+)[:=]\s*([^,}]+)/g;
        let match;
        
        while ((match = paramPattern.exec(argsString)) !== null) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/['"]/g, '');
            args[key] = value;
        }
        
        // 如果没找到任何参数，使用原始字符串
        if (Object.keys(args).length === 0) {
            args.raw_input = argsString;
        }
        
        return args;
    }

    /**
     * 修复标准OpenAI工具调用响应（主要是ID问题）
     */
    fixStandardToolCallResponse(response, originalRequest, context) {
        if (!response.choices || response.choices.length === 0) {
            return response;
        }

        const choice = response.choices[0];
        const message = choice?.message;

        if (message && message.tool_calls) {
            logger.debug('Fixing standard OpenAI tool call response', {
                toolCallCount: message.tool_calls.length,
                endpoint: context.config?.endpoint
            });

            // 确保所有工具调用都有ID和正确的格式
            message.tool_calls = message.tool_calls.map((toolCall, index) => {
                const fixed = { ...toolCall };
                
                // 确保ID存在
                if (!fixed.id) {
                    fixed.id = `call_${Date.now()}_${index}`;
                }
                
                // 确保type字段正确
                if (!fixed.type) {
                    fixed.type = 'function';
                }
                
                // 确保function字段完整
                if (fixed.function) {
                    if (!fixed.function.name) {
                        logger.warn('Tool call missing function name', { toolCall: fixed });
                        fixed.function.name = 'unknown_function';
                    }
                    
                    // 确保arguments是字符串
                    if (typeof fixed.function.arguments !== 'string') {
                        fixed.function.arguments = JSON.stringify(fixed.function.arguments || {});
                    }
                    
                    // 验证arguments是否为有效JSON
                    try {
                        JSON.parse(fixed.function.arguments);
                    } catch (error) {
                        logger.warn('Invalid JSON in function arguments, wrapping as raw_input', {
                            functionName: fixed.function.name,
                            args: fixed.function.arguments
                        });
                        fixed.function.arguments = JSON.stringify({
                            raw_input: fixed.function.arguments
                        });
                    }
                }
                
                return fixed;
            });

            choice.finish_reason = 'tool_calls';
        }

        return response;
    }
}

/**
 * Gemini预处理器
 */
class GeminiPreprocessor {
    constructor(config) {
        this.config = config;
    }

    async processRequest(request, context) {
        logger.debug('Gemini preprocessor processing request', {
            model: request.model,
            providerId: context.providerId
        });

        // Gemini特定的预处理逻辑
        return request;
    }
}

/**
 * CodeWhisperer预处理器
 */
class CodeWhispererPreprocessor {
    constructor(config) {
        this.config = config;
    }

    async processRequest(request, context) {
        logger.debug('CodeWhisperer preprocessor processing request', {
            model: request.model,
            providerId: context.providerId
        });

        // CodeWhisperer特定的预处理逻辑
        return request;
    }
}

/**
 * 预处理器管理器
 */
class PreprocessorManager {
    static createPreprocessor(type, config) {
        // Auto-detect LM Studio based on endpoint for OpenAI-compatible providers
        if (type === 'openai' && config && config.endpoint) {
            const isLMStudio = config.endpoint.includes('localhost:1234') || 
                              config.endpoint.includes('127.0.0.1:1234');
            if (isLMStudio) {
                logger.debug('Auto-detected LM Studio endpoint, using LMStudioOpenAIPreprocessor', {
                    endpoint: config.endpoint
                });
                return new LMStudioOpenAIPreprocessor(config);
            }
        }
        
        switch (type) {
            case 'openai':
                return new OpenAICompatiblePreprocessor(config);
            case 'lmstudio':
                // LM Studio is OpenAI-compatible but needs special preprocessing
                return new LMStudioOpenAIPreprocessor(config);
            case 'gemini':
                return new GeminiPreprocessor(config);
            case 'codewhisperer':
                return new CodeWhispererPreprocessor(config);
            default:
                throw new Error(`Unsupported preprocessor type: ${type}`);
        }
    }
}

// 兼容旧接口
export function getPreprocessor(type = 'openai', config = {}) {
    return PreprocessorManager.createPreprocessor(type, config);
}

export {
    OpenAICompatiblePreprocessor,
    LMStudioOpenAIPreprocessor,
    GeminiPreprocessor,
    CodeWhispererPreprocessor,
    PreprocessorManager
};