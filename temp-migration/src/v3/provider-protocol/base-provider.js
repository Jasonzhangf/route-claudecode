/**
 * V3.0 Base Provider Implementation
 * Common provider functionality
 *
 * Project owner: Jason Zhang
 */
export class BaseProvider {
    constructor(id, config) {
        this.id = id;
        this.type = config.type;
        this.name = config.name;
        this.config = config;
        console.log(`🔧 V3 ${this.type} provider initialized: ${this.id}`);
    }
    // Legacy method for backward compatibility
    async processRequest(request, requestId) {
        return this.sendRequest(request);
    }
    // Mock方法已移除 - 所有providers必须实现真实API调用
}
// Real provider implementations for V3 - delegating to specific client factories
import { createOpenAIClient } from './openai/client-factory.js';
import { createGeminiClient } from './gemini/client-factory.js';

export class OpenAICompatibleProvider extends BaseProvider {
    constructor(id, config) {
        super(id, config);
        // 使用真实的OpenAI客户端
        this.client = createOpenAIClient(config, id);
    }
    
    async isHealthy() {
        return this.client.isHealthy();
    }
    
    async sendRequest(request) {
        return this.client.sendRequest(request);
    }
    
    async sendStreamRequest(request) {
        return this.client.sendStreamRequest(request);
    }
}

// Alias for backward compatibility
export class LMStudioClient extends OpenAICompatibleProvider {
    constructor(config, id) {
        super(id, config);
    }
}

// TODO: Implement real CodeWhisperer provider
export class CodeWhispererProvider extends BaseProvider {
    constructor(id, config) {
        super(id, config || {
            type: 'codewhisperer',
            name: 'CodeWhisperer Provider',
            endpoint: 'https://codewhisperer.us-east-1.amazonaws.com',
            defaultModel: 'CLAUDE_SONNET_4',
            authentication: { type: 'bearer', credentials: {} },
            models: ['CLAUDE_SONNET_4']
        });
    }
    async isHealthy() { 
        return false; // 标记为未实现
    }
    async sendRequest(request) {
        throw new Error('CodeWhisperer provider not implemented yet');
    }
    async sendStreamRequest(request) {
        throw new Error('CodeWhisperer stream provider not implemented yet');
    }
}

export class GeminiProvider extends BaseProvider {
    constructor(config, id) {
        super(id, config);
        // 使用真实的Gemini客户端
        this.client = createGeminiClient(config, id);
    }
    
    async isHealthy() {
        return this.client.isHealthy();
    }
    
    async sendRequest(request) {
        return this.client.sendRequest(request);
    }
    
    async sendStreamRequest(request) {
        return this.client.sendStreamRequest(request);
    }
}

// TODO: Implement real Anthropic provider
export class AnthropicProvider extends BaseProvider {
    constructor(config) {
        super('anthropic', config);
    }
    async isHealthy() { 
        return false; // 标记为未实现
    }
    async sendRequest(request) {
        throw new Error('Anthropic provider not implemented yet');
    }
    async sendStreamRequest(request) {
        throw new Error('Anthropic stream provider not implemented yet');
    }
}
