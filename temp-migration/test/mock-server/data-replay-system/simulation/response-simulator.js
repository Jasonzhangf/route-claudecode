/**
 * Response Simulator
 * 模拟真实AI Provider响应的时序和行为
 * @author Jason Zhang
 * @version v3.0-refactor
 */

import { EventEmitter } from 'events';

export class ResponseSimulator extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // 默认延迟范围 (ms)
            defaultDelay: { min: 100, max: 2000 },
            // 真实时序保持
            preserveTiming: config.preserveTiming !== false,
            // 重放速度倍数
            replaySpeed: config.replaySpeed || 1.0,
            // 响应随机化程度 (0-1)
            randomization: config.randomization || 0.1,
            // 错误注入率 (0-1)
            errorInjectionRate: config.errorInjectionRate || 0.02,
            ...config
        };
        
        // 时序统计
        this.timingStats = {
            totalResponses: 0,
            averageLatency: 0,
            minLatency: Infinity,
            maxLatency: 0
        };
        
        // 当前场景配置
        this.currentScenario = null;
        
        // Advanced timing patterns and realistic behavior simulation
        this.timingPatterns = this.initializeTimingPatterns();
        this.realisticBehaviors = this.initializeRealisticBehaviors();
        
        console.log('🎭 Response Simulator initialized with realistic timing patterns');
    }
    
    /**
     * 为特定场景配置模拟器
     */
    configureForScenario(scenario, options = {}) {
        this.currentScenario = scenario;
        
        // 合并场景特定的配置
        const scenarioConfig = scenario.config?.replayOptions || {};
        this.config = {
            ...this.config,
            ...scenarioConfig,
            ...options
        };
        
        console.log(`🎬 Configured simulator for scenario: ${scenario.name}`);
        
        this.emit('configured', { scenario: scenario.name, config: this.config });
    }
    
    /**
     * 模拟AI Provider响应
     */
    async simulateResponse(request, originalData) {
        const startTime = Date.now();
        
        try {
            // 1. 计算响应延迟
            const delay = this.calculateResponseDelay(request, originalData);
            
            // 2. 应用延迟
            if (delay > 0) {
                await this.sleep(delay);
            }
            
            // 3. 生成模拟响应
            const response = this.generateSimulatedResponse(request, originalData);
            
            // 4. 应用随机化
            const finalResponse = this.applyResponseRandomization(response);
            
            // 5. 错误注入
            const responseWithErrors = this.injectRandomErrors(finalResponse);
            
            // 6. 更新统计
            const actualLatency = Date.now() - startTime;
            this.updateTimingStats(actualLatency);
            
            this.emit('responseSimulated', {
                request,
                response: responseWithErrors,
                latency: actualLatency,
                plannedDelay: delay
            });
            
            return responseWithErrors;
            
        } catch (error) {
            const errorLatency = Date.now() - startTime;
            this.updateTimingStats(errorLatency);
            
            this.emit('simulationError', {
                request,
                error: error.message,
                latency: errorLatency
            });
            
            throw error;
        }
    }
    
    /**
     * Initialize realistic timing patterns
     */
    initializeTimingPatterns() {
        return {
            patterns: {
                'morning': { multiplier: 0.8, description: 'Faster response during morning hours' },
                'afternoon': { multiplier: 1.0, description: 'Standard response timing' },
                'evening': { multiplier: 1.2, description: 'Slightly slower evening responses' },
                'night': { multiplier: 1.5, description: 'Slower night responses' }
            },
            current: 'afternoon'
        };
    }
    
    /**
     * Initialize realistic behavior patterns
     */
    initializeRealisticBehaviors() {
        return {
            realistic: true,
            patterns: {
                'burst_traffic': { active: false, multiplier: 2.0 },
                'maintenance_mode': { active: false, multiplier: 3.0 },
                'peak_hours': { active: false, multiplier: 1.3 },
                'low_traffic': { active: false, multiplier: 0.7 }
            }
        };
    }
    
    /**
     * Apply realistic timing patterns to response delay calculation
     */
    applyRealisticTimingPatterns(baseDelay) {
        // Apply time-of-day pattern
        const currentHour = new Date().getHours();
        let pattern = 'afternoon'; // default
        
        if (currentHour >= 6 && currentHour < 12) pattern = 'morning';
        else if (currentHour >= 12 && currentHour < 18) pattern = 'afternoon';
        else if (currentHour >= 18 && currentHour < 22) pattern = 'evening';
        else pattern = 'night';
        
        let adjustedDelay = baseDelay * this.timingPatterns.patterns[pattern].multiplier;
        
        // Apply realistic behavior patterns
        for (const [patternName, patternConfig] of Object.entries(this.realisticBehaviors.patterns)) {
            if (patternConfig.active) {
                adjustedDelay *= patternConfig.multiplier;
            }
        }
        
        return adjustedDelay;
    }
    
    /**
     * 计算响应延迟 - Enhanced with realistic timing patterns
     */
    calculateResponseDelay(request, originalData) {
        // 如果保持原始时序
        if (this.config.preserveTiming && originalData?.metadata?.processingTime) {
            const originalDelay = originalData.metadata.processingTime;
            return Math.max(0, originalDelay / this.config.replaySpeed);
        }
        
        // 使用配置的延迟范围
        const delayRange = this.config.responseDelay || this.config.defaultDelay;
        const baseDelay = Math.random() * (delayRange.max - delayRange.min) + delayRange.min;
        
        // 应用重放速度
        const adjustedDelay = baseDelay / this.config.replaySpeed;
        
        // 基于请求类型调整延迟
        const typeMultiplier = this.getDelayMultiplierByType(request);
        const baseCalculatedDelay = adjustedDelay * typeMultiplier;
        
        // Apply realistic timing patterns
        const finalDelay = this.applyRealisticTimingPatterns(baseCalculatedDelay);
        
        return Math.max(0, finalDelay);
    }
    
    /**
     * 根据请求类型获取延迟倍数
     */
    getDelayMultiplierByType(request) {
        const delayMultipliers = {
            'tool_calls': 1.5,     // 工具调用稍慢
            'code_generation': 2.0, // 代码生成更慢
            'long_context': 1.8,    // 长上下文处理慢
            'streaming': 0.3,       // 流式响应开始快
            'simple_chat': 0.8      // 简单对话快
        };
        
        // 根据请求内容判断类型
        const requestType = this.detectRequestType(request);
        return delayMultipliers[requestType] || 1.0;
    }
    
    /**
     * 检测请求类型
     */
    detectRequestType(request) {
        const content = JSON.stringify(request).toLowerCase();
        
        if (content.includes('tool') || content.includes('function')) {
            return 'tool_calls';
        }
        if (content.includes('code') || content.includes('program')) {
            return 'code_generation';
        }
        if (content.length > 10000) {
            return 'long_context';
        }
        if (request.stream) {
            return 'streaming';
        }
        
        return 'simple_chat';
    }
    
    /**
     * Enable realistic patterns for enhanced simulation
     */
    enableRealisticPattern(patternName, enabled = true) {
        if (this.realisticBehaviors.patterns[patternName]) {
            this.realisticBehaviors.patterns[patternName].active = enabled;
            console.log(`🎯 Realistic pattern '${patternName}' ${enabled ? 'enabled' : 'disabled'}`);
        }
    }
    
    /**
     * Get current timing pattern information
     */
    getTimingInfo() {
        return {
            currentPattern: this.timingPatterns.current,
            realisticBehaviors: this.realisticBehaviors,
            patterns: this.timingPatterns.patterns
        };
    }
    
    /**
     * 生成模拟响应 - Enhanced with realistic patterns
     */
    generateSimulatedResponse(request, originalData) {
        if (originalData && originalData.data) {
            // 基于原始数据生成响应
            return this.adaptOriginalResponse(originalData.data, request);
        }
        
        // 生成默认模拟响应
        return this.generateDefaultResponse(request);
    }
    
    /**
     * 适配原始响应数据
     */
    adaptOriginalResponse(originalData, currentRequest) {
        const adaptedResponse = JSON.parse(JSON.stringify(originalData));
        
        // 更新时间戳
        adaptedResponse.timestamp = new Date().toISOString();
        
        // 添加模拟元数据
        adaptedResponse.mockMetadata = {
            simulatedAt: new Date().toISOString(),
            originalTimestamp: originalData.timestamp,
            simulator: 'response-simulator',
            scenario: this.currentScenario?.name || 'unknown',
            replaySpeed: this.config.replaySpeed,
            preserveTiming: this.config.preserveTiming
        };
        
        // 移除敏感数据
        this.sanitizeResponse(adaptedResponse);
        
        return adaptedResponse;
    }
    
    /**
     * 生成默认响应
     */
    generateDefaultResponse(request) {
        const responseTemplates = {
            'anthropic': this.generateAnthropicResponse(request),
            'openai': this.generateOpenAIResponse(request),
            'gemini': this.generateGeminiResponse(request),
            'codewhisperer': this.generateCodeWhispererResponse(request)
        };
        
        const provider = this.detectProvider(request);
        return responseTemplates[provider] || responseTemplates['openai'];
    }
    
    /**
     * 生成Anthropic风格响应
     */
    generateAnthropicResponse(request) {
        return {
            id: `msg_sim_${Date.now()}`,
            type: 'message',
            role: 'assistant',
            content: [
                {
                    type: 'text',
                    text: `This is a simulated response from ${this.currentScenario?.name || 'mock'} scenario.`
                }
            ],
            model: request.model || 'claude-3-sonnet-20240229',
            stop_reason: 'end_turn',
            usage: {
                input_tokens: Math.floor(Math.random() * 100) + 50,
                output_tokens: Math.floor(Math.random() * 200) + 25
            },
            mockMetadata: {
                simulatedAt: new Date().toISOString(),
                simulator: 'response-simulator',
                scenario: this.currentScenario?.name || 'unknown',
                provider: 'anthropic'
            }
        };
    }
    
    /**
     * 生成OpenAI风格响应
     */
    generateOpenAIResponse(request) {
        return {
            id: `chatcmpl-sim-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: request.model || 'gpt-4',
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: `This is a simulated response from ${this.currentScenario?.name || 'mock'} scenario.`
                    },
                    finish_reason: 'stop'
                }
            ],
            usage: {
                prompt_tokens: Math.floor(Math.random() * 100) + 50,
                completion_tokens: Math.floor(Math.random() * 200) + 25,
                total_tokens: Math.floor(Math.random() * 300) + 75
            },
            mockMetadata: {
                simulatedAt: new Date().toISOString(),
                simulator: 'response-simulator',
                scenario: this.currentScenario?.name || 'unknown',
                provider: 'openai'
            }
        };
    }
    
    /**
     * 生成Gemini风格响应
     */
    generateGeminiResponse(request) {
        return {
            candidates: [
                {
                    content: {
                        parts: [
                            {
                                text: `This is a simulated response from ${this.currentScenario?.name || 'mock'} scenario.`
                            }
                        ],
                        role: 'model'
                    },
                    finishReason: 'STOP',
                    index: 0
                }
            ],
            usageMetadata: {
                promptTokenCount: Math.floor(Math.random() * 100) + 50,
                candidatesTokenCount: Math.floor(Math.random() * 200) + 25,
                totalTokenCount: Math.floor(Math.random() * 300) + 75
            },
            mockMetadata: {
                simulatedAt: new Date().toISOString(),
                simulator: 'response-simulator',
                scenario: this.currentScenario?.name || 'unknown',
                provider: 'gemini'
            }
        };
    }
    
    /**
     * 生成CodeWhisperer风格响应
     */
    generateCodeWhispererResponse(request) {
        return {
            recommendations: [
                {
                    content: `// This is a simulated code response from ${this.currentScenario?.name || 'mock'} scenario\\nconsole.log('Mock response');`,
                    references: []
                }
            ],
            mockMetadata: {
                simulatedAt: new Date().toISOString(),
                simulator: 'response-simulator',
                scenario: this.currentScenario?.name || 'unknown',
                provider: 'codewhisperer'
            }
        };
    }
    
    /**
     * 检测Provider类型
     */
    detectProvider(request) {
        const requestStr = JSON.stringify(request).toLowerCase();
        
        if (requestStr.includes('anthropic') || requestStr.includes('claude')) {
            return 'anthropic';
        }
        if (requestStr.includes('gemini') || requestStr.includes('google')) {
            return 'gemini';
        }
        if (requestStr.includes('codewhisperer') || requestStr.includes('aws')) {
            return 'codewhisperer';
        }
        
        return 'openai'; // 默认
    }
    
    /**
     * 应用响应随机化
     */
    applyResponseRandomization(response) {
        if (this.config.randomization === 0) {
            return response;
        }
        
        const randomizedResponse = JSON.parse(JSON.stringify(response));
        
        // 随机化token数量
        if (randomizedResponse.usage) {
            const variation = this.config.randomization;
            Object.keys(randomizedResponse.usage).forEach(key => {
                if (typeof randomizedResponse.usage[key] === 'number') {
                    const original = randomizedResponse.usage[key];
                    const change = original * variation * (Math.random() - 0.5);
                    randomizedResponse.usage[key] = Math.max(1, Math.floor(original + change));
                }
            });
        }
        
        return randomizedResponse;
    }
    
    /**
     * 注入随机错误
     */
    injectRandomErrors(response) {
        if (Math.random() > this.config.errorInjectionRate) {
            return response; // 不注入错误
        }
        
        const errorTypes = [
            'rate_limit_exceeded',
            'internal_server_error',
            'timeout_error',
            'invalid_request'
        ];
        
        const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
        
        // 生成错误响应
        const errorResponse = {
            error: {
                type: errorType,
                message: `Simulated ${errorType.replace(/_/g, ' ')} error`,
                injectedBy: 'response-simulator',
                originalResponse: response,
                timestamp: new Date().toISOString()
            }
        };
        
        console.log(`🎯 Injected error: ${errorType}`);
        this.emit('errorInjected', { type: errorType, response: errorResponse });
        
        return errorResponse;
    }
    
    /**
     * 清理响应中的敏感数据
     */
    sanitizeResponse(response) {
        const sensitiveFields = ['apiKey', 'token', 'secret', 'credential'];
        
        function recursiveSanitize(obj) {
            if (typeof obj === 'object' && obj !== null) {
                for (const key in obj) {
                    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                        obj[key] = '[SANITIZED]';
                    } else if (typeof obj[key] === 'object') {
                        recursiveSanitize(obj[key]);
                    }
                }
            }
        }
        
        recursiveSanitize(response);
    }
    
    /**
     * 更新时序统计
     */
    updateTimingStats(latency) {
        this.timingStats.totalResponses += 1;
        this.timingStats.minLatency = Math.min(this.timingStats.minLatency, latency);
        this.timingStats.maxLatency = Math.max(this.timingStats.maxLatency, latency);
        
        // 计算平均延迟
        const total = this.timingStats.averageLatency * (this.timingStats.totalResponses - 1) + latency;
        this.timingStats.averageLatency = total / this.timingStats.totalResponses;
    }
    
    /**
     * 睡眠函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 获取统计信息 - Enhanced with realistic timing patterns
     */
    getStats() {
        return {
            ...this.timingStats,
            config: this.config,
            currentScenario: this.currentScenario?.name || null,
            timing: this.getTimingInfo(),
            realistic: this.realisticBehaviors.realistic,
            patterns: this.timingPatterns.patterns
        };
    }
    
    /**
     * Set realistic delay patterns for enhanced simulation
     */
    setRealisticDelayPatterns(patterns = {}) {
        this.timingPatterns = {
            ...this.timingPatterns,
            ...patterns
        };
        console.log('🕐 Realistic delay patterns updated');
    }
    
    /**
     * 重置统计 - Enhanced with patterns reset
     */
    resetStats() {
        this.timingStats = {
            totalResponses: 0,
            averageLatency: 0,
            minLatency: Infinity,
            maxLatency: 0
        };
        
        // Reset realistic patterns to defaults
        this.realisticBehaviors = this.initializeRealisticBehaviors();
        this.timingPatterns = this.initializeTimingPatterns();
        
        console.log('📊 Response simulator stats and realistic patterns reset');
    }
    
    /**
     * 清理资源
     */
    async cleanup() {
        this.currentScenario = null;
        this.removeAllListeners();
        
        console.log('🧹 Response Simulator cleaned up');
    }
}