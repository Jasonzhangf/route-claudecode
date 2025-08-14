/**
 * OpenAI Compatible Preprocessor - OpenAI兼容预处理器
 * 基于特征的智能预处理和响应修复
 * @author Jason Zhang
 */

import { getLogger } from '../logging/index.js';
import { FeatureDetector } from './feature-detector.js';
import { TextToolParser } from './text-tool-parser.js';
import { JSONToolFixer } from './json-tool-fixer.js';
import { StandardToolFixer } from './standard-tool-fixer.js';

const logger = getLogger();

export class OpenAICompatiblePreprocessor {
    constructor(config) {
        this.config = config;
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

        // 3. 基于特征的模型特定调整
        processedRequest = this.applyFeatureBasedAdjustments(processedRequest, context);

        // 4. 工具调用格式修正
        processedRequest = this.fixToolCallFormat(processedRequest, context);

        return processedRequest;
    }

    /**
     * 添加认证信息
     */
    addAuthentication(request, context) {
        const { config } = context;
        
        if (config && config.authentication?.type === 'bearer') {
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
        const standardized = { ...request };

        // 确保必要字段存在
        if (!standardized.messages) {
            standardized.messages = [];
        }

        return standardized;
    }

    /**
     * 基于特征的模型特定调整
     */
    applyFeatureBasedAdjustments(request, context) {
        let adjusted = { ...request };

        // 基于特征的文本工具调用模型处理（如GLM系列）
        if (FeatureDetector.needsTextBasedToolCallParsing(request, context)) {
            adjusted = this.applyTextBasedToolCallAdjustments(adjusted, context);
        }

        // 基于特征的增强JSON格式处理（如Qwen/Coder系列）  
        if (FeatureDetector.needsEnhancedJSONFormat(request, context)) {
            adjusted = this.applyEnhancedJSONFormatAdjustments(adjusted, context);
        }

        // 基于特征的标准OpenAI格式处理
        if (FeatureDetector.needsStandardOpenAIFormat(request, context)) {
            adjusted = this.applyStandardOpenAIFormatAdjustments(adjusted, context);
        }

        return adjusted;
    }

    /**
     * 应用文本工具调用模型调整
     */
    applyTextBasedToolCallAdjustments(request, context) {
        logger.debug('Applying text-based tool call processing adjustments', {
            model: request.model,
            endpoint: context.config?.endpoint
        });
        
        const adjusted = { ...request };
        
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

        return adjusted;
    }

    /**
     * 应用增强JSON格式调整
     */
    applyEnhancedJSONFormatAdjustments(request, context) {
        logger.debug('Applying enhanced JSON format adjustments', {
            model: request.model,
            endpoint: context.config?.endpoint
        });
        
        const adjusted = { ...request };
        
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

        return adjusted;
    }

    /**
     * 应用标准OpenAI格式调整
     */
    applyStandardOpenAIFormatAdjustments(request, context) {
        logger.debug('Applying standard OpenAI format adjustments', {
            model: request.model,
            endpoint: context.config?.endpoint
        });
        
        const adjusted = { ...request };
        
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
     * 双向工具响应转换 - 核心功能
     * 基于响应特征自动选择合适的处理方式
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
        if (FeatureDetector.hasTextBasedToolCallsInResponse(response)) {
            return TextToolParser.parseTextBasedToolCallResponse(response, originalRequest, context);
        }

        // 基于响应特征检测需要JSON修复的工具调用
        if (FeatureDetector.hasmalformedJSONToolCalls(response)) {
            return JSONToolFixer.parseAndFixJSONToolCallResponse(response, originalRequest, context);
        }

        // 基于响应特征检测标准OpenAI工具调用但需要ID修复
        if (FeatureDetector.needsToolCallIDFix(response)) {
            return StandardToolFixer.fixStandardToolCallResponse(response, originalRequest, context);
        }

        return response;
    }
}