/**
 * Provider-Protocol Layer Implementation
 * 六层架构中的第5层：负责与AI服务提供商的协议通信
 * @author Jason Zhang
 * @version v3.0-refactor
 */
import { BaseLayer } from '../shared/layer-interface.js';
import { OpenAICompatibleProvider, CodeWhispererProvider, GeminiProvider, AnthropicProvider } from './index.js';
import { PreprocessorManager } from '../preprocessor/index.js';
import { transformationManager } from '../transformer/index.js';
import { getLogger } from '../logging/index.js';

const logger = getLogger();

export class ProviderProtocolLayer extends BaseLayer {
    constructor(config = {}) {
        super('provider-protocol-layer', '1.0.0', 'provider-protocol', ['transformer-layer']);
        this.providers = new Map();
        this.preprocessors = new Map();
        this.config = config;
        this.initialized = false;
    }
    
    async initialize() {
        if (this.initialized) return;
        
        logger.info('Initializing Provider-Protocol Layer', {
            configProviders: Object.keys(this.config.providers || {})
        });
        
        // 初始化所有配置的providers和preprocessors
        for (const [id, providerConfig] of Object.entries(this.config.providers || {})) {
            try {
                // 创建provider
                const provider = this.createProvider(id, providerConfig);
                this.providers.set(id, provider);
                
                // 创建对应的preprocessor
                const preprocessor = PreprocessorManager.createPreprocessor(providerConfig.type, providerConfig);
                this.preprocessors.set(id, preprocessor);
                
                logger.info(`Provider ${id} initialized`, {
                    type: providerConfig.type,
                    name: providerConfig.name
                });
            } catch (error) {
                logger.error(`Failed to initialize provider ${id}`, {
                    error: error.message,
                    type: providerConfig.type
                });
            }
        }
        
        this.initialized = true;
    }
    
    createProvider(id, config) {
        switch (config.type) {
            case 'openai':
                return new OpenAICompatibleProvider(id, config);
            case 'codewhisperer':
                return new CodeWhispererProvider(id, config);
            case 'gemini':
                return new GeminiProvider(config, id);
            case 'anthropic':
                return new AnthropicProvider(config);
            default:
                throw new Error(`Unsupported provider type: ${config.type}`);
        }
    }
    
    async process(input, context) {
        await this.initialize();
        
        const { providerId, request, isStreaming, sourceFormat = 'anthropic' } = input;
        
        if (!providerId) {
            throw new Error('Provider ID is required');
        }
        
        const provider = this.providers.get(providerId);
        const preprocessor = this.preprocessors.get(providerId);
        
        if (!provider) {
            throw new Error(`Provider not found: ${providerId}`);
        }
        
        logger.debug('Processing request with provider', {
            providerId,
            isStreaming,
            model: request?.model,
            sourceFormat
        });
        
        try {
            // 步骤1: 确定目标格式
            const providerConfig = this.config.providers[providerId];
            const targetFormat = this.getTargetFormat(providerConfig.type);
            
            // 步骤2: 格式转换 (Anthropic → OpenAI)
            let transformedRequest = request;
            if (sourceFormat !== targetFormat) {
                transformedRequest = transformationManager.transform(request, {
                    sourceFormat,
                    targetFormat,
                    direction: 'request',
                    providerId
                });
                logger.debug('Request transformed', {
                    sourceFormat,
                    targetFormat,
                    originalMessages: request.messages?.length,
                    transformedMessages: transformedRequest.messages?.length
                });
            }
            
            // 步骤3: 预处理 (认证、头部、模型特定调整)
            const preprocessedRequest = await preprocessor.processRequest(transformedRequest, {
                providerId,
                config: providerConfig
            });
            
            // 步骤4: API通信
            let apiResponse;
            if (isStreaming) {
                apiResponse = await provider.sendStreamRequest(preprocessedRequest);
            } else {
                apiResponse = await provider.sendRequest(preprocessedRequest);
            }
            
            // 步骤5: 响应处理
            let finalResponse;
            if (isStreaming) {
                // 流式响应：让transformer处理格式转换
                if (targetFormat !== sourceFormat) {
                    finalResponse = transformationManager.transformStream(apiResponse, {
                        sourceFormat: targetFormat,
                        targetFormat: sourceFormat,
                        providerId
                    });
                } else {
                    finalResponse = apiResponse;
                }
            } else {
                // 非流式响应：直接转换
                if (targetFormat !== sourceFormat) {
                    finalResponse = transformationManager.transform(apiResponse, {
                        sourceFormat: targetFormat,
                        targetFormat: sourceFormat,
                        direction: 'response',
                        providerId
                    });
                } else {
                    finalResponse = apiResponse;
                }
            }
            
            return {
                providerId,
                response: finalResponse,
                isStreaming,
                sourceFormat,
                targetFormat,
                providerProtocolLayerProcessed: true,
                providerProtocolLayerTimestamp: new Date()
            };
        } catch (error) {
            logger.error('Provider request failed', {
                providerId,
                error: error.message,
                model: request?.model
            });
            throw error;
        }
    }
    
    /**
     * 根据provider类型确定目标格式
     */
    getTargetFormat(providerType) {
        switch (providerType) {
            case 'openai':
                return 'openai';
            case 'gemini':
                return 'gemini';
            case 'codewhisperer':
                return 'anthropic'; // CodeWhisperer使用Anthropic格式
            case 'anthropic':
                return 'anthropic';
            default:
                return 'openai'; // 默认使用OpenAI格式
        }
    }
    
    async healthCheck() {
        const healthResults = {};
        
        for (const [id, provider] of this.providers) {
            try {
                healthResults[id] = await provider.isHealthy();
            } catch (error) {
                healthResults[id] = false;
                logger.warn(`Health check failed for provider ${id}`, {
                    error: error.message
                });
            }
        }
        
        return healthResults;
    }
    
    getCapabilities() {
        return {
            supportedOperations: ['protocol-communication', 'provider-integration', 'streaming-support', 'format-transformation', 'preprocessing'],
            inputTypes: ['anthropic-request', 'openai-request', 'gemini-request'],
            outputTypes: ['protocol-response', 'stream-response'],
            dependencies: ['transformer-layer', 'preprocessor-layer'],
            version: this.version
        };
    }
}