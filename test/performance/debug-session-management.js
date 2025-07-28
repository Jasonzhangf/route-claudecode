#!/usr/bin/env node

/**
 * 调试会话管理功能
 * 检查会话状态和历史记录
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

async function debugSessionManagement() {
  console.log('🔍 调试会话管理功能...\n');

  const baseUrl = 'http://127.0.0.1:3456';
  const sessionId = `debug-session-${Date.now()}`;
  
  console.log(`📋 调试配置:`);
  console.log(`   基础URL: ${baseUrl}`);
  console.log(`   会话ID: ${sessionId}`);

  try {
    // 第一次请求 - 简单消息
    console.log('\n💬 第1轮 - 简单消息:');
    const response1 = await sendMessage(baseUrl, sessionId, "Hello, how are you?");
    console.log(`   响应长度: ${response1.length} 字符`);
    console.log(`   响应预览: ${response1.substring(0, 100)}...`);

    await sleep(1000);

    // 第二次请求 - 引用第一次
    console.log('\n💬 第2轮 - 引用历史:');
    const response2 = await sendMessage(baseUrl, sessionId, "What did I just ask you?");
    console.log(`   响应长度: ${response2.length} 字符`);
    console.log(`   响应预览: ${response2.substring(0, 100)}...`);
    
    const mentionsFirstMessage = response2.toLowerCase().includes('hello') || 
                                response2.toLowerCase().includes('how are you');
    console.log(`   是否提及第一条消息: ${mentionsFirstMessage ? '✅ 是' : '❌ 否'}`);

    await sleep(1000);

    // 第三次请求 - 测试上下文累积
    console.log('\n💬 第3轮 - 上下文累积:');
    const response3 = await sendMessage(baseUrl, sessionId, "Now tell me everything we discussed so far.");
    console.log(`   响应长度: ${response3.length} 字符`);
    console.log(`   响应预览: ${response3.substring(0, 150)}...`);
    
    const hasContext = response3.length > 50; // 期望有详细回顾
    console.log(`   是否包含上下文: ${hasContext ? '✅ 是' : '❌ 否'}`);

    // 分析结果
    console.log('\n📊 会话管理分析:');
    console.log(`   会话ID一致性: ✅ 使用统一ID: ${sessionId}`);
    console.log(`   历史记忆: ${mentionsFirstMessage ? '✅ 正常' : '❌ 异常'}`);
    console.log(`   上下文累积: ${hasContext ? '✅ 正常' : '❌ 异常'}`);

    const overall = mentionsFirstMessage && hasContext;
    console.log(`   整体状态: ${overall ? '✅ 正常' : '❌ 异常'}`);

    // 保存调试结果
    const debugResults = {
      timestamp: new Date().toISOString(),
      sessionId: sessionId,
      tests: [
        {
          turn: 1,
          message: "Hello, how are you?",
          response: response1,
          responseLength: response1.length
        },
        {
          turn: 2,
          message: "What did I just ask you?",
          response: response2,
          responseLength: response2.length,
          mentionsFirstMessage: mentionsFirstMessage
        },
        {
          turn: 3,
          message: "Now tell me everything we discussed so far.",
          response: response3,
          responseLength: response3.length,
          hasContext: hasContext
        }
      ],
      analysis: {
        sessionIdConsistency: true,
        historyMemory: mentionsFirstMessage,
        contextAccumulation: hasContext,
        overall: overall
      }
    };

    const resultFile = path.join(__dirname, 'debug', 'debug-output', `session-debug-${sessionId}.json`);
    const resultDir = path.dirname(resultFile);
    if (!fs.existsSync(resultDir)) {
      fs.mkdirSync(resultDir, { recursive: true });
    }
    fs.writeFileSync(resultFile, JSON.stringify(debugResults, null, 2));
    console.log(`\n💾 调试结果已保存: ${resultFile}`);

    return overall;

  } catch (error) {
    console.error('\n❌ 调试执行失败:', error);
    return false;
  }
}

async function sendMessage(baseUrl, sessionId, message) {
  const requestBody = {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: message
    }],
    stream: true
  };

  const headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'Authorization': 'Bearer test-key',
    'x-session-id': sessionId
  };

  console.log(`   发送: ${message}`);

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // 读取流式响应
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const eventData = JSON.parse(line.substring(6));
          if (eventData.type === 'content_block_delta' &&
              eventData.delta && eventData.delta.text) {
            fullResponse += eventData.delta.text;
          }
        } catch (e) {
          // 忽略非JSON数据
        }
      }
    }
  }

  console.log(`   收到: ${fullResponse}`);
  return fullResponse;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行调试
if (require.main === module) {
  debugSessionManagement()
    .then(success => {
      console.log(`\n${success ? '✅ 会话管理功能正常' : '❌ 会话管理功能异常'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(console.error);
}

module.exports = { debugSessionManagement };