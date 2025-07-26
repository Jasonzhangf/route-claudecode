#!/usr/bin/env node

/**
 * 多轮工具调用会话测试
 * 测试复杂的连续工具调用场景，验证多轮会话的工具调用上下文保持
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

async function testMultiTurnToolCalls() {
  console.log('🧪 测试多轮工具调用会话功能...\n');

  const baseUrl = 'http://127.0.0.1:3456';
  const sessionId = `tool-session-${Date.now()}`;
  
  console.log(`📋 工具调用会话配置:`);
  console.log(`   基础URL: ${baseUrl}`);
  console.log(`   会话ID: ${sessionId}`);
  console.log(`   模型: claude-3-5-sonnet-20241022`);

  // 定义工具
  const tools = [
    {
      name: "create_file",
      description: "Create a new file with specified content",
      input_schema: {
        type: "object",
        properties: {
          filename: { type: "string", description: "Name of the file to create" },
          content: { type: "string", description: "Content to write to the file" }
        },
        required: ["filename", "content"]
      }
    },
    {
      name: "read_file", 
      description: "Read content from an existing file",
      input_schema: {
        type: "object",
        properties: {
          filename: { type: "string", description: "Name of the file to read" }
        },
        required: ["filename"]
      }
    },
    {
      name: "list_files",
      description: "List all files in the current directory",
      input_schema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Optional pattern to filter files" }
        }
      }
    },
    {
      name: "calculate",
      description: "Perform mathematical calculations",
      input_schema: {
        type: "object", 
        properties: {
          expression: { type: "string", description: "Mathematical expression to evaluate" }
        },
        required: ["expression"]
      }
    }
  ];

  // 复杂的多轮工具调用任务序列
  const taskSequence = [
    {
      turn: 1,
      description: "创建项目文件",
      message: "请帮我创建一个名为 'project_info.txt' 的文件，内容包含项目名称 'MyProject' 和版本号 '1.0.0'。",
      expectedTools: ["create_file"],
      validation: (response, toolCalls) => {
        return toolCalls.some(call => 
          call.name === 'create_file' && 
          call.input.filename?.includes('project_info') &&
          call.input.content?.includes('MyProject') &&
          call.input.content?.includes('1.0.0')
        );
      }
    },
    {
      turn: 2,
      description: "读取并验证文件",
      message: "现在读取刚才创建的文件，确认内容是否正确。",
      expectedTools: ["read_file"],
      validation: (response, toolCalls) => {
        return toolCalls.some(call => 
          call.name === 'read_file' && 
          call.input.filename?.includes('project_info')
        );
      }
    },
    {
      turn: 3,
      description: "基于文件内容计算",
      message: "根据刚才读取的版本号，计算下一个主版本号（加1），然后创建一个新文件 'next_version.txt' 包含计算结果。",
      expectedTools: ["calculate", "create_file"],
      validation: (response, toolCalls) => {
        const hasCalculate = toolCalls.some(call => call.name === 'calculate');
        const hasCreateFile = toolCalls.some(call => 
          call.name === 'create_file' && 
          call.input.filename?.includes('next_version')
        );
        return hasCalculate && hasCreateFile;
      }
    },
    {
      turn: 4,
      description: "列出所有文件并总结",
      message: "列出目录中的所有文件，然后告诉我这个工作流程中我们总共创建了几个文件，分别是什么。",
      expectedTools: ["list_files"],
      validation: (response, toolCalls) => {
        const hasListFiles = toolCalls.some(call => call.name === 'list_files');
        const mentionsBothFiles = response.toLowerCase().includes('project_info') && 
                                 response.toLowerCase().includes('next_version');
        return hasListFiles && mentionsBothFiles;
      }
    }
  ];

  const results = [];

  try {
    for (const task of taskSequence) {
      console.log(`\n🔧 第 ${task.turn} 轮 - ${task.description}:`);
      console.log(`   任务: ${task.message}`);

      const result = await sendToolCallMessage(baseUrl, sessionId, task.message, tools);
      
      console.log(`   响应长度: ${result.response.length} 字符`);
      console.log(`   工具调用数: ${result.toolCalls.length}`);
      
      // 显示工具调用详情
      result.toolCalls.forEach((call, index) => {
        console.log(`   工具 ${index + 1}: ${call.name}(${JSON.stringify(call.input).substring(0, 50)}...)`);
      });

      // 验证任务完成情况
      const isValid = task.validation(result.response, result.toolCalls);
      const hasExpectedTools = task.expectedTools.every(expectedTool => 
        result.toolCalls.some(call => call.name === expectedTool)
      );

      const taskResult = {
        turn: task.turn,
        description: task.description,
        message: task.message,
        response: result.response,
        toolCalls: result.toolCalls,
        toolCallCount: result.toolCalls.length,
        expectedTools: task.expectedTools,
        hasExpectedTools: hasExpectedTools,
        validationPassed: isValid,
        success: hasExpectedTools && isValid
      };

      results.push(taskResult);

      console.log(`   期望工具: ${task.expectedTools.join(', ')}`);
      console.log(`   工具检查: ${hasExpectedTools ? '✅ 通过' : '❌ 失败'}`);
      console.log(`   验证结果: ${isValid ? '✅ 通过' : '❌ 失败'}`);
      console.log(`   总体状态: ${taskResult.success ? '✅ 成功' : '❌ 失败'}`);

      // 模拟工具调用响应（在真实环境中这些会由工具执行）
      for (const toolCall of result.toolCalls) {
        await sendToolResponse(baseUrl, sessionId, toolCall);
      }

      // 短暂延迟
      await sleep(1000);
    }

    // 分析整体结果
    console.log('\n📊 多轮工具调用测试分析:');
    const successfulTurns = results.filter(r => r.success).length;
    const totalTurns = results.length;
    const totalToolCalls = results.reduce((sum, r) => sum + r.toolCallCount, 0);
    
    console.log(`   总任务轮数: ${totalTurns}`);
    console.log(`   成功轮数: ${successfulTurns}`);
    console.log(`   成功率: ${Math.round(successfulTurns / totalTurns * 100)}%`);
    console.log(`   总工具调用: ${totalToolCalls} 次`);

    // 检查工具调用上下文保持
    const contextPreservation = results.slice(1).every((result, index) => {
      // 检查后续轮次是否能正确引用前面创建的文件
      const prevTurn = results[index];
      if (prevTurn.toolCalls.some(call => call.name === 'create_file')) {
        return result.toolCalls.some(call => 
          call.name === 'read_file' || 
          result.response.toLowerCase().includes('project_info') ||
          result.response.toLowerCase().includes('next_version')
        );
      }
      return true;
    });

    console.log(`   上下文保持: ${contextPreservation ? '✅ 正常' : '❌ 异常'}`);

    // 保存详细结果
    const testResults = {
      timestamp: new Date().toISOString(),
      sessionId: sessionId,
      totalTurns: totalTurns,
      successfulTurns: successfulTurns,
      successRate: successfulTurns / totalTurns,
      totalToolCalls: totalToolCalls,
      contextPreservation: contextPreservation,
      tasks: results,
      overall: successfulTurns === totalTurns && contextPreservation
    };

    const resultFile = path.join(__dirname, 'debug', 'debug-output', `tool-calls-test-${sessionId}.json`);
    const resultDir = path.dirname(resultFile);
    if (!fs.existsSync(resultDir)) {
      fs.mkdirSync(resultDir, { recursive: true });
    }
    fs.writeFileSync(resultFile, JSON.stringify(testResults, null, 2));
    console.log(`\n💾 详细结果已保存: ${resultFile}`);

    // 最终判断
    if (testResults.overall) {
      console.log('\n🎉 多轮工具调用测试完全成功！');
      console.log('✅ 工具调用上下文正确保持');
      console.log('✅ 复杂任务流程正确执行');
      console.log('✅ 跨轮次状态管理正常');
      return true;
    } else {
      console.log('\n❌ 多轮工具调用测试失败');
      console.log(`❌ ${totalTurns - successfulTurns} 轮任务执行失败`);
      console.log(`❌ 上下文保持: ${contextPreservation ? '正常' : '异常'}`);
      return false;
    }

  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
    return false;
  }
}

async function sendToolCallMessage(baseUrl, sessionId, message, tools) {
  const requestBody = {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: message
    }],
    tools: tools,
    stream: true
  };

  const headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'Authorization': 'Bearer test-key',
    'x-session-id': sessionId
  };

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // 读取流式响应
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let toolCalls = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const eventData = JSON.parse(line.substring(6));
          if (eventData.type === 'content_block_delta' && eventData.delta && eventData.delta.text) {
            fullResponse += eventData.delta.text;
          } else if (eventData.type === 'content_block_start' && eventData.content_block && eventData.content_block.type === 'tool_use') {
            toolCalls.push({
              id: eventData.content_block.id,
              name: eventData.content_block.name,
              input: {}
            });
          } else if (eventData.type === 'content_block_delta' && eventData.delta && eventData.delta.partial_json) {
            // 工具调用参数
            if (toolCalls.length > 0) {
              const currentTool = toolCalls[toolCalls.length - 1];
              try {
                currentTool.input = JSON.parse(eventData.delta.partial_json);
              } catch (e) {
                // 部分JSON，继续累积
              }
            }
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }

  return { response: fullResponse, toolCalls };
}

async function sendToolResponse(baseUrl, sessionId, toolCall) {
  // 模拟工具执行结果
  let toolResult;
  
  switch (toolCall.name) {
    case 'create_file':
      toolResult = `File '${toolCall.input.filename}' created successfully with content: ${toolCall.input.content?.substring(0, 50)}...`;
      break;
    case 'read_file':
      toolResult = `Content of '${toolCall.input.filename}': MyProject\nVersion: 1.0.0`;
      break;
    case 'list_files':
      toolResult = 'Files found: project_info.txt, next_version.txt';
      break;
    case 'calculate':
      const expr = toolCall.input.expression;
      if (expr.includes('1') && expr.includes('+')) {
        toolResult = '2.0.0';
      } else {
        toolResult = 'Calculation result: ' + expr;
      }
      break;
    default:
      toolResult = 'Tool executed successfully';
  }

  // 发送工具结果回到会话
  const requestBody = {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: toolResult
        }
      ]
    }],
    stream: false
  };

  const headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01', 
    'Authorization': 'Bearer test-key',
    'x-session-id': sessionId
  };

  // 这里只是模拟，不实际发送
  console.log(`   模拟工具响应: ${toolCall.name} -> ${toolResult.substring(0, 30)}...`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行测试
if (require.main === module) {
  testMultiTurnToolCalls()
    .then(success => {
      console.log(`\n${success ? '✅ 多轮工具调用功能正常' : '❌ 多轮工具调用功能异常'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(console.error);
}

module.exports = { testMultiTurnToolCalls };