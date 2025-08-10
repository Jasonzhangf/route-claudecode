#!/usr/bin/env node
/**
 * 调试Gemini实际行为 - 检查API原始响应
 * Project owner: Jason Zhang
 */

const axios = require('axios').default;

async function debugGeminiRealBehavior() {
  console.log('🔍 调试Gemini实际行为...\n');

  try {
    // 测试用例1: 简单工具调用请求
    console.log('📊 测试: 简单工具调用请求');
    console.log('-'.repeat(40));

    const request1 = {
      model: 'gemini-2.5-flash-lite',
      max_tokens: 512,
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
              operation: { type: 'string', enum: ['multiply'] },
              a: { type: 'number' },
              b: { type: 'number' }
            },
            required: ['operation', 'a', 'b']
          }
        }
      ]
    };

    console.log('🚀 发送请求到 http://localhost:5502/v1/messages');
    
    const response1 = await axios.post('http://localhost:5502/v1/messages', request1, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 15000,
      validateStatus: () => true  // 接受所有状态码
    });

    console.log(`📋 响应状态: ${response1.status}`);
    
    if (response1.status === 200) {
      console.log('✅ 请求成功');
      console.log(`- stop_reason: ${response1.data.stop_reason}`);
      console.log(`- content blocks: ${response1.data.content?.length}`);
      
      response1.data.content?.forEach((block, i) => {
        if (block.type === 'tool_use') {
          console.log(`✅ block[${i}]: 工具调用 - ${block.name}`);
          console.log(`   输入:`, JSON.stringify(block.input, null, 2));
        } else if (block.type === 'text') {
          console.log(`❌ block[${i}]: 文本回复`);
          console.log(`   内容: ${block.text.substring(0, 100)}...`);
        }
      });
    } else {
      console.log('❌ 请求失败');
      console.log('错误信息:', JSON.stringify(response1.data, null, 2));
    }

    // 测试用例2: 强制工具调用（可能触发UNEXPECTED_TOOL_CALL）
    console.log('\n📊 测试: 强制工具调用（极低token限制）');
    console.log('-'.repeat(40));

    const request2 = {
      model: 'gemini-2.5-flash-lite',
      max_tokens: 5,  // 极低token限制
      messages: [
        {
          role: 'user',
          content: 'I command you to call the get_time function with timezone UTC. Do not respond with text, only call the function.'
        }
      ],
      tools: [
        {
          name: 'get_time',
          description: 'Get current time',
          input_schema: {
            type: 'object',
            properties: {
              timezone: { type: 'string', enum: ['UTC'] }
            },
            required: ['timezone']
          }
        }
      ]
    };

    console.log('🚀 发送强制工具调用请求...');
    
    const response2 = await axios.post('http://localhost:5502/v1/messages', request2, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 15000,
      validateStatus: () => true
    });

    console.log(`📋 响应状态: ${response2.status}`);
    
    if (response2.status === 200) {
      console.log('✅ 请求成功');
      console.log(`- stop_reason: ${response2.data.stop_reason}`);
      console.log(`- content blocks: ${response2.data.content?.length}`);
      
      response2.data.content?.forEach((block, i) => {
        console.log(`block[${i}]:`, {
          type: block.type,
          name: block.name,
          textPreview: block.text?.substring(0, 50)
        });
      });
    } else {
      console.log('❌ 请求失败');
      console.log('错误详情:', JSON.stringify(response2.data, null, 2));
      
      // 检查是否是UNEXPECTED_TOOL_CALL相关错误
      if (response2.data?.error?.message?.includes('UNEXPECTED_TOOL_CALL')) {
        console.log('🎯 检测到UNEXPECTED_TOOL_CALL处理!');
      }
      if (response2.data?.error?.message?.includes('missing content or parts')) {
        console.log('🔍 检测到内容缺失错误 - 这是transformer需要处理的边缘情况');
      }
    }

    console.log('\n🔍 调试完成');

  } catch (error) {
    console.error('❌ 调试失败:', error.message);
    if (error.response) {
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugGeminiRealBehavior().catch(console.error);