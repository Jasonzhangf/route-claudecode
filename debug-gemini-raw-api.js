#!/usr/bin/env node
/**
 * 调试Gemini原始API响应 - 绕过transformer直接测试
 * Project owner: Jason Zhang
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiRawAPI() {
  console.log('🔍 直接测试Gemini API原始响应...\n');

  // 从配置文件读取API密钥
  const configPath = process.env.HOME + '/.route-claude-code/config/single-provider/config-google-gemini-5502.json';
  let apiKey;
  
  try {
    const config = JSON.parse(require('fs').readFileSync(configPath, 'utf8'));
    const auth = config.providers?.['google-gemini']?.authentication?.credentials;
    apiKey = auth?.apiKey || auth?.api_key;
    if (Array.isArray(apiKey)) {
      apiKey = apiKey[0];
    }
  } catch (error) {
    console.error('❌ 无法读取API密钥:', error.message);
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // 测试1: 检查原始工具调用请求
  console.log('📊 测试1: 原始Gemini API工具调用请求');
  console.log('-'.repeat(50));

  const toolRequest = {
    contents: [{
      role: 'user',
      parts: [{ text: 'Use the calculator to compute 8 × 9. You must call the function.' }]
    }],
    tools: [{
      functionDeclarations: [{
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
      }]
    }],
    toolConfig: {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: ['calculator']
      }
    },
    generationConfig: {
      maxOutputTokens: 512
    }
  };

  console.log('🚀 发送原始请求到Gemini API...');
  console.log('📝 请求结构:');
  console.log(JSON.stringify(toolRequest, null, 2));

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent(toolRequest);
    
    console.log('\n📊 原始响应分析:');
    console.log('- 完整响应:');
    console.log(JSON.stringify(result, null, 2));

    if (result.response) {
      console.log('\n🔍 响应详情:');
      console.log('- candidates存在:', !!result.response.candidates);
      console.log('- candidates长度:', result.response.candidates?.length);
      
      if (result.response.candidates?.[0]) {
        const candidate = result.response.candidates[0];
        console.log('- finishReason:', candidate.finishReason);
        console.log('- content存在:', !!candidate.content);
        console.log('- parts存在:', !!candidate.content?.parts);
        
        if (candidate.content?.parts) {
          candidate.content.parts.forEach((part, i) => {
            console.log(`- part[${i}]:`, {
              hasText: !!part.text,
              hasFunctionCall: !!part.functionCall,
              textLength: part.text?.length,
              functionName: part.functionCall?.name
            });
          });
        }
      }
    }

  } catch (error) {
    console.error('❌ 原始API请求失败:', error.message);
    console.error('错误详情:', error);
  }

  // 测试2: 极端强制工具调用
  console.log('\n📊 测试2: 极端强制工具调用（低token限制）');
  console.log('-'.repeat(50));

  const forceToolRequest = {
    contents: [{
      role: 'user',
      parts: [{ text: 'Call get_time with UTC now!' }]
    }],
    tools: [{
      functionDeclarations: [{
        name: 'get_time',
        description: 'Get current time',
        parameters: {
          type: 'object',
          properties: {
            timezone: { type: 'string', enum: ['UTC'] }
          },
          required: ['timezone']
        }
      }]
    }],
    toolConfig: {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: ['get_time']
      }
    },
    generationConfig: {
      maxOutputTokens: 5  // 极低限制
    }
  };

  try {
    const model2 = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result2 = await model2.generateContent(forceToolRequest);
    
    console.log('📊 强制调用响应分析:');
    console.log(JSON.stringify(result2, null, 2));

    if (result2.response?.candidates?.[0]) {
      const candidate = result2.response.candidates[0];
      console.log('- finishReason:', candidate.finishReason);
      console.log('- 是否为UNEXPECTED_TOOL_CALL:', candidate.finishReason === 'UNEXPECTED_TOOL_CALL');
      console.log('- content存在:', !!candidate.content);
      
      // 这是我们需要在transformer中处理的情况
      if (!candidate.content && candidate.finishReason) {
        console.log('🎯 发现空content情况! finishReason:', candidate.finishReason);
        console.log('   这正是transformer需要处理的边缘情况');
      }
    }

  } catch (error) {
    console.error('❌ 强制调用失败:', error.message);
    if (error.message.includes('SAFETY') || error.message.includes('BLOCKED')) {
      console.log('⚠️ 可能被安全过滤器阻止');
    }
  }

  console.log('\n✅ 原始API测试完成');
}

testGeminiRawAPI().catch(console.error);