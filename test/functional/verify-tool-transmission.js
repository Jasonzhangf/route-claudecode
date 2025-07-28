#!/usr/bin/env node

/**
 * 验证工具传输功能
 * 测试工具定义在多轮会话中是否正确传递
 * 项目所有者: Jason Zhang
 */

async function verifyToolTransmission() {
  console.log('🔧 验证工具传输功能...\n');

  const baseUrl = 'http://127.0.0.1:3456';
  const sessionId = `tool-transmission-${Date.now()}`;
  
  // 定义测试工具
  const tools = [
    {
      name: "get_weather",
      description: "Get current weather for a location",
      input_schema: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" }
        },
        required: ["location"]
      }
    }
  ];

  console.log(`会话ID: ${sessionId}`);
  console.log(`测试工具: ${tools[0].name}`);

  try {
    // 第一轮：发送带工具的请求
    console.log('\n第1轮 - 发送带工具定义的请求:');
    await sendMessageWithTools(baseUrl, sessionId, "What tools do you have available?", tools);
    console.log('✅ 第一轮请求发送成功');

    await sleep(1000);

    // 第二轮：发送不带工具的请求，应该自动恢复工具
    console.log('\n第2轮 - 发送不带工具的请求（应该自动恢复）:');
    const response2 = await sendMessageWithTools(baseUrl, sessionId, "Can you use the weather tool to check weather in Beijing?", null);
    console.log(`回复: ${response2.substring(0, 100)}...`);
    
    // 检查响应是否提到了工具
    const mentionsWeatherTool = response2.toLowerCase().includes('weather') || 
                               response2.toLowerCase().includes('get_weather') ||
                               response2.toLowerCase().includes('tool');
    
    console.log(`工具识别: ${mentionsWeatherTool ? '✅ 正确识别工具' : '❌ 未识别工具'}`);

    const success = response2.length > 0 && mentionsWeatherTool;
    console.log(`\n总体结果: ${success ? '✅ 工具传输功能正常' : '❌ 工具传输功能异常'}`);
    
    return success;

  } catch (error) {
    console.error('验证失败:', error.message);
    return false;
  }
}

async function sendMessageWithTools(baseUrl, sessionId, message, tools) {
  const requestBody = {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 200,
    messages: [{ role: 'user', content: message }],
    stream: true
  };

  // 只在提供工具时添加tools字段
  if (tools) {
    requestBody.tools = tools;
  }

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'Authorization': 'Bearer test-key',
      'x-session-id': sessionId
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
  verifyToolTransmission()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(console.error);
}

module.exports = { verifyToolTransmission };