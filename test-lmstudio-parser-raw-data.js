#!/usr/bin/env node

/**
 * LMStudio工具调用解析器原始数据测试
 * 使用真实的LMStudio响应数据测试解析器
 */

// Import from the specific file for better compatibility
const { LMStudioToolCallParser } = require('./dist/providers/lmstudio/tool-call-parser.js');

console.log('🧪 LMStudio工具调用解析器原始数据测试开始...\n');

// 模拟真实的LMStudio响应数据
const mockLMStudioResponse = {
  id: "chatcmpl-test123",
  object: "chat.completion",
  created: Date.now(),
  model: "gpt-oss-20b-mlx",
  choices: [{
    index: 0,
    message: {
      role: "assistant",
      content: 'We need to create a file named debug.txt with content "hello world". Use the tool.<|start|>assistant<|channel|>commentary to=functions.create_file <|constrain|>json<|message|>{"filename":"debug.txt","content":"hello world"}'
    },
    finish_reason: "stop"
  }],
  usage: {
    prompt_tokens: 68,
    completion_tokens: 50,
    total_tokens: 118
  }
};

// 工具定义
const tools = [{
  type: "function",
  function: {
    name: "create_file",
    description: "Create a file with specified content",
    parameters: {
      type: "object",
      properties: {
        filename: { type: "string" },
        content: { type: "string" }
      },
      required: ["filename", "content"]
    }
  }
}];

async function testParser() {
  try {
    console.log('📝 测试数据:');
    console.log('响应内容:', mockLMStudioResponse.choices[0].message.content);
    console.log('工具定义数量:', tools.length);
    console.log('');

    // 测试解析器导入
    console.log('🔍 测试1: 检查解析器导入...');
    if (typeof LMStudioToolCallParser !== 'function') {
      console.log('❌ LMStudioToolCallParser导入失败 - 不是一个构造函数');
      console.log('实际类型:', typeof LMStudioToolCallParser);
      console.log('可用属性:', Object.keys(LMStudioToolCallParser || {}));
      return;
    }
    console.log('✅ LMStudioToolCallParser导入成功');

    // 创建解析器实例
    console.log('\n🔧 测试2: 创建解析器实例...');
    const parser = new LMStudioToolCallParser('test-request-id', tools);
    console.log('✅ 解析器实例创建成功');

    // 执行解析
    console.log('\n⚡ 测试3: 执行解析...');
    const parseResult = await parser.parseResponse(mockLMStudioResponse);
    
    console.log('📊 解析结果:');
    console.log('  - 解析成功:', parseResult.success);
    console.log('  - 解析方法:', parseResult.parseMethod);
    console.log('  - 置信度:', parseResult.confidence);
    console.log('  - 工具调用数量:', parseResult.toolCalls?.length || 0);
    
    if (parseResult.toolCalls && parseResult.toolCalls.length > 0) {
      console.log('🔧 工具调用详情:');
      parseResult.toolCalls.forEach((call, index) => {
        console.log(`   ${index + 1}. ID: ${call.id}`);
        console.log(`      函数: ${call.function?.name}`);
        console.log(`      参数: ${call.function?.arguments}`);
      });
    }

    if (parseResult.remainingContent) {
      console.log('📄 剩余内容:', parseResult.remainingContent.substring(0, 100) + '...');
    }

    // 测试结果验证
    console.log('\n🎯 测试4: 结果验证...');
    if (parseResult.success && parseResult.toolCalls.length > 0) {
      const toolCall = parseResult.toolCalls[0];
      try {
        const args = JSON.parse(toolCall.function.arguments);
        if (args.filename === 'debug.txt' && args.content === 'hello world') {
          console.log('✅ 工具调用解析完全正确！');
        } else {
          console.log('❌ 工具调用参数解析错误');
          console.log('期望: filename="debug.txt", content="hello world"');
          console.log('实际:', args);
        }
      } catch (e) {
        console.log('❌ 工具调用参数JSON解析失败:', e.message);
      }
    } else {
      console.log('❌ 解析失败或未找到工具调用');
    }

  } catch (error) {
    console.log('❌ 测试过程中发生错误:', error.message);
    console.log('错误堆栈:', error.stack);
  }
}

// 运行测试
testParser().then(() => {
  console.log('\n🏁 原始数据解析测试完成');
}).catch(console.error);