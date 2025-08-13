/**
 * V3.0 Response Pipeline - Transformer Layer
 * 负责OpenAI格式 → Anthropic格式的转换
 */
export class ResponsePipeline {
    constructor() {
        console.log('🔧 V3 ResponsePipeline initialized');
    }
    
    async process(response, context) {
        console.log(`🔄 Processing response for ${context?.provider} [${context?.requestId}]`);
        
        // 根据provider类型进行格式转换
        const providerType = this.getProviderType(context);
        
        if (providerType === 'openai' || providerType === 'lmstudio') {
            return this.transformOpenAIToAnthropic(response, context);
        }
        
        // 其他provider类型的转换
        return response;
    }
    
    /**
     * OpenAI格式 → Anthropic格式转换 (真正的Transformer)
     */
    transformOpenAIToAnthropic(response, context) {
        if (!response || !response.choices || !Array.isArray(response.choices)) {
            return response;
        }
        
        const choice = response.choices[0];
        if (!choice || !choice.message) {
            return response;
        }
        
        const message = choice.message;
        const anthropicResponse = {
            id: response.id || `msg-${Date.now()}`,
            type: 'message',
            role: 'assistant',
            content: this.convertContent(message),
            model: response.model,
            stop_reason: this.mapStopReason(choice.finish_reason, message),
            usage: {
                input_tokens: response.usage?.prompt_tokens || 0,
                output_tokens: response.usage?.completion_tokens || 0,
                total_tokens: response.usage?.total_tokens || 0
            }
        };
        
        return anthropicResponse;
    }
    
    /**
     * 转换消息内容：OpenAI tool_calls → Anthropic tool_use
     */
    convertContent(message) {
        const content = [];
        
        // 添加文本内容
        if (message.content) {
            content.push({
                type: 'text',
                text: message.content
            });
        }
        
        // 转换工具调用：OpenAI tool_calls → Anthropic tool_use
        if (message.tool_calls && Array.isArray(message.tool_calls)) {
            message.tool_calls.forEach(toolCall => {
                content.push({
                    type: 'tool_use',
                    id: toolCall.id,
                    name: toolCall.function.name,
                    input: JSON.parse(toolCall.function.arguments || '{}')
                });
            });
        }
        
        return content.length > 0 ? content : [{
            type: 'text', 
            text: ''
        }];
    }
    
    /**
     * 映射停止原因：OpenAI finish_reason → Anthropic stop_reason
     */
    mapStopReason(finishReason, message) {
        // 首先检查是否有工具调用
        if (message.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
            return 'tool_use';
        }
        
        // 根据finish_reason映射
        switch (finishReason) {
            case 'tool_calls':
                return 'tool_use';
            case 'stop':
                return 'end_turn';
            case 'length':
                return 'max_tokens';
            default:
                return 'end_turn';
        }
    }
    
    /**
     * 获取provider类型
     */
    getProviderType(context) {
        // 根据context判断provider类型
        if (context?.provider === 'lmstudio') {
            return 'openai'; // LM Studio使用OpenAI协议
        }
        
        return context?.providerType || 'unknown';
    }
}
