#!/usr/bin/env node

/**
 * LMStudio工具调用解析器独立测试
 * 测试真实的LMStudio响应数据解析能力
 */

console.log('🧪 LMStudio工具调用解析器独立测试开始...\n');

// 简化的解析器实现（复制关键逻辑）
class SimpleLMStudioParser {
  constructor(requestId, originalTools = []) {
    this.requestId = requestId;
    this.originalTools = originalTools;
  }

  /**
   * 解析JSON格式的工具调用
   */
  parseJsonFormatToolCalls(content) {
    const jsonPattern = /\{"([^"]+)"\s*:\s*"([^"]+)"\s*,\s*"([^"]+)"\s*:\s*"([^"]+)"\s*\}/g;
    const toolCalls = [];
    let match;
    
    while ((match = jsonPattern.exec(content)) !== null) {
      const [fullMatch, key1, value1, key2, value2] = match;
      
      // 检查是否是filename和content的组合
      if ((key1 === 'filename' && key2 === 'content') || (key1 === 'content' && key2 === 'filename')) {
        const toolCall = {
          id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
          type: 'function',
          function: {
            name: 'create_file',
            arguments: JSON.stringify({
              filename: key1 === 'filename' ? value1 : value2,
              content: key1 === 'content' ? value1 : value2
            })
          }
        };
        
        toolCalls.push(toolCall);
      }
    }
    
    return {
      success: toolCalls.length > 0,
      toolCalls,
      remainingContent: content,
      parseMethod: 'json_extraction',
      confidence: toolCalls.length > 0 ? 0.8 : 0
    };
  }

  /**
   * 解析LMStudio特殊格式
   */
  parseLMStudioSpecialFormat(content) {
    // 解析 <|constrain|>json<|message|>{"filename":"debug.txt","content":"hello world"} 格式
    const lmstudioPattern = /<\|constrain\|>json<\|message\|>(\{[^}]*\})/g;
    const toolCalls = [];
    let match;
    
    while ((match = lmstudioPattern.exec(content)) !== null) {
      try {
        const jsonStr = match[1];
        const parsed = JSON.parse(jsonStr);
        
        if (parsed.filename && parsed.content) {
          const toolCall = {
            id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
            type: 'function',
            function: {
              name: 'create_file',
              arguments: JSON.stringify(parsed)
            }
          };
          
          toolCalls.push(toolCall);
        }
      } catch (error) {
        console.log('❌ JSON解析错误:', error.message);
      }
    }
    
    return {
      success: toolCalls.length > 0,
      toolCalls,
      remainingContent: content,
      parseMethod: 'lmstudio_special',
      confidence: toolCalls.length > 0 ? 0.9 : 0
    };
  }

  async parseResponse(response) {
    try {
      // 提取内容
      const content = response?.choices?.[0]?.message?.content || '';
      if (!content) {
        return {
          success: false,
          toolCalls: [],
          remainingContent: '',
          parseMethod: 'none',
          confidence: 0
        };
      }

      console.log('📝 解析内容:', content.substring(0, 200) + '...');

      // 尝试LMStudio特殊格式解析
      const lmstudioResult = this.parseLMStudioSpecialFormat(content);
      if (lmstudioResult.success) {
        return lmstudioResult;
      }

      // 尝试JSON格式解析
      const jsonResult = this.parseJsonFormatToolCalls(content);
      if (jsonResult.success) {
        return jsonResult;
      }

      return {
        success: false,
        toolCalls: [],
        remainingContent: content,
        parseMethod: 'none',
        confidence: 0
      };

    } catch (error) {
      console.log('❌ 解析过程中发生错误:', error.message);
      return {
        success: false,
        toolCalls: [],
        remainingContent: response?.choices?.[0]?.message?.content || '',
        parseMethod: 'none',
        confidence: 0
      };
    }
  }
}

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

    // 创建解析器实例
    console.log('🔧 创建解析器实例...');
    const parser = new SimpleLMStudioParser('test-request-id', tools);
    console.log('✅ 解析器实例创建成功');

    // 执行解析
    console.log('\n⚡ 执行解析...');
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

    // 测试结果验证
    console.log('\n🎯 结果验证...');
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
  console.log('\n🏁 独立解析测试完成');
}).catch(console.error);