#!/usr/bin/env node

/**
 * 测试真正的Gemini长上下文路由
 * 创建足够大的请求（>45K tokens）确保触发longcontext -> google-gemini
 */

const http = require('http');

async function testGeminiRealLongContext() {
  console.log('🧪 测试Gemini真正长上下文智能缓冲策略...');
  
  // 创建一个超过45K tokens的请求
  // 假设平均4个字符=1token，需要约180K字符
  const longContent = 'JavaScript是一种高级编程语言，广泛用于Web开发、移动应用开发、桌面应用开发等多个领域。它具有动态类型、函数式编程、面向对象编程等特性。JavaScript最初由Brendan Eich在1995年为网景公司开发，现在已经成为最流行的编程语言之一。现代JavaScript引擎如V8、SpiderMonkey等提供了出色的性能。Node.js的出现使得JavaScript也能用于服务器端开发。'.repeat(600); // 约180K字符
  
  const postData = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `这是一个超长内容用于触发longcontext路由：${longContent}\n\n请简单总结JavaScript的核心特点（最多3个要点）。`
      }
    ]
  });

  const estimatedTokens = Math.round(postData.length / 4);
  console.log(`📊 请求大小: ${Math.round(postData.length / 1024)}KB`);
  console.log(`🎯 估算tokens: ${estimatedTokens} (阈值: 45000)`);
  console.log(`✅ ${estimatedTokens > 45000 ? '应该' : '不会'}触发longcontext路由`);

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
          console.log('🔢 输入tokens:', response.usage?.input_tokens || 0);
          console.log('🎯 模型:', response.model);
          console.log('📊 完整响应结构:', {
            id: response.id,
            model: response.model,
            role: response.role,
            hasContent: !!response.content?.[0]?.text,
            stopReason: response.stop_reason,
            usage: response.usage
          });
          
          // 检查是否路由到了Gemini（应该返回gemini-2.5-pro）
          if (response.model === 'gemini-2.5-pro') {
            console.log('🎉 SUCCESS: 请求成功路由到google-gemini，智能缓冲策略生效！');
          } else {
            console.log(`⚠️ WARNING: 请求未路由到Gemini，实际模型: ${response.model}`);
          }
          
          // 检查内容预览
          if (response.content?.[0]?.text) {
            console.log('📖 内容预览:', response.content[0].text.slice(0, 150) + '...');
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

    req.setTimeout(180000, () => { // 3分钟超时
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
    await testGeminiRealLongContext();
    const duration = Date.now() - startTime;
    console.log(`✅ 测试完成，耗时: ${duration}ms`);
  } catch (error) {
    console.log('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

main();