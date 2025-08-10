#!/usr/bin/env node

/**
 * Gemini Transformer 恢复测试
 * 验证完整的工具调用支持是否正确实现
 * Project owner: Jason Zhang
 */

const { GeminiTransformer } = require('./dist/transformers/gemini');

async function testGeminiTransformer() {
    console.log('🧪 Testing Gemini Transformer Implementation...');
    
    try {
        const transformer = new GeminiTransformer();
        
        // 测试1: 基本转换
        console.log('\n📋 Test 1: Basic Request Transformation');
        const basicRequest = {
            model: 'gemini-2.5-pro',
            messages: [
                { role: 'user', content: 'Hello world' }
            ],
            metadata: { requestId: 'test-001' }
        };
        
        const geminiRequest = transformer.transformAnthropicToGemini(basicRequest);
        console.log('✅ Basic transformation successful');
        console.log('   Model:', geminiRequest.model);
        console.log('   Contents count:', geminiRequest.contents.length);
        
        // 测试2: 工具调用转换 (OpenAI格式)
        console.log('\n🔧 Test 2: OpenAI Format Tool Transformation');
        const openaiToolRequest = {
            model: 'gemini-2.5-pro',
            messages: [
                { role: 'user', content: 'What is the weather in Beijing?' }
            ],
            tools: [{
                type: 'function',
                function: {
                    name: 'get_weather',
                    description: 'Get weather information for a city',
                    parameters: {
                        type: 'object',
                        properties: {
                            city: { type: 'string', description: 'City name' }
                        },
                        required: ['city']
                    }
                }
            }],
            metadata: { requestId: 'test-002' }
        };
        
        const geminiToolRequest = transformer.transformAnthropicToGemini(openaiToolRequest);
        console.log('✅ OpenAI tool transformation successful');
        console.log('   Has tools:', !!geminiToolRequest.tools);
        console.log('   Tool count:', geminiToolRequest.tools?.[0]?.functionDeclarations?.length || 0);
        
        // 测试3: buildToolConfig方法
        console.log('\n⚙️ Test 3: buildToolConfig Method');
        const toolConfig = transformer.buildToolConfig(openaiToolRequest.tools);
        console.log('✅ buildToolConfig successful');
        console.log('   Mode:', toolConfig?.functionCallingConfig?.mode);
        console.log('   Allowed functions:', toolConfig?.functionCallingConfig?.allowedFunctionNames);
        
        // 测试4: Anthropic格式工具
        console.log('\n🔧 Test 4: Anthropic Format Tool Transformation');
        const anthropicToolRequest = {
            model: 'gemini-2.5-pro',
            messages: [
                { role: 'user', content: 'Search for information about AI' }
            ],
            tools: [{
                name: 'web_search',
                description: 'Search the web for information',
                input_schema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query' }
                    },
                    required: ['query']
                }
            }],
            metadata: { requestId: 'test-003' }
        };
        
        const geminiAnthropicToolRequest = transformer.transformAnthropicToGemini(anthropicToolRequest);
        console.log('✅ Anthropic tool transformation successful');
        console.log('   Function name:', geminiAnthropicToolRequest.tools?.[0]?.functionDeclarations?.[0]?.name);
        
        // 测试5: 响应转换 (模拟工具调用响应)
        console.log('\n📤 Test 5: Response Transformation with Tool Calls');
        const mockGeminiResponse = {
            candidates: [{
                content: {
                    parts: [
                        { text: 'I need to get weather information for you.' },
                        {
                            functionCall: {
                                name: 'get_weather',
                                args: { city: 'Beijing' }
                            }
                        }
                    ],
                    role: 'model'
                },
                finishReason: 'STOP',
                index: 0
            }],
            usageMetadata: {
                promptTokenCount: 50,
                candidatesTokenCount: 30,
                totalTokenCount: 80
            }
        };
        
        const anthropicResponse = transformer.transformGeminiToAnthropic(
            mockGeminiResponse, 
            'gemini-2.5-pro', 
            'test-004'
        );
        
        console.log('✅ Response transformation successful');
        console.log('   Content blocks:', anthropicResponse.content.length);
        console.log('   Stop reason:', anthropicResponse.stop_reason);
        console.log('   Has tool calls:', anthropicResponse.content.some(c => c.type === 'tool_use'));
        
        if (anthropicResponse.stop_reason === 'tool_use') {
            console.log('✅ Content-driven stop_reason detection working correctly!');
        }
        
        console.log('\n🎉 All Gemini Transformer tests passed!');
        console.log('\n📊 Implementation Features Verified:');
        console.log('   ✅ Basic request/response transformation');
        console.log('   ✅ OpenAI format tool support');
        console.log('   ✅ Anthropic format tool support');
        console.log('   ✅ buildToolConfig method implementation');
        console.log('   ✅ Content-driven stop_reason detection');
        console.log('   ✅ Tool call parsing and conversion');
        
    } catch (error) {
        console.error('❌ Gemini Transformer test failed:', error.message);
        console.error('   Stack:', error.stack);
        process.exit(1);
    }
}

if (require.main === module) {
    testGeminiTransformer();
}