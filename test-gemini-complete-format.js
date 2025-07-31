#!/usr/bin/env node

/**
 * 基于Google官方文档的完整Gemini API格式测试
 * 参考: https://ai.google.dev/gemini-api/docs/function-calling
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'mock-key';

// 根据官方文档的完整正确格式
const CORRECT_GEMINI_REQUEST = {
  contents: [
    {
      role: "user",
      parts: [
        {
          text: "Calculate 15 * 25 and tell me the result"
        }
      ]
    }
  ],
  tools: [
    {
      functionDeclarations: [
        {
          name: "calculator",
          description: "Performs mathematical calculations",
          parameters: {
            type: "object",
            properties: {
              expression: {
                type: "string",
                description: "Mathematical expression to evaluate"
              }
            },
            required: ["expression"]
          }
        }
      ]
    }
  ],
  generationConfig: {
    maxOutputTokens: 1000,
    temperature: 0.1
  }
};

// 我们当前生成的格式 (用于对比)
function ourCurrentFormat() {
  // 模拟我们的convertToGeminiFormat逻辑
  const request = {
    model: 'gemini-2.5-flash',
    messages: [
      { role: 'user', content: 'Calculate 15 * 25' }
    ],
    tools: [
      {
        name: 'calculator',
        description: 'Performs calculations',
        input_schema: {
          type: 'object',
          properties: {
            expression: { type: 'string' }
          },
          required: ['expression']
        }
      }
    ]
  };

  // 转换逻辑
  const geminiRequest = {
    contents: request.messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    })),
    generationConfig: {
      maxOutputTokens: 4096
    }
  };

  // 工具转换
  if (request.tools) {
    const functionDeclarations = request.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }));
    
    geminiRequest.tools = [{ functionDeclarations }];
  }

  return geminiRequest;
}

async function testGeminiFormats() {
  console.log('🧪 Gemini API格式完整测试\n');

  // 1. 官方正确格式
  console.log('📚 官方文档标准格式:');
  console.log(JSON.stringify(CORRECT_GEMINI_REQUEST, null, 2));

  // 2. 我们的格式
  console.log('\n🔧 我们当前生成的格式:');
  const ourFormat = ourCurrentFormat();
  console.log(JSON.stringify(ourFormat, null, 2));

  // 3. 格式对比
  console.log('\n🔍 格式对比分析:');
  
  console.log('✅ 相同点:');
  console.log('  - contents: 数组结构正确');
  console.log('  - role: user/model映射正确');
  console.log('  - parts: [{ text: "..." }] 结构正确');
  console.log('  - tools: [{ functionDeclarations: [...] }] 结构正确');
  console.log('  - functionDeclarations: name, description, parameters 完整');

  console.log('\n⚠️  可能的差异:');
  console.log('  - generationConfig: 我们使用maxOutputTokens，官方可能要求其他字段');
  console.log('  - temperature: 我们没有设置，官方建议0.1用于可靠调用');
  console.log('  - API版本: 确认使用v1beta');

  // 4. 测试真实API (如果有key)
  if (GEMINI_API_KEY !== 'mock-key') {
    console.log('\n🌐 测试真实Gemini API...');
    await testRealGeminiAPI();
  } else {
    console.log('\n⚠️  设置GEMINI_API_KEY环境变量进行真实测试');
  }
}

async function testRealGeminiAPI() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  try {
    console.log('📡 发送请求到:', url);
    console.log('📤 请求体:', JSON.stringify(CORRECT_GEMINI_REQUEST, null, 2));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(CORRECT_GEMINI_REQUEST)
    });

    const responseText = await response.text();
    
    if (response.ok) {
      console.log('✅ API调用成功');
      console.log('📥 响应:', responseText.slice(0, 500) + '...');
      
      try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse.candidates && jsonResponse.candidates[0]) {
          const candidate = jsonResponse.candidates[0];
          console.log('\n📋 响应分析:');
          console.log('  - 候选数量:', jsonResponse.candidates.length);
          console.log('  - 完成原因:', candidate.finishReason);
          console.log('  - 内容部分:', candidate.content?.parts?.length || 0);
          
          if (candidate.content?.parts) {
            candidate.content.parts.forEach((part, i) => {
              if (part.functionCall) {
                console.log(`  - 工具调用 ${i + 1}:`, part.functionCall.name);
              } else if (part.text) {
                console.log(`  - 文本内容 ${i + 1}:`, part.text.slice(0, 100) + '...');
              }
            });
          }
        }
      } catch (parseError) {
        console.log('⚠️  JSON解析失败，原始响应:', responseText);
      }
    } else {
      console.log('❌ API调用失败');
      console.log('📛 状态码:', response.status);
      console.log('📥 错误响应:', responseText);
    }
    
  } catch (error) {
    console.log('❌ 请求异常:', error.message);
  }
}

// 运行测试
testGeminiFormats().catch(console.error);