#!/usr/bin/env node

/**
 * 测试正确的ModelScope Anthropic API配置
 */

const axios = require('axios');

async function testDirectModelScopeAnthropic() {
  console.log('🔍 直接测试ModelScope Anthropic API');
  console.log('==================================');
  
  const request = {
    model: "Qwen/Qwen3-Coder-480B-A35B-Instruct",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: "写一个简单的Python hello world程序"
      }
    ]
  };
  
  try {
    console.log('📤 发送请求到 https://api-inference.modelscope.cn/v1/messages');
    console.log('🔑 使用API Key: ms-cc2f461b-8228-427f-99aa-1d44fab73e67');
    
    const response = await axios.post('https://api-inference.modelscope.cn/v1/messages', request, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'ms-cc2f461b-8228-427f-99aa-1d44fab73e67',
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000
    });
    
    console.log('✅ 直接API测试成功');
    console.log('📊 响应信息:');
    console.log('   模型:', response.data.model);
    console.log('   内容块数:', response.data.content?.length || 0);
    
    if (response.data.content && response.data.content[0]?.text) {
      const content = response.data.content[0].text;
      console.log('   内容长度:', content.length);
      console.log('   内容预览:', JSON.stringify(content.slice(0, 100)));
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ 直接API测试失败:', error.message);
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   错误详情:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 404) {
        console.log('\n💡 尝试不同的端点...');
        return await testAlternativeEndpoints();
      }
    }
    return false;
  }
}

async function testAlternativeEndpoints() {
  console.log('\n🔍 测试其他可能的端点');
  console.log('========================');
  
  const endpoints = [
    'https://api-inference.modelscope.cn/messages',
    'https://api-inference.modelscope.cn/v1/chat/completions'
  ];
  
  const request = {
    model: "Qwen/Qwen3-Coder-480B-A35B-Instruct",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: "写一个简单的Python hello world程序"
      }
    ]
  };
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n📤 尝试端点: ${endpoint}`);
      
      const response = await axios.post(endpoint, request, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'ms-cc2f461b-8228-427f-99aa-1d44fab73e67',
          'anthropic-version': '2023-06-01'
        },
        timeout: 15000
      });
      
      console.log('✅ 端点工作正常:', endpoint);
      console.log('   模型:', response.data.model);
      return { endpoint, success: true };
      
    } catch (error) {
      console.log('❌ 端点失败:', endpoint, '- 状态码:', error.response?.status || 'N/A');
    }
  }
  
  return { endpoint: null, success: false };
}

async function main() {
  console.log('🚀 ModelScope Anthropic API 测试');
  console.log('================================\n');
  
  const directSuccess = await testDirectModelScopeAnthropic();
  
  console.log('\n📋 测试总结:');
  console.log('=============');
  
  if (directSuccess) {
    console.log('✅ ModelScope Anthropic API 可以直接访问');
    console.log('✅ 端点配置正确');
    console.log('✅ API Key有效');
    console.log('\n🔧 接下来需要重新构建并重启服务器来测试路由');
  } else {
    console.log('❌ ModelScope Anthropic API 访问失败');
    console.log('💡 可能需要检查：');
    console.log('   1. API Key是否正确');
    console.log('   2. 模型ID是否准确');
    console.log('   3. 端点URL是否正确');
    console.log('   4. 是否需要特殊的认证头');
  }
}

if (require.main === module) {
  main().catch(console.error);
}