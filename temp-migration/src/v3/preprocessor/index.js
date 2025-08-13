/**
 * Preprocessor Layer - Six-Layer Architecture
 * 负责请求预处理：认证、头部设置、模型特定调整等
 * @author Jason Zhang
 */
import { getLogger } from '../logging/index.js';

const logger = getLogger();

/**
 * OpenAI兼容预处理器
 */
class OpenAICompatiblePreprocessor {
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

        // ModelScope GLM-4.5 特殊处理
        if (config.modelSpecific?.['GLM-4.5']?.toolCallFormat === 'text-based') {
            logger.debug('Applying GLM-4.5 specific adjustments', {
                model: request.model
            });
            // GLM-4.5 的特殊处理
            if (request.tools) {
                adjusted.tool_choice = 'auto';
            }
        }

        // Qwen 模型特殊处理
        if (request.model?.includes('Qwen')) {
            logger.debug('Applying Qwen specific adjustments', {
                model: request.model
            });
            // Qwen 的特殊处理
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
        switch (type) {
            case 'openai':
                return new OpenAICompatiblePreprocessor(config);
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
    GeminiPreprocessor,
    CodeWhispererPreprocessor,
    PreprocessorManager
};