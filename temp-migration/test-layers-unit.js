/**
 * V3.0 六层架构单元测试
 * 测试每一层的独立功能
 */
import { transformationManager } from './src/v3/transformer/manager.js';
import { OpenAICompatiblePreprocessor } from './src/v3/preprocessor/index.js';
import { OpenAICompatibleProvider } from './src/v3/provider-protocol/base-provider.js';

console.log('🧪 V3.0 六层架构单元测试开始...\n');

// 测试1: Transformer层测试
console.log('📊 测试 Transformer 层...');
async function testTransformerLayer() {
    const anthropicRequest = {
        model: 'claude-3-sonnet',
        messages: [
            { role: 'user', content: '你好' }
        ],
        max_tokens: 100
    };
    
    // 测试 Anthropic → OpenAI 转换
    const openaiRequest = transformationManager.transform(anthropicRequest, {
        sourceFormat: 'anthropic',
        targetFormat: 'openai',
        direction: 'request'
    });
    
    console.log('✅ Anthropic → OpenAI 转换:', {
        原始消息数: anthropicRequest.messages.length,
        转换后消息数: openaiRequest.messages.length,
        模型: openaiRequest.model,
        最大令牌: openaiRequest.max_tokens
    });
    
    // 测试 OpenAI → Anthropic 响应转换
    const mockOpenAIResponse = {
        id: 'test-123',
        model: 'gpt-4',
        choices: [{
            message: { content: '你好！我是AI助手。' },
            finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 15 }
    };
    
    const anthropicResponse = transformationManager.transform(mockOpenAIResponse, {
        sourceFormat: 'openai',
        targetFormat: 'anthropic',
        direction: 'response'
    });
    
    console.log('✅ OpenAI → Anthropic 响应转换:', {
        ID: anthropicResponse.id,
        内容类型: anthropicResponse.content[0]?.type,
        停止原因: anthropicResponse.stop_reason,
        使用情况: anthropicResponse.usage
    });
}

// 测试2: Preprocessor层测试
console.log('\n🔧 测试 Preprocessor 层...');
async function testPreprocessorLayer() {
    const preprocessor = new OpenAICompatiblePreprocessor({
        authentication: { type: 'bearer' },
        modelSpecific: {
            'GLM-4.5': { toolCallFormat: 'text-based' }
        }
    });
    
    const request = {
        model: 'gpt-4',
        messages: [
            { role: 'user', content: '测试预处理' }
        ],
        tools: [
            {
                name: 'get_weather',
                description: '获取天气信息',
                input_schema: { type: 'object', properties: { city: { type: 'string' } } }
            }
        ]
    };
    
    const context = { 
        providerId: 'test-provider',
        config: { authentication: { type: 'bearer' } }
    };
    
    const processedRequest = await preprocessor.processRequest(request, context);
    
    console.log('✅ 预处理完成:', {
        工具数量: processedRequest.tools?.length || 0,
        工具选择: processedRequest.tool_choice,
        消息数: processedRequest.messages?.length || 0
    });
}

// 测试3: Provider Protocol层测试  
console.log('\n🌐 测试 Provider Protocol 层...');
async function testProviderProtocolLayer() {
    const config = {
        type: 'openai',
        name: 'Test Provider',
        endpoint: 'https://ai.shuaihong.fun/v1/chat/completions',
        authentication: {
            credentials: {
                apiKeys: ['sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl']
            }
        },
        timeout: 30000
    };
    
    const provider = new OpenAICompatibleProvider('test-provider', config);
    
    // 健康检查
    const healthy = await provider.isHealthy();
    console.log('✅ Provider健康检查:', healthy);
    
    if (healthy) {
        try {
            // 简单请求测试
            const request = {
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: '简单回复：OK' }],
                max_tokens: 10
            };
            
            const response = await provider.sendRequest(request);
            console.log('✅ Provider API调用:', {
                响应ID: response.id,
                模型: response.model,
                内容长度: response.choices?.[0]?.message?.content?.length || 0
            });
        } catch (error) {
            console.log('❌ Provider API调用失败:', error.message);
        }
    }
}

// 运行所有测试
async function runAllTests() {
    try {
        await testTransformerLayer();
        await testPreprocessorLayer(); 
        await testProviderProtocolLayer();
        
        console.log('\n🎉 所有单元测试完成！');
    } catch (error) {
        console.error('❌ 测试失败:', error);
    }
}

runAllTests();