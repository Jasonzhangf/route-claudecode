#!/usr/bin/env node

/**
 * Message Content Format Debug Test
 * 
 * 专门调试messages content格式问题
 * 重现API 400错误并验证修复
 * 
 * Author: Jason Zhang
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');

console.log('🔍 Message Content Format Debug Test');
console.log('=====================================');

// 测试数据 - 重现实际的400错误
const problemRequest = {
    model: "ZhipuAI/GLM-4.5-Air", 
    max_tokens: 800,
    messages: [{
        role: "user",
        // 这就是导致400错误的格式！应该是string或array，但这里是object
        content: {
            type: "text", 
            text: "Hello world, this should cause a format error"
        }
    }]
};

const correctRequest = {
    model: "ZhipuAI/GLM-4.5-Air",
    max_tokens: 800, 
    messages: [{
        role: "user",
        content: [{ // 正确的array format
            type: "text",
            text: "Hello world, this should work fine"
        }]
    }]
};

const altCorrectRequest = {
    model: "ZhipuAI/GLM-4.5-Air",
    max_tokens: 800,
    messages: [{
        role: "user", 
        content: "Hello world, this should also work fine" // 正确的string format
    }]
};

async function testRequest(name, request, port) {
    console.log(`\n🧪 Testing: ${name}`);
    console.log('📋 Request format:', {
        model: request.model,
        messagesCount: request.messages.length,
        contentType: typeof request.messages[0].content,
        contentIsArray: Array.isArray(request.messages[0].content),
        contentStructure: request.messages[0].content
    });
    
    const tempFile = `/tmp/test-request-${Date.now()}.json`;
    fs.writeFileSync(tempFile, JSON.stringify(request, null, 2));
    
    try {
        const startTime = Date.now();
        console.log('📡 Sending API request...');
        
        const response = execSync(`curl -s -X POST http://127.0.0.1:${port}/v1/messages \\
            -H "Content-Type: application/json" \\
            -H "Authorization: Bearer test-key" \\
            -H "anthropic-version: 2023-06-01" \\
            -d @${tempFile} \\
            --connect-timeout 5 \\
            --max-time 15`, {
            timeout: 20000,
            encoding: 'utf8'
        });
        
        const duration = Date.now() - startTime;
        console.log(`⏱️ Response time: ${duration}ms`);
        
        let result;
        try {
            result = JSON.parse(response);
        } catch (e) {
            result = { raw: response.substring(0, 200) };
        }
        
        if (result.error) {
            if (result.error.code === "400") {
                console.log('❌ 400 Error - Format issue NOT fixed!');
                console.log('📄 Error details:', {
                    type: result.error.type,
                    message: result.error.message.substring(0, 100),
                    provider: result.error.provider,
                    stage: result.error.stage
                });
                return { success: false, error: result.error, fixed: false };
            } else {
                console.log(`⚠️ Other error: ${result.error.code}`);
                return { success: false, error: result.error, fixed: true }; // Not a format error
            }
        } else {
            console.log('✅ Success - Request processed correctly');
            console.log('📄 Response preview:', {
                hasContent: !!result.content,
                hasChoices: !!result.choices,
                messageType: result.type || result.object
            });
            return { success: true, response: result, fixed: true };
        }
        
    } catch (error) {
        console.log('💥 Request failed:', error.message);
        return { success: false, error: error.message, fixed: false };
    } finally {
        try {
            fs.unlinkSync(tempFile);
        } catch (e) {
            // 忽略清理错误
        }
    }
}

async function main() {
    const TEST_PORT = 5509; // ModelScope GLM
    
    // 检查服务是否运行
    try {
        execSync(`curl -s http://127.0.0.1:${TEST_PORT}/health`, { timeout: 3000 });
        console.log(`✅ Service on port ${TEST_PORT} is running`);
    } catch (e) {
        console.log(`❌ Service on port ${TEST_PORT} is not running`);
        console.log('Please start the service first:');
        console.log(`rcc start --config ~/.route-claude-code/config/single-provider/config-openai-sdk-modelscope-glm-5509.json --debug`);
        process.exit(1);
    }
    
    console.log('\n🎯 Testing message content format handling');
    console.log('==========================================');
    
    const results = {};
    
    // Test 1: Problem request (should be fixed by preprocessing)
    results.problemRequest = await testRequest(
        "Problem Request (content as object)",
        problemRequest, 
        TEST_PORT
    );
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Correct array format
    results.correctArray = await testRequest(
        "Correct Array Format", 
        correctRequest,
        TEST_PORT
    );
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 3: Correct string format
    results.correctString = await testRequest(
        "Correct String Format",
        altCorrectRequest,
        TEST_PORT
    );
    
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    
    console.log('🔍 Problem Request (Object Content):', {
        success: results.problemRequest.success,
        fixed: results.problemRequest.fixed,
        status: results.problemRequest.success ? 'PASSED' : (results.problemRequest.fixed ? 'FIXED_BUT_FAILED' : 'FORMAT_ERROR_NOT_FIXED')
    });
    
    console.log('✅ Correct Array Format:', {
        success: results.correctArray.success,
        status: results.correctArray.success ? 'PASSED' : 'FAILED'
    });
    
    console.log('✅ Correct String Format:', {
        success: results.correctString.success,
        status: results.correctString.success ? 'PASSED' : 'FAILED'
    });
    
    // 分析结果
    const problemFixed = results.problemRequest.fixed && results.problemRequest.success;
    const correctFormatsWork = results.correctArray.success && results.correctString.success;
    
    console.log('\n🎯 Analysis:');
    if (problemFixed && correctFormatsWork) {
        console.log('✅ SUCCESS: Universal format fix is working correctly!');
        console.log('   - Problem content format was automatically fixed');
        console.log('   - Correct formats continue to work');
        return true;
    } else if (!problemFixed && correctFormatsWork) {
        console.log('❌ PARTIAL: Fix is not being applied to problem format');
        console.log('   - Correct formats work fine');
        console.log('   - Object content format still causes 400 error');
        console.log('   - Universal fix needs debugging');
        return false;
    } else {
        console.log('❌ FAILURE: Multiple issues detected');
        console.log('   - Service may have broader problems');
        return false;
    }
}

if (require.main === module) {
    main().then(success => {
        process.exit(success ? 0 : 1);
    });
}