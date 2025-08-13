/**
 * V3.0 Unified Input Processor
 * Handles multiple input formats (Anthropic, OpenAI, Gemini)
 *
 * Project owner: Jason Zhang
 */
export class UnifiedInputProcessor {
    constructor() {
        console.log('🔧 V3 UnifiedInputProcessor initialized');
    }
    canProcess(rawRequest) {
        return !!(rawRequest && (rawRequest.messages || rawRequest.prompt));
    }
    async process(rawRequest) {
        return this.processRequest(rawRequest);
    }
    async processRequest(rawRequest) {
        // Basic request processing - normalize to standard format
        const request = {
            model: rawRequest.model || 'default',
            max_tokens: rawRequest.max_tokens || 1000,
            messages: rawRequest.messages || [],
            tools: rawRequest.tools || [],
            stream: rawRequest.stream || false
        };
        console.log('📥 V3 Input processed:', {
            model: request.model,
            messageCount: request.messages.length,
            hasTools: (request.tools?.length || 0) > 0,
            stream: request.stream
        });
        return request;
    }
    validateRequest(request) {
        if (!request.model)
            return false;
        if (!Array.isArray(request.messages))
            return false;
        if (request.messages.length === 0)
            return false;
        return true;
    }
}
