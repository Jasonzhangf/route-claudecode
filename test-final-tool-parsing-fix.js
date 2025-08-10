#!/usr/bin/env node

/**
 * 验证LMStudio工具解析修复最终测试
 * 测试是否彻底解决了LMStudio特殊格式的工具解析问题
 * Project Owner: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');

const LM_STUDIO_PORT = 5506;
const TEST_LOG = '/tmp/final-tool-parsing-test.log';

// 清理之前的日志
if (fs.existsSync(TEST_LOG)) {
    fs.unlinkSync(TEST_LOG);
}

function log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    let output = logMessage + '\n';
    if (data) {
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        console.log(dataStr);
        output += dataStr + '\n';
    }
    output += '\n';
    
    fs.appendFileSync(TEST_LOG, output);
}

const testCases = [
    {
        name: "bash工具调用",
        message: "使用bash运行pwd命令",
        expectedTool: "bash",
        expectedArgs: ["command"]
    },
    {
        name: "grep工具调用", 
        message: "使用grep搜索包含'character'的行",
        expectedTool: "grep",
        expectedArgs: ["pattern"]
    },
    {
        name: "read工具调用",
        message: "读取package.json文件内容",
        expectedTool: "read", 
        expectedArgs: ["file_path"]
    },
    {
        name: "ls工具调用",
        message: "列出当前目录的文件",
        expectedTool: "ls",
        expectedArgs: ["path"]
    }
];

async function testToolCall(testCase) {
    log(`🧪 测试: ${testCase.name}`);
    
    const tools = [
        {
            name: "bash",
            description: "Execute shell commands",
            input_schema: {
                type: "object",
                properties: {
                    command: { type: "string", description: "Shell command to execute" }
                },
                required: ["command"]
            }
        },
        {
            name: "grep",
            description: "Search for patterns in files",
            input_schema: {
                type: "object",
                properties: {
                    pattern: { type: "string", description: "Pattern to search for" },
                    path: { type: "string", description: "Path to search in" },
                    output_mode: { type: "string", description: "Output mode" }
                },
                required: ["pattern"]
            }
        },
        {
            name: "read",
            description: "Read file contents",
            input_schema: {
                type: "object", 
                properties: {
                    file_path: { type: "string", description: "Path to the file to read" }
                },
                required: ["file_path"]
            }
        },
        {
            name: "ls", 
            description: "List directory contents",
            input_schema: {
                type: "object",
                properties: {
                    path: { type: "string", description: "Directory path to list" }
                },
                required: ["path"]
            }
        }
    ];
    
    const requestBody = {
        model: "gpt-oss-20b-mlx",
        messages: [
            {
                role: "user",
                content: testCase.message
            }
        ],
        tools: tools,
        max_tokens: 1024,
        temperature: 0.1
    };
    
    try {
        const response = await axios.post(`http://localhost:${LM_STUDIO_PORT}/v1/messages`, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer any-key'
            }
        });
        
        // 检查响应是否包含LMStudio特殊格式（未解析的格式）
        const responseText = JSON.stringify(response.data);
        const hasUnparsedFormat = responseText.includes('<|start|>assistant<|channel|>commentary to=functions.');
        
        // 检查是否有正确的工具调用
        const hasToolUse = response.data.content?.some(block => 
            block.type === 'tool_use' && block.name === testCase.expectedTool
        );
        
        if (hasUnparsedFormat) {
            log(`❌ FAILED: ${testCase.name} - 仍然包含未解析的LMStudio特殊格式`, {
                unparsedContent: responseText.match(/<\|start\|>assistant.*?<\|message\|>[^}]*\}/)?.[0]?.substring(0, 150)
            });
            return { success: false, reason: 'unparsed_format', testCase: testCase.name };
        }
        
        if (hasToolUse) {
            const toolCall = response.data.content.find(block => 
                block.type === 'tool_use' && block.name === testCase.expectedTool
            );
            
            log(`✅ SUCCESS: ${testCase.name} - 工具调用解析成功`, {
                toolName: toolCall.name,
                toolId: toolCall.id,
                toolInput: toolCall.input,
                stopReason: response.data.stop_reason
            });
            return { success: true, testCase: testCase.name, toolCall };
        }
        
        // 检查是否只是文本响应
        const textContent = response.data.content?.find(block => block.type === 'text')?.text;
        if (textContent) {
            log(`⚠️ TEXT ONLY: ${testCase.name} - 只有文本响应，没有工具调用`, {
                textPreview: textContent.substring(0, 200),
                hasSpecialFormat: textContent.includes('<|start|>')
            });
            return { success: false, reason: 'text_only', testCase: testCase.name, textContent };
        }
        
        log(`❓ UNKNOWN: ${testCase.name} - 未知响应格式`, {
            contentBlocks: response.data.content?.length || 0,
            blockTypes: response.data.content?.map(b => b.type) || []
        });
        return { success: false, reason: 'unknown_format', testCase: testCase.name };
        
    } catch (error) {
        log(`💥 ERROR: ${testCase.name} - 请求失败`, {
            error: error.message,
            status: error.response?.status,
            responseData: error.response?.data
        });
        return { success: false, reason: 'request_error', testCase: testCase.name, error: error.message };
    }
}

async function runAllTests() {
    log('🚀 开始最终工具解析修复验证测试');
    log(`📋 测试服务: http://localhost:${LM_STUDIO_PORT}`);
    
    const results = [];
    
    for (const testCase of testCases) {
        const result = await testToolCall(testCase);
        results.push(result);
        
        // 短暂延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 统计结果
    const successful = results.filter(r => r.success).length;
    const total = results.length;
    const failed = results.filter(r => !r.success);
    
    log('📊 最终测试结果', {
        total,
        successful,
        failed: failed.length,
        successRate: `${((successful / total) * 100).toFixed(1)}%`
    });
    
    if (failed.length > 0) {
        log('❌ 失败测试详情');
        failed.forEach(failure => {
            log(`  - ${failure.testCase}: ${failure.reason}`);
        });
    }
    
    // 保存结果
    fs.writeFileSync('/tmp/final-tool-parsing-results.json', JSON.stringify(results, null, 2));
    
    if (successful === total) {
        log('🎉 所有工具调用测试通过！LMStudio特殊格式解析问题已完全解决！');
    } else if (successful > 0) {
        log(`⚠️ 部分测试成功 (${successful}/${total})，仍需进一步优化`);
    } else {
        log('🚨 所有测试失败，问题仍未解决');
    }
    
    return results;
}

async function main() {
    const results = await runAllTests();
    
    log('📋 详细结果保存位置:');
    log(`  - 测试日志: ${TEST_LOG}`);
    log('  - 结果数据: /tmp/final-tool-parsing-results.json');
    
    process.exit(results.filter(r => r.success).length === results.length ? 0 : 1);
}

main().catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
});