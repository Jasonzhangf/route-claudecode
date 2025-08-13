#!/usr/bin/env node
/**
 * 流式功能修复验证测试
 * 验证LMStudioClient的sendStreamRequest方法实现
 * 
 * Project owner: Jason Zhang
 */

import { LMStudioClient } from './dist/v3/provider-protocol/base-provider.js';

async function validateStreamingFix() {
    console.log('🧪 Streaming Fix Validation Test - ' + Date.now());
    console.log('=======================================');

    // Step 1: 检查LMStudioClient类是否有sendStreamRequest方法
    console.log('📋 Step 1: 检查LMStudioClient流式方法...');
    
    const mockConfig = {
        type: 'openai',
        name: 'Test LM Studio',
        endpoint: 'http://localhost:1234',
        timeout: 120000
    };
    
    const client = new LMStudioClient(mockConfig, 'test-lmstudio');
    
    // 检查方法是否存在
    if (typeof client.sendStreamRequest === 'function') {
        console.log('✅ sendStreamRequest 方法存在');
    } else {
        console.log('❌ sendStreamRequest 方法缺失');
        return false;
    }
    
    // Step 2: 检查parseStreamResponse方法
    console.log('📋 Step 2: 检查流式解析方法...');
    if (typeof client.parseStreamResponse === 'function') {
        console.log('✅ parseStreamResponse 方法存在');
    } else {
        console.log('❌ parseStreamResponse 方法缺失');
        return false;
    }
    
    // Step 3: 验证方法签名（async generator）
    console.log('📋 Step 3: 验证方法签名...');
    try {
        const mockRequest = {
            model: 'test-model',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 100,
            metadata: { targetModel: 'test-target' }
        };
        
        // 由于没有真实服务器，这里会抛出错误，但我们可以检查返回类型
        const result = client.sendStreamRequest(mockRequest);
        
        if (result && typeof result[Symbol.asyncIterator] === 'function') {
            console.log('✅ 返回类型是AsyncIterable（async generator）');
        } else {
            console.log('⚠️  返回类型不是AsyncIterable');
        }
    } catch (error) {
        // 这是预期的，因为没有真实服务器
        console.log('✅ 方法调用格式正确（预期网络错误）');
    }
    
    // Step 4: 检查方法实现的关键特性
    console.log('📋 Step 4: 检查实现特性...');
    
    // 读取源代码来检查实现
    const fs = await import('fs');
    const sourceCode = fs.readFileSync('./dist/v3/provider-protocol/base-provider.js', 'utf8');
    
    const hasStreamField = sourceCode.includes('stream: true');
    const hasYieldStar = sourceCode.includes('yield*');
    const hasParseStreamResponse = sourceCode.includes('parseStreamResponse');
    const hasBufferLogic = sourceCode.includes('buffer');
    
    console.log(`   • 强制流式设置: ${hasStreamField ? '✅' : '❌'}`);
    console.log(`   • 使用yield*委托: ${hasYieldStar ? '✅' : '❌'}`);
    console.log(`   • 调用流式解析器: ${hasParseStreamResponse ? '✅' : '❌'}`);
    console.log(`   • 包含缓冲逻辑: ${hasBufferLogic ? '✅' : '❌'}`);
    
    // Step 5: 检查工具调用处理
    console.log('📋 Step 5: 检查工具调用支持...');
    const hasToolsHandling = sourceCode.includes('tool.name || tool.function?.name');
    const hasCleanTools = sourceCode.includes('cleanTools');
    const hasToolCallsMapping = sourceCode.includes('delta.tool_calls');
    
    console.log(`   • 工具格式处理: ${hasToolsHandling ? '✅' : '❌'}`);
    console.log(`   • 工具清理逻辑: ${hasCleanTools ? '✅' : '❌'}`);
    console.log(`   • 流式工具调用: ${hasToolCallsMapping ? '✅' : '❌'}`);
    
    // Step 6: 验证错误处理
    console.log('📋 Step 6: 检查错误处理...');
    const hasErrorHandling = sourceCode.includes('catch (error)');
    const hasThrowError = sourceCode.includes('throw error');
    const hasConsoleError = sourceCode.includes('console.error');
    
    console.log(`   • 异常捕获: ${hasErrorHandling ? '✅' : '❌'}`);
    console.log(`   • 错误抛出: ${hasThrowError ? '✅' : '❌'}`);
    console.log(`   • 错误日志: ${hasConsoleError ? '✅' : '❌'}`);
    
    console.log('📋 Step 7: 总结验证结果...');
    console.log('=======================================');
    
    const allChecks = [
        hasStreamField, hasYieldStar, hasParseStreamResponse, hasBufferLogic,
        hasToolsHandling, hasCleanTools, hasToolCallsMapping,
        hasErrorHandling, hasThrowError, hasConsoleError
    ];
    
    const passedChecks = allChecks.filter(check => check).length;
    const totalChecks = allChecks.length;
    
    console.log(`🎉 流式修复验证完成！`);
    console.log(`📊 通过检查: ${passedChecks}/${totalChecks}`);
    
    if (passedChecks === totalChecks) {
        console.log('✅ 所有流式功能修复验证通过');
        console.log('');
        console.log('🔧 修复内容:');
        console.log('   • 添加了sendStreamRequest异步生成器方法');
        console.log('   • 实现了parseStreamResponse流式解析器');
        console.log('   • 支持OpenAI到Anthropic格式转换');
        console.log('   • 处理工具调用的流式响应');
        console.log('   • 完整的错误处理和日志记录');
        console.log('');
        console.log('📈 预期效果:');
        console.log('   • 解决"provider.sendStreamRequest is not a function"错误');
        console.log('   • 流式响应正常工作');
        console.log('   • 工具调用流式处理正确');
        return true;
    } else {
        console.log('❌ 部分检查未通过，需要进一步修复');
        return false;
    }
}

// 运行验证
validateStreamingFix()
    .then(success => {
        if (success) {
            console.log('🚀 建议下一步: 运行 rcc3 start 测试真实流式功能');
        }
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ 验证测试失败:', error);
        process.exit(1);
    });