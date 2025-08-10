#!/usr/bin/env node
/**
 * 测试1: Gemini Provider直接配置allowedFunctionNames后能否调用工具
 * Project owner: Jason Zhang
 */

const { GoogleGenAI } = require('@google/genai');

async function testGeminiProviderDirect() {
  console.log('🧪 测试1: Gemini Provider直接测试 allowedFunctionNames');
  console.log('='.repeat(60));

  // 获取API密钥
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
    return false;
  }

  const genAI = new GoogleGenAI({ apiKey });

  // 测试用例1: 简单的数学工具
  console.log('\n📊 用例1: 数学计算工具');
  console.log('-'.repeat(40));
  
  const mathRequest = {
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [{ text: 'Calculate 15 * 7 using the calculator function' }]
    }],
    tools: [{
      functionDeclarations: [{
        name: 'calculator',
        description: 'Perform mathematical calculations',
        parameters: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              description: 'The operation to perform',
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
  };

  try {
    console.log('🚀 发送数学工具请求...');
    const mathResult = await genAI.models.generateContent(mathRequest);
    
    console.log('📋 响应分析:');
    console.log('- finishReason:', mathResult.candidates?.[0]?.finishReason);
    console.log('- parts count:', mathResult.candidates?.[0]?.content?.parts?.length);
    
    const mathParts = mathResult.candidates?.[0]?.content?.parts || [];
    let mathToolCalled = false;
    
    mathParts.forEach((part, i) => {
      if (part.functionCall) {
        mathToolCalled = true;
        console.log(`✅ part[${i}]: 工具调用成功!`);
        console.log(`  - 函数名: ${part.functionCall.name}`);
        console.log(`  - 参数:`, JSON.stringify(part.functionCall.args, null, 2));
      } else if (part.text) {
        console.log(`❌ part[${i}]: 文本回复 (${part.text.substring(0, 50)}...)`);
      }
    });
    
    console.log(`🎯 数学工具调用结果: ${mathToolCalled ? '✅ 成功' : '❌ 失败'}`);
    
  } catch (error) {
    console.error('❌ 数学工具测试失败:', error.message);
  }

  // 测试用例2: 文件操作工具
  console.log('\n📁 用例2: 文件操作工具');
  console.log('-'.repeat(40));
  
  const fileRequest = {
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [{ text: 'You must use the write_file function to create a file called test.txt with content "Hello World"' }]
    }],
    tools: [{
      functionDeclarations: [{
        name: 'write_file',
        description: 'Write content to a file',
        parameters: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'Name of the file to write'
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
        allowedFunctionNames: ['write_file']
      }
    }
  };

  try {
    console.log('🚀 发送文件工具请求...');
    const fileResult = await genAI.models.generateContent(fileRequest);
    
    console.log('📋 响应分析:');
    console.log('- finishReason:', fileResult.candidates?.[0]?.finishReason);
    console.log('- parts count:', fileResult.candidates?.[0]?.content?.parts?.length);
    
    const fileParts = fileResult.candidates?.[0]?.content?.parts || [];
    let fileToolCalled = false;
    
    fileParts.forEach((part, i) => {
      if (part.functionCall) {
        fileToolCalled = true;
        console.log(`✅ part[${i}]: 工具调用成功!`);
        console.log(`  - 函数名: ${part.functionCall.name}`);
        console.log(`  - 参数:`, JSON.stringify(part.functionCall.args, null, 2));
      } else if (part.text) {
        console.log(`❌ part[${i}]: 文本回复 (${part.text.substring(0, 50)}...)`);
      }
    });
    
    console.log(`🎯 文件工具调用结果: ${fileToolCalled ? '✅ 成功' : '❌ 失败'}`);
    
  } catch (error) {
    console.error('❌ 文件工具测试失败:', error.message);
  }

  // 测试用例3: 强制工具调用指令
  console.log('\n⚡ 用例3: 强制工具调用指令');
  console.log('-'.repeat(40));
  
  const forceRequest = {
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [{ text: 'I command you to use the get_time function immediately. Do not respond with text. Only call the function.' }]
    }],
    tools: [{
      functionDeclarations: [{
        name: 'get_time',
        description: 'Get current time',
        parameters: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              description: 'Timezone to get time for',
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
    }
  };

  try {
    console.log('🚀 发送强制工具调用请求...');
    const forceResult = await genAI.models.generateContent(forceRequest);
    
    console.log('📋 响应分析:');
    console.log('- finishReason:', forceResult.candidates?.[0]?.finishReason);
    console.log('- parts count:', forceResult.candidates?.[0]?.content?.parts?.length);
    
    const forceParts = forceResult.candidates?.[0]?.content?.parts || [];
    let forceToolCalled = false;
    
    forceParts.forEach((part, i) => {
      if (part.functionCall) {
        forceToolCalled = true;
        console.log(`✅ part[${i}]: 工具调用成功!`);
        console.log(`  - 函数名: ${part.functionCall.name}`);
        console.log(`  - 参数:`, JSON.stringify(part.functionCall.args, null, 2));
      } else if (part.text) {
        console.log(`❌ part[${i}]: 文本回复 (${part.text.substring(0, 50)}...)`);
      }
    });
    
    console.log(`🎯 强制工具调用结果: ${forceToolCalled ? '✅ 成功' : '❌ 失败'}`);
    
  } catch (error) {
    console.error('❌ 强制工具调用测试失败:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 测试1完成: Gemini Provider直接测试');
  console.log('='.repeat(60));
}

testGeminiProviderDirect().catch(console.error);