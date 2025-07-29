#!/usr/bin/env node

/**
 * 简单测试全部路由到CodeWhisperer
 */

const axios = require('axios');

async function testCodeWhispererRouting() {
  console.log('🔍 测试CodeWhisperer路由');
  console.log('=======================');
  
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
    console.log('📤 发送Default请求到CodeWhisperer...');
    
    const startTime = Date.now();
    const response = await axios.post('http://127.0.0.1:3457/v1/messages', request, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000
    });
    const responseTime = Date.now() - startTime;
    
    console.log('✅ 请求成功');
    console.log('📊 响应信息:');
    console.log(`   响应时间: ${responseTime}ms`);
    console.log('   返回模型:', response.data.model);
    console.log('   Content blocks:', response.data.content?.length || 0);
    
    if (response.data.content && response.data.content[0]?.text) {
      const content = response.data.content[0].text;
      console.log('   内容长度:', content.length);
      console.log('   内容预览:', JSON.stringify(content.slice(0, 100)));
    }
    
    // 检查是否是CodeWhisperer模型
    const isCodeWhisperer = response.data.model === 'CLAUDE_SONNET_4_20250514_V1_0';
    console.log('   CodeWhisperer路由:', isCodeWhisperer ? '✅ 成功' : '❌ 失败');
    
    return isCodeWhisperer;
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   错误详情:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   💡 服务器未启动');
    }
    return false;
  }
}

async function main() {
  console.log('🚀 CodeWhisperer 路由测试');
  console.log('=========================\n');
  
  const success = await testCodeWhispererRouting();
  
  console.log('\n📋 测试结果:');
  console.log('=============');
  console.log('CodeWhisperer路由:', success ? '✅ 成功' : '❌ 失败');
  
  if (success) {
    console.log('\n🎉 路由配置成功！');
    console.log('✅ 所有请求现在都路由到CodeWhisperer');
    console.log('✅ Token读取和认证正常');
  } else {
    console.log('\n⚠️  路由失败，可能的原因：');
    console.log('1. 服务器未启动');
    console.log('2. Token过期或无效');
    console.log('3. CodeWhisperer API网络问题');
    console.log('4. 硬编码路径问题');
  }
}

if (require.main === module) {
  main().catch(console.error);
}