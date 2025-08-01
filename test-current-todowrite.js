#!/usr/bin/env node

/**
 * 测试当前TodoWrite工具调用是否正确工作
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');

async function testCurrentTodoWrite() {
  console.log('🔍 测试当前TodoWrite工具调用\n');

  const todoWriteRequest = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: "请帮我创建一个todo项目：学习TypeScript"
      }
    ],
    tools: [
      {
        name: "TodoWrite",
        description: "创建和管理todo项目列表",
        input_schema: {
          type: "object",
          properties: {
            todos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  content: { type: "string", description: "todo内容" },
                  status: { type: "string", enum: ["pending", "in_progress", "completed"] },
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  id: { type: "string", description: "唯一标识符" }
                },
                required: ["content", "status", "priority", "id"]
              }
            }
          },
          required: ["todos"]
        }
      }
    ]
  };

  console.log('📤 发送TodoWrite请求到当前router:');

  try {
    const startTime = Date.now();

    const response = await axios.post(
      'http://127.0.0.1:3456/v1/messages',
      todoWriteRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        timeout: 30000
      }
    );

    const duration = Date.now() - startTime;
    console.log(`✅ 请求成功 (${duration}ms)`);
    
    console.log('\n📊 响应分析:');
    console.log(`   - 内容块数: ${response.data.content.length}`);
    
    let hasToolUse = false;
    let hasText = false;
    
    response.data.content.forEach((block, i) => {
      const preview = block.type === 'text' ? 
        `"${block.text?.substring(0, 50)}..."` :
        block.type === 'tool_use' ? 
        `${block.name}({${Object.keys(block.input).join(', ')}})` : 
        'unknown';
        
      console.log(`   [${i}] ${block.type}: ${preview}`);
      
      if (block.type === 'tool_use') hasToolUse = true;
      if (block.type === 'text') hasText = true;
    });

    console.log(`\n🎯 结果判定:`);
    console.log(`   - 包含工具调用: ${hasToolUse ? '✅' : '❌'}`);
    console.log(`   - 包含文本内容: ${hasText ? '⚠️ ' : '✅ '}`);
    console.log(`   - 修复状态: ${hasToolUse && !hasText ? '✅ 完全修复' : hasToolUse ? '⚠️ 部分修复（混合返回）' : '❌ 未修复'}`);

    if (hasToolUse) {
      const toolUse = response.data.content.find(c => c.type === 'tool_use');
      console.log(`\n🔍 工具调用详情:`);
      console.log(`   - 工具名称: ${toolUse.name}`);
      console.log(`   - 工具ID: ${toolUse.id}`);
      console.log(`   - 输入参数: ${JSON.stringify(toolUse.input, null, 2)}`);
    }

    // 保存结果
    const fs = require('fs');
    const path = require('path');
    const resultFile = path.join(__dirname, 'current-todowrite-test-result.json');
    fs.writeFileSync(resultFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      testCase: "当前TodoWrite工具调用测试",
      result: {
        success: true,
        duration: duration,
        response: response.data,
        hasToolUse: hasToolUse,
        hasText: hasText,
        fixStatus: hasToolUse && !hasText ? 'fully_fixed' : hasToolUse ? 'partially_fixed' : 'not_fixed'
      }
    }, null, 2));
    console.log(`\n📁 结果保存到: ${resultFile}`);

  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   错误详情:`, error.response.data);
    }
  }
}

// 运行测试
testCurrentTodoWrite().catch(console.error);