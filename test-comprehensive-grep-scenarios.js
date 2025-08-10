#!/usr/bin/env node

/**
 * 全面的grep工具调用场景测试
 * 测试各种grep参数组合的解析情况
 * Project Owner: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');

const LM_STUDIO_PORT = 5506;
const DEBUG_LOG_PATH = '/tmp/comprehensive-grep-debug.log';

// 清理之前的日志
if (fs.existsSync(DEBUG_LOG_PATH)) {
    fs.unlinkSync(DEBUG_LOG_PATH);
}

function log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    if (data) {
        console.log(JSON.stringify(data, null, 2));
        fs.appendFileSync(DEBUG_LOG_PATH, `${logMessage}\n${JSON.stringify(data, null, 2)}\n\n`);
    } else {
        fs.appendFileSync(DEBUG_LOG_PATH, `${logMessage}\n`);
    }
}

const grepTestScenarios = [
    {
        name: "基本模式搜索",
        message: "Search for 'export class' in TypeScript files",
        expectedParams: { pattern: "export class", glob: "*.ts" }
    },
    {
        name: "复杂正则模式",
        message: "Find all function definitions with grep using pattern 'function\\s+\\w+' in JavaScript files",
        expectedParams: { pattern: "function\\s+\\w+", glob: "*.js" }
    },
    {
        name: "特定目录搜索",
        message: "Search for 'import.*logger' in the src directory using grep",
        expectedParams: { pattern: "import.*logger", path: "src" }
    },
    {
        name: "带上下文行的搜索",
        message: "Use grep to search for 'async function' with 2 lines of context in all files",
        expectedParams: { pattern: "async function", "-C": 2 }
    },
    {
        name: "忽略大小写搜索",
        message: "Search case-insensitively for 'ERROR' in log files using grep",
        expectedParams: { pattern: "ERROR", "-i": true, glob: "*.log" }
    }
];

async function testGrepScenario(scenario) {
    log(`🧪 测试场景: ${scenario.name}`);
    
    const requestBody = {
        model: "gpt-oss-20b-mlx",
        messages: [
            {
                role: "user",
                content: scenario.message
            }
        ],
        tools: [
            {
                name: "grep",
                description: "Search for patterns in files",
                input_schema: {
                    type: "object",
                    properties: {
                        pattern: { type: "string", description: "The regex pattern to search for" },
                        glob: { type: "string", description: "File pattern to search in" },
                        path: { type: "string", description: "Directory to search in" },
                        "-i": { type: "boolean", description: "Case insensitive search" },
                        "-C": { type: "number", description: "Lines of context" },
                        "-n": { type: "boolean", description: "Show line numbers" },
                        output_mode: { type: "string", description: "Output mode: content/files_with_matches/count" }
                    },
                    required: ["pattern"]
                }
            }
        ],
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
        
        const hasGrepToolCall = response.data.content?.some(block => 
            block.type === 'tool_use' && block.name === 'grep'
        );
        
        if (hasGrepToolCall) {
            const grepCall = response.data.content.find(block => 
                block.type === 'tool_use' && block.name === 'grep'
            );
            
            log(`✅ 成功: ${scenario.name}`, {
                toolInput: grepCall.input,
                expectedParams: scenario.expectedParams,
                matches: checkParameterMatch(grepCall.input, scenario.expectedParams)
            });
            
            return { success: true, scenario: scenario.name, toolInput: grepCall.input };
        } else {
            // 检查文本响应中的模式
            const textContent = response.data.content?.find(block => block.type === 'text')?.text;
            log(`❌ 失败: ${scenario.name}`, {
                hasTextOnly: !!textContent,
                textPreview: textContent?.substring(0, 200),
                fullResponse: response.data
            });
            
            return { success: false, scenario: scenario.name, textContent };
        }
        
    } catch (error) {
        log(`💥 错误: ${scenario.name}`, {
            error: error.message,
            response: error.response?.data
        });
        
        return { success: false, scenario: scenario.name, error: error.message };
    }
}

function checkParameterMatch(actual, expected) {
    const matches = {};
    for (const [key, expectedValue] of Object.entries(expected)) {
        matches[key] = {
            expected: expectedValue,
            actual: actual[key],
            matches: actual[key] === expectedValue || 
                    (typeof expectedValue === 'string' && actual[key]?.includes?.(expectedValue))
        };
    }
    return matches;
}

async function runAllTests() {
    log('🚀 开始全面的grep工具调用测试');
    
    const results = [];
    
    for (const scenario of grepTestScenarios) {
        const result = await testGrepScenario(scenario);
        results.push(result);
        
        // 短暂延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 统计结果
    const successful = results.filter(r => r.success).length;
    const total = results.length;
    
    log('📊 测试结果统计', {
        successful,
        total,
        successRate: `${((successful / total) * 100).toFixed(1)}%`,
        failures: results.filter(r => !r.success).map(r => r.scenario)
    });
    
    // 保存详细结果
    fs.writeFileSync('/tmp/grep-comprehensive-results.json', JSON.stringify(results, null, 2));
    
    return results;
}

async function main() {
    const results = await runAllTests();
    
    log('📋 详细结果已保存到:');
    log('  - 调试日志: /tmp/comprehensive-grep-debug.log');
    log('  - 结果数据: /tmp/grep-comprehensive-results.json');
    
    // 如果有失败的情况，给出建议
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
        log('⚠️ 发现问题场景，需要进一步优化LMStudio工具解析器');
        failures.forEach(failure => {
            log(`  - ${failure.scenario}: ${failure.error || '工具调用解析失败'}`);
        });
    } else {
        log('🎉 所有grep工具调用场景都成功解析！');
    }
}

main().catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
});