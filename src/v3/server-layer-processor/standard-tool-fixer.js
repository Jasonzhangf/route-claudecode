/**
 * Standard Tool Fixer - 标准工具调用修复器
 * 修复标准OpenAI工具调用格式问题（主要是ID和格式问题）
 * @author Jason Zhang
 */

import { getLogger } from '../logging/index.js';

const logger = getLogger();

export class StandardToolFixer {
    /**
     * 修复标准OpenAI工具调用响应（主要是ID问题）
     */
    static fixStandardToolCallResponse(response, originalRequest, context) {
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