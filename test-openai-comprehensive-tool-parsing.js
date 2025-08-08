#!/usr/bin/env node

/**
 * OpenAI Provider Comprehensive Tool Parsing Test
 * 测试所有OpenAI兼容供应商的工具调用解析和大文本处理能力
 * Author: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// OpenAI兼容供应商配置
const PROVIDERS = {
    lmstudio: { port: 5506, name: 'LM Studio', config: 'config-openai-lmstudio-5506.json' },
    modelscope: { port: 5507, name: 'ModelScope', config: 'config-openai-sdk-modelscope-5507.json' },
    shuaihong: { port: 5508, name: 'ShuaiHong', config: 'config-openai-shuaihong-5508.json' },
    modelscope_glm: { port: 5509, name: 'ModelScope GLM', config: 'config-openai-sdk-modelscope-glm-5509.json' }
};

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
function saveRawData(provider, testType, data, error = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${provider}-${testType}-${timestamp}.json`;
    const filepath = path.join(DATABASE_DIR, filename);
    
    const payload = {
        timestamp: new Date().toISOString(),
        provider,
        testType,
        data,
        error: error ? error.toString() : null
    };
    
    fs.writeFileSync(filepath, JSON.stringify(payload, null, 2));
    console.log(`💾 Saved raw data: ${filename}`);
    return filepath;
}

// 基础工具调用测试
const BASIC_TOOL_TEST = {
    model: "gpt-4",
    messages: [
        {
            role: "user",
            content: "请使用get_weather工具查询北京的天气情况"
        }
    ],
    tools: [
        {
            type: "function",
            function: {
                name: "get_weather",
                description: "获取指定城市的天气信息",
                parameters: {
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
        }
    ],
    tool_choice: "auto"
};

// 大文本中的工具调用测试
const LARGE_TEXT_TOOL_TEST = {
    model: "gpt-4",
    messages: [
        {
            role: "user",
            content: `请分析以下大段文本的情感，并使用analyze_sentiment工具进行分析：

            ${`这是一段很长的文本内容，用于测试大文本中工具调用的解析能力。`.repeat(100)}
            
            请对这段文本进行深入的情感分析，包括情感倾向、关键情感词汇识别等。同时使用calculate_statistics工具计算文本统计信息。
            
            ${`额外的文本内容用于增加复杂度，测试解析器在大文本环境下的稳定性。`.repeat(50)}`
        }
    ],
    tools: [
        {
            type: "function",
            function: {
                name: "analyze_sentiment",
                description: "分析文本的情感倾向",
                parameters: {
                    type: "object",
                    properties: {
                        text: { type: "string", description: "要分析的文本" },
                        language: { type: "string", description: "文本语言", default: "zh" }
                    },
                    required: ["text"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "calculate_statistics",
                description: "计算文本统计信息",
                parameters: {
                    type: "object",
                    properties: {
                        text: { type: "string", description: "要统计的文本" },
                        metrics: {
                            type: "array",
                            items: { type: "string" },
                            description: "要计算的统计指标"
                        }
                    },
                    required: ["text"]
                }
            }
        }
    ],
    tool_choice: "auto"
};

// 多轮工具调用测试
const MULTI_TURN_TOOL_TEST = {
    model: "gpt-4",
    messages: [
        {
            role: "user",
            content: "请先使用search_knowledge工具搜索关于人工智能的信息，然后使用summarize_text工具对搜索结果进行总结，最后使用save_document工具保存结果"
        }
    ],
    tools: [
        {
            type: "function",
            function: {
                name: "search_knowledge",
                description: "搜索知识库",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "搜索查询" },
                        limit: { type: "number", description: "结果数量限制", default: 10 }
                    },
                    required: ["query"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "summarize_text",
                description: "总结文本内容",
                parameters: {
                    type: "object",
                    properties: {
                        text: { type: "string", description: "要总结的文本" },
                        max_length: { type: "number", description: "最大长度", default: 200 }
                    },
                    required: ["text"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "save_document",
                description: "保存文档",
                parameters: {
                    type: "object",
                    properties: {
                        title: { type: "string", description: "文档标题" },
                        content: { type: "string", description: "文档内容" }
                    },
                    required: ["title", "content"]
                }
            }
        }
    ],
    tool_choice: "auto"
};

// 测试单个供应商
async function testProvider(providerKey, provider) {
    console.log(`\n🔍 测试供应商: ${provider.name} (端口 ${provider.port})`);
    
    const baseUrl = `http://localhost:${provider.port}`;
    const results = {
        provider: providerKey,
        name: provider.name,
        port: provider.port,
        tests: {}
    };

    // 检查服务是否运行
    try {
        await axios.get(`${baseUrl}/health`);
        console.log(`✅ ${provider.name} 服务正常运行`);
    } catch (error) {
        console.log(`❌ ${provider.name} 服务未运行，跳过测试`);
        results.error = '服务未运行';
        return results;
    }

    // 测试基础工具调用
    try {
        console.log(`  🧪 测试基础工具调用...`);
        const response = await axios.post(`${baseUrl}/v1/chat/completions`, BASIC_TOOL_TEST, {
            timeout: 30000
        });
        
        results.tests.basic_tool = {
            success: true,
            hasToolCalls: !!(response.data.choices?.[0]?.message?.tool_calls),
            toolCallsCount: response.data.choices?.[0]?.message?.tool_calls?.length || 0,
            response: response.data
        };
        
        console.log(`    ✅ 工具调用数量: ${results.tests.basic_tool.toolCallsCount}`);
        
    } catch (error) {
        console.log(`    ❌ 基础工具调用测试失败:`, error.message);
        results.tests.basic_tool = { success: false, error: error.message };
        saveRawData(providerKey, 'basic-tool-error', BASIC_TOOL_TEST, error);
    }

    // 测试大文本工具调用
    try {
        console.log(`  🧪 测试大文本工具调用...`);
        const response = await axios.post(`${baseUrl}/v1/chat/completions`, LARGE_TEXT_TOOL_TEST, {
            timeout: 60000
        });
        
        results.tests.large_text_tool = {
            success: true,
            hasToolCalls: !!(response.data.choices?.[0]?.message?.tool_calls),
            toolCallsCount: response.data.choices?.[0]?.message?.tool_calls?.length || 0,
            responseLength: JSON.stringify(response.data).length,
            response: response.data
        };
        
        console.log(`    ✅ 大文本工具调用数量: ${results.tests.large_text_tool.toolCallsCount}`);
        console.log(`    ✅ 响应长度: ${results.tests.large_text_tool.responseLength} 字符`);
        
    } catch (error) {
        console.log(`    ❌ 大文本工具调用测试失败:`, error.message);
        results.tests.large_text_tool = { success: false, error: error.message };
        saveRawData(providerKey, 'large-text-tool-error', LARGE_TEXT_TOOL_TEST, error);
    }

    // 测试多轮工具调用
    try {
        console.log(`  🧪 测试多轮工具调用...`);
        const response = await axios.post(`${baseUrl}/v1/chat/completions`, MULTI_TURN_TOOL_TEST, {
            timeout: 45000
        });
        
        results.tests.multi_turn_tool = {
            success: true,
            hasToolCalls: !!(response.data.choices?.[0]?.message?.tool_calls),
            toolCallsCount: response.data.choices?.[0]?.message?.tool_calls?.length || 0,
            response: response.data
        };
        
        console.log(`    ✅ 多轮工具调用数量: ${results.tests.multi_turn_tool.toolCallsCount}`);
        
    } catch (error) {
        console.log(`    ❌ 多轮工具调用测试失败:`, error.message);
        results.tests.multi_turn_tool = { success: false, error: error.message };
        saveRawData(providerKey, 'multi-turn-tool-error', MULTI_TURN_TOOL_TEST, error);
    }

    // 保存成功的原始数据
    if (results.tests.basic_tool?.success) {
        saveRawData(providerKey, 'basic-tool-success', results.tests.basic_tool.response);
    }
    if (results.tests.large_text_tool?.success) {
        saveRawData(providerKey, 'large-text-tool-success', results.tests.large_text_tool.response);
    }
    if (results.tests.multi_turn_tool?.success) {
        saveRawData(providerKey, 'multi-turn-tool-success', results.tests.multi_turn_tool.response);
    }

    return results;
}

// 生成测试报告
function generateReport(allResults) {
    console.log(`\n📊 OpenAI Provider 综合工具解析测试报告`);
    console.log(`${'='.repeat(60)}`);
    
    const timestamp = new Date().toISOString();
    let totalTests = 0;
    let successfulTests = 0;
    
    const report = {
        timestamp,
        summary: {},
        providers: allResults
    };

    allResults.forEach(result => {
        console.log(`\n🏢 ${result.name} (${result.provider})`);
        
        if (result.error) {
            console.log(`   ❌ ${result.error}`);
            return;
        }
        
        const tests = result.tests;
        let providerSuccessCount = 0;
        let providerTotalCount = Object.keys(tests).length;
        
        Object.entries(tests).forEach(([testType, testResult]) => {
            totalTests++;
            if (testResult.success) {
                successfulTests++;
                providerSuccessCount++;
                console.log(`   ✅ ${testType}: ${testResult.toolCallsCount || 0} 个工具调用`);
            } else {
                console.log(`   ❌ ${testType}: ${testResult.error}`);
            }
        });
        
        const successRate = providerTotalCount > 0 ? ((providerSuccessCount / providerTotalCount) * 100).toFixed(1) : '0';
        console.log(`   📈 成功率: ${successRate}% (${providerSuccessCount}/${providerTotalCount})`);
    });
    
    const overallSuccessRate = totalTests > 0 ? ((successfulTests / totalTests) * 100).toFixed(1) : '0';
    console.log(`\n📈 总体成功率: ${overallSuccessRate}% (${successfulTests}/${totalTests})`);
    
    report.summary = {
        totalTests,
        successfulTests,
        overallSuccessRate: parseFloat(overallSuccessRate)
    };
    
    // 保存报告
    const reportPath = saveRawData('comprehensive', 'test-report', report);
    console.log(`\n📋 详细报告已保存: ${reportPath}`);
    
    return report;
}

// 主测试函数
async function main() {
    console.log('🚀 开始 OpenAI Provider 综合工具解析测试');
    
    // 确保database目录存在
    ensureDatabaseDir();
    
    const allResults = [];
    
    // 测试所有供应商
    for (const [key, provider] of Object.entries(PROVIDERS)) {
        try {
            const result = await testProvider(key, provider);
            allResults.push(result);
        } catch (error) {
            console.log(`❌ 测试供应商 ${provider.name} 时发生错误:`, error.message);
            allResults.push({
                provider: key,
                name: provider.name,
                port: provider.port,
                error: error.message
            });
        }
    }
    
    // 生成最终报告
    generateReport(allResults);
    
    console.log('\n✅ OpenAI Provider 综合测试完成');
}

// 执行主函数
if (require.main === module) {
    main().catch(error => {
        console.error('❌ 测试执行失败:', error);
        process.exit(1);
    });
}

module.exports = { main, testProvider, PROVIDERS };