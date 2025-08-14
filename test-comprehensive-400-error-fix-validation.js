#!/usr/bin/env node

/**
 * Comprehensive 400 Error Fix Validation Test
 * 
 * 验证通用OpenAI兼容性修复机制是否能解决实际API 400错误
 * 
 * 测试内容：
 * 1. 验证tools格式问题修复
 * 2. 验证messages content格式问题修复
 * 3. 验证Mixed format tools处理
 * 4. 端到端API调用验证
 * 
 * Author: Jason Zhang
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Comprehensive 400 Error Fix Validation Test');
console.log('==============================================');

// 测试配置
const TEST_PORTS = {
    SHUAIHONG: 5508,
    MODELSCOPE_GLM: 5509
};

const TIMEOUT = 60000; // 60秒超时

let testResults = {
    timestamp: new Date().toISOString(),
    testName: 'Comprehensive 400 Error Fix Validation',
    tests: {},
    summary: {
        total: 0,
        passed: 0,
        failed: 0
    }
};

// 测试用例数据 - 模拟实际会导致400错误的请求
const testCases = [
    {
        name: 'Tools Format Mixed - Anthropic + OpenAI',
        provider: 'shuaihong',
        port: TEST_PORTS.SHUAIHONG,
        request: {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            messages: [{
                role: "user", 
                content: "Search for files and then write a summary"
            }],
            tools: [
                // 正确的OpenAI格式
                {
                    type: "function",
                    function: {
                        name: "search_files",
                        description: "Search for files",
                        parameters: {
                            type: "object",
                            properties: {
                                pattern: { type: "string", description: "Search pattern" }
                            },
                            required: ["pattern"]
                        }
                    }
                },
                // 错误：混合格式 - 同时有name和function
                {
                    name: "write_file",
                    type: "function", 
                    function: {
                        name: "write_file_func",
                        description: "Write file content",
                        parameters: { type: "object", properties: {} }
                    },
                    input_schema: { type: "object", properties: {} }
                }
            ]
        },
        expectedIssues: ['Mixed format tools'],
        shouldBeFixed: true
    },
    {
        name: 'Messages Content Object Format Error',
        provider: 'modelscope-glm',
        port: TEST_PORTS.MODELSCOPE_GLM,
        request: {
            model: "ZhipuAI/GLM-4.5-Air",
            max_tokens: 800,
            messages: [{
                role: "user",
                // 错误：content应该是string或array，但这里是object
                content: {
                    type: "text",
                    text: "Hello, please help me search for files"
                }
            }]
        },
        expectedIssues: ['Message content object format'],
        shouldBeFixed: true
    },
    {
        name: 'Tools Array with Invalid Elements',
        provider: 'shuaihong', 
        port: TEST_PORTS.SHUAIHONG,
        request: {
            model: "gpt-4o-mini",
            max_tokens: 500,
            messages: [{
                role: "user",
                content: "Use tools to help me"
            }],
            tools: [
                // 正确的工具
                {
                    type: "function",
                    function: {
                        name: "valid_tool",
                        description: "A valid tool",
                        parameters: { type: "object", properties: {} }
                    }
                },
                // 错误：字符串而不是对象
                "invalid_string_tool",
                // 错误：缺少必要字段
                {
                    description: "Tool without name or function"
                }
            ]
        },
        expectedIssues: ['Invalid tool elements', 'Missing required fields'],
        shouldBeFixed: true
    }
];

// 清理函数
function cleanup(processes = []) {
    console.log('\n🧹 清理测试环境');
    
    processes.forEach(proc => {
        if (proc && !proc.killed) {
            try {
                process.kill(proc.pid, 'SIGTERM');
                setTimeout(() => {
                    if (!proc.killed) {
                        process.kill(proc.pid, 'SIGKILL');
                    }
                }, 2000);
            } catch (e) {
                // 进程可能已停止
            }
        }
    });
    
    // 清理测试端口
    Object.values(TEST_PORTS).forEach(port => {
        try {
            execSync(`lsof -ti :${port} | xargs kill -9`, { stdio: 'ignore' });
        } catch (e) {
            // 端口可能没有被占用
        }
    });
}

// 启动服务
async function startService(port, configName) {
    console.log(`\n🚀 启动端口 ${port} 服务 (${configName})`);
    
    const configPath = `~/.route-claude-code/config/single-provider/config-${configName}.json`.replace('~', process.env.HOME);
    
    if (!fs.existsSync(configPath)) {
        throw new Error(`配置文件不存在: ${configPath}`);
    }
    
    const serverProcess = spawn('node', ['dist/cli.js', 'start', `--config=${configPath}`, '--debug'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env }
    });
    
    let serverOutput = '';
    serverProcess.stdout.on('data', (data) => {
        serverOutput += data.toString();
    });
    serverProcess.stderr.on('data', (data) => {
        serverOutput += data.toString();
    });
    
    // 等待服务启动
    console.log('⏳ 等待服务启动...');
    let retries = 20;
    while (retries > 0) {
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const result = execSync(`curl -s http://127.0.0.1:${port}/health`, { timeout: 2000 });
            console.log(`✅ 端口 ${port} 服务启动成功`);
            return { process: serverProcess, output: serverOutput };
        } catch (e) {
            retries--;
            if (retries === 0) {
                throw new Error(`端口 ${port} 服务启动超时`);
            }
        }
    }
}

// 执行API测试调用
async function testApiCall(testCase, serverInfo) {
    console.log(`\n🧪 测试: ${testCase.name}`);
    console.log(`🎯 提供商: ${testCase.provider}, 端口: ${testCase.port}`);
    
    const result = {
        testCase: testCase.name,
        provider: testCase.provider,
        port: testCase.port,
        success: false,
        apiCallMade: false,
        formatFixed: false,
        errors: [],
        details: {}
    };
    
    try {
        // 创建临时测试文件
        const tempRequest = `/tmp/test-request-${testCase.port}-${Date.now()}.json`;
        fs.writeFileSync(tempRequest, JSON.stringify(testCase.request, null, 2));
        
        console.log('📋 请求数据已准备:', {
            model: testCase.request.model,
            toolsCount: testCase.request.tools?.length || 0,
            messagesCount: testCase.request.messages?.length || 0
        });
        
        // 使用curl进行API测试
        const curlCommand = `curl -s -X POST http://127.0.0.1:${testCase.port}/v1/messages \\
            -H "Content-Type: application/json" \\
            -H "Authorization: Bearer test-key" \\
            -H "anthropic-version: 2023-06-01" \\
            -d @${tempRequest} \\
            --connect-timeout 10 \\
            --max-time 30`;
        
        console.log('📡 发送API请求...');
        
        let apiResponse = '';
        let apiError = null;
        
        try {
            apiResponse = execSync(curlCommand, { 
                timeout: TIMEOUT,
                encoding: 'utf8'
            });
            result.apiCallMade = true;
            console.log('✅ API调用成功发送');
            
            // 检查响应是否包含400错误
            if (apiResponse.includes('"status":400') || 
                apiResponse.includes('Invalid type for') ||
                apiResponse.includes('expected one of a string or array of objects')) {
                result.errors.push('API returned 400 error - format issues not fixed');
                console.log('❌ API返回400错误 - 格式问题未修复');
            } else if (apiResponse.includes('"type":"message"') || 
                      apiResponse.includes('"role":"assistant"') ||
                      apiResponse.includes('tool_use')) {
                result.formatFixed = true;
                result.success = true;
                console.log('✅ API调用成功 - 格式问题已修复');
            } else {
                console.log('⚠️ API响应格式无法确定');
                result.details.response = apiResponse.substring(0, 200);
            }
            
        } catch (error) {
            apiError = error.toString();
            result.errors.push(`API call failed: ${error.message}`);
            console.log('❌ API调用失败:', error.message);
        }
        
        // 检查服务器日志中的修复信息
        if (serverInfo.output) {
            if (serverInfo.output.includes('UNIVERSAL-FIX') || 
                serverInfo.output.includes('Fixed mixed format tool') ||
                serverInfo.output.includes('Fixed message content')) {
                result.formatFixed = true;
                console.log('✅ 检测到格式修复日志');
            }
        }
        
        result.details.serverOutput = serverInfo.output ? serverInfo.output.substring(0, 500) : null;
        result.details.apiResponse = apiResponse ? apiResponse.substring(0, 300) : null;
        result.details.apiError = apiError;
        
        // 清理临时文件
        try {
            fs.unlinkSync(tempRequest);
        } catch (e) {
            // 忽略清理错误
        }
        
    } catch (error) {
        result.errors.push(`Test execution failed: ${error.message}`);
        console.log('💥 测试执行失败:', error.message);
    }
    
    return result;
}

// 主测试函数
async function runComprehensiveTest() {
    const runningProcesses = [];
    
    try {
        console.log('🔬 开始综合API 400错误修复验证');
        
        // Step 1: 启动必要的服务
        const shuaihongService = await startService(TEST_PORTS.SHUAIHONG, 'openai-shuaihong-5508');
        runningProcesses.push(shuaihongService.process);
        
        const glmService = await startService(TEST_PORTS.MODELSCOPE_GLM, 'openai-sdk-modelscope-glm-5509');
        runningProcesses.push(glmService.process);
        
        // 等待服务稳定
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Step 2: 执行测试用例
        console.log('\n🧪 开始执行测试用例');
        
        for (const testCase of testCases) {
            const serverInfo = testCase.port === TEST_PORTS.SHUAIHONG ? shuaihongService : glmService;
            const result = await testApiCall(testCase, serverInfo);
            
            testResults.tests[testCase.name] = result;
            testResults.summary.total++;
            
            if (result.success || result.formatFixed) {
                testResults.summary.passed++;
                console.log(`✅ ${testCase.name}: 通过`);
            } else {
                testResults.summary.failed++;
                console.log(`❌ ${testCase.name}: 失败`);
            }
            
            // 测试间隔
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Step 3: 生成最终报告
        console.log('\n📊 生成测试报告');
        
        const successRate = (testResults.summary.passed / testResults.summary.total * 100).toFixed(1);
        console.log('\n🎯 测试结果总览:');
        console.log(`   总测试数: ${testResults.summary.total}`);
        console.log(`   通过数: ${testResults.summary.passed}`);
        console.log(`   失败数: ${testResults.summary.failed}`); 
        console.log(`   成功率: ${successRate}%`);
        
        // 保存详细报告
        const reportFile = `test-comprehensive-400-fix-validation-${Date.now()}.json`;
        fs.writeFileSync(reportFile, JSON.stringify(testResults, null, 2));
        console.log(`📁 详细测试报告: ${reportFile}`);
        
        const overallSuccess = successRate >= 80;
        
        if (overallSuccess) {
            console.log('\n🎉 测试成功：API 400错误修复机制工作正常');
            console.log('✅ 通用OpenAI兼容性修复能够处理tools和messages格式问题');
            return true;
        } else {
            console.log('\n❌ 测试失败：API 400错误修复需要进一步改进');
            return false;
        }
        
    } catch (error) {
        console.error('\n💥 综合测试执行失败:', error.message);
        testResults.summary.failed = testResults.summary.total;
        return false;
    } finally {
        cleanup(runningProcesses);
    }
}

// 主函数
async function main() {
    const success = await runComprehensiveTest();
    process.exit(success ? 0 : 1);
}

// 处理进程退出
process.on('SIGINT', () => cleanup());
process.on('SIGTERM', () => cleanup());

// 执行测试
if (require.main === module) {
    main();
}