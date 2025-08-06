/**
 * 测试shuaihong-openai endpoint的可用性
 */

const axios = require('axios');

async function testShuaihongEndpoint() {
  console.log('🧪 测试shuaihong-openai endpoint...\n');

  const endpoint = 'https://ai.shuaihong.fun/v1/chat/completions';
  const apiKey = 'sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl';

  // 测试1: 简单的非流式请求
  console.log('📋 测试1: 简单非流式请求');
  try {
    const response = await axios.post(endpoint, {
      model: 'qwen3-coder',
      messages: [
        { role: 'user', content: 'Hello, this is a test message.' }
      ],
      max_tokens: 50,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ 非流式请求成功');
    console.log(`状态码: ${response.status}`);
    console.log(`响应: ${JSON.stringify(response.data, null, 2).substring(0, 200)}...`);
  } catch (error) {
    console.log('❌ 非流式请求失败');
    console.log(`错误: ${error.message}`);
    if (error.response) {
      console.log(`HTTP状态: ${error.response.status}`);
      console.log(`响应数据: ${JSON.stringify(error.response.data)}`);
    }
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // 测试2: 流式请求
  console.log('📋 测试2: 流式请求');
  try {
    const response = await axios.post(endpoint, {
      model: 'qwen3-coder',
      messages: [
        { role: 'user', content: 'Count from 1 to 5.' }
      ],
      max_tokens: 50,
      stream: true
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream',
      timeout: 10000
    });

    console.log('✅ 流式请求连接成功');
    console.log(`状态码: ${response.status}`);

    let chunkCount = 0;
    response.data.on('data', (chunk) => {
      chunkCount++;
      const chunkStr = chunk.toString();
      console.log(`Chunk ${chunkCount}: ${chunkStr.substring(0, 100)}...`);
      
      if (chunkCount >= 3) {
        response.data.destroy(); // 停止接收更多数据
      }
    });

    response.data.on('end', () => {
      console.log(`✅ 流式请求完成，共接收 ${chunkCount} 个chunk`);
    });

    response.data.on('error', (error) => {
      console.log(`❌ 流式数据错误: ${error.message}`);
    });

    // 等待流完成或超时
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        response.data.destroy();
        resolve();
      }, 5000);

      response.data.on('end', () => {
        clearTimeout(timeout);
        resolve();
      });

      response.data.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

  } catch (error) {
    console.log('❌ 流式请求失败');
    console.log(`错误: ${error.message}`);
    if (error.response) {
      console.log(`HTTP状态: ${error.response.status}`);
      console.log(`响应头: ${JSON.stringify(error.response.headers)}`);
    }
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // 测试3: 带工具的请求（模拟大payload）
  console.log('📋 测试3: 带工具定义的请求');
  
  const tools = [
    {
      type: 'function',
      function: {
        name: 'test_tool',
        description: 'A test tool with a very long description that might cause payload size issues. This description is intentionally verbose to test how the API handles larger payloads. It includes multiple sentences and detailed explanations of what the tool does, its parameters, and expected behavior.',
        parameters: {
          type: 'object',
          properties: {
            input: {
              type: 'string',
              description: 'Test input parameter with a long description'
            }
          },
          required: ['input']
        }
      }
    }
  ];

  try {
    const response = await axios.post(endpoint, {
      model: 'qwen3-coder',
      messages: [
        { role: 'user', content: 'Use the test tool with input "hello".' }
      ],
      tools: tools,
      max_tokens: 50,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ 工具请求成功');
    console.log(`状态码: ${response.status}`);
    console.log(`响应: ${JSON.stringify(response.data, null, 2).substring(0, 300)}...`);
  } catch (error) {
    console.log('❌ 工具请求失败');
    console.log(`错误: ${error.message}`);
    if (error.response) {
      console.log(`HTTP状态: ${error.response.status}`);
      console.log(`响应数据: ${JSON.stringify(error.response.data)}`);
    }
    
    // 检查是否是payload过大的问题
    const payloadSize = JSON.stringify({
      model: 'qwen3-coder',
      messages: [{ role: 'user', content: 'Use the test tool with input "hello".' }],
      tools: tools,
      max_tokens: 50,
      stream: false
    }).length;
    
    console.log(`请求payload大小: ${payloadSize} 字符`);
  }

  console.log('\n💡 测试总结:');
  console.log('1. 如果所有测试都失败，说明endpoint不可用');
  console.log('2. 如果只有工具请求失败，可能是payload大小限制');
  console.log('3. 如果只有流式请求失败，可能是streaming实现问题');
}

testShuaihongEndpoint().catch(console.error);