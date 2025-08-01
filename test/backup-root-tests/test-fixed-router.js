#!/usr/bin/env node

/**
 * 测试修复后的router实际处理工具调用
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');

async function testFixedRouter() {
  console.log('🔍 测试修复后的router实际处理工具调用\n');

  const toolCallRequest = {
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

  // 测试我们修复后的router
  console.log('📤 测试修复后的router:');

  try {
    const startTime = Date.now();

    const response = await axios.post(
      'http://127.0.0.1:3456/v1/messages',
      toolCallRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        timeout: 60000
      }
    );

    const duration = Date.now() - startTime;
    console.log(`✅ Router调用成功 (${duration}ms)`);
    
    console.log('\n📊 结果分析:');
    console.log(`   - 内容块数: ${response.data.content.length}`);
    
    response.data.content.forEach((block, i) => {
      console.log(`   [${i}] ${block.type}: ${
        block.type === 'text' ? `"${block.text?.substring(0, 50)}..."` :
        block.type === 'tool_use' ? `${block.name}(${JSON.stringify(block.input).substring(0, 100)}...)` : 'unknown'
      }`);
    });

    const hasToolUse = response.data.content.some(c => c.type === 'tool_use');
    console.log(`\n🎯 工具调用状态: ${hasToolUse ? '✅ 成功' : '❌ 失败'}`);

    // 对比Demo2
    console.log('\n📤 对比Demo2:');
    try {
      const demo2StartTime = Date.now();
      
      const demo2Response = await axios.post(
        'http://127.0.0.1:8080/v1/messages',
        toolCallRequest,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          },
          timeout: 30000
        }
      );

      const demo2Duration = Date.now() - demo2StartTime;
      console.log(`✅ Demo2调用成功 (${demo2Duration}ms)`);
      
      console.log(`   - Demo2内容块数: ${demo2Response.data.content.length}`);
      
      demo2Response.data.content.forEach((block, i) => {
        console.log(`   [${i}] ${block.type}: ${
          block.type === 'text' ? `"${block.text?.substring(0, 50)}..."` :
          block.type === 'tool_use' ? `${block.name}(${JSON.stringify(block.input).substring(0, 100)}...)` : 'unknown'
        }`);
      });

      const demo2HasToolUse = demo2Response.data.content.some(c => c.type === 'tool_use');
      
      console.log(`\n🎯 最终对比结果:`);
      console.log(`   我们的router有工具调用: ${hasToolUse ? '✅' : '❌'}`);
      console.log(`   Demo2有工具调用: ${demo2HasToolUse ? '✅' : '❌'}`);
      console.log(`   修复状态: ${hasToolUse === demo2HasToolUse ? '✅ 一致' : '❌ 不一致'}`);

      if (hasToolUse && demo2HasToolUse) {
        const ourTool = response.data.content.find(c => c.type === 'tool_use');
        const demo2Tool = demo2Response.data.content.find(c => c.type === 'tool_use');
        
        console.log(`\n🔍 工具调用详细对比:`);
        console.log(`   我们的工具: ${ourTool.name}`);
        console.log(`   Demo2工具: ${demo2Tool.name}`);
        console.log(`   工具名称一致: ${ourTool.name === demo2Tool.name ? '✅' : '❌'}`);
        
        const ourInputKeys = Object.keys(ourTool.input);
        const demo2InputKeys = Object.keys(demo2Tool.input);
        console.log(`   输入结构一致: ${JSON.stringify(ourInputKeys) === JSON.stringify(demo2InputKeys) ? '✅' : '❌'}`);
      }

    } catch (demo2Error) {
      console.log(`❌ Demo2测试失败: ${demo2Error.message}`);
    }

    // 保存结果
    const fs = require('fs');
    const path = require('path');
    const resultFile = path.join(__dirname, 'fixed-router-test-result.json');
    fs.writeFileSync(resultFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      testCase: "修复后的router工具调用测试",
      ourResult: {
        success: true,
        duration: duration,
        response: response.data,
        hasToolUse: hasToolUse
      }
    }, null, 2));
    console.log(`\n📁 结果保存到: ${resultFile}`);

  } catch (error) {
    console.log(`❌ Router测试失败: ${error.message}`);
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   错误详情: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

// 运行测试
testFixedRouter().catch(console.error);