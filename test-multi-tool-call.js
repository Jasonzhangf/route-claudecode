#!/usr/bin/env node
/**
 * 测试多工具调用问题
 */

const axios = require('axios');

async function testMultiToolCall() {
  const request = {
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      {
        role: 'user',
        content: [{ 
          type: 'text', 
          text: '请帮我：1) 计算 10 + 20，2) 获取当前时间，3) 查询天气信息' 
        }]
      }
    ],
    max_tokens: 300,
    tools: [
      {
        name: 'calculate',
        description: '数学计算',
        input_schema: {
          type: 'object',
          properties: { expression: { type: 'string' } },
          required: ['expression']
        }
      },
      {
        name: 'get_current_time',
        description: '获取当前时间',
        input_schema: { type: 'object', properties: {} }
      },
      {
        name: 'get_weather',
        description: '查询天气',
        input_schema: {
          type: 'object',
          properties: { location: { type: 'string' } },
          required: ['location']
        }
      }
    ]
  };

  try {
    console.log('🧪 测试多工具调用');
    console.log('发送请求...');
    
    const response = await axios.post('http://localhost:3456/v1/messages', request, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    console.log('\n📋 响应信息:');
    console.log(`Stop Reason: ${response.data.stop_reason}`);
    console.log(`Content Blocks: ${response.data.content.length}`);
    
    console.log('\n🔧 工具调用详情:');
    const toolCalls = response.data.content.filter(c => c.type === 'tool_use');
    console.log(`工具调用数量: ${toolCalls.length}`);
    
    toolCalls.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name}: ${JSON.stringify(tool.input)}`);
    });
    
    console.log('\n📝 文本内容:');
    const textBlocks = response.data.content.filter(c => c.type === 'text');
    textBlocks.forEach((text, index) => {
      console.log(`${index + 1}. ${text.text.substring(0, 100)}...`);
    });
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

testMultiToolCall();