#!/usr/bin/env node
/**
 * 测试3: 端到端完整流程测试
 * Project owner: Jason Zhang
 */

const axios = require('axios').default;

async function testGeminiEndToEnd() {
  console.log('🧪 测试3: Gemini端到端完整流程测试');
  console.log('='.repeat(60));

  const baseURL = 'http://localhost:5502';
  
  // 检查服务是否运行
  try {
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('✅ 服务器健康检查通过');
  } catch (error) {
    console.error('❌ 服务器未运行或不可访问:', error.message);
    return false;
  }

  // 测试用例1: 简单工具调用
  console.log('\n📊 用例1: 简单计算工具');
  console.log('-'.repeat(40));
  
  const simpleRequest = {
    model: 'gemini-2.5-flash-lite',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: 'Use the calculator to compute 8 × 9'
      }
    ],
    tools: [
      {
        name: 'calculator',
        description: 'Perform mathematical calculations',
        input_schema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['add', 'subtract', 'multiply', 'divide']
            },
            a: { type: 'number' },
            b: { type: 'number' }
          },
          required: ['operation', 'a', 'b']
        }
      }
    ]
  };

  try {
    console.log('🚀 发送简单计算请求...');
    const simpleResponse = await axios.post(`${baseURL}/v1/messages`, simpleRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });

    const simpleData = simpleResponse.data;
    console.log('📋 响应分析:');
    console.log('- stop_reason:', simpleData.stop_reason);
    console.log('- content blocks:', simpleData.content?.length);
    
    let simpleToolCalled = false;
    if (simpleData.content) {
      simpleData.content.forEach((block, i) => {
        if (block.type === 'tool_use') {
          simpleToolCalled = true;
          console.log(`✅ block[${i}]: 工具调用成功!`);
          console.log(`  - 工具名: ${block.name}`);
          console.log(`  - 输入:`, JSON.stringify(block.input, null, 2));
        } else if (block.type === 'text') {
          console.log(`❌ block[${i}]: 文本回复 (${block.text?.substring(0, 50)}...)`);
        }
      });
    }
    
    console.log(`🎯 简单工具调用结果: ${simpleToolCalled ? '✅ 成功' : '❌ 失败'}`);
    
  } catch (error) {
    console.error('❌ 简单工具调用测试失败:', error.response?.data || error.message);
  }

  // 测试用例2: 多工具调用
  console.log('\n🔧 用例2: 多工具选择');
  console.log('-'.repeat(40));
  
  const multiRequest = {
    model: 'gemini-2.5-flash-lite',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: 'I need to write "Hello World" to a file called greeting.txt'
      }
    ],
    tools: [
      {
        name: 'write_file',
        description: 'Write content to a file',
        input_schema: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['filename', 'content']
        }
      },
      {
        name: 'read_file',
        description: 'Read content from a file',
        input_schema: {
          type: 'object',
          properties: {
            filename: { type: 'string' }
          },
          required: ['filename']
        }
      },
      {
        name: 'delete_file',
        description: 'Delete a file',
        input_schema: {
          type: 'object',
          properties: {
            filename: { type: 'string' }
          },
          required: ['filename']
        }
      }
    ]
  };

  try {
    console.log('🚀 发送多工具请求...');
    const multiResponse = await axios.post(`${baseURL}/v1/messages`, multiRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });

    const multiData = multiResponse.data;
    console.log('📋 响应分析:');
    console.log('- stop_reason:', multiData.stop_reason);
    console.log('- content blocks:', multiData.content?.length);
    
    let multiToolCalled = false;
    if (multiData.content) {
      multiData.content.forEach((block, i) => {
        if (block.type === 'tool_use') {
          multiToolCalled = true;
          console.log(`✅ block[${i}]: 工具调用成功!`);
          console.log(`  - 工具名: ${block.name}`);
          console.log(`  - 输入:`, JSON.stringify(block.input, null, 2));
        } else if (block.type === 'text') {
          console.log(`❌ block[${i}]: 文本回复 (${block.text?.substring(0, 50)}...)`);
        }
      });
    }
    
    console.log(`🎯 多工具调用结果: ${multiToolCalled ? '✅ 成功' : '❌ 失败'}`);
    
  } catch (error) {
    console.error('❌ 多工具调用测试失败:', error.response?.data || error.message);
  }

  // 测试用例3: 强制工具调用
  console.log('\n⚡ 用例3: 强制工具调用模式');
  console.log('-'.repeat(40));
  
  const forceRequest = {
    model: 'gemini-2.5-flash-lite',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: 'I command you to call the get_time function with timezone UTC. Do not respond with text, only call the function.'
      }
    ],
    tools: [
      {
        name: 'get_time',
        description: 'Get current time for a specific timezone',
        input_schema: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              enum: ['UTC', 'PST', 'EST', 'CST']
            }
          },
          required: ['timezone']
        }
      }
    ]
  };

  try {
    console.log('🚀 发送强制工具调用请求...');
    const forceResponse = await axios.post(`${baseURL}/v1/messages`, forceRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });

    const forceData = forceResponse.data;
    console.log('📋 响应分析:');
    console.log('- stop_reason:', forceData.stop_reason);
    console.log('- content blocks:', forceData.content?.length);
    
    let forceToolCalled = false;
    if (forceData.content) {
      forceData.content.forEach((block, i) => {
        if (block.type === 'tool_use') {
          forceToolCalled = true;
          console.log(`✅ block[${i}]: 工具调用成功!`);
          console.log(`  - 工具名: ${block.name}`);
          console.log(`  - 输入:`, JSON.stringify(block.input, null, 2));
        } else if (block.type === 'text') {
          console.log(`❌ block[${i}]: 文本回复 (${block.text?.substring(0, 50)}...)`);
        }
      });
    }
    
    console.log(`🎯 强制工具调用结果: ${forceToolCalled ? '✅ 成功' : '❌ 失败'}`);
    
  } catch (error) {
    console.error('❌ 强制工具调用测试失败:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 测试3完成: 端到端测试');
  console.log('='.repeat(60));
}

// 添加axios依赖检查
try {
  require('axios');
} catch (error) {
  console.error('❌ 缺少axios依赖，请先安装: npm install axios');
  process.exit(1);
}

testGeminiEndToEnd().catch(console.error);