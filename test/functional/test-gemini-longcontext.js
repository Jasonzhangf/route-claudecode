#!/usr/bin/env node

/**
 * 测试Gemini长上下文路由和智能缓冲
 * 确保请求被路由到google-gemini provider
 */

const http = require('http');

async function testGeminiLongContext() {
  console.log('🧪 测试Gemini长上下文智能缓冲策略...');
  
  // 创建一个长内容请求，确保路由到longcontext -> google-gemini
  const longContent = 'JavaScript是一种高级编程语言。'.repeat(1000); // 约30K字符，确保触发longcontext路由
  
  const postData = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `这是一个长内容：${longContent}\n\n请简单总结JavaScript的特点。`
      }
    ]
  });

  console.log(`📊 请求大小: ${Math.round(postData.length / 1024)}KB (应触发longcontext路由)`);

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
          console.log('🎯 模型:', response.model);
          console.log('📊 完整响应结构:', {
            id: response.id,
            model: response.model,
            role: response.role,
            hasContent: !!response.content?.[0]?.text,
            stopReason: response.stop_reason,
            usage: response.usage
          });
          
          // 检查内容预览
          if (response.content?.[0]?.text) {
            console.log('📖 内容预览:', response.content[0].text.slice(0, 100) + '...');
          }
          
          resolve(response);
        } catch (error) {
          console.log('❌ JSON解析失败，原始响应:', data.slice(0, 500));
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ 请求失败:', error.message);
      reject(error);
    });

    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    const startTime = Date.now();
    await testGeminiLongContext();
    const duration = Date.now() - startTime;
    console.log(`✅ 测试完成，耗时: ${duration}ms`);
  } catch (error) {
    console.log('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

main();