#!/usr/bin/env node

/**
 * 测试5506端口的简单请求
 * 分步调试Max Tokens错误
 */

const axios = require('axios');

async function testSimpleRequest() {
  console.log('🧪 测试5506端口简单请求...\n');
  
  try {
    const response = await axios.post('http://localhost:5506/v1/messages', {
      model: "claude-3-sonnet-20240229",
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 100  // 增加到100
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key',
        'anthropic-version': '2023-06-01'
      },
      timeout: 15000
    });

    console.log('✅ 请求成功');
    console.log('📊 状态码:', response.status);
    console.log('📋 响应内容:');
    if (response.data.content?.[0]?.text) {
      console.log('📄 文本:', response.data.content[0].text.substring(0, 100) + '...');
    }
    console.log('🔚 Stop reason:', response.data.stop_reason);
    
  } catch (error) {
    console.log('❌ 请求失败:', error.message);
    
    if (error.response?.status) {
      console.log('📊 HTTP状态码:', error.response.status);
    }
    
    if (error.response?.data) {
      console.log('📄 错误响应:');
      console.log(JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function testDirectModel() {
  console.log('\n🧪 测试直接使用LMStudio模型名...\n');
  
  try {
    const response = await axios.post('http://localhost:5506/v1/messages', {
      model: "gpt-oss-20b-mlx",  // 直接使用LMStudio模型名
      messages: [{ role: "user", content: "test" }],
      max_tokens: 50
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key',
        'anthropic-version': '2023-06-01'
      },
      timeout: 15000
    });

    console.log('✅ 直接模型名请求成功');
    console.log('📊 状态码:', response.status);
    
  } catch (error) {
    console.log('❌ 直接模型名请求失败:', error.message);
    if (error.response?.data) {
      console.log('📄 错误响应:');
      console.log(JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function testHealthAndStatus() {
  console.log('\n🧪 测试健康状态...\n');
  
  try {
    const health = await axios.get('http://localhost:5506/health');
    console.log('✅ 健康检查:', health.data);
    
    // 检查LMStudio是否在运行
    const lmstudio = await axios.get('http://localhost:1234/v1/models');
    console.log('✅ LMStudio模型列表:', lmstudio.data.data.map(m => m.id));
    
  } catch (error) {
    console.log('⚠️ 状态检查问题:', error.message);
  }
}

async function main() {
  await testHealthAndStatus();
  await testSimpleRequest();
  await testDirectModel();
}

main().catch(console.error);