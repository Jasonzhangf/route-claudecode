#!/usr/bin/env node

/**
 * Simple Gemini Text Test
 * 直接测试Gemini智能缓冲策略的基本功能
 */

const http = require('http');

async function testGeminiResponse() {
  console.log('🧪 测试Gemini智能缓冲策略...');
  
  const postData = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: '请简单介绍一下JavaScript'
      }
    ]
  });

  const options = {
    hostname: 'localhost',
    port: 8888,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('✅ 响应状态:', res.statusCode);
          console.log('📝 内容长度:', response.content?.[0]?.text?.length || 0);
          console.log('🔢 输出tokens:', response.usage?.output_tokens || 0);
          console.log('📊 完整响应结构:', {
            id: response.id,
            model: response.model,
            role: response.role,
            hasContent: !!response.content?.[0]?.text,
            stopReason: response.stop_reason,
            usage: response.usage
          });
          resolve(response);
        } catch (error) {
          console.log('❌ JSON解析失败，原始响应:', data.slice(0, 200));
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ 请求失败:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    await testGeminiResponse();
    console.log('✅ 测试完成');
  } catch (error) {
    console.log('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

main();