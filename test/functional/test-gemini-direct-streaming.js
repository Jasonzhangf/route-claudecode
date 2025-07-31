#!/usr/bin/env node

/**
 * 直接测试Gemini智能缓冲策略
 * 通过长上下文路由确保请求到达google-gemini
 */

const http = require('http');

async function testGeminiDirectStreaming() {
  console.log('🧪 直接测试Gemini智能缓冲策略...');
  
  // 创建一个超过45K tokens的请求，确保触发longcontext -> google-gemini
  const longContent = 'JavaScript是一种动态编程语言，广泛应用于Web开发、服务器端开发、移动应用开发等领域。它具有灵活的语法、强大的功能和丰富的生态系统。现代JavaScript引擎如V8、SpiderMonkey等提供了出色的性能表现。'.repeat(700); // 约140K字符，估算35K tokens
  
  const streamRequest = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    stream: true,
    messages: [
      {
        role: 'user',
        content: `这是一个长上下文内容：${longContent}\n\n请简单总结JavaScript的三个核心特点，每个特点用一句话说明。`
      }
    ]
    // 注意：不包含tools，避免触发search路由
  };

  const postData = JSON.stringify(streamRequest);
  const estimatedTokens = Math.round(postData.length / 4);
  
  console.log(`📊 请求大小: ${Math.round(postData.length / 1024)}KB`);
  console.log(`🎯 估算tokens: ${estimatedTokens} (阈值: 45000)`);
  console.log(`✅ ${estimatedTokens > 45000 ? '应该' : '不会'}触发longcontext路由到google-gemini`);

  const options = {
    hostname: 'localhost',
    port: 8888,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Accept': 'text/event-stream'
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let eventCount = 0;
      let contentLength = 0;
      let outputTokens = 0;
      let inputTokens = 0;
      let detectedModel = '';
      let allEvents = [];
      let rawData = '';

      console.log(`📡 开始接收Gemini流式响应...`);

      res.on('data', (chunk) => {
        const data = chunk.toString();
        rawData += data;
        const lines = data.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6));
              allEvents.push(eventData);
              eventCount++;
              
              // 检测内容
              if (eventData.type === 'content_block_delta' && eventData.delta?.text) {
                contentLength += eventData.delta.text.length;
              }
              
              // 检测token信息和模型
              if (eventData.type === 'message_start' && eventData.message) {
                detectedModel = eventData.message.model || '';
                if (eventData.message.usage) {
                  inputTokens = eventData.message.usage.input_tokens || 0;
                }
              }
              
              if (eventData.type === 'message_delta' && eventData.usage?.output_tokens) {
                outputTokens = eventData.usage.output_tokens;
              }
              
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });

      res.on('end', () => {
        console.log(`✅ Gemini流式响应完成:`);
        console.log(`   事件数: ${eventCount}`);
        console.log(`   内容长度: ${contentLength}`);
        console.log(`   输出tokens: ${outputTokens}`);
        console.log(`   输入tokens: ${inputTokens}`);
        console.log(`   检测模型: ${detectedModel}`);
        
        // 检查是否正确路由到Gemini
        const routedToGemini = detectedModel.includes('gemini');
        console.log(`   路由到Gemini: ${routedToGemini ? 'Yes ✅' : 'No ❌'}`);
        
        // 显示部分原始响应用于调试
        console.log(`   原始响应预览: ${rawData.slice(0, 200)}...`);
        
        // 成功标准
        const success = eventCount > 0 && 
                       contentLength > 0 && 
                       outputTokens > 0 &&
                       routedToGemini;
        
        resolve({
          success,
          eventCount,
          contentLength,
          outputTokens,
          inputTokens,
          detectedModel,
          routedToGemini,
          statusCode: res.statusCode,
          allEvents: allEvents.slice(0, 5) // 前5个事件用于调试
        });
      });
    });

    req.on('error', (error) => {
      console.log(`❌ 请求失败:`, error.message);
      reject(error);
    });

    req.setTimeout(180000, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🚀 开始Gemini智能缓冲直接测试\n');
  
  try {
    const result = await testGeminiDirectStreaming();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 最终测试结果');
    console.log('='.repeat(60));
    
    if (result.success) {
      console.log('🎉 测试成功！Gemini智能缓冲策略正常工作');
      console.log(`✅ 事件数: ${result.eventCount}`);
      console.log(`✅ 内容长度: ${result.contentLength}`);
      console.log(`✅ 输出tokens: ${result.outputTokens}`);
      console.log(`✅ 模型: ${result.detectedModel}`);
      
      if (result.allEvents.length > 0) {
        console.log('\n📋 前几个事件:');
        result.allEvents.forEach((event, i) => {
          console.log(`   ${i+1}. ${event.type || event.event || 'unknown'}`);
        });
      }
      
    } else {
      console.log('❌ 测试失败！');
      console.log(`   事件数: ${result.eventCount}`);
      console.log(`   内容长度: ${result.contentLength}`);
      console.log(`   输出tokens: ${result.outputTokens}`);
      console.log(`   路由到Gemini: ${result.routedToGemini}`);
      console.log(`   模型: ${result.detectedModel}`);
      process.exit(1);
    }
    
  } catch (error) {
    console.log('❌ 测试执行失败:', error.message);
    process.exit(1);
  }
}

main();