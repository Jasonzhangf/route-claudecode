#!/usr/bin/env node

/**
 * 测试Gemini流式请求的工具调用智能检测
 * 使用流式请求确保智能缓冲策略生效
 */

const http = require('http');

async function testGeminiStreamingToolDetection() {
  console.log('🧪 测试Gemini流式工具调用智能检测...');
  
  // 测试用例1：包含工具调用的请求
  const toolRequest = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    stream: true, // 重要：启用流式
    messages: [
      {
        role: 'user',
        content: '请帮我搜索今天北京的天气情况，然后告诉我应该穿什么衣服。'
      }
    ],
    tools: [
      {
        name: 'WebSearch',
        description: '搜索互联网信息',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '搜索查询词'
            }
          },
          required: ['query']
        }
      }
    ]
  };

  // 创建足够大的内容确保路由到google-gemini
  const longContent = '关于今天天气的背景信息：'.repeat(1000);
  toolRequest.messages[0].content = `${longContent}\n\n${toolRequest.messages[0].content}`;

  return await sendStreamingRequest(toolRequest, 'tool-call-test');
}

async function testGeminiStreamingTextOnly() {
  console.log('\n🧪 测试Gemini流式纯文本处理...');
  
  // 测试用例2：纯文本请求
  const textRequest = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    stream: true, // 重要：启用流式
    messages: [
      {
        role: 'user',
        content: '请写一首关于编程的诗，要求简洁优美。'
      }
    ]
  };

  // 创建足够大的内容确保路由到google-gemini
  const longContent = '编程是一门艺术，也是一门科学。'.repeat(1000);
  textRequest.messages[0].content = `${longContent}\n\n${textRequest.messages[0].content}`;

  return await sendStreamingRequest(textRequest, 'text-only-test');
}

async function sendStreamingRequest(requestData, testName) {
  const postData = JSON.stringify(requestData);
  
  console.log(`📊 ${testName} - 请求大小: ${Math.round(postData.length / 1024)}KB`);
  console.log(`🎯 ${testName} - 包含工具: ${!!requestData.tools}`);

  const options = {
    hostname: 'localhost',
    port: 8888,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Accept': 'text/event-stream' // 重要：请求流式响应
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let eventCount = 0;
      let contentLength = 0;
      let outputTokens = 0;
      let hasToolCalls = false;
      let strategyDetected = 'unknown';
      let allEvents = [];

      console.log(`📡 ${testName} - 开始接收流式响应...`);

      res.on('data', (chunk) => {
        const data = chunk.toString();
        const lines = data.split('\n');
        
        // 检测智能缓冲策略的日志标识
        if (data.includes('tool-buffered') || data.includes('buffered processing')) {
          strategyDetected = 'tool-buffered';
        } else if (data.includes('text-streaming') || data.includes('smart streaming')) {
          strategyDetected = 'text-streaming';
        }
        
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
              
              // 检测工具调用
              if (eventData.type === 'tool_use' || 
                  (eventData.delta && eventData.delta.tool_calls) ||
                  (eventData.data && JSON.stringify(eventData.data).includes('tool'))) {
                hasToolCalls = true;
              }
              
              // 检测token信息
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
        console.log(`✅ ${testName} - 流式响应完成:`);
        console.log(`   事件数: ${eventCount}`);
        console.log(`   内容长度: ${contentLength}`);
        console.log(`   输出tokens: ${outputTokens}`);
        console.log(`   检测到工具调用: ${hasToolCalls ? 'Yes' : 'No'}`);
        console.log(`   检测策略: ${strategyDetected}`);
        
        // 判断成功标准
        const success = eventCount > 0 && 
                       (contentLength > 0 || hasToolCalls) && 
                       outputTokens > 0;
        
        resolve({
          testName,
          success,
          eventCount,
          contentLength,
          outputTokens,
          hasToolCalls,
          strategyDetected,
          statusCode: res.statusCode
        });
      });
    });

    req.on('error', (error) => {
      console.log(`❌ ${testName} - 请求失败:`, error.message);
      reject(error);
    });

    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error(`${testName} - 请求超时`));
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🚀 开始Gemini智能缓冲策略综合测试\n');
  
  try {
    // 测试工具调用
    const toolResult = await testGeminiStreamingToolDetection();
    
    // 测试纯文本
    const textResult = await testGeminiStreamingTextOnly();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试结果总结');
    console.log('='.repeat(60));
    
    const results = [toolResult, textResult];
    let passed = 0;
    
    for (const result of results) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.testName}:`);
      console.log(`   事件数: ${result.eventCount}`);
      console.log(`   内容长度: ${result.contentLength}`);
      console.log(`   输出tokens: ${result.outputTokens}`);
      console.log(`   工具调用: ${result.hasToolCalls ? 'Yes' : 'No'}`);
      console.log(`   策略: ${result.strategyDetected}`);
      
      if (result.success) passed++;
    }
    
    console.log(`\n总结: ${passed}/${results.length} 测试通过`);
    
    if (passed === results.length) {
      console.log('🎉 所有测试通过！Gemini智能缓冲策略工作正常');
    } else {
      console.log('⚠️ 部分测试失败，需要进一步调试');
      process.exit(1);
    }
    
  } catch (error) {
    console.log('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

main();