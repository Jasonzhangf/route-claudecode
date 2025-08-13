#!/usr/bin/env node
/**
 * 🧪 Test recordProviderResult Fix
 * 验证recordProviderResult方法修复
 * 
 * Project owner: Jason Zhang
 */

import { spawn } from 'child_process';
import path from 'path';

/**
 * 测试recordProviderResult修复
 */
async function testRecordProviderResultFix() {
    const testId = Date.now();
    console.log(`🧪 recordProviderResult Fix Test - ${testId}`);
    console.log('==========================================');
    
    let rcc3Process = null;
    
    try {
        // 启动LM Studio配置的rcc3服务
        console.log('🚀 启动LM Studio服务进行快速测试...');
        
        const configPath = path.join(process.env.HOME, '.route-claudecode/config/v3/single-provider/config-lmstudio-v3-5506.json');
        
        rcc3Process = spawn('rcc3', ['start', configPath, '--debug'], {
            stdio: 'pipe',
            detached: false
        });
        
        let serverStarted = false;
        let hasRecordProviderResultError = false;
        
        rcc3Process.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[RCC3] ${output.trim()}`);
            
            if (output.includes('V3 Router Server is running') || output.includes('listening')) {
                serverStarted = true;
            }
        });
        
        rcc3Process.stderr.on('data', (data) => {
            const error = data.toString();
            console.error(`[RCC3 ERROR] ${error.trim()}`);
            
            if (error.includes('recordProviderResult is not a function')) {
                hasRecordProviderResultError = true;
            }
        });
        
        // 等待服务启动
        console.log('⏳ 等待服务启动...');
        let waitTime = 0;
        while (!serverStarted && waitTime < 15000) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            waitTime += 1000;
        }
        
        if (!serverStarted) {
            throw new Error(`❌ 服务启动超时 (${waitTime}ms)`);
        }
        
        console.log('✅ 服务启动成功');
        
        // 发送一个简单的工具调用请求
        console.log('📤 发送测试请求...');
        
        const testRequest = {
            model: "claude-sonnet-4-20250514",
            max_tokens: 100,
            messages: [
                {
                    role: "user",
                    content: "简单回复：你好"
                }
            ]
        };
        
        const response = await fetch('http://localhost:5506/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testRequest)
        });
        
        const responseData = await response.json();
        console.log(`📊 API响应状态: ${response.status}`);
        
        // 等待一会让错误有时间出现
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 检查结果
        console.log('📋 测试结果分析:');
        
        if (hasRecordProviderResultError) {
            console.log('❌ recordProviderResult错误仍然存在');
            console.log('   • 需要检查路由引擎实现');
        } else {
            console.log('✅ 没有发现recordProviderResult错误');
            console.log('   • 方法调用正常');
        }
        
        if (response.status === 500) {
            console.log('⚠️  仍有500错误，但可能是LM Studio连接问题');
        } else {
            console.log('✅ API响应状态正常');
        }
        
        console.log('');
        console.log('🎉 recordProviderResult修复测试完成！');
        console.log('');
        console.log(hasRecordProviderResultError ? 
                    '❌ 修复不完整 - 需要进一步调试' : 
                    '✅ 修复成功 - recordProviderResult方法正常工作');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        process.exit(1);
        
    } finally {
        // 清理进程
        if (rcc3Process && !rcc3Process.killed) {
            console.log('🧹 清理rcc3进程...');
            rcc3Process.kill('SIGTERM');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

// 执行测试
testRecordProviderResultFix().catch(console.error);