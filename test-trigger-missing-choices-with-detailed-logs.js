#!/usr/bin/env node

/**
 * 使用详细调试日志触发missing choices错误
 * 目标：观察SDK调用链中每一步的数据流
 */

const axios = require('axios');

async function triggerErrorWithLogs() {
  console.log('🎯 触发missing choices错误并观察详细调试日志...\n');
  
  const requestData = {
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 100,
    messages: [{ role: 'user', content: 'Hello, create a test file' }],
    tools: [{
      type: 'function',
      function: {
        name: 'create_file',
        description: 'Create a file',
        parameters: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['filename', 'content']
        }
      }
    }]
  };
  
  console.log('📤 发送请求到系统...');
  console.log('请观察控制台中的以下调试标识:');
  console.log('  🔍 [SDK-DEBUG] - OpenAI SDK原始响应');
  console.log('  🔍 [FORMAT-FIX-DEBUG] - 格式修复后响应');
  console.log('  🔍 [TRANSFORMER-DEBUG] - Transformer输入数据');
  console.log('  🚨 [*-DEBUG] - 错误情况');
  console.log('');
  
  try {
    const response = await axios.post('http://localhost:5506/v1/messages', requestData, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test-key'
      },
      timeout: 15000
    });
    
    console.log('✅ 请求成功:', response.status);
    console.log('📦 响应数据:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ 请求失败:', error.response?.status || 'NETWORK');
    console.log('🚨 错误消息:', error.response?.data?.error?.message || error.message);
    
    if (error.response?.data?.error?.message?.includes('missing choices')) {
      console.log('🎯 成功触发了missing choices错误！');
      console.log('📋 请查看上面的调试日志来定位问题');
    }
  }
}

// 运行测试
triggerErrorWithLogs().then(() => {
  console.log('\n🏁 测试完成');
}).catch(console.error);