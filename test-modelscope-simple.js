#!/usr/bin/env node

/**
 * 简单测试ModelScope Anthropic配置
 */

const axios = require('axios');

async function testModelScopeRouting() {
  console.log('🔍 测试ModelScope Anthropic路由');
  console.log('===============================');
  
  const request = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: "写一个简单的Python hello world程序"
      }
    ]
  };
  
  try {
    console.log('📤 发送Default请求...');
    
    const response = await axios.post('http://127.0.0.1:3456/v1/messages', request, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000
    });
    
    console.log('✅ 请求成功');
    console.log('📊 响应信息:');
    console.log('   返回模型:', response.data.model);
    console.log('   Content blocks:', response.data.content?.length || 0);
    
    if (response.data.content && response.data.content[0]?.text) {
      const content = response.data.content[0].text;
      console.log('   内容长度:', content.length);
      console.log('   内容预览:', JSON.stringify(content.slice(0, 100)));
      
      // 检查是否是预期的模型响应
      const isModelScope = response.data.model === 'Qwen/Qwen3-Coder-480B-A35B-Instruct';
      console.log('   ModelScope路由:', isModelScope ? '✅ 成功' : '❌ 失败');
      
      return isModelScope;
    }
    
    return false;
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   错误详情:', error.response.data);
    }
    return false;
  }
}

async function main() {
  const success = await testModelScopeRouting();
  
  console.log('\n📋 测试结果:');
  console.log('=============');
  console.log('ModelScope路由:', success ? '✅ 成功' : '❌ 失败');
  
  if (success) {
    console.log('\n🎉 配置成功！');
    console.log('✅ Default路由现在指向ModelScope Qwen3-Coder-480B');
    console.log('✅ 使用Anthropic格式接口');
    console.log('✅ API Key配置正确');
  } else {
    console.log('\n⚠️  配置需要调整');
  }
}

if (require.main === module) {
  main().catch(console.error);
}