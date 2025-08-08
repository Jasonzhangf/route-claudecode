#!/usr/bin/env node

/**
 * 直接测试5508端口工具调用
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

// 保存原始数据
function saveRawData(testType, data, error = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `5508-direct-${testType}-${timestamp}.json`;
    const filepath = path.join(DATABASE_DIR, filename);
    
    const payload = {
        timestamp: new Date().toISOString(),
        testType,
        data,
        error: error ? error.toString() : null
    };
    
    fs.writeFileSync(filepath, JSON.stringify(payload, null, 2));
    console.log(`💾 保存数据: ${filename}`);
    return filepath;
}

async function testAnthropicToolCall() {
    console.log('🧪 测试Anthropic格式工具调用 (5508端口)...');
    
    const payload = {
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

    try {
        console.log('发送请求到 http://localhost:5508/v1/messages...');
        const response = await axios.post('http://localhost:5508/v1/messages', payload, {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ 请求成功');
        console.log('响应状态:', response.status);
        console.log('响应头:', JSON.stringify(response.headers, null, 2));
        
        const hasToolUse = response.data.content?.some(item => item.type === 'tool_use');
        const toolCount = response.data.content?.filter(item => item.type === 'tool_use')?.length || 0;
        
        console.log('工具使用情况:');
        console.log(`  - 包含工具使用: ${hasToolUse}`);
        console.log(`  - 工具调用数量: ${toolCount}`);
        
        if (response.data.content) {
            response.data.content.forEach((item, index) => {
                console.log(`  - 内容项 ${index + 1}: ${item.type}`);
                if (item.type === 'tool_use') {
                    console.log(`    工具名称: ${item.name}`);
                    console.log(`    工具参数:`, JSON.stringify(item.input, null, 2));
                }
            });
        }
        
        saveRawData('anthropic-tool-success', response.data);
        
        return {
            success: true,
            hasToolUse,
            toolCount,
            response: response.data
        };
        
    } catch (error) {
        console.log('❌ 请求失败:', error.message);
        if (error.response) {
            console.log('错误状态:', error.response.status);
            console.log('错误数据:', JSON.stringify(error.response.data, null, 2));
            saveRawData('anthropic-tool-error', error.response.data, error);
        } else {
            saveRawData('anthropic-tool-error', payload, error);
        }
        
        return {
            success: false,
            error: error.message
        };
    }
}

async function testOpenAIToolCall() {
    console.log('\n🧪 测试OpenAI格式工具调用 (5508端口)...');
    
    const payload = {
        model: "gpt-4",
        messages: [
            {
                role: "user",
                content: "请使用analyze_sentiment工具分析这句话的情感：今天天气真好，我很开心！"
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
                            text: {
                                type: "string",
                                description: "要分析的文本"
                            },
                            confidence: {
                                type: "number",
                                description: "置信度",
                                minimum: 0,
                                maximum: 1
                            }
                        },
                        required: ["text"]
                    }
                }
            }
        ],
        tool_choice: "auto"
    };

    try {
        console.log('发送请求到 http://localhost:5508/v1/chat/completions...');
        const response = await axios.post('http://localhost:5508/v1/chat/completions', payload, {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ 请求成功');
        console.log('响应状态:', response.status);
        
        const hasToolCalls = !!(response.data.choices?.[0]?.message?.tool_calls);
        const toolCallsCount = response.data.choices?.[0]?.message?.tool_calls?.length || 0;
        
        console.log('工具调用情况:');
        console.log(`  - 包含工具调用: ${hasToolCalls}`);
        console.log(`  - 工具调用数量: ${toolCallsCount}`);
        
        if (response.data.choices?.[0]?.message?.tool_calls) {
            response.data.choices[0].message.tool_calls.forEach((call, index) => {
                console.log(`  - 工具调用 ${index + 1}:`);
                console.log(`    ID: ${call.id}`);
                console.log(`    函数: ${call.function.name}`);
                console.log(`    参数:`, call.function.arguments);
            });
        }
        
        saveRawData('openai-tool-success', response.data);
        
        return {
            success: true,
            hasToolCalls,
            toolCallsCount,
            response: response.data
        };
        
    } catch (error) {
        console.log('❌ 请求失败:', error.message);
        if (error.response) {
            console.log('错误状态:', error.response.status);
            console.log('错误数据:', JSON.stringify(error.response.data, null, 2));
            saveRawData('openai-tool-error', error.response.data, error);
        } else {
            saveRawData('openai-tool-error', payload, error);
        }
        
        return {
            success: false,
            error: error.message
        };
    }
}

async function main() {
    console.log('🚀 开始5508端口直接工具调用测试');
    ensureDatabaseDir();
    
    // 测试健康状态
    try {
        const health = await axios.get('http://localhost:5508/health', { timeout: 5000 });
        console.log('✅ 服务健康状态:', JSON.stringify(health.data, null, 2));
    } catch (error) {
        console.log('❌ 健康检查失败:', error.message);
        return;
    }
    
    const results = {
        anthropic: await testAnthropicToolCall(),
        openai: await testOpenAIToolCall()
    };
    
    console.log('\n📊 测试结果汇总:');
    console.log('================');
    console.log(`Anthropic格式: ${results.anthropic.success ? '✅ 成功' : '❌ 失败'}`);
    if (results.anthropic.success) {
        console.log(`  - 工具使用: ${results.anthropic.hasToolUse}`);
        console.log(`  - 工具数量: ${results.anthropic.toolCount}`);
    }
    
    console.log(`OpenAI格式: ${results.openai.success ? '✅ 成功' : '❌ 失败'}`);
    if (results.openai.success) {
        console.log(`  - 工具调用: ${results.openai.hasToolCalls}`);
        console.log(`  - 调用数量: ${results.openai.toolCallsCount}`);
    }
    
    // 保存最终报告
    const reportPath = saveRawData('final-report', results);
    console.log(`\n📋 完整报告已保存: ${reportPath}`);
    
    console.log('\n✅ 测试完成');
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    });
}