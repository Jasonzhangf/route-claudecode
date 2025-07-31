#!/usr/bin/env node

/**
 * Gemini API Key 轮询状态检查
 * 检查3个Gemini API Key是否都被限额了
 */

const axios = require('axios');

const testConfig = {
  port: 8888,  // Release config port
  host: '127.0.0.1'
};

// Gemini API Keys from config.release.json
const geminiKeys = [
  "AIzaSyB59-hG3lluhWoucvz-qOQKWTrygIxZ2e4",
  "AIzaSyBwrFU85pzvJtAmV-Rh48FuocRYbkuzpiA", 
  "AIzaSyBGVrcTiEDko1jZW0wmaGC_oYxK-AL3mEQ"
];

async function testGeminiKeyDirectly(apiKey, index) {
  console.log(`\n🔑 测试 Gemini API Key ${index + 1}: ${apiKey.substring(0, 10)}...`);
  
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [{ text: "Hello, this is a test message." }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log(`✅ Key ${index + 1} 状态: 正常工作`);
    console.log(`📊 响应状态: ${response.status}`);
    return { keyIndex: index + 1, status: 'working', response: response.status };

  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      console.log(`❌ Key ${index + 1} 状态: HTTP ${status}`);
      console.log(`📄 错误详情:`, JSON.stringify(data, null, 2));
      
      if (status === 429) {
        console.log(`🚫 Key ${index + 1}: 配额已用完/速率限制`);
        return { keyIndex: index + 1, status: 'rate_limited', error: data };
      } else if (status === 403) {
        console.log(`🔒 Key ${index + 1}: 权限问题/API被禁用`);
        return { keyIndex: index + 1, status: 'forbidden', error: data };
      } else if (status >= 400) {
        console.log(`⚠️ Key ${index + 1}: 客户端错误`);
        return { keyIndex: index + 1, status: 'client_error', error: data };
      } else if (status >= 500) {
        console.log(`🛠️ Key ${index + 1}: 服务器错误（非配额问题）`);
        return { keyIndex: index + 1, status: 'server_error', error: data };
      }
    } else {
      console.log(`🌐 Key ${index + 1}: 网络错误 - ${error.message}`);
      return { keyIndex: index + 1, status: 'network_error', error: error.message };
    }
  }
}

async function testRouterKeyRotation() {
  console.log('\n🔄 测试路由器内部的 Key 轮询状态');
  
  try {
    // 发送多个请求到8888端口，强制使用Gemini (longcontext)
    const requests = [];
    for (let i = 0; i < 5; i++) {
      const request = {
        model: 'claude-sonnet-4-20250514', // Will route to Gemini longcontext
        messages: [
          {
            role: 'user',
            content: `Test request ${i + 1} - ` + 'a'.repeat(50000) // Force longcontext category
          }
        ],
        max_tokens: 100,
        stream: false
      };
      
      requests.push(
        axios.post(
          `http://${testConfig.host}:${testConfig.port}/v1/messages`,
          request,
          {
            headers: {
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01',
              'x-api-key': 'test-key'
            },
            timeout: 15000
          }
        ).catch(error => ({ error, requestIndex: i + 1 }))
      );
    }
    
    console.log('📤 发送5个并行请求测试Key轮询...');
    const results = await Promise.all(requests);
    
    let successCount = 0;
    let errorCount = 0;
    
    results.forEach((result, index) => {
      if (result.error) {
        console.log(`❌ 请求 ${index + 1}: ${result.error.response?.status || 'Network Error'}`);
        errorCount++;
      } else {
        console.log(`✅ 请求 ${index + 1}: ${result.status}`);
        successCount++;
      }
    });
    
    console.log(`\n📊 路由器测试结果: ${successCount}成功/${errorCount}失败`);
    
    if (errorCount === 5) {
      console.log('🚨 所有请求都失败 - 可能所有Key都被限额了');
    } else if (errorCount > 0) {
      console.log('⚠️ 部分失败 - Key轮询可能正在工作，但有些Key被限额');
    } else {
      console.log('✅ 全部成功 - Key轮询正常工作');
    }
    
  } catch (error) {
    console.error('❌ 路由器测试失败:', error.message);
  }
}

async function checkGeminiKeyRotation() {
  console.log('🧪 Gemini API Key 轮询状态检查');
  console.log('=' .repeat(60));
  
  console.log('\n📋 Phase 1: 直接测试每个API Key');
  
  const keyResults = [];
  for (let i = 0; i < geminiKeys.length; i++) {
    const result = await testGeminiKeyDirectly(geminiKeys[i], i);
    keyResults.push(result);
    
    // 等待1秒避免过快请求
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📋 Phase 2: 测试路由器Key轮询');
  await testRouterKeyRotation();
  
  console.log('\n📊 最终分析结果');
  console.log('=' .repeat(60));
  
  const workingKeys = keyResults.filter(r => r.status === 'working');
  const rateLimitedKeys = keyResults.filter(r => r.status === 'rate_limited');
  const forbiddenKeys = keyResults.filter(r => r.status === 'forbidden');
  const errorKeys = keyResults.filter(r => !['working', 'rate_limited', 'forbidden'].includes(r.status));
  
  console.log(`✅ 正常工作的Key: ${workingKeys.length}/3`);
  console.log(`🚫 配额限制的Key: ${rateLimitedKeys.length}/3`);
  console.log(`🔒 权限问题的Key: ${forbiddenKeys.length}/3`);
  console.log(`❌ 其他错误的Key: ${errorKeys.length}/3`);
  
  if (workingKeys.length === 0) {
    console.log('\n🚨 所有Gemini API Key都不可用！');
    console.log('建议: 检查Google Cloud配额或等待配额重置');
  } else if (workingKeys.length < 3) {
    console.log(`\n⚠️ 只有${workingKeys.length}个Key可用，轮询效果会受影响`);
    console.log('建议: 检查不可用的Key或添加更多Key');
  } else {
    console.log('\n✅ 所有Key都可用，8888端口的错误可能是其他原因');
  }
}

// 运行检查
if (require.main === module) {
  checkGeminiKeyRotation().catch(console.error);
}

module.exports = { checkGeminiKeyRotation };