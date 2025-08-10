#!/usr/bin/env node
/**
 * 强制触发Gemini工具调用测试 - 尝试不同的策略
 * Project owner: Jason Zhang
 */

const { GoogleGenAI } = require('@google/genai');

async function forceGeminiToolCall() {
  console.log('🔥 强制触发Gemini工具调用测试开始...\n');

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

  if (!apiKey) {
    console.error('❌ API密钥未找到');
    return;
  }

  console.log('✅ API密钥获取成功');

  const genAI = new GoogleGenAI({ apiKey });

  // 策略1: 使用非常明确的工具调用指令
  console.log('\n🎯 策略1: 使用非常明确的工具调用指令');
  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: 'You must use the create_file function to create a file named hello.txt with content Hello World. Do NOT provide manual instructions.' }]
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
          mode: 'ANY'
        }
      }
    });
    
    console.log('✅ 策略1请求成功');
    const candidate = result.candidates?.[0];
    if (candidate?.content?.parts) {
      candidate.content.parts.forEach((part, i) => {
        if (part.text) {
          console.log(`  - part[${i}].text:`, part.text.substring(0, 150) + '...');
        }
        if (part.functionCall) {
          console.log(`  - part[${i}].functionCall:`, JSON.stringify(part.functionCall, null, 2));
        }
      });
    }
  } catch (error) {
    console.error('❌ 策略1失败:', error.message);
  }

  // 策略2: 使用更简单的工具定义
  console.log('\n🎯 策略2: 使用更简单的工具定义');
  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: 'Call the write_text function with message "Hello World"' }]
      }],
      tools: [{
        functionDeclarations: [{
          name: 'write_text',
          description: 'Write a text message',
          parameters: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'The message to write'
              }
            },
            required: ['message']
          }
        }]
      }],
      toolConfig: {
        functionCallingConfig: {
          mode: 'ANY'
        }
      }
    });
    
    console.log('✅ 策略2请求成功');
    const candidate = result.candidates?.[0];
    if (candidate?.content?.parts) {
      candidate.content.parts.forEach((part, i) => {
        if (part.text) {
          console.log(`  - part[${i}].text:`, part.text.substring(0, 150) + '...');
        }
        if (part.functionCall) {
          console.log(`  - part[${i}].functionCall:`, JSON.stringify(part.functionCall, null, 2));
        }
      });
    }
  } catch (error) {
    console.error('❌ 策略2失败:', error.message);
  }

  // 策略3: 使用数学工具（更容易触发）
  console.log('\n🎯 策略3: 使用数学工具（更容易触发）');
  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: 'Calculate 15 + 27 using the calculator function' }]
      }],
      tools: [{
        functionDeclarations: [{
          name: 'calculator',
          description: 'Perform basic arithmetic calculations',
          parameters: {
            type: 'object',
            properties: {
              operation: {
                type: 'string',
                description: 'The operation type',
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
          mode: 'ANY'
        }
      }
    });
    
    console.log('✅ 策略3请求成功');
    const candidate = result.candidates?.[0];
    if (candidate?.content?.parts) {
      candidate.content.parts.forEach((part, i) => {
        if (part.text) {
          console.log(`  - part[${i}].text:`, part.text.substring(0, 150) + '...');
        }
        if (part.functionCall) {
          console.log(`  - part[${i}].functionCall:`, JSON.stringify(part.functionCall, null, 2));
        }
      });
    }
  } catch (error) {
    console.error('❌ 策略3失败:', error.message);
  }

  console.log('\n🔥 强制触发Gemini工具调用测试完成!');
}

// 执行测试
forceGeminiToolCall().catch(console.error);