#\!/usr/bin/env node

// 诊断[object][object]错误的脚本
const axios = require('axios');

console.log('🔍 诊断[object][object]错误...\n');

// 1. 测试API连接
async function testAPI() {
    console.log('1. 测试API连接...');
    try {
        const response = await axios.get('http://localhost:3456/status', { timeout: 5000 });
        console.log('   ✅ API连接正常');
        return true;
    } catch (error) {
        console.log('   ❌ API连接失败:', error.message);
        return false;
    }
}

// 2. 测试消息处理
async function testMessage() {
    console.log('2. 测试消息处理...');
    try {
        const response = await axios.post('http://localhost:3456/v1/messages', {
            model: 'claude-3-sonnet-20241022',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 10
        }, {
            headers: { 'Authorization': 'Bearer test', 'Content-Type': 'application/json' },
            timeout: 30000
        });
        console.log('   ✅ 消息处理正常');
        return true;
    } catch (error) {
        if (error.response) {
            console.log('   ❌ API错误:', error.response.status, error.response.data);
        } else if (error.request) {
            console.log('   ❌ 网络错误:', error.message);
        } else {
            console.log('   ❌ 未知错误:', error.message);
        }
        return false;
    }
}

// 3. 测试对象序列化
function testSerialization() {
    console.log('3. 测试对象序列化...');
    
    const testObj = { test: 'value' };
    const testError = new Error('test error');
    
    try {
        // 正常序列化
        const normalJSON = JSON.stringify(testObj);
        console.log('   ✅ 正常对象序列化:', normalJSON);
        
        // 错误对象序列化 - 这可能导致[object][object]
        const errorJSON = JSON.stringify(testError);
        console.log('   ⚠️  错误对象序列化:', errorJSON);
        
        // 检查toString()行为
        console.log('   📝 错误对象toString():', testError.toString());
        console.log('   📝 直接连接错误对象:', testError + testError);
        
        return true;
    } catch (error) {
        console.log('   ❌ 序列化测试失败:', error.message);
        return false;
    }
}

// 主函数
async function main() {
    const apiOk = await testAPI();
    const messageOk = await testMessage();
    const serializationOk = testSerialization();
    
    console.log('\n📊 诊断结果:');
    console.log(`   API连接: ${apiOk ? '✅' : '❌'}`);
    console.log(`   消息处理: ${messageOk ? '✅' : '❌'}`);
    console.log(`   对象序列化: ${serializationOk ? '✅' : '❌'}`);
    
    if (\!apiOk || \!messageOk) {
        console.log('\n💡 建议检查:');
        console.log('   1. 服务器是否正常运行');
        console.log('   2. 配置文件是否正确');
        console.log('   3. Provider健康状态');
    }
}

main().catch(console.error);
EOF < /dev/null