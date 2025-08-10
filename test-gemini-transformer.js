#!/usr/bin/env node
/**
 * 测试2: 通过Transformer测试工具调用转换
 * Project owner: Jason Zhang
 */

// 由于不能直接导入TypeScript，我们将模拟transformer的核心逻辑
function simulateGeminiTransformer() {
  console.log('🧪 测试2: Gemini Transformer 工具调用转换测试');
  console.log('='.repeat(60));

  // 模拟Anthropic请求
  const anthropicRequest = {
    model: 'gemini-2.5-flash',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: 'Use the calculator to compute 25 + 17'
      }
    ],
    tools: [
      {
        name: 'calculator',
        description: 'Perform mathematical calculations',
        input_schema: {
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
      }
    ],
    metadata: {
      requestId: 'test-transformer-123'
    }
  };

  console.log('📝 输入: Anthropic格式请求');
  console.log('- model:', anthropicRequest.model);
  console.log('- messages count:', anthropicRequest.messages.length);
  console.log('- tools count:', anthropicRequest.tools.length);
  console.log('- tool names:', anthropicRequest.tools.map(t => t.name));

  // 模拟transformer转换逻辑
  function transformAnthropicToGemini(request) {
    const geminiRequest = {
      model: request.model,
      contents: request.messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      })),
      generationConfig: {
        maxOutputTokens: request.max_tokens
      }
    };

    // 工具转换
    if (request.tools && request.tools.length > 0) {
      // 转换工具定义
      geminiRequest.tools = [{
        functionDeclarations: request.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }))
      }];

      // 关键：添加toolConfig配置
      const functionNames = request.tools.map(t => t.name);
      geminiRequest.toolConfig = {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: functionNames
        }
      };

      console.log('\n🔧 Transformer工具转换结果:');
      console.log('- tools 转换成功:', !!geminiRequest.tools);
      console.log('- toolConfig 设置成功:', !!geminiRequest.toolConfig);
      console.log('- functionCallingConfig 配置:', geminiRequest.toolConfig.functionCallingConfig);
      console.log('- allowedFunctionNames:', geminiRequest.toolConfig.functionCallingConfig.allowedFunctionNames);
    }

    return geminiRequest;
  }

  // 执行转换
  const geminiRequest = transformAnthropicToGemini(anthropicRequest);

  console.log('\n✅ 转换结果验证:');
  console.log('- Gemini model:', geminiRequest.model);
  console.log('- contents count:', geminiRequest.contents.length);
  console.log('- tools 存在:', !!geminiRequest.tools);
  console.log('- toolConfig 存在:', !!geminiRequest.toolConfig);

  // 验证关键字段
  const toolConfigValid = geminiRequest.toolConfig && 
                         geminiRequest.toolConfig.functionCallingConfig &&
                         geminiRequest.toolConfig.functionCallingConfig.mode === 'ANY' &&
                         geminiRequest.toolConfig.functionCallingConfig.allowedFunctionNames &&
                         geminiRequest.toolConfig.functionCallingConfig.allowedFunctionNames.length > 0;

  console.log('\n🎯 转换质量检查:');
  console.log('- toolConfig结构完整:', toolConfigValid ? '✅ 通过' : '❌ 失败');
  console.log('- allowedFunctionNames正确映射:', 
    JSON.stringify(geminiRequest.toolConfig?.functionCallingConfig?.allowedFunctionNames) === 
    JSON.stringify(anthropicRequest.tools.map(t => t.name)) ? '✅ 通过' : '❌ 失败');

  console.log('\n📋 最终Gemini请求结构:');
  console.log(JSON.stringify(geminiRequest, null, 2));

  return {
    success: toolConfigValid,
    geminiRequest: geminiRequest
  };
}

// 测试实际API调用
async function testTransformedRequest() {
  const { GoogleGenAI } = require('@google/genai');
  
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

  const transformResult = simulateGeminiTransformer();
  
  if (!transformResult.success) {
    console.error('❌ Transformer转换失败，跳过API测试');
    return false;
  }

  console.log('\n🚀 使用转换后的请求调用Gemini API...');
  
  try {
    const genAI = new GoogleGenAI({ apiKey });
    const result = await genAI.models.generateContent(transformResult.geminiRequest);
    
    console.log('📊 API响应分析:');
    console.log('- finishReason:', result.candidates?.[0]?.finishReason);
    console.log('- parts count:', result.candidates?.[0]?.content?.parts?.length);
    
    const parts = result.candidates?.[0]?.content?.parts || [];
    let toolCalled = false;
    
    parts.forEach((part, i) => {
      if (part.functionCall) {
        toolCalled = true;
        console.log(`✅ part[${i}]: 工具调用成功!`);
        console.log(`  - 函数名: ${part.functionCall.name}`);
        console.log(`  - 参数:`, JSON.stringify(part.functionCall.args, null, 2));
      } else if (part.text) {
        console.log(`❌ part[${i}]: 文本回复 (${part.text.substring(0, 50)}...)`);
      }
    });
    
    console.log(`\n🎯 Transformer+API测试结果: ${toolCalled ? '✅ 成功' : '❌ 失败'}`);
    
    return toolCalled;
    
  } catch (error) {
    console.error('❌ API调用失败:', error.message);
    return false;
  }
}

// 执行测试
testTransformedRequest().then(() => {
  console.log('\n' + '='.repeat(60));
  console.log('🏁 测试2完成: Transformer测试');
  console.log('='.repeat(60));
}).catch(console.error);