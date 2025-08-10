#!/usr/bin/env node
/**
 * 直接测试Gemini API工具调用 - 绕过transformer分析原始问题
 * Project owner: Jason Zhang
 */

const { GoogleGenAI } = require('@google/genai');

async function testGeminiDirectAPIToolCall() {
  console.log('🔍 直接测试Gemini API工具调用开始...\n');

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

  console.log('✅ API密钥获取成功，长度:', apiKey.length);

  // 初始化Gemini客户端
  const genAI = new GoogleGenAI({ apiKey });

  // 测试1: 不带工具的简单请求
  console.log('\n📝 测试1: 不带工具的简单请求');
  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: 'Hello, how are you?' }]
      }]
    });
    console.log('✅ 简单请求成功');
    console.log('- result:', JSON.stringify(result, null, 2).substring(0, 500) + '...');
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('- text:', text?.substring(0, 100) + '...');
    console.log('- candidates:', result.candidates?.length);
    console.log('- finishReason:', result.candidates?.[0]?.finishReason);
  } catch (error) {
    console.error('❌ 简单请求失败:', error.message);
    return;
  }

  // 测试2: 带工具的请求 - 使用toolConfig
  console.log('\n🔧 测试2: 带工具的请求 - toolConfig格式');
  const toolConfigRequest = {
    contents: [{
      role: 'user',
      parts: [{ text: 'Create a file called hello.txt with content "Hello World"' }]
    }],
    tools: [{
      functionDeclarations: [{
        name: 'create_file',
        description: 'Create a new file with specified content',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path to create'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            }
          },
          required: ['path', 'content']
        }
      }]
    }],
    toolConfig: {
      functionCallingConfig: {
        mode: 'ANY'
      }
    }
  };

  try {
    const request = {
      model: 'gemini-2.5-flash',
      ...toolConfigRequest
    };
    console.log('发送请求:', JSON.stringify(request, null, 2));
    const result = await genAI.models.generateContent(request);
    
    console.log('✅ toolConfig格式请求成功');
    console.log('- candidates:', result.candidates?.length);
    console.log('- finishReason:', result.candidates?.[0]?.finishReason);
    
    const candidate = result.candidates?.[0];
    if (candidate?.content?.parts) {
      console.log('- parts count:', candidate.content.parts.length);
      candidate.content.parts.forEach((part, i) => {
        if (part.text) {
          console.log(`  - part[${i}].text:`, part.text.substring(0, 100) + '...');
        }
        if (part.functionCall) {
          console.log(`  - part[${i}].functionCall:`, JSON.stringify(part.functionCall, null, 2));
        }
      });
    }
  } catch (error) {
    console.error('❌ toolConfig格式请求失败:', error.message);
    console.error('Error details:', error);
  }

  // 测试3: 带工具的请求 - 使用functionCallingConfig
  console.log('\n🔧 测试3: 带工具的请求 - functionCallingConfig格式');
  const functionCallingConfigRequest = {
    contents: [{
      role: 'user',
      parts: [{ text: 'Create a file called hello.txt with content "Hello World"' }]
    }],
    tools: [{
      functionDeclarations: [{
        name: 'create_file',
        description: 'Create a new file with specified content',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path to create'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            }
          },
          required: ['path', 'content']
        }
      }]
    }],
    functionCallingConfig: {
      mode: 'ANY'
    }
  };

  try {
    const request = {
      model: 'gemini-2.5-flash',
      ...functionCallingConfigRequest
    };
    const result = await genAI.models.generateContent(request);
    
    console.log('✅ functionCallingConfig格式请求成功');
    console.log('- candidates:', result.candidates?.length);
    console.log('- finishReason:', result.candidates?.[0]?.finishReason);
    
    const candidate = result.candidates?.[0];
    if (candidate?.content?.parts) {
      console.log('- parts count:', candidate.content.parts.length);
      candidate.content.parts.forEach((part, i) => {
        if (part.text) {
          console.log(`  - part[${i}].text:`, part.text.substring(0, 100) + '...');
        }
        if (part.functionCall) {
          console.log(`  - part[${i}].functionCall:`, JSON.stringify(part.functionCall, null, 2));
        }
      });
    }
  } catch (error) {
    console.error('❌ functionCallingConfig格式请求失败:', error.message);
    console.error('Error details:', error);
  }

  // 测试4: 测试AUTO模式
  console.log('\n🔧 测试4: 测试AUTO模式');
  const autoModeRequest = {
    contents: [{
      role: 'user',
      parts: [{ text: 'What is the weather like in Beijing? If you need to check weather, create a file with the query.' }]
    }],
    tools: [{
      functionDeclarations: [{
        name: 'create_file',
        description: 'Create a new file with specified content',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path to create'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            }
          },
          required: ['path', 'content']
        }
      }]
    }],
    toolConfig: {
      functionCallingConfig: {
        mode: 'AUTO'
      }
    }
  };

  try {
    const request = {
      model: 'gemini-2.5-flash',
      ...autoModeRequest
    };
    const result = await genAI.models.generateContent(request);
    
    console.log('✅ AUTO模式请求成功');
    console.log('- candidates:', result.candidates?.length);
    console.log('- finishReason:', result.candidates?.[0]?.finishReason);
    
    const candidate = result.candidates?.[0];
    if (candidate?.content?.parts) {
      console.log('- parts count:', candidate.content.parts.length);
      candidate.content.parts.forEach((part, i) => {
        if (part.text) {
          console.log(`  - part[${i}].text:`, part.text.substring(0, 100) + '...');
        }
        if (part.functionCall) {
          console.log(`  - part[${i}].functionCall:`, JSON.stringify(part.functionCall, null, 2));
        }
      });
    }
  } catch (error) {
    console.error('❌ AUTO模式请求失败:', error.message);
    console.error('Error details:', error);
  }

  console.log('\n🔍 直接Gemini API工具调用测试完成!');
}

// 执行测试
testGeminiDirectAPIToolCall().catch(console.error);