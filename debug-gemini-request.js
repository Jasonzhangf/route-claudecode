#!/usr/bin/env node

/**
 * 调试Gemini API请求格式问题
 * 测试不同的API版本和请求格式
 */

const apiKey = process.env.GEMINI_API_KEY || 'mock-key';

// 测试请求格式1: 不带工具
const basicRequest = {
  contents: [{
    role: 'user',
    parts: [{ text: 'Hello, test message without tools' }]
  }],
  generationConfig: {
    maxOutputTokens: 100
  }
};

// 测试请求格式2: 带工具 (当前格式)
const toolRequest = {
  contents: [{
    role: 'user', 
    parts: [{ text: 'Use calculator to compute 2+2' }]
  }],
  tools: [{
    functionDeclarations: [{
      name: 'calculator',
      description: 'Calculate mathematical expressions',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression'
          }
        },
        required: ['expression']
      }
    }]
  }],
  generationConfig: {
    maxOutputTokens: 100
  }
};

async function testGeminiAPI(apiVersion, request, description) {
  console.log(`\n📡 测试 ${description}`);
  console.log(`🔗 API版本: ${apiVersion}`);
  console.log(`📤 请求格式:`, JSON.stringify(request, null, 2));
  
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });
    
    const responseText = await response.text();
    
    if (response.ok) {
      console.log('✅ 请求成功');
      console.log('📥 响应:', responseText.slice(0, 200) + '...');
    } else {
      console.log('❌ 请求失败');
      console.log(`📛 状态码: ${response.status}`);
      console.log('📥 错误响应:', responseText);
    }
  } catch (error) {
    console.log('❌ 网络错误:', error.message);
  }
}

async function runTests() {
  console.log('🧪 Gemini API格式调试测试\n');
  
  if (apiKey === 'mock-key') {
    console.log('⚠️  警告: 使用模拟API密钥，请设置GEMINI_API_KEY环境变量进行真实测试');
    console.log('   export GEMINI_API_KEY="your-actual-key"');
    console.log('\n📋 仅显示请求格式分析:\n');
    
    console.log('📤 基础请求格式 (无工具):');
    console.log(JSON.stringify(basicRequest, null, 2));
    
    console.log('\n📤 工具请求格式:');
    console.log(JSON.stringify(toolRequest, null, 2));
    
    console.log('\n🔍 分析:');
    console.log('- contents: 消息数组，每个包含role和parts');
    console.log('- parts: 文本部分数组，每个包含text字段');
    console.log('- tools: 工具数组，每个包含functionDeclarations');
    console.log('- functionDeclarations: 函数声明数组');
    console.log('- generationConfig: 生成配置，包含maxOutputTokens');
    
    return;
  }
  
  // 测试不同版本和格式
  await testGeminiAPI('v1', basicRequest, '基础请求 (v1, 无工具)');
  await testGeminiAPI('v1beta', basicRequest, '基础请求 (v1beta, 无工具)');
  
  await testGeminiAPI('v1', toolRequest, '工具请求 (v1, 带工具)');
  await testGeminiAPI('v1beta', toolRequest, '工具请求 (v1beta, 带工具)');
}

runTests().catch(console.error);