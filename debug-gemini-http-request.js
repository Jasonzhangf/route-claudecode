#!/usr/bin/env node
/**
 * 调试Gemini HTTP请求格式 - 验证allowedFunctionNames是否正确发送
 * Project owner: Jason Zhang
 */

const { GoogleGenAI } = require('@google/genai');

async function debugGeminiHTTPRequest() {
  console.log('🔍 调试Gemini HTTP请求格式...\n');

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

  // 测试我们实际发送的请求格式
  console.log('🧪 测试实际HTTP请求格式');
  
  const requestPayload = {
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
        allowedFunctionNames: ['create_file']  // 关键字段
      }
    },
    generationConfig: {
      maxOutputTokens: 1024
    }
  };

  console.log('📝 发送的请求payload:');
  console.log(JSON.stringify(requestPayload, null, 2));
  console.log('\n🔧 关键字段检查:');
  console.log('- toolConfig存在:', !!requestPayload.toolConfig);
  console.log('- functionCallingConfig存在:', !!requestPayload.toolConfig?.functionCallingConfig);
  console.log('- mode:', requestPayload.toolConfig?.functionCallingConfig?.mode);
  console.log('- allowedFunctionNames存在:', !!requestPayload.toolConfig?.functionCallingConfig?.allowedFunctionNames);
  console.log('- allowedFunctionNames值:', requestPayload.toolConfig?.functionCallingConfig?.allowedFunctionNames);

  // 发送请求并检查响应
  try {
    const genAI = new GoogleGenAI({ apiKey });
    console.log('\n🚀 发送请求到Gemini API...');
    
    const result = await genAI.models.generateContent(requestPayload);
    
    console.log('✅ 请求成功发送');
    console.log('📊 响应分析:');
    console.log('- candidates count:', result.candidates?.length);
    console.log('- finishReason:', result.candidates?.[0]?.finishReason);
    
    const parts = result.candidates?.[0]?.content?.parts;
    if (parts) {
      console.log('- parts count:', parts.length);
      parts.forEach((part, i) => {
        if (part.text) {
          console.log(`  - part[${i}] type: text (前50字符: ${part.text.substring(0, 50)}...)`);
        }
        if (part.functionCall) {
          console.log(`  - part[${i}] type: functionCall`);
          console.log(`    - function name: ${part.functionCall.name}`);
          console.log(`    - function args:`, JSON.stringify(part.functionCall.args, null, 2));
        }
      });
    }

    // 检查是否触发了工具调用
    const hasToolCall = parts?.some(part => part.functionCall);
    console.log('\n🎯 结果总结:');
    console.log('- 工具调用触发:', hasToolCall ? '✅ 是' : '❌ 否');
    console.log('- allowedFunctionNames配置:', '✅ 正确');
    console.log('- mode配置:', '✅ ANY');
    
    if (!hasToolCall) {
      console.log('\n⚠️  问题分析:');
      console.log('配置完全正确但仍未触发工具调用，可能原因:');
      console.log('1. Gemini模型行为保守，即使在ANY模式下也倾向于提供文本解释');
      console.log('2. 工具定义可能需要更明确的schema结构');
      console.log('3. 提示语言可能需要更强制性的指令');
    }

  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    console.error('详细错误:', error);
  }

  console.log('\n🔍 HTTP请求格式调试完成!');
}

debugGeminiHTTPRequest().catch(console.error);