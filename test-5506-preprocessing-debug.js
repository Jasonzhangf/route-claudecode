#!/usr/bin/env node

/**
 * 测试LMStudio预处理逻辑
 * 验证模拟LMStudio响应的文本解析功能
 */

// 模拟LMStudio响应数据 - 包含文本格式的工具调用
const mockLMStudioResponse = {
  id: "chatcmpl-test123",
  object: "chat.completion", 
  created: Math.floor(Date.now() / 1000),
  model: "qwen3-30b",
  choices: [{
    index: 0,
    message: {
      role: "assistant",
      content: 'Need to call functions.LS with path = ".".<|start|>assistant<|channel|>commentary to=functions.LS <|constrain|>json<|message|>{"path":"."}'
    },
    finish_reason: "stop"
  }],
  usage: {
    prompt_tokens: 50,
    completion_tokens: 30,
    total_tokens: 80
  }
};

console.log('🧪 测试LMStudio预处理逻辑...');
console.log('=' + '='.repeat(70));

async function testLMStudioPreprocessing() {
  try {
    // 尝试导入预处理模块
    let UnifiedPatchPreprocessor;
    try {
      // 尝试从dist目录导入编译后的模块
      const module = require('./dist/preprocessing/unified-patch-preprocessor.js');
      UnifiedPatchPreprocessor = module.UnifiedPatchPreprocessor;
    } catch (e) {
      console.log('❌ 无法导入预处理模块:', e.message);
      console.log('需要先编译项目: npm run build');
      return;
    }
    
    if (!UnifiedPatchPreprocessor) {
      console.log('❌ UnifiedPatchPreprocessor类未找到');
      return;
    }
    
    console.log('✅ 成功导入UnifiedPatchPreprocessor');
    
    // 创建预处理器实例
    const preprocessor = new UnifiedPatchPreprocessor(5506, {});
    
    // 模拟预处理上下文
    const mockContext = {
      provider: 'lmstudio-glm', // 这是5506端口的provider名称
      model: 'qwen3-30b',
      requestId: 'test-request-123'
    };
    
    console.log('\n🔍 测试配置:');
    console.log(`- Provider: ${mockContext.provider}`);
    console.log(`- Model: ${mockContext.model}`);
    console.log(`- LM Studio检测: ${mockContext.provider.includes('lmstudio') ? '✅' : '❌'}`);
    
    console.log('\n📤 原始响应:');
    console.log(`- Content: "${mockLMStudioResponse.choices[0].message.content}"`);
    console.log(`- Finish Reason: ${mockLMStudioResponse.choices[0].finish_reason}`);
    
    // 调用预处理方法
    console.log('\n🔧 执行预处理...');
    const preprocessedResponse = await preprocessor.preprocessResponse(
      mockLMStudioResponse,
      mockContext.provider,
      mockContext.model,
      mockContext.requestId
    );
    
    console.log('\n📥 预处理结果:');
    const choice = preprocessedResponse.choices[0];
    console.log(`- Content: "${choice.message.content}"`);
    console.log(`- Finish Reason: ${choice.finish_reason}`);
    console.log(`- Has Tool Calls: ${!!choice.message.tool_calls}`);
    
    if (choice.message.tool_calls) {
      console.log(`- Tool Calls Count: ${choice.message.tool_calls.length}`);
      choice.message.tool_calls.forEach((toolCall, index) => {
        console.log(`\n工具调用 ${index + 1}:`);
        console.log(`  - ID: ${toolCall.id}`);
        console.log(`  - Type: ${toolCall.type}`);
        console.log(`  - Function Name: ${toolCall.function.name}`);
        console.log(`  - Arguments: ${toolCall.function.arguments}`);
      });
    }
    
    // 验证转换是否成功
    const isSuccessful = (
      choice.message.tool_calls && 
      choice.message.tool_calls.length > 0 &&
      choice.finish_reason === 'tool_calls'
    );
    
    console.log('\n' + '='.repeat(70));
    console.log('📋 测试结果:');
    
    if (isSuccessful) {
      console.log('🎉 SUCCESS: LMStudio文本格式工具调用成功转换!');
      console.log('✅ 文本解析正确');
      console.log('✅ 工具调用格式正确');
      console.log('✅ Finish reason更新正确');
    } else {
      console.log('❌ FAILURE: LMStudio文本格式没有被正确解析');
      
      if (!choice.message.tool_calls) {
        console.log('- 没有检测到工具调用');
        console.log('- 可能的原因:');
        console.log('  1. Provider名称匹配失败');
        console.log('  2. 正则表达式匹配失败');
        console.log('  3. JSON解析失败');
      }
      
      if (choice.finish_reason !== 'tool_calls') {
        console.log('- Finish reason没有更新为"tool_calls"');
      }
    }
    
  } catch (error) {
    console.error('❌ 测试执行失败:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// 执行测试
testLMStudioPreprocessing();