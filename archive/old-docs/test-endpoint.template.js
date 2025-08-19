#!/usr/bin/env node

/**
 * API端点测试模板
 * 
 * 使用方法：
 * 1. 复制此文件为 test-<provider>-endpoint.js
 * 2. 替换 YOUR_API_KEY 为实际的API密钥
 * 3. 修改端点URL和模型配置
 * 4. 运行测试：node test-<provider>-endpoint.js
 */

const https = require('https');
const fs = require('fs');

// 配置模板 - 请替换为实际值
const CONFIG = {
  endpoint: 'https://api.example.com/v1/chat/completions',
  apiKeys: [
    'YOUR_API_KEY_1',
    'YOUR_API_KEY_2',
    'YOUR_API_KEY_3'
  ],
  defaultModel: 'your-model-name'
};

/**
 * 发送HTTPS请求
 */
function makeRequest(url, data, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${apiKey}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ status: res.statusCode, data: response });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * 测试API连接
 */
async function testConnection() {
  console.log('🔍 测试API连接...');
  
  const testRequest = {
    model: CONFIG.defaultModel,
    messages: [
      { role: 'user', content: '你好，请简单介绍一下你自己' }
    ],
    max_tokens: 100,
    temperature: 0.7
  };
  
  console.log('\n📋 基本连接测试');
  console.log('模型:', CONFIG.defaultModel);
  console.log('端点:', CONFIG.endpoint);
  
  for (let i = 0; i < CONFIG.apiKeys.length; i++) {
    const apiKey = CONFIG.apiKeys[i];
    console.log(`\n🔑 测试API Key ${i + 1}: ${apiKey.substring(0, 10)}...`);
    
    try {
      const startTime = Date.now();
      const response = await makeRequest(CONFIG.endpoint, testRequest, apiKey);
      const duration = Date.now() - startTime;
      
      console.log(`⏱️  响应时间: ${duration}ms`);
      console.log(`📊 状态码: ${response.status}`);
      
      if (response.status === 200) {
        console.log('✅ API Key有效');
        if (response.data.choices && response.data.choices[0]) {
          console.log('💬 AI响应:', response.data.choices[0].message.content.substring(0, 100) + '...');
        }
        return apiKey; // 返回第一个有效的API Key
      } else {
        console.log('❌ API Key无效');
        console.log('错误信息:', response.data);
      }
      
    } catch (error) {
      console.log('❌ 连接错误:', error.message);
    }
  }
  
  throw new Error('所有API Key都无效');
}

/**
 * 主测试函数
 */
async function main() {
  console.log('🚀 API端点测试开始');
  console.log('═'.repeat(80));
  
  try {
    // 测试基本连接
    const validApiKey = await testConnection();
    
    console.log('\n🎯 测试完成！');
    console.log('📋 请检查测试结果，确认API功能正常工作。');
    
  } catch (error) {
    console.log('\n❌测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}