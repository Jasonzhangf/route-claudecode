#!/usr/bin/env node

/**
 * 直接向Gemini路由器发送API请求测试
 * 绕过健康检查，直接测试API功能
 * @author Jason Zhang
 */

console.log('🔍 直接Gemini路由器API请求测试');
console.log('=' .repeat(50));

/**
 * 发送简单的API请求
 */
async function testDirectApiRequest() {
    console.log('\n📤 发送简单API请求');
    console.log('-'.repeat(30));
    
    const requestPayload = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 50,
        temperature: 0.7,
        messages: [
            {
                role: 'user',
                content: 'Hello! Please respond with just "API test successful".'
            }
        ]
    };
    
    try {
        console.log('📋 请求参数:');
        console.log(`   - 模型: ${requestPayload.model}`);
        console.log(`   - 最大令牌: ${requestPayload.max_tokens}`);
        console.log(`   - 消息: "${requestPayload.messages[0].content}"`);
        
        const response = await fetch('http://localhost:5502/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'test-key',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestPayload)
        });
        
        console.log(`📥 响应状态: ${response.status} ${response.statusText}`);
        console.log(`📝 Content-Type: ${response.headers.get('content-type')}`);
        
        if (response.ok) {
            const responseData = await response.json();
            
            console.log('✅ API请求成功!');
            console.log(`   - 响应ID: ${responseData.id}`);
            console.log(`   - 类型: ${responseData.type}`);
            console.log(`   - 角色: ${responseData.role}`);
            console.log(`   - 停止原因: ${responseData.stop_reason}`);
            
            if (responseData.content && responseData.content.length > 0) {
                const textContent = responseData.content
                    .filter(block => block.type === 'text')
                    .map(block => block.text)
                    .join(' ');
                
                console.log(`   - 响应内容: "${textContent}"`);
            }
            
            if (responseData.usage) {
                console.log(`   - 输入令牌: ${responseData.usage.input_tokens}`);
                console.log(`   - 输出令牌: ${responseData.usage.output_tokens}`);
            }
            
            return { success: true, responseData };
            
        } else {
            const errorText = await response.text();
            console.log(`❌ API请求失败: ${response.status}`);
            console.log(`   错误响应: ${errorText}`);
            
            return { success: false, error: errorText, status: response.status };
        }
        
    } catch (error) {
        console.log(`❌ 请求异常: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * 发送工具调用测试
 */
async function testToolCallRequest() {
    console.log('\n🛠️  发送工具调用测试');
    console.log('-'.repeat(30));
    
    const requestPayload = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        temperature: 0.5,
        messages: [
            {
                role: 'user',
                content: 'What is the weather like in Tokyo? Please use the weather tool.'
            }
        ],
        tools: [
            {
                name: 'get_weather',
                description: 'Get current weather information',
                input_schema: {
                    type: 'object',
                    properties: {
                        location: {
                            type: 'string',
                            description: 'City name'
                        }
                    },
                    required: ['location']
                }
            }
        ]
    };
    
    try {
        console.log('📋 工具调用请求参数:');
        console.log(`   - 模型: ${requestPayload.model}`);
        console.log(`   - 工具数量: ${requestPayload.tools.length}`);
        console.log(`   - 工具名称: ${requestPayload.tools[0].name}`);
        
        const response = await fetch('http://localhost:5502/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'test-key',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestPayload)
        });
        
        console.log(`📥 响应状态: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
            const responseData = await response.json();
            
            console.log('✅ 工具调用请求成功!');
            console.log(`   - 响应ID: ${responseData.id}`);
            console.log(`   - 停止原因: ${responseData.stop_reason}`);
            
            if (responseData.content) {
                const textBlocks = responseData.content.filter(block => block.type === 'text');
                const toolBlocks = responseData.content.filter(block => block.type === 'tool_use');
                
                console.log(`   - 文本块: ${textBlocks.length}`);
                console.log(`   - 工具调用块: ${toolBlocks.length}`);
                
                if (toolBlocks.length > 0) {
                    toolBlocks.forEach((tool, i) => {
                        console.log(`   - 工具 ${i + 1}: ${tool.name}(${JSON.stringify(tool.input)})`);
                    });
                }
            }
            
            return { success: true, responseData };
            
        } else {
            const errorText = await response.text();
            console.log(`❌ 工具调用请求失败: ${response.status}`);
            console.log(`   错误响应: ${errorText}`);
            
            return { success: false, error: errorText, status: response.status };
        }
        
    } catch (error) {
        console.log(`❌ 工具调用异常: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * 主测试函数
 */
async function runDirectRequestTests() {
    console.log('🎯 开始直接API请求测试');
    console.log('💡 即使健康检查失败，API功能可能仍然正常');
    
    const results = {
        simpleRequest: null,
        toolCallRequest: null
    };
    
    // 测试简单请求
    results.simpleRequest = await testDirectApiRequest();
    
    // 等待一秒
    console.log('\n⏳ 等待 1 秒...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试工具调用
    results.toolCallRequest = await testToolCallRequest();
    
    // 总结结果
    console.log('\n📊 测试结果总结');
    console.log('=' .repeat(50));
    
    const simpleSuccess = results.simpleRequest.success;
    const toolSuccess = results.toolCallRequest.success;
    
    console.log(`✅ 简单请求: ${simpleSuccess ? '成功' : '失败'}`);
    console.log(`✅ 工具调用: ${toolSuccess ? '成功' : '失败'}`);
    
    if (simpleSuccess && toolSuccess) {
        console.log('\n🎉 所有API请求成功!');
        console.log('💡 即使健康检查报告不健康，API功能实际上是正常的');
        console.log('💡 这可能是健康检查逻辑的问题，而不是API功能问题');
    } else if (simpleSuccess && !toolSuccess) {
        console.log('\n⚠️  简单请求成功，但工具调用失败');
        console.log('💡 可能是工具调用转换的问题');
    } else if (!simpleSuccess) {
        console.log('\n❌ API请求失败');
        console.log('💡 需要检查API配置和连接');
    }
    
    return results;
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    runDirectRequestTests()
        .then(results => {
            const success = results.simpleRequest.success && results.toolCallRequest.success;
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('\n💥 测试失败:', error.message);
            console.error(error.stack);
            process.exit(1);
        });
}

export { runDirectRequestTests };