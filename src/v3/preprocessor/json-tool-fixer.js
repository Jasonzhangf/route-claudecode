/**
 * JSON Tool Fixer - JSON工具调用修复器
 * 修复格式错误的JSON工具调用参数
 * @author Jason Zhang
 */

import { getLogger } from '../logging/index.js';

const logger = getLogger();

export class JSONToolFixer {
    /**
     * 解析和修复格式错误的JSON工具调用
     */
    static parseAndFixJSONToolCallResponse(response, originalRequest, context) {
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
    static fixMalformedJSON(jsonString) {
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
    static parseAsSimpleArguments(argsString) {
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
}