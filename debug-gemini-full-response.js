#!/usr/bin/env node
/**
 * 检查Gemini API完整响应结构
 * Project owner: Jason Zhang
 */

const { GoogleGenAI } = require('@google/genai');

async function checkFullResponse() {
  console.log('🔍 检查Gemini API完整响应结构...\n');

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

  // 测试：明确要求使用工具的AUTO模式
  console.log('\n🔧 测试：明确要求使用工具的AUTO模式');
  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: 'You MUST use the calculator function to compute 8 * 7. Do not calculate manually.' }]
      }],
      tools: [{
        functionDeclarations: [{
          name: 'calculator',
          description: 'Perform arithmetic operations using this tool',
          parameters: {
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
        }]
      }],
      toolConfig: {
        functionCallingConfig: {
          mode: 'AUTO'
        }
      }
    });
    
    console.log('✅ 请求成功');
    console.log('📝 完整响应结构:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('完整错误:', error);
  }

  // 测试2：使用最新的API调用方法
  console.log('\n🔧 测试2：使用最新的生成方法');
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{
        functionDeclarations: [{
          name: 'get_weather',
          description: 'Get weather information',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'City name'
              }
            },
            required: ['location']
          }
        }]
      }],
      toolConfig: {
        functionCallingConfig: {
          mode: 'AUTO'
        }
      }
    });

    const result = await model.generateContent(
      'What is the weather in Beijing? Please use the get_weather function.'
    );
    
    console.log('✅ 使用模型生成方法成功');
    console.log('📝 完整响应结构:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ 模型生成方法失败:', error.message);
    console.error('完整错误:', error);
  }

  console.log('\n🔍 完整响应结构检查完成!');
}

checkFullResponse().catch(console.error);