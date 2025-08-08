#!/usr/bin/env node
/**
 * 调试流式响应错误
 */

const axios = require('axios');

async function debugStreamingError() {
  console.log('🔍 调试流式响应错误');
  console.log('='.repeat(50));

  const request = {
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
    console.log('📤 发送流式请求...');
    
    const response = await axios.post('http://localhost:3456/v1/messages', request, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'stream',
      timeout: 30000,
      validateStatus: function (status) {
        return status < 600; // 接受所有状态码以便调试
      }
    });

    console.log(`📋 响应状态: ${response.status}`);
    console.log(`📋 响应头: ${JSON.stringify(response.headers, null, 2)}`);

    if (response.status !== 200) {
      console.log('❌ 非200状态码，读取错误信息...');
      
      let errorData = '';
      response.data.on('data', (chunk) => {
        errorData += chunk.toString();
      });
      
      response.data.on('end', () => {
        console.log('🚨 错误响应内容:');
        console.log(errorData);
      });
      
      return;
    }

    // 处理正常的流式响应
    let chunkCount = 0;
    response.data.on('data', (chunk) => {
      chunkCount++;
      console.log(`📦 Chunk ${chunkCount}:`);
      console.log(chunk.toString());
      console.log('-'.repeat(30));
      
      if (chunkCount > 10) {
        response.data.destroy();
      }
    });

    response.data.on('end', () => {
      console.log(`✅ 流式响应完成，总共 ${chunkCount} 个chunks`);
    });

    response.data.on('error', (error) => {
      console.error('🚨 流式响应错误:', error.message);
    });

  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    
    if (error.response) {
      console.log(`📋 错误状态: ${error.response.status}`);
      console.log(`📋 错误头: ${JSON.stringify(error.response.headers, null, 2)}`);
      
      if (error.response.data) {
        console.log('🚨 错误数据:');
        console.log(error.response.data);
      }
    }
  }
}

debugStreamingError();