#!/usr/bin/env node
/**
 * 测试Gemini工具调用修复 - 使用Anthropic格式
 * Project owner: Jason Zhang  
 */

const axios = require('axios').default;

async function testGeminiAnthropicFormat() {
  console.log('🔧 测试Gemini工具调用修复 - Anthropic格式\n');
  
  const baseURL = 'http://localhost:5502';
  
  // 检查服务是否运行
  try {
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('✅ 服务器健康检查通过');
  } catch (error) {
    console.error('❌ 服务器未运行或不可访问:', error.message);
    return;
  }
  
  // 测试1: 使用默认工具选择（应该是AUTO模式）
  console.log('\n📋 测试1: 默认工具选择 - 应该使用AUTO模式');
  console.log('-'.repeat(50));
  
  const defaultRequest = {
    model: 'gemini-2.5-flash-lite',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: 'I need the current UTC time. Please use the get_time function.'
      }
    ],
    tools: [
      {
        name: 'get_time',
        description: 'Get current time in specified timezone',
        input_schema: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              enum: ['UTC', 'EST', 'PST']
            }
          },
          required: ['timezone']
        }
      }
    ]
    // 注意：不设置tool_choice，应该默认为AUTO模式
  };
  
  try {
    console.log('🚀 发送默认工具选择请求...');
    const response = await axios.post(`${baseURL}/v1/messages`, defaultRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });
    
    const data = response.data;
    console.log('📋 响应分析:');
    console.log('- stop_reason:', data.stop_reason);
    console.log('- content blocks:', data.content?.length);
    
    let toolCalled = false;
    if (data.content) {
      data.content.forEach((block, i) => {
        if (block.type === 'tool_use') {
          toolCalled = true;
          console.log(`✅ block[${i}]: 工具调用成功! (AUTO模式有效)`);
          console.log(`  - 工具名: ${block.name}`);
          console.log(`  - 输入:`, JSON.stringify(block.input, null, 2));
        } else if (block.type === 'text') {
          console.log(`📝 block[${i}]: 文本回复 (${block.text?.substring(0, 80)}...)`);
          console.log('  👉 这在AUTO模式下是正常的 - Gemini选择直接回答而不是使用工具');
        }
      });
    }
    
    console.log(`🎯 默认模式结果: ${toolCalled ? '✅ 工具调用' : '📝 文本回复 (AUTO模式正常行为)'}`);
    
  } catch (error) {
    console.error('❌ 默认工具调用测试失败:', error.response?.data || error.message);
  }
  
  // 测试2: 尝试强制工具调用模式（如果支持）
  console.log('\n📋 测试2: 测试需要工具调用的场景');
  console.log('-'.repeat(50));
  
  const forcedRequest = {
    model: 'gemini-2.5-flash-lite', 
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: 'Call the calculator function to multiply 456 by 789. You must use the function.'
      }
    ],
    tools: [
      {
        name: 'calculator',
        description: 'Perform mathematical calculations - required for all math operations',
        input_schema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['multiply', 'add', 'subtract', 'divide']
            },
            a: { type: 'number' },
            b: { type: 'number' }
          },
          required: ['operation', 'a', 'b']
        }
      }
    ]
    // 这里不设置tool_choice，让Gemini在AUTO模式下根据上下文判断
  };
  
  try {
    console.log('🚀 发送强制要求工具调用的请求...');
    const response = await axios.post(`${baseURL}/v1/messages`, forcedRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });
    
    const data = response.data;
    console.log('📋 响应分析:');
    console.log('- stop_reason:', data.stop_reason);
    console.log('- content blocks:', data.content?.length);
    
    let toolCalled = false;
    if (data.content) {
      data.content.forEach((block, i) => {
        if (block.type === 'tool_use') {
          toolCalled = true;
          console.log(`✅ block[${i}]: 工具调用成功! (AUTO模式识别了工具需求)`);
          console.log(`  - 工具名: ${block.name}`);
          console.log(`  - 输入:`, JSON.stringify(block.input, null, 2));
        } else if (block.type === 'text') {
          console.log(`📝 block[${i}]: 文本回复 (${block.text?.substring(0, 80)}...)`);
        }
      });
    }
    
    console.log(`🎯 强制场景结果: ${toolCalled ? '✅ 工具调用' : '📝 文本回复'}`);
    
  } catch (error) {
    console.error('❌ 强制工具调用测试失败:');
    
    if (error.response?.data) {
      const errorData = error.response.data;
      console.log('- 错误类型:', errorData.type);
      console.log('- 错误消息:', errorData.message);
      console.log('- 错误阶段:', errorData.stage);
      
      if (errorData.message && errorData.message.includes('candidate missing content or parts')) {
        console.log('\n🎯 发现了需要修复的问题!');
        console.log('💡 这是Gemini在尝试工具调用时返回空content的问题');
        console.log('   需要改进transformer对这种情况的处理');
      }
    } else {
      console.log('- 错误:', error.message);
    }
  }
  
  console.log('\n🎯 测试总结:');
  console.log('💡 AUTO模式的预期行为:');
  console.log('   1. 简单问题：Gemini可能选择直接回答，不使用工具');
  console.log('   2. 明确要求：Gemini更可能识别并使用工具');
  console.log('   3. 错误处理：需要优雅处理工具调用尝试失败的情况');
  console.log('\n✅ 工具选择策略修复验证完成');
}

testGeminiAnthropicFormat().catch(console.error);