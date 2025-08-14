/**
 * Text Tool Parser - 文本工具调用解析器
 * 处理各种文本格式的工具调用并转换为标准OpenAI格式
 * @author Jason Zhang
 */

import { getLogger } from '../logging/index.js';

const logger = getLogger();

export class TextToolParser {
    /**
     * 解析文本格式的工具调用（支持多种文本格式）
     */
    static parseTextBasedToolCallResponse(response, originalRequest, context) {
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
    static inferArgumentsFromText(argsText, functionName) {
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
}