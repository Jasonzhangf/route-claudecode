/**
 * Provider Simulation
 * 模拟各种AI Provider的行为和特性
 * @author Jason Zhang
 * @version v3.0-refactor
 */

import { EventEmitter } from 'events';

export class ProviderSimulation extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            enabledProviders: config.enabledProviders || ['anthropic', 'openai', 'gemini', 'codewhisperer'],
            providerBehaviors: config.providerBehaviors || {},
            responsePatterns: config.responsePatterns || {},
            ...config
        };
        
        // Provider行为模拟器
        this.providerSimulators = new Map();
        
        // Provider特性配置
        this.providerCharacteristics = {
            'anthropic': {
                averageLatency: { min: 800, max: 3000 },
                tokenEfficiency: 0.9,
                errorRate: 0.01,
                rateLimits: { rpm: 100, tpm: 40000 },
                specialFeatures: ['tool_use', 'long_context', 'vision'],
                responsePatterns: {
                    structured: 0.8,
                    verbose: 0.7,
                    technical: 0.9
                }
            },
            'openai': {
                averageLatency: { min: 500, max: 2500 },
                tokenEfficiency: 0.85,
                errorRate: 0.015,
                rateLimits: { rpm: 200, tpm: 60000 },
                specialFeatures: ['function_calling', 'code_interpreter', 'vision'],
                responsePatterns: {
                    structured: 0.9,
                    verbose: 0.6,
                    technical: 0.8
                }
            },
            'gemini': {
                averageLatency: { min: 600, max: 2800 },
                tokenEfficiency: 0.88,
                errorRate: 0.02,
                rateLimits: { rpm: 150, tpm: 50000 },
                specialFeatures: ['multimodal', 'code_execution', 'search'],
                responsePatterns: {
                    structured: 0.75,
                    verbose: 0.8,
                    technical: 0.85
                }
            },
            'codewhisperer': {
                averageLatency: { min: 300, max: 1500 },
                tokenEfficiency: 0.95,
                errorRate: 0.005,
                rateLimits: { rpm: 500, tpm: 100000 },
                specialFeatures: ['code_completion', 'security_scan', 'optimization'],
                responsePatterns: {
                    structured: 0.95,
                    verbose: 0.3,
                    technical: 0.95
                }
            }
        };
        
        console.log('🤖 Provider Simulation initialized');
    }
    
    /**
     * 初始化Provider模拟器
     */
    async initialize() {
        console.log('🚀 Initializing Provider simulators...');
        
        for (const providerType of this.config.enabledProviders) {
            try {
                const simulator = this.createProviderSimulator(providerType);
                this.providerSimulators.set(providerType, simulator);
                
                console.log(`✅ Initialized ${providerType} simulator`);
                
            } catch (error) {
                console.warn(`⚠️  Failed to initialize ${providerType} simulator:`, error.message);
            }
        }
        
        console.log(`🎯 Provider simulation ready - ${this.providerSimulators.size} providers`);
    }
    
    /**
     * 创建特定Provider的模拟器
     */
    createProviderSimulator(providerType) {
        const characteristics = this.providerCharacteristics[providerType];
        if (!characteristics) {
            throw new Error(`Unknown provider type: ${providerType}`);
        }
        
        return new ProviderSimulator(providerType, characteristics, {
            ...this.config.providerBehaviors[providerType],
            ...this.config
        });
    }
    
    /**
     * 模拟Provider响应
     */
    async simulateProviderResponse(providerType, request, options = {}) {
        const simulator = this.providerSimulators.get(providerType);
        if (!simulator) {
            throw new Error(`Provider simulator not found: ${providerType}`);
        }
        
        return await simulator.processRequest(request, options);
    }
    
    /**
     * 获取Provider特性信息
     */
    getProviderCharacteristics(providerType) {
        return this.providerCharacteristics[providerType] || null;
    }
    
    /**
     * 获取所有支持的Provider
     */
    getSupportedProviders() {
        return Object.keys(this.providerCharacteristics);
    }
    
    /**
     * 获取活跃的模拟器
     */
    getActiveSimulators() {
        return Array.from(this.providerSimulators.keys());
    }
    
    /**
     * 更新Provider行为
     */
    updateProviderBehavior(providerType, behaviorUpdates) {
        const simulator = this.providerSimulators.get(providerType);
        if (simulator) {
            simulator.updateBehavior(behaviorUpdates);
            console.log(`🔄 Updated ${providerType} behavior`);
        }
    }
    
    /**
     * 获取模拟统计
     */
    getSimulationStats() {
        const stats = {
            totalProviders: this.providerSimulators.size,
            enabledProviders: this.config.enabledProviders,
            providerStats: {}
        };
        
        for (const [providerType, simulator] of this.providerSimulators) {
            stats.providerStats[providerType] = simulator.getStats();
        }
        
        return stats;
    }
    
    /**
     * 清理资源
     */
    async cleanup() {
        for (const simulator of this.providerSimulators.values()) {
            await simulator.cleanup();
        }
        
        this.providerSimulators.clear();
        this.removeAllListeners();
        
        console.log('🧹 Provider Simulation cleaned up');
    }
}

/**
 * 单个Provider模拟器类
 */
export class ProviderSimulator extends EventEmitter {
    constructor(providerType, characteristics, config = {}) {
        super();
        
        this.providerType = providerType;
        this.characteristics = characteristics;
        this.config = config;
        
        // 统计信息
        this.stats = {
            totalRequests: 0,
            totalResponses: 0,
            totalErrors: 0,
            averageLatency: 0,
            lastRequestTime: null
        };
        
        // 速率限制状态
        this.rateLimitState = {
            requestCount: 0,
            tokenCount: 0,
            windowStart: Date.now()
        };
        
        console.log(`🤖 ${providerType} simulator created`);
    }
    
    /**
     * 处理请求
     */
    async processRequest(request, options = {}) {
        const startTime = Date.now();
        this.stats.totalRequests += 1;
        this.stats.lastRequestTime = new Date().toISOString();
        
        try {
            // 1. 检查速率限制
            this.checkRateLimit();
            
            // 2. 模拟网络延迟
            const latency = this.calculateLatency(request);
            await this.sleep(latency);
            
            // 3. 模拟错误
            this.simulateErrors();
            
            // 4. 生成响应
            const response = this.generateProviderResponse(request, options);
            
            // 5. 更新统计
            const actualLatency = Date.now() - startTime;
            this.updateStats(actualLatency, false);
            
            this.emit('requestProcessed', {
                providerType: this.providerType,
                request,
                response,
                latency: actualLatency
            });
            
            return response;
            
        } catch (error) {
            const errorLatency = Date.now() - startTime;
            this.updateStats(errorLatency, true);
            
            this.emit('requestError', {
                providerType: this.providerType,
                request,
                error: error.message,
                latency: errorLatency
            });
            
            throw error;
        }
    }
    
    /**
     * 检查速率限制
     */
    checkRateLimit() {
        const now = Date.now();
        const windowDuration = 60000; // 1分钟窗口
        
        // 重置窗口
        if (now - this.rateLimitState.windowStart > windowDuration) {
            this.rateLimitState.requestCount = 0;
            this.rateLimitState.tokenCount = 0;
            this.rateLimitState.windowStart = now;
        }
        
        // 检查请求限制
        if (this.rateLimitState.requestCount >= this.characteristics.rateLimits.rpm) {
            throw new Error(`Rate limit exceeded: ${this.characteristics.rateLimits.rpm} RPM`);
        }
        
        this.rateLimitState.requestCount += 1;
    }
    
    /**
     * 计算延迟
     */
    calculateLatency(request) {
        const { min, max } = this.characteristics.averageLatency;
        const baseLatency = Math.random() * (max - min) + min;
        
        // 基于请求复杂度调整
        const complexity = this.assessRequestComplexity(request);
        return baseLatency * complexity;
    }
    
    /**
     * 评估请求复杂度
     */
    assessRequestComplexity(request) {
        let complexity = 1.0;
        
        const requestStr = JSON.stringify(request);
        
        // 基于内容长度
        if (requestStr.length > 10000) complexity *= 1.5;
        if (requestStr.length > 50000) complexity *= 2.0;
        
        // 基于特殊功能
        if (requestStr.includes('tool') || requestStr.includes('function')) {
            complexity *= 1.3;
        }
        if (requestStr.includes('image') || requestStr.includes('vision')) {
            complexity *= 1.8;
        }
        if (requestStr.includes('code')) {
            complexity *= 1.2;
        }
        
        return complexity;
    }
    
    /**
     * 模拟错误
     */
    simulateErrors() {
        if (Math.random() < this.characteristics.errorRate) {
            const errorTypes = [
                'Internal server error',
                'Rate limit exceeded',
                'Model overloaded',
                'Invalid request format',
                'Authentication failed'
            ];
            
            const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
            throw new Error(`${this.providerType}: ${errorType}`);
        }
    }
    
    /**
     * 生成Provider特定响应
     */
    generateProviderResponse(request, options) {
        const responseGenerators = {
            'anthropic': this.generateAnthropicResponse.bind(this),
            'openai': this.generateOpenAIResponse.bind(this),
            'gemini': this.generateGeminiResponse.bind(this),
            'codewhisperer': this.generateCodeWhispererResponse.bind(this)
        };
        
        const generator = responseGenerators[this.providerType];
        if (!generator) {
            throw new Error(`No response generator for provider: ${this.providerType}`);
        }
        
        return generator(request, options);
    }
    
    /**
     * 生成Anthropic响应
     */
    generateAnthropicResponse(request, options) {
        const patterns = this.characteristics.responsePatterns;
        
        return {
            id: `msg_sim_${this.providerType}_${Date.now()}`,
            type: 'message',
            role: 'assistant',
            content: [
                {
                    type: 'text',
                    text: this.generateResponseText(request, patterns)
                }
            ],
            model: request.model || 'claude-3-sonnet-20240229',
            stop_reason: 'end_turn',
            usage: {
                input_tokens: this.estimateInputTokens(request),
                output_tokens: this.estimateOutputTokens(request, patterns)
            },
            provider_metadata: {
                provider: this.providerType,
                simulatedAt: new Date().toISOString(),
                characteristics: this.characteristics
            }
        };
    }
    
    /**
     * 生成OpenAI响应
     */
    generateOpenAIResponse(request, options) {
        const patterns = this.characteristics.responsePatterns;
        
        return {
            id: `chatcmpl_sim_${this.providerType}_${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: request.model || 'gpt-4',
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: this.generateResponseText(request, patterns)
                    },
                    finish_reason: 'stop'
                }
            ],
            usage: {
                prompt_tokens: this.estimateInputTokens(request),
                completion_tokens: this.estimateOutputTokens(request, patterns),
                total_tokens: this.estimateInputTokens(request) + this.estimateOutputTokens(request, patterns)
            },
            provider_metadata: {
                provider: this.providerType,
                simulatedAt: new Date().toISOString(),
                characteristics: this.characteristics
            }
        };
    }
    
    /**
     * 生成Gemini响应
     */
    generateGeminiResponse(request, options) {
        const patterns = this.characteristics.responsePatterns;
        
        return {
            candidates: [
                {
                    content: {
                        parts: [
                            {
                                text: this.generateResponseText(request, patterns)
                            }
                        ],
                        role: 'model'
                    },
                    finishReason: 'STOP',
                    index: 0
                }
            ],
            usageMetadata: {
                promptTokenCount: this.estimateInputTokens(request),
                candidatesTokenCount: this.estimateOutputTokens(request, patterns),
                totalTokenCount: this.estimateInputTokens(request) + this.estimateOutputTokens(request, patterns)
            },
            provider_metadata: {
                provider: this.providerType,
                simulatedAt: new Date().toISOString(),
                characteristics: this.characteristics
            }
        };
    }
    
    /**
     * 生成CodeWhisperer响应
     */
    generateCodeWhispererResponse(request, options) {
        return {
            recommendations: [
                {
                    content: this.generateCodeContent(request),
                    references: []
                }
            ],
            provider_metadata: {
                provider: this.providerType,
                simulatedAt: new Date().toISOString(),
                characteristics: this.characteristics
            }
        };
    }
    
    /**
     * 生成响应文本
     */
    generateResponseText(request, patterns) {
        const templates = [
            `This is a simulated ${this.providerType} response with ${patterns.structured ? 'structured' : 'unstructured'} formatting.`,
            `Provider simulation active for ${this.providerType}. Response characteristics: verbose=${patterns.verbose}, technical=${patterns.technical}.`,
            `Mock response generated with provider-specific behavior modeling for ${this.providerType}.`
        ];
        
        return templates[Math.floor(Math.random() * templates.length)];
    }
    
    /**
     * 生成代码内容
     */
    generateCodeContent(request) {
        const codeTemplates = [
            `// Simulated ${this.providerType} code generation\\nfunction example() {\\n    return "mock response";\\n}`,
            `# ${this.providerType} simulation\\nprint("This is a mock code response")`,
            `/* Generated by ${this.providerType} simulator */\\nconst result = "simulation";`
        ];
        
        return codeTemplates[Math.floor(Math.random() * codeTemplates.length)];
    }
    
    /**
     * 估算输入token数
     */
    estimateInputTokens(request) {
        const content = JSON.stringify(request);
        return Math.floor(content.length / 4); // 粗略估算
    }
    
    /**
     * 估算输出token数
     */
    estimateOutputTokens(request, patterns) {
        const baseTokens = Math.floor(Math.random() * 200) + 50;
        
        // 基于provider特性调整
        let multiplier = 1.0;
        if (patterns.verbose > 0.7) multiplier *= 1.5;
        if (patterns.technical > 0.8) multiplier *= 1.3;
        
        return Math.floor(baseTokens * multiplier * this.characteristics.tokenEfficiency);
    }
    
    /**
     * 更新统计信息
     */
    updateStats(latency, isError) {
        if (isError) {
            this.stats.totalErrors += 1;
        } else {
            this.stats.totalResponses += 1;
        }
        
        // 更新平均延迟
        const totalProcessed = this.stats.totalResponses + this.stats.totalErrors;
        this.stats.averageLatency = ((this.stats.averageLatency * (totalProcessed - 1)) + latency) / totalProcessed;
    }
    
    /**
     * 更新行为配置
     */
    updateBehavior(behaviorUpdates) {
        Object.assign(this.config, behaviorUpdates);
        console.log(`🔄 Updated ${this.providerType} behavior:`, behaviorUpdates);
    }
    
    /**
     * 获取统计信息
     */
    getStats() {
        return {
            ...this.stats,
            errorRate: this.stats.totalRequests > 0 ? this.stats.totalErrors / this.stats.totalRequests : 0,
            rateLimitState: this.rateLimitState,
            characteristics: this.characteristics
        };
    }
    
    /**
     * 睡眠函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 清理资源
     */
    async cleanup() {
        this.removeAllListeners();
        console.log(`🧹 ${this.providerType} simulator cleaned up`);
    }
}