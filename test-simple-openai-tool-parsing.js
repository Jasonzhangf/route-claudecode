#!/usr/bin/env node

/**
 * 简化的OpenAI工具解析测试
 * 测试当前运行服务的工具调用解析能力
 * Author: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 数据库目录路径
const DATABASE_DIR = path.join(process.env.HOME, '.route-claude-code/config/database');

// 确保database目录存在
function ensureDatabaseDir() {
    if (!fs.existsSync(DATABASE_DIR)) {
        fs.mkdirSync(DATABASE_DIR, { recursive: true });
        console.log(`✅ Created database directory: ${DATABASE_DIR}`);
    }
}

// 保存原始数据到database
function saveRawData(testType, data, error = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `simple-test-${testType}-${timestamp}.json`;
    const filepath = path.join(DATABASE_DIR, filename);
    
    const payload = {
        timestamp: new Date().toISOString(),
        testType,
        data,
        error: error ? error.toString() : null
    };
    
    fs.writeFileSync(filepath, JSON.stringify(payload, null, 2));
    console.log(`💾 Saved raw data: ${filename}`);
    return filepath;
}

// 测试可用的端口
const TEST_PORTS = [5502, 5506, 5507, 5508, 5509];

// 基础工具调用测试（Anthropic格式）
const ANTHROPIC_TOOL_TEST = {
    model: "claude-3-sonnet-20240229",
    max_tokens: 1024,
    messages: [
        {
            role: "user",
            content: "请使用get_weather工具查询北京的天气情况"
        }
    ],
    tools: [
        {
            name: "get_weather",
            description: "获取指定城市的天气信息",
            input_schema: {
                type: "object",
                properties: {
                    city: {
                        type: "string",
                        description: "城市名称"
                    },
                    unit: {
                        type: "string",
                        enum: ["celsius", "fahrenheit"],
                        description: "温度单位"
                    }
                },
                required: ["city"]
            }
        }
    ]
};

// OpenAI格式工具调用测试
const OPENAI_TOOL_TEST = {
    model: "gpt-4",
    messages: [
        {
            role: "user",
            content: "请使用analyze_text工具分析这段文字的情感：今天天气很好，我很开心。"
        }
    ],
    tools: [
        {
            type: "function",
            function: {
                name: "analyze_text",
                description: "分析文本的情感倾向",
                parameters: {
                    type: "object",
                    properties: {
                        text: {
                            type: "string",
                            description: "要分析的文本"
                        },
                        language: {
                            type: "string",
                            description: "文本语言",
                            default: "zh"
                        }
                    },
                    required: ["text"]
                }
            }
        }
    ],
    tool_choice: "auto"
};

// 大文本工具调用测试
const LARGE_TEXT_TEST = {
    model: "claude-3-sonnet-20240229",
    max_tokens: 2048,
    messages: [
        {
            role: "user",
            content: `请对以下长文本进行分析并使用summarize_text工具进行总结：

            ${`这是一段用于测试大文本处理能力的内容。我们需要验证系统在处理包含大量文本的请求时，是否能够正确解析和处理工具调用。这种情况在实际应用中经常出现，因为用户可能会提交包含大量信息的文档或数据，然后要求系统使用特定的工具来处理这些内容。`.repeat(20)}
            
            请使用工具对上述文本进行总结和分析。`
        }
    ],
    tools: [
        {
            name: "summarize_text",
            description: "总结和分析文本内容",
            input_schema: {
                type: "object",
                properties: {
                    text: {
                        type: "string",
                        description: "要总结的文本"
                    },
                    max_words: {
                        type: "number",
                        description: "最大词数",
                        default: 100
                    }
                },
                required: ["text"]
            }
        }
    ]
};

// 检查端口是否可用
async function checkPortAvailability(port) {
    try {
        const response = await axios.get(`http://localhost:${port}/health`, { timeout: 5000 });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

// 测试单个端口的工具解析
async function testPort(port) {
    console.log(`\n🔍 测试端口 ${port}`);
    
    const baseUrl = `http://localhost:${port}`;
    const results = {
        port,
        available: false,
        tests: {}
    };

    // 检查服务是否可用
    if (!(await checkPortAvailability(port))) {
        console.log(`❌ 端口 ${port} 服务未运行`);
        return results;
    }

    results.available = true;
    console.log(`✅ 端口 ${port} 服务正常运行`);

    // 测试Anthropic格式工具调用
    try {
        console.log(`  🧪 测试Anthropic格式工具调用...`);
        const response = await axios.post(`${baseUrl}/v1/messages`, ANTHROPIC_TOOL_TEST, {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const hasToolUse = response.data.content?.some(item => item.type === 'tool_use');
        results.tests.anthropic_tool = {
            success: true,
            hasToolUse: hasToolUse,
            toolCount: response.data.content?.filter(item => item.type === 'tool_use')?.length || 0,
            response: response.data
        };
        
        console.log(`    ✅ 工具使用: ${hasToolUse ? '是' : '否'}, 工具数量: ${results.tests.anthropic_tool.toolCount}`);
        
        if (results.tests.anthropic_tool.success) {
            saveRawData(`port-${port}-anthropic-tool-success`, response.data);
        }
        
    } catch (error) {
        console.log(`    ❌ Anthropic格式工具调用失败:`, error.message);
        results.tests.anthropic_tool = { success: false, error: error.message };
        saveRawData(`port-${port}-anthropic-tool-error`, ANTHROPIC_TOOL_TEST, error);
    }

    // 测试OpenAI格式工具调用（如果是OpenAI兼容端点）
    if (port !== 5502) { // 5502是Gemini服务，不支持OpenAI格式
        try {
            console.log(`  🧪 测试OpenAI格式工具调用...`);
            const response = await axios.post(`${baseUrl}/v1/chat/completions`, OPENAI_TOOL_TEST, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const hasToolCalls = !!(response.data.choices?.[0]?.message?.tool_calls);
            results.tests.openai_tool = {
                success: true,
                hasToolCalls: hasToolCalls,
                toolCallsCount: response.data.choices?.[0]?.message?.tool_calls?.length || 0,
                response: response.data
            };
            
            console.log(`    ✅ 工具调用: ${hasToolCalls ? '是' : '否'}, 调用数量: ${results.tests.openai_tool.toolCallsCount}`);
            
            if (results.tests.openai_tool.success) {
                saveRawData(`port-${port}-openai-tool-success`, response.data);
            }
            
        } catch (error) {
            console.log(`    ❌ OpenAI格式工具调用失败:`, error.message);
            results.tests.openai_tool = { success: false, error: error.message };
            saveRawData(`port-${port}-openai-tool-error`, OPENAI_TOOL_TEST, error);
        }
    }

    // 测试大文本处理
    try {
        console.log(`  🧪 测试大文本工具调用...`);
        const response = await axios.post(`${baseUrl}/v1/messages`, LARGE_TEXT_TEST, {
            timeout: 60000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const hasToolUse = response.data.content?.some(item => item.type === 'tool_use');
        const responseLength = JSON.stringify(response.data).length;
        
        results.tests.large_text_tool = {
            success: true,
            hasToolUse: hasToolUse,
            toolCount: response.data.content?.filter(item => item.type === 'tool_use')?.length || 0,
            responseLength: responseLength,
            response: response.data
        };
        
        console.log(`    ✅ 大文本工具使用: ${hasToolUse ? '是' : '否'}, 响应长度: ${responseLength} 字符`);
        
        if (results.tests.large_text_tool.success) {
            saveRawData(`port-${port}-large-text-tool-success`, response.data);
        }
        
    } catch (error) {
        console.log(`    ❌ 大文本工具调用失败:`, error.message);
        results.tests.large_text_tool = { success: false, error: error.message };
        saveRawData(`port-${port}-large-text-tool-error`, LARGE_TEXT_TEST, error);
    }

    return results;
}

// 生成测试报告
function generateReport(allResults) {
    console.log(`\n📊 简化工具解析测试报告`);
    console.log(`${'='.repeat(50)}`);
    
    let totalTests = 0;
    let successfulTests = 0;
    
    allResults.forEach(result => {
        console.log(`\n🏢 端口 ${result.port}`);
        
        if (!result.available) {
            console.log(`   ❌ 服务未运行`);
            return;
        }
        
        const tests = result.tests;
        let portSuccessCount = 0;
        let portTotalCount = Object.keys(tests).length;
        
        Object.entries(tests).forEach(([testType, testResult]) => {
            totalTests++;
            if (testResult.success) {
                successfulTests++;
                portSuccessCount++;
                if (testType.includes('anthropic')) {
                    console.log(`   ✅ Anthropic工具: ${testResult.toolCount || 0} 个工具使用`);
                } else if (testType.includes('openai')) {
                    console.log(`   ✅ OpenAI工具: ${testResult.toolCallsCount || 0} 个工具调用`);
                } else if (testType.includes('large_text')) {
                    console.log(`   ✅ 大文本: ${testResult.toolCount || 0} 个工具, ${testResult.responseLength} 字符`);
                }
            } else {
                console.log(`   ❌ ${testType}: ${testResult.error}`);
            }
        });
        
        const successRate = portTotalCount > 0 ? ((portSuccessCount / portTotalCount) * 100).toFixed(1) : '0';
        console.log(`   📈 成功率: ${successRate}% (${portSuccessCount}/${portTotalCount})`);
    });
    
    const overallSuccessRate = totalTests > 0 ? ((successfulTests / totalTests) * 100).toFixed(1) : '0';
    console.log(`\n📈 总体成功率: ${overallSuccessRate}% (${successfulTests}/${totalTests})`);
    
    // 保存报告
    const reportPath = saveRawData('comprehensive-simple-report', {
        timestamp: new Date().toISOString(),
        totalTests,
        successfulTests,
        overallSuccessRate: parseFloat(overallSuccessRate),
        results: allResults
    });
    console.log(`\n📋 详细报告已保存: ${reportPath}`);
}

// 主测试函数
async function main() {
    console.log('🚀 开始简化工具解析测试');
    
    // 确保database目录存在
    ensureDatabaseDir();
    
    const allResults = [];
    
    // 测试所有端口
    for (const port of TEST_PORTS) {
        try {
            const result = await testPort(port);
            allResults.push(result);
        } catch (error) {
            console.log(`❌ 测试端口 ${port} 时发生错误:`, error.message);
            allResults.push({
                port,
                available: false,
                error: error.message
            });
        }
    }
    
    // 生成最终报告
    generateReport(allResults);
    
    console.log('\n✅ 简化工具解析测试完成');
}

// 执行主函数
if (require.main === module) {
    main().catch(error => {
        console.error('❌ 测试执行失败:', error);
        process.exit(1);
    });
}

module.exports = { main };