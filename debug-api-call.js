#!/usr/bin/env node
/**
 * 调试API调用问题
 */

const axios = require('axios');

async function debugAPICall() {
  console.log('🔍 调试API调用问题');
  console.log('='.repeat(50));

  // 测试1: 非流式请求（已知工作正常）
  console.log('🧪 测试1: 非流式请求');
  const nonStreamRequest = {
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: '请计算 42 / 6' }]
      }
    ],
    max_tokens: 200,
    tools: [
      {
        name: 'calculate',
        description: '数学计算',
        input_schema: {
          type: 'object',
          properties: { 
            expression: { type: 'string', description: '数学表达式' }
          },
          required: ['expression']
        }
      }
    ]
  };

  try {
    const response = await axios.post('http://localhost:3456/v1/messages', nonStreamRequest, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    console.log(`✅ 非流式请求成功: ${response.status}`);
    console.log(`📋 Stop Reason: ${response.data.stop_reason}`);
    console.log(`🔧 Content Blocks: ${response.data.content.length}`);
    
    const toolCalls = response.data.content.filter(c => c.type === 'tool_use');
    console.log(`🛠️  工具调用数量: ${toolCalls.length}`);
    
  } catch (error) {
    console.error('❌ 非流式请求失败:', error.message);
    return;
  }

  // 测试2: 简单流式请求（无工具）
  console.log('\n🧪 测试2: 简单流式请求（无工具）');
  const simpleStreamRequest = {
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: '你好' }]
      }
    ],
    max_tokens: 50,
    stream: true
  };

  try {
    const response = await axios.post('http://localhost:3456/v1/messages', simpleStreamRequest, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'stream',
      timeout: 30000,
      validateStatus: function (status) {
        return status < 600;
      }
    });

    console.log(`📋 简单流式响应状态: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ 简单流式请求成功');
      
      let chunkCount = 0;
      response.data.on('data', (chunk) => {
        chunkCount++;
        if (chunkCount <= 3) {
          console.log(`📦 Chunk ${chunkCount}: ${chunk.toString().substring(0, 100)}...`);
        }
        if (chunkCount > 5) {
          response.data.destroy();
        }
      });

      response.data.on('end', () => {
        console.log(`✅ 简单流式响应完成，总共 ${chunkCount} 个chunks`);
      });

    } else {
      console.log('❌ 简单流式请求失败');
      let errorData = '';
      response.data.on('data', (chunk) => {
        errorData += chunk.toString();
      });
      response.data.on('end', () => {
        console.log('🚨 错误内容:', errorData);
      });
    }

  } catch (error) {
    console.error('❌ 简单流式请求异常:', error.message);
  }

  // 等待一下让流式响应完成
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 测试3: 带工具的流式请求
  console.log('\n🧪 测试3: 带工具的流式请求');
  const toolStreamRequest = {
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: '请计算 42 / 6' }]
      }
    ],
    max_tokens: 200,
    stream: true,
    tools: [
      {
        name: 'calculate',
        description: '数学计算',
        input_schema: {
          type: 'object',
          properties: { 
            expression: { type: 'string', description: '数学表达式' }
          },
          required: ['expression']
        }
      }
    ]
  };

  try {
    const response = await axios.post('http://localhost:3456/v1/messages', toolStreamRequest, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'stream',
      timeout: 30000,
      validateStatus: function (status) {
        return status < 600;
      }
    });

    console.log(`📋 工具流式响应状态: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ 工具流式请求成功');
    } else {
      console.log('❌ 工具流式请求失败');
      let errorData = '';
      response.data.on('data', (chunk) => {
        errorData += chunk.toString();
      });
      response.data.on('end', () => {
        console.log('🚨 错误内容:', errorData);
      });
    }

  } catch (error) {
    console.error('❌ 工具流式请求异常:', error.message);
  }
}

debugAPICall();