#!/usr/bin/env node
/**
 * 测试从72fae85恢复后的Gemini工具调用功能
 * 验证双格式支持：OpenAI和Anthropic工具格式
 */

const { spawn } = require('child_process');
const fs = require('fs');

const CONFIG_FILE = '~/.route-claude-code/config/single-provider/config-google-gemini-5502.json';
const TEST_RESULTS_DIR = '/tmp/gemini-tool-test-results';
const PORT = 5502;

// 确保结果目录存在
if (!fs.existsSync(TEST_RESULTS_DIR)) {
    fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCurlTest(testName, requestBody) {
    console.log(`\n🧪 运行测试: ${testName}`);
    
    return new Promise((resolve) => {
        const curlProcess = spawn('curl', [
            '-X', 'POST',
            `http://localhost:${PORT}/chat/completions`,
            '-H', 'Content-Type: application/json',
            '-H', 'Accept: text/event-stream',
            '-d', JSON.stringify(requestBody),
            '--no-buffer',
            '-v'
        ]);

        let output = '';
        let errorOutput = '';
        
        curlProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
            process.stdout.write(chunk);
        });

        curlProcess.stderr.on('data', (data) => {
            const chunk = data.toString();
            errorOutput += chunk;
        });

        curlProcess.on('close', (code) => {
            // 保存测试结果
            const resultFile = `${TEST_RESULTS_DIR}/${testName.replace(/\s+/g, '_')}_${Date.now()}.json`;
            const result = {
                testName,
                requestBody,
                exitCode: code,
                output,
                errorOutput,
                timestamp: new Date().toISOString()
            };
            
            fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
            
            console.log(`\n✅ 测试完成: ${testName}`);
            console.log(`   退出码: ${code}`);
            console.log(`   结果保存: ${resultFile}`);
            console.log(`   输出长度: ${output.length} 字符`);
            
            // 简单分析结果
            const hasToolCall = output.includes('tool_use') || output.includes('function_call');
            const hasError = code !== 0 || output.includes('error') || errorOutput.includes('error');
            
            console.log(`   工具调用检测: ${hasToolCall ? '✅' : '❌'}`);
            console.log(`   错误检测: ${hasError ? '❌' : '✅'}`);
            
            resolve({
                success: code === 0 && !hasError,
                hasToolCall,
                resultFile
            });
        });
    });
}

async function checkServerHealth() {
    console.log('🔍 检查Gemini服务器状态...');
    
    return new Promise((resolve) => {
        const healthCheck = spawn('curl', [
            `http://localhost:${PORT}/health`,
            '-f',
            '--silent',
            '--max-time', '5'
        ]);

        healthCheck.on('close', (code) => {
            const isHealthy = code === 0;
            console.log(`   服务器健康状态: ${isHealthy ? '✅ 正常' : '❌ 异常'}`);
            resolve(isHealthy);
        });
    });
}

async function main() {
    console.log('🚀 Gemini工具调用修复验证测试');
    console.log(`   目标端口: ${PORT}`);
    console.log(`   配置文件: ${CONFIG_FILE}`);
    console.log(`   结果目录: ${TEST_RESULTS_DIR}`);

    // 检查服务器
    const isServerHealthy = await checkServerHealth();
    if (!isServerHealthy) {
        console.error('❌ 服务器不可用，请先启动Gemini服务器:');
        console.error(`   rcc start ${CONFIG_FILE} --debug`);
        process.exit(1);
    }

    // 测试用例1: OpenAI格式工具
    const openAiToolTest = {
        model: "gemini-2.5-pro",
        messages: [
            {
                role: "user", 
                content: "What's the weather like in Beijing today?"
            }
        ],
        tools: [
            {
                type: "function",
                function: {
                    name: "get_weather",
                    description: "Get current weather information for a location",
                    parameters: {
                        type: "object",
                        properties: {
                            location: {
                                type: "string",
                                description: "The city and state/country, e.g. San Francisco, CA"
                            },
                            unit: {
                                type: "string",
                                enum: ["celsius", "fahrenheit"],
                                description: "Temperature unit"
                            }
                        },
                        required: ["location"]
                    }
                }
            }
        ],
        stream: true
    };

    // 测试用例2: Anthropic格式工具
    const anthropicToolTest = {
        model: "gemini-2.5-pro",
        messages: [
            {
                role: "user", 
                content: "Search for recent news about AI developments"
            }
        ],
        tools: [
            {
                name: "search_news",
                description: "Search for recent news articles on a given topic",
                input_schema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Search query for news articles"
                        },
                        days: {
                            type: "integer",
                            description: "Number of days to look back",
                            default: 7
                        }
                    },
                    required: ["query"]
                }
            }
        ],
        stream: true
    };

    // 测试用例3: 纯文本（无工具调用）
    const textOnlyTest = {
        model: "gemini-2.5-pro",
        messages: [
            {
                role: "user", 
                content: "Write a short poem about programming"
            }
        ],
        stream: true
    };

    const tests = [
        { name: 'OpenAI格式工具调用', data: openAiToolTest },
        { name: 'Anthropic格式工具调用', data: anthropicToolTest },
        { name: '纯文本响应', data: textOnlyTest }
    ];

    let passedTests = 0;
    let toolCallTests = 0;
    let successfulToolCalls = 0;

    for (const test of tests) {
        const result = await runCurlTest(test.name, test.data);
        
        if (result.success) {
            passedTests++;
        }
        
        if (test.data.tools && test.data.tools.length > 0) {
            toolCallTests++;
            if (result.hasToolCall) {
                successfulToolCalls++;
            }
        }
        
        await sleep(2000); // 等待2秒间隔
    }

    // 总结报告
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试总结报告');
    console.log('='.repeat(60));
    console.log(`总测试数量: ${tests.length}`);
    console.log(`成功测试: ${passedTests}`);
    console.log(`工具调用测试: ${toolCallTests}`);
    console.log(`成功工具调用: ${successfulToolCalls}`);
    console.log(`测试通过率: ${(passedTests/tests.length*100).toFixed(1)}%`);
    console.log(`工具调用成功率: ${toolCallTests > 0 ? (successfulToolCalls/toolCallTests*100).toFixed(1) : 'N/A'}%`);
    
    const allToolCallsPassed = toolCallTests > 0 && successfulToolCalls === toolCallTests;
    const allTestsPassed = passedTests === tests.length;
    
    if (allTestsPassed && allToolCallsPassed) {
        console.log('\n🎉 所有测试通过！Gemini工具调用修复成功');
        process.exit(0);
    } else if (allTestsPassed) {
        console.log('\n⚠️  基础功能正常，但工具调用可能有问题');
        process.exit(1);
    } else {
        console.log('\n❌ 测试失败，需要进一步调试');
        process.exit(1);
    }
}

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('❌ 未捕获的异常:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ 未处理的Promise拒绝:', reason);
    process.exit(1);
});

main().catch((error) => {
    console.error('❌ 主程序错误:', error);
    process.exit(1);
});