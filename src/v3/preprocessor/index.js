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
export { LMStudioOpenAIPreprocessor } from './lmstudio-openai-preprocessor.js';

// Gemini预处理器
export { GeminiPreprocessor } from './gemini-preprocessor.js';

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
    static async createPreprocessor(type, config) {
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
                // 使用专用Gemini预处理器
                const { GeminiPreprocessor: GeminiPreprocessorClass } = await import('./gemini-preprocessor.js');
                return new GeminiPreprocessorClass(config);
            case 'codewhisperer':
                return new CodeWhispererPreprocessor(config);
            default:
                throw new Error(`Unsupported preprocessor type: ${type}`);
        }
    }
}

// 兼容旧接口
export async function getPreprocessor(type = 'openai', config = {}) {
    return await PreprocessorManager.createPreprocessor(type, config);
}

export {
    CodeWhispererPreprocessor,
    PreprocessorManager
};