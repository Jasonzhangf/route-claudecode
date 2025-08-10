#!/usr/bin/env node
/**
 * 调试Gemini空响应问题
 * Project owner: Jason Zhang
 */

const { GoogleGenAI } = require('@google/genai');

async function debugGeminiEmptyResponse() {
  console.log('🔍 调试Gemini空响应问题...\n');

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

  const genAI = new GoogleGenAI({ apiKey });

  // 重现可能导致空响应的请求
  const problematicRequest = {
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [{ text: 'I command you to call the get_time function with timezone UTC. Do not respond with text, only call the function.' }]
    }],
    tools: [{
      functionDeclarations: [{
        name: 'get_time',
        description: 'Get current time for a specific timezone',
        parameters: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              enum: ['UTC', 'PST', 'EST', 'CST']
            }
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
      maxOutputTokens: 512
    }
  };

  try {
    console.log('🚀 发送可能导致空响应的请求...');
    console.log('📝 请求结构:');
    console.log(JSON.stringify(problematicRequest, null, 2));
    
    const result = await genAI.models.generateContent(problematicRequest);
    
    console.log('\n📊 完整响应结构:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n🔬 详细响应分析:');
    console.log('- result存在:', !!result);
    console.log('- candidates存在:', !!result.candidates);
    console.log('- candidates类型:', Array.isArray(result.candidates) ? 'array' : typeof result.candidates);
    console.log('- candidates长度:', result.candidates?.length);
    
    if (result.candidates && result.candidates.length > 0) {
      const candidate = result.candidates[0];
      console.log('- candidate存在:', !!candidate);
      console.log('- candidate.content存在:', !!candidate.content);
      console.log('- candidate.content.parts存在:', !!candidate.content?.parts);
      console.log('- candidate.content.parts类型:', Array.isArray(candidate.content?.parts) ? 'array' : typeof candidate.content?.parts);
      console.log('- candidate.content.parts长度:', candidate.content?.parts?.length);
      console.log('- finishReason:', candidate.finishReason);
      
      if (candidate.content?.parts) {
        candidate.content.parts.forEach((part, i) => {
          console.log(`- part[${i}]:`, {
            hasText: !!part.text,
            hasFunctionCall: !!part.functionCall,
            textLength: part.text?.length,
            functionCallName: part.functionCall?.name
          });
        });
      }
    } else {
      console.log('❌ candidates为空或不存在');
    }
    
    // 检查usageMetadata
    console.log('\n💰 使用统计:');
    if (result.usageMetadata) {
      console.log('- promptTokenCount:', result.usageMetadata.promptTokenCount);
      console.log('- candidatesTokenCount:', result.usageMetadata.candidatesTokenCount);
      console.log('- totalTokenCount:', result.usageMetadata.totalTokenCount);
    } else {
      console.log('- usageMetadata不存在');
    }
    
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    console.error('🔍 错误详情:', error);
    
    // 检查是否是特定的API错误
    if (error.message.includes('SAFETY') || error.message.includes('RECITATION')) {
      console.log('⚠️  可能的原因: 内容被安全过滤器阻止');
    }
    if (error.message.includes('BLOCKED')) {
      console.log('⚠️  可能的原因: 请求被阻止');
    }
    if (error.message.includes('quota') || error.message.includes('rate')) {
      console.log('⚠️  可能的原因: API配额或速率限制');
    }
  }

  console.log('\n🔍 空响应调试完成!');
}

debugGeminiEmptyResponse().catch(console.error);