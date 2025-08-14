#!/usr/bin/env node

// 测试messages content格式修复
const axios = require('axios');

console.log('🧪 测试messages content格式修复');

async function testMessageContentFix() {
  const testData = {
    model: 'claude-4-sonnet',
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: 'Hello world' } // 对象格式content
      }
    ],
    max_tokens: 100,
    stream: false
  };

  console.log('📥 发送请求 - 包含对象格式的content:');
  console.log(JSON.stringify(testData, null, 2));

  try {
    const response = await axios.post('http://localhost:3456/v1/messages', testData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      }
    });

    console.log('✅ 响应成功! Status:', response.status);
    console.log('✅ 响应数据:', JSON.stringify(response.data, null, 2));
    
    return { success: true, status: response.status, data: response.data };
  } catch (error) {
    console.log('❌ 请求失败!');
    
    if (error.response) {
      console.log('❌ Status:', error.response.status);
      console.log('❌ Error:', JSON.stringify(error.response.data, null, 2));
      
      // 检查是否还是messages content格式错误
      const errorMsg = error.response.data.error?.message || '';
      if (errorMsg.includes('messages.[0].content')) {
        console.log('💥 MESSAGES CONTENT格式错误仍然存在!');
        return { success: false, stillBroken: true, error: errorMsg };
      } else {
        console.log('✅ Messages content格式已修复，但有其他错误');
        return { success: false, stillBroken: false, error: errorMsg };
      }
    } else {
      console.log('❌ Network error:', error.message);
      return { success: false, networkError: true, error: error.message };
    }
  }
}

// 运行测试
testMessageContentFix().then(result => {
  console.log('\n🔍 测试结果总结:');
  if (result.success) {
    console.log('✅ Messages content格式修复成功!');
  } else if (result.stillBroken) {
    console.log('❌ Messages content格式修复失败，问题仍然存在');
  } else if (result.networkError) {
    console.log('⚠️ 网络错误，无法完成测试');
  } else {
    console.log('✅ Messages content格式已修复，但有其他API错误');
  }
}).catch(error => {
  console.error('💥 测试脚本异常:', error);
});