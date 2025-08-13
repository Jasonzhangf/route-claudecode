/**
 * OpenAI Provider Unit Test
 * 验证OpenAI Provider真实API调用
 */
import { OpenAICompatibleProvider } from './src/v3/provider-protocol/base-provider.js';

async function testOpenAIProvider() {
    console.log('🧪 Testing OpenAI Provider Unit...');
    
    const config = {
        type: 'openai',
        name: 'Test ShuaiHong Provider',
        endpoint: 'https://ai.shuaihong.fun/v1/chat/completions',
        authentication: {
            credentials: {
                apiKeys: ['sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl']
            }
        },
        timeout: 30000
    };
    
    const provider = new OpenAICompatibleProvider('test-shuaihong', config);
    
    // 测试1: 健康检查
    console.log('📊 Testing health check...');
    try {
        const healthy = await provider.isHealthy();
        console.log(`✅ Health check: ${healthy}`);
    } catch (error) {
        console.log(`❌ Health check failed: ${error.message}`);
    }
    
    // 测试2: 简单请求
    console.log('📨 Testing simple request...');
    try {
        const request = {
            model: 'gpt-4o-mini',
            messages: [
                { role: 'user', content: '你好，请说"测试成功"' }
            ],
            max_tokens: 50
        };
        
        const response = await provider.sendRequest(request);
        console.log('✅ Simple request response:', {
            id: response.id,
            model: response.model,
            contentLength: response.choices?.[0]?.message?.content?.length || 'no content'
        });
        
        // 验证这不是mock响应
        if (response.choices?.[0]?.message?.content?.includes('V3 openai provider response')) {
            console.log('❌ Still returning mock response!');
        } else {
            console.log('✅ Real API response received!');
        }
    } catch (error) {
        console.log(`❌ Simple request failed: ${error.message}`);
    }
    
    console.log('🏁 OpenAI Provider unit test completed');
}

// 运行测试
testOpenAIProvider().catch(console.error);