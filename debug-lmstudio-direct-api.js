#!/usr/bin/env node

/**
 * 直接测试LMStudio API，看实际返回什么格式
 */

const axios = require('axios');

async function testLMStudioAPI() {
  console.log('🔍 直接测试LMStudio API...\n');

  const testData = {
    model: 'gpt-oss-20b-mlx',
    messages: [
      {
        role: 'user', 
        content: 'Hello, create a file named test.txt with content "hello world"'
      }
    ],
    tools: [{
      type: 'function',
      function: {
        name: 'create_file',
        description: 'Create a file with specified content',
        parameters: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['filename', 'content']
        }
      }
    }],
    stream: false,
    temperature: 0.7,
    max_tokens: 1000
  };

  try {
    console.log('📤 发送请求到 LMStudio (http://localhost:1234/v1/chat/completions)...');
    
    const response = await axios.post('http://localhost:1234/v1/chat/completions', testData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer lm-studio-local-key'
      },
      timeout: 30000
    });

    console.log('✅ LMStudio API 响应成功！\n');
    
    console.log('📊 响应状态:', response.status);
    console.log('📦 响应数据结构:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // 检查关键字段
    console.log('\n🔍 关键字段检查:');
    console.log('  - 有choices字段:', !!response.data.choices);
    console.log('  - choices长度:', response.data.choices?.length || 0);
    
    if (response.data.choices && response.data.choices[0]) {
      const choice = response.data.choices[0];
      console.log('  - 第一个choice结构:');
      console.log('    - message:', !!choice.message);
      console.log('    - message.content:', !!choice.message?.content);
      console.log('    - message.tool_calls:', !!choice.message?.tool_calls);
      console.log('    - finish_reason:', choice.finish_reason);
      
      if (choice.message?.content) {
        console.log('  - 内容预览:', choice.message.content.substring(0, 200) + '...');
      }
    }
    
  } catch (error) {
    console.log('❌ LMStudio API 请求失败:');
    console.log('  - 错误类型:', error.constructor.name);
    console.log('  - 错误消息:', error.message);
    
    if (error.response) {
      console.log('  - HTTP状态:', error.response.status);
      console.log('  - 响应数据:', JSON.stringify(error.response.data, null, 2));
    } else if (error.code) {
      console.log('  - 错误代码:', error.code);
    }
  }
}

// 运行测试
testLMStudioAPI().then(() => {
  console.log('\n🏁 LMStudio API 直接测试完成');
}).catch(console.error);