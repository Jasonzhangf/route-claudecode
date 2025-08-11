#!/usr/bin/env node

/**
 * 尝试重现特定的空文本问题
 * 测试可能导致空文本的边缘情况
 */

const fetch = require('node-fetch');

// 测试场景1：多个工具调用
async function testMultipleTools(port, providerName) {
  console.log(`\n🔧 测试 ${providerName} 多工具调用 (端口 ${port})`);
  
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
            content: "Please use multiple tools: first TodoWrite to create a todo, then Bash to check the current directory"
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
          },
          {
            name: "Bash",
            description: "Execute bash commands",
            input_schema: {
              type: "object",
              properties: {
                command: {type: "string"}
              },
              required: ["command"]
            }
          }
        ]
      })
    });

    const responseText = await response.text();
    
    if (response.ok) {
      console.log(`✅ ${providerName} 多工具响应成功`);
      
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log(`📋 内容块数量: ${jsonResponse.content?.length || 0}`);
        
        let foundEmptyText = false;
        jsonResponse.content?.forEach((block, i) => {
          console.log(`   块 ${i + 1}: type="${block.type}"`);
          
          if (block.type === 'text') {
            if (!block.text || block.text.trim() === '') {
              console.log(`   ❌ 空文本块! text="${block.text}"`);
              foundEmptyText = true;
            } else {
              console.log(`   ✅ 文本: "${block.text.substring(0, 30)}..."`);
            }
          } else if (block.type === 'tool_use') {
            console.log(`   🔧 工具: ${block.name}`);
          }
        });
        
        if (foundEmptyText) {
          console.log(`❌ ${providerName} 发现空文本块！`);
        } else {
          console.log(`✅ ${providerName} 无空文本问题`);
        }
        
      } catch (parseError) {
        console.log(`❌ JSON解析失败: ${parseError.message}`);
      }
    } else {
      console.log(`❌ ${providerName} 请求失败: ${response.status}`);
      console.log('错误响应:', responseText.substring(0, 200));
    }
    
  } catch (error) {
    console.log(`❌ ${providerName} 连接失败: ${error.message}`);
  }
}

// 测试场景2：只有工具调用，没有文本
async function testToolOnlyResponse(port, providerName) {
  console.log(`\n🔧 测试 ${providerName} 纯工具响应 (端口 ${port})`);
  
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
            content: "Just call the TodoWrite tool, don't say anything else"
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
      console.log(`✅ ${providerName} 纯工具响应成功`);
      
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log(`📋 内容块数量: ${jsonResponse.content?.length || 0}`);
        
        let foundEmptyText = false;
        let hasText = false;
        
        jsonResponse.content?.forEach((block, i) => {
          console.log(`   块 ${i + 1}: type="${block.type}"`);
          
          if (block.type === 'text') {
            hasText = true;
            if (!block.text || block.text.trim() === '') {
              console.log(`   ❌ 空文本块! text="${block.text}"`);
              foundEmptyText = true;
            } else {
              console.log(`   ✅ 文本: "${block.text.substring(0, 30)}..."`);
            }
          } else if (block.type === 'tool_use') {
            console.log(`   🔧 工具: ${block.name}`);
          }
        });
        
        if (foundEmptyText) {
          console.log(`❌ ${providerName} 发现空文本块！`);
        } else if (!hasText) {
          console.log(`ℹ️ ${providerName} 无文本块（纯工具响应）`);
        } else {
          console.log(`✅ ${providerName} 无空文本问题`);
        }
        
      } catch (parseError) {
        console.log(`❌ JSON解析失败: ${parseError.message}`);
      }
    } else {
      console.log(`❌ ${providerName} 请求失败: ${response.status}`);
    }
    
  } catch (error) {
    console.log(`❌ ${providerName} 连接失败: ${error.message}`);
  }
}

async function main() {
  console.log('🔍 测试特定的空文本问题场景\n');
  
  // 测试多工具场景
  await testMultipleTools(3456, '开发环境 (CodeWhisperer)');
  await testMultipleTools(8888, '发布环境 (Gemini)');
  
  // 测试纯工具场景
  await testToolOnlyResponse(3456, '开发环境 (CodeWhisperer)');
  await testToolOnlyResponse(8888, '发布环境 (Gemini)');
  
  console.log('\n🎯 特定场景测试完成');
}

main().catch(console.error);