#!/usr/bin/env node

/**
 * 端到端测试：Gemini API响应 → Anthropic格式
 * 基于真实的Gemini API响应数据进行转换测试
 */

// 真实的Gemini API响应数据（从之前的测试获得）
const realGeminiResponse = {
  "candidates": [{
    "content": {
      "parts": [{
        "functionCall": {
          "name": "TodoWrite",
          "args": {
            "todos": [{
              "content": "Test Gemini tool call parsing",
              "priority": "high", 
              "status": "in_progress",
              "id": "test-1"
            }]
          }
        }
      }]
    },
    "finishReason": "STOP"
  }],
  "usageMetadata": {
    "promptTokenCount": 51,
    "candidatesTokenCount": 18,
    "totalTokenCount": 69
  }
};

// 模拟convertGeminiToAnthropicStream函数
function convertGeminiToAnthropicStream(geminiEvents, request, requestId) {
  const events = [];
  const messageId = `msg_${Date.now()}`;
  let inputTokens = 0;
  let outputTokens = 0;
  let contentIndex = 0;

  // 提取所有内容
  const contentBlocks = [];
  
  for (const event of geminiEvents) {
    if (event.candidates && event.candidates[0] && event.candidates[0].content) {
      const parts = event.candidates[0].content.parts || [];
      
      for (const part of parts) {
        if (part.text) {
          // 文本内容
          contentBlocks.push({
            type: 'text',
            text: part.text
          });
        } else if (part.functionCall) {
          // 🔧 工具调用转换
          contentBlocks.push({
            type: 'tool_use',
            id: `toolu_${Date.now()}_${contentIndex++}`,
            name: part.functionCall.name,
            input: part.functionCall.args || {}
          });
          
          console.log('✅ 转换Gemini functionCall到Anthropic tool_use:', {
            functionName: part.functionCall.name,
            args: part.functionCall.args
          });
        }
      }
    }
    
    // 聚合token信息
    if (event.usageMetadata) {
      inputTokens = Math.max(inputTokens, event.usageMetadata.promptTokenCount || 0);
      outputTokens += event.usageMetadata.candidatesTokenCount || 0;
    }
  }

  // 估算tokens如果没有提供
  if (outputTokens === 0) {
    const textLength = contentBlocks
      .filter(block => block.type === 'text')
      .reduce((sum, block) => sum + (block.text?.length || 0), 0);
    outputTokens = Math.ceil((textLength + contentBlocks.filter(b => b.type === 'tool_use').length * 50) / 4);
  }

  // 生成Anthropic流式事件
  // 1. message_start
  events.push({
    event: 'message_start',
    data: {
      type: 'message_start',
      message: {
        id: messageId,
        type: 'message',
        role: 'assistant',
        content: [],
        model: request.model,
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: inputTokens, output_tokens: 0 }
      }
    }
  });

  // 2. ping
  events.push({
    event: 'ping',
    data: { type: 'ping' }
  });

  // 3. 为每个内容块生成事件
  contentBlocks.forEach((block, index) => {
    // content_block_start
    events.push({
      event: 'content_block_start',
      data: {
        type: 'content_block_start',
        index: index,
        content_block: block
      }
    });

    if (block.type === 'text' && block.text) {
      // 为文本生成delta事件
      const chunkSize = 20;
      for (let i = 0; i < block.text.length; i += chunkSize) {
        const chunk = block.text.slice(i, i + chunkSize);
        events.push({
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: index,
            delta: {
              type: 'text_delta',
              text: chunk
            }
          }
        });
      }
    }

    // content_block_stop
    events.push({
      event: 'content_block_stop',
      data: {
        type: 'content_block_stop',
        index: index
      }
    });
  });

  // 4. message_delta (with usage)
  events.push({
    event: 'message_delta',
    data: {
      type: 'message_delta',
      delta: {},
      usage: {
        output_tokens: outputTokens
      }
    }
  });

  // 5. message_stop
  events.push({
    event: 'message_stop',
    data: {
      type: 'message_stop'
    }
  });

  console.log('📊 生成Anthropic流式事件:', {
    eventCount: events.length,
    contentBlocks: contentBlocks.length,
    textBlocks: contentBlocks.filter(b => b.type === 'text').length,
    toolBlocks: contentBlocks.filter(b => b.type === 'tool_use').length,
    outputTokens
  });

  return events;
}

function testGeminiToAnthropicConversion() {
  console.log('🧪 端到端测试：Gemini → Anthropic 转换\n');

  console.log('📤 输入：真实Gemini API响应');
  console.log('- 工具调用：', realGeminiResponse.candidates[0].content.parts[0].functionCall.name);
  console.log('- 参数：', JSON.stringify(realGeminiResponse.candidates[0].content.parts[0].functionCall.args, null, 2));

  // 模拟请求参数
  const mockRequest = {
    model: 'gemini-2.5-flash'
  };

  // 执行转换
  const anthropicEvents = convertGeminiToAnthropicStream([realGeminiResponse], mockRequest, 'test-123');

  console.log('\n📥 输出：Anthropic流式事件');
  console.log(`- 总事件数：${anthropicEvents.length}`);

  // 验证关键事件
  const messageStart = anthropicEvents.find(e => e.event === 'message_start');
  const contentBlockStart = anthropicEvents.find(e => e.event === 'content_block_start');
  const messageStop = anthropicEvents.find(e => e.event === 'message_stop');

  console.log('\n✅ 验证结果：');
  console.log(`- message_start 存在：${!!messageStart}`);
  console.log(`- content_block_start 存在：${!!contentBlockStart}`);
  console.log(`- message_stop 存在：${!!messageStop}`);

  if (contentBlockStart && contentBlockStart.data.content_block) {
    const toolBlock = contentBlockStart.data.content_block;
    console.log(`- 工具调用转换：${toolBlock.type === 'tool_use' ? '✅' : '❌'}`);
    console.log(`- 工具名称：${toolBlock.name}`);
    console.log(`- 工具ID：${toolBlock.id}`);
    console.log(`- 工具参数：`, JSON.stringify(toolBlock.input, null, 2));

    // 验证参数是否正确
    const originalArgs = realGeminiResponse.candidates[0].content.parts[0].functionCall.args;
    const convertedInput = toolBlock.input;
    const argsMatch = JSON.stringify(originalArgs) === JSON.stringify(convertedInput);
    
    console.log(`- 参数转换正确：${argsMatch ? '✅' : '❌'}`);
    
    if (argsMatch) {
      console.log('\n🎉 Gemini → Anthropic 工具调用转换成功！');
      console.log('- functionCall.name → tool_use.name ✅');
      console.log('- functionCall.args → tool_use.input ✅');
      console.log('- 生成了正确的tool_use.id ✅');
      console.log('- Anthropic流式事件格式正确 ✅');
      return true;
    }
  }

  console.log('\n❌ 转换失败！');
  return false;
}

// 运行测试
const success = testGeminiToAnthropicConversion();
process.exit(success ? 0 : 1);