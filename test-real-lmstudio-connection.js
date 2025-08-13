/**
 * 真实LMStudio连接测试
 * 测试V3路由系统是否能够成功连接到真实的LMStudio服务器
 */

console.log('🔧 真实LMStudio连接测试开始...\n');

async function testRealLMStudioConnection() {
    try {
        // 1. 直接测试LMStudio
        console.log('📋 测试1: 直接连接LMStudio...');
        const directResponse = await fetch('http://localhost:1234/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'qwen3-30b',
                messages: [{ role: 'user', content: 'Hello LMStudio, please respond briefly.' }],
                max_tokens: 30
            })
        });

        if (directResponse.ok) {
            const directResult = await directResponse.json();
            console.log('✅ 直接LMStudio连接成功');
            console.log(`   模型: ${directResult.model}`);
            console.log(`   响应: ${directResult.choices?.[0]?.message?.content || 'No content'}`);
        } else {
            throw new Error(`Direct LMStudio failed: ${directResponse.status}`);
        }

        // 2. 通过V3路由测试
        console.log('\n📋 测试2: 通过V3路由连接LMStudio...');
        const v3Response = await fetch('http://localhost:5506/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'qwen3-30b',
                max_tokens: 30,
                messages: [{ role: 'user', content: 'Hello through V3 router, please respond briefly.' }]
            })
        });

        if (v3Response.ok) {
            const v3Result = await v3Response.json();
            console.log('✅ V3路由连接成功');
            console.log(`   模型: ${v3Result.model}`);
            console.log(`   响应类型: ${typeof v3Result.content}`);
            
            if (v3Result.content && v3Result.content.length > 0) {
                v3Result.content.forEach((content, index) => {
                    console.log(`   内容${index + 1}: ${content.type} - ${content.text?.substring(0, 100) || 'No text'}`);
                });
            }
            
            // 检查是否是真实响应还是模拟响应
            const responseText = v3Result.content?.[0]?.text || '';
            if (responseText.includes('V3 OpenAI client response from lmstudio')) {
                console.log('⚠️  这是V3系统的模拟响应，不是真实的LMStudio响应');
                console.log('   可能的原因:');
                console.log('   - Provider连接配置错误');
                console.log('   - V3系统回退到模拟模式');
                console.log('   - 请求路由没有到达真实的LMStudio');
            } else {
                console.log('🎉 这是真实的LMStudio响应！');
            }
            
        } else {
            const errorText = await v3Response.text();
            throw new Error(`V3 router failed: ${v3Response.status} - ${errorText}`);
        }

        // 3. 测试工具调用
        console.log('\n📋 测试3: 通过V3路由测试工具调用...');
        const toolCallResponse = await fetch('http://localhost:5506/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'qwen3-30b',
                max_tokens: 100,
                messages: [{ role: 'user', content: 'Please get the weather for Beijing using the get_weather tool.' }],
                tools: [
                    {
                        name: "get_weather",
                        description: "Get weather information",
                        input_schema: {
                            type: "object",
                            properties: {
                                location: {
                                    type: "string",
                                    description: "City name"
                                }
                            },
                            required: ["location"]
                        }
                    }
                ]
            })
        });

        if (toolCallResponse.ok) {
            const toolResult = await toolCallResponse.json();
            console.log('✅ 工具调用响应成功');
            
            let foundToolUse = false;
            if (toolResult.content && toolResult.content.length > 0) {
                toolResult.content.forEach((content, index) => {
                    console.log(`   内容${index + 1}: ${content.type}`);
                    if (content.type === 'tool_use') {
                        foundToolUse = true;
                        console.log(`     工具: ${content.name}`);
                        console.log(`     参数: ${JSON.stringify(content.input)}`);
                    } else if (content.type === 'text') {
                        console.log(`     文本: ${content.text?.substring(0, 50)}...`);
                    }
                });
            }
            
            if (foundToolUse) {
                console.log('🎉 真实的工具调用成功！');
            } else {
                console.log('⚠️  没有发现工具调用，可能是模拟响应');
            }
            
        } else {
            const toolErrorText = await toolCallResponse.text();
            console.log(`❌ 工具调用失败: ${toolCallResponse.status} - ${toolErrorText}`);
        }

        console.log('\n🎉 真实LMStudio连接测试完成！');

    } catch (error) {
        console.error('\n❌ 真实LMStudio连接测试失败:');
        console.error('错误消息:', error.message);
        throw error;
    }
}

// 运行测试
testRealLMStudioConnection();