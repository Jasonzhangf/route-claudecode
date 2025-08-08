#!/usr/bin/env node

/**
 * 测试格式修复调试脚本
 * 验证格式修复是否被正确调用
 */

const fs = require('fs');
const axios = require('axios');

async function testFormatFix() {
    console.log('🧪 [TEST] Testing format fix debug');
    
    // 发送一个会触发错误的测试请求
    const testRequest = {
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1000,
        messages: [
            {
                role: "user", 
                content: "Just say 'test' in response."
            }
        ]
    };

    try {
        console.log('📤 [SEND] Sending test request to trigger format fix...');
        
        const response = await axios.post('http://localhost:3456/v1/messages', testRequest, {
            headers: {
                'Content-Type': 'application/json',
                'x-test-case': 'format-fix-debug'
            },
            timeout: 30000
        });
        
        console.log('✅ [SUCCESS] Request completed successfully');
        console.log('📊 [RESPONSE] Status:', response.status);
        console.log('📊 [RESPONSE] Data type:', typeof response.data);
        
        if (response.data && response.data.content) {
            console.log('✅ [FORMAT] Response has correct format');
        } else {
            console.log('⚠️ [FORMAT] Response format may be non-standard');
        }
        
    } catch (error) {
        console.log('❌ [ERROR] Request failed:', error.response?.status || error.code);
        console.log('📝 [ERROR] Message:', error.response?.data?.error?.message || error.message);
        
        if (error.response?.data?.error?.message?.includes('missing choices')) {
            console.log('🔍 [ANALYSIS] This is the "missing choices" error we are trying to fix');
            console.log('❌ [FIX] Format fix is NOT working properly');
        }
    }
    
    console.log('🧪 [TEST] Format fix debug test completed');
}

if (require.main === module) {
    testFormatFix().catch(error => {
        console.error('💥 [FATAL] Test script failed:', error.message);
        process.exit(1);
    });
}

module.exports = { testFormatFix };