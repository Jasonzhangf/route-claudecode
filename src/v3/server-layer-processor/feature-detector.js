/**
 * Feature Detector - 基于特征的模型和响应检测
 * 负责智能检测不同模型和响应的特征，避免硬编码
 * @author Jason Zhang
 */

import { getLogger } from '../logging/index.js';

const logger = getLogger();

export class FeatureDetector {
    /**
     * 基于特征检测GLM类型模型（需要文本工具调用解析）
     */
    static needsTextBasedToolCallParsing(request, context) {
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
    static needsEnhancedJSONFormat(request, context) {
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
    static needsStandardOpenAIFormat(request, context) {
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
     * 检测响应中是否包含文本格式的工具调用
     */
    static hasTextBasedToolCallsInResponse(response) {
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
    static hasmalformedJSONToolCalls(response) {
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
    static needsToolCallIDFix(response) {
        if (!response?.choices?.[0]?.message?.tool_calls) {
            return false;
        }

        const toolCalls = response.choices[0].message.tool_calls;
        return toolCalls.some(toolCall => !toolCall.id);
    }
}