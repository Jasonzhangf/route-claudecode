#!/usr/bin/env node

/**
 * 基础会话验证测试
 * 验证最基本的多轮会话功能是否正常工作
 * 项目所有者: Jason Zhang
 */

async function verifyBasicSession() {
  console.log('🔍 验证基础会话功能...\n');

  const baseUrl = 'http://127.0.0.1:3456';
  const sessionId = `verify-${Date.now()}`;
  
  console.log(`会话ID: ${sessionId}`);

  try {
    // 第一轮：简单问候
    console.log('\n第1轮：');
    const response1 = await sendMessage(baseUrl, sessionId, "你好，我是测试用户");
    console.log(`回复1: ${response1.substring(0, 50)}...`);
    const hasGreeting = response1.length > 0;
    console.log(`状态: ${hasGreeting ? '✅' : '❌'}`);

    if (!hasGreeting) {
      console.log('❌ 第一轮就失败了，基础功能有问题');
      return false;
    }

    await sleep(1000);

    // 第二轮：测试记忆
    console.log('\n第2轮：');
    const response2 = await sendMessage(baseUrl, sessionId, "我刚才说我是什么用户？");
    console.log(`回复2: ${response2.substring(0, 50)}...`);
    const hasMemory = response2.includes('测试') || response2.includes('test');
    console.log(`记忆测试: ${hasMemory ? '✅' : '❌'}`);

    // 最终判断
    const success = hasGreeting && hasMemory;
    console.log(`\n总体结果: ${success ? '✅ 基础会话功能正常' : '❌ 基础会话功能异常'}`);
    
    return success;

  } catch (error) {
    console.error('验证失败:', error.message);
    return false;
  }
}

async function sendMessage(baseUrl, sessionId, message) {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'Authorization': 'Bearer test-key',
      'x-session-id': sessionId
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 150,
      messages: [{ role: 'user', content: message }],
      stream: true
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

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
          if (eventData.type === 'content_block_delta' && eventData.delta && eventData.delta.text) {
            fullResponse += eventData.delta.text;
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }

  return fullResponse;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (require.main === module) {
  verifyBasicSession()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(console.error);
}

module.exports = { verifyBasicSession };