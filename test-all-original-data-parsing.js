#!/usr/bin/env node

/**
 * 测试本地所有原始数据解析验证
 * 确保100%工具调用解析成功率
 * Project Owner: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const LM_STUDIO_PORT = 5506;
const TEST_LOG = '/tmp/all-original-data-parsing-test.log';

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

// 全面的工具调用测试用例 - 覆盖所有原始数据场景
const comprehensiveTestCases = [
    // 基础工具调用
    {
        category: "基础命令",
        name: "bash-pwd",
        message: "使用bash运行pwd命令",
        expectedTool: "bash",
        priority: "高"
    },
    {
        category: "基础命令", 
        name: "bash-ls",
        message: "执行ls命令查看当前目录",
        expectedTool: "bash",
        priority: "高"
    },
    
    // grep搜索功能 - 多种表达方式
    {
        category: "搜索功能",
        name: "grep-character",
        message: "使用grep搜索包含'character'的行",
        expectedTool: "grep",
        priority: "高"
    },
    {
        category: "搜索功能",
        name: "grep-pattern", 
        message: "搜索包含'function'的文件内容",
        expectedTool: "grep",
        priority: "高"
    },
    {
        category: "搜索功能",
        name: "grep-case-insensitive",
        message: "忽略大小写搜索'ERROR'在日志文件中",
        expectedTool: "grep", 
        priority: "高"
    },
    
    // 文件操作
    {
        category: "文件操作",
        name: "read-package-json",
        message: "读取package.json文件内容",
        expectedTool: "read",
        priority: "高"
    },
    {
        category: "文件操作", 
        name: "read-config-file",
        message: "查看配置文件的内容",
        expectedTool: "read",
        priority: "中"
    },
    
    // 目录操作
    {
        category: "目录操作",
        name: "ls-current-dir",
        message: "列出当前目录的文件",
        expectedTool: "ls",
        priority: "高"
    },
    {
        category: "目录操作",
        name: "ls-src-directory", 
        message: "显示src目录下的文件",
        expectedTool: "ls",
        priority: "高"
    },
    
    // 文件创建和编辑
    {
        category: "文件管理",
        name: "write-new-file",
        message: "创建一个新的测试文件",
        expectedTool: "write",
        priority: "中"
    },
    {
        category: "文件管理",
        name: "edit-existing-file",
        message: "修改现有文件的内容",
        expectedTool: "edit", 
        priority: "中"
    },
    
    // 高级搜索和操作
    {
        category: "高级操作",
        name: "grep-with-context",
        message: "使用grep搜索'async function'并显示上下文",
        expectedTool: "grep",
        priority: "高"
    },
    {
        category: "高级操作",
        name: "bash-complex-command",
        message: "执行复杂的shell命令组合",
        expectedTool: "bash",
        priority: "中"
    },
    
    // 边界条件测试
    {
        category: "边界测试",
        name: "chinese-only-instruction",
        message: "查找包含错误信息的日志行",
        expectedTool: "grep",
        priority: "高"
    },
    {
        category: "边界测试",
        name: "mixed-language",
        message: "Please search for 'import' statements in TypeScript files using grep",
        expectedTool: "grep",
        priority: "中"
    }
];

const commonTools = [
    {
        name: "bash",
        description: "Execute shell commands",
        input_schema: {
            type: "object",
            properties: {
                command: { type: "string", description: "Shell command to execute" },
                description: { type: "string", description: "Description of what the command does" }
            },
            required: ["command"]
        }
    },
    {
        name: "grep",
        description: "Search for patterns in files using ripgrep",
        input_schema: {
            type: "object",
            properties: {
                pattern: { type: "string", description: "The regex pattern to search for" },
                path: { type: "string", description: "Directory or file to search in" },
                glob: { type: "string", description: "File pattern to match (e.g., '*.ts')" },
                output_mode: { type: "string", description: "Output mode: content/files_with_matches/count" },
                "-i": { type: "boolean", description: "Case insensitive search" },
                "-C": { type: "number", description: "Lines of context to show" },
                "-n": { type: "boolean", description: "Show line numbers" }
            },
            required: ["pattern"]
        }
    },
    {
        name: "read",
        description: "Read file contents from the filesystem",
        input_schema: {
            type: "object", 
            properties: {
                file_path: { type: "string", description: "Absolute path to the file to read" },
                limit: { type: "number", description: "Number of lines to read" },
                offset: { type: "number", description: "Starting line number" }
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
                path: { type: "string", description: "Directory path to list (must be absolute)" },
                ignore: { type: "array", items: { type: "string" }, description: "Glob patterns to ignore" }
            },
            required: ["path"]
        }
    },
    {
        name: "write",
        description: "Write content to a file",
        input_schema: {
            type: "object",
            properties: {
                file_path: { type: "string", description: "Absolute path to write the file" },
                content: { type: "string", description: "Content to write to the file" }
            },
            required: ["file_path", "content"]
        }
    },
    {
        name: "edit",
        description: "Edit existing files with string replacement",
        input_schema: {
            type: "object",
            properties: {
                file_path: { type: "string", description: "Absolute path to the file to edit" },
                old_string: { type: "string", description: "String to replace" },
                new_string: { type: "string", description: "Replacement string" },
                replace_all: { type: "boolean", description: "Replace all occurrences" }
            },
            required: ["file_path", "old_string", "new_string"]
        }
    }
];

async function testSingleCase(testCase) {
    log(`🧪 [${testCase.category}] 测试: ${testCase.name} (优先级: ${testCase.priority})`);
    log(`📝 测试消息: "${testCase.message}"`);
    
    const requestBody = {
        model: "gpt-oss-20b-mlx",
        messages: [
            {
                role: "user",
                content: testCase.message
            }
        ],
        tools: commonTools,
        max_tokens: 1024,
        temperature: 0.1
    };
    
    try {
        const startTime = Date.now();
        const response = await axios.post(`http://localhost:${LM_STUDIO_PORT}/v1/messages`, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer any-key'
            },
            timeout: 30000 // 30秒超时
        });
        const responseTime = Date.now() - startTime;
        
        // 详细分析响应
        const analysis = analyzeResponse(response.data, testCase);
        
        log(`📊 测试结果 (${responseTime}ms)`, {
            testCase: testCase.name,
            expectedTool: testCase.expectedTool,
            actualResult: analysis.result,
            success: analysis.success,
            details: analysis.details
        });
        
        return {
            testCase: testCase.name,
            category: testCase.category,
            priority: testCase.priority,
            expectedTool: testCase.expectedTool,
            success: analysis.success,
            result: analysis.result,
            details: analysis.details,
            responseTime
        };
        
    } catch (error) {
        const errorDetails = {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            timeout: error.code === 'ECONNABORTED'
        };
        
        log(`💥 测试失败: ${testCase.name}`, errorDetails);
        
        return {
            testCase: testCase.name,
            category: testCase.category,
            priority: testCase.priority,
            expectedTool: testCase.expectedTool,
            success: false,
            result: 'error',
            error: errorDetails,
            responseTime: 0
        };
    }
}

function analyzeResponse(responseData, testCase) {
    // 检查是否包含未解析的LMStudio特殊格式
    const responseText = JSON.stringify(responseData);
    const hasUnparsedFormat = responseText.includes('<|start|>assistant<|channel|>commentary to=functions.');
    
    if (hasUnparsedFormat) {
        const unparsedMatch = responseText.match(/<\|start\|>assistant.*?<\|message\|>[^}]*\}/)?.[0];
        return {
            success: false,
            result: 'unparsed_format',
            details: {
                reason: '包含未解析的LMStudio特殊格式',
                sample: unparsedMatch?.substring(0, 150) + '...'
            }
        };
    }
    
    // 检查是否有正确的工具调用
    const toolUseBlocks = responseData.content?.filter(block => block.type === 'tool_use') || [];
    const correctToolCall = toolUseBlocks.find(block => block.name === testCase.expectedTool);
    
    if (correctToolCall) {
        return {
            success: true,
            result: 'tool_call_success',
            details: {
                toolName: correctToolCall.name,
                toolId: correctToolCall.id,
                toolInput: correctToolCall.input,
                stopReason: responseData.stop_reason,
                totalToolCalls: toolUseBlocks.length
            }
        };
    }
    
    // 检查是否有其他工具调用
    if (toolUseBlocks.length > 0) {
        return {
            success: false,
            result: 'wrong_tool_called',
            details: {
                expectedTool: testCase.expectedTool,
                actualTools: toolUseBlocks.map(block => block.name),
                reason: '调用了错误的工具'
            }
        };
    }
    
    // 检查是否只是文本响应
    const textBlocks = responseData.content?.filter(block => block.type === 'text') || [];
    if (textBlocks.length > 0) {
        const textContent = textBlocks.map(block => block.text).join(' ');
        return {
            success: false,
            result: 'text_only_response',
            details: {
                reason: '只返回文本，未调用工具',
                textPreview: textContent.substring(0, 200) + (textContent.length > 200 ? '...' : ''),
                textLength: textContent.length
            }
        };
    }
    
    return {
        success: false,
        result: 'unknown_format',
        details: {
            reason: '未知的响应格式',
            contentBlocks: responseData.content?.length || 0,
            blockTypes: responseData.content?.map(b => b.type) || []
        }
    };
}

async function runComprehensiveTest() {
    log('🚀 开始全面原始数据解析验证测试');
    log(`📋 测试目标: 100%工具调用解析成功率`);
    log(`🔧 测试服务: http://localhost:${LM_STUDIO_PORT}`);
    log(`📊 测试用例数量: ${comprehensiveTestCases.length}`);
    
    // 按优先级分组测试
    const highPriorityTests = comprehensiveTestCases.filter(tc => tc.priority === '高');
    const mediumPriorityTests = comprehensiveTestCases.filter(tc => tc.priority === '中');
    
    log(`🎯 高优先级测试: ${highPriorityTests.length} 个`);
    log(`📋 中优先级测试: ${mediumPriorityTests.length} 个`);
    
    const allResults = [];
    
    // 执行高优先级测试
    log('\n=== 🎯 执行高优先级测试 ===');
    for (const testCase of highPriorityTests) {
        const result = await testSingleCase(testCase);
        allResults.push(result);
        
        // 高优先级测试失败立即报告
        if (!result.success && testCase.priority === '高') {
            log(`🚨 高优先级测试失败: ${testCase.name}`);
        }
        
        // 短暂延迟避免过载
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // 执行中优先级测试
    log('\n=== 📋 执行中优先级测试 ===');
    for (const testCase of mediumPriorityTests) {
        const result = await testSingleCase(testCase);
        allResults.push(result);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 生成详细报告
    const report = generateComprehensiveReport(allResults);
    log('\n=== 📊 最终测试报告 ===', report.summary);
    
    // 保存详细结果
    fs.writeFileSync('/tmp/all-original-data-parsing-results.json', JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: report.summary,
        details: allResults,
        categories: report.categories
    }, null, 2));
    
    if (report.summary.successRate === 100) {
        log('🎉 所有原始数据解析测试通过！100%工具调用兼容性达成！');
    } else {
        log(`⚠️ 成功率: ${report.summary.successRate}% - 需要进一步优化`);
        log('❌ 失败的测试用例:', report.failures);
    }
    
    return report;
}

function generateComprehensiveReport(results) {
    const total = results.length;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success);
    
    // 按类别分组统计
    const categories = {};
    results.forEach(result => {
        if (!categories[result.category]) {
            categories[result.category] = { total: 0, successful: 0, failed: 0 };
        }
        categories[result.category].total++;
        if (result.success) {
            categories[result.category].successful++;
        } else {
            categories[result.category].failed++;
        }
    });
    
    // 按失败原因分组
    const failureReasons = {};
    failed.forEach(failure => {
        const reason = failure.result;
        if (!failureReasons[reason]) {
            failureReasons[reason] = [];
        }
        failureReasons[reason].push(failure.testCase);
    });
    
    const avgResponseTime = results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / total;
    
    return {
        summary: {
            total,
            successful,
            failed: failed.length,
            successRate: Math.round((successful / total) * 100),
            avgResponseTime: Math.round(avgResponseTime)
        },
        categories,
        failureReasons,
        failures: failed.map(f => ({
            name: f.testCase,
            category: f.category,
            priority: f.priority,
            reason: f.result,
            details: f.details?.reason || f.error?.message
        }))
    };
}

async function main() {
    try {
        const report = await runComprehensiveTest();
        
        log('\n📋 详细结果保存位置:');
        log(`  - 测试日志: ${TEST_LOG}`);
        log('  - 结果数据: /tmp/all-original-data-parsing-results.json');
        
        // 退出码：100%成功返回0，否则返回1
        process.exit(report.summary.successRate === 100 ? 0 : 1);
        
    } catch (error) {
        log('❌ 测试执行出现严重错误', error);
        process.exit(2);
    }
}

main();