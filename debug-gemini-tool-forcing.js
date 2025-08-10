#!/usr/bin/env node
/**
 * 深度调试Gemini工具调用问题 - 分析为什么不使用工具
 * Project owner: Jason Zhang
 */

const axios = require('axios').default;

async function debugGeminiToolForcing() {
  console.log('🔍 深度调试Gemini工具调用问题\n');
  
  const baseURL = 'http://localhost:5502';
  
  // 测试1: 检查实际发送到Gemini API的请求
  console.log('📋 测试1: 强制工具调用模式分析');
  console.log('-'.repeat(50));
  
  const forcedRequest = {
    model: 'gemini-2.5-flash-lite',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: 'MUST call the calculator function to multiply 123 by 456. This is absolutely required!'
      }
    ],
    tools: [
      {
        name: 'calculator',
        description: 'Perform mathematical calculations - REQUIRED for all math operations',
        input_schema: {
          type: 'object',
          properties: {
            operation: { type: 'string', enum: ['multiply', 'add', 'subtract', 'divide'] },
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' }
          },
          required: ['operation', 'a', 'b']
        }
      }
    ]
  };
  
  try {
    console.log('🚀 发送强制工具调用请求...');
    const response = await axios.post(`${baseURL}/v1/messages`, forcedRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });
    
    const data = response.data;
    console.log('📊 响应详细分析:');
    console.log('- stop_reason:', data.stop_reason);
    console.log('- content blocks:', data.content?.length);
    console.log('- 完整响应:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ 请求失败:', error.response?.data || error.message);
  }
  
  // 测试2: 直接测试Gemini原生API看看是否支持工具调用
  console.log('\n📋 测试2: 直接调用Gemini API验证工具支持');
  console.log('-'.repeat(50));
  
  try {
    const fs = require('fs');
    const configPath = process.env.HOME + '/.route-claude-code/config/single-provider/config-google-gemini-5502.json';
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    let apiKey = config.providers?.['google-gemini']?.authentication?.credentials?.apiKey;
    if (Array.isArray(apiKey)) {
      apiKey = apiKey[0];
    }
    
    const directRequest = {
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Call the calculator function to compute 789 * 123. You MUST use the function!' }]
        }
      ],
      tools: [
        {
          functionDeclarations: [
            {
              name: 'calculator',
              description: 'Perform mathematical calculations',
              parameters: {
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
        }
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: 'ANY',  // 强制使用工具
          allowedFunctionNames: ['calculator']
        }
      },
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.1
      }
    };
    
    console.log('🚀 直接调用Gemini API...');
    console.log('📝 请求配置:');
    console.log('- toolConfig.mode:', directRequest.toolConfig.functionCallingConfig.mode);
    console.log('- allowedFunctionNames:', directRequest.toolConfig.functionCallingConfig.allowedFunctionNames);
    
    const directResponse = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
      directRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        }
      }
    );
    
    const directData = directResponse.data;
    console.log('📊 Gemini原生API响应:');
    console.log('- candidates数量:', directData.candidates?.length);
    
    if (directData.candidates?.[0]) {
      const candidate = directData.candidates[0];
      console.log('- finishReason:', candidate.finishReason);
      console.log('- content存在:', !!candidate.content);
      console.log('- parts数量:', candidate.content?.parts?.length);
      
      if (candidate.content?.parts) {
        candidate.content.parts.forEach((part, i) => {
          console.log(`- part[${i}]:`, {
            hasText: !!part.text,
            hasFunctionCall: !!part.functionCall,
            textPreview: part.text ? part.text.substring(0, 100) : null,
            functionCall: part.functionCall ? { 
              name: part.functionCall.name, 
              args: part.functionCall.args 
            } : null
          });
        });
      }
      
      const hasToolCall = candidate.content?.parts?.some(p => p.functionCall);
      console.log('🎯 原生API工具调用结果:', hasToolCall ? '✅ 成功' : '❌ 失败');
      
      if (!hasToolCall && candidate.finishReason === 'UNEXPECTED_TOOL_CALL') {
        console.log('⚠️ 原生API也返回UNEXPECTED_TOOL_CALL');
        console.log('💡 这表明问题可能在于:');
        console.log('   1. Gemini API本身的工具调用限制');
        console.log('   2. 模型版本不支持工具调用');
        console.log('   3. API密钥权限不足');
      }
    }
    
    console.log('\n📋 完整原生响应:');
    console.log(JSON.stringify(directData, null, 2));
    
  } catch (error) {
    console.error('❌ 原生API调用失败:', error.response?.data || error.message);
    if (error.response?.data?.error) {
      console.log('📋 错误详情:', JSON.stringify(error.response.data.error, null, 2));
    }
  }
  
  // 测试3: 检查CCR的transformer配置
  console.log('\n📋 测试3: 检查CCR transformer行为');
  console.log('-'.repeat(50));
  
  // 通过简单请求检查transformer是否正确工作
  const simpleRequest = {
    model: 'gemini-2.5-flash-lite',
    max_tokens: 200,
    messages: [{ role: 'user', content: 'Hello, please respond briefly.' }]
  };
  
  try {
    const response = await axios.post(`${baseURL}/v1/messages`, simpleRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });
    
    console.log('✅ 简单请求成功 - transformer正常工作');
    console.log('- 响应内容:', response.data.content?.[0]?.text?.substring(0, 100));
    
  } catch (error) {
    console.error('❌ 简单请求也失败 - transformer可能有问题');
  }
  
  console.log('\n🎯 调试结论:');
  console.log('💡 需要分析的关键点:');
  console.log('   1. 原生Gemini API是否真正支持工具调用');
  console.log('   2. 我们的请求格式是否完全正确');
  console.log('   3. 是否需要使用不同的模型版本');
  console.log('   4. API密钥是否有工具调用权限');
}

debugGeminiToolForcing().catch(console.error);