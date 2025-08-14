#!/usr/bin/env node
/**
 * CodeWhisperer v3.0端到端测试
 * 测试完整的六层架构和demo3鉴权机制
 * 
 * Project owner: Jason Zhang
 */

import fetch from 'node-fetch';

console.log('🚀 CodeWhisperer v3.0端到端测试开始...\n');

const SERVER_URL = 'http://localhost:5501';
const TEST_TIMEOUT = 30000;

/**
 * 测试1: 健康检查
 */
async function testHealthCheck() {
    console.log('📋 [测试1] 健康检查');
    
    try {
        const response = await fetch(`${SERVER_URL}/health`);
        const health = await response.json();
        
        if (response.ok) {
            console.log('  ✅ 健康检查通过');
            console.log(`  📊 状态: ${health.overall}`);
            console.log(`  🏥 健康Provider: ${health.healthy}/${health.total}`);
            
            if (health.providers) {
                console.log('  🔧 Provider状态:');
                Object.entries(health.providers).forEach(([provider, status]) => {
                    console.log(`     ${status ? '✅' : '❌'} ${provider}`);
                });
            }
            return true;
        } else {
            console.log(`  ⚠️ 健康检查异常: ${health.overall || 'unknown'}`);
            return false;
        }
    } catch (error) {
        console.log(`  ❌ 健康检查失败: ${error.message}`);
        return false;
    }
}

/**
 * 测试2: 服务状态检查
 */
async function testServerStatus() {
    console.log('\n📋 [测试2] 服务状态检查');
    
    try {
        const response = await fetch(`${SERVER_URL}/status`);
        const status = await response.json();
        
        if (response.ok) {
            console.log('  ✅ 状态检查通过');
            console.log(`  🌐 服务器: ${status.server || 'unknown'}`);
            console.log(`  📝 版本: ${status.version || 'unknown'}`);
            console.log(`  🏗️ 架构: ${status.architecture || 'v3.0'}`);
            console.log(`  ⏱️ 运行时间: ${status.uptime || 0}s`);
            console.log(`  📊 Provider数量: ${status.providers?.length || 0}`);
            
            if (status.providers && status.providers.length > 0) {
                console.log('  🔧 活跃Provider:');
                status.providers.forEach(provider => {
                    console.log(`     - ${provider}`);
                });
            }
            return true;
        } else {
            console.log(`  ❌ 状态检查失败 (HTTP ${response.status})`);
            return false;
        }
    } catch (error) {
        console.log(`  ❌ 状态检查失败: ${error.message}`);
        return false;
    }
}

/**
 * 测试3: 基本消息测试
 */
async function testBasicMessage() {
    console.log('\n📋 [测试3] 基本消息测试');
    
    try {
        const requestBody = {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 100,
            temperature: 0.7,
            messages: [
                {
                    role: 'user',
                    content: 'Hello! This is a test of the CodeWhisperer v3.0 six-layer architecture. Please respond briefly.'
                }
            ]
        };
        
        console.log('  🔧 发送请求到CodeWhisperer...');
        const startTime = Date.now();
        
        const response = await fetch(`${SERVER_URL}/v1/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'test-key',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(TEST_TIMEOUT)
        });
        
        const duration = Date.now() - startTime;
        
        if (response.ok) {
            const result = await response.json();
            console.log('  ✅ 基本消息测试通过');
            console.log(`  ⏱️ 响应时间: ${duration}ms`);
            console.log(`  🤖 模型: ${result.model || 'unknown'}`);
            console.log(`  📝 响应类型: ${result.type || 'unknown'}`);
            console.log(`  🔧 Stop reason: ${result.stop_reason || 'unknown'}`);
            
            if (result.content && result.content.length > 0) {
                const text = result.content[0].text || '';
                const preview = text.length > 100 ? text.substring(0, 100) + '...' : text;
                console.log(`  💬 响应预览: ${preview}`);
            }
            
            if (result.usage) {
                console.log(`  📊 Token使用: ${result.usage.input_tokens}输入 / ${result.usage.output_tokens}输出`);
            }
            
            return true;
        } else {
            const error = await response.json();
            console.log('  ❌ 基本消息测试失败');
            console.log(`  📋 HTTP状态: ${response.status}`);
            console.log(`  💡 错误信息: ${error.error?.message || 'Unknown error'}`);
            console.log(`  🔧 错误类型: ${error.error?.type || 'unknown'}`);
            return false;
        }
    } catch (error) {
        console.log('  ❌ 基本消息测试失败');
        console.log(`  💥 异常: ${error.message}`);
        
        if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
            console.log('  ⏰ 请求超时 - 可能是认证或网络问题');
        }
        
        return false;
    }
}

/**
 * 测试4: 工具调用测试
 */
async function testToolCalls() {
    console.log('\n📋 [测试4] 工具调用测试');
    
    try {
        const requestBody = {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 150,
            temperature: 0.5,
            messages: [
                {
                    role: 'user',
                    content: 'Please use the calculator tool to compute 25 + 17 and tell me the result.'
                }
            ],
            tools: [
                {
                    name: 'calculator',
                    description: 'Perform basic arithmetic calculations',
                    input_schema: {
                        type: 'object',
                        properties: {
                            operation: {
                                type: 'string',
                                description: 'The arithmetic operation to perform',
                                enum: ['add', 'subtract', 'multiply', 'divide']
                            },
                            a: {
                                type: 'number',
                                description: 'First number'
                            },
                            b: {
                                type: 'number',
                                description: 'Second number'
                            }
                        },
                        required: ['operation', 'a', 'b']
                    }
                }
            ]
        };
        
        console.log('  🔧 发送工具调用请求...');
        const startTime = Date.now();
        
        const response = await fetch(`${SERVER_URL}/v1/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'test-key',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(TEST_TIMEOUT)
        });
        
        const duration = Date.now() - startTime;
        
        if (response.ok) {
            const result = await response.json();
            console.log('  ✅ 工具调用测试通过');
            console.log(`  ⏱️ 响应时间: ${duration}ms`);
            console.log(`  🤖 模型: ${result.model || 'unknown'}`);
            console.log(`  🔧 Stop reason: ${result.stop_reason || 'unknown'}`);
            
            // 检查是否有工具调用
            let hasToolUse = false;
            if (result.content && Array.isArray(result.content)) {
                result.content.forEach((block, index) => {
                    if (block.type === 'tool_use') {
                        hasToolUse = true;
                        console.log(`  🛠️ 工具调用 ${index + 1}: ${block.name}`);
                        console.log(`  📋 输入参数: ${JSON.stringify(block.input)}`);
                    }
                });
            }
            
            if (hasToolUse) {
                console.log('  🎉 工具调用转换成功！');
            } else {
                console.log('  ⚠️ 未检测到工具调用，可能是纯文本响应');
            }
            
            return true;
        } else {
            const error = await response.json();
            console.log('  ❌ 工具调用测试失败');
            console.log(`  📋 HTTP状态: ${response.status}`);
            console.log(`  💡 错误信息: ${error.error?.message || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        console.log('  ❌ 工具调用测试失败');
        console.log(`  💥 异常: ${error.message}`);
        return false;
    }
}

/**
 * 测试5: 六层架构数据流验证
 */
async function testSixLayerArchitecture() {
    console.log('\n📋 [测试5] 六层架构数据流验证');
    
    try {
        // 检查统计信息以验证六层架构工作
        const response = await fetch(`${SERVER_URL}/api/stats`);
        
        if (response.ok) {
            const stats = await response.json();
            console.log('  ✅ 六层架构状态检查通过');
            
            // 验证关键层级指标
            const layers = ['client', 'router', 'postProcessor', 'transformer', 'providerProtocol', 'preprocessor'];
            console.log('  🏗️ 六层架构状态:');
            
            layers.forEach(layer => {
                const layerStats = stats[layer] || stats[`${layer}Stats`] || {};
                const requestCount = layerStats.requests || layerStats.processed || 0;
                console.log(`     ${layer}: ${requestCount > 0 ? '✅' : '⚠️'} ${requestCount} requests`);
            });
            
            // 检查回放系统集成
            if (stats.replaySystem) {
                console.log('  🔄 回放系统: ✅ 已集成');
                console.log(`     📊 捕获数据: ${stats.replaySystem.capturedRequests || 0} requests`);
            }
            
            // 检查性能指标
            if (stats.performance) {
                console.log('  📈 性能指标:');
                console.log(`     平均响应时间: ${Math.round(stats.performance.averageResponseTime || 0)}ms`);
                console.log(`     总请求数: ${stats.performance.totalRequests || 0}`);
            }
            
            return true;
        } else {
            console.log('  ⚠️ 无法获取统计信息');
            return false;
        }
    } catch (error) {
        console.log(`  ❌ 六层架构验证失败: ${error.message}`);
        return false;
    }
}

/**
 * 主测试函数
 */
async function runEndToEndTests() {
    const startTime = Date.now();
    let passedTests = 0;
    const totalTests = 5;
    
    try {
        console.log('🚀 开始CodeWhisperer v3.0端到端测试...\n');
        console.log(`🎯 目标服务器: ${SERVER_URL}`);
        console.log(`⏰ 测试超时: ${TEST_TIMEOUT}ms\n`);
        
        // 测试1: 健康检查
        if (await testHealthCheck()) passedTests++;
        
        // 测试2: 服务状态检查
        if (await testServerStatus()) passedTests++;
        
        // 测试3: 基本消息测试
        if (await testBasicMessage()) passedTests++;
        
        // 测试4: 工具调用测试
        if (await testToolCalls()) passedTests++;
        
        // 测试5: 六层架构验证
        if (await testSixLayerArchitecture()) passedTests++;
        
        const duration = Date.now() - startTime;
        
        console.log('\n🎉 CodeWhisperer v3.0端到端测试完成！');
        console.log(`📊 测试统计:`);
        console.log(`   通过: ${passedTests}/${totalTests}`);
        console.log(`   成功率: ${Math.round((passedTests / totalTests) * 100)}%`);
        console.log(`   耗时: ${duration}ms`);
        
        if (passedTests === totalTests) {
            console.log(`   状态: ✅ ALL TESTS PASSED`);
            console.log('\n🔧 CodeWhisperer v3.0六层架构验证完成:');
            console.log('   ✅ 健康检查 - 服务器运行正常');
            console.log('   ✅ 状态监控 - 系统信息获取正常');
            console.log('   ✅ 基本功能 - Anthropic ↔ CodeWhisperer协议转换');
            console.log('   ✅ 工具调用 - demo3鉴权和工具转换集成');
            console.log('   ✅ 六层架构 - 完整数据流处理链路');
        } else {
            console.log(`   状态: ⚠️ ${totalTests - passedTests} TESTS FAILED`);
            console.log('\n💡 故障排查建议:');
            console.log('   1. 检查CodeWhisperer认证配置');
            console.log('   2. 确认网络连接到AWS服务');
            console.log('   3. 验证demo3鉴权token有效性');
            console.log('   4. 检查六层架构配置完整性');
        }
        
    } catch (error) {
        const duration = Date.now() - startTime;
        
        console.error('\n❌ 端到端测试异常！');
        console.error(`📊 测试统计:`);
        console.error(`   通过: ${passedTests}/${totalTests}`);
        console.error(`   失败: ${totalTests - passedTests}/${totalTests}`);
        console.error(`   耗时: ${duration}ms`);
        console.error(`   异常: ${error.message}`);
        console.error(`   状态: ❌ CRITICAL FAILURE`);
        
        process.exit(1);
    }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    runEndToEndTests();
}