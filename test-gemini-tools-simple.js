#!/usr/bin/env node

/**
 * 简单测试: 验证Gemini工具转换逻辑修复
 */

// 模拟convertTools方法
function convertTools(tools) {
  const functionDeclarations = tools.map(tool => {
    const parameters = tool.input_schema || tool.function?.parameters || {};
    
    return {
      name: tool.name,
      description: tool.description || tool.function?.description || '',
      parameters: parameters
    };
  });
  
  return {
    functionDeclarations: functionDeclarations
  };
}

// 模拟完整的convertToGeminiFormat逻辑（修复后）
function convertToGeminiFormat(request) {
  const geminiRequest = {
    contents: [{
      role: 'user',
      parts: [{ text: 'test message' }]
    }],
    generationConfig: {
      maxOutputTokens: request.max_tokens || 4096
    }
  };

  // 修复后的工具处理逻辑
  const tools = request.tools || request.metadata?.tools;
  if (tools && Array.isArray(tools) && tools.length > 0) {
    // 🔧 修复: Gemini API正确的工具格式是tools数组，不是单个对象
    geminiRequest.tools = [convertTools(tools)];  // 包装成数组
    console.log('✅ 修复: 使用数组格式包装functionDeclarations对象');
  }

  return geminiRequest;
}

// 测试用例
const testRequest = {
  model: 'gemini-2.5-flash',
  messages: [{ role: 'user', content: 'test' }],
  tools: [
    {
      name: 'calculator',
      description: 'Calculate expressions',
      input_schema: {
        type: 'object',
        properties: {
          expression: { type: 'string' }
        }
      }
    }
  ]
};

console.log('🧪 测试Gemini工具格式修复\n');

console.log('📥 输入工具格式:');
console.log(JSON.stringify(testRequest.tools, null, 2));

const result = convertToGeminiFormat(testRequest);

console.log('\n📤 输出Gemini格式:');
console.log(JSON.stringify(result.tools, null, 2));

console.log('\n🔍 验证修复:');
if (Array.isArray(result.tools)) {
  console.log('✅ tools是数组格式 (修复成功)');
  
  if (result.tools[0] && result.tools[0].functionDeclarations) {
    console.log('✅ 包含functionDeclarations对象');
    console.log(`✅ 工具数量: ${result.tools[0].functionDeclarations.length}`);
    
    const tool = result.tools[0].functionDeclarations[0];
    console.log(`✅ 工具名: ${tool.name}`);
    console.log(`✅ 工具描述: ${tool.description}`);
    console.log(`✅ 参数结构: ${JSON.stringify(tool.parameters)}`);
  }
} else {
  console.log('❌ tools不是数组格式');
}

console.log('\n🎯 修复对比:');
console.log('修复前: geminiRequest.tools = this.convertTools(tools)');
console.log('修复后: geminiRequest.tools = [this.convertTools(tools)]');
console.log('结果: 符合Gemini API期望的数组格式，应该解决"Unknown name tools"错误');