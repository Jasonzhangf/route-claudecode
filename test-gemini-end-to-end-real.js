#!/usr/bin/env node

/**
 * Gemini端到端实际通信测试
 * 通过实际的Gemini配置检测端到端通信
 * @author Jason Zhang
 */

console.log('🔍 Gemini端到端实际通信测试');
console.log('=' .repeat(60));

/**
 * 测试配置
 */
const TEST_CONFIG = {
    geminiServerUrl: 'http://localhost:5502',
    testTimeout: 30000,
    apiKey: 'test-key-via-router'
};

/**
 * 测试用例数据
 */
const testCases = [
    {
        name: '简单文本对话测试',
        request: {
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 100,
            temperature: 0.7,
            messages: [
                {
                    role: 'user',
                    content: 'Hello! Please respond with a simple greeting.'
                }
            ]
        },
        expectedContent: true,
        expectedToolUse: false
    },
    {
        name: '工具调用测试',
        request: {
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 200,
            temperature: 0.5,
            messages: [
                {
                    role: 'user',
                    content: 'What is the weather like in San Francisco? Use the weather tool to check.'
                }
            ],
            tools: [
                {
                    name: 'get_weather',
                    description: 'Get current weather information for a location',
                    input_schema: {
                        type: 'object',
                        properties: {
                            location: {
                                type: 'string',
                                description: 'City name or location'
                            },
                            units: {
                                type: 'string',
                                description: 'Temperature units',
                                enum: ['celsius', 'fahrenheit']
                            }
                        },
                        required: ['location']
                    }
                }
            ]
        },
        expectedContent: true,
        expectedToolUse: true
    },
    {
        name: '流式响应测试',
        request: {
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 150,
            temperature: 0.3,
            stream: true,
            messages: [
                {
                    role: 'user',
                    content: 'Tell me a short story about a robot. Keep it brief.'
                }
            ]
        },
        expectedContent: true,
        expectedToolUse: false,
        streaming: true
    }
];

/**
 * 执行HTTP请求
 */
async function makeRequest(url, options) {
    const response = await fetch(url, options);
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    return response;
}

/**
 * 测试单个请求
 */
async function testSingleRequest(testCase, index) {
    console.log(`\\n🧪 测试 ${index + 1}: ${testCase.name}`);
    console.log('-'.repeat(50));
    
    const startTime = Date.now();
    
    try {
        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': TEST_CONFIG.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(testCase.request)
        };
        
        console.log(`📤 发送请求到: ${TEST_CONFIG.geminiServerUrl}/v1/messages`);
        console.log(`   - 模型: ${testCase.request.model}`);
        console.log(`   - 最大令牌: ${testCase.request.max_tokens}`);
        console.log(`   - 温度: ${testCase.request.temperature}`);
        console.log(`   - 消息数: ${testCase.request.messages.length}`);
        console.log(`   - 工具数: ${testCase.request.tools?.length || 0}`);
        console.log(`   - 流式: ${testCase.request.stream ? '是' : '否'}`);
        
        if (testCase.streaming) {
            // 处理流式响应
            const response = await makeRequest(`${TEST_CONFIG.geminiServerUrl}/v1/messages`, requestOptions);
            
            console.log(`📥 收到流式响应: ${response.status} ${response.statusText}`);
            console.log(`   - Content-Type: ${response.headers.get('content-type')}`);
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let chunks = [];
            let totalLength = 0;
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                chunks.push(chunk);
                totalLength += chunk.length;
                
                // 解析SSE事件
                const lines = chunk.split('\\n');
                for (const line of lines) {
                    if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data.type === 'content_block_delta' && data.delta?.text) {
                                process.stdout.write(data.delta.text);
                            }
                        } catch (e) {
                            // 忽略JSON解析错误
                        }
                    }
                }
            }
            
            console.log(`\\n✅ 流式响应完成`);
            console.log(`   - 接收块数: ${chunks.length}`);
            console.log(`   - 总数据大小: ${totalLength} 字节`);
            
        } else {
            // 处理普通响应
            const response = await makeRequest(`${TEST_CONFIG.geminiServerUrl}/v1/messages`, requestOptions);
            const responseData = await response.json();
            
            console.log(`📥 收到响应: ${response.status} ${response.statusText}`);
            console.log(`   - Content-Type: ${response.headers.get('content-type')}`);
            
            // 验证响应结构
            console.log(`✅ 响应结构验证:`);
            console.log(`   - 响应ID: ${responseData.id || 'Missing'}`);
            console.log(`   - 类型: ${responseData.type || 'Missing'}`);
            console.log(`   - 角色: ${responseData.role || 'Missing'}`);
            console.log(`   - 停止原因: ${responseData.stop_reason || 'Missing'}`);
            console.log(`   - 内容块数: ${responseData.content?.length || 0}`);
            
            // 验证使用统计
            if (responseData.usage) {
                console.log(`📊 令牌使用统计:`);
                console.log(`   - 输入令牌: ${responseData.usage.input_tokens}`);
                console.log(`   - 输出令牌: ${responseData.usage.output_tokens}`);
                console.log(`   - 总令牌: ${responseData.usage.input_tokens + responseData.usage.output_tokens}`);
            }
            
            // 验证内容
            if (responseData.content && responseData.content.length > 0) {
                console.log(`📝 内容分析:`);
                
                const textBlocks = responseData.content.filter(block => block.type === 'text');
                const toolBlocks = responseData.content.filter(block => block.type === 'tool_use');
                
                console.log(`   - 文本块: ${textBlocks.length}`);
                console.log(`   - 工具调用块: ${toolBlocks.length}`);
                
                // 显示文本内容
                if (textBlocks.length > 0) {
                    const textContent = textBlocks[0].text;
                    const preview = textContent.length > 100 ? textContent.substring(0, 100) + '...' : textContent;
                    console.log(`   - 文本预览: "${preview}"`);
                }
                
                // 显示工具调用
                if (toolBlocks.length > 0) {
                    console.log(`   - 工具调用详情:`);
                    toolBlocks.forEach((tool, i) => {
                        console.log(`     [${i + 1}] 工具: ${tool.name}`);
                        console.log(`     [${i + 1}] 参数: ${JSON.stringify(tool.input)}`);
                        console.log(`     [${i + 1}] ID: ${tool.id}`);
                    });
                }
                
                // 验证期望结果
                const hasExpectedContent = testCase.expectedContent ? textBlocks.length > 0 : true;
                const hasExpectedToolUse = testCase.expectedToolUse ? toolBlocks.length > 0 : !toolBlocks.length;
                
                if (hasExpectedContent && hasExpectedToolUse) {
                    console.log(`✅ 内容验证通过`);
                } else {
                    console.log(`❌ 内容验证失败:`);
                    console.log(`   - 期望文本内容: ${testCase.expectedContent}, 实际: ${textBlocks.length > 0}`);
                    console.log(`   - 期望工具调用: ${testCase.expectedToolUse}, 实际: ${toolBlocks.length > 0}`);
                }
            }
        }
        
        const responseTime = Date.now() - startTime;
        console.log(`⏱️  响应时间: ${responseTime}ms`);
        
        return {
            success: true,
            responseTime,
            testCase: testCase.name
        };
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.log(`❌ 测试失败: ${error.message}`);
        console.log(`⏱️  失败时间: ${responseTime}ms`);
        
        return {
            success: false,
            error: error.message,
            responseTime,
            testCase: testCase.name
        };
    }
}

/**
 * 健康检查测试
 */
async function testHealthCheck() {
    console.log(`\\n🔍 健康检查测试`);
    console.log('-'.repeat(30));
    
    try {
        const response = await makeRequest(`${TEST_CONFIG.geminiServerUrl}/health`, {
            method: 'GET'
        });
        
        const healthData = await response.json();
        
        console.log(`✅ 健康检查通过: ${response.status}`);
        console.log(`   - 服务状态: ${healthData.status || 'Unknown'}`);
        console.log(`   - 版本: ${healthData.version || 'Unknown'}`);
        console.log(`   - 提供商: ${healthData.providers?.join(', ') || 'Unknown'}`);
        
        return { success: true };
        
    } catch (error) {
        console.log(`❌ 健康检查失败: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * 统计信息测试
 */
async function testStatsEndpoint() {
    console.log(`\\n📊 统计信息测试`);
    console.log('-'.repeat(30));
    
    try {
        const response = await makeRequest(`${TEST_CONFIG.geminiServerUrl}/api/stats`, {
            method: 'GET'
        });
        
        const statsData = await response.json();
        
        console.log(`✅ 统计信息获取成功: ${response.status}`);
        console.log(`   - 总请求: ${statsData.totalRequests || 0}`);
        console.log(`   - 成功请求: ${statsData.successfulRequests || 0}`);
        console.log(`   - 失败请求: ${statsData.failedRequests || 0}`);
        console.log(`   - 提供商统计: ${Object.keys(statsData.providerStats || {}).length} 个提供商`);
        
        if (statsData.providerStats) {
            Object.entries(statsData.providerStats).forEach(([provider, stats]) => {
                console.log(`     ${provider}: ${stats.requests || 0} 请求, ${((stats.successRate || 0) * 100).toFixed(1)}% 成功率`);
            });
        }
        
        return { success: true };
        
    } catch (error) {
        console.log(`❌ 统计信息获取失败: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * 主测试函数
 */
async function runEndToEndTests() {
    console.log(`🎯 开始Gemini端到端实际通信测试`);
    console.log(`📡 目标服务器: ${TEST_CONFIG.geminiServerUrl}`);
    console.log(`⏱️  测试超时: ${TEST_CONFIG.testTimeout}ms`);
    
    const results = {
        tests: [],
        summary: {
            total: 0,
            passed: 0,
            failed: 0,
            totalResponseTime: 0
        }
    };
    
    // 健康检查
    const healthResult = await testHealthCheck();
    results.tests.push({ name: 'Health Check', ...healthResult });
    
    if (!healthResult.success) {
        console.log(`\\n❌ 健康检查失败，停止测试`);
        return results;
    }
    
    // 执行所有测试用例
    for (let i = 0; i < testCases.length; i++) {
        const result = await testSingleRequest(testCases[i], i);
        results.tests.push(result);
        
        if (result.success) {
            results.summary.passed++;
        } else {
            results.summary.failed++;
        }
        
        results.summary.totalResponseTime += result.responseTime;
        
        // 测试间隔
        if (i < testCases.length - 1) {
            console.log(`\\n⏳ 等待 2 秒后进行下一个测试...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    // 统计信息检查
    const statsResult = await testStatsEndpoint();
    results.tests.push({ name: 'Stats Endpoint', ...statsResult });
    
    results.summary.total = results.tests.length;
    
    // 打印总结
    console.log(`\\n📋 端到端测试总结`);
    console.log('=' .repeat(60));
    console.log(`🎯 总测试数: ${results.summary.total}`);
    console.log(`✅ 通过: ${results.summary.passed}`);
    console.log(`❌ 失败: ${results.summary.failed}`);
    console.log(`⏱️  平均响应时间: ${Math.round(results.summary.totalResponseTime / results.summary.total)}ms`);
    console.log(`📊 成功率: ${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%`);
    
    console.log(`\\n📋 详细结果:`);
    results.tests.forEach((test, index) => {
        const status = test.success ? '✅' : '❌';
        const time = test.responseTime ? `(${test.responseTime}ms)` : '';
        console.log(`   ${status} ${test.testCase || test.name} ${time}`);
        if (!test.success && test.error) {
            console.log(`      错误: ${test.error}`);
        }
    });
    
    if (results.summary.failed === 0) {
        console.log(`\\n🎉 所有测试通过！Gemini端到端通信正常工作！`);
    } else {
        console.log(`\\n⚠️  ${results.summary.failed} 个测试失败，请检查配置和连接。`);
    }
    
    return results;
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    runEndToEndTests()
        .then(results => {
            const exitCode = results.summary.failed === 0 ? 0 : 1;
            process.exit(exitCode);
        })
        .catch(error => {
            console.error('\\n💥 测试运行失败:', error.message);
            console.error(error.stack);
            process.exit(1);
        });
}

export { runEndToEndTests };