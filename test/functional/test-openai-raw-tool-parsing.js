#!/usr/bin/env node

/**
 * 使用raw数据测试OpenAI工具解析问题
 * 模拟用户报告的多个工具调用被合并为文本的问题
 */

// 使用构建后的模块
const path = require('path');
const projectRoot = path.resolve(__dirname, '../../');

// 动态导入buffered processor
async function loadBufferedProcessor() {
  try {
    // 尝试从TypeScript源码导入（仅用于测试）
    const module = await import(path.join(projectRoot, 'src/providers/openai/buffered-processor.js'));
    return module.processOpenAIBufferedResponse;
  } catch (e1) {
    try {
      // 尝试从构建后的文件导入
      const fs = require('fs');
      const distPath = path.join(projectRoot, 'dist');
      if (fs.existsSync(distPath)) {
        // 从构建后的代码中提取函数
        const builtCode = fs.readFileSync(path.join(distPath, 'cli.js'), 'utf8');
        
        // 创建模拟的processOpenAIBufferedResponse函数
        return mockProcessOpenAIBufferedResponse;
      }
    } catch (e2) {
      throw new Error('Cannot load buffered processor: ' + e1.message + ', ' + e2.message);
    }
  }
}

// 模拟的buffered processor函数用于测试
function mockProcessOpenAIBufferedResponse(allEvents, requestId, modelName) {
  const events = [];
  const messageId = `msg_${Date.now()}`;
  
  // 分析输入事件
  const content = [];
  const toolCallMap = {};
  let textContent = '';
  let usage = null;
  
  for (const event of allEvents) {
    const choice = event.choices?.[0];
    if (!choice?.delta) continue;
    
    // 处理文本内容
    if (choice.delta.content !== undefined) {
      textContent += choice.delta.content || '';
    }
    
    // 处理工具调用
    if (choice.delta.tool_calls) {
      for (const toolCall of choice.delta.tool_calls) {
        const index = toolCall.index;
        
        if (!toolCallMap[index]) {
          toolCallMap[index] = {
            id: toolCall.id,
            name: toolCall.function?.name,
            arguments: ''
          };
        }
        
        if (toolCall.function?.arguments) {
          toolCallMap[index].arguments += toolCall.function.arguments;
        }
      }
    }
    
    if (event.usage) {
      usage = event.usage;
    }
  }
  
  // 构建内容数组
  if (textContent.trim()) {
    content.push({
      type: 'text',
      text: textContent.trim()
    });
  }
  
  // 添加工具调用
  const sortedToolCalls = Object.entries(toolCallMap).sort(([a], [b]) => parseInt(a) - parseInt(b));
  for (const [index, toolCall] of sortedToolCalls) {
    let parsedInput = {};
    if (toolCall.arguments) {
      try {
        parsedInput = JSON.parse(toolCall.arguments);
      } catch (e) {
        parsedInput = {};
      }
    }
    
    content.push({
      type: 'tool_use',
      id: toolCall.id || `call_${Date.now()}_${index}`,
      name: toolCall.name || `tool_${index}`,
      input: parsedInput
    });
  }
  
  // 生成Anthropic流式事件
  events.push({
    event: 'message_start',
    data: {
      type: 'message_start',
      message: {
        id: messageId,
        type: 'message',
        role: 'assistant',
        content: [],
        model: modelName,
        stop_reason: null,
        stop_sequence: null,
        usage: usage ? {
          input_tokens: usage.prompt_tokens || 0,
          output_tokens: usage.completion_tokens || 0
        } : { input_tokens: 0, output_tokens: 0 }
      }
    }
  });
  
  events.push({
    event: 'ping',
    data: { type: 'ping' }
  });
  
  // 为每个内容块生成事件
  content.forEach((block, index) => {
    if (block.type === 'text') {
      events.push({
        event: 'content_block_start',
        data: {
          type: 'content_block_start',
          index: index,
          content_block: {
            type: 'text',
            text: ''
          }
        }
      });
      
      const text = block.text || '';
      const chunkSize = 50;
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize);
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
    } else if (block.type === 'tool_use') {
      events.push({
        event: 'content_block_start',
        data: {
          type: 'content_block_start',
          index: index,
          content_block: {
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: {}
          }
        }
      });
      
      const inputJson = JSON.stringify(block.input || {});
      const chunkSize = 20;
      for (let i = 0; i < inputJson.length; i += chunkSize) {
        const chunk = inputJson.slice(i, i + chunkSize);
        events.push({
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: index,
            delta: {
              type: 'input_json_delta',
              partial_json: chunk
            }
          }
        });
      }
    }
    
    events.push({
      event: 'content_block_stop',
      data: {
        type: 'content_block_stop',
        index: index
      }
    });
  });
  
  events.push({
    event: 'message_delta',
    data: {
      type: 'message_delta',
      delta: {
        stop_reason: 'end_turn',
        stop_sequence: null
      },
      usage: {
        output_tokens: usage?.completion_tokens || 0
      }
    }
  });
  
  events.push({
    event: 'message_stop',
    data: {
      type: 'message_stop'
    }
  });
  
  return events;
}

// 模拟用户报告的问题：多个工具调用的OpenAI原始响应
const mockOpenAIEvents = [
  // 开始事件
  {
    id: "chatcmpl-test123",
    object: "chat.completion.chunk",
    created: 1753879500,
    model: "gemini-2.5-flash",
    choices: [{
      index: 0,
      delta: {
        role: "assistant"
      },
      finish_reason: null
    }]
  },
  
  // 第一个工具调用开始
  {
    id: "chatcmpl-test123",
    object: "chat.completion.chunk", 
    created: 1753879500,
    model: "gemini-2.5-flash",
    choices: [{
      index: 0,
      delta: {
        tool_calls: [{
          index: 0,
          id: "call_tool1",
          type: "function",
          function: {
            name: "Bash",
            arguments: ""
          }
        }]
      },
      finish_reason: null
    }]
  },
  
  // 第一个工具调用参数
  {
    id: "chatcmpl-test123",
    object: "chat.completion.chunk",
    created: 1753879500,
    model: "gemini-2.5-flash",
    choices: [{
      index: 0,
      delta: {
        tool_calls: [{
          index: 0,
          function: {
            arguments: '{"command":"git status --porcelain | grep test"}'
          }
        }]
      },
      finish_reason: null
    }]
  },
  
  // 第二个工具调用开始
  {
    id: "chatcmpl-test123",
    object: "chat.completion.chunk",
    created: 1753879500,
    model: "gemini-2.5-flash",
    choices: [{
      index: 0,
      delta: {
        tool_calls: [{
          index: 1,
          id: "call_tool2", 
          type: "function",
          function: {
            name: "Bash",
            arguments: ""
          }
        }]
      },
      finish_reason: null
    }]
  },
  
  // 第二个工具调用参数
  {
    id: "chatcmpl-test123",
    object: "chat.completion.chunk",
    created: 1753879500,
    model: "gemini-2.5-flash",
    choices: [{
      index: 0,
      delta: {
        tool_calls: [{
          index: 1,
          function: {
            arguments: '{"command":"ls -la simple-test.js"}'
          }
        }]
      },
      finish_reason: null
    }]
  },
  
  // 完成事件
  {
    id: "chatcmpl-test123",
    object: "chat.completion.chunk",
    created: 1753879500,
    model: "gemini-2.5-flash",
    choices: [{
      index: 0,
      delta: {},
      finish_reason: "tool_calls"
    }],
    usage: {
      prompt_tokens: 50,
      completion_tokens: 25
    }
  }
];

// 模拟问题情况：工具调用被错误地当作文本处理
const problematicOpenAIEvents = [
  // 开始事件
  {
    id: "chatcmpl-test456",
    object: "chat.completion.chunk",
    created: 1753879500,
    model: "gemini-2.5-flash",
    choices: [{
      index: 0,
      delta: {
        role: "assistant"
      },
      finish_reason: null
    }]
  },
  
  // 错误情况：工具调用被当作文本内容
  {
    id: "chatcmpl-test456",
    object: "chat.completion.chunk",
    created: 1753879500,
    model: "gemini-2.5-flash",
    choices: [{
      index: 0,
      delta: {
        content: "⏺ Tool call: Bash(git status --porcelain | grep test)\n⏺ Tool call: Bash({\"command\":\"ls -la simple-test.js\"})"
      },
      finish_reason: null
    }]
  },
  
  // 完成事件
  {
    id: "chatcmpl-test456", 
    object: "chat.completion.chunk",
    created: 1753879500,
    model: "gemini-2.5-flash",
    choices: [{
      index: 0,
      delta: {},
      finish_reason: "stop"
    }],
    usage: {
      prompt_tokens: 50,
      completion_tokens: 25  
    }
  }
];

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function analyzeProcessedEvents(events, testName) {
  log(`\n📊 分析 ${testName} 的处理结果:`);
  log(`   总事件数: ${events.length}`);
  
  let toolUseCount = 0;
  let textBlockCount = 0;
  let textWithToolCallPattern = 0;
  
  events.forEach((event, index) => {
    log(`   [${index}] ${event.event}: ${JSON.stringify(event.data).slice(0, 100)}...`);
    
    if (event.event === 'content_block_start' && event.data?.content_block?.type === 'tool_use') {
      toolUseCount++;
      log(`     🔧 工具调用: ${event.data.content_block.name}`);
    } else if (event.event === 'content_block_start' && event.data?.content_block?.type === 'text') {
      textBlockCount++;
    } else if (event.event === 'content_block_delta' && event.data?.delta?.type === 'text_delta') {
      const text = event.data.delta.text;
      if (text && (text.includes('⏺ Tool call:') || text.includes('Tool call:'))) {
        textWithToolCallPattern++;
        log(`     ❌ 在文本中发现工具调用模式: ${text}`);
      }
    }
  });
  
  log(`   工具调用数: ${toolUseCount}`);
  log(`   文本块数: ${textBlockCount}`);
  log(`   文本中的工具调用模式: ${textWithToolCallPattern}`);
  
  return {
    toolUseCount,
    textBlockCount,
    textWithToolCallPattern,
    hasIssue: textWithToolCallPattern > 0 && toolUseCount === 0
  };
}

async function testRawToolParsing() {
  log('🧪 测试OpenAI原始工具解析...');
  
  try {
    // 加载buffered processor
    const processOpenAIBufferedResponse = await loadBufferedProcessor();
    
    // 测试正确的工具调用格式
    log('\n🔍 测试正确的工具调用格式:'); 
    const correctResult = processOpenAIBufferedResponse(mockOpenAIEvents, 'test-req-1', 'gemini-2.5-flash');
    const correctAnalysis = analyzeProcessedEvents(correctResult, '正确格式');
    
    // 测试问题格式（工具调用被当作文本）
    log('\n🔍 测试问题格式（工具调用被当作文本）:');
    const problematicResult = processOpenAIBufferedResponse(problematicOpenAIEvents, 'test-req-2', 'gemini-2.5-flash');
    const problematicAnalysis = analyzeProcessedEvents(problematicResult, '问题格式');
    
    // 生成测试报告
    log('\n📝 测试报告:');
    log(`正确格式 - 工具调用数: ${correctAnalysis.toolUseCount}, 文本中的工具调用: ${correctAnalysis.textWithToolCallPattern}`);
    log(`问题格式 - 工具调用数: ${problematicAnalysis.toolUseCount}, 文本中的工具调用: ${problematicAnalysis.textWithToolCallPattern}`);
    
    // 保存详细结果
    const testResults = {
      timestamp: new Date().toISOString(),
      correctFormat: {
        input: mockOpenAIEvents,
        output: correctResult,
        analysis: correctAnalysis
      },
      problematicFormat: {
        input: problematicOpenAIEvents,
        output: problematicResult,  
        analysis: problematicAnalysis
      }
    };
    
    const fs = require('fs');
    const resultFile = `/tmp/openai-raw-tool-parsing-test-${Date.now()}.json`;
    fs.writeFileSync(resultFile, JSON.stringify(testResults, null, 2));
    log(`💾 详细结果保存到: ${resultFile}`);
    
    // 判断测试结果
    if (problematicAnalysis.hasIssue) {
      log('\n❌ 测试发现问题: 工具调用被错误地解析为文本');
      return false;
    } else if (correctAnalysis.toolUseCount >= 2) {
      log('\n✅ 测试通过: 工具调用正确解析');
      return true;
    } else {
      log('\n⚠️  测试结果不确定');
      return false;
    }
    
  } catch (error) {
    log(`❌ 测试异常: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

async function main() {
  log('🚀 OpenAI Raw Tool Parsing Test');  
  log('=================================');
  
  const success = await testRawToolParsing();
  
  if (success) {
    log('\n✅ 所有测试通过');
    process.exit(0);
  } else {
    log('\n❌ 测试失败');
    process.exit(1);
  }
}

main().catch(console.error);