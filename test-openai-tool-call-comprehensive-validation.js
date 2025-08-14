#!/usr/bin/env node

/**
 * OpenAI Provider工具调用综合验证测试脚本
 * 测试用例: 验证通过3456端口负载均衡器的所有OpenAI Provider工具调用功能
 * 
 * 目标:
 * 1. 测试ModelScope、ShuaiHong、LMStudio三个Provider的工具调用
 * 2. 验证工具调用格式转换的正确性
 * 3. 确认stop_reason和finish_reason的一致性
 * 4. 验证六层架构的完整数据流
 * 
 * @author Claude Code AI Assistant
 * @date 2025-08-10
 */

const https = require('https');
const http = require('http');

// 配置常量
const CONFIG = {
    baseUrl: 'http://localhost:3456',
    timeout: 30000,
    testScenarios: [
        {
            name: '简单计算工具调用',
            category: 'calculator',
            message: '帮我计算 15 * 23 + 45 的结果',
            tools: [
                {
                    "name": "calculator",
                    "description": "计算数学表达式",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "expression": {
                                "type": "string",
                                "description": "要计算的数学表达式"
                            }
                        },
                        "required": ["expression"]
                    }
                }
            ],
            expectedToolUse: true
        },
        {
            name: '文件分析工具调用',
            category: 'file_analyzer',  
            message: '请分析当前目录下的package.json文件',
            tools: [
                {
                    "name": "file_analyzer",
                    "description": "分析文件内容和结构",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "file_path": {
                                "type": "string",
                                "description": "要分析的文件路径"
                            },
                            "analysis_type": {
                                "type": "string",
                                "description": "分析类型：content, structure, dependencies",
                                "enum": ["content", "structure", "dependencies"]
                            }
                        },
                        "required": ["file_path"]
                    }
                }
            ],
            expectedToolUse: true
        },
        {
            name: '代码生成工具调用',
            category: 'code_generator',
            message: '请帮我生成一个简单的Node.js HTTP服务器代码',
            tools: [
                {
                    "name": "write_file",
                    "description": "写入文件内容",
                    "input_schema": {
                        "type": "object", 
                        "properties": {
                            "file_path": {
                                "type": "string",
                                "description": "文件路径"
                            },
                            "content": {
                                "type": "string",
                                "description": "文件内容"
                            }
                        },
                        "required": ["file_path", "content"]
                    }
                }
            ],
            expectedToolUse: true
        },
        {
            name: '纯文本对话（无工具）',
            category: 'simple_chat',
            message: '今天天气如何？（请直接回答，不要使用任何工具）',
            tools: [], // 无工具定义
            expectedToolUse: false
        }
    ]
};

/**
 * 发送HTTP请求
 */
function sendRequest(data) {
    return new Promise((resolve, reject) => {
        const requestData = JSON.stringify(data);
        
        const options = {
            hostname: 'localhost',
            port: 3456,
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': requestData.length,
                'anthropic-version': '2023-06-01'
            },
            timeout: CONFIG.timeout
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: parsedData
                    });
                } catch (error) {
                    reject(new Error(`解析响应失败: ${error.message}\n原始响应: ${responseData}`));
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });

        req.on('error', (error) => {
            reject(new Error(`请求失败: ${error.message}`));
        });

        req.write(requestData);
        req.end();
    });
}

/**
 * 验证响应格式
 */
function validateResponse(response, scenario) {
    const validation = {
        success: true,
        errors: [],
        details: {}
    };

    // 检查基本响应结构
    if (!response.data) {
        validation.errors.push('缺少响应数据');
        validation.success = false;
        return validation;
    }

    const data = response.data;

    // 验证基本字段
    if (!data.id) validation.errors.push('缺少响应ID');
    if (!data.type) validation.errors.push('缺少响应类型');
    if (!data.role) validation.errors.push('缺少角色字段');
    if (!data.content) validation.errors.push('缺少内容字段');
    if (!data.model) validation.errors.push('缺少模型字段');
    if (!data.stop_reason) validation.errors.push('缺少stop_reason字段');

    // 验证内容结构
    if (data.content && Array.isArray(data.content)) {
        validation.details.contentBlocks = data.content.length;
        
        const hasText = data.content.some(block => block.type === 'text');
        const hasToolUse = data.content.some(block => block.type === 'tool_use');
        
        validation.details.hasTextContent = hasText;
        validation.details.hasToolUse = hasToolUse;
        validation.details.stopReason = data.stop_reason;

        // 验证工具调用一致性
        if (scenario.expectedToolUse) {
            if (!hasToolUse) {
                validation.errors.push(`期望工具调用但未发现tool_use内容块`);
            } else if (data.stop_reason !== 'tool_use') {
                validation.errors.push(`有工具调用但stop_reason为"${data.stop_reason}"，应为"tool_use"`);
            }
        } else {
            if (hasToolUse) {
                validation.errors.push(`不期望工具调用但发现tool_use内容块`);
            } else if (data.stop_reason !== 'end_turn') {
                validation.errors.push(`无工具调用但stop_reason为"${data.stop_reason}"，应为"end_turn"`);
            }
        }

        // 详细分析工具调用内容
        if (hasToolUse) {
            const toolUseBlocks = data.content.filter(block => block.type === 'tool_use');
            validation.details.toolCalls = toolUseBlocks.map(block => ({
                id: block.id,
                name: block.name,
                input: block.input
            }));
        }
    } else {
        validation.errors.push('content字段不是数组格式');
    }

    validation.success = validation.errors.length === 0;
    return validation;
}

/**
 * 格式化测试结果显示
 */
function formatTestResult(scenario, response, validation, duration) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 测试场景: ${scenario.name}`);
    console.log(`📂 分类: ${scenario.category}`);
    console.log(`📝 消息: ${scenario.message}`);
    console.log(`⏱️  耗时: ${duration}ms`);
    console.log(`${'='.repeat(80)}`);

    // 显示响应状态
    console.log(`\n📊 响应状态:`);
    console.log(`   HTTP状态码: ${response.status}`);
    console.log(`   期望工具调用: ${scenario.expectedToolUse ? '是' : '否'}`);
    
    if (response.data) {
        console.log(`   模型: ${response.data.model || 'N/A'}`);
        console.log(`   Stop Reason: ${response.data.stop_reason || 'N/A'}`);
        console.log(`   内容块数量: ${validation.details.contentBlocks || 0}`);
        console.log(`   包含文本: ${validation.details.hasTextContent ? '是' : '否'}`);
        console.log(`   包含工具调用: ${validation.details.hasToolUse ? '是' : '否'}`);
    }

    // 显示验证结果
    console.log(`\n✅ 验证结果: ${validation.success ? '通过' : '失败'}`);
    
    if (validation.errors.length > 0) {
        console.log(`❌ 发现错误:`);
        validation.errors.forEach((error, index) => {
            console.log(`   ${index + 1}. ${error}`);
        });
    }

    // 显示工具调用详情
    if (validation.details.toolCalls && validation.details.toolCalls.length > 0) {
        console.log(`\n🔧 工具调用详情:`);
        validation.details.toolCalls.forEach((tool, index) => {
            console.log(`   ${index + 1}. 工具: ${tool.name}`);
            console.log(`      ID: ${tool.id}`);
            console.log(`      参数: ${JSON.stringify(tool.input, null, 6).replace(/\n/g, '\n      ')}`);
        });
    }

    // 显示部分响应内容
    if (response.data && response.data.content) {
        console.log(`\n📄 响应内容预览:`);
        response.data.content.forEach((block, index) => {
            console.log(`   块 ${index + 1} [${block.type}]:`);
            if (block.type === 'text') {
                const preview = block.text.substring(0, 200);
                console.log(`      ${preview}${block.text.length > 200 ? '...' : ''}`);
            } else if (block.type === 'tool_use') {
                console.log(`      工具: ${block.name}`);
                console.log(`      输入: ${JSON.stringify(block.input, null, 6).replace(/\n/g, '\n      ')}`);
            }
        });
    }

    return validation.success;
}

/**
 * 主测试函数
 */
async function runComprehensiveTest() {
    console.log('🚀 开始OpenAI Provider工具调用综合验证测试');
    console.log(`📡 目标地址: ${CONFIG.baseUrl}`);
    console.log(`⏰ 超时设置: ${CONFIG.timeout}ms`);
    console.log(`🧪 测试场景数: ${CONFIG.testScenarios.length}`);

    const results = {
        total: CONFIG.testScenarios.length,
        passed: 0,
        failed: 0,
        details: []
    };

    for (let i = 0; i < CONFIG.testScenarios.length; i++) {
        const scenario = CONFIG.testScenarios[i];
        console.log(`\n🔄 执行测试 ${i + 1}/${CONFIG.testScenarios.length}: ${scenario.name}`);

        try {
            const startTime = Date.now();
            
            // 构造请求数据
            const requestData = {
                model: "claude-3-5-haiku-20241022",
                max_tokens: 1000,
                messages: [
                    {
                        role: "user",
                        content: scenario.message
                    }
                ]
            };

            // 如果有工具定义，添加到请求中
            if (scenario.tools && scenario.tools.length > 0) {
                requestData.tools = scenario.tools;
            }

            // 发送请求
            const response = await sendRequest(requestData);
            const duration = Date.now() - startTime;

            // 验证响应
            const validation = validateResponse(response, scenario);

            // 格式化显示结果
            const testPassed = formatTestResult(scenario, response, validation, duration);

            // 记录结果
            results.details.push({
                scenario: scenario.name,
                passed: testPassed,
                duration: duration,
                validation: validation
            });

            if (testPassed) {
                results.passed++;
            } else {
                results.failed++;
            }

        } catch (error) {
            console.log(`\n❌ 测试失败: ${error.message}`);
            results.failed++;
            results.details.push({
                scenario: scenario.name,
                passed: false,
                error: error.message
            });
        }

        // 测试间隔，避免频率限制
        if (i < CONFIG.testScenarios.length - 1) {
            console.log('\n⏳ 等待2秒进行下一个测试...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // 显示总结报告
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('📊 综合验证测试总结报告');
    console.log(`${'='.repeat(80)}`);
    console.log(`📈 总测试数: ${results.total}`);
    console.log(`✅ 通过: ${results.passed}`);
    console.log(`❌ 失败: ${results.failed}`);
    console.log(`📊 通过率: ${(results.passed / results.total * 100).toFixed(1)}%`);

    // 显示详细结果
    console.log(`\n📋 详细测试结果:`);
    results.details.forEach((result, index) => {
        const status = result.passed ? '✅' : '❌';
        const duration = result.duration ? `(${result.duration}ms)` : '';
        console.log(`   ${index + 1}. ${status} ${result.scenario} ${duration}`);
        if (result.error) {
            console.log(`      错误: ${result.error}`);
        }
    });

    // 结论
    console.log(`\n🎯 测试结论:`);
    if (results.passed === results.total) {
        console.log('🎉 所有测试通过！OpenAI Provider工具调用功能完全正常。');
    } else if (results.passed > 0) {
        console.log(`⚠️  部分测试通过。${results.passed}/${results.total} 个测试场景工作正常。`);
    } else {
        console.log('🚨 所有测试失败！需要检查系统配置和服务状态。');
    }

    console.log(`\n📅 测试完成时间: ${new Date().toISOString()}`);
    console.log(`🔍 建议查看3456端口日志以获取更多详细信息`);
    
    return results;
}

// 执行测试
if (require.main === module) {
    runComprehensiveTest().catch(error => {
        console.error('测试执行失败:', error);
        process.exit(1);
    });
}

module.exports = { runComprehensiveTest };