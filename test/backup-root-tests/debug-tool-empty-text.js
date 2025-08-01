#!/usr/bin/env node

/**
 * 专门测试工具调用的空文本问题
 */

const fetch = require('node-fetch');

async function testToolCall(port, providerName) {
  console.log(`\n🔧 测试 ${providerName} 工具调用 (端口 ${port})`);
  
  try {
    const response = await fetch(`http://localhost:${port}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test'
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user", 
            content: "Please use the TodoWrite tool to create a simple todo item for testing"
          }
        ],
        tools: [
          {
            name: "TodoWrite",
            description: "Create and manage todo items",
            input_schema: {
              type: "object",
              properties: {
                todos: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      content: {type: "string"},
                      status: {type: "string"}, 
                      priority: {type: "string"},
                      id: {type: "string"}
                    },
                    required: ["content", "status", "priority", "id"]
                  }
                }
              },
              required: ["todos"]
            }
          }
        ]
      })
    });

    const responseText = await response.text();
    
    if (response.ok) {
      console.log(`✅ ${providerName} 工具调用响应成功`);
      
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log(`📋 内容块数量: ${jsonResponse.content?.length || 0}`);
        
        jsonResponse.content?.forEach((block, i) => {
          console.log(`   块 ${i + 1}: type="${block.type}"`);
          
          if (block.type === 'text') {
            if (!block.text || block.text.trim() === '') {
              console.log(`   ❌ 空文本块发现! text="${block.text}"`);
            } else {
              console.log(`   ✅ 文本: "${block.text.substring(0, 50)}..."`);
            }
          } else if (block.type === 'tool_use') {
            console.log(`   🔧 工具: ${block.name}, id: ${block.id}`);
            console.log(`   🔧 输入: ${JSON.stringify(block.input)}`);
          }
        });
        
      } catch (parseError) {
        console.log(`❌ JSON解析失败: ${parseError.message}`);
        console.log('原始响应前200字符:', responseText.substring(0, 200));
      }
    } else {
      console.log(`❌ ${providerName} 请求失败: ${response.status}`);
      console.log('错误响应:', responseText.substring(0, 200));
    }
    
  } catch (error) {
    console.log(`❌ ${providerName} 连接失败: ${error.message}`);
  }
}

async function main() {
  console.log('🔧 调试工具调用空文本响应问题\n');
  
  // 测试3456端口 (dev - 主要是CodeWhisperer)
  await testToolCall(3456, '开发环境 (CodeWhisperer)');
  
  // 测试8888端口 (release - 包含Gemini)
  await testToolCall(8888, '发布环境 (Gemini)');
  
  console.log('\n🎯 工具调用检查完成');
}

main().catch(console.error);