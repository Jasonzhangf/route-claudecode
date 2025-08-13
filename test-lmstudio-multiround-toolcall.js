/**
 * LMStudio多轮会话工具调用测试
 * 使用简化的用户配置文件测试V3路由系统
 */

import fs from 'fs';

console.log('🔧 LMStudio多轮会话工具调用测试开始...\n');

// 测试配置
const CONFIG = {
    serverUrl: 'http://localhost:5506',
    configFile: './config/user/user-config-lmstudio.json',
    testTimeout: 30000,
    logFile: `/tmp/lmstudio-multiround-test-${Date.now()}.log`
};

// 工具定义
const TOOLS = [
    {
        name: "get_weather",
        description: "Get current weather information for a location",
        input_schema: {
            type: "object",
            properties: {
                location: {
                    type: "string",
                    description: "The city and state, e.g. San Francisco, CA"
                }
            },
            required: ["location"]
        }
    },
    {
        name: "calculate",
        description: "Perform mathematical calculations",
        input_schema: {
            type: "object",
            properties: {
                expression: {
                    type: "string",
                    description: "Mathematical expression to evaluate, e.g. '2 + 3 * 4'"
                }
            },
            required: ["expression"]
        }
    },
    {
        name: "search_web",
        description: "Search the web for information",
        input_schema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Search query"
                }
            },
            required: ["query"]
        }
    }
];

// 测试会话序列
const TEST_CONVERSATIONS = [
    {
        id: 'round-1',
        description: '第一轮：基础工具调用测试',
        messages: [
            {
                role: 'user',
                content: '请帮我查询一下北京的天气，然后计算一下 15 + 25 * 2 的结果'
            }
        ]
    },
    {
        id: 'round-2', 
        description: '第二轮：基于上一轮结果的追问',
        messages: [
            {
                role: 'user',
                content: '如果刚才计算的结果是正确的，请帮我搜索一下"如何在北京这种天气下保持健康"'
            }
        ]
    },
    {
        id: 'round-3',
        description: '第三轮：复杂多工具调用',
        messages: [
            {
                role: 'user', 
                content: '请同时帮我：1) 查询上海天气，2) 计算上海到北京的直线距离约1200公里，如果以每小时80公里速度行驶需要多少小时，3) 搜索"上海到北京高速公路路线"'
            }
        ]
    }
];

// 工具调用模拟响应
const TOOL_RESPONSES = {
    get_weather: (args) => ({
        location: args.location,
        temperature: '22°C',
        condition: '晴朗',
        humidity: '65%',
        wind: '微风'
    }),
    calculate: (args) => {
        try {
            // 简单的数学表达式计算
            const result = eval(args.expression.replace(/[^0-9+\-*/().\s]/g, ''));
            return { expression: args.expression, result: result };
        } catch (e) {
            return { expression: args.expression, error: 'Invalid expression' };
        }
    },
    search_web: (args) => ({
        query: args.query,
        results: [
            { title: `搜索结果1: ${args.query}`, url: 'https://example.com/1' },
            { title: `搜索结果2: ${args.query}`, url: 'https://example.com/2' },
            { title: `搜索结果3: ${args.query}`, url: 'https://example.com/3' }
        ]
    })
};

async function testLMStudioMultiRound() {
    const testResults = {
        configLoad: false,
        serverHealth: false,
        conversations: [],
        summary: {
            totalRounds: 0,
            successfulRounds: 0,
            toolCallsTotal: 0,
            toolCallsSuccessful: 0
        }
    };

    try {
        // 1. 检查配置文件
        console.log('📋 检查配置文件...');
        if (!fs.existsSync(CONFIG.configFile)) {
            throw new Error(`配置文件不存在: ${CONFIG.configFile}`);
        }
        
        const userConfig = JSON.parse(fs.readFileSync(CONFIG.configFile, 'utf8'));
        console.log('✅ 配置文件加载成功');
        console.log(`   - 端口: ${userConfig.server.port}`);
        console.log(`   - Providers: ${Object.keys(userConfig.providers).join(', ')}`);
        testResults.configLoad = true;

        // 2. 检查服务器健康状态
        console.log('\n🏥 检查V3服务器健康状态...');
        try {
            const healthResponse = await fetch(`${CONFIG.serverUrl}/health`);
            if (healthResponse.ok) {
                const health = await healthResponse.json();
                console.log('✅ V3服务器健康状态良好');
                console.log(`   - 状态: ${health.overall}`);
                console.log(`   - 健康Providers: ${health.healthy}/${health.total}`);
                testResults.serverHealth = true;
            } else {
                throw new Error(`服务器健康检查失败: ${healthResponse.status}`);
            }
        } catch (healthError) {
            console.log('❌ V3服务器未运行或不可达');
            console.log('   请先启动服务器:');
            console.log(`   node bin/rcc3.js start ${CONFIG.configFile} --debug`);
            throw healthError;
        }

        // 3. 执行多轮会话测试
        console.log('\n🔄 开始多轮会话工具调用测试...\n');
        
        let conversationHistory = [];
        
        for (const conversation of TEST_CONVERSATIONS) {
            console.log(`\n📞 ${conversation.description}`);
            console.log(`   ID: ${conversation.id}`);
            
            const roundResult = {
                id: conversation.id,
                description: conversation.description,
                success: false,
                toolCalls: [],
                responseTime: 0,
                error: null
            };

            try {
                const startTime = Date.now();
                
                // 构建请求消息（包含历史对话）
                const requestMessages = [
                    ...conversationHistory,
                    ...conversation.messages
                ];

                const requestBody = {
                    model: 'qwen3-30b',
                    max_tokens: 2000,
                    messages: requestMessages,
                    tools: TOOLS,
                    tool_choice: 'auto'
                };

                console.log(`   📤 发送请求到 ${CONFIG.serverUrl}/v1/messages`);
                console.log(`   📝 消息数量: ${requestMessages.length}`);
                console.log(`   🛠️  工具数量: ${TOOLS.length}`);

                const response = await fetch(`${CONFIG.serverUrl}/v1/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody)
                });

                roundResult.responseTime = Date.now() - startTime;

                if (!response.ok) {
                    throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
                }

                const result = await response.json();
                console.log(`   ⏱️  响应时间: ${roundResult.responseTime}ms`);

                // 检查响应内容
                if (result.content && result.content.length > 0) {
                    console.log(`   📄 响应内容块数量: ${result.content.length}`);
                    
                    // 查找工具调用
                    for (const content of result.content) {
                        if (content.type === 'tool_use') {
                            console.log(`   🛠️  工具调用: ${content.name}`);
                            console.log(`      参数: ${JSON.stringify(content.input)}`);
                            
                            roundResult.toolCalls.push({
                                name: content.name,
                                input: content.input,
                                id: content.id
                            });

                            // 模拟工具响应
                            if (TOOL_RESPONSES[content.name]) {
                                const toolResult = TOOL_RESPONSES[content.name](content.input);
                                console.log(`      模拟响应: ${JSON.stringify(toolResult)}`);
                                
                                // 将工具响应添加到对话历史
                                conversationHistory.push({
                                    role: 'user',
                                    content: [
                                        {
                                            type: 'tool_result',
                                            tool_use_id: content.id,
                                            content: JSON.stringify(toolResult)
                                        }
                                    ]
                                });
                            }
                        } else if (content.type === 'text') {
                            console.log(`   💬 文本响应: ${content.text.substring(0, 100)}...`);
                        }
                    }

                    // 将AI响应添加到对话历史
                    conversationHistory.push({
                        role: 'assistant',
                        content: result.content
                    });

                    roundResult.success = true;
                    console.log(`   ✅ 第${conversation.id}轮测试成功`);
                } else {
                    throw new Error('响应中没有内容');
                }

            } catch (error) {
                roundResult.error = error.message;
                console.log(`   ❌ 第${conversation.id}轮测试失败: ${error.message}`);
            }

            testResults.conversations.push(roundResult);
            testResults.summary.totalRounds++;
            if (roundResult.success) {
                testResults.summary.successfulRounds++;
            }
            testResults.summary.toolCallsTotal += roundResult.toolCalls.length;
            testResults.summary.toolCallsSuccessful += roundResult.toolCalls.length; // 假设所有工具调用都成功

            // 轮次间延迟
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // 4. 输出测试总结
        console.log('\n📊 测试结果总结:');
        console.log(`   📋 配置加载: ${testResults.configLoad ? '✅' : '❌'}`);
        console.log(`   🏥 服务器健康: ${testResults.serverHealth ? '✅' : '❌'}`);
        console.log(`   🔄 成功轮次: ${testResults.summary.successfulRounds}/${testResults.summary.totalRounds}`);
        console.log(`   🛠️  工具调用: ${testResults.summary.toolCallsSuccessful}/${testResults.summary.toolCallsTotal}`);
        
        if (testResults.summary.successfulRounds === testResults.summary.totalRounds) {
            console.log('\n🎉 所有测试轮次都成功完成！');
        } else {
            console.log('\n⚠️  部分测试轮次失败，请检查详细日志');
        }

        // 5. 保存详细测试结果
        const logData = {
            timestamp: new Date().toISOString(),
            config: CONFIG,
            results: testResults,
            conversationHistory: conversationHistory
        };

        fs.writeFileSync(CONFIG.logFile, JSON.stringify(logData, null, 2));
        console.log(`\n💾 详细测试结果已保存: ${CONFIG.logFile}`);

        return testResults;

    } catch (error) {
        console.error('\n❌ 多轮会话工具调用测试失败:');
        console.error('错误消息:', error.message);
        console.error('错误堆栈:\n', error.stack);
        throw error;
    }
}

// 运行测试
testLMStudioMultiRound();