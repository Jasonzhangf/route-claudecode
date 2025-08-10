#!/usr/bin/env node
/**
 * 测试Gemini API allowedFunctionNames配置
 * Project owner: Jason Zhang
 */

const { GoogleGenAI } = require('@google/genai');

async function testAllowedFunctions() {
  console.log('🎯 测试Gemini API allowedFunctionNames配置开始...\n');

  // 从config读取API密钥
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

  // 测试1: 带allowedFunctionNames的ANY模式
  console.log('\n🔧 测试1: ANY模式 + allowedFunctionNames');
  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: 'Create a file named hello.txt with content "Hello World"' }]
      }],
      tools: [{
        functionDeclarations: [{
          name: 'create_file',
          description: 'Create a new file with specified content',
          parameters: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'Name of the file to create'
              },
              content: {
                type: 'string',
                description: 'Content to write to the file'
              }
            },
            required: ['filename', 'content']
          }
        }]
      }],
      toolConfig: {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: ['create_file']  // 关键：明确指定允许的函数名
        }
      }
    });
    
    console.log('✅ 带allowedFunctionNames的ANY模式请求成功');
    console.log('- finishReason:', result.candidates?.[0]?.finishReason);
    
    const candidate = result.candidates?.[0];
    if (candidate?.content?.parts) {
      console.log('- parts count:', candidate.content.parts.length);
      candidate.content.parts.forEach((part, i) => {
        if (part.text) {
          console.log(`  - part[${i}].text:`, part.text.substring(0, 200) + '...');
        }
        if (part.functionCall) {
          console.log(`  - 🎉 part[${i}].functionCall:`, JSON.stringify(part.functionCall, null, 2));
        }
      });
    }
  } catch (error) {
    console.error('❌ 测试1失败:', error.message);
    console.error('Error details:', error);
  }

  // 测试2: 数学计算工具测试
  console.log('\n🔧 测试2: 数学计算工具 + allowedFunctionNames');
  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: 'Calculate 15 + 27' }]
      }],
      tools: [{
        functionDeclarations: [{
          name: 'calculator',
          description: 'Perform arithmetic operations',
          parameters: {
            type: 'object',
            properties: {
              operation: {
                type: 'string',
                description: 'The operation',
                enum: ['add', 'subtract', 'multiply', 'divide']
              },
              a: {
                type: 'number',
                description: 'First number'
              },
              b: {
                type: 'number',
                description: 'Second number'
              }
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
      }
    });
    
    console.log('✅ 数学计算工具请求成功');
    console.log('- finishReason:', result.candidates?.[0]?.finishReason);
    
    const candidate = result.candidates?.[0];
    if (candidate?.content?.parts) {
      console.log('- parts count:', candidate.content.parts.length);
      candidate.content.parts.forEach((part, i) => {
        if (part.text) {
          console.log(`  - part[${i}].text:`, part.text.substring(0, 200) + '...');
        }
        if (part.functionCall) {
          console.log(`  - 🎉 part[${i}].functionCall:`, JSON.stringify(part.functionCall, null, 2));
        }
      });
    }
  } catch (error) {
    console.error('❌ 测试2失败:', error.message);
  }

  // 测试3: AUTO模式作为对比
  console.log('\n🔧 测试3: AUTO模式作为对比');
  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: 'I need to calculate 8 * 7. Please use the calculator tool.' }]
      }],
      tools: [{
        functionDeclarations: [{
          name: 'calculator',
          description: 'Perform arithmetic operations',
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
          mode: 'AUTO'  // AUTO模式，让模型决定是否使用工具
        }
      }
    });
    
    console.log('✅ AUTO模式请求成功');
    console.log('- finishReason:', result.candidates?.[0]?.finishReason);
    
    const candidate = result.candidates?.[0];
    if (candidate?.content?.parts) {
      console.log('- parts count:', candidate.content.parts.length);
      candidate.content.parts.forEach((part, i) => {
        if (part.text) {
          console.log(`  - part[${i}].text:`, part.text.substring(0, 200) + '...');
        }
        if (part.functionCall) {
          console.log(`  - 🎉 part[${i}].functionCall:`, JSON.stringify(part.functionCall, null, 2));
        }
      });
    }
  } catch (error) {
    console.error('❌ 测试3失败:', error.message);
  }

  console.log('\n🎯 allowedFunctionNames配置测试完成!');
}

testAllowedFunctions().catch(console.error);