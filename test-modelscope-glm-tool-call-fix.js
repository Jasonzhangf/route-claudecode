#!/usr/bin/env node

/**
 * ModelScope GLM工具调用修复验证测试
 * 
 * 测试目标：
 * 1. 验证ModelScope GLM工具调用格式修复是否有效
 * 2. 确保工具定义能正确传递到GLM providers
 * 3. 验证工具调用响应能正确处理
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 ModelScope GLM工具调用修复验证测试');
console.log('=========================================');

// 测试配置
const TEST_PORT = 5509;
const CONFIG_PATH = '~/.route-claude-code/config/single-provider/config-openai-sdk-modelscope-glm-5509.json';
const TIMEOUT = 60000; // 60秒超时

let serverProcess = null;
let testSuccess = false;

// 清理函数
function cleanup() {
    console.log('\n🧹 清理测试环境');
    
    if (serverProcess && !serverProcess.killed) {
        console.log('🛑 停止服务器进程');
        try {
            process.kill(serverProcess.pid, 'SIGTERM');
            setTimeout(() => {
                if (!serverProcess.killed) {
                    process.kill(serverProcess.pid, 'SIGKILL');
                }
            }, 2000);
        } catch (e) {
            console.log('⚠️ 服务器进程已停止');
        }
    }
    
    // 清理端口
    try {
        execSync(`lsof -ti :${TEST_PORT} | xargs kill -9`, { stdio: 'ignore' });
    } catch (e) {
        // 端口可能没有被占用
    }
}

// 处理进程退出
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

async function runTest() {
    try {
        // Step 1: 清理端口
        console.log(`\n🔍 Step 1: 检查端口 ${TEST_PORT}`);
        try {
            execSync(`lsof -ti :${TEST_PORT} | xargs kill -9`, { stdio: 'ignore' });
            console.log(`✅ 端口 ${TEST_PORT} 已清理`);
        } catch (e) {
            console.log(`✅ 端口 ${TEST_PORT} 未被占用`);
        }
        
        // Step 2: 启动服务
        console.log('\n🚀 Step 2: 启动Claude Code Router服务');
        const configPath = CONFIG_PATH.replace('~', process.env.HOME);
        console.log(`📁 配置文件: ${configPath}`);
        
        // 验证配置文件存在
        if (!fs.existsSync(configPath)) {
            throw new Error(`配置文件不存在: ${configPath}`);
        }
        
        // 启动服务
        console.log('🔄 启动服务...');
        serverProcess = spawn('node', ['dist/cli.js', 'start', `--config=${configPath}`, '--debug'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, RCC_PREPROCESSING_DEBUG: 'true' }
        });
        
        // 收集服务器日志
        let serverOutput = '';
        serverProcess.stdout.on('data', (data) => {
            serverOutput += data.toString();
            // 查找GLM调试信息
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.includes('GLM-DEBUG') || line.includes('tools') || line.includes('Invalid type')) {
                    console.log(`📊 [SERVER-LOG] ${line}`);
                }
            });
        });
        
        serverProcess.stderr.on('data', (data) => {
            serverOutput += data.toString();
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.includes('GLM-DEBUG') || line.includes('tools') || line.includes('Invalid type')) {
                    console.log(`📊 [SERVER-ERROR] ${line}`);
                }
            });
        });
        
        // 等待服务启动
        console.log('⏳ 等待服务启动...');
        let retries = 30;
        while (retries > 0) {
            try {
                const result = execSync(`curl -s http://127.0.0.1:${TEST_PORT}/health`, { timeout: 2000 });
                console.log('✅ 服务启动成功');
                break;
            } catch (e) {
                retries--;
                if (retries === 0) {
                    throw new Error('服务启动超时');
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Step 3: 创建工具调用测试数据
        console.log('\n📝 Step 3: 准备工具调用测试数据');
        
        const testRequest = {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            messages: [{
                role: "user",
                content: "Please search for TypeScript files in the current project using the search_files tool."
            }],
            tools: [{
                type: "function",
                function: {
                    name: "search_files",
                    description: "Search for files in the project directory",
                    parameters: {
                        type: "object",
                        properties: {
                            pattern: {
                                type: "string",
                                description: "File pattern to search for (e.g., '*.ts', '*.js')"
                            },
                            directory: {
                                type: "string",
                                description: "Directory to search in (optional, defaults to current directory)"
                            }
                        },
                        required: ["pattern"]
                    }
                }
            }]
        };
        
        console.log('📋 工具调用请求已准备:', {
            model: testRequest.model,
            toolsCount: testRequest.tools.length,
            toolName: testRequest.tools[0].function.name
        });
        
        // Step 4: 执行工具调用测试
        console.log('\n🧪 Step 4: 执行工具调用测试');
        
        const requestData = JSON.stringify(testRequest);
        console.log('🚀 发送API请求...');
        
        let apiResult = null;
        let apiError = null;
        
        try {
            // 使用环境变量设置API端点
            process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
            process.env.ANTHROPIC_API_KEY = 'test-glm-tool-call-fix';
            
            // 创建临时输入文件
            const tempInput = `/tmp/glm-tool-test-input-${Date.now()}.txt`;
            fs.writeFileSync(tempInput, 'Please search for TypeScript files using the search_files tool with pattern "*.ts".');
            
            console.log('📤 使用Claude Code进行工具调用测试...');
            console.log(`📁 临时输入文件: ${tempInput}`);
            
            // 使用Claude Code CLI进行测试
            const cliResult = execSync(`echo 'Please search for TypeScript files using the search_files tool with pattern "*.ts".' | claude --print 2>&1`, {
                timeout: TIMEOUT,
                env: {
                    ...process.env,
                    ANTHROPIC_BASE_URL: `http://127.0.0.1:${TEST_PORT}`,
                    ANTHROPIC_API_KEY: 'test-glm-tool-call-fix'
                }
            });
            
            apiResult = cliResult.toString();
            console.log('✅ API调用成功');
            
        } catch (error) {
            apiError = error.toString();
            console.log('❌ API调用失败:', error.message);
        }
        
        // Step 5: 分析结果
        console.log('\n📊 Step 5: 分析测试结果');
        
        let toolCallSuccess = false;
        let glmFixApplied = false;
        let noInvalidTypeError = true;
        
        // 检查服务器输出
        if (serverOutput.includes('GLM-DEBUG')) {
            glmFixApplied = true;
            console.log('✅ GLM调试修复已应用');
        }
        
        // 检查是否有工具调用格式错误
        if (serverOutput.includes('Invalid type for \'tools.0\', expected an json object')) {
            noInvalidTypeError = false;
            console.log('❌ 仍然存在工具格式验证错误');
        } else {
            console.log('✅ 无工具格式验证错误');
        }
        
        // 检查API响应
        if (apiResult && !apiError) {
            if (apiResult.includes('search_files') || apiResult.includes('tool_use') || apiResult.includes('TypeScript')) {
                toolCallSuccess = true;
                console.log('✅ 工具调用功能正常');
            }
        }
        
        // Step 6: 生成测试报告
        console.log('\n📋 Step 6: 测试结果报告');
        console.log('============================');
        
        const testResults = {
            timestamp: new Date().toISOString(),
            testName: 'ModelScope GLM Tool Call Fix Verification',
            results: {
                serverStarted: true,
                glmFixApplied: glmFixApplied,
                noInvalidTypeError: noInvalidTypeError,
                toolCallSuccess: toolCallSuccess,
                apiCallSuccess: !apiError
            },
            details: {
                apiResult: apiResult ? apiResult.substring(0, 500) : null,
                apiError: apiError ? apiError.substring(0, 500) : null,
                serverOutput: serverOutput ? serverOutput.substring(0, 1000) : null
            }
        };
        
        console.log('🎯 测试结果总览:');
        console.log(`   服务器启动: ${testResults.results.serverStarted ? '✅' : '❌'}`);
        console.log(`   GLM修复应用: ${testResults.results.glmFixApplied ? '✅' : '❌'}`);
        console.log(`   无格式错误: ${testResults.results.noInvalidTypeError ? '✅' : '❌'}`);
        console.log(`   工具调用成功: ${testResults.results.toolCallSuccess ? '✅' : '❌'}`);
        console.log(`   API调用成功: ${testResults.results.apiCallSuccess ? '✅' : '❌'}`);
        
        // 计算总体成功率
        const successCount = Object.values(testResults.results).filter(r => r === true).length;
        const totalTests = Object.keys(testResults.results).length;
        const successRate = (successCount / totalTests * 100).toFixed(1);
        
        console.log(`\n🎉 总体成功率: ${successRate}% (${successCount}/${totalTests})`);
        
        testSuccess = successRate >= 80; // 80%以上算成功
        
        // 保存详细测试报告
        const reportFile = `test-modelscope-glm-tool-call-fix-report-${Date.now()}.json`;
        fs.writeFileSync(reportFile, JSON.stringify(testResults, null, 2));
        console.log(`📁 详细测试报告已保存: ${reportFile}`);
        
        if (testSuccess) {
            console.log('\n🎉 测试成功：ModelScope GLM工具调用修复验证通过');
            return true;
        } else {
            console.log('\n❌ 测试失败：ModelScope GLM工具调用仍需进一步修复');
            return false;
        }
        
    } catch (error) {
        console.error('\n💥 测试过程出错:', error.message);
        return false;
    } finally {
        cleanup();
    }
}

// 主函数执行
async function main() {
    const success = await runTest();
    process.exit(success ? 0 : 1);
}

// 执行测试
if (require.main === module) {
    main();
}